<template>
	<div class="onboarding-page">
		<main class="cover">
			<!-- Прогресс: три строки тетради -->
			<header class="progress-head">
				<p class="progress-label">{{ stepLabel }}</p>
				<button type="button" class="text-btn dim skip-btn" @click="finish(false)">
					{{ t("profile.skip", "Пропустить") }}
				</button>
				<div class="progress-lines" aria-hidden="true">
					<span
						v-for="n in 3"
						:key="n"
						class="progress-line"
						:class="{ 'is-active': n <= step }"
					></span>
				</div>
			</header>

			<!-- Свап шагов без <Transition>: JS-хуки переходов зависают в
			     фоновых вкладках (rAF заморожен), CSS-анимация на mount надёжнее -->
			<!-- ===== Шаг 1: обращение ===== -->
			<section v-if="step === 1" key="address" class="step">
					<h1 class="step-title">
						{{ t("profile.addressTitle", "Как к вам обращаться") }}
					</h1>
					<p class="step-sub">
						{{
							t(
								"profile.addressSub",
								"дневник — личное место, пусть и звучит по-вашему"
							)
						}}
					</p>

					<div class="step-body">
						<label class="line-field">
							<span class="line-label">{{ t("profile.nameLabel", "Имя") }}</span>
							<input
								v-model="form.name"
								type="text"
								autocomplete="nickname"
								:placeholder="t('profile.namePlaceholder', 'как вас называть')"
							/>
							<span class="line-rule" aria-hidden="true"></span>
						</label>

						<div class="chip-group">
							<span class="line-label">{{
								t("profile.addressingLabel", "Обращаться к вам")
							}}</span>
							<div class="chips">
								<button
									v-for="opt in addressingOptions"
									:key="opt.value"
									type="button"
									class="chip"
									:class="{ 'is-active': form.addressing === opt.value }"
									@click="form.addressing = opt.value"
								>
									{{ opt.label }}
								</button>
							</div>
						</div>

						<label
							class="line-field age-field"
							:class="{ 'is-invalid': ageError }"
						>
							<span class="line-label">{{ t("profile.age", "Возраст") }}</span>
							<input
								v-model.number="form.age"
								type="number"
								inputmode="numeric"
								min="13"
								max="120"
								:placeholder="t('profile.agePlaceholder', 'необязательно')"
								@blur="validateAge"
							/>
							<span class="line-rule" aria-hidden="true"></span>
							<span v-if="ageError" class="line-error">{{ ageError }}</span>
						</label>
					</div>
				</section>

			<!-- ===== Шаг 2: реакции (непрямой вопрос о проблемах) ===== -->
			<section v-else-if="step === 2" key="reactions" class="step">
					<h1 class="step-title">
						{{ t("profile.reactionsTitle", "Что хочется изменить") }}
					</h1>
					<p class="step-sub">
						{{
							t(
								"profile.reactionsSub",
								"в каких реакциях вам хотелось бы быть спокойнее или увереннее — можно несколько"
							)
						}}
					</p>

					<div class="step-body">
						<div class="chips wrap">
							<button
								v-for="goal in goalOptions"
								:key="goal.value"
								type="button"
								class="chip"
								:class="{ 'is-active': form.goals.includes(goal.value) }"
								@click="toggleGoal(goal.value)"
							>
								{{ goal.label }}
							</button>
						</div>

						<div class="chip-group cbt-group">
							<span class="line-label">{{
								t("profile.cbtLabel", "Знакомы с КПТ?")
							}}</span>
							<div class="chips">
								<button
									v-for="opt in cbtOptions"
									:key="opt.value"
									type="button"
									class="chip"
									:class="{ 'is-active': form.cbtFamiliarity === opt.value }"
									@click="form.cbtFamiliarity = opt.value"
								>
									{{ opt.label }}
								</button>
							</div>
						</div>
					</div>
				</section>

			<!-- ===== Шаг 3: напоминание ===== -->
			<section v-else key="reminder" class="step">
					<h1 class="step-title">
						{{ t("profile.reminderTitle", "Вечернее напоминание") }}
					</h1>
					<p class="step-sub">
						{{
							t(
								"profile.reminderSub",
								"дневник работает, когда становится привычкой — пара минут перед сном"
							)
						}}
					</p>

					<div class="step-body">
						<button
							type="button"
							class="reminder-toggle"
							:class="{ 'is-on': form.reminderEnabled }"
							role="switch"
							:aria-checked="form.reminderEnabled"
							@click="form.reminderEnabled = !form.reminderEnabled"
						>
							<span class="toggle-track" aria-hidden="true">
								<span class="toggle-thumb"></span>
							</span>
							<span>{{ t("profile.reminderToggle", "Напоминать о записи") }}</span>
						</button>

						<label
							class="line-field time-field"
							:class="{ 'is-muted': !form.reminderEnabled }"
						>
							<span class="line-label">{{
								t("profile.reminderTime", "Время")
							}}</span>
							<input
								v-model="form.reminderTime"
								type="time"
								:disabled="!form.reminderEnabled"
							/>
							<span class="line-rule" aria-hidden="true"></span>
						</label>
					</div>
			</section>

			<!-- Навигация по шагам -->
			<footer class="step-foot">
				<button type="button" class="lamp-btn" :disabled="isSaving" @click="next">
					<span v-if="isSaving" class="lamp-spinner" aria-hidden="true"></span>
					<span>{{
						step < 3 ? t("profile.next", "Дальше") : t("profile.done", "Готово")
					}}</span>
				</button>
				<button
					v-if="step > 1"
					type="button"
					class="text-btn dim back-btn"
					@click="step--"
				>
					← {{ t("profile.back", "Назад") }}
				</button>

				<p class="disclaimer">
					{{
						t(
							"profile.disclaimer",
							"Приложение не заменяет психотерапевта. В кризисной ситуации звоните 112."
						)
					}}
				</p>
			</footer>
		</main>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLocalization } from "../composables/useLocalization";
