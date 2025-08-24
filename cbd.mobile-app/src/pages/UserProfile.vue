<template>
	<div class="profile-page">
		<div class="profile-container">
			<!-- Header -->
			<div class="profile-header">
				<div class="header-content">
					<h1 class="page-title">
						{{ t("profile.title", "Расскажите о себе") }}
					</h1>
					<p class="page-subtitle">
						{{
							t(
								"profile.subtitle",
								"Эта информация поможет нам персонализировать ваш опыт"
							)
						}}
					</p>
				</div>
			</div>

			<!-- Форма профиля -->
			<div class="profile-form" v-if="!isLoading">
				<!-- Возраст -->
				<div class="form-section">
					<label class="section-label">{{ t("profile.age", "Возраст") }}</label>
					<CbdInput
						v-model.number="profile.age"
						type="number"
						:placeholder="t('profile.agePlaceholder', 'Укажите ваш возраст')"
						:error-message="errors.age"
					/>
				</div>

				<!-- Пол -->
				<div class="form-section">
					<label class="section-label">{{ t("profile.gender", "Пол") }}</label>
					<div class="gender-options">
						<q-btn
							v-for="option in genderOptions"
							:key="option.value"
							:class="[
								'gender-btn',
								{ 'gender-btn--active': profile.gender === option.value },
							]"
							@click="profile.gender = option.value"
							flat
						>
							{{ option.icon }} {{ option.label }}
						</q-btn>
					</div>
				</div>

				<!-- Цели использования -->
				<div class="form-section">
					<label class="section-label">{{
						t("profile.goals", "Цели использования приложения")
					}}</label>
					<p class="section-hint">
						{{ t("profile.goalsHint", "Выберите все подходящие варианты") }}
					</p>
					<div class="goals-grid">
						<q-btn
							v-for="goal in goalOptions"
							:key="goal.value"
							:class="[
								'goal-btn',
								{ 'goal-btn--active': profile.goals.includes(goal.value) },
							]"
							@click="toggleGoal(goal.value)"
							flat
						>
							{{ goal.icon }}
							<span>{{ goal.label }}</span>
						</q-btn>
					</div>
				</div>

				<!-- Уровень опыта -->
				<div class="form-section">
					<label class="section-label">{{
						t("profile.experience", "Опыт работы с эмоциями")
					}}</label>
					<div class="experience-options">
						<q-btn
							v-for="option in experienceOptions"
							:key="option.value"
							:class="[
								'experience-btn',
								{
									'experience-btn--active':
										profile.experience_level === option.value,
								},
							]"
							@click="profile.experience_level = option.value"
							flat
						>
							<div class="experience-title">{{ option.label }}</div>
							<div class="experience-desc">{{ option.description }}</div>
						</q-btn>
					</div>
				</div>

				<!-- Частота медитации -->
				<div class="form-section">
					<label class="section-label">{{
						t("profile.meditation", "Как часто вы медитируете?")
					}}</label>
					<div class="frequency-options">
						<q-btn
							v-for="option in meditationFrequency"
							:key="option.value"
							:class="[
								'frequency-btn',
								{
									'frequency-btn--active':
										profile.meditation_frequency === option.value,
								},
							]"
							@click="profile.meditation_frequency = option.value"
							flat
							dense
						>
							{{ option.label }}
						</q-btn>
					</div>
				</div>
			</div>

			<!-- Действия -->
			<div class="profile-actions" v-if="!isLoading">
				<CbdButton variant="ghost" size="lg" @click="skipProfile">{{
					t("profile.skip", "Пропустить")
				}}</CbdButton>
				<CbdButton
					:loading="isSaving"
					variant="primary"
					size="lg"
					@click="saveProfile"
					:disabled="!isFormValid"
					>{{ t("profile.continue", "Продолжить") }}</CbdButton
				>
			</div>

			<!-- Загрузка -->
			<div v-if="isLoading" class="loading-state">
				<div class="loading-spinner">⏳</div>
				<p>{{ t("profile.loading", "Загружаем ваш профиль...") }}</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { CbdButton, CbdInput } from "../components/ui";
import { useLocalization } from "../composables/useLocalization";
import type { UpdateUserRequest } from "../services/api";
import { useUserStore } from "../stores/user";

const router = useRouter();
const userStore = useUserStore();
const { t } = useLocalization();

const isLoading = ref(true);
const isSaving = ref(false);
const errors = ref({
	age: "",
});

