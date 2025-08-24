<template>
	<div class="settings-page">
		<div class="settings-container">
			<h1 class="page-title">{{ t("settings.title") }}</h1>

			<!-- Профиль пользователя -->
			<div class="settings-section">
				<h2 class="section-title">{{ t("settings.profile") }}</h2>
				<div class="settings-list">
					<q-item class="setting-item" clickable @click="editProfile">
						<q-item-section>
							<div class="setting-info">
								<q-icon name="person" class="setting-icon" />
								<span class="setting-label"
									>{{ t("common.edit") }}
									{{ t("settings.profile").toLowerCase() }}</span
								>
							</div>
						</q-item-section>
						<q-item-section side>
							<q-icon name="chevron_right" class="setting-arrow" />
						</q-item-section>
					</q-item>

					<q-item class="setting-item" clickable @click="exportData">
						<q-item-section>
							<div class="setting-info">
								<q-icon name="download" class="setting-icon" />
								<span class="setting-label">{{
									t("settings.exportData", "Экспорт данных")
								}}</span>
							</div>
						</q-item-section>
						<q-item-section side>
							<q-icon name="chevron_right" class="setting-arrow" />
						</q-item-section>
					</q-item>
				</div>
			</div>

			<!-- Уведомления -->
			<div class="settings-section">
				<h2 class="section-title">{{ t("settings.notifications") }}</h2>
				<div class="settings-list">
					<div class="setting-item">
						<div class="setting-info">
							<q-icon name="notifications_active" class="setting-icon" />
							<span class="setting-label">{{
								t("settings.pushEnabled", "Получать уведомления")
							}}</span>
						</div>
						<q-toggle
							v-model="pushEnabled"
							color="primary"
							@update:model-value="onTogglePush"
						/>
					</div>
					<div class="setting-item">
						<div class="setting-info">
							<q-icon name="notifications" class="setting-icon" />
							<span class="setting-label">{{
								t("settings.reminders", "Напоминания о записях")
							}}</span>
						</div>
						<q-toggle
							v-model="settings.notifications.reminders"
							color="primary"
							@update:model-value="saveSettings"
						/>
					</div>
					<div class="setting-item">
						<div class="setting-info">
							<q-icon name="schedule" class="setting-icon" />
							<span class="setting-label">{{
								t("settings.dailyInsights", "Ежедневные инсайты")
							}}</span>
						</div>
						<q-toggle
							v-model="settings.notifications.insights"
							color="primary"
							@update:model-value="saveSettings"
						/>
					</div>
				</div>
			</div>

			<!-- Приложение -->
			<div class="settings-section">
				<h2 class="section-title">{{ t("settings.app", "Приложение") }}</h2>
				<div class="settings-list">
					<div class="setting-item">
						<div class="setting-info">
							<q-icon name="dark_mode" class="setting-icon" />
							<span class="setting-label">{{
								t("settings.darkMode", "Темная тема")
							}}</span>
						</div>
						<q-toggle
							v-model="settings.app.darkMode"
							color="primary"
							@update:model-value="toggleDarkMode"
						/>
					</div>

					<q-item
						class="setting-item"
						clickable
						@click="showLanguageDialog = true"
					>
						<q-item-section>
							<div class="setting-info">
								<q-icon name="language" class="setting-icon" />
								<span class="setting-label">{{ t("settings.language") }}</span>
							</div>
						</q-item-section>
						<q-item-section side>
							<div class="setting-value">
								<span>{{ currentLanguageInfo.name }}</span>
								<q-icon name="chevron_right" class="setting-arrow" />
							</div>
						</q-item-section>
					</q-item>
				</div>
			</div>

			<!-- Безопасность -->
			<div class="settings-section">
				<h2 class="section-title">{{ t("settings.privacy") }}</h2>
				<div class="settings-list">
					<div class="setting-item">
						<div class="setting-info">
							<q-icon name="fingerprint" class="setting-icon" />
							<span class="setting-label">Биометрический вход</span>
						</div>
						<q-toggle
							v-model="settings.security.biometric"
							color="primary"
							@update:model-value="saveSettings"
						/>
					</div>

					<q-item class="setting-item" clickable @click="clearData">
						<q-item-section>
							<div class="setting-info">
								<q-icon name="delete_forever" class="setting-icon danger" />
								<span class="setting-label danger">{{
									t("settings.clearAll", "Очистить все данные")
								}}</span>
							</div>
						</q-item-section>
						<q-item-section side>
							<q-icon name="chevron_right" class="setting-arrow" />
						</q-item-section>
					</q-item>
				</div>
			</div>

			<!-- О приложении -->
			<div class="settings-section">
				<h2 class="section-title">{{ t("settings.about") }}</h2>
				<div class="settings-list">
					<div class="setting-item">
						<div class="setting-info">
							<q-icon name="info" class="setting-icon" />
							<span class="setting-label">{{ t("settings.version") }}</span>
						</div>
						<span class="setting-value">1.0.0</span>
					</div>

					<q-item class="setting-item" clickable @click="showAbout">
						<q-item-section>
							<div class="setting-info">
								<q-icon name="help" class="setting-icon" />
								<span class="setting-label">{{ t("settings.help") }}</span>
							</div>
						</q-item-section>
						<q-item-section side>
							<q-icon name="chevron_right" class="setting-arrow" />
						</q-item-section>
					</q-item>

					<q-item class="setting-item" clickable @click="showPrivacy">
						<q-item-section>
							<div class="setting-info">
								<q-icon name="privacy_tip" class="setting-icon" />
								<span class="setting-label">{{
									t("settings.privacyPolicy")
								}}</span>
							</div>
						</q-item-section>
						<q-item-section side>
							<q-icon name="chevron_right" class="setting-arrow" />
						</q-item-section>
					</q-item>

					<q-item class="setting-item" clickable @click="openLogs">
						<q-item-section>
							<div class="setting-info">
								<q-icon name="bug_report" class="setting-icon" />
								<span class="setting-label">{{ t("settings.debugLogs") }}</span>
							</div>
						</q-item-section>
						<q-item-section side>
							<q-icon name="chevron_right" class="setting-arrow" />
						</q-item-section>
					</q-item>
				</div>
			</div>

			<!-- Выход -->
			<div class="logout-section">
				<CbdButton variant="ghost" size="lg" class="logout-btn" @click="logout">
					{{ t("settings.logout") }}
				</CbdButton>
			</div>

			<!-- Секция тестов и отладочных опций скрыта до подключения -->
			<!-- Dev/Test security section removed -->
		</div>

		<!-- Диалог выбора языка -->
		<q-dialog v-model="showLanguageDialog">
			<q-card class="language-dialog">
				<q-card-section>
					<div class="text-h6">{{ t("settings.languageSelect") }}</div>
				</q-card-section>

				<q-card-section>
					<q-list>
						<q-item
							v-for="lang in availableLanguages"
							:key="lang.code"
							clickable
							@click="selectLanguage(lang.code)"
						>
							<q-item-section>{{ lang.name }}</q-item-section>
							<q-item-section side v-if="currentLanguage === lang.code">
								<q-icon name="check" color="primary" />
							</q-item-section>
						</q-item>
					</q-list>
				</q-card-section>
			</q-card>
		</q-dialog>
	</div>