import type { UpdateUserRequest } from "../services/api";
import { useUserStore } from "../stores/user";

const router = useRouter();
const userStore = useUserStore();
const { t } = useLocalization();

const step = ref(1);
const isSaving = ref(false);
const ageError = ref("");

const stepLabel = computed(
	() => `${t("profile.stepWord", "шаг")} ${step.value} ${t("profile.ofWord", "из")} 3`
);

const form = ref({
	name: "",
	// Род обращения: важен для русского языка ассистента, не демография
	addressing: "" as "" | "male" | "female" | "neutral",
	age: undefined as number | undefined,
	goals: [] as string[],
	cbtFamiliarity: "" as "" | "beginner" | "intermediate" | "advanced",
	reminderEnabled: true,
	reminderTime: "21:00",
});

const addressingOptions = [
	{
		value: "male" as const,
		label: t("profile.addressing.male", "в мужском роде"),
	},
	{
		value: "female" as const,
		label: t("profile.addressing.female", "в женском роде"),
	},
	{
		value: "neutral" as const,
		label: t("profile.addressing.neutral", "без рода"),
	},
];

// Непрямой вопрос о проблемах: реакции, в которых хочется быть лучше
const goalOptions = [
	{
		value: "anxiety_future",
		label: t("profile.goal.anxiety_future", "Меньше тревожиться о будущем"),
	},
	{
		value: "criticism",
		label: t("profile.goal.criticism", "Спокойнее принимать критику"),
	},
	{
		value: "rumination",
		label: t("profile.goal.rumination", "Не накручивать себя"),
	},
	{
		value: "anger",
		label: t("profile.goal.anger", "Реже вспыхивать от злости"),
	},
	{
		value: "self_criticism",
		label: t("profile.goal.self_criticism", "Меньше ругать себя"),
	},
	{
		value: "boundaries",
		label: t("profile.goal.boundaries", "Легче говорить «нет»"),
	},
	{
		value: "avoidance",
		label: t("profile.goal.avoidance", "Не откладывать из-за тревоги"),
	},
	{
		value: "conflicts",
		label: t("profile.goal.conflicts", "Спокойнее в конфликтах"),
	},
];

// Маппится в experienceLevel — от этого зависит, объясняет ли ассистент термины
const cbtOptions = [
	{
		value: "beginner" as const,
		label: t("profile.cbt.beginner", "Нет, расскажите"),
	},
	{
		value: "intermediate" as const,
		label: t("profile.cbt.intermediate", "Что-то слышал(а)"),
	},
	{
		value: "advanced" as const,
		label: t("profile.cbt.advanced", "Да, знаком(а) на практике"),
	},
];

