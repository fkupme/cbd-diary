<template>
	<div class="analytics-page">
		<div class="analytics-container">
			<h1 class="page-title">{{ t("analytics.title", "Аналитика") }}</h1>

			<!-- Переключатель периодов -->
			<div class="tabs">
				<q-btn-toggle
					v-model="activeTab"
					:options="tabs"
					color="primary"
					text-color="white"
					unelevated
					rounded
					size="sm"
				/>
			</div>

			<!-- Статистика за период -->
			<div class="stats-section">
				<h2 class="section-title">
					{{ t("analytics.periodStats", "Статистика за период") }}
				</h2>
				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-value">{{ periodStats.totalEntries }}</div>
						<div class="stat-label">
							{{ t("analytics.entries", "Записей") }}
						</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">{{ periodStats.avgMood.toFixed(1) }}</div>
						<div class="stat-label">
							{{ t("analytics.avgScore", "Средний балл") }}
						</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">{{ periodStats.topEmotionEmoji }}</div>
						<div class="stat-label">
							{{ t("analytics.topEmotion", "Топ эмоция") }}
						</div>
					</div>
				</div>
			</div>

			<!-- График записей по дням -->
			<div class="mood-chart">
				<h2 class="section-title">
					{{ t("analytics.entriesTimeline", "Активность по дням") }}
				</h2>
				<div class="chart-placeholder" style="height: 220px">
					<canvas ref="lineCanvas"></canvas>
				</div>
			</div>

			<!-- Разнообразие категорий эмоций -->
			<div class="diversity-section">
				<h2 class="section-title">
					{{
						t("analytics.categoryDiversity", "Разнообразие категорий эмоций")
					}}
				</h2>
				<div class="diversity-grid" v-if="diversity">
					<div class="diversity-card">
						<div class="metric-value">{{ diversity.uniqueCategories }}</div>
						<div class="metric-label">
							{{ t("analytics.uniqueCategories", "Уникальных категорий") }}
						</div>
					</div>
					<div class="diversity-card">
						<div class="metric-value">{{ diversity.shannon.toFixed(2) }}</div>
						<div class="metric-label">Shannon</div>
					</div>
					<div class="diversity-card">
						<div class="metric-value">{{ diversity.simpson.toFixed(2) }}</div>
						<div class="metric-label">Simpson</div>
					</div>
					<div class="diversity-card">
						<div class="metric-value">{{ diversity.evenness.toFixed(2) }}</div>
						<div class="metric-label">
							{{ t("analytics.evenness", "Равномерность") }}
						</div>
					</div>
				</div>
				<div
					v-if="diversity && diversity.distribution.length"
					class="diversity-chart"
				>
					<div class="chart-placeholder" style="height: 220px; width: 220px">
						<canvas ref="doughnutCanvas"></canvas>
					</div>
					<ul class="legend">
						<li
							v-for="(d, i) in diversity.distribution"
							:key="`leg-${d.categoryId}`"
						>
							<span
								class="swatch"
								:style="{
									background: colorForIndex(i, diversity.distribution.length),
								}"
							></span>
							<span class="name">{{ t(d.categoryName, d.categoryName) }}</span>
							<span class="pct">{{ d.percentage.toFixed(1) }}%</span>
						</li>
					</ul>
				</div>
			</div>

			<!-- Анализ эмоций из бэка -->
			<div class="emotions-analysis">
				<h2 class="section-title">
					{{ t("analytics.emotionsAnalysis", "Анализ эмоций") }}
				</h2>
				<div class="emotions-list">
					<div
						v-for="emotion in emotionsFromSummary"
						:key="emotion.emotionId"
						class="emotion-item"
					>
						<div class="emotion-info">
							<span class="emotion-emoji">{{ emotion.emoji || "😐" }}</span>
							<span class="emotion-name">{{
								t(emotion.emotionName, emotion.emotionName)
							}}</span>
						</div>
						<div class="emotion-stats">
							<div class="emotion-count">
								{{ emotion.count }} {{ t("analytics.times", "раз") }} ·
								{{ emotion.percentage.toFixed(1) }}%
							</div>
							<div class="emotion-bar">
								<div
									class="emotion-bar-fill"
									:style="{ width: emotion.percentage + '%' }"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Сравнение разнообразия по периодам -->
			<div class="diversity-compare" v-if="diversitySeries.length">
				<h2 class="section-title">
					{{ t("analytics.diversityCompare", "Разнообразие по периодам") }}
				</h2>
				<div class="chart-placeholder" style="height: 220px">
					<canvas ref="diversityCompareCanvas"></canvas>
				</div>
			</div>

			<!-- Инсайты -->
			<div class="insights-section">
				<h2 class="section-title">{{ t("analytics.insights", "Инсайты") }}</h2>
				<div class="insights-list">
					<div
						v-for="insight in insights"
						:key="insight.id"
						class="insight-card"
					>
						<div class="insight-icon">{{ insight.icon }}</div>
						<div class="insight-content">
							<h3 class="insight-title">{{ insight.title }}</h3>
							<p class="insight-text">{{ insight.text }}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Chart, registerables } from "chart.js";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useLocalization } from "../composables/useLocalization";
