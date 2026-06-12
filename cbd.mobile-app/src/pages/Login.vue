<template>
	<div class="login-page">
		<main class="cover">
			<!-- Шапка: страница дневника начинается с даты -->
			<header class="cover-head">
				<p class="cover-date">{{ todayLabel }}</p>
				<h1 class="cover-title">
					{{ isRegistering ? $t("login.creatingAccount") : $t("login.appTitle") }}
				</h1>
				<p class="cover-sub">
					{{
						isRegistering ? $t("login.newDiarySub") : $t("login.signInTitle")
					}}
				</p>
			</header>

			<!-- Форма: поля как строки в тетради -->
			<form class="cover-form" novalidate @submit.prevent="handleSubmit">
				<label class="line-field" :class="{ 'is-invalid': emailError }">
					<span class="line-label">{{ $t("login.emailLabel") }}</span>
					<input
						v-model="email"
						type="email"
						name="email"
						autocomplete="email"
						inputmode="email"
						:placeholder="$t('login.emailPlaceholder')"
						@blur="validateEmail"
						@keyup.enter="handleSubmit"
					/>
					<span class="line-rule" aria-hidden="true"></span>
					<span v-if="emailError" class="line-error">{{ emailError }}</span>
				</label>

				<label
					v-if="isRegistering"
					class="line-field"
					:class="{ 'is-invalid': usernameError }"
				>
					<span class="line-label">{{ $t("login.usernameOptional") }}</span>
					<input
						v-model="username"
						type="text"
						name="name"
						autocomplete="nickname"
						:placeholder="$t('login.usernamePlaceholder')"
						@blur="validateUsername"
						@keyup.enter="handleSubmit"
					/>
					<span class="line-rule" aria-hidden="true"></span>
					<span v-if="usernameError" class="line-error">{{
						usernameError
					}}</span>
				</label>

				<label class="line-field" :class="{ 'is-invalid': passwordError }">
					<span class="line-label">{{ $t("login.passwordLabel") }}</span>
					<input
						v-model="password"
						:type="showPassword ? 'text' : 'password'"
						name="password"
						:autocomplete="isRegistering ? 'new-password' : 'current-password'"
						:placeholder="
							isRegistering
								? $t('login.passwordCreate')
								: $t('login.passwordEnter')
						"
						@blur="validatePassword"
						@keyup.enter="handleSubmit"
					/>
					<button
						type="button"
						class="eye-btn"
						:aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
						@click="togglePasswordVisibility"
					>
						<svg
							v-if="!showPassword"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
							<circle cx="12" cy="12" r="2.8" />
						</svg>
						<svg
							v-else
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
							<circle cx="12" cy="12" r="2.8" />
							<line x1="4" y1="20" x2="20" y2="4" />
						</svg>
					</button>
					<span class="line-rule" aria-hidden="true"></span>
					<span v-if="passwordError" class="line-error">{{
						passwordError
					}}</span>
				</label>

				<label
					v-if="isRegistering"
					class="line-field"
					:class="{ 'is-invalid': confirmPasswordError }"
				>
					<span class="line-label">{{ $t("login.confirmPasswordLabel") }}</span>
					<input
						v-model="confirmPassword"
						:type="showConfirmPassword ? 'text' : 'password'"
						name="confirm-password"
						autocomplete="new-password"
						:placeholder="$t('login.confirmPasswordPlaceholder')"
						@blur="validateConfirmPassword"
						@keyup.enter="handleSubmit"
					/>
					<button
						type="button"
						class="eye-btn"
						:aria-label="
							showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'
						"
						@click="toggleConfirmPasswordVisibility"
					>
						<svg
							v-if="!showConfirmPassword"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
							<circle cx="12" cy="12" r="2.8" />
						</svg>
						<svg
							v-else
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
							<circle cx="12" cy="12" r="2.8" />
							<line x1="4" y1="20" x2="20" y2="4" />
						</svg>
					</button>
					<span class="line-rule" aria-hidden="true"></span>
					<span v-if="confirmPasswordError" class="line-error">{{
						confirmPasswordError
					}}</span>
				</label>

				<button
					type="submit"
					class="lamp-btn"
					:disabled="!isFormValid || userStore.isLoading"
				>
					<span v-if="userStore.isLoading" class="lamp-spinner" aria-hidden="true"></span>
					<span>{{
						isRegistering ? $t("login.submitCreate") : $t("login.submitLogin")
					}}</span>
				</button>

				<p v-if="userStore.error" class="form-error" role="alert">
					{{ userStore.error }}
				</p>
			</form>

			<!-- Низ: переключение режима, восстановление, демо -->
			<footer class="cover-foot">
				<p class="foot-line">
					<span class="foot-dim">{{
						isRegistering ? $t("login.haveAccount") : $t("login.firstTime")
					}}</span>
					<button type="button" class="text-btn accent" @click="toggleAuthMode">
						{{
							isRegistering
								? $t("login.switchToLogin")
								: $t("login.switchToRegister")
						}}
					</button>
				</p>

				<p v-if="!isRegistering" class="foot-line">
					<button type="button" class="text-btn dim" @click="handleForgotPassword">
						{{ $t("login.forgotPassword") }}
					</button>
				</p>

				<p class="foot-line demo-line">
					<button type="button" class="text-btn dim" @click="handleDemoLogin">
						{{ $t("login.loginAsDemo") }}
					</button>
				</p>
			</footer>
		</main>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useLocalization } from "../composables/useLocalization";
