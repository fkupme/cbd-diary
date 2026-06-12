<template>
	<div class="analytics-page diary-theme">
		<div class="analytics-inner">
			<header class="analytics-head">
				<h1 class="analytics-title">{{ t("analytics.title", "Аналитика") }}</h1>
			</header>

			<!-- Переключатель периодов -->
			<div class="period-row">
				<button
					v-for="tab in tabs"
					:key="tab.value"
					class="period-chip"
					:class="{ active: activeTab === tab.value }"
					@click="activeTab = tab.value"
				>
					{{ tab.label }}
				</button>
			</div>

			<!-- Статистика за период -->
			<section class="block">
				<h2 class="block-label">
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
						<div class="stat-value stat-top">
							<i
								class="stat-dot"
								:style="{ background: periodStats.topEmotionColor }"
							></i>
							<span class="stat-top-name">{{ periodStats.topEmotionName }}</span>
						</div>
						<div class="stat-label">
							{{ t("analytics.topEmotion", "Топ эмоция") }}
						</div>
					</div>
				</div>
			</section>

			<!-- График записей по дням -->
			<section class="block">
				<h2 class="block-label">
					{{ t("analytics.entriesTimeline", "Активность по дням") }}
				</h2>
				<div class="chart-card" style="height: 220px">
					<canvas ref="lineCanvas"></canvas>
				</div>
			</section>

			<!-- Разнообразие категорий эмоций -->
			<section class="block" v-if="diversity">
				<h2 class="block-label">
					{{ t("analytics.categoryDiversity", "Разнообразие категорий эмоций") }}
				</h2>
				<div class="diversity-grid">
					<div class="metric-card">
						<div class="metric-value">{{ diversity.uniqueCategories }}</div>
						<div class="metric-label">
							{{ t("analytics.uniqueCategories", "Уникальных категорий") }}
						</div>
					</div>
					<div class="metric-card">
						<div class="metric-value">{{ diversity.shannon.toFixed(2) }}</div>
						<div class="metric-label">Shannon</div>
					</div>
					<div class="metric-card">
						<div class="metric-value">{{ diversity.simpson.toFixed(2) }}</div>
						<div class="metric-label">Simpson</div>
					</div>
					<div class="metric-card">
						<div class="metric-value">{{ diversity.evenness.toFixed(2) }}</div>
						<div class="metric-label">
							{{ t("analytics.evenness", "Равномерность") }}
						</div>
					</div>
				</div>
				<div
					v-if="diversity.distribution.length"
					class="chart-card diversity-chart"
				>
					<div class="doughnut-wrap">
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
									background: categoryHex(d.categoryId, i, diversity.distribution.length),
								}"
							></span>
							<span class="name">{{ t(d.categoryName, d.categoryName) }}</span>
							<span class="pct">{{ d.percentage.toFixed(1) }}%</span>
						</li>
					</ul>
				</div>
			</section>

			<!-- Анализ эмоций из бэка -->
			<section class="block" v-if="emotionsFromSummary.length">
				<h2 class="block-label">
					{{ t("analytics.emotionsAnalysis", "Анализ эмоций") }}
				</h2>
				<div class="emotions-list">
					<div
						v-for="emotion in emotionsFromSummary"
						:key="emotion.emotionId"
						class="emotion-item"
					>
						<div class="emotion-info">
							<i
								class="emotion-dot"
								:style="{ background: emotionColor(emotion.emotionId) }"
							></i>
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
			</section>

			<!-- Сравнение разнообразия по периодам -->
			<section class="block" v-if="diversitySeries.length">
				<h2 class="block-label">
					{{ t("analytics.diversityCompare", "Разнообразие по периодам") }}
				</h2>
				<div class="chart-card" style="height: 220px">
					<canvas ref="diversityCompareCanvas"></canvas>
				</div>
			</section>

			<!-- Инсайты -->
			<section class="block" v-if="insights.length">
				<h2 class="block-label">{{ t("analytics.insights", "Инсайты") }}</h2>
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
			</section>
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

