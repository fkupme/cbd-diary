/**
 * Analytics Store
 * Управление состоянием аналитики с интеграцией API
 */

import { useAnalytics } from '@/composables/useApiIntegration';
import type {
	CognitiveInsight,
	EmotionStat,
	MoodTrend,
	UserStats,
} from '@/services/api/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useCBTStore } from './cbt';
import { useEmotionsStore } from './emotions';

export const useAnalyticsStore = defineStore('analytics', () => {
	// Используем композабл для API интеграции
	const analyticsApi = useAnalytics();

	// Другие stores для локальных вычислений
	const cbtStore = useCBTStore();
	const emotionsStore = useEmotionsStore();

	// Local state
	const localStats = ref<UserStats | null>(null);
	const localDashboard = ref<any>(null);
	const lastUpdateTime = ref<string | null>(null);
	const viewMode = ref<'week' | 'month' | 'year'>('week');
	const dateRange = ref<{ from: string | null; to: string | null }>({
		from: null,
		to: null,
	});

	// Getters (используем computed из композабла + локальные данные)
	const userStats = computed(() => {
		return analyticsApi.userStats.value || localStats.value;
	});

	const dashboard = computed(() => {
		return analyticsApi.dashboard.value || localDashboard.value;
	});

	const isLoading = computed(() => analyticsApi.isLoading.value);
	const error = computed(() => analyticsApi.error.value);

	// Local analytics computed from CBT entries
	const localAnalytics = computed(() => {
		const entries = cbtStore.entries;

		if (entries.length === 0) {
			return {
				totalEntries: 0,
				averageMoodBefore: 0,
				averageMoodAfter: 0,
				moodImprovement: 0,
				weeklyProgress: 0,
				monthlyProgress: 0,
				topEmotions: [],
				moodTrends: [],
				insights: [],
			};
		}

		// Calculate basic stats
		const totalEntries = entries.length;
		const averageMoodBefore =
			entries.reduce((sum, entry) => sum + entry.moodScoreBefore, 0) /
			totalEntries;
		const entriesWithAfter = entries.filter(
			entry => entry.moodScoreAfter !== null
		);
		const averageMoodAfter =
			entriesWithAfter.length > 0
				? entriesWithAfter.reduce(
						(sum, entry) => sum + (entry.moodScoreAfter || 0),
						0
				  ) / entriesWithAfter.length
				: 0;

		const moodImprovement =
			averageMoodBefore > 0
				? ((averageMoodAfter - averageMoodBefore) / averageMoodBefore) * 100
				: 0;

		// Weekly and monthly progress
		const now = new Date();
		const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const weeklyEntries = entries.filter(
			entry => new Date(entry.createdAt) >= weekAgo
		);
		const monthlyEntries = entries.filter(
			entry => new Date(entry.createdAt) >= monthAgo
		);

		const weeklyProgress = weeklyEntries.length;
		const monthlyProgress = monthlyEntries.length;

		// Top emotions analysis
		const emotionCounts: Record<number, number> = {};
		entries.forEach(entry => {
			entry.thoughts.forEach(thought => {
				thought.emotions.forEach(emotion => {
					emotionCounts[emotion.emotionId] =
						(emotionCounts[emotion.emotionId] || 0) + 1;
				});
			});
		});

		const topEmotions: EmotionStat[] = Object.entries(emotionCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([emotionId, count]) => {
				const emotion = emotionsStore.getEmotionById(Number(emotionId));
				return {
					emotionId: Number(emotionId),
					emotionName: emotion?.name || 'Unknown',
					count,
					percentage: (count / totalEntries) * 100,
				};
			});

		// Mood trends over time
		const moodTrends = generateMoodTrends(entries);

		// Basic insights
		const insights = generateBasicInsights(entries, {
			averageMoodBefore,
			averageMoodAfter,
			moodImprovement,
		});

		return {
			totalEntries,
			averageMoodBefore: Number(averageMoodBefore.toFixed(1)),
			averageMoodAfter: Number(averageMoodAfter.toFixed(1)),
			moodImprovement: Number(moodImprovement.toFixed(1)),
			weeklyProgress,
			monthlyProgress,
			topEmotions,
			moodTrends,
			insights,
		};
	});

	// Combined analytics: серверная статистика, если загрузилась, плюс
	// локальная агрегация — в РАЗНЫХ полях, чтобы форма не зависела от источника.
	const combinedStats = computed(() => ({
		server: userStats.value ?? null,
		local: localAnalytics.value,
	}));

	// Helper functions for local analytics
	const generateMoodTrends = (entries: any[]): MoodTrend[] => {
		const trends: Record<string, { before: number[]; after: number[] }> = {};

		entries.forEach(entry => {
			const date = new Date(entry.createdAt).toISOString().split('T')[0];
			if (!trends[date]) {
				trends[date] = { before: [], after: [] };
			}

			trends[date].before.push(entry.moodScoreBefore);
			if (entry.moodScoreAfter !== null) {
				trends[date].after.push(entry.moodScoreAfter);
			}
		});

		return Object.entries(trends)
			.map(([date, moods]) => ({
				date,
				averageMoodBefore:
					moods.before.reduce((sum, mood) => sum + mood, 0) /
					moods.before.length,
				averageMoodAfter:
					moods.after.length > 0
						? moods.after.reduce((sum, mood) => sum + mood, 0) /
						  moods.after.length
						: null,
				entryCount: moods.before.length,
			}))
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
			.slice(-30); // Last 30 days
	};

	const generateBasicInsights = (
		entries: any[],
		stats: any
	): CognitiveInsight[] => {
		const insights: CognitiveInsight[] = [];

		// Mood improvement insight
		if (stats.moodImprovement > 10) {
			insights.push({
				type: 'mood_improvement',
				title: 'Отличный прогресс!',
				description: `Ваше настроение улучшилось на ${stats.moodImprovement.toFixed(
					1
				)}% благодаря CBT практикам.`,
				confidence: 0.8,
				actionable: true,
				category: 'progress',
			});
		}

		// Consistency insight
		const now = new Date();
		const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const recentEntries = entries.filter(
			entry => new Date(entry.createdAt) >= weekAgo
		);

		if (recentEntries.length >= 5) {
			insights.push({
				type: 'consistency',
				title: 'Отличная регулярность!',
				description: `Вы ведете записи ${recentEntries.length} раз на этой неделе. Продолжайте в том же духе!`,
				confidence: 0.9,
				actionable: false,
				category: 'habits',
			});
		}

		// Low mood pattern insight
		const lowMoodEntries = entries.filter(entry => entry.moodScoreBefore <= 3);
		if (lowMoodEntries.length > entries.length * 0.3) {
			insights.push({
				type: 'mood_pattern',
				title: 'Обратите внимание на настроение',
				description:
					'Заметил, что часто настроение низкое. Попробуйте техники релаксации.',
				confidence: 0.7,
				actionable: true,
				category: 'wellbeing',
			});
		}

		return insights;
	};

	// Actions
	const loadUserStats = async () => {
		try {
			await analyticsApi.loadUserStats();

			// Обновляем локальный кэш
			if (analyticsApi.userStats.value) {
				localStats.value = analyticsApi.userStats.value;
				saveToLocalStorage();
			}

			lastUpdateTime.value = new Date().toISOString();
			console.log('✅ Статистика пользователя загружена');
		} catch (err) {
			console.error('❌ Ошибка загрузки статистики:', err);
			// При ошибке используем локальные данные
			throw err;
		}
	};

	const loadFullDashboard = async () => {
		try {
			await analyticsApi.loadFullDashboard();

			// Обновляем локальный кэш
			if (analyticsApi.dashboard.value) {
				localDashboard.value = analyticsApi.dashboard.value;
				saveToLocalStorage();
			}

			lastUpdateTime.value = new Date().toISOString();
			console.log('✅ Панель аналитики загружена');
		} catch (err) {
			console.error('❌ Ошибка загрузки панели аналитики:', err);
			throw err;
		}
	};

	const refreshStats = async () => {
		try {
			await analyticsApi.refreshStats();
			await loadUserStats();
			console.log('✅ Статистика обновлена');
		} catch (err) {
			console.error('❌ Ошибка обновления статистики:', err);
			throw err;
		}
	};

	// View controls
	const setViewMode = (mode: typeof viewMode.value) => {
		viewMode.value = mode;
	};

	const setDateRange = (from: string | null, to: string | null) => {
		dateRange.value = { from, to };
	};

	// Local storage management
	const saveToLocalStorage = () => {
		try {
			const data = {
				stats: localStats.value,
				dashboard: localDashboard.value,
				lastUpdateTime: lastUpdateTime.value,
				viewMode: viewMode.value,
				dateRange: dateRange.value,
			};
			localStorage.setItem('analytics-cache', JSON.stringify(data));
		} catch (err) {
			console.warn('Не удалось сохранить аналитику в localStorage:', err);
		}
	};

	const loadFromLocalStorage = () => {
		try {
			const stored = localStorage.getItem('analytics-cache');
			if (stored) {
				const data = JSON.parse(stored);
				localStats.value = data.stats || null;
				localDashboard.value = data.dashboard || null;
				lastUpdateTime.value = data.lastUpdateTime || null;
				viewMode.value = data.viewMode || 'week';
				dateRange.value = data.dateRange || { from: null, to: null };

				console.log('📱 Аналитика загружена из кэша');
			}
		} catch (err) {
			console.warn('Не удалось загрузить аналитику из localStorage:', err);
		}
	};

	const clearCache = () => {
		localStats.value = null;
		localDashboard.value = null;
		lastUpdateTime.value = null;

		try {
			localStorage.removeItem('analytics-cache');
		} catch (err) {
			console.warn('Не удалось очистить кэш аналитики:', err);
		}
	};

	// Computed analytics for different time periods
	const weeklyAnalytics = computed(() => {
		const now = new Date();
		const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const entries = cbtStore.entries.filter(
			entry => new Date(entry.createdAt) >= weekAgo
		);

		return {
			totalEntries: entries.length,
			averageMood:
				entries.length > 0
					? entries.reduce((sum, entry) => sum + entry.moodScoreBefore, 0) /
					  entries.length
					: 0,
			moodImprovement:
				entries.length > 0 && entries.some(e => e.moodScoreAfter)
					? calculateMoodImprovement(entries)
					: 0,
		};
	});

	const monthlyAnalytics = computed(() => {
		const now = new Date();
		const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		const entries = cbtStore.entries.filter(
			entry => new Date(entry.createdAt) >= monthAgo
		);

		return {
			totalEntries: entries.length,
			averageMood:
				entries.length > 0
					? entries.reduce((sum, entry) => sum + entry.moodScoreBefore, 0) /
					  entries.length
					: 0,
			moodImprovement:
				entries.length > 0 && entries.some(e => e.moodScoreAfter)
					? calculateMoodImprovement(entries)
					: 0,
		};
	});

	const calculateMoodImprovement = (entries: any[]): number => {
		const entriesWithAfter = entries.filter(
			entry => entry.moodScoreAfter !== null
		);
		if (entriesWithAfter.length === 0) return 0;

		const beforeAvg =
			entriesWithAfter.reduce((sum, entry) => sum + entry.moodScoreBefore, 0) /
			entriesWithAfter.length;
		const afterAvg =
			entriesWithAfter.reduce(
				(sum, entry) => sum + (entry.moodScoreAfter || 0),
				0
			) / entriesWithAfter.length;

		return beforeAvg > 0 ? ((afterAvg - beforeAvg) / beforeAvg) * 100 : 0;
	};

	// Export functionality
	const exportStats = async (format: 'json' | 'csv' = 'json') => {
		try {
			const stats = {
				userStats: combinedStats.value,
				localAnalytics: localAnalytics.value,
				entries: cbtStore.entries,
				emotions: emotionsStore.emotions,
				exportedAt: new Date().toISOString(),
			};

			if (format === 'json') {
				return JSON.stringify(stats, null, 2);
			} else {
				// Convert to CSV (simplified)
				const csvData = cbtStore.entries.map(entry => ({
					date: entry.createdAt,
					situation: entry.situation,
					moodBefore: entry.moodScoreBefore,
					moodAfter: entry.moodScoreAfter || '',
					tags: entry.tags.join(';'),
				}));

				const headers = Object.keys(csvData[0] || {});
				const csvContent = [
					headers.join(','),
					...csvData.map(row =>
						headers
							.map(header => `"${row[header as keyof typeof row]}"`)
							.join(',')
					),
				].join('\n');

				return csvContent;
			}
		} catch (err) {
			console.error('Ошибка экспорта статистики:', err);
			throw err;
		}
	};

	// Инициализация
	const initialize = async () => {
		try {
			// Загружаем данные из localStorage для быстрого старта
			loadFromLocalStorage();

			// Затем загружаем свежие данные из API
			await loadUserStats();

			console.log('✅ Analytics store инициализирован');
		} catch (err) {
			console.error('❌ Ошибка инициализации analytics store:', err);
			// При ошибке остаемся с кэшированными/локальными данными
		}
	};

	return {
		// State
		userStats,
		dashboard,
		combinedStats,
		localAnalytics,
		isLoading,
		error,
		lastUpdateTime: computed(() => lastUpdateTime.value),
		viewMode: computed(() => viewMode.value),
		dateRange: computed(() => dateRange.value),

		// Time-based analytics
		weeklyAnalytics,
		monthlyAnalytics,

		// Actions - Data Loading
		loadUserStats,
		loadFullDashboard,
		refreshStats,

		// Actions - View Controls
		setViewMode,
		setDateRange,

		// Actions - Cache Management
		clearCache,

		// Actions - Export
		exportStats,

		// Actions - Initialization
		initialize,
	};
});

// Экспортируем типы для использования в других местах
export type AnalyticsStore = ReturnType<typeof useAnalyticsStore>;
