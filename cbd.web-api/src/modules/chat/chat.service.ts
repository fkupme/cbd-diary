import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AiConnectionService } from '../ai-connection/ai-connection.service';
import {
  ChatStage,
  buildFinalizationSystemPrompt,
  buildScaffold,
  buildSmerBlock,
  buildStageInstruction,
  buildTransitionInstruction,
  nextStage,
} from './chat-prompts';

interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private inactivityTimers = new Map<string, NodeJS.Timeout>();
  private readonly INACTIVITY_MS = 5 * 60 * 1000; // 5 минут

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConnection: AiConnectionService,
    private readonly configService: ConfigService,
  ) {}

  private scheduleTimeout(chatId: string) {
    // Сброс предыдущего
    const prev = this.inactivityTimers.get(chatId);
    if (prev) clearTimeout(prev);
    const timeoutMs = Number(
      this.configService.get<number>('app.chatSummaryTimeoutMs') ??
        Number(process.env.CHAT_SUMMARY_TIMEOUT || 5 * 60 * 1000),
    );
    const t = setTimeout(async () => {
      try {
        const chat: any = await (this.prisma as any).chat.findUnique({
          where: { id: chatId },
        });
        if (!chat) return;
        if (chat.finalized) return;
        // Условие: считаем разговор законченным, только если пар сообщений >= порога
        const messages = await (this.prisma as any).chatMessage.findMany({
          where: { chatId },
          select: { role: true },
        });
        const userCount = messages.filter((m: any) => m.role === 'USER').length;
        const aiCount = messages.filter((m: any) => m.role === 'AI').length;
        const minPairs = Number(
          this.configService.get<number>('app.chatSummaryConditionPairs') ??
            Number(process.env.CHAT_SUMMARY_CONDITION || 3),
        );
        const pairs = Math.min(userCount, aiCount);
        if (pairs >= minPairs) {
          const endedAt = new Date();

          // Получим userId для генерации сводки
          const chatOwner = await (this.prisma as any).chat.findUnique({
            where: { id: chatId },
            select: { userId: true },
          });

          let summary: any = {};
          try {
            if (chatOwner?.userId) {
              summary = await this.generateFinalizationSummary(
                chatOwner.userId,
                chatId,
              );
            }
          } catch {}

          await (this.prisma as any).chat.update({
            where: { id: chatId },
            data: {
              finalized: true,
              endReason: 'timeout',
              endedAt,
            },
          });

          // Сохраняем финализацию (с полученной сводкой, если удалось)
          const fin = await (this.prisma as any).chatFinalization.upsert({
            where: { chatId },
            update: {
              outcome:
                typeof summary?.outcome === 'string' ? summary.outcome : null,
              endReason: 'timeout',
              endedAt,
              summary: summary ?? {},
            },
            create: {
              chatId,
              outcome:
                typeof summary?.outcome === 'string' ? summary.outcome : null,
              endReason: 'timeout',
              endedAt,
              summary: summary ?? {},
            },
          });

          // Апдейт убеждений пользователя, если модель что-то вернула
          if (chatOwner?.userId && Array.isArray(summary?.beliefs)) {
            for (const b of summary.beliefs) {
              const text = (b?.text ?? '').toString().trim();
              if (!text) continue;
              const now = new Date();
              const userBeliefClient = (this.prisma as any).userBelief;
              const last = await userBeliefClient.findFirst({
                where: { userId: chatOwner.userId, text },
              });
              if (last) {
                await userBeliefClient.update({
                  where: { id: last.id },
                  data: {
                    occurrencesCount: { increment: 1 },
                    lastSeenAt: now,
                    confidenceAvg:
                      typeof b?.confidenceModel === 'number'
                        ? (last.confidenceAvg * last.occurrencesCount +
                            b.confidenceModel) /
                          (last.occurrencesCount + 1)
                        : last.confidenceAvg,
                    sources: (last.sources as any[]).concat({
                      chatId,
                      when: now.toISOString(),
                    }),
                  },
                });
              } else {
                await userBeliefClient.create({
                  data: {
                    userId: chatOwner.userId,
                    text,
                    occurrencesCount: 1,
                    confidenceAvg:
                      typeof b?.confidenceModel === 'number'
                        ? b.confidenceModel
                        : 0,
                    firstSeenAt: now,
                    lastSeenAt: now,
                    sources: [{ chatId, when: now.toISOString() }],
                    status: 'active',
                  },
                });
              }
            }
          }
        }
      } catch {}
    }, timeoutMs);
    this.inactivityTimers.set(chatId, t);
  }

  private clearTimeoutFor(chatId: string) {
    const t = this.inactivityTimers.get(chatId);
    if (t) {
      clearTimeout(t);
      this.inactivityTimers.delete(chatId);
    }
  }

  // Системный промпт хода: общий каркас + СМЭР + инструкция ТЕКУЩЕЙ стадии
  private buildStagePrompt(
    user: any,
    entry: any,
    emotionLabels: Record<number, string>,
    stage: ChatStage,
  ): string {
    return [
      buildScaffold(user),
      buildSmerBlock(entry, emotionLabels),
      buildStageInstruction(stage),
    ].join('\n\n');
  }

  /**
   * Transition-чекер: после хода ИИ дешёвым структурным вызовом решаем,
   * завершена ли стадия, и двигаем Chat.stage. Вызывается fire-and-forget,
   * чтобы не задерживать ai_done.
   */
  private async maybeAdvanceStage(
    chatId: string,
    currentStage: ChatStage,
    freshAiText: string,
  ): Promise<void> {
    try {
      const recent = await this.prisma.chatMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        take: -8,
      });
      const dialog = recent
        .filter((m) => m.role === 'USER' || m.role === 'AI')
        .map(
          (m) =>
            `${m.role === 'USER' ? 'Пользователь' : 'Ассистент'}: ${m.content}`,
        );
      if (freshAiText.trim()) dialog.push(`Ассистент: ${freshAiText.trim()}`);
      if (!dialog.length) return;

      const text = await this.aiConnection.generateText(
        [
          { role: 'system', content: buildTransitionInstruction(currentStage) },
          { role: 'user', content: dialog.join('\n') },
        ],
        { temperature: 0, maxTokens: 512, thinkingBudget: 0, responseJson: true },
      );

      let verdict: any = {};
      try {
        verdict = JSON.parse(text || '{}');
      } catch {
        return;
      }

      const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
      if (!chat || chat.finalized) return;
      const stageData: any = (chat.stageData as any) ?? {};

      // Кризисные маркеры — приоритетное прерывание в safety
      if (verdict?.safetyConcern === true && currentStage !== 'safety') {
        await this.prisma.chat.update({
          where: { id: chatId },
          data: {
            stage: 'safety',
            stageData: { ...stageData, resumeStage: currentStage },
          },
        });
        this.logger.warn(`chat ${chatId}: safetyConcern -> стадия safety`);
        return;
      }

      if (verdict?.stageComplete !== true) return;

      if (currentStage === 'safety') {
        // Выход из safety — возвращаемся к прерванной стадии
        const resume: ChatStage =
          (stageData?.resumeStage as ChatStage) || 'collect_context';
        await this.prisma.chat.update({
          where: { id: chatId },
          data: {
            stage: resume,
            stageData: { ...stageData, resumeStage: null },
          },
        });
        this.logger.log(`chat ${chatId}: safety -> ${resume}`);
        return;
      }

      const next = nextStage(currentStage);
      const artifacts =
        verdict?.artifacts && typeof verdict.artifacts === 'object'
          ? verdict.artifacts
          : {};
      await this.prisma.chat.update({
        where: { id: chatId },
        data: {
          stage: next ?? currentStage,
          stageData: {
            ...stageData,
            [currentStage]: artifacts,
            ...(next ? {} : { readyToFinalize: true }),
          },
        },
      });
      this.logger.log(
        `chat ${chatId}: стадия ${currentStage} завершена -> ${next ?? 'готов к финализации'}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `maybeAdvanceStage failed for chat ${chatId}: ${e?.message || e}`,
      );
    }
  }

  private async buildEmotionLabels(
    entry: any,
  ): Promise<Record<number, string>> {
    const emotionIds = new Set<number>();
    if (Array.isArray(entry?.thoughts)) {
      for (const t of entry.thoughts as any[]) {
        if (Array.isArray(t?.emotions)) {
          for (const e of t.emotions) {
            const id = Number(e?.emotionId ?? e?.id);
            if (!Number.isNaN(id)) emotionIds.add(id);
          }
        }
      }
    }
    if (!emotionIds.size) return {};
    const found = await this.prisma.emotion.findMany({
      where: { id: { in: Array.from(emotionIds) } },
      select: { id: true, nameKey: true, emoji: true },
    });
    return found.reduce<Record<number, string>>((acc, e) => {
      const label = `${e.emoji ?? ''} ${e.nameKey}`.trim();
      acc[e.id] = label;
      return acc;
    }, {});
  }

  private async generateFinalizationSummary(
    userId: string,
    chatId: string,
  ): Promise<any> {
    try {
      const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
      if (!chat) throw new NotFoundException('Чат не найден');

      const [entry, history] = await Promise.all([
        this.prisma.cbtEntry.findFirst({ where: { id: chat.cbtEntryId } }),
        this.prisma.chatMessage.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      // Отдельный промпт аналитика: без диалогового протокола, который
      // конфликтовал бы с задачей «выдай только JSON»
      const smer = buildSmerBlock(entry, await this.buildEmotionLabels(entry));
      const stageData = (chat.stageData as any) ?? {};
      const artifactsBlock = Object.keys(stageData).length
        ? 'Артефакты, собранные по стадиям сессии (используй их в первую очередь):\n' +
          JSON.stringify(stageData, null, 2)
        : '';

      const messages: ModelMessage[] = [
        {
          role: 'system',
          content: [buildFinalizationSystemPrompt(), smer, artifactsBlock]
            .filter(Boolean)
            .join('\n\n'),
        },
      ];
      for (const m of history as any[]) {
        if (m.role === 'SYSTEM') continue;
        messages.push({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: String(m.content ?? ''),
        });
      }

      // Структурный JSON-выход + небольшой бюджет размышлений
      const text = await this.aiConnection.generateText(messages, {
        temperature: 0.3,
        maxTokens: 2048,
        thinkingBudget: 256,
        responseJson: true,
      });
      try {
        const parsed = JSON.parse(text || '{}');
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        this.logger.warn(
          `Финализация чата ${chatId}: модель вернула невалидный JSON`,
        );
      }
      return {};
    } catch {
      return {};
    }
  }

  private mapHistoryToModelMessages(history: any[]): ModelMessage[] {
    return history
      .filter((m) => m.role === 'USER' || m.role === 'AI')
      .map((m) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: String(m.content ?? ''),
      }));
  }

  async streamAiReply(
    userId: string,
    chatId: string,
    onDelta: (delta: string) => Promise<void> | void,
  ): Promise<string> {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Чат не найден');
    if (chat.userId !== userId) throw new ForbiddenException();

    const [entry, user, history] = await Promise.all([
      this.prisma.cbtEntry.findUnique({ where: { id: chat.cbtEntryId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.chatMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        // последние 50 сообщений (take: 50 брал ПЕРВЫЕ 50 — после
        // пятидесятого сообщения модель переставала видеть новые реплики)
        take: -50,
      }),
    ]);

    // ресетим таймер при старте генерации
    this.scheduleTimeout(chatId);

    const stage: ChatStage = (chat.stage as ChatStage) || 'collect_context';
    const emotionLabels = await this.buildEmotionLabels(entry);
    const systemPrompt = this.buildStagePrompt(
      user,
      entry,
      emotionLabels,
      stage,
    );
    const messages: ModelMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.mapHistoryToModelMessages(history),
    ];

    // Живой диалог: thinking выключен (дефолт сервиса) — короткие реплики,
    // минимальная задержка
    const full = await this.aiConnection.generateTextStream(messages, onDelta, {
      temperature: 0.7,
      maxTokens: 700,
    });

    // по завершении тоже ресетим (есть активность)
    this.scheduleTimeout(chatId);

    // Решение о смене стадии — отдельным дешёвым вызовом, не задерживая ответ
    void this.maybeAdvanceStage(chatId, stage, full);

    return full;
  }

  async getOrCreateChat(userId: string, cbtEntryId: string) {
    // Проверяем принадлежность записи пользователю
    const entry = await this.prisma.cbtEntry.findFirst({
      where: { id: cbtEntryId, userId },
      select: {
        id: true,
        userId: true,
        situation: true,
        moodScoreBefore: true,
        moodScoreAfter: true,
        tags: true,
        entryDate: true,
        thoughts: true,
        reactions: true,
      },
    });
    if (!entry) throw new NotFoundException('Запись не найдена');

    const existing = await this.prisma.chat.findFirst({
      where: { cbtEntryId },
    });
    if (existing) {
      this.scheduleTimeout(existing.id);
      return existing;
    }

    const chat = await this.prisma.chat.create({
      data: {
        userId,
        cbtEntryId,
      },
    });

    this.scheduleTimeout(chat.id);

    // Авто-генерацию ответа переносим на фронт (стрим),
    // чтобы избежать двойных стартовых сообщений
    return chat;
  }

  async getChatByEntry(userId: string, cbtEntryId: string) {
    const chat = await this.prisma.chat.findFirst({ where: { cbtEntryId } });
    if (!chat) return null;
    if (chat.userId !== userId) throw new ForbiddenException();
    return chat;
  }

  async listChats(userId: string) {
    return this.prisma.chat.findMany({
      where: { userId },
      select: { id: true, cbtEntryId: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async addMessage(
    userId: string,
    chatId: string,
    role: 'USER' | 'AI' | 'SYSTEM',
    content: string,
  ) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Чат не найден');
    if (chat.userId !== userId) throw new ForbiddenException();
    const created = await this.prisma.chatMessage.create({
      data: { chatId, role, content },
    });
    // любая активность — ресет таймера
    this.scheduleTimeout(chatId);
    return created;
  }

  async listMessages(userId: string, chatId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Чат не найден');
    if (chat.userId !== userId) throw new ForbiddenException();
    return this.prisma.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async finalizeChat(userId: string, chatId: string, payload: any) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Чат не найден');
    if (chat.userId !== userId) throw new ForbiddenException();

    const endedAt = new Date();

    // Всегда запрашиваем сводку у ИИ (игнорируем клиентский payload)
    const summary = await this.generateFinalizationSummary(userId, chatId);

    // Запишем финализацию
    const fin = await (this.prisma as any).chatFinalization.upsert({
      where: { chat_id: chatId },
      update: {
        outcome: typeof summary?.outcome === 'string' ? summary.outcome : null,
        endReason: 'model_finalized',
        endedAt,
        summary: summary ?? {},
      },
      create: {
        chatId,
        outcome: typeof summary?.outcome === 'string' ? summary.outcome : null,
        endReason: 'model_finalized',
        endedAt,
        summary: summary ?? {},
      },
    });

    // снятие таймера после финализации
    this.clearTimeoutFor(chatId);

    // Обработка убеждений пользователя
    const beliefs = Array.isArray(summary?.beliefs) ? summary.beliefs : [];
    for (const b of beliefs) {
      const text = (b?.text ?? '').toString().trim();
      if (!text) continue;
      const now = new Date();
      const userBeliefClient = (this.prisma as any).userBelief;
      const last = await userBeliefClient.findFirst({
        where: { userId, text },
      });
      if (last) {
        await userBeliefClient.update({
          where: { id: last.id },
          data: {
            occurrencesCount: { increment: 1 },
            lastSeenAt: now,
            confidenceAvg:
              typeof b?.confidenceModel === 'number'
                ? (last.confidenceAvg * last.occurrencesCount +
                    b.confidenceModel) /
                  (last.occurrencesCount + 1)
                : last.confidenceAvg,
            sources: (last.sources as any[]).concat({
              chatId,
              when: now.toISOString(),
            }),
          },
        });
      } else {
        await userBeliefClient.create({
          data: {
            userId,
            text,
            occurrencesCount: 1,
            confidenceAvg:
              typeof b?.confidenceModel === 'number' ? b.confidenceModel : 0,
            firstSeenAt: now,
            lastSeenAt: now,
            sources: [{ chatId, when: now.toISOString() }],
            status: 'active',
          },
        });
      }
    }

    const u: any = fin;
    return {
      id: chatId,
      finalized: true,
      outcome: u.outcome ?? summary?.outcome ?? null,
      endedAt: u.endedAt ?? endedAt,
    };
  }
}