import { useUserStore } from "../stores/user";

const router = useRouter();
const userStore = useUserStore();
const { t } = useLocalization();

// Дата прописью — страница дневника начинается с даты
const todayLabel = computed(() =>
	new Date().toLocaleDateString("ru-RU", {
		weekday: "long",
		day: "numeric",
		month: "long",
	})
);

// Состояние формы
const isRegistering = ref(false);
const email = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// Ошибки валидации
const emailError = ref("");
const usernameError = ref("");
const passwordError = ref("");
const confirmPasswordError = ref("");

// Методы валидации
function validateEmail() {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!email.value.trim()) {
		emailError.value = String(t("login.emailRequired"));
		return false;
	} else if (!emailRegex.test(email.value)) {
		emailError.value = String(t("login.emailInvalid"));
		return false;
	} else {
		emailError.value = "";
		return true;
	}
}

function validateUsername() {
	if (
		isRegistering.value &&
		username.value.trim() &&
		username.value.trim().length < 2
	) {
		usernameError.value = String(t("login.usernameTooShort"));
		return false;
	} else {
		usernameError.value = "";
		return true;
	}
}

function validatePassword() {
	if (!password.value) {
		passwordError.value = String(t("login.passwordRequired"));
		return false;
	} else if (isRegistering.value && password.value.length < 6) {
		passwordError.value = String(t("login.passwordMin"));
		return false;
	} else {
		passwordError.value = "";
		return true;
	}
}

function validateConfirmPassword() {
	if (isRegistering.value) {
		if (!confirmPassword.value) {
			confirmPasswordError.value = String(t("login.confirmPasswordRequired"));
			return false;
		} else if (password.value !== confirmPassword.value) {
			confirmPasswordError.value = String(t("login.passwordsNotMatch"));
			return false;
		} else {
			confirmPasswordError.value = "";
			return true;
		}
	}
	return true;
}

function validateForm() {
	const isEmailValid = validateEmail();
	const isUsernameValid = validateUsername();
	const isPasswordValid = validatePassword();
	const isConfirmPasswordValid = validateConfirmPassword();

	return (
		isEmailValid && isUsernameValid && isPasswordValid && isConfirmPasswordValid
	);
}

// Computed для проверки валидности формы
const isFormValid = computed(() => {
	return (
		email.value.trim() &&
		password.value &&
		!emailError.value &&
		!passwordError.value &&
		(!isRegistering.value ||
			(!confirmPasswordError.value && !usernameError.value))
	);
});

// Методы для переключения видимости пароля
function togglePasswordVisibility() {
	showPassword.value = !showPassword.value;
}

function toggleConfirmPasswordVisibility() {
	showConfirmPassword.value = !showConfirmPassword.value;
}

// Переключение между входом и регистрацией
function toggleAuthMode() {
	isRegistering.value = !isRegistering.value;

	// Очищаем ошибки и дополнительные поля
	clearErrors();
	if (!isRegistering.value) {
		username.value = "";
		confirmPassword.value = "";
	}
}

function clearErrors() {
	emailError.value = "";
	usernameError.value = "";
	passwordError.value = "";
	confirmPasswordError.value = "";
}

// Основная обработка формы
async function handleSubmit() {
	if (!validateForm()) return;

	try {
		if (isRegistering.value) {
			await handleRegister();
		} else {
			await handleLogin();
		}
	} catch (error) {
		console.error("Ошибка отправки формы:", error);
	}
}

async function handleLogin() {
	try {
		const result = await userStore.login(email.value.trim(), password.value);
		console.log("✅ Авторизация успешна:", result.user);

		// Онбординг показываем только если у пользователя ещё нет имени.
		// Бэк отдаёт плоское `name` (раньше было profile.firstName/lastName) —
		// проверка по старой форме срабатывала всегда и гнала онбординг каждый вход.
		const u: any = result.user;
		const hasName = !!(
			u?.name?.trim() ||
			u?.profile?.firstName ||
			u?.profile?.lastName
		);
		router.push(hasName ? "/home" : "/profile");
	} catch (error: any) {
		console.error("❌ Ошибка авторизации:", error);

		// Если это демо-email, предлагаем создать аккаунт
		if (
			email.value === "test@test.ru" &&
			error.message?.includes("Пользователь не найден")
		) {
			console.log("🔄 Переключаемся на регистрацию для демо-пользователя");
			isRegistering.value = true;
			password.value = "123456"; // Демо-пароль
			confirmPassword.value = "123456";
		}
	}
}

