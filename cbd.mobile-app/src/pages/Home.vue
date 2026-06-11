<template>
	<div class="home-page">
		<div class="home-container">
			<!-- Header -->
			<div class="home-header">
				<div class="greeting">
					<h1 class="greeting-title">{{ greeting }}</h1>
					<p class="greeting-subtitle">{{ currentDate }}</p>
				</div>
				<q-btn
					class="profile-btn"
					@click="goToProfile"
					round
					flat
					icon="account_circle"
				/>
			</div>

			<!-- Hero Section -->
			<div class="hero-section">
				<div class="hero-card">
					<div class="hero-content">
						<h2 class="hero-title">
							{{
								t("home.heroTitle", "Начните отслеживать свои мысли и эмоции")
							}}
						</h2>
						<p class="hero-description">
							{{
								t(
									"home.heroDescription",
									"Используйте методы КПТ для лучшего понимания себя"
								)
							}}
						</p>
					</div>
					<CbdButton
						variant="primary"
						size="lg"
						icon="add"
						class="hero-cta"
						@click="$router.push('/add-entry')"
					>
						{{ t("home.addEntry", "Новая запись") }}
					</CbdButton>
				</div>
			</div>

			<!-- Statistics Overview -->
			<div class="stats-overview" v-if="hasEntries">
				<h2 class="section-title">
					{{ t("home.yourStatistics", "Ваша статистика") }}
				</h2>
				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-icon">
							<q-icon name="book" />
						</div>
						<div class="stat-content">
							<div class="stat-value">{{ totalEntries }}</div>
							<div class="stat-label">
								{{ t("home.totalEntries", "Всего записей") }}
							</div>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon">
							<q-icon name="calendar_today" />
						</div>
						<div class="stat-content">
							<div class="stat-value">{{ currentStreak }}</div>
							<div class="stat-label">
								{{ t("home.daysInRow", "Дней подряд") }}
							</div>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon">
							<q-icon name="trending_up" />
						</div>
						<div class="stat-content">
							<div class="stat-value">{{ weeklyProgress }}%</div>
							<div class="stat-label">
								{{ t("home.weekProgress", "Прогресс недели") }}
							</div>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon">
							<q-icon name="psychology" />
						</div>
						<div class="stat-content">
							<div class="stat-value">{{ mostFrequentEmotion }}</div>
							<div class="stat-label">
								{{ t("home.frequentEmotion", "Частая эмоция") }}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Recent Entries -->
			<div class="recent-entries" v-if="recentEntries.length > 0">
				<div class="section-header">
					<h2 class="section-title">
						{{ t("home.recentEntries", "Последние записи") }}
					</h2>
					<q-btn
						class="see-all-btn"
						flat
						@click="$router.push('/diary')"
						icon-right="arrow_forward"
					>
						{{ t("home.seeAll", "Все записи") }}
					</q-btn>
				</div>

				<div class="entries-preview">
					<div
						v-for="entry in recentEntries"
						:key="entry.id"
						class="entry-preview-card"
						@click="$router.push(`/diary?entry=${entry.id}`)"
					>
						<div class="entry-preview-header">
							<div class="entry-preview-time">
								{{ formatTime(entry.createdAt) }}
							</div>
							<div class="entry-preview-emotions">
								<span
									v-for="emotion in getEntryEmotions(entry).slice(0, 3)"
									:key="emotion.id"
									class="emotion-badge"
									:style="{ background: getEmotionColor(emotion.id) }"
								>
									{{ emotion.name }}
								</span>
							</div>
						</div>
						<p class="entry-preview-text">{{ getEntryPreview(entry) }}</p>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="quick-actions">
				<h2 class="section-title">
					{{ t("home.quickActions", "Быстрые действия") }}
				</h2>
				<div class="actions-grid">
					<q-card
						class="action-card"
						clickable
						@click="$router.push('/analytics')"
					>
						<div class="action-icon-wrapper analytics">
							<q-icon name="analytics" />
						</div>
						<span class="action-label">{{
							t("home.actions.analytics", "Аналитика")
						}}</span>
						<p class="action-description">
							{{ t("home.actions.analyticsDesc", "Изучите паттерны эмоций") }}
						</p>
					</q-card>

					<q-card class="action-card" clickable @click="startBreathingExercise">
						<div class="action-icon-wrapper breathing">
							<q-icon name="air" />
						</div>
						<span class="action-label">{{
							t("home.actions.breathing", "Дыхание")
						}}</span>
						<p class="action-description">
							{{ t("home.actions.breathingDesc", "Упражнение 4-7-8") }}
						</p>
					</q-card>

					<q-card
						class="action-card"
						clickable
						@click="$router.push('/resources')"
					>
						<div class="action-icon-wrapper resources">
							<q-icon name="school" />
						</div>
						<span class="action-label">{{
							t("home.actions.resources", "Обучение")
						}}</span>
						<p class="action-description">
							{{ t("home.actions.resourcesDesc", "Методы КПТ") }}
						</p>
					</q-card>

					<q-card
						class="action-card"
						clickable
						@click="$router.push('/settings')"
					>
						<div class="action-icon-wrapper settings">
							<q-icon name="settings" />
						</div>
						<span class="action-label">{{
							t("home.actions.settings", "Настройки")
						}}</span>
						<p class="action-description">
							{{ t("home.actions.settingsDesc", "Персонализация") }}
						</p>
					</q-card>
				</div>
			</div>

			<!-- Daily Tip -->
			<div class="daily-tip" v-if="dailyTip">
				<div class="tip-icon">💡</div>
				<div class="tip-content">
					<h3 class="tip-title">{{ t("home.dailyTip", "Совет дня") }}</h3>
					<p class="tip-text">{{ dailyTip }}</p>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { CbdButton } from "../components/ui";