import { analyticsService } from "../services/api/AnalyticsService";
import { useCBTStore } from "../stores/cbt";
import { useEmotionsStore } from "../stores/emotions";
Chart.register(...registerables);

// Stores
const cbtStore = useCBTStore();
const emotionsStore = useEmotionsStore();

const { t } = useLocalization();

// Tabs
const tabs = [
	{ label: t("analytics.today", "Сегодня"), value: "today" },
	{ label: t("analytics.week", "Неделя"), value: "week" },
	{ label: t("analytics.month", "Месяц"), value: "month" },
	{ label: t("analytics.quarter", "3 месяца"), value: "quarter" },
	{ label: t("analytics.year", "Год"), value: "year" },
];
const activeTab = ref<string>("month");

const summary = ref<any>(null);
const diversityWeek = ref<any>(null);
const diversityMonth = ref<any>(null);
const diversityQuarter = ref<any>(null);
const diversityYear = ref<any>(null);

const periodStats = computed(() => {
	const totalEntries = summary.value?.userStats?.totalEntries || 0;
	const avgMood = summary.value?.userStats?.avgMoodScore || 0;
	const topEmotionId = summary.value?.userStats?.mostCommonEmotionId;
	const topEmotionEmoji = topEmotionId
		? emotionsStore.getEmotionById(topEmotionId)?.emoji || "😐"
		: "😐";
	return { totalEntries, avgMood, topEmotionEmoji };
});

const emotionsFromSummary = computed(() => {
	return (summary.value?.emotionAnalytics || []).slice(0, 8);
});

const diversity = computed(() => summary.value?.categoryDiversity ?? null);
const timelinePoints = computed(() => summary.value?.entriesTimeline ?? []);

// Простые инсайты из сводки бэка
const insights = computed(() => {
	const list: Array<{
		id: string;
		icon: string;
		title: string;
		text: string;
	}> = [];
	const s = summary.value;
	if (!s) return list;

	const improvement = s.moodTrends?.overallTrend?.improvement;
	if (typeof improvement === "number" && improvement > 0) {
		list.push({
			id: "mood-improvement",
			icon: "📈",
			title: t("analytics.insightMoodTitle", "Записи помогают"),
			text: t(
				"analytics.insightMoodText",
				`После работы с записью настроение в среднем выше на ${improvement.toFixed(
					1
				)} балла`
			),
		});
	}

	const consistency = s.progressReport?.keyMetrics?.consistency;
	if (typeof consistency === "number" && consistency >= 50) {
		list.push({
			id: "consistency",
			icon: "🔥",
			title: t("analytics.insightConsistencyTitle", "Хорошая регулярность"),
			text: t(
				"analytics.insightConsistencyText",
				"Вы стабильно ведёте дневник — это усиливает эффект КПТ"
			),
		});
	}

	const awareness = s.progressReport?.keyMetrics?.emotionalAwareness;
	if (typeof awareness === "number" && awareness >= 40) {
		list.push({
			id: "awareness",
			icon: "🎯",
			title: t("analytics.insightAwarenessTitle", "Растёт осознанность"),
			text: t(
				"analytics.insightAwarenessText",
				"Вы различаете всё больше оттенков эмоций в своих записях"
			),
		});
	}

	return list;
});

// Chart.js: Line for activity
const lineCanvas = ref<HTMLCanvasElement | null>(null);
let lineChart: Chart | null = null;
function renderLine() {
	if (!lineCanvas.value) return;
	const labels = timelinePoints.value.map((p: any) => p.date.slice(5));
	const data = timelinePoints.value.map((p: any) => p.entriesCount);
	if (lineChart) lineChart.destroy();
	lineChart = new Chart(lineCanvas.value.getContext("2d") as any, {
		type: "line",
		data: {
			labels,
			datasets: [
				{
					label: "Записей",
					data,
					borderColor:
						getComputedStyle(document.documentElement).getPropertyValue(
							"--primary"
						) || "#4f46e5",
					tension: 0.25,
					pointRadius: 0,
				},
			],
		},
		options: {
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { color: "rgba(255,255,255,0.08)" } },
				y: {
					grid: { color: "rgba(255,255,255,0.08)" },
					ticks: { precision: 0 },
				},
			},
			maintainAspectRatio: false,
		},
	});
}

