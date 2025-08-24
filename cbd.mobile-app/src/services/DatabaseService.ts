import type {
	Emotion as ApiEmotion,
	EmotionCategory as ApiEmotionCategory,
	CBTEntry,
	CreateCBTEntryRequest,
	UpdateCBTEntryRequest,
} from './api/types';

// Ленивая загрузка invoke из Tauri API (совместимо с web фолбэком)
async function getInvoke<T = any>() {
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke as <R = T>(
			cmd: string,
			args?: Record<string, unknown>
		) => Promise<R>;
	} catch {
		throw new Error('Tauri API недоступен в этом окружении');
	}
}

// Типы, соответствующие Rust моделям (минимально нужные поля)
interface TauriCBTEntry {
	id: string;
	user_id: string;
	entry_date: string;
	situation: string;
	thoughts: string; // JSON
	reactions: string;
	mood_score_before: number | null;
	mood_score_after: number | null;
	tags: string; // JSON
	created_at: string;
	updated_at: string;
	chat_id?: string | null;
}

interface TauriEmotionCategory {
	id: number;
	name_key: string;
	color: string;
	icon?: string | null;
	sort_order: number;
	is_active: boolean;
	created_at: string;
}

interface TauriEmotion {
	id: number;
	category_id: number;
	name_key: string;
	emoji: string;
	intensity_default: number;
	synonyms: string; // JSON
	opposite_emotion_id?: number | null;
	sort_order: number;
	is_active: boolean;
	created_at: string;
}

interface TauriThoughtChainInput {
	thought: string;
	is_automatic?: boolean;
	intensity?: number;
	emotions: Array<{
		emotion_id: number;
		intensity: number;
		duration_minutes?: number | null;
	}>;
	cognitive_distortions?: string[];
}

interface TauriCreateCBTEntryInput {
	entry_date?: string; // ISO
	situation: string;
	thoughts: TauriThoughtChainInput[];
	reactions: string;
	mood_score_before?: number | null;
	mood_score_after?: number | null;
	tags?: string[];
}

interface TauriUpdateCBTEntryInput {
	situation?: string;
	thoughts?: TauriThoughtChainInput[];
	reactions?: string;
	mood_score_before?: number | null;
	mood_score_after?: number | null;
	tags?: string[];
}

function mapTauriEntryToApi(e: TauriCBTEntry): CBTEntry {
	let thoughts: any[] = [];
	try {
		thoughts = JSON.parse(e.thoughts || '[]');
	} catch {}
	let tags: string[] = [];
	try {
		tags = JSON.parse(e.tags || '[]');
	} catch {}

	return {
		id: e.id,
		userId: e.user_id,
		situation: e.situation,
		thoughts: thoughts,
		reactions: e.reactions,
		moodScoreBefore: (e.mood_score_before ?? 0) as number,
		moodScoreAfter: e.mood_score_after ?? undefined,
		tags,
		isPublic: false,
		chatId: e.chat_id ?? undefined,
		createdAt: e.created_at,
		updatedAt: e.updated_at,
	};
}

function mapCreateReqToTauri(
	input: CreateCBTEntryRequest
): TauriCreateCBTEntryInput {
	return {
		entry_date: (input as any).entry_date || (input as any).entryDate,
		situation: input.situation,
		thoughts: input.thoughts.map(t => ({
			thought: t.thought,
			is_automatic: t.isAutomatic ?? false,
			intensity: t.intensity,
			emotions: t.emotions.map(e => ({
				emotion_id: (e as any).emotionId ?? (e as any).emotion_id,
				intensity: e.intensity,
			})),
			cognitive_distortions: (t.cognitiveDistortions as any) || [],
		})),
		reactions: input.reactions,
		mood_score_before: input.moodScoreBefore,
		tags: input.tags || [],
	};
}

function mapUpdateReqToTauri(
	input: UpdateCBTEntryRequest
): TauriUpdateCBTEntryInput {
	const out: TauriUpdateCBTEntryInput = {};
	if (input.situation !== undefined) out.situation = input.situation;
	if (input.reactions !== undefined) out.reactions = input.reactions;
	if (input.moodScoreBefore !== undefined)
		out.mood_score_before = input.moodScoreBefore;
	if (input.moodScoreAfter !== undefined)
		out.mood_score_after = input.moodScoreAfter;
	if (input.tags !== undefined) out.tags = input.tags;
	// Мысли апдейтим только если пришли
	if ((input as any).thoughts) {
		out.thoughts = ((input as any).thoughts as any[]).map(t => ({
			thought: t.thought,
			is_automatic: t.isAutomatic ?? false,
			intensity: t.intensity,
			emotions: t.emotions.map((e: any) => ({
				emotion_id: (e as any).emotionId ?? e.emotion_id,
				intensity: e.intensity,
			})),
			cognitive_distortions: t.cognitiveDistortions || [],
		}));
	}
	return out;
}