import { useLocalization } from "../composables/useLocalization";
import { useCBTStore } from "../stores/cbt";
import { useEmotionsStore } from "../stores/emotions";

const router = useRouter();
const cbtStore = useCBTStore();
const emotionsStore = useEmotionsStore();
const { t } = useLocalization();

// Реактивные данные
const currentDate = ref("");
const greeting = ref("");

// Computed свойства
const hasEntries = computed(() => cbtStore.entries.length > 0);
const totalEntries = computed(() => cbtStore.entries.length);
const currentStreak = computed(() => calculateStreak());
const weeklyProgress = computed(() => calculateWeeklyProgress());
const mostFrequentEmotion = computed(() => getMostFrequentEmotion());
const recentEntries = computed(() => cbtStore.entries.slice(0, 3));

const dailyTips = [
	t(
		"home.tips.1",
		"Записывайте мысли сразу, как только заметили сильную эмоцию"
	) as string,
	t(
		"home.tips.2",
		"Попробуйте технику 'остановка мысли' при навязчивых размышлениях"
	) as string,
	t(
		"home.tips.3",
		"Каждая эмоция имеет право на существование, важно как мы на неё реагируем"
	) as string,
	t(
		"home.tips.4",
		"Ведение дневника помогает выявить паттерны мышления"
	) as string,
	t("home.tips.5", "Не забывайте отмечать и позитивные моменты дня") as string,
];

const dailyTip = computed(() => {
	const dayIndex = new Date().getDay();
	return dailyTips[dayIndex % dailyTips.length];
});

