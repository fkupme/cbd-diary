import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiConnectionService } from '../ai-connection/ai-connection.service';
import { CbtService } from '../cbt/cbt.service';
import { CreateCbtEntryDto } from '../cbt/dto/cbt-entry.dto';
import { EmotionsService } from '../emotions/emotions.service';
import {
  buildEmotionMappingPrompt,
  buildSegmentationPrompt,
  pluralSituations,
} from './intake-prompts';

type IntakeRole = 'USER' | 'AI' | 'SYSTEM';

// Поля интервью идут строго в этом порядке по каждому событию.
// Интенсивность теперь часть эмоций (на каждую свою), отдельного шага нет.
export type Field = 'thought' | 'emotions' | 'reactions';

export interface Cursor {
  eventId: string;
  field: Field;
}

interface AnswerPayload {
  text?: string;
  emotions?: { emotionId: number; intensity: number }[];
}

// Эмоция в черновике — snake_case, как ждёт CreateCbtEntryDto (emotion_id).
export interface DraftEmotion {
  emotion_id: number;
  intensity: number;
}

// Мысль в черновике — форма ThoughtChainDto из cbt-entry.dto.ts.
export interface DraftThought {
  thought: string;
  is_automatic?: boolean;
  intensity?: number;
  emotions: DraftEmotion[];
  cognitive_distortions?: { type: string; note?: string }[];
}

// Черновик будущей записи — ровно CreateCbtEntryDto, чтобы на commit уйти как есть.
export interface EventDraft {
  situation: string;
  thoughts: DraftThought[];
  reactions: string;
  tags?: string[];
  entryDate?: string;
}

interface EmotionCatalog {
  prompt: string;
  valid: Set<number>;
  byId: Map<number, { name: string; categoryId: number }>;
}

function emptyDraft(situation: string): EventDraft {
  return { situation, thoughts: [], reactions: '', tags: [] };
}