function toggleGoal(goal: string) {
	const index = form.value.goals.indexOf(goal);
	if (index > -1) form.value.goals.splice(index, 1);
	else form.value.goals.push(goal);
}

function validateAge(): boolean {
	const age = form.value.age;
	if (age === undefined || age === null || (age as unknown) === "") {
		ageError.value = "";
		return true;
	}
	if (age < 13) {
		ageError.value = String(t("profile.ageMin", "Минимальный возраст 13 лет"));
		return false;
	}
	if (age > 120) {
		ageError.value = String(t("profile.ageMax", "Проверьте возраст"));
		return false;
	}
	ageError.value = "";
	return true;
}

async function next() {
	if (step.value === 1 && !validateAge()) return;
	if (step.value < 3) {
		step.value++;
		return;
	}
	await finish(true);
}

async function finish(save: boolean) {
	if (!save) {
		router.push("/home");
		return;
	}

	isSaving.value = true;
	try {
		const payload: UpdateUserRequest = {
			preferredLanguage: (navigator.language || "ru").slice(0, 2),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		};
		if (form.value.name.trim()) payload.name = form.value.name.trim();
		// «без рода» — пол не отправляем вовсе
		if (form.value.addressing === "male" || form.value.addressing === "female") {
			payload.gender = form.value.addressing;
		}
		if (form.value.age) payload.age = form.value.age;
		if (form.value.goals.length) payload.goals = form.value.goals;
		if (form.value.cbtFamiliarity) {
			payload.experienceLevel = form.value.cbtFamiliarity;
		}

		await userStore.updateProfile(payload);
		await setupReminder();

		router.push("/home");
	} catch (error) {
		console.error("Ошибка сохранения профиля:", error);
		// Не держим пользователя в плену онбординга из-за сетевой ошибки
		router.push("/home");
	} finally {
		isSaving.value = false;
	}
}

// Настройка напоминания: сохраняем выбор и планируем ближайшее срабатывание.
// В вебвью без Tauri планирование тихо не выйдет — настройка останется сохранённой.
async function setupReminder() {
	try {
		localStorage.setItem(
			"cbd-reminder",
			JSON.stringify({
				enabled: form.value.reminderEnabled,
				time: form.value.reminderTime,
			})
		);
		if (!form.value.reminderEnabled) return;

		const { NotificationService } = await import(
			"../services/NotificationService"
		);
		const [hours, minutes] = form.value.reminderTime.split(":").map(Number);
		const when = new Date();
		when.setHours(hours, minutes, 0, 0);
		if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);

		await NotificationService.getInstance().scheduleReminder({
			title: String(t("login.appTitle", "Дневник")),
			body: String(
				t("profile.reminderSub", "пара минут перед сном — как прошёл день?")
			),
			scheduled: when,
		} as any);
	} catch (e) {
		console.warn("Напоминание не запланировано:", e);
	}
}

onMounted(() => {
	// Префилл имени из аккаунта
	const current: any =
		(userStore as any).user ?? (userStore as any).currentUser;
	if (current?.name) form.value.name = current.name;

	try {
		const saved = JSON.parse(localStorage.getItem("cbd-reminder") || "null");
		if (saved) {
			form.value.reminderEnabled = !!saved.enabled;
			if (saved.time) form.value.reminderTime = saved.time;
		}
	} catch {}
});
</script>

