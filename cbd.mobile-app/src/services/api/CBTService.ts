/**
 * CBT Service
 * Сервис для работы с CBT записями (когнитивно-поведенческая терапия)
 */

import { apiClient } from './client';
import { API_CONFIG } from './config';
import type {
	ApiResponse,
	CBTEntry,
	CreateCBTEntryRequest,
	PaginationParams,
	UpdateCBTEntryRequest,
	UpdateMoodAfterRequest,
} from './types';

export class CBTService {
	private static instance: CBTService;

	static getInstance(): CBTService {
		if (!CBTService.instance) {
			CBTService.instance = new CBTService();
		}
		return CBTService.instance;
	}

	/**
	 * Создать новую CBT запись
	 */
	async createEntry(
		entryData: CreateCBTEntryRequest
	): Promise<ApiResponse<CBTEntry>> {
		try {
			console.log('📝 Создание CBT записи...');

			const response = await apiClient.post<CBTEntry>(
				API_CONFIG.ENDPOINTS.CBT.ENTRIES,
				entryData
			);

			console.log('✅ CBT запись создана');
			return response;
		} catch (error) {
			console.error('❌ Ошибка создания CBT записи:', error);
			throw error;
		}
	}

	/**
	 * Получить все CBT записи пользователя
	 */
	async getEntries(
		params?: PaginationParams & {
			tags?: string[];
			dateFrom?: string;
			dateTo?: string;
			moodScoreMin?: number;
			moodScoreMax?: number;
		}
	): Promise<ApiResponse<CBTEntry[]>> {
		try {
			console.log('📋 Получение CBT записей...');

			const response = await apiClient.get<CBTEntry[]>(
				API_CONFIG.ENDPOINTS.CBT.ENTRIES,
				params
			);

			console.log('✅ CBT записи получены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения CBT записей:', error);
			throw error;
		}
	}

	/**
	 * Получить CBT запись по ID
	 */
	async getEntryById(id: string): Promise<ApiResponse<CBTEntry>> {
		try {
			console.log(`📄 Получение CBT записи ${id}...`);

			const response = await apiClient.get<CBTEntry>(
				API_CONFIG.ENDPOINTS.CBT.ENTRY(id)
			);

			console.log('✅ CBT запись получена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения CBT записи:', error);
			throw error;
		}
	}

	/**
	 * Обновить CBT запись
	 */
	async updateEntry(
		id: string,
		entryData: UpdateCBTEntryRequest
	): Promise<ApiResponse<CBTEntry>> {
		try {
			console.log(`✏️ Обновление CBT записи ${id}...`);

			const response = await apiClient.patch<CBTEntry>(
				API_CONFIG.ENDPOINTS.CBT.ENTRY(id),
				entryData
			);

			console.log('✅ CBT запись обновлена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления CBT записи:', error);
			throw error;
		}
	}

	/**
	 * Удалить CBT запись
	 */
	async deleteEntry(id: string): Promise<ApiResponse<void>> {
		try {
			console.log(`🗑️ Удаление CBT записи ${id}...`);

			const response = await apiClient.delete<void>(
				API_CONFIG.ENDPOINTS.CBT.ENTRY(id)
			);

			console.log('✅ CBT запись удалена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка удаления CBT записи:', error);
			throw error;
		}
	}

	/**
	 * Обновить оценку настроения после (mood after)
	 */
	async updateMoodAfter(
		id: string,
		moodData: UpdateMoodAfterRequest
	): Promise<ApiResponse<CBTEntry>> {
		try {
			console.log(`📊 Обновление mood after для записи ${id}...`);

			const response = await apiClient.patch<CBTEntry>(
				API_CONFIG.ENDPOINTS.CBT.MOOD_AFTER(id),
				moodData
			);

			console.log('✅ Mood after обновлен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления mood after:', error);
			throw error;
		}
	}

