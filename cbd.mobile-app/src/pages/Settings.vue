<template>
	<div class="settings-page diary-theme">
		<div class="settings-inner">
			<header class="settings-head">
				<h1 class="settings-title">{{ t("settings.title") }}</h1>
			</header>

			<!-- Профиль пользователя -->
			<section class="set-group">
				<h2 class="group-label">{{ t("settings.profile") }}</h2>
				<div class="group-card">
					<button class="set-row" @click="editProfile">
						<span class="set-left">
							<q-icon name="person" class="set-icon" />
							<span class="set-label"
								>{{ t("common.edit") }}
								{{ t("settings.profile").toLowerCase() }}</span
							>
						</span>
						<q-icon name="chevron_right" class="set-chevron" />
					</button>

					<button class="set-row" @click="exportData">
						<span class="set-left">
							<q-icon name="download" class="set-icon" />
							<span class="set-label">{{
								t("settings.exportData", "Экспорт данных")
							}}</span>
						</span>
						<q-icon name="chevron_right" class="set-chevron" />
					</button>
				</div>
			</section>

			<!-- Уведомления -->
			<section class="set-group">
				<h2 class="group-label">{{ t("settings.notifications") }}</h2>
				<div class="group-card">
					<div class="set-row">
						<span class="set-left">
							<q-icon name="notifications_active" class="set-icon" />
							<span class="set-label">{{
								t("settings.pushEnabled", "Получать уведомления")
							}}</span>
						</span>
						<button
							type="button"
							class="set-switch"
							:class="{ 'is-on': pushEnabled }"
							role="switch"
							:aria-checked="pushEnabled"
							@click="
								pushEnabled = !pushEnabled;
								onTogglePush(pushEnabled);
							"
						>
							<span class="switch-track" aria-hidden="true">
								<span class="switch-thumb"></span>
							</span>
						</button>
					</div>
					<div class="set-row">
						<span class="set-left">
							<q-icon name="notifications" class="set-icon" />
							<span class="set-label">{{
								t("settings.reminders", "Напоминания о записях")
							}}</span>
						</span>
						<button
							type="button"
							class="set-switch"
							:class="{ 'is-on': settings.notifications.reminders }"
							role="switch"
							:aria-checked="settings.notifications.reminders"
							@click="
								settings.notifications.reminders =
									!settings.notifications.reminders;
								saveSettings();
							"
						>
							<span class="switch-track" aria-hidden="true">
								<span class="switch-thumb"></span>
							</span>
						</button>
					</div>
					<div class="set-row">
						<span class="set-left">
							<q-icon name="schedule" class="set-icon" />
							<span class="set-label">{{
								t("settings.dailyInsights", "Ежедневные инсайты")
							}}</span>
						</span>
						<button
							type="button"
							class="set-switch"
							:class="{ 'is-on': settings.notifications.insights }"
							role="switch"
							:aria-checked="settings.notifications.insights"
							@click="
								settings.notifications.insights =
									!settings.notifications.insights;
								saveSettings();
							"
						>
							<span class="switch-track" aria-hidden="true">
								<span class="switch-thumb"></span>
							</span>
						</button>
					</div>
				</div>
			</section>

			<!-- Приложение -->
			<section class="set-group">
				<h2 class="group-label">{{ t("settings.app", "Приложение") }}</h2>
				<div class="group-card">
					<!-- Переключатель светлой темы временно скрыт -->
					<div v-if="showThemeToggle" class="set-row">
						<span class="set-left">
							<q-icon name="dark_mode" class="set-icon" />
							<span class="set-label">{{
								t("settings.darkMode", "Темная тема")
							}}</span>
						</span>
						<button
							type="button"
							class="set-switch"
							:class="{ 'is-on': settings.app.darkMode }"
							role="switch"
							:aria-checked="settings.app.darkMode"
							@click="
								settings.app.darkMode = !settings.app.darkMode;
								toggleDarkMode(settings.app.darkMode);
							"
						>
							<span class="switch-track" aria-hidden="true">
								<span class="switch-thumb"></span>
							</span>
						</button>
					</div>

					<button class="set-row" @click="showLanguageDialog = true">
						<span class="set-left">
							<q-icon name="language" class="set-icon" />
							<span class="set-label">{{ t("settings.language") }}</span>
						</span>
						<span class="set-value">
							<span>{{ currentLanguageInfo.name }}</span>
							<q-icon name="chevron_right" class="set-chevron" />
						</span>
					</button>
				</div>
			</section>

			<!-- Безопасность -->
			<section class="set-group">
				<h2 class="group-label">{{ t("settings.privacy") }}</h2>
				<div class="group-card">
					<div class="set-row">
						<span class="set-left">
							<q-icon name="fingerprint" class="set-icon" />
							<span class="set-label">Биометрический вход</span>
						</span>
						<button
							type="button"
							class="set-switch"
							:class="{ 'is-on': settings.security.biometric }"
							role="switch"
							:aria-checked="settings.security.biometric"
							@click="
								settings.security.biometric =
									!settings.security.biometric;
								saveSettings();
							"
						>
							<span class="switch-track" aria-hidden="true">
								<span class="switch-thumb"></span>
							</span>
						</button>
					</div>

					<button class="set-row" @click="clearData">
						<span class="set-left">
							<q-icon name="delete_forever" class="set-icon danger" />
							<span class="set-label danger">{{
								t("settings.clearAll", "Очистить все данные")
							}}</span>
						</span>
						<q-icon name="chevron_right" class="set-chevron" />
					</button>
				</div>
			</section>

			<!-- О приложении -->
			<section class="set-group">
				<h2 class="group-label">{{ t("settings.about") }}</h2>
				<div class="group-card">
					<div class="set-row">
						<span class="set-left">
							<q-icon name="info" class="set-icon" />
							<span class="set-label">{{ t("settings.version") }}</span>
						</span>
						<span class="set-value">1.0.0</span>
					</div>

					<button class="set-row" @click="showAbout">
						<span class="set-left">
							<q-icon name="help" class="set-icon" />
							<span class="set-label">{{ t("settings.help") }}</span>
						</span>
						<q-icon name="chevron_right" class="set-chevron" />
					</button>

					<button class="set-row" @click="showPrivacy">
						<span class="set-left">
							<q-icon name="privacy_tip" class="set-icon" />
							<span class="set-label">{{ t("settings.privacyPolicy") }}</span>
						</span>
						<q-icon name="chevron_right" class="set-chevron" />
					</button>

					<button class="set-row" @click="openLogs">
						<span class="set-left">
							<q-icon name="bug_report" class="set-icon" />
							<span class="set-label">{{ t("settings.debugLogs") }}</span>
						</span>
						<q-icon name="chevron_right" class="set-chevron" />
					</button>
				</div>
			</section>

			<!-- Выход -->
			<button class="logout-btn" @click="logout">
				<q-icon name="logout" />
				{{ t("settings.logout") }}
			</button>
		</div>

		<!-- Диалог выбора языка -->
		<q-dialog v-model="showLanguageDialog">
			<q-card class="language-dialog diary-theme">
				<div class="lang-title">{{ t("settings.languageSelect") }}</div>
				<ul class="lang-list">
					<li
						v-for="lang in availableLanguages"
						:key="lang.code"
						class="lang-item"
						:class="{ active: currentLanguage === lang.code }"
						@click="selectLanguage(lang.code)"
					>
						<span>{{ lang.name }}</span>
						<q-icon
							v-if="currentLanguage === lang.code"
							name="check"
							class="lang-check"
						/>
					</li>
				</ul>
			</q-card>
		</q-dialog>
	</div>