// Chart.js: Doughnut for categories
const doughnutCanvas = ref<HTMLCanvasElement | null>(null);
let doughnutChart: Chart | null = null;
function renderDoughnut() {
	if (!doughnutCanvas.value) return;
	const dist = diversity.value?.distribution || [];
	const labels = dist.map((d: any) => d.categoryName);
	const data = dist.map((d: any) => d.percentage);
	const colors = dist.map((_: any, i: number) => colorForIndex(i, dist.length));
	if (doughnutChart) doughnutChart.destroy();
	doughnutChart = new Chart(doughnutCanvas.value.getContext("2d") as any, {
		type: "doughnut",
		data: {
			labels,
			datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
		},
		options: {
			plugins: { legend: { position: "right" } },
			cutout: "60%",
			maintainAspectRatio: false,
		},
	});
}

// Diversity compare chart
const diversityCompareCanvas = ref<HTMLCanvasElement | null>(null);
let diversityCompareChart: Chart | null = null;
const diversitySeries = computed(() => {
	const items: Array<{ label: string; value: number }> = [];
	if (diversityWeek.value)
		items.push({
			label: t("analytics.week", "Неделя"),
			value: diversityWeek.value.shannon,
		});
	if (diversityMonth.value)
		items.push({
			label: t("analytics.month", "Месяц"),
			value: diversityMonth.value.shannon,
		});
	if (diversityQuarter.value)
		items.push({
			label: t("analytics.quarter", "3 месяца"),
			value: diversityQuarter.value.shannon,
		});
	if (diversityYear.value)
		items.push({
			label: t("analytics.year", "Год"),
			value: diversityYear.value.shannon,
		});
	return items;
});
function renderDiversityCompare() {
	if (!diversityCompareCanvas.value || !diversitySeries.value.length) return;
	const labels = diversitySeries.value.map((i) => i.label);
	const data = diversitySeries.value.map((i) => i.value);
	if (diversityCompareChart) diversityCompareChart.destroy();
	diversityCompareChart = new Chart(
		diversityCompareCanvas.value.getContext("2d") as any,
		{
			type: "bar",
			data: {
				labels,
				datasets: [
					{
						label: "Shannon",
						data,
						backgroundColor: labels.map((_, i) =>
							colorForIndex(i, labels.length)
						),
					},
				],
			},
			options: {
				plugins: { legend: { display: false } },
				scales: {
					y: { beginAtZero: true },
				},
				maintainAspectRatio: false,
			},
		}
	);
}

function colorForIndex(i: number, n: number): string {
	const hue = Math.round((360 * i) / Math.max(1, n));
	return `hsl(${hue}, 70%, 55%)`;
}

// Loaders
async function loadSummaryForTab() {
	const params = buildQueryByTab(activeTab.value);
	const resp = await analyticsService.getAnalyticsSummary(params);
	if ((resp as any)?.success) summary.value = (resp as any).data;
	await nextTick();
	renderLine();
	renderDoughnut();
	renderDiversityCompare();
}

async function loadDiversityComparisons() {
	// подгружаем отдельные сводки для разных периодов и сохраняем только блок разнообразия
	const [w, m, q, y] = await Promise.all([
		analyticsService.getAnalyticsSummary({ timeRange: "week" }),
		analyticsService.getAnalyticsSummary({ timeRange: "month" }),
		analyticsService.getAnalyticsSummary({ timeRange: "quarter" }),
		analyticsService.getAnalyticsSummary({ timeRange: "year" }),
	]);
	diversityWeek.value = w.success ? w.data.categoryDiversity : null;
	diversityMonth.value = m.success ? m.data.categoryDiversity : null;
	diversityQuarter.value = q.success ? q.data.categoryDiversity : null;
	diversityYear.value = y.success ? y.data.categoryDiversity : null;
	await nextTick();
	renderDiversityCompare();
}

async function loadAll() {
	await Promise.all([cbtStore.loadEntries(), emotionsStore.loadAll()]);
	await Promise.all([loadSummaryForTab(), loadDiversityComparisons()]);
}