// Методы
function updateDateTime() {
	const now = new Date();
	const hour = now.getHours();

	// Приветствие в зависимости от времени
	if (hour < 6) greeting.value = String(t("common.night", "Доброй ночи"));
	else if (hour < 12)
		greeting.value = String(t("common.morning", "Доброе утро"));
	else if (hour < 18)
		greeting.value = String(t("common.afternoon", "Добрый день"));
	else greeting.value = String(t("common.evening", "Добрый вечер"));

	// Форматирование даты
	currentDate.value = now.toLocaleDateString("ru-RU", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
}

function calculateStreak(): number {
	if (cbtStore.entries.length === 0) return 0;

	let streak = 1;
	const sortedEntries = [...cbtStore.entries].sort(
		(a, b) =>
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	for (let i = 0; i < sortedEntries.length - 1; i++) {
		const currentDate = new Date(sortedEntries[i].createdAt);
		const nextDate = new Date(sortedEntries[i + 1].createdAt);

		currentDate.setHours(0, 0, 0, 0);
		nextDate.setHours(0, 0, 0, 0);

		const diffDays =
			(currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24);

		if (diffDays === 1) {
			streak++;
		} else {
			break;
		}
	}

	return streak;
}

function calculateWeeklyProgress(): number {
	const now = new Date();
	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const weekEntries = cbtStore.entries.filter(
		entry => new Date(entry.createdAt) >= weekAgo
	);

	// Предполагаем цель - 1 запись в день
	const targetEntries = 7;
	const progress = Math.round((weekEntries.length / targetEntries) * 100);

	return Math.min(progress, 100);
}

function getMostFrequentEmotion(): string {
	const emotionCount = new Map<number, number>();

	cbtStore.entries.forEach((entry) => {
		const thoughts = cbtStore.getEntryThoughts(entry as any);
		thoughts.forEach((thought) => {
			thought.emotions.forEach((emotion) => {
				const count = emotionCount.get(emotion.emotionId) || 0;
				emotionCount.set(emotion.emotionId, count + 1);
			});
		});
	});

	if (emotionCount.size === 0) return "—";

	const mostFrequent = [...emotionCount.entries()].reduce((a, b) =>
		a[1] > b[1] ? a : b
	);

	const em = emotionsStore.getEmotionById(mostFrequent[0]);
	return em ? (t(em.nameKey, em.name || "") as string) : "—";
}

function formatTime(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const entryDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate()
	);

	if (entryDate.getTime() === today.getTime()) {
		return `${t("common.today", "Сегодня")}, ${date.toLocaleTimeString(
			undefined,
			{
				hour: "2-digit",
				minute: "2-digit",
			}
		)}`;
	}

	return date.toLocaleDateString("ru-RU", {
		day: "numeric",
		month: "short",
	});
}

function getEntryEmotions(entry: any): Array<{ id: number; name: string }> {
	const thoughts = cbtStore.getEntryThoughts(entry);
	const emotions: Array<{ id: number; name: string }> = [];

	thoughts.forEach((thought) => {
		thought.emotions.forEach((emotion) => {
			const em = emotionsStore.getEmotionById(emotion.emotionId);
			const emotionName = em
				? (t(em.nameKey, em.name || "") as string)
				: "";
			if (emotionName && !emotions.find((e) => e.id === emotion.emotionId)) {
				emotions.push({
					id: emotion.emotionId,
					name: emotionName,
				});
			}
		});
	});

	return emotions;
}

function getEmotionColor(emotionId: number): string {
	const emotion = emotionsStore.getEmotionById(emotionId);
	if (!emotion) return "var(--primary)";

	// Цвет берём из каталога категорий, а не из хардкод-карты id->цвет:
	// id категорий определяются сервером
	const category = emotionsStore.getCategoryById(emotion.categoryId);
	return category?.color || "var(--primary)";
}

function getEntryPreview(entry: any): string {
	if (!entry.situation)
		return String(t("common.noDescription", "Без описания"));

	const maxLength = 100;
	if (entry.situation.length <= maxLength) return entry.situation;

	return entry.situation.substring(0, maxLength) + "...";
}

function goToProfile() {
	router.push("/profile");
}

function startBreathingExercise() {
	console.log("Запуск дыхательного упражнения");
	// TODO: Implement breathing exercise
}

async function loadData() {
	try {
		await Promise.all([emotionsStore.loadAll(), cbtStore.loadEntries()]);
	} catch (error) {
		console.error("Ошибка загрузки данных:", error);
	}
}

onMounted(() => {
	updateDateTime();
	loadData();

	// Обновляем время каждую минуту
	setInterval(updateDateTime, 60000);
});
</script>

<style lang="scss">
.home-page {
	min-height: 100vh;
	background: var(--bg-secondary);
	padding-bottom: 80px;
}

.home-container {
	max-width: 500px;
	margin: 0 auto;
	padding: var(--space-4);
}

/* Header */
.home-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: var(--space-6);
}

.greeting-title {
	font-size: var(--text-3xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
	margin-bottom: var(--space-1);
}

.greeting-subtitle {
	font-size: var(--text-base);
	color: var(--text-secondary);
	text-transform: capitalize;
}

.profile-btn {
	width: 48px;
	height: 48px;
	border: none;
	background: var(--bg-primary);
	border-radius: var(--radius-full);
	box-shadow: var(--shadow-sm);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all var(--transition-fast) var(--ease-in-out);
}

.profile-btn:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-md);
}

.profile-btn .q-icon {
	font-size: 28px;
	color: var(--text-secondary);
}

/* Hero Section */
.hero-section {
	margin-bottom: var(--space-6);
}

.hero-card {
	background: linear-gradient(135deg, var(--primary), var(--primary-dark));
	border-radius: var(--radius-xl);
	padding: var(--space-6);
	color: var(--text-inverse);
	box-shadow: var(--shadow-lg);
	position: relative;
	overflow: hidden;
}

.hero-card::before {
	content: "";
	position: absolute;
	top: -50%;
	right: -50%;
	width: 200%;
	height: 200%;
	background: radial-gradient(
		circle,
		rgba(255, 255, 255, 0.1) 0%,
		transparent 70%
	);
	transform: rotate(45deg);
}

.hero-content {
	position: relative;
	z-index: 1;
	margin-bottom: var(--space-5);
}

.hero-title {
	font-size: var(--text-2xl);
	font-weight: var(--font-bold);
	margin-bottom: var(--space-2);
}

.hero-description {
	font-size: var(--text-base);
	opacity: 0.9;
}

.hero-cta {
	position: relative;
	z-index: 1;
	width: 100%;
	background: var(--text-inverse) !important;
	color: var(--primary) !important;
	font-weight: var(--font-semibold);
}

.hero-cta:hover {
	background: rgba(255, 255, 255, 0.9) !important;
}

/* Statistics */
.stats-overview {
	margin-bottom: var(--space-6);
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
	width: 100%;
	overflow: hidden;
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	display: flex;
	align-items: center;
	gap: var(--space-3);
	transition: all var(--transition-fast) var(--ease-in-out);
	border: 1px solid var(--border-color);
}