</template>

<script setup lang="ts">
import { Dark } from "quasar";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLocalization } from "../composables/useLocalization";
import { userService } from "../services/api";
import { ServiceManager } from "../services/ServiceManager";
// import { BiometricService } from "../services/BiometricService"; // пока не используется
import { useUserStore } from "../stores/user";

interface AppSettings {
	notifications: {
		reminders: boolean;
		insights: boolean;
	};
	app: {
		darkMode: boolean;
		language: string;
	};
	security: {
		biometric: boolean;
	};
}

const router = useRouter();
const userStore = useUserStore();
const {
	t,
	currentLanguage,
	currentLanguageInfo,
	availableLanguages,
	setLanguage,
} = useLocalization();

const settings = ref<AppSettings>({
	notifications: {
		reminders: true,
		insights: false,
	},
	app: {
		darkMode: false,
		language: "ru",
	},
	security: {
		biometric: false,
	},
});

const showLanguageDialog = ref(false);
const pushEnabled = ref<boolean>(true);

// Переключатель светлой/тёмной темы временно скрыт (приложение в «вечерней» палитре).
// Поставь true, чтобы вернуть свитч в раздел «Приложение».
const showThemeToggle = false;

function editProfile() {
	router.push("/profile");
}

function exportData() {
	console.log(
		t("settings.exportSoon", "Экспорт данных (функция будет добавлена)")
	);
}