const profile = ref({
	age: undefined as number | undefined,
	gender: undefined as string | undefined,
	goals: [] as string[],
	experience_level: undefined as string | undefined,
	meditation_frequency: undefined as string | undefined,
	stress_level: undefined as number | undefined,
	sleep_quality: undefined as number | undefined,
});

const genderOptions = [
	{ value: "male", label: t("profile.gender.male", "Мужской"), icon: "👨" },
	{ value: "female", label: t("profile.gender.female", "Женский"), icon: "👩" },
	{ value: "other", label: t("profile.gender.other", "Другой"), icon: "🌈" },
	{
		value: "prefer_not_to_say",
		label: t("profile.gender.na", "Не указывать"),
		icon: "🤐",
	},
];

const goalOptions = [
	{
		value: "emotional_awareness",
		label: t("profile.goal.emotional_awareness", "Понимание эмоций"),
		icon: "🧠",
	},
	{
		value: "stress_management",
		label: t("profile.goal.stress_management", "Управление стрессом"),
		icon: "😌",
	},
	{
		value: "mood_tracking",
		label: t("profile.goal.mood_tracking", "Отслеживание настроения"),
		icon: "📊",
	},
	{
		value: "mindfulness",
		label: t("profile.goal.mindfulness", "Осознанность"),
		icon: "🧘",
	},
	{
		value: "anxiety_relief",
		label: t("profile.goal.anxiety_relief", "Работа с тревогой"),
		icon: "💚",
	},
	{
		value: "self_development",
		label: t("profile.goal.self_development", "Саморазвитие"),
		icon: "🌱",
	},
	{
		value: "therapy_support",
		label: t("profile.goal.therapy_support", "Поддержка терапии"),
		icon: "🩺",
	},
	{
		value: "relationship_improvement",
		label: t("profile.goal.relationship_improvement", "Улучшение отношений"),
		icon: "❤️",
	},
];

const experienceOptions = [
	{
		value: "beginner",
		label: t("profile.experience.beginner", "Новичок"),
		description: t(
			"profile.experience.beginnerDesc",
			"Только начинаю изучать свои эмоции"
		),
	},
	{
		value: "intermediate",
		label: t("profile.experience.intermediate", "Средний уровень"),
		description: t(
			"profile.experience.intermediateDesc",
			"Уже знаком с базовыми понятиями"
		),
	},
	{
		value: "advanced",
		label: t("profile.experience.advanced", "Продвинутый"),
		description: t(
			"profile.experience.advancedDesc",
			"Активно работаю с эмоциями и чувствами"
		),
	},
];

const meditationFrequency = [
	{ value: "never", label: t("profile.meditation.never", "Никогда") },
	{ value: "rarely", label: t("profile.meditation.rarely", "Редко") },
	{ value: "sometimes", label: t("profile.meditation.sometimes", "Иногда") },
	{ value: "weekly", label: t("profile.meditation.weekly", "Еженедельно") },
	{ value: "daily", label: t("profile.meditation.daily", "Ежедневно") },
];

const isFormValid = computed(() => {
	return (
		profile.value.age &&
		profile.value.age >= 13 &&
		profile.value.age <= 120 &&
		!!profile.value.gender &&
		profile.value.goals.length > 0
	);
});

function toggleGoal(goal: string) {
	const index = profile.value.goals.indexOf(goal);
	if (index > -1) profile.value.goals.splice(index, 1);
	else profile.value.goals.push(goal);
}

function validateAge() {
	if (!profile.value.age) {
		errors.value.age = String(t("profile.ageRequired", "Возраст обязателен"));
	} else if ((profile.value.age as number) < 13) {
		errors.value.age = String(
			t("profile.ageMin", "Минимальный возраст 13 лет")
		);
	} else if ((profile.value.age as number) > 120) {
		errors.value.age = String(
			t("profile.ageMax", "Максимальный возраст 120 лет")
		);
	} else {
		errors.value.age = "";
	}
}

async function saveProfile() {
	validateAge();
	if (errors.value.age) return;

	isSaving.value = true;
	try {
		const payload: UpdateUserRequest = {
			name: undefined,
			preferredLanguage: (navigator.language || "ru").slice(0, 2),
			age: profile.value.age,
			gender: profile.value.gender,
			goals: profile.value.goals,
			experienceLevel: profile.value.experience_level,
			meditationFrequency: profile.value.meditation_frequency,
			stressLevel: profile.value.stress_level,
			sleepQuality: profile.value.sleep_quality,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		};

		await userStore.updateProfile(payload);

		// Локально сохраняем, чтобы UI был консистентным
		localStorage.setItem(
			"user-profile-extra",
			JSON.stringify({
				age: profile.value.age,
				gender: profile.value.gender,
				goals: profile.value.goals,
				experience_level: profile.value.experience_level,
				meditation_frequency: profile.value.meditation_frequency,
				stress_level: profile.value.stress_level,
				sleep_quality: profile.value.sleep_quality,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			})
		);

		router.push("/home");
	} catch (error) {
		console.error("Ошибка сохранения профиля:", error);
	} finally {
		isSaving.value = false;
	}
}

