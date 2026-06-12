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
  ALLOWED_ROLLBACKS,
  ChatStage,
  SessionPlan,
  SupervisorVerdict,
  buildConductorPrompt,
  buildFinalizationSystemPrompt,
  buildSessionPlanInstruction,
  buildSmerBlock,
  buildSupervisorInstruction,
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

  /**
   * Оптимистичная запись стейта стадии. Двигатель против гонки конкурентных
   * супервизоров: пишем ТОЛЬКО если stageVersion не изменилась с момента чтения.
   * Любая мутация бампает версию. Вернёт false, если версия уехала (degrade).
   */
  private async mutateStage(
    chatId: string,
    expectedVersion: number,
    data: { stage?: ChatStage; stageData?: any },
  ): Promise<boolean> {
    const res = await this.prisma.chat.updateMany({
      where: { id: chatId, stageVersion: expectedVersion, finalized: false },
      data: { ...data, stageVersion: expectedVersion + 1 },
    });
    return res.count > 0;
  }

  /** Сколько ходов пользователя прошло на текущей стадии (для бюджета). */
  private async countStageTurns(
    chatId: string,
    stageEnteredAt?: string | null,
  ): Promise<number> {
    const where: any = { chatId, role: 'USER' };
    if (stageEnteredAt) where.createdAt = { gt: new Date(stageEnteredAt) };
    return this.prisma.chatMessage.count({ where });
  }

  /**
   * Дешёвый СИНХРОННЫЙ safety-гейт по входящему сообщению пользователя.
   * Гонять модель на каждом ходу дорого, поэтому сначала быстрый префильтр по
   * кризисным маркерам, и только при совпадении — подтверждение моделью
   * (чтобы отсеять фигуры речи «умираю со стыда»). Возвращает true, если
   * стейт нужно синхронно перевести в safety ДО стрима ведущего.
   */
  private async detectCrisis(userText: string): Promise<boolean> {
    const text = (userText || '').toLowerCase();
    if (!text.trim()) return false;
    // Префильтр: грубые маркеры само-/чужого вреда. Лучше перехватить и
    // подтвердить моделью, чем пропустить.
    const markers =
      /(суицид|убить себя|убью себя|покончить|не хочу жить|жить не хочу|свести счёты|свести счеты|причинить себе|порезать себя|режу себя|нанести вред|убить (его|её|ее|их)|расправ|самоубийств|вскрыть вены|спрыгнуть|таблетк.{0,12}(чтобы|разом)|сдохнуть)/i;
    if (!markers.test(text)) return false;
    try {
      const out = await this.aiConnection.generateText(
        [
          {
            role: 'system',
            content:
              'Ты — фильтр безопасности. Верни ИСКЛЮЧИТЕЛЬНО JSON {"crisis": boolean}. crisis = true, если в сообщении есть РЕАЛЬНЫЕ суицидальные мысли, намерение самоповреждения, желание причинить вред себе/другим или насилие над автором. Метафоры и фигуры речи («умираю со стыда», «убил бы за такое» в шутку) — crisis: false.',
          },
          { role: 'user', content: userText },
        ],
        { temperature: 0, maxTokens: 64, thinkingBudget: 0, responseJson: true },
      );
      const parsed = JSON.parse(out || '{}');
      return parsed?.crisis === true;
    } catch {
      // Модель недоступна/мусор: при сработавшем префильтре безопаснее перейти
      // в safety, чем продолжать разбор.
      return true;
    }
  }

  /**
   * СУПЕРВИЗОР: дешёвый структурный вызов ПОСЛЕ хода ведущего (fire-and-forget).
   * Решает stay/advance/rollback, может выдать директиву на следующий ход и
   * обновить план. Запись — оптимистичная (mutateStage): если за время вызова
   * стейт уехал (конкурентный супервизор / consume директивы), вердикт
   * дропается. Невалидный JSON / упавшая модель — тоже degrade без изменений.
   */
  private async runSupervisor(
    chatId: string,
    currentStage: ChatStage,
    freshAiText: string,
  ): Promise<void> {
    try {
      const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
      if (!chat || chat.finalized) return;
      const stageData: any = (chat.stageData as any) ?? {};
      const version: number = (chat as any).stageVersion ?? 0;
      const plan: SessionPlan | null = stageData.plan ?? null;
      const stageArtifact = stageData[currentStage] ?? null;
      const stageTurns = await this.countStageTurns(
        chatId,
        stageData.stageEnteredAt,
      );

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

      const raw = await this.aiConnection.generateText(
        [
          {
            role: 'system',
            content: buildSupervisorInstruction(
              currentStage,
              plan,
              stageTurns,
              stageArtifact,
            ),
          },
          { role: 'user', content: dialog.join('\n') },
        ],
        { temperature: 0, maxTokens: 512, thinkingBudget: 0, responseJson: true },
      );

      let v: Partial<SupervisorVerdict> = {};
      try {
        v = JSON.parse(raw || '{}');
      } catch {
        return; // degrade
      }

      const directive =
        typeof v.directive === 'string' && v.directive.trim()
          ? v.directive.trim()
          : null;
      const planUpdate =
        typeof v.planUpdate === 'string' && v.planUpdate.trim()
          ? v.planUpdate.trim()
          : null;
      const nextPlan: SessionPlan | null =
        plan && planUpdate
          ? { ...plan, notes: [...(plan.notes ?? []), planUpdate].slice(-5) }
          : plan;

      // 1) Safety — приоритетное прерывание из любой стадии
      if (v.safetyConcern === true && currentStage !== 'safety') {
        const ok = await this.mutateStage(chatId, version, {
          stage: 'safety',
          stageData: {
            ...stageData,
            plan: nextPlan,
            resumeStage: currentStage,
            stageEnteredAt: new Date().toISOString(),
            directive: null,
          },
        });
        if (ok) this.logger.warn(`chat ${chatId}: safetyConcern -> safety`);
        return;
      }

      const verdict = v.verdict;

      // 2) Выход из safety
      if (currentStage === 'safety') {
        if (verdict !== 'advance') return;
        const resume: ChatStage =
          (stageData.resumeStage as ChatStage) || 'collect_context';
        await this.mutateStage(chatId, version, {
          stage: resume,
          stageData: {
            ...stageData,
            plan: nextPlan,
            resumeStage: null,
            stageEnteredAt: new Date().toISOString(),
            directive: null,
          },
        });
        this.logger.log(`chat ${chatId}: safety -> ${resume}`);
        return;
      }

      // 3) advance -> следующая стадия, артефакт под ключ текущей стадии
      if (verdict === 'advance') {
        const next = nextStage(currentStage);
        const artifacts =
          v.artifacts && typeof v.artifacts === 'object' ? v.artifacts : {};
        await this.mutateStage(chatId, version, {
          stage: next ?? currentStage,
          stageData: {
            ...stageData,
            plan: nextPlan,
            [currentStage]: artifacts,
            stageEnteredAt: new Date().toISOString(),
            directive: null,
            ...(next ? {} : { readyToFinalize: true }),
          },
        });
        this.logger.log(
          `chat ${chatId}: ${currentStage} -> ${next ?? 'готов к финализации'}`,
        );
        return;
      }

      // 4) rollback — только в разрешённую стадию
      if (verdict === 'rollback') {
        const allowed = ALLOWED_ROLLBACKS[currentStage] ?? [];
        const target = v.rollbackTo as ChatStage | undefined;
        if (target && allowed.includes(target)) {
          await this.mutateStage(chatId, version, {
            stage: target,
            stageData: {
              ...stageData,
              plan: nextPlan,
              stageEnteredAt: new Date().toISOString(),
              directive,
            },
          });
          this.logger.log(`chat ${chatId}: rollback ${currentStage} -> ${target}`);
        }
        return;
      }

      // 5) stay — записываем только директиву/план, если они есть
      if (directive || nextPlan !== plan) {
        await this.mutateStage(chatId, version, {
          stageData: { ...stageData, plan: nextPlan, directive },
        });
      }
    } catch (e: any) {
      this.logger.warn(
        `runSupervisor failed for chat ${chatId}: ${e?.message || e}`,
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

    const stageData: any = (chat.stageData as any) ?? {};
    const version: number = (chat as any).stageVersion ?? 0;
    let stage: ChatStage = (chat.stage as ChatStage) || 'collect_context';
    const plan: SessionPlan | null = stageData.plan ?? null;

    // СИНХРОННЫЙ safety-гейт: проверяем ПОСЛЕДНЕЕ сообщение пользователя ДО
    // стрима. Safety — единственное, ради чего мы платим латентностью перед
    // ходом (и только при срабатывании грубого префильтра). Если кризис — сразу
    // переводим стейт в safety и ведём этот же ход уже в режиме поддержки,
    // не дожидаясь асинхронного супервизора.
    if (stage !== 'safety') {
      const lastUser = [...history]
        .reverse()
        .find((m) => m.role === 'USER')?.content;
      if (lastUser && (await this.detectCrisis(String(lastUser)))) {
        const ok = await this.mutateStage(chatId, version, {
          stage: 'safety',
          stageData: {
            ...stageData,
            resumeStage: stage,
            stageEnteredAt: new Date().toISOString(),
            directive: null,
          },
        });
        if (ok) {
          stage = 'safety';
          this.logger.warn(`chat ${chatId}: sync safety-gate -> safety`);
        }
      }
    }

    // Директива потребляется ровно один раз: читаем для этого хода и гасим в
    // стейте (идемпотентность — если супервизор следующего хода упадёт, старая
    // директива не прилипнет на 2–3 хода). Гашение бампает версию, поэтому
    // запоздавший супервизор прошлого хода с этой же директивой получит degrade.
    const directive: string | null =
      typeof stageData.directive === 'string' && stageData.directive.trim()
        ? stageData.directive.trim()
        : null;
    // Гасим директиву в стейте (если не ушли в safety — там стейт уже мутирован
    // выше). runSupervisor ниже перечитает версию сам, так что бамп безопасен.
    if (directive && stage !== 'safety') {
      await this.mutateStage(chatId, version, {
        stageData: { ...stageData, directive: null },
      });
    }

    const emotionLabels = await this.buildEmotionLabels(entry);
    const systemPrompt = buildConductorPrompt({
      user,
      entry,
      emotionLabels,
      stage,
      plan,
      directive: stage === 'safety' ? null : directive,
    });
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

    // Супервизор — отдельным дешёвым вызовом, не задерживая ответ
    void this.runSupervisor(chatId, stage, full);

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

    // План сессии генерим в фоне (fire-and-forget): первый ход стартует в
    // collect_context одинаково при любом плане, поэтому не блокируем создание
    // чата ещё одним LLM-вызовом. Когда план готов — он лежит в stageData.plan
    // и подхватится со следующего хода.
    void this.generateSessionPlan(userId, chat.id, entry);

    // Авто-генерацию ответа переносим на фронт (стрим),
    // чтобы избежать двойных стартовых сообщений
    return chat;
  }

  /**
   * Генерация плана сессии: цель, мост с прошлой сессии (незакрытые next_steps),
   * известные паттерны (повторяющиеся убеждения). Пишется в stageData.plan
   * оптимистично, чтобы не затереть параллельный первый ход.
   */
  private async generateSessionPlan(
    userId: string,
    chatId: string,
    entry: any,
  ): Promise<void> {
    try {
      const [recurring, lastFin] = await Promise.all([
        this.prisma.userBelief.findMany({
          where: { userId, occurrencesCount: { gte: 2 }, status: 'active' },
          orderBy: { occurrencesCount: 'desc' },
          take: 5,
          select: { text: true, occurrencesCount: true },
        }),
        this.prisma.chatFinalization.findFirst({
          where: { chat: { userId } },
          orderBy: { createdAt: 'desc' },
          select: { summary: true },
        }),
      ]);

      const lastNextSteps: string[] = Array.isArray(
        (lastFin?.summary as any)?.next_steps,
      )
        ? ((lastFin!.summary as any).next_steps as any[])
            .map((s) => String(s))
            .filter(Boolean)
            .slice(0, 5)
        : [];

      const smer = buildSmerBlock(entry, await this.buildEmotionLabels(entry));
      const instruction = buildSessionPlanInstruction({
        smerBlock: smer,
        recurringBeliefs: recurring,
        lastNextSteps,
      });

      const raw = await this.aiConnection.generateText(
        [
          { role: 'system', content: instruction },
          { role: 'user', content: 'Составь план.' },
        ],
        { temperature: 0.3, maxTokens: 512, thinkingBudget: 0, responseJson: true },
      );

      let parsed: any = {};
      try {
        parsed = JSON.parse(raw || '{}');
      } catch {
        return;
      }
      const plan: SessionPlan = {
        goal: typeof parsed?.goal === 'string' ? parsed.goal : 'Проверить ключевую мысль из записи',
        bridge:
          typeof parsed?.bridge === 'string' && parsed.bridge.trim()
            ? parsed.bridge.trim()
            : null,
        knownPatterns: Array.isArray(parsed?.knownPatterns)
          ? parsed.knownPatterns.map((p: any) => String(p)).filter(Boolean).slice(0, 3)
          : [],
        notes: [],
      };

      // Оптимистично: не затираем стейт, если первый ход уже что-то записал
      const fresh = await this.prisma.chat.findUnique({ where: { id: chatId } });
      if (!fresh || fresh.finalized) return;
      const version: number = (fresh as any).stageVersion ?? 0;
      const stageData: any = (fresh.stageData as any) ?? {};
      await this.mutateStage(chatId, version, {
        stageData: { ...stageData, plan },
      });
    } catch (e: any) {
      this.logger.warn(
        `generateSessionPlan failed for chat ${chatId}: ${e?.message || e}`,
      );
    }
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
