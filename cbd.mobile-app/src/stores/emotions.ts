/**
 * Emotions Store
 * Управление состоянием эмоций с интеграцией API
 */

import { useEmotions } from '@/composables/useApiIntegration';
import type { Emotion, EmotionCategory } from '@/services/api/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useEmotionsStore = defineStore('emotions', () => {
	// Используем композабл для API интеграции
	const emotionsApi = useEmotions();

	// Local state (кэшируем для оффлайн использования)
	const localCategories = ref<EmotionCategory[]>([]);
	const localEmotions = ref<Emotion[]>([]);
	const lastLoadTime = ref<string | null>(null);
	const needsRefresh = ref(true);

	// Getters (используем computed из композабла + локальный кэш)
	const emotionCategories = computed(() => {
		// Приоритет отдаем API данным, если доступны
		return emotionsApi.categories.value.length > 0
			? emotionsApi.categories.value
			: localCategories.value;
	});

	const emotions = computed(() => {
		// Приоритет отдаем API данным, если доступны
		return emotionsApi.emotions.value.length > 0
			? emotionsApi.emotions.value
			: localEmotions.value;
	});

	const isLoading = computed(() => emotionsApi.isLoading.value);
	const error = computed(() => emotionsApi.error.value);

	// Utility getters
	const getEmotionById = (id: number): Emotion | undefined => {
		return emotions.value.find(emotion => emotion.id === id);
	};

	const getCategoryById = (id: number): EmotionCategory | undefined => {
		return emotionCategories.value.find(category => category.id === id);
	};

	const getEmotionsByCategory = (categoryId: number): Emotion[] => {
		return emotions.value.filter(emotion => emotion.categoryId === categoryId);
	};

	const getCategoriesWithEmotions = computed(() => {
		return emotionCategories.value.map(category => ({
			...category,
			emotions: getEmotionsByCategory(category.id),
		}));
	});

	const searchEmotionsByName = (query: string): Emotion[] => {
		const lowerQuery = query.toLowerCase();
		return emotions.value.filter(
			emotion =>
				emotion.name.toLowerCase().includes(lowerQuery) ||
				(emotion.nameKey &&
					emotion.nameKey.toLowerCase().includes(lowerQuery))
		);
	};

	// Actions
	const loadAll = async (forceRefresh = false) => {
		// Проверяем нужно ли обновление
		if (
			!forceRefresh &&
			!needsRefresh.value &&
			emotions.value.length > 0 &&
			lastLoadTime.value &&
			Date.now() - new Date(lastLoadTime.value).getTime() < 5 * 60 * 1000
		) {
			return; // Данные свежие (менее 5 минут)
		}

		try {
			await emotionsApi.loadAll();

			// Обновляем локальный кэш
			if (emotionsApi.categories.value.length > 0) {
				localCategories.value = [...emotionsApi.categories.value];
				localEmotions.value = [...emotionsApi.emotions.value];

				// Сохраняем в localStorage для оффлайн режима
				saveToLocalStorage();
			}

			lastLoadTime.value = new Date().toISOString();
			needsRefresh.value = false;

			console.log('✅ Эмоции загружены:', {
				categories: emotionCategories.value.length,
				emotions: emotions.value.length,
			});
		} catch (err) {
			console.error('❌ Ошибка загрузки эмоций:', err);

			// При ошибке загружаем из локального кэша
			loadFromLocalStorage();
			throw err;
		}
	};

	const searchEmotions = async (query: string): Promise<Emotion[]> => {
		try {
			// Сначала ищем локально для быстрого ответа
			const localResults = searchEmotionsByName(query);

			// Затем ищем через API если онлайн
			try {
				const apiResults = await emotionsApi.searchEmotions(query);
				return apiResults.length > 0 ? apiResults : localResults;
			} catch {
				// При ошибке API возвращаем локальные результаты
				return localResults;
			}
		} catch (err) {
			console.warn('Ошибка поиска эмоций:', err);
			return [];
		}
	};

	const invalidateCache = () => {
		needsRefresh.value = true;
		lastLoadTime.value = null;
	};

	// Local storage management
	const saveToLocalStorage = () => {
		try {
			const data = {
				categories: localCategories.value,
				emotions: localEmotions.value,
				lastLoadTime: lastLoadTime.value,
			};
			localStorage.setItem('emotions-cache', JSON.stringify(data));
		} catch (err) {
			console.warn('Не удалось сохранить эмоции в localStorage:', err);
		}
	};

	const loadFromLocalStorage = () => {
		try {
			const stored = localStorage.getItem('emotions-cache');
			if (stored) {
				const data = JSON.parse(stored);
				localCategories.value = data.categories || [];
				localEmotions.value = data.emotions || [];
				lastLoadTime.value = data.lastLoadTime || null;

				console.log('📱 Эмоции загружены из кэша:', {
					categories: localCategories.value.length,
					emotions: localEmotions.value.length,
				});
			}
		} catch (err) {
			console.warn('Не удалось загрузить эмоции из localStorage:', err);
		}
	};

	const clearCache = () => {
		localCategories.value = [];
		localEmotions.value = [];
		lastLoadTime.value = null;
		needsRefresh.value = true;

		try {
			localStorage.removeItem('emotions-cache');
		} catch (err) {
			console.warn('Не удалось очистить кэш эмоций:', err);
		}
	};

	// Helper functions for UI
	const getEmotionColor = (emotionId: number): string => {
		// Цвет задаётся на уровне категории (как в каталоге на сервере)
		const emotion = getEmotionById(emotionId);
		const category = emotion ? getCategoryById(emotion.categoryId) : null;
		return category?.color || '#6B7280'; // default gray
	};

	const getEmotionEmoji = (emotionId: number): string => {
		const emotion = getEmotionById(emotionId);
		return emotion?.emoji || '😐';
	};

	const getCategoryColor = (categoryId: number): string => {
		const category = getCategoryById(categoryId);
		return category?.color || '#6B7280';
	};

	const getCategoryEmoji = (categoryId: number): string => {
		const category = getCategoryById(categoryId);
		return category?.icon || '📁';
	};

	// Validation helpers
	const isValidEmotion = (emotionId: number): boolean => {
		return !!getEmotionById(emotionId);
	};

	const isValidCategory = (categoryId: number): boolean => {
		return !!getCategoryById(categoryId);
	};

	// Statistics
	const getCategoryStats = computed(() => {
		return emotionCategories.value.map(category => ({
			...category,
			emotionCount: getEmotionsByCategory(category.id).length,
		}));
	});

	const getTotalEmotionsCount = computed(() => emotions.value.length);
	const getTotalCategoriesCount = computed(
		() => emotionCategories.value.length
	);

	// Инициализация
	const initialize = async () => {
		try {
			// Загружаем данные из localStorage для быстрого старта
			loadFromLocalStorage();

			// Затем загружаем свежие данные из API
			await loadAll();

			console.log('✅ Emotions store инициализирован');
		} catch (err) {
			console.error('❌ Ошибка инициализации emotions store:', err);
			// При ошибке остаемся с кэшированными данными
		}
	};

	return {
		// State
		emotionCategories,
		emotions,
		isLoading,
		error,
		lastLoadTime: computed(() => lastLoadTime.value),
		needsRefresh: computed(() => needsRefresh.value),

		// Computed
		getCategoriesWithEmotions,
		getCategoryStats,
		getTotalEmotionsCount,
		getTotalCategoriesCount,

		// Getters
		getEmotionById,
		getCategoryById,
		getEmotionsByCategory,
		getEmotionColor,
		getEmotionEmoji,
		getCategoryColor,
		getCategoryEmoji,

		// Search & Filter
		searchEmotionsByName,
		searchEmotions,

		// Validation
		isValidEmotion,
		isValidCategory,

		// Actions
		loadAll,
		invalidateCache,
		clearCache,
		initialize,
	};
});

// Экспортируем типы для использования в других местах
export type EmotionsStore = ReturnType<typeof useEmotionsStore>;
