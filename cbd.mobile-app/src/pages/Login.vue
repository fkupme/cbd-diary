<template>
	<div class="login-page">
		<div class="login-container">
			<!-- Header -->
			<div class="login-header">
				<div class="app-logo">🧠</div>
				<h1 class="app-title">{{ $t("login.appTitle") }}</h1>
				<p class="app-subtitle">
					{{
						isRegistering
							? $t("login.creatingAccount")
							: $t("login.signInTitle")
					}}
				</p>
			</div>

			<!-- Форма авторизации/регистрации -->
			<div class="auth-form">
				<div class="form-content">
					<!-- Email -->
					<div class="form-group">
						<CbdInput
							v-model="email"
							type="email"
							:label="$t('auth.email')"
							:placeholder="$t('login.emailPlaceholder')"
							icon="email"
							:error-message="emailError"
							@blur="validateEmail"
							@keyup.enter="handleSubmit"
						/>
					</div>

					<!-- Username (только для регистрации) -->
					<div v-if="isRegistering" class="form-group">
						<CbdInput
							v-model="username"
							type="text"
							:label="$t('login.usernameOptional')"
							:placeholder="$t('login.usernamePlaceholder')"
							icon="person"
							:error-message="usernameError"
							@blur="validateUsername"
							@keyup.enter="handleSubmit"
						/>
					</div>

					<!-- Пароль -->
					<div class="form-group">
						<CbdInput
							v-model="password"
							:type="showPassword ? 'text' : 'password'"
							:label="$t('auth.password')"
							:placeholder="
								isRegistering
									? $t('login.passwordCreate')
									: $t('login.passwordEnter')
							"
							icon="lock"
							:error-message="passwordError"
							@blur="validatePassword"
							@keyup.enter="handleSubmit"
						>
							<template #append>
								<q-btn
									type="button"
									@click="togglePasswordVisibility"
									class="password-toggle-btn"
									flat
									round
									dense
									:icon="showPassword ? 'visibility_off' : 'visibility'"
								/>
							</template>
						</CbdInput>
					</div>

					<!-- Подтверждение пароля (только для регистрации) -->
					<div v-if="isRegistering" class="form-group">
						<CbdInput
							v-model="confirmPassword"
							:type="showConfirmPassword ? 'text' : 'password'"
							:label="$t('login.confirmPasswordRequired')"
							:placeholder="$t('login.confirmPasswordRequired')"
							icon="lock"
							:error-message="confirmPasswordError"
							@blur="validateConfirmPassword"
							@keyup.enter="handleSubmit"
						>
							<template #append>
								<q-btn
									type="button"
									@click="toggleConfirmPasswordVisibility"
									class="password-toggle-btn"
									flat
									round
									dense
									:icon="showConfirmPassword ? 'visibility_off' : 'visibility'"
								/>
							</template>
						</CbdInput>
					</div>

					<!-- Кнопка отправки -->
					<CbdButton
						:loading="userStore.isLoading"
						:disabled="!isFormValid"
						variant="primary"
						size="lg"
						class="submit-btn"
						@click="handleSubmit"
					>
						{{
							isRegistering ? $t("login.submitCreate") : $t("login.submitLogin")
						}}
					</CbdButton>

					<!-- Ошибка -->
					<div v-if="userStore.error" class="error-message">
						{{ userStore.error }}
					</div>

					<!-- Переключение между входом и регистрацией -->
					<div class="auth-switch">
						<p class="switch-text">
							{{
								isRegistering ? $t("login.haveAccount") : $t("login.firstTime")
							}}
						</p>
						<q-btn
							type="button"
							@click="toggleAuthMode"
							class="switch-btn"
							flat
							no-caps
						>
							{{
								isRegistering
									? $t("login.switchToLogin")
									: $t("login.switchToRegister")
							}}
						</q-btn>
					</div>
				</div>

				<!-- Дополнительные ссылки -->
				<div class="auth-footer">
					<q-btn
						v-if="!isRegistering"
						type="button"
						@click="handleForgotPassword"
						class="forgot-link"
						flat
						no-caps
					>
						{{ $t("login.forgotPassword") }}
					</q-btn>

					<div class="demo-section">
						<p class="demo-text">{{ $t("login.tryDemo") }}</p>
						<CbdButton
							variant="ghost"
							size="sm"
							@click="handleDemoLogin"
							class="demo-btn"
						>
							{{ $t("login.loginAsDemo") }}
						</CbdButton>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { CbdButton, CbdInput } from "../components/ui";
