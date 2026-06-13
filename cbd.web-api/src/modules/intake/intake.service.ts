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
export type Field = 'thought' | 'emotions' | 'intensity' | 'reactions';

export interface Cursor {
  eventId: string;
  field: Field;
}

interface AnswerPayload {
  text?: string;
  emotionIds?: number[];
  intensity?: number;
  skip?: boolean;
}

// Эмоция в черновике — канонический camelCase ({emotionId,intensity}),
// как в cbt_entries.thoughts и CreateCbtEntryDto.
export interface DraftEmotion {
  emotionId: number;
  intensity: number;
}

// Мысль в черновике — форма ThoughtChainDto из cbt-entry.dto.ts.
export interface DraftThought {
  thought: string;
  isAutomatic?: boolean;
  intensity?: number;
  emotions: DraftEmotion[];
  cognitiveDistortions?: { type: string; note?: string }[];
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
      // Модель ничего не выделила — трактуем весь транскрипт как одну ситуацию.
      situations.push({ title: transcript.slice(0, 80) });
    }

    // Идемпотентность повторной сегментации.
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

    // Стартуем интервью с первой выбранной ситуации.
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

    // 1) сохраняем ход пользователя (человекочитаемо) для перезагрузки ленты.
    const userText = await this.renderUserAnswer(cursor.field, payload);
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
            isAutomatic: true,
            intensity: 5,
            emotions: [],
            cognitiveDistortions: [],
          },
        ];
        nextCursor = { eventId: event.id, field: 'emotions' };
        out.push(await this.emitQuestion(sessionId, 'emotions', event));
        break;
      }

      case 'emotions': {
        this.ensureThought(draft);
        if (Array.isArray(payload.emotionIds)) {
          // Подтверждённый выбор чипов/колеса.
          const ids = await this.sanitizeIds(payload.emotionIds);
          const intensity = draft.thoughts[0].intensity || 5;
          draft.thoughts[0].emotions = ids.map((id) => ({
            emotionId: id,
            intensity,
          }));
          if (ids.length === 0) {
            // Нет эмоций — интенсивность спрашивать не о чем.
            nextCursor = { eventId: event.id, field: 'reactions' };
            out.push(await this.emitQuestion(sessionId, 'reactions', event));
          } else {
            nextCursor = { eventId: event.id, field: 'intensity' };
            out.push(await this.emitQuestion(sessionId, 'intensity', event));
          }
        } else {
          // Свободный текст — маппим в id и предлагаем чипы (остаёмся на поле).
          const ids = await this.mapEmotions((payload.text || '').trim());
          draft.thoughts[0].emotions = ids.map((id) => ({
            emotionId: id,
            intensity: 5,
          }));
          out.push(await this.emitEmotionChips(sessionId, event, ids));
          nextCursor = cursor;
        }
        break;
      }

      case 'intensity': {
        this.ensureThought(draft);
        const n = this.clampIntensity(payload.intensity);
        draft.thoughts[0].intensity = n;
        draft.thoughts[0].emotions = (draft.thoughts[0].emotions || []).map(
          (e) => ({ ...e, intensity: n }),
        );
        nextCursor = { eventId: event.id, field: 'reactions' };
        out.push(await this.emitQuestion(sessionId, 'reactions', event));
        break;
      }

      case 'reactions': {
        draft.reactions = payload.skip ? '' : (payload.text || '').trim();
        // Событие готово: фиксируем черновик и показываем компакт-карточку.
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

    // Сохраняем черновик (для не-финализирующих полей) и курсор.
    await this.prisma.intakeEvent.update({
      where: { id: event.id },
      data: { draft: draft as unknown as Prisma.InputJsonValue },
    });
    await this.saveCursor(sessionId, nextCursor, status);
    return { messages: out, cursor: nextCursor, status };
  }

  /** Создать записи в дневнике из всех готовых черновиков. */
  async commit(userId: string, sessionId: string) {
    await this.getSessionOwned(userId, sessionId);
    const events = await this.prisma.intakeEvent.findMany({
      where: { sessionId, status: 'drafted' },
      orderBy: { orderIndex: 'asc' },
    });
    if (events.length === 0) {
      throw new BadRequestException('Нет готовых ситуаций для сохранения');
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
              isAutomatic: true,
              intensity: 5,
              emotions: [],
              cognitiveDistortions: [],
            },
          ];
    return {
      situation: draft.situation || '',
      thoughts: thoughts.map((t) => ({
        thought: t.thought || '',
        isAutomatic: t.isAutomatic ?? true,
        intensity: t.intensity ?? 5,
        emotions: (t.emotions || []).map((e) => ({
          emotionId: e.emotionId,
          intensity: e.intensity ?? 5,
        })),
        cognitiveDistortions: t.cognitiveDistortions ?? [],
      })),
      reactions: draft.reactions || '',
      tags: draft.tags || [],
      entryDate: draft.entryDate,
    } as CreateCbtEntryDto;
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

  private emitQuestion(sessionId: string, field: Field, event: { id: string; title: string }) {
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
          'Что ты при этом почувствовал?',
          { field, eventId, allowWheel: true },
        );
      case 'intensity':
        return this.addMessage(
          sessionId,
          'AI',
          'intensity',
          'Насколько сильно это ощущалось?',
          { field, eventId, min: 1, max: 10 },
        );
      case 'reactions':
        return this.addMessage(
          sessionId,
          'AI',
          'text',
          'И что ты сделал — как поступил или отреагировал?',
          { field, eventId, skippable: true },
        );
    }
  }

  private async emitEmotionChips(
    sessionId: string,
    event: { id: string },
    ids: number[],
  ) {
    const cat = await this.ensureCatalog();
    const suggestions = ids.map((id) => ({
      emotionId: id,
      name: cat.byId.get(id)?.name || String(id),
    }));
    const content = ids.length
      ? 'Похоже на это? Поправь, если не так — убери лишнее или добавь своё.'
      : 'Не уловил конкретную эмоцию. Назови словами или выбери на колесе.';
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

  private async mapEmotions(text: string): Promise<number[]> {
    if (!text) return [];
    const cat = await this.ensureCatalog();
    const raw = await this.ai.generateText(
      [
        { role: 'system', content: buildEmotionMappingPrompt(cat.prompt) },
        { role: 'user', content: text },
      ],
      { responseJson: true, temperature: 0.2, maxTokens: 256 },
    );
    let ids: number[] = [];
    try {
      const d = JSON.parse(raw || '{}');
      const arr = Array.isArray(d) ? d : d?.emotionIds;
      if (Array.isArray(arr)) ids = arr.map(Number);
    } catch (e: any) {
      this.logger.warn(`Маппинг эмоций: не разобрал JSON (${e?.message || e})`);
    }
    return this.dedupeValid(ids, cat, 4);
  }

  // ===== вспомогательное =====

  private dedupeValid(ids: number[], cat: EmotionCatalog, cap: number): number[] {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const v of ids || []) {
      const n = Number(v);
      if (Number.isInteger(n) && cat.valid.has(n) && !seen.has(n)) {
        seen.add(n);
        out.push(n);
        if (out.length >= cap) break;
      }
    }
    return out;
  }

  private async sanitizeIds(ids: number[]): Promise<number[]> {
    const cat = await this.ensureCatalog();
    return this.dedupeValid(ids || [], cat, 6);
  }

  private ensureThought(draft: EventDraft) {
    if (!draft.thoughts || draft.thoughts.length === 0) {
      draft.thoughts = [
        {
          thought: '',
          isAutomatic: true,
          intensity: 5,
          emotions: [],
          cognitiveDistortions: [],
        },
      ];
    }
  }

  private clampIntensity(v: unknown): number {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return 5;
    return Math.min(10, Math.max(1, n));
  }

  private async renderUserAnswer(
    field: Field,
    payload: AnswerPayload,
  ): Promise<string | null> {
    switch (field) {
      case 'thought':
        return (payload.text || '').trim() || '(без конкретной мысли)';
      case 'emotions':
        // Логируем только свободный текст; подтверждение чипов — без отдельного пузыря.
        if (payload.emotionIds == null && payload.text != null) {
          return (payload.text || '').trim();
        }
        return null;
      case 'intensity':
        return null; // выбор кнопкой — без пузыря, итог виден на карточке
      case 'reactions':
        return payload.skip
          ? '(пропустил)'
          : (payload.text || '').trim() || '(пропустил)';
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
