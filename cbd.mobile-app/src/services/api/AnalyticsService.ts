/**
 * Analytics Service
 * Сервис для работы с аналитикой и статистикой
 */

import { apiClient } from './client';
import { API_CONFIG } from './config';
import type {
	AnalyticsSummary,
	ApiResponse,
	CognitiveInsight,
	EmotionStat,
	MoodTrend,
	ProgressReport,
	UserStats,
} from './types';

export class AnalyticsService {
	private static instance: AnalyticsService;

	static getInstance(): AnalyticsService {
		if (!AnalyticsService.instance) {
			AnalyticsService.instance = new AnalyticsService();
		}
		return AnalyticsService.instance;
	}

	/**
	 * Получить общую статистику пользователя
	 */
	async getUserStats(): Promise<ApiResponse<UserStats>> {
		try {
			console.log('📊 Получение статистики пользователя...');

			const response = await apiClient.get<UserStats>(
				API_CONFIG.ENDPOINTS.ANALYTICS.USER_STATS
			);

			console.log('✅ Статистика пользователя получена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения статистики пользователя:', error);
			throw error;
		}
	}

	/**
	 * Получить статистику эмоций
	 */
	async getEmotionsStats(params?: {
		dateFrom?: string;
		dateTo?: string;
		limit?: number;
	}): Promise<ApiResponse<EmotionStat[]>> {
		try {
			console.log('😊 Получение статистики эмоций...');

			const response = await apiClient.get<EmotionStat[]>(
				API_CONFIG.ENDPOINTS.ANALYTICS.EMOTIONS,
				params
			);

			console.log('✅ Статистика эмоций получена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения статистики эмоций:', error);
			throw error;
		}
	}

	/**
	 * Получить тренды настроения
	 */
	async getMoodTrends(params?: {
		period?: 'week' | 'month' | 'year';
		dateFrom?: string;
		dateTo?: string;
	}): Promise<ApiResponse<MoodTrend[]>> {
		try {
			console.log('📈 Получение трендов настроения...');

			const response = await apiClient.get<MoodTrend[]>(
				API_CONFIG.ENDPOINTS.ANALYTICS.MOOD_TRENDS,
				params
			);

			console.log('✅ Тренды настроения получены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения трендов настроения:', error);
			throw error;
		}
	}

	/**
	 * Получить когнитивные инсайты
	 */
	async getCognitiveInsights(params?: {
		dateFrom?: string;
		dateTo?: string;
	}): Promise<ApiResponse<CognitiveInsight[]>> {
		try {
			console.log('🧠 Получение когнитивных инсайтов...');

			const response = await apiClient.get<CognitiveInsight[]>(
				API_CONFIG.ENDPOINTS.ANALYTICS.COGNITIVE_INSIGHTS,
				params
			);

			console.log('✅ Когнитивные инсайты получены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения когнитивных инсайтов:', error);
			throw error;
		}
	}

	/**
	 * Получить отчет о прогрессе
	 */
	async getProgressReport(params?: {
		period?: 'week' | 'month' | 'year';
		dateFrom?: string;
		dateTo?: string;
	}): Promise<ApiResponse<ProgressReport>> {
		try {
			console.log('📋 Получение отчета о прогрессе...');

			const response = await apiClient.get<ProgressReport>(
				API_CONFIG.ENDPOINTS.ANALYTICS.PROGRESS_REPORT,
				params
			);

			console.log('✅ Отчет о прогрессе получен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения отчета о прогрессе:', error);
			throw error;
		}
	}

	/**
	 * Получить сводку аналитики
	 */
	async getAnalyticsSummary(params?: {
		timeRange?: 'week' | 'month' | 'quarter' | 'year' | 'custom';
		startDate?: string; // YYYY-MM-DD
		endDate?: string; // YYYY-MM-DD
	}): Promise<ApiResponse<AnalyticsSummary>> {
		try {
			console.log('📊 Получение сводки аналитики...');

			const response = await apiClient.get<AnalyticsSummary>(
				API_CONFIG.ENDPOINTS.ANALYTICS.SUMMARY,
				params
			);

			console.log('✅ Сводка аналитики получена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения сводки аналитики:', error);
			throw error;
		}
	}

	/**
	 * Обновить статистику (форсированно)
	 */
	async refreshStats(): Promise<ApiResponse<void>> {
		try {
			console.log('🔄 Обновление статистики...');

			const response = await apiClient.put<void>(
				API_CONFIG.ENDPOINTS.ANALYTICS.REFRESH_STATS
			);

			console.log('✅ Статистика обновлена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления статистики:', error);
			throw error;
		}
	}

	// ===============================
	// Helper Methods
	// ===============================

	/**
	 * Получить еженедельные тренды
	 */
	async getWeeklyTrends(): Promise<ApiResponse<MoodTrend[]>> {
		return this.getMoodTrends({ period: 'week' });
	}

	/**
	 * Получить месячные тренды
	 */
	async getMonthlyTrends(): Promise<ApiResponse<MoodTrend[]>> {
		return this.getMoodTrends({ period: 'month' });
	}

