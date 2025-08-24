/**
 * API Services
 * Экспорт всех API сервисов и клиентов
 */

// API Client
export { ApiClient, apiClient } from './client';

// Configuration
export { API_CONFIG, getCurrentBaseURL } from './config';
export type { ApiEndpoint, ApiEnvironment, ApiMethod } from './config';

// Services
export { AnalyticsService, analyticsService } from './AnalyticsService';
export { AuthService, authService } from './AuthService';
export { CBTService, cbtService } from './CBTService';
export { ChatService, chatService } from './ChatService';
export { EmotionsService, emotionsService } from './EmotionsService';
export { SyncService, syncService } from './SyncService';
export { UserService, userService } from './UserService';

// Types
export type * from './types';

/**
 * API Services Manager
 * Централизованный менеджер для всех API сервисов
 */
export class ApiServicesManager {
	private static instance: ApiServicesManager;

	static getInstance(): ApiServicesManager {
		if (!ApiServicesManager.instance) {
			ApiServicesManager.instance = new ApiServicesManager();
		}
		return ApiServicesManager.instance;
	}

	/**
	 * Инициализация всех API сервисов
	 */
	async initialize(): Promise<void> {
		try {
			console.log('🚀 Инициализация API сервисов...');

			// API клиент инициализируется автоматически
			// Все сервисы используют singleton pattern

			console.log('✅ API сервисы инициализированы');
		} catch (error) {
			console.error('❌ Ошибка инициализации API сервисов:', error);
			throw error;
		}
	}

	/**
	 * Проверить состояние всех сервисов
	 */
	async healthCheck(): Promise<{
		api: boolean;
		auth: boolean;
		sync: boolean;
		overall: boolean;
	}> {
		try {
			console.log('🏥 Проверка состояния API сервисов...');

			const [apiHealth, authValid, syncHealth] = await Promise.allSettled([
				apiClient.health(),
				authService.validateSession(),
				syncService.getSyncHealth(),
			]);

			const api = apiHealth.status === 'fulfilled' ? apiHealth.value : false;
			const auth = authValid.status === 'fulfilled' ? authValid.value : false;
			const sync =
				syncHealth.status === 'fulfilled' ? syncHealth.value.success : false;

			const overall = api && (auth || !authService.isAuthenticated());

			const status = { api, auth, sync, overall };

			console.log('✅ Проверка состояния завершена:', status);
			return status;
		} catch (error) {
			console.error('❌ Ошибка проверки состояния:', error);
			return { api: false, auth: false, sync: false, overall: false };
		}
	}

	/**
	 * Очистить все данные (выход из системы)
	 */
	async clearAll(): Promise<void> {
		try {
			console.log('🧹 Очистка всех API данных...');

			await Promise.all([authService.logout(), syncService.clearSyncQueue()]);

			console.log('✅ Все API данные очищены');
		} catch (error) {
			console.error('❌ Ошибка очистки данных:', error);
		}
	}

	/**
	 * Получить информацию о всех сервисах
	 */
	getServicesInfo(): {
		client: string;
		services: string[];
		authenticated: boolean;
		syncInProgress: boolean;
	} {
		return {
			client: 'ApiClient v1.0',
			services: [
				'AuthService',
				'UserService',
				'EmotionsService',
				'CBTService',
				'AnalyticsService',
				'SyncService',
				'ChatService',
			],
			authenticated: authService.isAuthenticated(),
			syncInProgress: syncService.isSyncInProgress(),
		};
	}
}

// Экспортируем singleton экземпляр менеджера
export const apiServicesManager = ApiServicesManager.getInstance();