<style scoped>
/* «Вечерний дневник» — те же токены, что на логине (обложечные страницы) */
.onboarding-page {
	--ink: #12151d;
	--paper: #ede6d6;
	--paper-dim: #97907e;
	--lamp: #f0b264;
	--lamp-deep: #d99a45;
	--coral: #e26d5c;

	min-height: 100dvh;
	display: flex;
	justify-content: center;
	background:
		radial-gradient(
			90% 48% at 88% -12%,
			rgba(226, 166, 91, 0.13) 0%,
			rgba(226, 166, 91, 0) 60%
		),
		radial-gradient(120% 100% at 50% 110%, #0d1017 0%, var(--ink) 55%);
	color: var(--paper);
	font-family: "Onest", system-ui, sans-serif;
}

.cover {
	width: 100%;
	max-width: 400px;
	display: flex;
	flex-direction: column;
	padding: max(6dvh, 32px) 28px 28px;
}

/* ===== Прогресс ===== */
.progress-head {
	display: grid;
	grid-template-columns: 1fr auto;
	align-items: center;
	row-gap: 10px;
	margin-bottom: max(4dvh, 28px);
}

.progress-label {
	margin: 0;
	font-size: 12px;
	font-weight: 500;
	letter-spacing: 0.09em;
	text-transform: uppercase;
	color: var(--paper-dim);
}

.skip-btn {
	justify-self: end;
	font-size: 14px;
}

.progress-lines {
	grid-column: 1 / -1;
	display: flex;
	gap: 8px;
}

.progress-line {
	flex: 1;
	height: 2px;
	background: rgba(237, 230, 214, 0.14);
	transition: background 0.3s ease;
}

.progress-line.is-active {
	background: var(--lamp);
}

/* ===== Шаги ===== */
.step-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: clamp(30px, 8.6vw, 36px);
	line-height: 1.1;
	letter-spacing: -0.01em;
	margin: 0 0 10px;
}

.step-sub {
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 17px;
	line-height: 1.45;
	color: var(--paper-dim);
	margin: 0;
}

.step-body {
	display: flex;
	flex-direction: column;
	gap: 28px;
	margin-top: max(4dvh, 28px);
}

/* ===== Строки тетради ===== */
.line-field {
	position: relative;
	display: block;
}

.line-label {
	display: block;
	font-size: 12px;
	font-weight: 500;
	letter-spacing: 0.09em;
	text-transform: uppercase;
	color: var(--paper-dim);
	margin-bottom: 2px;
	transition: color 0.25s ease;
}

.line-field:focus-within .line-label {
	color: var(--lamp);
}

.line-field input {
	width: 100%;
	background: transparent;
	border: none;
	outline: none;
	padding: 8px 0 9px;
	font-family: inherit;
	font-size: 17px;
	color: var(--paper);
	caret-color: var(--lamp);
	border-radius: 0;
}

.line-field input::placeholder {
	color: rgba(151, 144, 126, 0.55);
}

/* Автозаполнение Chrome: не давать ему красить текст чёрным и заливать фон */
.line-field input:-webkit-autofill,
.line-field input:-webkit-autofill:hover,
.line-field input:-webkit-autofill:focus,
.line-field input:-webkit-autofill:active {
	-webkit-text-fill-color: var(--paper);
	caret-color: var(--lamp);
	-webkit-box-shadow: 0 0 0 1000px transparent inset;
	transition: background-color 9999s ease-in-out 0s;
}

.line-rule {
	display: block;
	height: 1px;
	background: rgba(237, 230, 214, 0.18);
	position: relative;
	overflow: hidden;
}

.line-rule::after {
	content: "";
	position: absolute;
	inset: 0;
	background: var(--lamp);
	transform: scaleX(0);
	transform-origin: left;
	transition: transform 0.35s ease;
}

.line-field:focus-within .line-rule::after {
	transform: scaleX(1);
}

.line-field.is-invalid .line-rule {
	background: rgba(226, 109, 92, 0.55);
}

.line-field.is-invalid .line-rule::after {
	background: var(--coral);
}

.line-error {
	display: block;
	font-size: 12.5px;
	color: var(--coral);
	margin-top: 7px;
}

.age-field {
	max-width: 160px;
}

.age-field input::-webkit-outer-spin-button,
.age-field input::-webkit-inner-spin-button {
	-webkit-appearance: none;
}

.time-field {
	max-width: 160px;
	transition: opacity 0.25s ease;
}

.time-field.is-muted {
	opacity: 0.4;
}

.time-field input::-webkit-calendar-picker-indicator {
	filter: invert(0.85) sepia(0.3);
}

/* ===== Чипы ===== */
.chip-group .line-label {
	margin-bottom: 12px;
}

.chips {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}