function skipProfile() {
	router.push("/home");
}

onMounted(() => {
	// одноразовый редирект: если уже были на профиле после логина — не дёргать снова
	try {
		const once = localStorage.getItem("profile-once-redirected");
		if (!once) {
			localStorage.setItem("profile-once-redirected", "1");
		}
	} catch {}
	// Симуляция загрузки
	setTimeout(() => {
		isLoading.value = false;
	}, 300);
});
</script>

<style lang="scss">
.profile-page {
	min-height: 100vh;
	background: var(--bg-secondary);
	padding-bottom: 80px;
	transition: background-color var(--transition-base) var(--ease-in-out);
}

.profile-container {
	max-width: 500px;
	margin: 0 auto;
	padding: var(--space-4);
}

.profile-header {
	margin-bottom: var(--space-6);
	text-align: center;
}

.header-content {
	max-width: 600px;
	margin: 0 auto;
}

.page-title {
	font-size: var(--text-3xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
	margin-bottom: var(--space-2);
}

.page-subtitle {
	font-size: var(--text-base);
	color: var(--text-secondary);
	line-height: var(--leading-relaxed);
}

.profile-card {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: var(--space-6);
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--border-color);
}

/* Аватар */
.avatar-section {
	text-align: center;
	margin-bottom: var(--space-8);
}

.avatar-wrapper {
	position: relative;
	width: 120px;
	height: 120px;
	margin: 0 auto var(--space-4);
}

.avatar {
	width: 100%;
	height: 100%;
	background: linear-gradient(135deg, var(--primary), var(--primary-dark));
	border-radius: var(--radius-full);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-inverse);
	font-size: var(--text-5xl);
	font-weight: var(--font-bold);
	box-shadow: var(--shadow-md);
}

.avatar-upload {
	position: absolute;
	bottom: 0;
	right: 0;
	width: 40px;
	height: 40px;
	background: var(--primary);
	border-radius: var(--radius-full);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	border: 3px solid var(--bg-primary);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.avatar-upload:hover {
	transform: scale(1.1);
	background: var(--primary-hover);
}

.avatar-upload .q-icon {
	color: var(--text-inverse);
	font-size: 20px;
}

.user-email {
	font-size: var(--text-base);
	color: var(--text-secondary);
}

/* Форма */
.profile-form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.form-actions {
	display: flex;
	gap: var(--space-3);
	margin-top: var(--space-4);
}

.save-btn,
.cancel-btn {
	flex: 1;
}

/* Статистика */
.stats-section {
	margin-top: var(--space-6);
	padding-top: var(--space-6);
	border-top: 1px solid var(--border-color);
}

.section-title {
	font-size: var(--text-lg);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	margin-bottom: var(--space-4);
}

.stats-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--space-3);
}

.stat-item {
	background: var(--bg-secondary);
	border-radius: var(--radius-base);
	padding: var(--space-4);
	text-align: center;
	transition: all var(--transition-fast) var(--ease-in-out);
}

.stat-item:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-sm);
}

.stat-icon {
	font-size: 28px;
	margin-bottom: var(--space-2);
}

.stat-value {
	font-size: var(--text-2xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
	margin-bottom: var(--space-1);
}

.stat-label {
	font-size: var(--text-sm);
	color: var(--text-secondary);
}

/* Действия */
.actions-section {
	margin-top: var(--space-6);
	padding-top: var(--space-6);
	border-top: 1px solid var(--border-color);
}

.action-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.action-btn {
	width: 100%;
	padding: var(--space-4);
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: var(--bg-secondary);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-base);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
}

.action-btn:hover {
	background: var(--bg-hover);
	border-color: var(--primary);
	transform: translateX(4px);
}