.stat-card:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-md);
	border-color: var(--primary);
}

.stat-icon {
	width: 48px;
	height: 48px;
	background: var(--bg-secondary);
	border-radius: var(--radius-lg);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--primary);
}

.stat-icon .q-icon {
	font-size: 24px;
}

.stat-content {
	flex: 1;
}

.stat-value {
	font-size: var(--text-2xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
	line-height: 1;
}

.stat-label {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	margin-top: var(--space-1);
}

/* Recent Entries */
.recent-entries {
	margin-bottom: var(--space-6);
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: var(--space-4);
}

.see-all-btn {
	display: flex;
	align-items: center;
	gap: var(--space-1);
	border: none;
	background: none;
	color: var(--primary);
	font-size: var(--text-sm);
	font-weight: var(--font-medium);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
}

.see-all-btn:hover {
	gap: var(--space-2);
}

.entries-preview {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.entry-preview-card {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
	border: 1px solid var(--border-color);
}

.entry-preview-card:hover {
	transform: translateX(4px);
	box-shadow: var(--shadow-md);
	border-color: var(--primary);
}

.entry-preview-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: var(--space-2);
}

.entry-preview-time {
	font-size: var(--text-sm);
	color: var(--text-secondary);
}

.entry-preview-emotions {
	display: flex;
	gap: var(--space-1);
	flex-wrap: wrap;
	overflow: hidden;
	max-width: 100%;
}

.emotion-badge {
	font-size: var(--text-xs);
	padding: var(--space-1) var(--space-2);
	border-radius: var(--radius-full);
	color: var(--text-inverse);
	font-weight: var(--font-medium);
	white-space: nowrap;
	max-width: 120px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.entry-preview-text {
	font-size: var(--text-base);
	color: var(--text-primary);
	line-height: var(--leading-normal);
	margin: 0;
}

/* Quick Actions */
.quick-actions {
	margin-bottom: var(--space-6);
}

.actions-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--space-3);
}

.action-card {
	background: var(--bg-primary);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
	text-align: left;
}

.action-card:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-md);
	border-color: var(--primary);
}

.action-icon-wrapper {
	width: 48px;
	height: 48px;
	border-radius: var(--radius-md);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: var(--space-3);
}

.action-icon-wrapper.analytics {
	background: var(--primary-light);
	color: var(--primary);
}

.action-icon-wrapper.breathing {
	background: var(--success-light);
	color: var(--success);
}

.action-icon-wrapper.resources {
	background: var(--warning-light);
	color: var(--warning);
}

.action-icon-wrapper.settings {
	background: var(--info-light);
	color: var(--info);
}

.action-icon-wrapper .q-icon {
	font-size: 24px;
}

.action-label {
	font-size: var(--text-base);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	display: block;
	margin-bottom: var(--space-1);
}

.action-description {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	margin: 0;
}

/* Daily Tip */
.daily-tip {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	display: flex;
	gap: var(--space-3);
	border: 1px solid var(--border-color);
}

.tip-icon {
	font-size: 32px;
	line-height: 1;
}

.tip-content {
	flex: 1;
}

.tip-title {
	font-size: var(--text-base);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	margin-bottom: var(--space-1);
}

.tip-text {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	line-height: var(--leading-relaxed);
	margin: 0;
}

/* Responsive */
@media (max-width: 400px) {
	.stats-grid,
	.actions-grid {
		grid-template-columns: 1fr;
	}
}

/* Темная тема */
:root.dark {
	.hero-card {
		background: linear-gradient(135deg, var(--primary-dark), #1e293b);
		border: 1px solid rgba(96, 165, 250, 0.3);
	}

	.stat-card {
		background: var(--bg-tertiary);
		border-color: transparent;
	}

	.stat-card:hover {
		border-color: var(--primary);
		background: var(--bg-hover);
	}

	.stat-icon {
		background: rgba(96, 165, 250, 0.1);
	}

	.entry-preview-card {
		background: var(--bg-tertiary);
		border-color: transparent;
	}

	.entry-preview-card:hover {
		border-color: var(--primary);
		background: var(--bg-hover);
	}

	.action-card {
		background: var(--bg-tertiary);
		border-color: transparent;
	}

	.action-card:hover {
		border-color: var(--primary);
		background: var(--bg-hover);
	}

	.action-icon-wrapper {
		filter: brightness(0.8);
	}

	.daily-tip {
		background: var(--bg-tertiary);
		border-color: transparent;
	}

	.profile-btn {
		background: var(--bg-tertiary);
		border: 1px solid transparent;
	}

	.profile-btn:hover {
		border-color: var(--primary);
		background: var(--bg-hover);
	}
}
</style> 