.chip {
	background: transparent;
	border: 1px solid rgba(237, 230, 214, 0.22);
	border-radius: 999px;
	padding: 10px 16px;
	font-family: inherit;
	font-size: 14.5px;
	color: var(--paper);
	cursor: pointer;
	transition:
		border-color 0.2s ease,
		background 0.2s ease,
		color 0.2s ease;
}

.chip:hover {
	border-color: rgba(240, 178, 100, 0.55);
}

.chip.is-active {
	background: rgba(240, 178, 100, 0.14);
	border-color: var(--lamp);
	color: var(--lamp);
}

.chip:focus-visible {
	outline: 2px solid var(--lamp);
	outline-offset: 2px;
}

.cbt-group {
	margin-top: 4px;
}

/* ===== Переключатель напоминания ===== */
.reminder-toggle {
	display: flex;
	align-items: center;
	gap: 14px;
	background: none;
	border: none;
	padding: 0;
	font-family: inherit;
	font-size: 16px;
	color: var(--paper);
	cursor: pointer;
}

.toggle-track {
	width: 46px;
	height: 26px;
	border-radius: 999px;
	background: rgba(237, 230, 214, 0.18);
	position: relative;
	transition: background 0.25s ease;
	flex-shrink: 0;
}

.toggle-thumb {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--paper-dim);
	transition:
		transform 0.25s ease,
		background 0.25s ease;
}

.reminder-toggle.is-on .toggle-track {
	background: rgba(240, 178, 100, 0.35);
}

.reminder-toggle.is-on .toggle-thumb {
	transform: translateX(20px);
	background: var(--lamp);
}

.reminder-toggle:focus-visible .toggle-track {
	outline: 2px solid var(--lamp);
	outline-offset: 2px;
}

/* ===== Низ ===== */
.step-foot {
	margin-top: max(6dvh, 40px);
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.lamp-btn {
	width: 100%;
	height: 56px;
	border: none;
	border-radius: 14px;
	background: var(--lamp);
	color: #181203;
	font-family: inherit;
	font-size: 16.5px;
	font-weight: 600;
	letter-spacing: 0.01em;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	box-shadow: 0 14px 36px rgba(226, 166, 91, 0.22);
	transition:
		background 0.2s ease,
		transform 0.15s ease,
		box-shadow 0.2s ease,
		opacity 0.2s ease;
}

.lamp-btn:hover:not(:disabled) {
	background: var(--lamp-deep);
}

.lamp-btn:active:not(:disabled) {
	transform: translateY(1px);
	box-shadow: 0 8px 22px rgba(226, 166, 91, 0.18);
}

.lamp-btn:disabled {
	opacity: 0.4;
	cursor: default;
	box-shadow: none;
}

.lamp-btn:focus-visible {
	outline: 2px solid var(--paper);
	outline-offset: 3px;
}

.lamp-spinner {
	width: 16px;
	height: 16px;
	border-radius: 50%;
	border: 2px solid rgba(24, 18, 3, 0.3);
	border-top-color: #181203;
	animation: spin 0.7s linear infinite;
}

.back-btn {
	align-self: center;
	font-size: 14.5px;
}

.text-btn {
	background: none;
	border: none;
	padding: 0;
	font-family: inherit;
	cursor: pointer;
	transition: color 0.2s ease;
}

.text-btn.dim {
	color: var(--paper-dim);
}

.text-btn.dim:hover {
	color: var(--paper);
}

.text-btn:focus-visible {
	outline: 2px solid var(--lamp);
	outline-offset: 3px;
	border-radius: 3px;
}

.disclaimer {
	margin: 6px 0 0;
	font-size: 12px;
	line-height: 1.5;
	color: rgba(151, 144, 126, 0.75);
	text-align: center;
}

/* ===== Появление шага (CSS-анимация на mount — без JS-хуков) ===== */
.step {
	animation: step-in 0.25s ease both;
}

@keyframes step-in {
	from {
		opacity: 0;
		transform: translateX(14px);
	}
	to {
		opacity: 1;
		transform: translateX(0);
	}
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.step {
		animation: none;
	}
}

@media (max-height: 700px) {
	.cover {
		padding-top: 24px;
	}

	.step-body {
		margin-top: 20px;
		gap: 22px;
	}

	.step-foot {
		margin-top: 28px;
	}
}
</style>