	/**
	 * Получить годовые тренды
	 */
	async getYearlyTrends(): Promise<ApiResponse<MoodTrend[]>> {
		return this.getMoodTrends({ period: 'year' });
	}

	/**
	 * Получить топ эмоций за период
	 */
	async getTopEmotions(
		limit: number = 5,
		dateFrom?: string,
		dateTo?: string
	): Promise<ApiResponse<EmotionStat[]>> {
		return this.getEmotionsStats({ limit, dateFrom, dateTo });
	}

	/**
	 * Получить полную аналитическую панель
	 */
	async getFullDashboard(): Promise<{
		userStats: UserStats;
		summary: AnalyticsSummary;
		weeklyTrends: MoodTrend[];
		topEmotions: EmotionStat[];
		cognitiveInsights: CognitiveInsight[];
	}> {
		try {
			console.log('🚀 Получение полной аналитической панели...');

			const [
				userStatsResponse,
				summaryResponse,
				weeklyTrendsResponse,
				topEmotionsResponse,
				cognitiveInsightsResponse,
			] = await Promise.all([
				this.getUserStats(),
				this.getAnalyticsSummary(),
				this.getWeeklyTrends(),
				this.getTopEmotions(5),
				this.getCognitiveInsights(),
			]);

			// Проверяем успешность всех запросов
			const responses = [
				userStatsResponse,
				summaryResponse,
				weeklyTrendsResponse,
				topEmotionsResponse,
				cognitiveInsightsResponse,
			];

			const failedResponse = responses.find(response => !response.success);
			if (failedResponse) {
				throw new Error('Не удалось загрузить часть данных аналитики');
			}

			const dashboard = {
				userStats: userStatsResponse.data,
				summary: summaryResponse.data,
				weeklyTrends: weeklyTrendsResponse.data,
				topEmotions: topEmotionsResponse.data,
				cognitiveInsights: cognitiveInsightsResponse.data,
			};

			console.log('✅ Полная аналитическая панель получена');
			return dashboard;
		} catch (error) {
			console.error('❌ Ошибка получения полной панели:', error);
			throw error;
		}
	}

	/**
	 * Получить сравнение периодов
	 */
	async getPeriodsComparison(
		currentPeriod: { dateFrom: string; dateTo: string },
		previousPeriod: { dateFrom: string; dateTo: string }
	): Promise<{
		current: {
			trends: MoodTrend[];
			emotions: EmotionStat[];
			insights: CognitiveInsight[];
		};
		previous: {
			trends: MoodTrend[];
			emotions: EmotionStat[];
			insights: CognitiveInsight[];
		};
		comparison: {
			moodImprovement: number;
			emotionChanges: Array<{
				emotion: string;
				changePercent: number;
			}>;
		};
	}> {
		try {
			console.log('🔍 Получение сравнения периодов...');

			const [
				currentTrends,
				previousTrends,
				currentEmotions,
				previousEmotions,
				currentInsights,
				previousInsights,
			] = await Promise.all([
				this.getMoodTrends(currentPeriod),
				this.getMoodTrends(previousPeriod),
				this.getEmotionsStats(currentPeriod),
				this.getEmotionsStats(previousPeriod),
				this.getCognitiveInsights(currentPeriod),
				this.getCognitiveInsights(previousPeriod),
			]);

			// Вычисляем средние значения настроения
			const currentAvgMood =
				currentTrends.data.reduce(
					(sum, trend) => sum + trend.averageMoodBefore,
					0
				) / currentTrends.data.length;

			const previousAvgMood =
				previousTrends.data.reduce(
					(sum, trend) => sum + trend.averageMoodBefore,
					0
				) / previousTrends.data.length;

			const moodImprovement =
				((currentAvgMood - previousAvgMood) / previousAvgMood) * 100;

			// Анализируем изменения эмоций
			const emotionChanges = currentEmotions.data.map(currentEmotion => {
				const previousEmotion = previousEmotions.data.find(
					prev => prev.emotionId === currentEmotion.emotionId
				);

				const changePercent = previousEmotion
					? ((currentEmotion.percentage - previousEmotion.percentage) /
							previousEmotion.percentage) *
					  100
					: 100; // Если эмоции не было в предыдущем периоде

				return {
					emotion: currentEmotion.emotionName,
					changePercent: Number(changePercent.toFixed(1)),
				};
			});

			const comparison = {
				current: {
					trends: currentTrends.data,
					emotions: currentEmotions.data,
					insights: currentInsights.data,
				},
				previous: {
					trends: previousTrends.data,
					emotions: previousEmotions.data,
					insights: previousInsights.data,
				},
				comparison: {
					moodImprovement: Number(moodImprovement.toFixed(1)),
					emotionChanges,
				},
			};

			console.log('✅ Сравнение периодов получено');
			return comparison;
		} catch (error) {
			console.error('❌ Ошибка сравнения периодов:', error);
			throw error;
		}
	}
}

// Экспортируем singleton экземпляр
export const analyticsService = AnalyticsService.getInstance();