</template>

<script setup lang="ts">
import { Dark } from "quasar";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { CbdButton } from "../components/ui";
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
	alert(
		String(
			t(
				"settings.aboutText",
				"CBD Дневник v1.0.0\nПриложение для отслеживания эмоций и настроения"
			)
		)
	);
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
	min-height: 100vh;
	background: var(--bg-secondary);
	padding-bottom: 80px;
	transition: background-color var(--transition-base) var(--ease-in-out);
}

.settings-container {
	max-width: 500px;
	margin: 0 auto;
	padding: var(--space-4);
}

.page-title {
	font-size: var(--text-3xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
	margin-bottom: var(--space-6);
}

.settings-section {
	margin-bottom: var(--space-6);
}

.section-title {
	font-size: var(--text-xl);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	margin-bottom: var(--space-4);
}

.settings-list {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	overflow: hidden;
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--border-color);
}

.setting-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: var(--space-4);
	border: none;
	background: transparent;
	width: 100%;
	cursor: pointer;
	transition: background-color var(--transition-fast) var(--ease-in-out);
	border-bottom: 1px solid var(--border-color);
}

.setting-item:last-child {
	border-bottom: none;
}

.setting-item:hover {
	background: var(--bg-hover);
}

.setting-info {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.setting-icon {
	font-size: 20px;
	color: var(--text-secondary);
	width: 24px;
}

.setting-icon.danger {
	color: var(--error);
}

.setting-label {
	font-size: var(--text-base);
	color: var(--text-primary);
}

.setting-label.danger {
	color: var(--error);
}

.setting-value {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	font-size: var(--text-base);
	color: var(--text-secondary);
}

.setting-arrow {
	font-size: 16px;
	color: var(--text-tertiary);
}

.logout-section {
	margin-top: var(--space-8);
	text-align: center;
}

.logout-btn {
	width: 100%;
	color: var(--error) !important;
	border-color: var(--error) !important;
}

.logout-btn:hover {
	background: var(--error-bg) !important;
	color: var(--error) !important;
}

.language-dialog {
	min-width: 300px;
	background: var(--bg-primary);
}

.language-dialog .q-list .q-item {
	padding: var(--space-3) var(--space-4);
}

/* Стили для переключателей */
:deep(.q-toggle .q-toggle__track) {
	background: var(--border-color);
}

:deep(.q-toggle .q-toggle__thumb) {
	background: var(--bg-primary);
	box-shadow: var(--shadow-sm);
}

:deep(.q-toggle.q-toggle--truthy .q-toggle__track) {
	background: var(--primary);
}

/* Темная тема для диалогов */
:deep(.q-dialog__backdrop) {
	background: var(--bg-overlay);
}

:deep(.q-card) {
	background: var(--bg-primary);
	color: var(--text-primary);
}

:deep(.q-item) {
	color: var(--text-primary);
}

:deep(.q-item:hover) {
	background: var(--bg-hover);
}

:deep(.q-item__section--side) {
	color: var(--primary);
}
</style> 