import { useUserStore } from "../stores/user";

const router = useRouter();
const userStore = useUserStore();

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
		emailError.value = String((<any>window).$t?.("login.emailRequired") ?? "");
		return false;
	} else if (!emailRegex.test(email.value)) {
		emailError.value = String((<any>window).$t?.("login.emailInvalid") ?? "");
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
		usernameError.value = String(
			(<any>window).$t?.("login.usernameTooShort") ?? ""
		);
		return false;
	} else {
		usernameError.value = "";
		return true;
	}
}

function validatePassword() {
	if (!password.value) {
		passwordError.value = String(
			(<any>window).$t?.("login.passwordRequired") ?? ""
		);
		return false;
	} else if (isRegistering.value && password.value.length < 6) {
		passwordError.value = String((<any>window).$t?.("login.passwordMin") ?? "");
		return false;
	} else {
		passwordError.value = "";
		return true;
	}
}

function validateConfirmPassword() {
	if (isRegistering.value) {
		if (!confirmPassword.value) {
			confirmPasswordError.value = String(
				(<any>window).$t?.("login.confirmPasswordRequired") ?? ""
			);
			return false;
		} else if (password.value !== confirmPassword.value) {
			confirmPasswordError.value = String(
				(<any>window).$t?.("login.passwordsNotMatch") ?? ""
			);
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

		// Проверяем, нужно ли заполнить профиль
		if (!result.user.profile?.firstName && !result.user.profile?.lastName) {
			router.push("/profile");
		} else {
			router.push("/home");
		}
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
.login-page {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(
		135deg,
		var(--bg-secondary) 0%,
		var(--bg-primary) 100%
	);
	padding: var(--space-4);
	transition: background-color var(--transition-base) var(--ease-in-out);
}

.login-container {
	width: 100%;
	max-width: 420px;
	animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
	from {
		opacity: 0;
		transform: translateY(30px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.login-header {
	text-align: center;
	margin-bottom: var(--space-8);
}

.app-logo {
	width: 80px;
	height: 80px;
	margin: 0 auto var(--space-4);
	background: linear-gradient(135deg, var(--primary), var(--primary-hover));
	border-radius: var(--radius-2xl);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-inverse);
	font-size: var(--text-4xl);
	font-weight: var(--font-bold);
	box-shadow: var(--shadow-lg);
	animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
	0%,
	100% {
		transform: scale(1);
		box-shadow: var(--shadow-lg);
	}
	50% {
		transform: scale(1.05);
		box-shadow: 0 20px 40px rgba(96, 165, 250, 0.3);
	}
}

.app-title {
	font-size: var(--text-3xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
	margin-bottom: var(--space-2);
	background: linear-gradient(135deg, var(--primary), var(--primary-hover));
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

.app-subtitle {
	font-size: var(--text-base);
	color: var(--text-secondary);
	font-weight: var(--font-medium);
}

.auth-form {
	background: var(--bg-primary);
	border-radius: var(--radius-xl);
	padding: var(--space-8);
	box-shadow: var(--shadow-xl);
	border: 1px solid var(--border-color);
	backdrop-filter: blur(10px);
}

.form-content {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.form-group {
	position: relative;
}

.password-toggle-btn {
	background: none;
	border: none;
	color: var(--text-secondary);
	cursor: pointer;
	padding: var(--space-1);
	border-radius: var(--radius-sm);
	transition: all var(--transition-fast) var(--ease-in-out);
	display: flex;
	align-items: center;
	justify-content: center;
}

.password-toggle-btn:hover {
	color: var(--primary);
	background: var(--bg-hover);
}

.submit-btn {
	width: 100%;
	height: 52px;
	font-weight: var(--font-semibold);
	margin-top: var(--space-2);
	border-radius: var(--radius-lg);
	transition: all var(--transition-base) var(--ease-in-out);
}

.submit-btn:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: var(--shadow-lg);
}

.submit-btn:active:not(:disabled) {
	transform: translateY(0);
}

.error-message {
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.2);
	color: var(--error);
	padding: var(--space-3);
	border-radius: var(--radius-base);
	font-size: var(--text-sm);
	text-align: center;
	animation: shake 0.5s ease-in-out;
}

@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	10%,
	30%,
	50%,
	70%,
	90% {
		transform: translateX(-5px);
	}
	20%,
	40%,
	60%,
	80% {
		transform: translateX(5px);
	}
}

.auth-switch {
	text-align: center;
	margin-top: var(--space-6);
	padding-top: var(--space-6);
	border-top: 1px solid var(--border-color);
}

.switch-text {
	color: var(--text-secondary);
	margin-bottom: var(--space-2);
	font-size: var(--text-sm);
}

.switch-btn {
	background: none;
	border: none;
	color: var(--primary);
	font-weight: var(--font-semibold);
	cursor: pointer;
	text-decoration: underline;
	transition: all var(--transition-fast) var(--ease-in-out);
	font-size: var(--text-sm);
}

.switch-btn:hover {
	color: var(--primary-hover);
}

.oauth-section {
	margin-top: var(--space-6);
}

.oauth-divider {
	display: flex;
	align-items: center;
	margin: var(--space-6) 0 var(--space-4);
	color: var(--text-tertiary);
	font-size: var(--text-sm);
}

.oauth-divider::before,
.oauth-divider::after {
	content: "";
	flex: 1;
	height: 1px;
	background: var(--border-color);
}

.oauth-divider span {
	padding: 0 var(--space-4);
}

.oauth-buttons {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-3);
}

.oauth-btn {
	border: 1px solid var(--border-color);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.oauth-btn:hover {
	border-color: var(--primary);
	transform: translateY(-1px);
}

.auth-footer {
	margin-top: var(--space-6);
	text-align: center;
}

.forgot-link {
	background: none;
	border: none;
	color: var(--primary);
	font-size: var(--text-sm);
	text-decoration: underline;
	cursor: pointer;
	margin-bottom: var(--space-4);
	transition: color var(--transition-fast) var(--ease-in-out);
}

.forgot-link:hover {
	color: var(--primary-hover);
}

.demo-section {
	padding-top: var(--space-4);
	border-top: 1px solid var(--border-color);
}

.demo-text {
	color: var(--text-secondary);
	font-size: var(--text-sm);
	margin-bottom: var(--space-3);
}

.demo-btn {
	font-size: var(--text-sm);
	border: 1px dashed var(--border-color);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.demo-btn:hover {
	border-color: var(--primary);
	color: var(--primary);
	background: var(--bg-hover);
}

/* Адаптация для мобильных устройств */
@media (max-width: 768px) {
	.login-page {
		padding: var(--space-2);
	}

	.login-container {
		max-width: 100%;
	}

	.auth-form {
		padding: var(--space-6);
	}

	.app-title {
		font-size: var(--text-2xl);
	}

	.oauth-buttons {
		grid-template-columns: 1fr;
	}
}

/* Темная тема */
@media (prefers-color-scheme: dark) {
	.auth-form {
		backdrop-filter: blur(10px);
		background: rgba(var(--bg-primary-rgb), 0.8);
	}

	.app-logo {
		box-shadow: 0 0 30px rgba(96, 165, 250, 0.3);
	}
}

/* Исправление для поддержки CSS переменных в градиентах */
.app-title {
	background: var(--primary);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

@supports (
	background: linear-gradient(135deg, var(--primary), var(--primary-hover))
) {
	.app-title {
		background: linear-gradient(135deg, var(--primary), var(--primary-hover));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
}
</style> 