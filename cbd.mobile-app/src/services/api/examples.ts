/**
 * API Services Usage Examples
 * Примеры использования API сервисов
 */

import {
	analyticsService,
	apiServicesManager,
	authService,
	cbtService,
	emotionsService,
	syncService,
	userService,
	type CreateCBTEntryRequest,
	type LoginRequest,
} from './index';

/**
 * Пример: Полный цикл авторизации
 */
export async function exampleAuthFlow() {
	try {
		// 1. Авторизация
		const loginData: LoginRequest = {
			email: 'user@example.com',
			password: 'password123',
		};

		const authResult = await authService.login(loginData);
		if (!authResult.success) {
			throw new Error('Авторизация не удалась');
		}

		console.log('Пользователь авторизован:', authResult.data.user);

		// 2. Получить профиль пользователя
		const userProfile = await userService.getCurrentUser();
		if (userProfile.success) {
			console.log('Профиль пользователя:', userProfile.data);
		}

		// 3. Проверить статус сессии
		const sessionValid = await authService.validateSession();
		console.log('Сессия валидна:', sessionValid);
	} catch (error) {
		console.error('Ошибка в процессе авторизации:', error);
	}
}

/**
 * Пример: Работа с эмоциями
 */
export async function exampleEmotionsFlow() {
	try {
		// 1. Загрузить структуру эмоций
		const emotionsStructure = await emotionsService.getFullEmotionsStructure();
		console.log('Структура эмоций:', emotionsStructure);

		// 2. Найти конкретную эмоцию
		const searchResult = await emotionsService.searchEmotions('радость');
		if (searchResult.success) {
			console.log('Найденные эмоции:', searchResult.data);
		}

		// 3. Получить эмоции по категории
		const categoryEmotions = await emotionsService.getEmotionsByCategory(1);
		if (categoryEmotions.success) {
			console.log('Эмоции категории:', categoryEmotions.data);
		}
	} catch (error) {
		console.error('Ошибка работы с эмоциями:', error);
	}
}

/**
 * Пример: Создание CBT записи
 */
export async function exampleCreateCBTEntry() {
	try {
		// Подготавливаем данные для новой записи
		const entryData: CreateCBTEntryRequest = {
			situation: 'Сложный день на работе, много стресса',
			thoughts: [
				{
					thought: 'Я не справляюсь с работой',
					isAutomatic: true,
					intensity: 8,
					emotions: [
						{ emotionId: 1, intensity: 7 }, // Тревога
						{ emotionId: 5, intensity: 6 }, // Грусть
					],
					cognitiveDistortions: [
						{
							type: 'catastrophizing',
							description: 'Преувеличение негативных последствий',
						},
					],
				},
			],
			reactions: 'Избегал коллег, работал допоздна',
			moodScoreBefore: 3,
			tags: ['работа', 'стресс'],
			isPublic: false,
		};

		// Создаём запись
		const result = await cbtService.createEntry(entryData);

		if (result.success) {
			console.log('CBT запись создана:', result.data);

			// Через некоторое время обновляем mood after
			setTimeout(async () => {
				try {
					await cbtService.updateMoodAfter(result.data.id, {
						moodScoreAfter: 6,
					});
					console.log('Mood after обновлён');
				} catch (error) {
					console.error('Ошибка обновления mood after:', error);
				}
			}, 5000);
		}
	} catch (error) {
		console.error('Ошибка создания CBT записи:', error);
	}
}

/**
 * Пример: Получение аналитики
 */
export async function exampleAnalyticsFlow() {
	try {
		// 1. Получить полную панель аналитики
		const dashboard = await analyticsService.getFullDashboard();
		console.log('Аналитическая панель:', dashboard);

		// 2. Получить еженедельные тренды
		const weeklyTrends = await analyticsService.getWeeklyTrends();
		if (weeklyTrends.success) {
			console.log('Еженедельные тренды:', weeklyTrends.data);
		}

		// 3. Получить топ эмоций
		const topEmotions = await analyticsService.getTopEmotions(5);
		if (topEmotions.success) {
			console.log('Топ 5 эмоций:', topEmotions.data);
		}

		// 4. Сравнить периоды
		const currentWeek = {
			dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
			dateTo: new Date().toISOString(),
		};

		const previousWeek = {
			dateFrom: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
			dateTo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
		};

		const comparison = await analyticsService.getPeriodsComparison(
			currentWeek,
			previousWeek
		);
		console.log('Сравнение недель:', comparison);
	} catch (error) {
		console.error('Ошибка получения аналитики:', error);
	}
}