// Палитра «вечернего дневника» для графиков
const LAMP = "#f0b264";
const LAMP_SOFT = "rgba(240, 178, 100, 0.18)";
const GRID = "rgba(237, 230, 214, 0.07)";
const TICK = "#97907e";

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
	const em = topEmotionId ? emotionsStore.getEmotionById(topEmotionId) : null;
	const topEmotionName = em
		? (t(
				(em as any).nameKey || (em as any).name_key,
				(em as any).name || ""
		  ) as string) || "—"
		: "—";
	const topEmotionColor = topEmotionId
		? emotionColor(topEmotionId)
		: "var(--paper-dim)";
	return { totalEntries, avgMood, topEmotionName, topEmotionColor };
});

// Цвет категории конкретной эмоции (для точек вместо смайликов)
function emotionColor(emotionId: number): string {
	const em = emotionsStore.getEmotionById(emotionId) as any;
	if (!em) return "var(--lamp)";
	return categoryHex(em.categoryId ?? em.category_id, 0, 1);
}

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
					borderColor: LAMP,
					backgroundColor: LAMP_SOFT,
					fill: true,
					tension: 0.3,
					pointRadius: 0,
					borderWidth: 2,
				},
			],
		},
		options: {
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { color: GRID }, ticks: { color: TICK } },
				y: {
					grid: { color: GRID },
					ticks: { precision: 0, color: TICK },
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
	const colors = dist.map((d: any, i: number) =>
		categoryHex(d.categoryId, i, dist.length)
	);
	if (doughnutChart) doughnutChart.destroy();
	doughnutChart = new Chart(doughnutCanvas.value.getContext("2d") as any, {
		type: "doughnut",
		data: {
			labels,
			datasets: [
				{
					data,
					backgroundColor: colors,
					borderWidth: 2,
					borderColor: "#161a24",
				},
			],
		},
		options: {
			plugins: { legend: { display: false } },
			cutout: "62%",
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
						borderRadius: 6,
					},
				],
			},
			options: {
				plugins: { legend: { display: false } },
				scales: {
					x: { grid: { color: GRID }, ticks: { color: TICK } },
					y: {
						beginAtZero: true,
						grid: { color: GRID },
						ticks: { color: TICK },
					},
				},
				maintainAspectRatio: false,
			},
		}
	);
}

// Янтарные оттенки для столбцов сравнения периодов
function colorForIndex(i: number, n: number): string {
	const lightness = 68 - (28 * i) / Math.max(1, n - 1 || 1);
	return `hsl(36, 78%, ${lightness}%)`;
}

// Реальный цвет категории эмоций (красный гнев, синяя грусть…), fallback — янтарный оттенок
function categoryHex(
	categoryId: number,
	fallbackIndex = 0,
	total = 1
): string {
	const cat = emotionsStore.getCategoryById(categoryId) as any;
	return cat?.color || colorForIndex(fallbackIndex, total);
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
.analytics-page {
	padding-bottom: 96px;
}

.analytics-inner {
	width: 100%;
	max-width: 440px;
	margin: 0 auto;
	padding: max(6dvh, 36px) 24px 24px;
}

/* ===== Шапка ===== */
.analytics-head {
	margin-bottom: 18px;
	animation: rise 0.5s ease-out both;
}
.analytics-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: clamp(30px, 9vw, 38px);
	letter-spacing: -0.015em;
	margin: 0;
}