function saveSettings() {
	localStorage.setItem("cbd-diary-settings", JSON.stringify(settings.value));

	// Сохраняем настройку биометрии отдельно для быстрого доступа
	localStorage.setItem(
		"biometric_enabled",
		settings.value.security.biometric.toString()
	);

	console.log("Настройки сохранены");
}

function toggleDarkMode(value: boolean) {
	settings.value.app.darkMode = value;

	// Синхронизируем с Quasar Dark плагином
	Dark.set(value);

	// Синхронизируем с классом на documentElement
	if (value) {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}

	saveSettings();
}

async function selectLanguage(code: string) {
	try {
		await setLanguage(code);
		settings.value.app.language = code;
		showLanguageDialog.value = false;
		saveSettings();
		console.log("Язык изменен на:", code);
	} catch (error) {
		console.error("Ошибка смены языка:", error);
	}
}

function clearData() {
	if (
		confirm(
			String(
				t(
					"settings.confirmClear",
					"Вы уверены, что хотите удалить все данные? Это действие нельзя отменить."
				)
			)
		)
	) {
		localStorage.clear();
		console.log(t("settings.cleared", "Данные очищены"));
		router.push("/login");
	}
}

function showAbout() {
	// «Справка» теперь ведёт на страницу «Как это работает» (FAQ по КПТ)
	router.push("/help");
}

function showPrivacy() {
	alert(
		String(
			t(
				"settings.privacyText",
				"Политика конфиденциальности будет добавлена в следующих обновлениях"
			)
		)
	);
}

function openLogs() {
	router.push("/logs");
}

async function logout() {
	try {
		await userStore.logout();
		router.push("/login");
	} catch (error) {
		console.error("Ошибка выхода:", error);
	}
}

// Тестовые методы временно отключены

async function onTogglePush(value: boolean) {
	try {
		await userService.updateCurrentUser({ pushEnabled: value });
		console.log("🔔 pushEnabled updated:", value);
		// опционально обновим юзера в сторе
		await userStore.refreshUser();
	} catch (e) {
		console.warn("Failed to update pushEnabled", e);
	}
}

function loadSettings() {
	const saved = localStorage.getItem("cbd-diary-settings");
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			settings.value = { ...settings.value, ...parsed };

			// Синхронизируем темную тему с Quasar
			if (settings.value.app.darkMode !== undefined) {
				Dark.set(settings.value.app.darkMode);

				if (settings.value.app.darkMode) {
					document.documentElement.classList.add("dark");
				} else {
					document.documentElement.classList.remove("dark");
				}
			}
		} catch (error) {
			console.error("Ошибка загрузки настроек:", error);
		}
	} else {
		// Если настроек нет, синхронизируем с текущим состоянием Quasar Dark
		settings.value.app.darkMode = Dark.isActive;
	}

	// Загружаем настройку биометрии
	const biometricEnabled = localStorage.getItem("biometric_enabled");
	if (biometricEnabled !== null) {
		settings.value.security.biometric = biometricEnabled === "true";
	}
}

onMounted(() => {
	loadSettings();
	try {
		const me = userStore.user as any;
		if (me && typeof me.pushEnabled !== "undefined") {
			pushEnabled.value = !!me.pushEnabled;
		}
	} catch {}
	// Тихо подтягиваем подписку уведомлений через сокеты
	try {
		const sm = ServiceManager.getInstance();
		void sm.notification.initialize();
	} catch {}
});
</script>

<style scoped>
.settings-page {
	padding-bottom: 96px;
}

