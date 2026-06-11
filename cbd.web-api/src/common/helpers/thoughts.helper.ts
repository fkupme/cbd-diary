/**
 * Канонический формат JSON-поля cbt_entries.thoughts.
 *
 * Исторически в колонке накопилось три диалекта:
 *  - прямой API: snake_case (emotion_id, is_automatic, cognitive_distortions: [{type, note}])
 *  - sync: camelCase (emotionId, isAutomatic, cognitiveDistortions)
 *  - мобильный локальный: cognitive_distortions как массив строк
 *
 * normalizeThoughts() принимает любой из них и приводит к каноническому
 * camelCase-виду. Вызывается во всех точках записи (cbt, sync) и при чтении
 * в аналитике — чтобы старые немигрированные строки тоже читались корректно.
 */

export interface CanonicalEmotionRef {
  emotionId: number;
  intensity: number;
  durationMinutes?: number;
}

export interface CanonicalDistortion {
  type: string;
  note?: string;
}

export interface CanonicalThought {
  id?: string;
  thought: string;
  isAutomatic: boolean;
  intensity: number;
  emotions: CanonicalEmotionRef[];
  cognitiveDistortions: CanonicalDistortion[];
}

function toIntInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeEmotionRef(raw: any): CanonicalEmotionRef | null {
  const emotionId = Number(raw?.emotionId ?? raw?.emotion_id ?? raw?.id);
  if (!Number.isInteger(emotionId) || emotionId <= 0) return null;
  const ref: CanonicalEmotionRef = {
    emotionId,
    intensity: toIntInRange(raw?.intensity, 5, 1, 10),
  };
  const duration = Number(raw?.durationMinutes ?? raw?.duration_minutes);
  if (Number.isInteger(duration) && duration >= 0) {
    ref.durationMinutes = duration;
  }
  return ref;
}

function normalizeDistortion(raw: any): CanonicalDistortion | null {
  if (typeof raw === 'string') {
    const type = raw.trim();
    return type ? { type } : null;
  }
  const type = String(raw?.type ?? '').trim();
  if (!type) return null;
  const distortion: CanonicalDistortion = { type };
  const note = raw?.note;
  if (typeof note === 'string' && note.trim()) {
    distortion.note = note;
  }
  return distortion;
}

export function normalizeThoughts(input: unknown): CanonicalThought[] {
  if (!Array.isArray(input)) return [];
  const result: CanonicalThought[] = [];
  for (const raw of input as any[]) {
    const text = String(raw?.thought ?? '').trim();
    if (!text) continue;
    const thought: CanonicalThought = {
      thought: text,
      isAutomatic: Boolean(raw?.isAutomatic ?? raw?.is_automatic ?? false),
      intensity: toIntInRange(raw?.intensity, 5, 1, 10),
      emotions: Array.isArray(raw?.emotions)
        ? raw.emotions
            .map(normalizeEmotionRef)
            .filter((e: CanonicalEmotionRef | null): e is CanonicalEmotionRef =>
              Boolean(e),
            )
        : [],
      cognitiveDistortions: Array.isArray(
        raw?.cognitiveDistortions ?? raw?.cognitive_distortions,
      )
        ? (raw?.cognitiveDistortions ?? raw?.cognitive_distortions)
            .map(normalizeDistortion)
            .filter((d: CanonicalDistortion | null): d is CanonicalDistortion =>
              Boolean(d),
            )
        : [],
    };
    const id = raw?.id;
    if (typeof id === 'string' && id) {
      thought.id = id;
    }
    result.push(thought);
  }
  return result;
}