/* ===== Период ===== */
.period-row {
	display: flex;
	gap: 7px;
	margin-bottom: 26px;
	overflow-x: auto;
	scrollbar-width: none;
	animation: rise 0.5s ease-out 0.05s both;
}
.period-row::-webkit-scrollbar {
	display: none;
}
.period-chip {
	flex: 0 0 auto;
	appearance: none;
	border: 1px solid var(--line);
	background: transparent;
	color: var(--paper-dim);
	font-family: inherit;
	font-size: 13.5px;
	padding: 7px 14px;
	border-radius: 999px;
	cursor: pointer;
	white-space: nowrap;
	transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.period-chip:hover {
	color: var(--paper);
}
.period-chip.active {
	color: var(--lamp);
	border-color: rgba(240, 178, 100, 0.55);
	background: rgba(240, 178, 100, 0.08);
}

/* ===== Блоки ===== */
.block {
	margin-bottom: 28px;
	animation: rise 0.5s ease-out 0.1s both;
}
.block-label {
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--paper-dim);
	margin: 0 0 12px 2px;
}

/* ===== Статистика ===== */
.stats-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 10px;
}
.stat-card {
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 14px;
	padding: 16px 10px;
	text-align: center;
}
.stat-value {
	font-family: "Spectral", Georgia, serif;
	font-size: 28px;
	font-weight: 500;
	color: var(--lamp);
	margin-bottom: 4px;
	line-height: 1.1;
}
.stat-value.stat-top {
	font-family: "Spectral", Georgia, serif;
	font-size: 15px;
	font-weight: 500;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 7px;
	min-height: 31px;
	padding: 0 2px;
}
.stat-dot {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	flex-shrink: 0;
}
.stat-top-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--paper);
}
.stat-label {
	font-size: 11.5px;
	color: var(--paper-dim);
}

/* ===== Карточки графиков ===== */
.chart-card {
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 16px;
	padding: 14px;
}

/* ===== Метрики разнообразия ===== */
.diversity-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 10px;
	margin-bottom: 12px;
}
.metric-card {
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 14px;
	padding: 14px;
	text-align: center;
}
.metric-value {
	font-family: "Spectral", Georgia, serif;
	font-size: 24px;
	font-weight: 500;
	color: var(--lamp);
}
.metric-label {
	font-size: 11px;
	color: var(--paper-dim);
	margin-top: 2px;
}

.diversity-chart {
	display: grid;
	grid-template-columns: 150px 1fr;
	gap: 16px;
	align-items: center;
}
.doughnut-wrap {
	position: relative;
	width: 150px;
	height: 150px;
}
.legend {
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 9px;
	padding: 0;
	margin: 0;
}
.legend li {
	display: grid;
	grid-template-columns: 12px 1fr auto;
	gap: 8px;
	align-items: center;
}
.legend .swatch {
	width: 12px;
	height: 12px;
	border-radius: 4px;
}
.legend .name {
	color: var(--paper);
	font-size: 13px;
}
.legend .pct {
	color: var(--paper-dim);
	font-size: 12.5px;
}

/* ===== Эмоции ===== */
.emotions-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.emotion-item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 14px;
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 13px;
}
.emotion-info {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 120px;
}
.emotion-dot {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	flex-shrink: 0;
	margin: 0 4px;
}
.emotion-name {
	font-size: 14px;
	color: var(--paper);
}
.emotion-stats {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 5px;
	align-items: flex-end;
}
.emotion-count {
	font-size: 12px;
	color: var(--paper-dim);
}
.emotion-bar {
	width: 100%;
	height: 5px;
	background: rgba(237, 230, 214, 0.1);
	border-radius: 999px;
	overflow: hidden;
}
.emotion-bar-fill {
	height: 100%;
	background: var(--lamp);
	border-radius: 999px;
}

/* ===== Инсайты ===== */
.insights-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.insight-card {
	display: flex;
	gap: 12px;
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 14px;
	padding: 14px;
}
.insight-icon {
	font-size: 22px;
	flex-shrink: 0;
}
.insight-title {
	color: var(--paper);
	font-weight: 600;
	font-size: 14.5px;
	margin: 0 0 3px;
}
.insight-text {
	color: var(--paper-dim);
	font-size: 13.5px;
	line-height: 1.45;
	margin: 0;
}

@keyframes rise {
	from {
		opacity: 0;
		transform: translateY(12px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.analytics-head,
	.period-row,
	.block {
		animation: none;
	}
}
</style> 