.settings-inner {
	width: 100%;
	max-width: 440px;
	margin: 0 auto;
	padding: max(6dvh, 36px) 24px 24px;
}

/* ===== Шапка ===== */
.settings-head {
	margin-bottom: 22px;
	animation: rise 0.5s ease-out both;
}
.settings-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: clamp(30px, 9vw, 38px);
	letter-spacing: -0.015em;
	margin: 0;
}

/* ===== Группы ===== */
.set-group {
	margin-bottom: 26px;
	animation: rise 0.5s ease-out 0.06s both;
}

.group-label {
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--paper-dim);
	margin: 0 0 10px 4px;
}

.group-card {
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 16px;
	overflow: hidden;
}

/* ===== Строки ===== */
.set-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
	padding: 14px 16px;
	border: none;
	border-bottom: 1px solid var(--line);
	background: transparent;
	color: inherit;
	font-family: inherit;
	text-align: left;
	cursor: pointer;
	transition: background 0.18s ease;
}
.set-row:last-child {
	border-bottom: none;
}
button.set-row:hover {
	background: rgba(240, 178, 100, 0.06);
}

.set-left {
	display: flex;
	align-items: center;
	gap: 13px;
	min-width: 0;
}

.set-icon {
	font-size: 21px;
	color: var(--paper-dim);
	width: 24px;
	flex-shrink: 0;
}
.set-icon.danger {
	color: var(--coral);
}

.set-label {
	font-size: 15px;
	color: var(--paper);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.set-label.danger {
	color: var(--coral);
}

.set-value {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 14px;
	color: var(--paper-dim);
	flex-shrink: 0;
}

.set-chevron {
	font-size: 20px;
	color: rgba(151, 144, 126, 0.6);
	flex-shrink: 0;
}

/* ===== Переключатель (как в онбординге, шаг 3) ===== */
.set-switch {
	flex-shrink: 0;
	border: none;
	background: none;
	padding: 0;
	cursor: pointer;
}
.switch-track {
	display: block;
	width: 46px;
	height: 26px;
	border-radius: 999px;
	background: rgba(237, 230, 214, 0.18);
	position: relative;
	transition: background 0.25s ease;
}
.switch-thumb {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--paper-dim);
	transition: transform 0.25s ease, background 0.25s ease;
}
.set-switch.is-on .switch-track {
	background: rgba(240, 178, 100, 0.35);
}
.set-switch.is-on .switch-thumb {
	transform: translateX(20px);
	background: var(--lamp);
}
.set-switch:focus-visible .switch-track {
	outline: 2px solid var(--lamp);
	outline-offset: 2px;
}

/* ===== Выход ===== */
.logout-btn {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	margin-top: 8px;
	appearance: none;
	border: 1px solid rgba(226, 109, 92, 0.45);
	background: transparent;
	color: var(--coral);
	font-family: inherit;
	font-size: 15px;
	font-weight: 500;
	padding: 14px;
	border-radius: 14px;
	cursor: pointer;
	transition: background 0.2s ease;
}
.logout-btn .q-icon {
	font-size: 19px;
}
.logout-btn:hover {
	background: rgba(226, 109, 92, 0.1);
}

/* ===== Диалог языка ===== */
.language-dialog {
	min-width: 280px;
	min-height: auto;
	padding: 20px;
	border-radius: 18px !important;
	border: 1px solid var(--line);
	box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.7);
}
.lang-title {
	font-family: "Spectral", Georgia, serif;
	font-size: 20px;
	margin-bottom: 14px;
	color: var(--paper);
}
.lang-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.lang-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 14px;
	border-radius: 11px;
	color: var(--paper);
	font-size: 15px;
	cursor: pointer;
	transition: background 0.18s ease, color 0.18s ease;
}
.lang-item:hover {
	background: rgba(237, 230, 214, 0.06);
}
.lang-item.active {
	color: var(--lamp);
	background: rgba(240, 178, 100, 0.08);
}
.lang-check {
	font-size: 19px;
	color: var(--lamp);
}

:deep(.q-dialog__backdrop) {
	background: rgba(8, 10, 14, 0.7);
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
	.settings-head,
	.set-group {
		animation: none;
	}
}
</style> 