async function handleRegister() {
	try {
		const result = await userStore.register(
			email.value.trim(),
			password.value,
			username.value.trim() || undefined
		);
		console.log("✅ Регистрация успешна:", result.user);

		// После регистрации переходим к заполнению профиля
		router.push("/profile");
	} catch (error: any) {
		console.error("❌ Ошибка регистрации:", error);
	}
}

// Демо вход
async function handleDemoLogin() {
	email.value = "test@test.ru";
	password.value = "123456";
	confirmPassword.value = "123456";
	username.value = "Демо Пользователь";

	// Пробуем войти, если не получается - регистрируемся
	try {
		await handleLogin();
	} catch {
		isRegistering.value = true;
		setTimeout(() => handleRegister(), 500);
	}
}

// Заглушки для будущего функционала
async function handleForgotPassword() {
	alert(
		"Функция восстановления пароля будет добавлена в следующих обновлениях"
	);
}
</script>

<style scoped>
/* «Вечерний дневник»: чернильная ночь + тёплый свет лампы.
   Палитра страницы фиксированная — это обложка, она не зависит от темы. */
.login-page {
	--ink: #12151d;
	--ink-soft: #1a1f2b;
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
	padding: max(9dvh, 48px) 28px 32px;
}

/* ===== Шапка ===== */
.cover-date {
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 15px;
	color: var(--paper-dim);
	margin-bottom: 14px;
	animation: rise 0.55s ease-out both;
}

.cover-date::first-letter {
	text-transform: uppercase;
}

.cover-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: clamp(42px, 12vw, 52px);
	line-height: 1.04;
	letter-spacing: -0.015em;
	margin: 0 0 10px;
	animation: rise 0.55s ease-out 0.06s both;
}

.cover-sub {
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 19px;
	color: var(--paper-dim);
	margin: 0;
	animation: rise 0.55s ease-out 0.12s both;
}

/* ===== Форма: строки тетради ===== */
.cover-form {
	display: flex;
	flex-direction: column;
	gap: 26px;
	margin-top: max(5dvh, 32px);
	animation: rise 0.55s ease-out 0.18s both;
}

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
	padding: 8px 36px 9px 0;
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

/* Строка тетради: тонкая линия, при фокусе «зажигается» слева направо */
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

.eye-btn {
	position: absolute;
	right: 0;
	bottom: 9px;
	width: 30px;
	height: 30px;
	padding: 4px;
	background: none;
	border: none;
	color: var(--paper-dim);
	cursor: pointer;
	transition: color 0.2s ease;
}

.eye-btn:hover,
.eye-btn:focus-visible {
	color: var(--paper);
}

.eye-btn svg {
	width: 100%;
	height: 100%;
}

/* ===== Кнопка-лампа ===== */
.lamp-btn {
	margin-top: 14px;
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

.form-error {
	margin: 4px 0 0;
	font-size: 13.5px;
	line-height: 1.45;
	color: var(--coral);
}

/* ===== Низ ===== */
.cover-foot {
	margin-top: max(6dvh, 40px);
	display: flex;
	flex-direction: column;
	gap: 13px;
	animation: rise 0.55s ease-out 0.24s both;
}

.foot-line {
	margin: 0;
	font-size: 14.5px;
	display: flex;
	align-items: baseline;
	gap: 8px;
}

.foot-dim {
	color: var(--paper-dim);
}

.text-btn {
	background: none;
	border: none;
	padding: 0;
	font-family: inherit;
	font-size: inherit;
	cursor: pointer;
	transition: color 0.2s ease;
}

.text-btn.accent {
	color: var(--lamp);
	font-weight: 500;
}

.text-btn.accent:hover {
	color: var(--lamp-deep);
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

.demo-line {
	padding-top: 11px;
	border-top: 1px solid rgba(237, 230, 214, 0.1);
}

/* ===== Анимации ===== */
@keyframes rise {
	from {
		opacity: 0;
		transform: translateY(14px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.cover-date,
	.cover-title,
	.cover-sub,
	.cover-form,
	.cover-foot {
		animation: none;
	}
}

/* Невысокие экраны: ужимаем дыхание, чтобы не скроллило */
@media (max-height: 700px) {
	.cover {
		padding-top: 36px;
	}

	.cover-form {
		margin-top: 24px;
		gap: 20px;
	}
}
</style>