	/**
	 * Получить все доступные теги
	 */
	async getAllTags(): Promise<ApiResponse<string[]>> {
		try {
			console.log('🏷️ Получение всех тегов...');

			const response = await apiClient.get<string[]>(
				API_CONFIG.ENDPOINTS.CBT.TAGS
			);

			console.log('✅ Теги получены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения тегов:', error);
			throw error;
		}
	}

	// ===============================
	// Helper Methods
	// ===============================

	/**
	 * Получить записи за определенный период
	 */
	async getEntriesByDateRange(
		dateFrom: string,
		dateTo: string
	): Promise<ApiResponse<CBTEntry[]>> {
		return this.getEntries({ dateFrom, dateTo });
	}

	/**
	 * Получить записи с определенными тегами
	 */
	async getEntriesByTags(tags: string[]): Promise<ApiResponse<CBTEntry[]>> {
		return this.getEntries({ tags });
	}

	/**
	 * Получить записи по диапазону настроения
	 */
	async getEntriesByMoodRange(
		moodScoreMin: number,
		moodScoreMax: number
	): Promise<ApiResponse<CBTEntry[]>> {
		return this.getEntries({ moodScoreMin, moodScoreMax });
	}

	/**
	 * Получить последние записи
	 */
	async getRecentEntries(limit: number = 10): Promise<ApiResponse<CBTEntry[]>> {
		return this.getEntries({
			limit,
			sortBy: 'createdAt',
			sortOrder: 'desc',
		});
	}

	/**
	 * Поиск записей по тексту ситуации или мыслей
	 */
	async searchEntries(query: string): Promise<ApiResponse<CBTEntry[]>> {
		try {
			console.log(`🔍 Поиск CBT записей: "${query}"...`);

			const response = await apiClient.get<CBTEntry[]>(
				API_CONFIG.ENDPOINTS.CBT.ENTRIES,
				{ search: query }
			);

			console.log('✅ Поиск завершен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка поиска записей:', error);
			throw error;
		}
	}

	/**
	 * Получить статистику по записям
	 */
	async getEntriesStats(): Promise<{
		total: number;
		thisWeek: number;
		thisMonth: number;
		averageMoodBefore: number;
		averageMoodAfter: number;
		improvementRate: number;
	}> {
		try {
			console.log('📊 Получение статистики записей...');

			const response = await this.getEntries();

			if (!response.success) {
				throw new Error('Не удалось получить записи');
			}

			const entries = response.data;
			const now = new Date();
			const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

			const thisWeekEntries = entries.filter(
				entry => new Date(entry.createdAt) >= oneWeekAgo
			);

			const thisMonthEntries = entries.filter(
				entry => new Date(entry.createdAt) >= oneMonthAgo
			);

			const entriesWithMoodAfter = entries.filter(
				entry =>
					entry.moodScoreAfter !== null && entry.moodScoreAfter !== undefined
			);

			const averageMoodBefore =
				entries.reduce((sum, entry) => sum + entry.moodScoreBefore, 0) /
				entries.length;

			const averageMoodAfter =
				entriesWithMoodAfter.length > 0
					? entriesWithMoodAfter.reduce(
							(sum, entry) => sum + (entry.moodScoreAfter || 0),
							0
					  ) / entriesWithMoodAfter.length
					: 0;

			const improvementRate =
				entriesWithMoodAfter.length > 0
					? ((averageMoodAfter - averageMoodBefore) / averageMoodBefore) * 100
					: 0;

			const stats = {
				total: entries.length,
				thisWeek: thisWeekEntries.length,
				thisMonth: thisMonthEntries.length,
				averageMoodBefore: Number(averageMoodBefore.toFixed(1)),
				averageMoodAfter: Number(averageMoodAfter.toFixed(1)),
				improvementRate: Number(improvementRate.toFixed(1)),
			};

			console.log('✅ Статистика записей получена');
			return stats;
		} catch (error) {
			console.error('❌ Ошибка получения статистики записей:', error);
			throw error;
		}
	}
}

// Экспортируем singleton экземпляр
export const cbtService = CBTService.getInstance();
