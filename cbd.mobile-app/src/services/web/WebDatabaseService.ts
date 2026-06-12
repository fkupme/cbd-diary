/**
 * Web-реализация локальной БД (online-only).
 *
 * На native (Tauri) источник истины — локальная SQLite (DatabaseService).
 * В браузере её нет, поэтому те же методы ходят напрямую в REST (services/api):
 * чтение/запись дневника идут на cbd.web-api, сервер — источник истины.
 *
 * Контракт IDatabase реализуют обе платформы; DatabaseService.ts выбирает
 * нужную реализацию по isTauriRuntime(). Стора/композаблы менять не нужно —
 * они продолжают звать databaseService.* как раньше.
 */

import { cbtService } from '../api/CBTService';
import { emotionsService } from '../api/EmotionsService';
import { userService } from '../api/UserService';
import type {
	CBTEntry,
	CreateCBTEntryRequest,
	Emotion,
	EmotionCategory,
	UpdateCBTEntryRequest,
} from '../api/types';

/** Профиль, как его принимает локальная БД (snake_case — совместимо с Rust). */
export interface UpdateLocalProfileInput {
	name?: string;
	age?: number;
	gender?: string;
	goals?: string[];
	experience_level?: string;
	meditation_frequency?: string;
	stress_level?: number;
	sleep_quality?: number;
}

/**
 * Контракт «локальной БД» дневника. Реализуется и нативно (SQLite/Tauri),
 * и для web (REST). Sync-методы (применение серверных операций в локальную БД)
 * существуют только в нативной реализации — на web они не нужны (сервер и так
 * источник истины), поэтому помечены опциональными.
 */
export interface IDatabase {
	initialize(): Promise<boolean>;
	createCBTEntry(entry: CreateCBTEntryRequest): Promise<CBTEntry>;
	getCBTEntries(limit?: number): Promise<CBTEntry[]>;
	getCBTEntryById(id: string): Promise<CBTEntry | null>;
	updateCBTEntry(id: string, update: UpdateCBTEntryRequest): Promise<CBTEntry>;
	deleteCBTEntry(id: string): Promise<void>;
	getEmotionCategoriesLocal(): Promise<EmotionCategory[]>;
	getEmotionsLocal(): Promise<Emotion[]>;
	updateUserProfile(input: UpdateLocalProfileInput): Promise<void>;

	// Только нативная локальная БД (применение операций синка). На web отсутствуют.
	upsertCBTEntryFromServer?(
		serverId: string,
		entry: CreateCBTEntryRequest
	): Promise<CBTEntry>;
	updateCBTEntryByServerId?(
		serverId: string,
		update: UpdateCBTEntryRequest
	): Promise<CBTEntry>;
	deleteCBTEntryByServerId?(serverId: string): Promise<void>;
}

export class WebDatabaseService implements IDatabase {
	private static instance: WebDatabaseService;

	// Кэш каталога эмоций на сессию: композабл дёргает категории и эмоции
	// параллельно — не хочется бить по API дважды на каждый вызов.
	private catalogPromise: Promise<{
		categories: EmotionCategory[];
		emotions: Emotion[];
	}> | null = null;

	static getInstance(): WebDatabaseService {
		if (!WebDatabaseService.instance) {
			WebDatabaseService.instance = new WebDatabaseService();
		}
		return WebDatabaseService.instance;
	}

	async initialize(): Promise<boolean> {
		// Нечего инициализировать — данные живут на сервере.
		return true;
	}

	// === CBT ===
	async createCBTEntry(entry: CreateCBTEntryRequest): Promise<CBTEntry> {
		const res = await cbtService.createEntry(entry);
		return res.data;
	}

	async getCBTEntries(limit = 100): Promise<CBTEntry[]> {
		const res = await cbtService.getEntries({
			limit,
			sortBy: 'createdAt',
			sortOrder: 'desc',
		});
		return res.data ?? [];
	}

	async getCBTEntryById(id: string): Promise<CBTEntry | null> {
		try {
			const res = await cbtService.getEntryById(id);
			return res.data ?? null;
		} catch {
			return null;
		}
	}

	async updateCBTEntry(
		id: string,
		update: UpdateCBTEntryRequest
	): Promise<CBTEntry> {
		const res = await cbtService.updateEntry(id, update);
		return res.data;
	}

	async deleteCBTEntry(id: string): Promise<void> {
		await cbtService.deleteEntry(id);
	}

	// === EMOTIONS (на web — с сервера) ===
	private async loadCatalog() {
		if (!this.catalogPromise) {
			this.catalogPromise = emotionsService
				.getFullEmotionsStructure()
				.catch(error => {
					// Не кэшируем неудачу — дадим повторить на следующем вызове
					this.catalogPromise = null;
					throw error;
				});
		}
		return this.catalogPromise;
	}

	async getEmotionCategoriesLocal(): Promise<EmotionCategory[]> {
		const { categories } = await this.loadCatalog();
		return categories;
	}

	async getEmotionsLocal(): Promise<Emotion[]> {
		const { emotions } = await this.loadCatalog();
		return emotions;
	}

	// === USER PROFILE ===
	async updateUserProfile(input: UpdateLocalProfileInput): Promise<void> {
		// Маппим snake_case (форма локальной БД) в camelCase REST-контракт.
		await userService.updateCurrentUser({
			name: input.name,
			age: input.age,
			gender: input.gender,
			goals: input.goals,
			experienceLevel: input.experience_level,
			meditationFrequency: input.meditation_frequency,
			stressLevel: input.stress_level,
			sleepQuality: input.sleep_quality,
		});
	}
}

export const webDatabaseService = WebDatabaseService.getInstance();
