import {
	BiometricService,
	DatabaseService,
	HttpService,
	NotificationService,
	SecureStorageService,
} from './index';
import type { MoodEntry } from './types';

export class ServiceManager {
	private static instance: ServiceManager;
	private isInitialized = false;
	private currentUserId: string | null = null;

	// Сервисы
	public notification: NotificationService;
	public database: DatabaseService;
	public biometric: BiometricService;
	public storage: SecureStorageService;
	public http: HttpService;

	private constructor() {
		this.notification = NotificationService.getInstance();
		this.database = DatabaseService.getInstance();
		this.biometric = BiometricService.getInstance();
		this.storage = SecureStorageService.getInstance();
		this.http = HttpService.getInstance();
	}

	static getInstance(): ServiceManager {
		if (!ServiceManager.instance) {
			ServiceManager.instance = new ServiceManager();
		}
		return ServiceManager.instance;
	}

	// === ИНИЦИАЛИЗАЦИЯ ===

	async initialize(
		userId?: string,
		apiUrl?: string
	): Promise<{
		success: boolean;
		initializedServices: string[];
		errors: string[];
	}> {
		if (this.isInitialized) {
			return {
				success: true,
				initializedServices: ['All services already initialized'],
				errors: [],
			};
		}

		const results: { [key: string]: boolean } = {};
		const errors: string[] = [];

		console.log('🚀 Инициализация CBD Diary Services...');

		// Инициализируем каждый сервис
		try {
			results.database = await this.database.initialize();
			if (!results.database)
				errors.push('DatabaseService не удалось инициализировать');
		} catch (error) {
			results.database = false;
			errors.push(`DatabaseService: ${error}`);
		}

		try {
			results.storage = await this.storage.initialize();
			if (!results.storage)
				errors.push('SecureStorageService не удалось инициализировать');
		} catch (error) {
			results.storage = false;
			errors.push(`SecureStorageService: ${error}`);
		}

		try {
			results.notification = await this.notification.initialize();
			if (!results.notification)
				errors.push('NotificationService не удалось инициализировать');
		} catch (error) {
			results.notification = false;
			errors.push(`NotificationService: ${error}`);
		}

		try {
			results.biometric = await this.biometric.initialize();
			if (!results.biometric)
				errors.push('BiometricService не удалось инициализировать');
		} catch (error) {
			results.biometric = false;
			errors.push(`BiometricService: ${error}`);
		}

		try {
			results.http = await this.http.initialize(apiUrl);
			if (!results.http) errors.push('HttpService не удалось инициализировать');
		} catch (error) {
			results.http = false;
			errors.push(`HttpService: ${error}`);
		}

		// Устанавливаем пользователя
		if (userId) {
			this.currentUserId = userId;
		}

		const initializedServices = Object.entries(results)
			.filter(([_, success]) => success)
			.map(([service, _]) => service);

		this.isInitialized = initializedServices.length > 0;

		console.log(
			`✅ Инициализированы сервисы: ${initializedServices.join(', ')}`
		);
		if (errors.length > 0) {
			console.warn('⚠️ Ошибки инициализации:', errors);
		}

		return {
			success: this.isInitialized,
			initializedServices,
			errors,
		};
	}

	// === ОСНОВНЫЕ МЕТОДЫ ===

	async saveMoodEntry(entry: Omit<MoodEntry, 'id' | 'userId'>): Promise<{
		success: boolean;
		id?: number;
		synced?: boolean;
	}> {
		try {
			if (!this.currentUserId) {
				throw new Error('Пользователь не установлен');
			}

			const moodEntry = {
				...entry,
				userId: this.currentUserId,
			};

			// Сохраняем локально
			const id = await this.database.saveMoodEntry(moodEntry);
			if (!id) {
				throw new Error('Не удалось сохранить в базу данных');
			}

			// Отправляем уведомление
			await this.notification.notifyEntryComplete();

			return { success: true, id };
		} catch (error) {
			console.error('❌ Ошибка сохранения записи:', error);
			return { success: false };
		}
	}

	setCurrentUser(userId: string): void {
		this.currentUserId = userId;
		console.log('👤 Текущий пользователь установлен:', userId);
	}

	getCurrentUserId(): string | null {
		return this.currentUserId;
	}
}
