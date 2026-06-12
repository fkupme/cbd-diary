/**
 * Emotions Service
 * Сервис для работы с эмоциями и категориями эмоций
 */

import { apiClient } from './client';
import { API_CONFIG } from './config';
import type {
	ApiResponse,
	CreateEmotionCategoryRequest,
	CreateEmotionRequest,
	Emotion,
	EmotionCategory,
	PaginationParams,
} from './types';

export class EmotionsService {
	private static instance: EmotionsService;

	static getInstance(): EmotionsService {
		if (!EmotionsService.instance) {
			EmotionsService.instance = new EmotionsService();
		}
		return EmotionsService.instance;
	}

	// ===============================
	// Emotion Categories
	// ===============================

	/**
	 * Получить все категории эмоций
	 */
	async getEmotionCategories(
		params?: PaginationParams
	): Promise<ApiResponse<EmotionCategory[]>> {
		try {
			console.log('📂 Получение категорий эмоций...');

			const response = await apiClient.get<EmotionCategory[]>(
				API_CONFIG.ENDPOINTS.EMOTIONS.CATEGORIES,
				params
			);

			console.log('✅ Категории эмоций получены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения категорий эмоций:', error);
			throw error;
		}
	}

	/**
	 * Получить категорию эмоций по ID
	 */
	async getEmotionCategoryById(
		id: number
	): Promise<ApiResponse<EmotionCategory>> {
		try {
			console.log(`📂 Получение категории эмоций ${id}...`);

			const response = await apiClient.get<EmotionCategory>(
				API_CONFIG.ENDPOINTS.EMOTIONS.CATEGORY(id)
			);

			console.log('✅ Категория эмоций получена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения категории эмоций:', error);
			throw error;
		}
	}

	/**
	 * Создать новую категорию эмоций
	 */
	async createEmotionCategory(
		categoryData: CreateEmotionCategoryRequest
	): Promise<ApiResponse<EmotionCategory>> {
		try {
			console.log('➕ Создание категории эмоций...');

			const response = await apiClient.post<EmotionCategory>(
				API_CONFIG.ENDPOINTS.EMOTIONS.CATEGORIES,
				categoryData
			);

			console.log('✅ Категория эмоций создана');
			return response;
		} catch (error) {
			console.error('❌ Ошибка создания категории эмоций:', error);
			throw error;
		}
	}

	/**
	 * Обновить категорию эмоций
	 */
	async updateEmotionCategory(
		id: number,
		categoryData: Partial<CreateEmotionCategoryRequest>
	): Promise<ApiResponse<EmotionCategory>> {
		try {
			console.log(`✏️ Обновление категории эмоций ${id}...`);

			const response = await apiClient.patch<EmotionCategory>(
				API_CONFIG.ENDPOINTS.EMOTIONS.CATEGORY(id),
				categoryData
			);

			console.log('✅ Категория эмоций обновлена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления категории эмоций:', error);
			throw error;
		}
	}

	/**
	 * Удалить категорию эмоций
	 */
	async deleteEmotionCategory(id: number): Promise<ApiResponse<void>> {
		try {
			console.log(`🗑️ Удаление категории эмоций ${id}...`);

			const response = await apiClient.delete<void>(
				API_CONFIG.ENDPOINTS.EMOTIONS.CATEGORY(id)
			);

			console.log('✅ Категория эмоций удалена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка удаления категории эмоций:', error);
			throw error;
		}
	}

	// ===============================
	// Emotions
	// ===============================

	/**
	 * Получить все эмоции
	 */
	async getEmotions(
		params?: PaginationParams & { categoryId?: number }
	): Promise<ApiResponse<Emotion[]>> {
		try {
			console.log('😊 Получение эмоций...');

			const response = await apiClient.get<Emotion[]>(
				API_CONFIG.ENDPOINTS.EMOTIONS.EMOTIONS,
				params
			);

			console.log('✅ Эмоции получены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения эмоций:', error);
			throw error;
		}
	}

	/**
	 * Получить эмоцию по ID
	 */
	async getEmotionById(id: number): Promise<ApiResponse<Emotion>> {
		try {
			console.log(`😊 Получение эмоции ${id}...`);

			const response = await apiClient.get<Emotion>(
				API_CONFIG.ENDPOINTS.EMOTIONS.EMOTION(id)
			);

			console.log('✅ Эмоция получена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения эмоции:', error);
			throw error;
		}
	}

	/**
	 * Создать новую эмоцию
	 */
	async createEmotion(
		emotionData: CreateEmotionRequest
	): Promise<ApiResponse<Emotion>> {
		try {
			console.log('➕ Создание эмоции...');

			const response = await apiClient.post<Emotion>(
				API_CONFIG.ENDPOINTS.EMOTIONS.EMOTIONS,
				emotionData
			);

			console.log('✅ Эмоция создана');
			return response;
		} catch (error) {
			console.error('❌ Ошибка создания эмоции:', error);
			throw error;
		}
	}