function pluralEntries(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'запись';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'записи';
  return 'записей';
}

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);
  private catalog: EmotionCatalog | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiConnectionService,
    private readonly emotions: EmotionsService,
    private readonly cbt: CbtService,
  ) {}

  // ===== доступ/владение =====

  private async getSessionOwned(userId: string, sessionId: string) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Сессия не найдена');
    if (session.userId !== userId) {
      throw new ForbiddenException('Это не ваша сессия');
    }
    return session;
  }

  private addMessage(
    sessionId: string,
    role: IntakeRole,
    kind: string,
    content: string,
    payload?: unknown,
  ) {
    return this.prisma.intakeMessage.create({
      data: {
        sessionId,
        role,
        kind,
        content,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  // ===== жизненный цикл =====

  /** Создать новую сессию захвата. */
  async startSession(userId: string) {
    return this.prisma.intakeSession.create({
      data: { userId, status: 'transcribing' },
    });
  }

  /** Расшифровать аудио (base64) → текст, сохранить как редактируемый транскрипт. */
  async transcribe(
    userId: string,
    sessionId: string,
    audioBase64: string,
    mimeType: string,
  ) {
    await this.getSessionOwned(userId, sessionId);
    if (!audioBase64) throw new BadRequestException('Пустое аудио');

    const text = (
      await this.ai.transcribeAudio(audioBase64, mimeType || 'audio/ogg')
    ).trim();

    await this.prisma.intakeSession.update({
      where: { id: sessionId },
      data: { transcript: text, status: text ? 'segmenting' : 'transcribing' },
    });
    if (text) {
      await this.addMessage(sessionId, 'USER', 'transcript', text);
    }
    return { transcript: text };
  }

  /** Задать/исправить транскрипт руками (правка расшифровки или ввод без аудио). */
  async setTranscript(userId: string, sessionId: string, transcript: string) {
    await this.getSessionOwned(userId, sessionId);
    const text = (transcript || '').trim();
    if (!text) throw new BadRequestException('Пустой транскрипт');
    await this.prisma.intakeSession.update({
      where: { id: sessionId },
      data: { transcript: text, status: 'segmenting' },
    });
    return { transcript: text };
  }

  /** Разбить транскрипт на ситуации-кандидаты + AI-сообщение с кнопками выбора. */
  async segment(userId: string, sessionId: string) {
    const session = await this.getSessionOwned(userId, sessionId);
    const transcript = (session.transcript || '').trim();
    if (!transcript) {
      throw new BadRequestException('Сначала нужен транскрипт');
    }

    const raw = await this.ai.generateText(
      [
        { role: 'system', content: buildSegmentationPrompt() },
        { role: 'user', content: transcript },
      ],
      { responseJson: true, temperature: 0.2, maxTokens: 1024 },
    );
    const situations = this.parseSituations(raw);
    if (situations.length === 0) {
      situations.push({ title: transcript.slice(0, 80) });
    }

    await this.prisma.intakeEvent.deleteMany({ where: { sessionId } });
    await this.prisma.intakeMessage.deleteMany({
      where: { sessionId, kind: 'buttons' },
    });

    const events = [];
    for (let i = 0; i < situations.length; i++) {
      const ev = await this.prisma.intakeEvent.create({
        data: {
          sessionId,
          orderIndex: i,
          title: situations[i].title,
          status: 'candidate',
          draft: emptyDraft(
            situations[i].title,
          ) as unknown as Prisma.InputJsonValue,
        },
      });
      events.push(ev);
    }

    await this.prisma.intakeSession.update({
      where: { id: sessionId },
      data: { status: 'selecting' },
    });

    const options = events.map((e) => ({
      id: e.id,
      label: e.title,
      value: e.id,
    }));
    const content =
      events.length === 1
        ? 'Я вижу здесь одну ситуацию. Разберём её?'
        : `Здесь я вижу ${events.length} ${pluralSituations(events.length)}. Какие разберём?`;
    const message = await this.addMessage(sessionId, 'AI', 'buttons', content, {
      multi: true,
      options,
      cta: 'Разобрать выбранные',
    });

    return { events, message };
  }

  /** Отметить выбранные ситуации и начать интервью с первой. */
  async selectEvents(userId: string, sessionId: string, selectedIds: string[]) {
    await this.getSessionOwned(userId, sessionId);
    const events = await this.prisma.intakeEvent.findMany({
      where: { sessionId },
      orderBy: { orderIndex: 'asc' },
    });
    const selected = new Set(selectedIds);
    await Promise.all(
      events.map((e) =>
        this.prisma.intakeEvent.update({
          where: { id: e.id },
          data: { status: selected.has(e.id) ? 'selected' : 'rejected' },
        }),
      ),
    );

    const chosen = events.filter((e) => selected.has(e.id));
    if (chosen.length === 0) {
      await this.prisma.intakeSession.update({
        where: { id: sessionId },
        data: { status: 'selecting' },
      });
      const msg = await this.addMessage(
        sessionId,
        'AI',
        'text',
        'Выбери хотя бы одну ситуацию, чтобы разобрать её.',
      );
      return { selected: [], messages: [msg] };
    }

    const first = chosen[0];
    await this.prisma.intakeEvent.update({
      where: { id: first.id },
      data: { status: 'interviewing' },
    });
    const question = await this.emitQuestion(sessionId, 'thought', first);
    await this.saveCursor(
      sessionId,
      { eventId: first.id, field: 'thought' },
      'interviewing',
    );

    return {
      selected: chosen.map((e) => ({ ...e, status: 'selected' as const })),
      messages: [question],
    };
  }

  /** Применить ответ пользователя к текущему полю и выдать следующий ход(ы). */
  async answer(userId: string, sessionId: string, payload: AnswerPayload) {
    const session = await this.getSessionOwned(userId, sessionId);
    const cursor = (session.stateData as any)?.cursor as Cursor | undefined;
    if (!cursor) {
      throw new BadRequestException('Интервью ещё не начато');
    }
    const event = await this.prisma.intakeEvent.findUnique({
      where: { id: cursor.eventId },
    });
    if (!event) throw new NotFoundException('Событие не найдено');
    const draft = (event.draft as any as EventDraft) || emptyDraft(event.title);
    if (!draft.thoughts) draft.thoughts = [];

    const out: any[] = [];

    const userText = this.renderUserAnswer(cursor.field, payload);
    if (userText !== null) {
      out.push(await this.addMessage(sessionId, 'USER', 'text', userText));
    }

    let nextCursor: Cursor | null = cursor;
    let status = session.status;

    switch (cursor.field) {
      case 'thought': {
        const t = (payload.text || '').trim();
        draft.thoughts = [
          {
            thought: t,
            is_automatic: true,
            intensity: 5,
            emotions: [],
            cognitive_distortions: [],
          },
        ];
        nextCursor = { eventId: event.id, field: 'emotions' };
        out.push(await this.emitQuestion(sessionId, 'emotions', event));
        break;
      }

      case 'emotions': {
        this.ensureThought(draft);
        if (Array.isArray(payload.emotions)) {
          // Подтверждённый выбор (чипы/колесо) — у каждой эмоции своя интенсивность.
          const list = await this.sanitizeEmotions(payload.emotions);
          draft.thoughts[0].emotions = list;
          draft.thoughts[0].intensity = list.length
            ? Math.max(...list.map((e) => e.intensity))
            : 5;
          nextCursor = { eventId: event.id, field: 'reactions' };
          out.push(await this.emitQuestion(sessionId, 'reactions', event));
        } else {
          // Свободный текст → маппим в эмоции с интенсивностью, предлагаем чипы.
          const list = await this.mapEmotions((payload.text || '').trim());
          draft.thoughts[0].emotions = list;
          out.push(await this.emitEmotionChips(sessionId, event, list));
          nextCursor = cursor; // остаёмся на эмоциях до подтверждения
        }
        break;
      }

      case 'reactions': {
        draft.reactions = (payload.text || '').trim();
        await this.prisma.intakeEvent.update({
          where: { id: event.id },
          data: {
            draft: draft as unknown as Prisma.InputJsonValue,
            status: 'drafted',
          },
        });
        out.push(await this.emitCard(sessionId, event, draft));

        const next = await this.nextSelected(sessionId, event.orderIndex);
        if (next) {
          await this.prisma.intakeEvent.update({
            where: { id: next.id },
            data: { status: 'interviewing' },
          });
          nextCursor = { eventId: next.id, field: 'thought' };
          out.push(await this.emitQuestion(sessionId, 'thought', next));
        } else {
          nextCursor = null;
          status = 'review';
          out.push(await this.emitReview(sessionId));
        }
        await this.saveCursor(sessionId, nextCursor, status);
        return { messages: out, cursor: nextCursor, status };
      }
    }

    await this.prisma.intakeEvent.update({
      where: { id: event.id },
      data: { draft: draft as unknown as Prisma.InputJsonValue },
    });
    await this.saveCursor(sessionId, nextCursor, status);
    return { messages: out, cursor: nextCursor, status };
  }

  /** Создать записи в дневнике из выбранных готовых черновиков. */
  async commit(userId: string, sessionId: string, selectedEventIds?: string[]) {
    await this.getSessionOwned(userId, sessionId);
    const drafted = await this.prisma.intakeEvent.findMany({
      where: { sessionId, status: 'drafted' },
      orderBy: { orderIndex: 'asc' },
    });

    let events = drafted;
    if (Array.isArray(selectedEventIds) && selectedEventIds.length) {
      const sel = new Set(selectedEventIds);
      // Невыбранные — в reject (в дневник не уйдут).
      await Promise.all(
        drafted
          .filter((e) => !sel.has(e.id))
          .map((e) =>
            this.prisma.intakeEvent.update({
              where: { id: e.id },
              data: { status: 'rejected' },
            }),
          ),
      );
      events = drafted.filter((e) => sel.has(e.id));
    }

    if (events.length === 0) {
      throw new BadRequestException('Не выбрано ни одной ситуации для сохранения');
    }

    const created: { eventId: string; entryId: string; title: string }[] = [];
    for (const ev of events) {
      const dto = this.draftToCreateDto(ev.draft as any as EventDraft);
      const entry = await this.cbt.createEntry(userId, dto);
      await this.prisma.intakeEvent.update({
        where: { id: ev.id },
        data: { status: 'created', createdEntryId: entry.id },
      });
      created.push({ eventId: ev.id, entryId: entry.id, title: ev.title });
    }

    await this.prisma.intakeSession.update({
      where: { id: sessionId },
      data: { status: 'done' },
    });
    const message = await this.addMessage(
      sessionId,
      'AI',
      'text',
      created.length === 1
        ? 'Готово — запись в дневнике.'
        : `Готово — ${created.length} ${pluralEntries(created.length)} в дневнике.`,
      { created },
    );
    return { created, message };
  }

  private draftToCreateDto(draft: EventDraft): CreateCbtEntryDto {
    const thoughts =
      draft.thoughts && draft.thoughts.length
        ? draft.thoughts
        : [
            {
              thought: '',
              is_automatic: true,
              intensity: 5,
              emotions: [],
              cognitive_distortions: [],
            },
          ];
    return {
      situation: draft.situation || '',
      thoughts: thoughts.map((t) => ({
        thought: t.thought || '',
        is_automatic: t.is_automatic ?? true,
        intensity: t.intensity ?? 5,
        emotions: (t.emotions || []).map((e) => ({
          emotion_id: e.emotion_id,
          intensity: e.intensity ?? 5,
        })),
        cognitive_distortions: t.cognitive_distortions ?? [],
      })),
      reactions: draft.reactions || '',
      tags: draft.tags || [],
      entryDate: draft.entryDate,
      // draft — snake_case; CbtService.createEntry прогоняет thoughts через
      // normalizeThoughts (принимает snake/camel), поэтому каст через unknown
      // намеренный и не зависит от точного регистра полей DTO.
    } as unknown as CreateCbtEntryDto;
  }

  // ===== чтение =====

  async getSession(userId: string, sessionId: string) {
    const session = await this.getSessionOwned(userId, sessionId);
    const [events, messages] = await Promise.all([
      this.prisma.intakeEvent.findMany({
        where: { sessionId },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.intakeMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { session, events, messages };
  }

  async listMessages(userId: string, sessionId: string) {
    await this.getSessionOwned(userId, sessionId);
    return this.prisma.intakeMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ===== ходы бота =====

  private emitQuestion(
    sessionId: string,
    field: Field,
    event: { id: string; title: string },
  ) {
    const eventId = event.id;
    switch (field) {
      case 'thought':
        return this.addMessage(
          sessionId,
          'AI',
          'text',
          `«${event.title}» — что в этот момент промелькнуло в голове?`,
          { field, eventId, title: event.title },
        );
      case 'emotions':
        return this.addMessage(
          sessionId,
          'AI',
          'text',
          'Что ты при этом почувствовал? Опиши словами или выбери на колесе.',
          { field, eventId, allowWheel: true },
        );
      case 'reactions':
        return this.addMessage(
          sessionId,
          'AI',
          'text',
          'И что ты сделал — как поступил или отреагировал?',
          { field, eventId },
        );
    }
  }

  private async emitEmotionChips(
    sessionId: string,
    event: { id: string },
    list: DraftEmotion[],
  ) {
    const cat = await this.ensureCatalog();
    const suggestions = list.map((e) => ({
      emotionId: e.emotion_id,
      name: cat.byId.get(e.emotion_id)?.name || String(e.emotion_id),
      intensity: e.intensity,
    }));
    const content = list.length
      ? 'Похоже на это? Поправь силу или состав — убери лишнее, добавь на колесе.'
      : 'Не уловил эмоцию. Назови словами или выбери на колесе.';
    return this.addMessage(sessionId, 'AI', 'emotion', content, {
      field: 'emotions',
      eventId: event.id,
      suggestions,
      allowWheel: true,
    });
  }

  private emitCard(
    sessionId: string,
    event: { id: string; title: string },
    draft: EventDraft,
  ) {
    return this.addMessage(sessionId, 'AI', 'card', '', {
      eventId: event.id,
      title: event.title,
      draft,
    });
  }

  private emitReview(sessionId: string) {
    return this.addMessage(
      sessionId,
      'AI',
      'buttons',
      'Готово. Сохранить эти записи в дневник?',
      { action: 'commit', cta: 'Сохранить всё' },
    );
  }

  // ===== маппинг эмоций =====

  private async ensureCatalog(): Promise<EmotionCatalog> {
    if (this.catalog) return this.catalog;
    const res = await this.emotions.findAllEmotions({
      language: 'ru',
      limit: 0,
    } as any);
    const list = res.data;
    const lines = list.map((e) => {
      const syn =
        Array.isArray(e.synonyms) && e.synonyms.length
          ? ` (${e.synonyms.slice(0, 6).join(', ')})`
          : '';
      return `${e.id}: ${e.name}${syn}`;
    });
    this.catalog = {
      prompt: lines.join('\n'),
      valid: new Set(list.map((e) => e.id)),
      byId: new Map(
        list.map((e) => [e.id, { name: e.name, categoryId: e.categoryId }]),
      ),
    };
    return this.catalog;
  }

  private async mapEmotions(text: string): Promise<DraftEmotion[]> {
    if (!text) return [];
    const cat = await this.ensureCatalog();
    const raw = await this.ai.generateText(
      [
        { role: 'system', content: buildEmotionMappingPrompt(cat.prompt) },
        { role: 'user', content: text },
      ],
      { responseJson: true, temperature: 0.2, maxTokens: 300 },
    );
    let arr: any[] = [];
    try {
      const d = JSON.parse(raw || '{}');
      arr = Array.isArray(d) ? d : d?.emotions || d?.emotionIds || [];
    } catch (e: any) {
      this.logger.warn(`Маппинг эмоций: не разобрал JSON (${e?.message || e})`);
    }
    const seen = new Set<number>();
    const out: DraftEmotion[] = [];
    for (const item of arr) {
      const id = Number(
        item && typeof item === 'object'
          ? item.id ?? item.emotionId ?? item.emotion_id
          : item,
      );
      const intensity = this.clampIntensity(
        item && typeof item === 'object' ? item.intensity : undefined,
      );
      if (Number.isInteger(id) && cat.valid.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push({ emotion_id: id, intensity });
        if (out.length >= 4) break;
      }
    }
    return out;
  }

  // ===== вспомогательное =====

  private async sanitizeEmotions(
    list: { emotionId: number; intensity: number }[],
  ): Promise<DraftEmotion[]> {
    const cat = await this.ensureCatalog();
    const seen = new Set<number>();
    const out: DraftEmotion[] = [];
    for (const e of list || []) {
      const id = Number(e?.emotionId);
      if (Number.isInteger(id) && cat.valid.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push({ emotion_id: id, intensity: this.clampIntensity(e?.intensity) });
        if (out.length >= 6) break;
      }
    }
    return out;
  }

  private ensureThought(draft: EventDraft) {
    if (!draft.thoughts || draft.thoughts.length === 0) {
      draft.thoughts = [
        {
          thought: '',
          is_automatic: true,
          intensity: 5,
          emotions: [],
          cognitive_distortions: [],
        },
      ];
    }
  }

  private clampIntensity(v: unknown): number {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return 5;
    return Math.min(10, Math.max(1, n));
  }

  private renderUserAnswer(field: Field, payload: AnswerPayload): string | null {
    switch (field) {
      case 'thought':
        return (payload.text || '').trim() || '(без конкретной мысли)';
      case 'emotions':
        // Логируем только свободный текст; подтверждение чипов — без пузыря.
        if (payload.emotions == null && payload.text != null) {
          return (payload.text || '').trim();
        }
        return null;
      case 'reactions':
        return (payload.text || '').trim();
    }
  }

  private async nextSelected(sessionId: string, afterOrderIndex: number) {
    return this.prisma.intakeEvent.findFirst({
      where: {
        sessionId,
        status: 'selected',
        orderIndex: { gt: afterOrderIndex },
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  private async saveCursor(
    sessionId: string,
    cursor: Cursor | null,
    status: string,
  ) {
    await this.prisma.intakeSession.update({
      where: { id: sessionId },
      data: {
        stateData: { cursor } as unknown as Prisma.InputJsonValue,
        status,
      },
    });
  }

  private parseSituations(raw: string): { title: string; quote?: string }[] {
    try {
      const data = JSON.parse(raw || '{}');
      const arr = Array.isArray(data) ? data : data?.situations;
      if (!Array.isArray(arr)) return [];
      return arr
        .map((s: any) => ({
          title: String(s?.title || '').trim(),
          quote: s?.quote ? String(s.quote) : undefined,
        }))
        .filter((s) => s.title.length > 0)
        .slice(0, 8);
    } catch (e: any) {
      this.logger.warn(`Сегментация: не разобрал JSON (${e?.message || e})`);
      return [];
    }
  }
}