watch(activeTab, async () => {
	await loadSummaryForTab();
});

onMounted(() => {
	loadAll().catch((e) => console.error("Ошибка загрузки аналитики", e));
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) {
			loadAll();
		}
	});
});

function buildQueryByTab(tab: string): {
	timeRange?: "week" | "month" | "quarter" | "year" | "custom";
	startDate?: string;
	endDate?: string;
} {
	if (tab === "today") {
		const d = new Date();
		const iso = d.toISOString().slice(0, 10);
		return { timeRange: "custom", startDate: iso, endDate: iso };
	}
	if (tab === "week") return { timeRange: "week" };
	if (tab === "month") return { timeRange: "month" };
	if (tab === "quarter") return { timeRange: "quarter" };
	if (tab === "year") return { timeRange: "year" };
	return { timeRange: "month" };
}
</script>

<style scoped>
/* Tabs */
.tabs {
	display: flex;
	gap: 8px;
	margin-bottom: var(--space-4);
}
.tab-btn {
	padding: 6px 10px;
	border-radius: 8px;
	border: 1px solid var(--border-color);
	background: var(--bg-secondary);
	color: var(--text-primary);
	font-size: 12px;
}
.tab-btn.active {
	background: var(--primary);
	border-color: var(--primary);
	color: white;
}

.analytics-page {
	min-height: 100vh;
	background: var(--bg-secondary);
	padding-bottom: 80px;
	transition: background-color var(--transition-base) var(--ease-in-out);
}

.analytics-container {
	max-width: 500px;
	margin: 0 auto;
	padding: var(--space-4);
}

.section-title {
	font-size: var(--text-xl);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	margin-bottom: var(--space-4);
}

.stats-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--space-3);
}
.stat-card {
	background: var(--bg-secondary);
	border-radius: var(--radius-base);
	padding: var(--space-4);
	text-align: center;
	border: 1px solid var(--border-color);
}
.stat-value {
	font-size: var(--text-3xl);
	font-weight: var(--font-bold);
	color: var(--primary);
	margin-bottom: var(--space-1);
}
.stat-label {
	font-size: var(--text-sm);
	color: var(--text-secondary);
}

.chart-placeholder {
	height: 180px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bg-secondary);
	border-radius: var(--radius-base);
	border: 1px dashed var(--border-color);
}

.diversity-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--space-3);
	margin-bottom: var(--space-3);
}
.diversity-card,
.ai-card {
	background: var(--bg-secondary);
	border-radius: var(--radius-base);
	padding: var(--space-4);
	border: 1px solid var(--border-color);
	text-align: center;
}
.metric-value {
	font-size: var(--text-2xl);
	font-weight: var(--font-bold);
	color: var(--primary);
}
.metric-label {
	font-size: var(--text-xs);
	color: var(--text-secondary);
}

.diversity-chart {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: var(--space-4);
	align-items: center;
}
.pie {
	display: block;
}
.legend {
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 0;
	margin: 0;
}
.legend li {
	display: grid;
	grid-template-columns: 16px 1fr auto;
	gap: 8px;
	align-items: center;
}
.legend .swatch {
	width: 16px;
	height: 16px;
	border-radius: 4px;
	border: 1px solid var(--border-color);
}
.legend .name {
	color: var(--text-primary);
	font-size: var(--text-sm);
}
.legend .pct {
	color: var(--text-secondary);
	font-size: var(--text-sm);
}

.ai-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--space-3);
}

.emotions-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
.emotion-item {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3);
	background: var(--bg-secondary);
	border-radius: var(--radius-base);
	border: 1px solid var(--border-color);
}
.emotion-emoji {
	font-size: 24px;
	min-width: 32px;
	text-align: center;
}
.emotion-name {
	font-weight: var(--font-medium);
	color: var(--text-primary);
}
.emotion-bar {
	width: 120px;
	height: 6px;
	background: var(--bg-tertiary);
	border-radius: var(--radius-full);
	overflow: hidden;
}
.emotion-bar-fill {
	height: 100%;
	background: var(--primary);
}

.insights-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
.insight-card {
	display: flex;
	gap: var(--space-3);
	background: var(--bg-secondary);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-base);
	padding: var(--space-3);
}
.insight-icon {
	font-size: 20px;
}
.insight-title {
	color: var(--text-primary);
	font-weight: var(--font-semibold);
}
.insight-text {
	color: var(--text-secondary);
}
</style> 