	/**
	 * Обновить эмоцию
	 */
	async updateEmotion(
		id: number,
		emotionData: Partial<CreateEmotionRequest>
	): Promise<ApiResponse<Emotion>> {
		try {
			console.log(`✏️ Обновление эмоции ${id}...`);

			const response = await apiClient.patch<Emotion>(
				API_CONFIG.ENDPOINTS.EMOTIONS.EMOTION(id),
				emotionData
			);

			console.log('✅ Эмоция обновлена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления эмоции:', error);
			throw error;
		}
	}

	/**
	 * Удалить эмоцию
	 */
	async deleteEmotion(id: number): Promise<ApiResponse<void>> {
		try {
			console.log(`🗑️ Удаление эмоции ${id}...`);

			const response = await apiClient.delete<void>(
				API_CONFIG.ENDPOINTS.EMOTIONS.EMOTION(id)
			);

			console.log('✅ Эмоция удалена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка удаления эмоции:', error);
			throw error;
		}
	}

	// ===============================
	// Helper Methods
	// ===============================

	/**
	 * Получить эмоции по категории
	 */
	async getEmotionsByCategory(
		categoryId: number
	): Promise<ApiResponse<Emotion[]>> {
		return this.getEmotions({ categoryId });
	}

	/**
	 * Получить полную структуру эмоций (категории с эмоциями)
	 */
	async getFullEmotionsStructure(): Promise<{
		categories: EmotionCategory[];
		emotions: Emotion[];
	}> {
		try {
			console.log('🌟 Получение полной структуры эмоций...');

			const categoriesResponse = await this.getEmotionCategories();
			if (!categoriesResponse.success) {
				throw new Error('Не удалось загрузить категории эмоций');
			}

			// Тянем все эмоции постранично (а не только первые 10)
			const allEmotions: Emotion[] = [];
			const pageLimit = 250; // достаточно, чтобы забрать все за 1-2 запроса
			let page = 1;
			// safety cap чтобы не уйти в бесконечный цикл
			for (let i = 0; i < 20; i++) {
				const resp = await this.getEmotions({ page, limit: pageLimit });
				if (!resp.success) break;
				const batch = resp.data || [];
				allEmotions.push(...batch);
				const hasNext = (resp as any).metadata?.hasNext;
				if (!hasNext || batch.length < pageLimit) break;
				page += 1;
			}

			console.log('✅ Полная структура эмоций получена');
			return {
				categories: categoriesResponse.data,
				emotions: allEmotions,
			};
		} catch (error) {
			console.error('❌ Ошибка получения структуры эмоций:', error);
			throw error;
		}
	}

	/**
	 * Поиск эмоций по имени
	 */
	async searchEmotions(query: string): Promise<ApiResponse<Emotion[]>> {
		try {
			console.log(`🔍 Поиск эмоций: "${query}"...`);

			const response = await apiClient.get<Emotion[]>(
				API_CONFIG.ENDPOINTS.EMOTIONS.EMOTIONS,
				{ search: query }
			);

			console.log('✅ Поиск завершен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка поиска эмоций:', error);
			throw error;
		}
	}

	/**
	 * Получить переводы эмоций и категорий для всех языков
	 * Ожидается, что бэк вернёт объект вида { ru: { key: value }, en: {...}, ... }
	 */
	async getEmotionI18nBundles(): Promise<
		Record<string, Record<string, string>>
	> {
		try {
			const bundles: Record<string, Record<string, string>> = {};
			const languages = ['ru', 'en', 'es', 'de', 'fr', 'zh'];

			// 1) Пытаемся получить готовые бандлы с бэка
			for (const lang of languages) {
				try {
					const resp = await apiClient.get<Record<string, string>>(
						`/i18n/${lang}`,
						undefined,
						{ requireAuth: false }
					);
					if (resp.success && resp.data) {
						bundles[lang] = resp.data;
						continue;
					}
				} catch {}
			}

			// 2) Fallback: если какие-то языки не пришли и пользователь авторизован
			if (apiClient.isAuthenticated()) {
				try {
					const categoriesResp = await this.getEmotionCategories();
					const emResp = await this.getEmotions({ limit: 0 });
					for (const lang of languages) {
						if (bundles[lang]) continue;
						const map: Record<string, string> = {};
						if (categoriesResp.success) {
							for (const c of categoriesResp.data) {
								map[c.name] = c.name;
							}
						}
						if (emResp.success) {
							for (const e of emResp.data as any[]) {
								const key = e.name_key || e.nameKey || e.name;
								const value = e.name || key;
								if (key) map[key] = value;
							}
						}
						bundles[lang] = map;
					}
				} catch {}
			}
			return bundles;
		} catch (e) {
			console.warn(
				'⚠️ Не удалось собрать i18n bundles из API, возврат пустого набора:',
				e
			);
			return {};
		}
	}
}

// Экспортируем singleton экземпляр
export const emotionsService = EmotionsService.getInstance();