function mapTauriCategoryToApi(c: TauriEmotionCategory): ApiEmotionCategory {
	return {
		id: c.id,
		name: c.name_key, // UI заменит через t(name_key)
		name_key: c.name_key,
		color: c.color,
		emoji: c.icon ?? undefined,
		sortOrder: c.sort_order,
		createdAt: c.created_at,
		updatedAt: c.created_at,
	};
}

function mapTauriEmotionToApi(e: TauriEmotion): ApiEmotion {
	return {
		id: e.id,
		categoryId: e.category_id,
		name: e.name_key, // UI заменит через t(name_key)
		name_key: e.name_key,
		intensity: e.intensity_default,
		emoji: e.emoji,
		color: undefined,
		sortOrder: e.sort_order,
		createdAt: e.created_at,
		updatedAt: e.created_at,
		category: undefined,
	};
}

export class DatabaseService {
	private static instance: DatabaseService;

	static getInstance(): DatabaseService {
		if (!DatabaseService.instance) {
			DatabaseService.instance = new DatabaseService();
		}
		return DatabaseService.instance;
	}

	async initialize(): Promise<boolean> {
		// Ничего особого не делаем — БД инициализируется на стороне Rust
		return true;
	}

	private async ensureLocalUser(): Promise<void> {
		const invoke = await getInvoke();
		try {
			const current = await invoke<any>('get_current_user');
			if (!current) {
				await invoke('create_test_user');
			}
		} catch {
			// На крайний случай создаём тестового
			await invoke('create_test_user');
		}
	}

	// === CBT ===
	async createCBTEntry(entry: CreateCBTEntryRequest): Promise<CBTEntry> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		const tauriInput = mapCreateReqToTauri(entry);
		const created = await invoke<TauriCBTEntry>('create_cbt_entry', {
			input: tauriInput,
		});
		return mapTauriEntryToApi(created);
	}

	async getCBTEntries(limit = 100): Promise<CBTEntry[]> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		const list = await invoke<TauriCBTEntry[]>('get_cbt_entries', { limit });
		return list.map(mapTauriEntryToApi);
	}

	async getCBTEntryById(id: string): Promise<CBTEntry | null> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		const e = await invoke<TauriCBTEntry | null>('get_cbt_entry_by_id', {
			entryId: id,
		});
		return e ? mapTauriEntryToApi(e) : null;
	}

	async updateCBTEntry(
		id: string,
		update: UpdateCBTEntryRequest
	): Promise<CBTEntry> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		const payload = mapUpdateReqToTauri(update);
		const updated = await invoke<TauriCBTEntry>('update_cbt_entry', {
			entryId: id,
			input: payload,
		});
		return mapTauriEntryToApi(updated);
	}

	async deleteCBTEntry(id: string): Promise<void> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		await invoke<void>('delete_cbt_entry', { entryId: id });
	}

	async upsertCBTEntryFromServer(
		serverId: string,
		entry: CreateCBTEntryRequest
	): Promise<CBTEntry> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		const tauriInput = mapCreateReqToTauri(entry);
		const created = await invoke<TauriCBTEntry>(
			'upsert_cbt_entry_from_server',
			{
				serverId,
				input: tauriInput,
			}
		);
		return mapTauriEntryToApi(created);
	}

	async updateCBTEntryByServerId(
		serverId: string,
		update: UpdateCBTEntryRequest
	): Promise<CBTEntry> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		const payload = mapUpdateReqToTauri(update);
		const updated = await invoke<TauriCBTEntry>(
			'update_cbt_entry_by_server_id',
			{
				serverId,
				input: payload,
			}
		);
		return mapTauriEntryToApi(updated);
	}

	async deleteCBTEntryByServerId(serverId: string): Promise<void> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		await invoke<void>('delete_cbt_entry_by_server_id', { serverId });
	}

	// === EMOTIONS (локально) ===
	async getEmotionCategoriesLocal(): Promise<ApiEmotionCategory[]> {
		const invoke = await getInvoke();
		const list = await invoke<TauriEmotionCategory[]>('get_emotion_categories');
		return list.map(mapTauriCategoryToApi);
	}

	async getEmotionsLocal(): Promise<ApiEmotion[]> {
		const invoke = await getInvoke();
		const list = await invoke<TauriEmotion[]>('get_emotions');
		return list.map(mapTauriEmotionToApi);
	}

	// === USER PROFILE (локально)
	async updateUserProfile(input: {
		name?: string;
		age?: number;
		gender?: string;
		goals?: string[];
		experience_level?: string;
		meditation_frequency?: string;
		stress_level?: number;
		sleep_quality?: number;
	}): Promise<void> {
		const invoke = await getInvoke();
		await this.ensureLocalUser();
		await invoke('update_user_profile', {
			input: {
				name: input.name,
				age: input.age,
				gender: input.gender,
				goals: input.goals,
				experience_level: input.experience_level,
				meditation_frequency: input.meditation_frequency,
				stress_level: input.stress_level,
				sleep_quality: input.sleep_quality,
			},
		});
	}
}

export const databaseService = DatabaseService.getInstance();
