/**
 * Stores Index
 * Экспорт всех Pinia stores
 */

import { createPinia } from 'pinia';

// Экспортируем функцию создания Pinia
export const pinia = createPinia();

// Экспортируем stores
export { useAnalyticsStore } from './analytics';
export { useCBTStore } from './cbt';
export { useEmotionsStore } from './emotions';
export { useI18nStore } from './i18n';
export { useUserStore } from './user';

// Экспортируем типы stores
export type { AnalyticsStore } from './analytics';
export type { CBTStore } from './cbt';
export type { EmotionsStore } from './emotions';
export type { UserStore } from './user';

// Утилиты для stores
export const storeUtils = {
	/**
	 * Инициализирует все stores
	 */
	async initializeAll() {
		const { useUserStore } = await import('./user');
		const { useEmotionsStore } = await import('./emotions');
		const { useCBTStore } = await import('./cbt');
		const { useAnalyticsStore } = await import('./analytics');

		try {
			console.log('🚀 Инициализация stores...');

			// Инициализируем в правильном порядке
			const userStore = useUserStore();
			const emotionsStore = useEmotionsStore();
			const cbtStore = useCBTStore();
			const analyticsStore = useAnalyticsStore();

			// Сначала инициализируем пользователя и API сервисы
			await userStore.initialize();

			// Затем эмоции (нужны для CBT)
			await emotionsStore.initialize();

			// Затем CBT записи
			await cbtStore.initialize();

			// И наконец аналитику
			await analyticsStore.initialize();

			console.log('✅ Все stores инициализированы');

			return {
				userStore,
				emotionsStore,
				cbtStore,
				analyticsStore,
			};
		} catch (err) {
			console.error('❌ Ошибка инициализации stores:', err);
			throw err;
		}
	},

	/**
	 * Очищает все stores и кэши
	 */
	async clearAll() {
		try {
			const { useUserStore } = await import('./user');
			const { useEmotionsStore } = await import('./emotions');
			const { useCBTStore } = await import('./cbt');
			const { useAnalyticsStore } = await import('./analytics');

			const userStore = useUserStore();
			const emotionsStore = useEmotionsStore();
			const cbtStore = useCBTStore();
			const analyticsStore = useAnalyticsStore();

			// Очищаем все кэши
			emotionsStore.clearCache();
			cbtStore.clearCache();
			analyticsStore.clearCache();

			// Выходим из аккаунта
			if (userStore.isAuthenticated) {
				await userStore.logout();
			}

			console.log('✅ Все stores очищены');
		} catch (err) {
			console.error('❌ Ошибка очистки stores:', err);
		}
	},

	/**
	 * Проверяет здоровье всех stores
	 */
	async healthCheck() {
		try {
			const { useUserStore } = await import('./user');
			const { useEmotionsStore } = await import('./emotions');
			const { useCBTStore } = await import('./cbt');
			const { useAnalyticsStore } = await import('./analytics');

			const userStore = useUserStore();
			const emotionsStore = useEmotionsStore();
			const cbtStore = useCBTStore();
			const analyticsStore = useAnalyticsStore();

			return {
				user: {
					authenticated: userStore.isAuthenticated,
					hasProfile: userStore.isProfileComplete,
					hasError: !!userStore.error,
				},
				emotions: {
					loaded: emotionsStore.emotions.length > 0,
					categories: emotionsStore.emotionCategories.length,
					hasError: !!emotionsStore.error,
				},
				cbt: {
					loaded: cbtStore.entries.length > 0,
					totalEntries: cbtStore.totalEntries,
					hasError: !!cbtStore.error,
				},
				analytics: {
					loaded: !!analyticsStore.userStats,
					hasError: !!analyticsStore.error,
				},
				overall:
					!userStore.error &&
					!emotionsStore.error &&
					!cbtStore.error &&
					!analyticsStore.error,
			};
		} catch (err) {
			console.error('❌ Ошибка проверки здоровья stores:', err);
			return {
				user: { authenticated: false, hasProfile: false, hasError: true },
				emotions: { loaded: false, categories: 0, hasError: true },
				cbt: { loaded: false, totalEntries: 0, hasError: true },
				analytics: { loaded: false, hasError: true },
				overall: false,
			};
		}
	},

	/**
	 * Получает сводку по всем данным
	 */
	async getDataSummary() {
		try {
			const { useUserStore } = await import('./user');
			const { useEmotionsStore } = await import('./emotions');
			const { useCBTStore } = await import('./cbt');
			const { useAnalyticsStore } = await import('./analytics');

			const userStore = useUserStore();
			const emotionsStore = useEmotionsStore();
			const cbtStore = useCBTStore();
			const analyticsStore = useAnalyticsStore();

			return {
				user: {
					email: userStore.user?.email,
					username: userStore.user?.username,
					preferences: userStore.preferences,
				},
				data: {
					emotions: emotionsStore.emotions.length,
					categories: emotionsStore.emotionCategories.length,
					entries: cbtStore.totalEntries,
					averageMood: cbtStore.averageMoodBefore,
					weeklyProgress: analyticsStore.weeklyAnalytics.totalEntries,
				},
				cache: {
					emotionsLastLoad: emotionsStore.lastLoadTime,
					cbtLastLoad: cbtStore.lastLoadTime,
					analyticsLastUpdate: analyticsStore.lastUpdateTime,
				},
			};
		} catch (err) {
			console.error('❌ Ошибка получения сводки данных:', err);
			return null;
		}
	},
};
