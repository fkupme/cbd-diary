import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AiConnectionService } from '../ai-connection/ai-connection.service';

interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService {
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
            where: { chat_id: chatId },
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

  private buildAnalysisPrompt(
    user: any,
    entry: any,
    emotionLabels: Record<number, string>,
  ): string {
    const tags = Array.isArray(entry?.tags) ? entry.tags : [];
    const lines: string[] = [];

    // Роль и стиль
    lines.push(
      'Ты — эмпатичный ассистент, помогающий в рамках когнитивно‑поведенческого подхода (КПТ).',
    );
    lines.push(
      'Работай бережно, без оценок и диагнозов, не морализируй, не обесценивай опыт. Пиши по‑русски.',
    );
    lines.push(
      'Главный протокол: один ответ — один короткий вопрос (до ~20–25 слов). Не задавай несколько вопросов сразу. Не переходи к гипотезам и диспуту, пока не собраны ответы.',
    );
    lines.push(
      'Строго запрещено: любые пояснения для разработчика/модели, метатекст и комментарии «в скобках», упоминания правил/инструкций, предисловия типа «после ответа я…». Пиши только полезный текст для пользователя.',
    );
    lines.push(
      'После ответа пользователя делай короткую проверку понимания: начни фразой «Верно ли я понимаю: …?» и переформулируй ключевую мысль своими словами (1–2 строки), затем задай ОДИН следующий вопрос.',
    );
    lines.push('');

    // Контекст пользователя
    lines.push('Контекст пользователя:');
    lines.push(`- id: ${user?.id}`);
    if (user?.name) lines.push(`- имя: ${user.name}`);
    if (user?.preferredLanguage)
      lines.push(`- язык интерфейса: ${user.preferredLanguage}`);
    if (user?.age) lines.push(`- возраст: ${user.age}`);
    if (user?.gender) lines.push(`- пол: ${user.gender}`);
    lines.push('');

    // Событие (СМЭР)
    lines.push('Событие (СМЭР):');
    if (entry?.entryDate)
      lines.push(`- дата: ${new Date(entry.entryDate).toISOString()}`);
    lines.push(`- Ситуация: ${entry?.situation ?? ''}`);

    if (Array.isArray(entry?.thoughts) && entry.thoughts.length) {
      const thoughtsBlock = entry.thoughts
        .map((t: any) => {
          const emotionsList = Array.isArray(t?.emotions)
            ? t.emotions
                .map((e: any) => {
                  const id = Number(e?.emotionId ?? e?.id);
                  const label = emotionLabels[id] ?? String(id);
                  const intensity = e?.intensity ?? '';
                  return `${label} (${intensity}/10)`;
                })
                .join(', ')
            : '';
          const thoughtText = t?.thought ?? '';
          return `• Мысль: ${thoughtText}${emotionsList ? ` | Эмоции: [${emotionsList}]` : ''}`;
        })
        .join('\n');
      lines.push('- Мысли и эмоции:');
      lines.push(thoughtsBlock);
    }

    if (entry?.reactions) lines.push(`- Реакция/поведение: ${entry.reactions}`);
    if (tags.length) lines.push(`- Теги: ${tags.join(', ')}`);
    lines.push('');

    // Правила уточнения контекста (но по одному вопросу за раз)
    lines.push('Задавай вопросы по одному, в такой приоритетности:');
    lines.push('- участники и отношения (кто вовлечён, роли/границы)');
    lines.push('- значимость и ожидания (что было важно, какие ожидания)');
    lines.push('- альтернативные объяснения и контекст');
    lines.push('- ценности и потребности');
    lines.push('Формулируй один краткий открытый вопрос.');
    lines.push('');

    // Поиск гипотезы — только когда ответы собраны
    lines.push(
      'Когда (и только когда) будут получены ответы на серию уточняющих вопросов, предложи 1 гипотезу глубинного убеждения (1 строка).',
    );
    lines.push(
      'Затем сделай короткий КПТ‑диспут (2–3 предложения) и предложи одну более сбалансированную мысль (1 строка).',
    );
    lines.push('');

    // Краткая справка
    lines.push('Справка (кратко):');
    lines.push(
      '- Поиск убеждения ("падающая стрела"): «Что это значит для меня? И если это правда, что это говорит обо мне/мире?» — повторять, пока не появится обобщённое «я…/другие…/мир…».',
    );
    lines.push(
      '- Частые искажения: всё‑или‑ничего, катастрофизация, чтение мыслей, чрезмерное обобщение, эмоциональное обоснование, «долженствование», обесценивание позитивного, персонализация.',
    );
    lines.push(
      '- Техники диспута: сократические вопросы, вероятностная оценка, декатастрофизация, когнитивный континуум, переатрибуция, «за/против», поведенческий эксперимент.',
    );
    lines.push('');

    // Формат ответа
    lines.push('Формат ответа:');
    lines.push(
      '• Если истории ещё нет: задай ОДИН первый вопрос и остановись.',
    );
    lines.push(
      '• Если пришёл ответ пользователя: сначала «Верно ли я понимаю: …?» (1–2 строки), затем ОДИН следующий вопрос и остановись.',
    );

    return lines.join('\n');
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

  private buildFinalizationSchemaInstruction(): string {
    return (
      'Сформируй ИСКЛЮЧИТЕЛЬНО JSON-объект без комментариев и текста вокруг по схеме:\n' +
      '{\n' +
      '  "beliefs": [{ "text": string, "confidenceModel": number }],\n' +
      '  "distortions": [{ "type": string, "confidence": number }],\n' +
      '  "dispute": { "proposed": string, "user_agreed": boolean },\n' +
      '  "balanced_thought": string,\n' +
      '  "next_steps": string[],\n' +
      '  "outcome": "agreed" | "partially_agreed" | "not_agreed",\n' +
      '  "finalized": true\n' +
      '}'
    );
  }

  private async generateFinalizationSummary(
    userId: string,
    chatId: string,
  ): Promise<any> {
    try {
      const [chat, entry, user, history] = await Promise.all([
        this.prisma.chat.findUnique({ where: { id: chatId } }),
        this.prisma.cbtEntry.findFirst({
          where: {
            id: (await this.prisma.chat.findUnique({
              where: { id: chatId },
              select: { cbtEntryId: true },
            }))!.cbtEntryId,
          },
        }),
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.chatMessage.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      if (!chat) throw new NotFoundException('Чат не найден');

      const system = this.buildAnalysisPrompt(
        user,
        entry,
        await this.buildEmotionLabels(entry),
      );
      const schema = this.buildFinalizationSchemaInstruction();

      const messages: {
        role: 'system' | 'user' | 'assistant';
        content: string;
      }[] = [
        {
          role: 'system',
          content:
            system + '\n\n' + 'В конце сгенерируй краткую сводку сеанса.',
        },
      ];
      for (const m of history as any[]) {
        if (m.role === 'SYSTEM') continue;
        messages.push({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: String(m.content ?? ''),
        });
      }
      // Добавляем строгую инструкцию JSON-схемы последним system-сообщением
      messages.unshift({ role: 'system', content: schema });

      // Финализация — структурный JSON: даём небольшой бюджет размышлений
      // и запас по токенам, чтобы схема не обрезалась
      const text = await this.aiConnection.generateText(messages, {
        temperature: 0.4,
        maxTokens: 2048,
        thinkingBudget: 256,
      });
      try {
        const parsed = JSON.parse(text || '{}');
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
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

    const emotionLabels = await this.buildEmotionLabels(entry);
    const systemPrompt = this.buildAnalysisPrompt(user, entry, emotionLabels);
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