.action-content {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.action-icon {
	width: 40px;
	height: 40px;
	background: var(--bg-primary);
	border-radius: var(--radius-base);
	display: flex;
	align-items: center;
	justify-content: center;
}

.action-icon .q-icon {
	font-size: 20px;
	color: var(--primary);
}

.action-text {
	text-align: left;
}

.action-title {
	font-weight: var(--font-medium);
	color: var(--text-primary);
	margin-bottom: var(--space-1);
}

.action-subtitle {
	font-size: var(--text-sm);
	color: var(--text-secondary);
}

.action-arrow {
	color: var(--text-tertiary);
}

.logout-btn {
	width: 100%;
	margin-top: var(--space-4);
}

/* Стили форм */
.form-section {
	margin-bottom: var(--space-6);
}

.section-label {
	display: block;
	font-size: var(--text-base);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	margin-bottom: var(--space-2);
}

.section-hint {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	margin-bottom: var(--space-3);
}

/* Кнопки выбора пола */
.gender-options {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--space-2);
}

.gender-btn {
	padding: var(--space-3);
	border: 2px solid var(--border-color);
	border-radius: var(--radius-lg);
	background: var(--bg-primary);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
	font-size: var(--text-base);
	color: var(--text-primary);
}

.gender-btn:hover {
	border-color: var(--primary);
	background: var(--bg-hover);
}

.gender-btn--active {
	border-color: var(--primary);
	background: var(--primary);
	color: var(--text-inverse);
}

/* Сетка целей */
.goals-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--space-3);
}

.goal-btn {
	padding: var(--space-4);
	border: 2px solid var(--border-color);
	border-radius: var(--radius-lg);
	background: var(--bg-primary);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-2);
}

.goal-btn:hover {
	border-color: var(--primary);
	background: var(--bg-hover);
	transform: translateY(-2px);
	box-shadow: var(--shadow-sm);
}

.goal-btn--active {
	border-color: var(--primary);
	background: var(--primary);
	color: var(--text-inverse);
}

.goal-btn span {
	font-size: var(--text-sm);
	font-weight: var(--font-medium);
}

/* Опыт */
.experience-options {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.experience-btn {
	padding: var(--space-4);
	border: 2px solid var(--border-color);
	border-radius: var(--radius-lg);
	background: var(--bg-primary);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
	text-align: left;
}

.experience-btn:hover {
	border-color: var(--primary);
	background: var(--bg-hover);
}

.experience-btn--active {
	border-color: var(--primary);
	background: var(--primary);
	color: var(--text-inverse);
}

.experience-btn--active .experience-desc {
	color: rgba(255, 255, 255, 0.9);
}

.experience-title {
	font-size: var(--text-base);
	font-weight: var(--font-semibold);
	margin-bottom: var(--space-1);
}

.experience-desc {
	font-size: var(--text-sm);
	color: var(--text-secondary);
}

/* Частота медитации */
.frequency-options {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
}

.frequency-btn {
	padding: var(--space-2) var(--space-4);
	border: 2px solid var(--border-color);
	border-radius: var(--radius-full);
	background: var(--bg-primary);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
	font-size: var(--text-sm);
	font-weight: var(--font-medium);
	color: var(--text-primary);
}

.frequency-btn:hover {
	border-color: var(--primary);
	background: var(--bg-hover);
}

.frequency-btn--active {
	border-color: var(--primary);
	background: var(--primary);
	color: var(--text-inverse);
}

/* Действия */
.profile-actions {
	display: flex;
	gap: var(--space-3);
	margin-top: var(--space-8);
}

.profile-actions .cbd-button {
	flex: 1;
}

/* Состояние загрузки */
.loading-state {
	text-align: center;
	padding: var(--space-8);
	color: var(--text-secondary);
}

.loading-spinner {
	font-size: 48px;
	margin-bottom: var(--space-3);
	animation: spin 2s linear infinite;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

/* Темная тема */
:root.dark {
	.gender-btn,
	.goal-btn,
	.experience-btn,
	.frequency-btn {
		background: var(--bg-tertiary);
		border-color: var(--bg-tertiary);
	}

	.gender-btn:hover,
	.goal-btn:hover,
	.experience-btn:hover,
	.frequency-btn:hover {
		background: var(--bg-hover);
		border-color: var(--border-color-hover);
	}

	.gender-btn--active,
	.goal-btn--active,
	.experience-btn--active,
	.frequency-btn--active {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--text-inverse);
	}
}

/* Адаптация */
@media (max-width: 500px) {
	.profile-container {
		padding: var(--space-3);
	}

	.profile-card {
		padding: var(--space-4);
	}

	.avatar-wrapper {
		width: 100px;
		height: 100px;
	}

	.avatar {
		font-size: var(--text-4xl);
	}
}
</style> 