/**
 * Пример: Синхронизация данных
 */
export async function exampleSyncFlow() {
	try {
		// 1. Проверить возможность синхронизации
		const canSync = await syncService.canSync();
		console.log('Можно синхронизировать:', canSync);

		if (!canSync) {
			console.log('Синхронизация недоступна');
			return;
		}

		// 2. Получить локальные записи (заглушка)
		const localEntries = await cbtService.getEntries({ limit: 100 });

		if (!localEntries.success) {
			console.log('Нет локальных данных для синхронизации');
			return;
		}

		// 3. Выполнить автоматическую синхронизацию
		const lastSync = syncService.getLastSyncTimestamp();
		const syncResult = await syncService.autoSync(
			localEntries.data,
			lastSync || undefined
		);

		if (syncResult.success) {
			console.log('Синхронизация успешна:', syncResult.data);

			// Сохранить новую метку времени
			syncService.setLastSyncTimestamp(syncResult.data.lastSyncTimestamp);

			// Проверить конфликты
			const conflicts = await syncService.getPendingConflicts();
			if (conflicts.hasConflicts) {
				console.log('Есть конфликты, требующие разрешения:', conflicts);
			}
		}
	} catch (error) {
		console.error('Ошибка синхронизации:', error);
	}
}

/**
 * Пример: Проверка состояния всех сервисов
 */
export async function exampleHealthCheck() {
	try {
		// Инициализируем сервисы
		await apiServicesManager.initialize();

		// Проверяем состояние
		const health = await apiServicesManager.healthCheck();
		console.log('Состояние сервисов:', health);

		// Получаем информацию о сервисах
		const info = apiServicesManager.getServicesInfo();
		console.log('Информация о сервисах:', info);

		if (!health.overall) {
			console.warn('Некоторые сервисы недоступны');
		}
	} catch (error) {
		console.error('Ошибка проверки состояния:', error);
	}
}

/**
 * Пример: Полный workflow приложения
 */
export async function exampleFullWorkflow() {
	console.log('🚀 Запуск полного workflow...');

	try {
		// 1. Инициализация
		await apiServicesManager.initialize();
		console.log('✅ Сервисы инициализированы');

		// 2. Проверка состояния
		const health = await apiServicesManager.healthCheck();
		if (!health.api) {
			throw new Error('API недоступен');
		}
		console.log('✅ API доступен');

		// 3. Авторизация (если нужна)
		if (!authService.isAuthenticated()) {
			await exampleAuthFlow();
		}
		console.log('✅ Пользователь авторизован');

		// 4. Загрузка базовых данных
		await exampleEmotionsFlow();
		console.log('✅ Эмоции загружены');

		// 5. Создание записи
		await exampleCreateCBTEntry();
		console.log('✅ CBT запись создана');

		// 6. Получение аналитики
		await exampleAnalyticsFlow();
		console.log('✅ Аналитика получена');

		// 7. Синхронизация
		await exampleSyncFlow();
		console.log('✅ Синхронизация выполнена');

		console.log('🎉 Полный workflow завершён успешно!');
	} catch (error) {
		console.error('❌ Ошибка в workflow:', error);
	}
}

/**
 * Пример: Обработка ошибок
 */
export async function exampleErrorHandling() {
	try {
		// Попытка доступа к защищённому ресурсу без авторизации
		await userService.getCurrentUser();
	} catch (error: any) {
		if (error.statusCode === 401) {
			console.log('Требуется авторизация');
			// Можно показать экран входа
		} else if (error.statusCode === 403) {
			console.log('Доступ запрещён');
		} else if (error.statusCode >= 500) {
			console.log('Ошибка сервера, повторите позже');
		} else {
			console.log('Неизвестная ошибка:', error.error?.message);
		}
	}
}

/**
 * Экспорт всех примеров для удобства
 */
export const examples = {
	authFlow: exampleAuthFlow,
	emotionsFlow: exampleEmotionsFlow,
	createCBTEntry: exampleCreateCBTEntry,
	analyticsFlow: exampleAnalyticsFlow,
	syncFlow: exampleSyncFlow,
	healthCheck: exampleHealthCheck,
	fullWorkflow: exampleFullWorkflow,
	errorHandling: exampleErrorHandling,
};
