<template>
	<q-layout view="lHh Lpr lFf">
		<q-page-container>
			<router-view />
		</q-page-container>

		<CbdTabBar
			v-if="showTabBar"
			:tabs="tabs"
			:model-value="activeTab"
			@tab-change="handleTabChange"
			@add-click="handleAddClick"
			@update:model-value="activeTab = $event"
		/>
	</q-layout>
</template>

<script setup lang="ts">
import {
	computed,
	onBeforeMount,
	onMounted,
	onUnmounted,
	ref,
	watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Tab } from "./components/ui";
import { CbdTabBar } from "./components/ui";
import { useBiometricLock } from "./composables/useBiometricLock";
import { ServiceManager } from "./services";

const route = useRoute();
const router = useRouter();

const activeTab = ref("home");

// Подключаем биометрическую блокировку
useBiometricLock();

// Инициализация уведомлений при старте приложения
onBeforeMount(() => {
	try {
		console.log("[App] Initializing notifications...");
		const sm = ServiceManager.getInstance();
		void sm.notification.initialize();
	} catch (e) {
		console.warn("[App] Notification init failed", e);
	}
});

// Слушатель кастомного события для перехода на создание записи
const handleCreateEntry = () => {
	try {
		router.push("/add-entry");
	} catch (e) {
		console.warn("[App] Failed to navigate to add-entry", e);
	}
};

onMounted(() => {
	window.addEventListener(
		"cbd:create-entry",
		handleCreateEntry as EventListener
	);
});

onUnmounted(() => {
	window.removeEventListener(
		"cbd:create-entry",
		handleCreateEntry as EventListener
	);
});

// Табы для навигации
const tabs: Tab[] = [
	{ name: "home", icon: "home" },
	{ name: "diary", icon: "book" },
	{ name: "analytics", icon: "analytics" },
	{ name: "settings", icon: "settings" },
];

// Определяем, нужно ли показывать таб-бар
const showTabBar = computed(() => {
	const hidden = route.meta.hideTabBar === true;
	return !hidden;
});

watch(
	() => route.fullPath,
	() => {
		// Чат на всю высоту экрана
		if (route.name === "Chat" || route.name === "ChatByEntry") {
			document.documentElement.style.setProperty("height", "100%");
			document.body.style.setProperty("height", "100%");
			document.body.style.setProperty("min-height", "100dvh");
		} else {
			document.documentElement.style.removeProperty("height");
			document.body.style.removeProperty("height");
			document.body.style.removeProperty("min-height");
		}
	},
	{ immediate: true }
);

// Синхронизируем активный таб с роутом.
// Имена роутов капитализированы ("Diary"), а имена табов — строчные ("diary"),
// поэтому сравниваем без учёта регистра, иначе прямой переход/перезагрузка
// не подсвечивает нужный таб.
watch(
	() => route.name,
	(newRouteName) => {
		if (newRouteName && typeof newRouteName === "string") {
			const match = tabs.find(
				(tab) => tab.name.toLowerCase() === newRouteName.toLowerCase()
			);
			if (match) {
				activeTab.value = match.name;
			}
		}
	},
	{ immediate: true }
);

watch(
	() => activeTab.value,
	(newActiveTab) => {
		const routeName = String(route.name || "").toLowerCase();
		if (newActiveTab.toLowerCase() !== routeName) {
			router.push(`/${newActiveTab}`);
		}
	}
);

function handleTabChange(tab: Tab) {
	if (tab.name !== route.name) {
		router.push(`/${tab.name}`);
	}
}

function handleAddClick() {
	// Кнопка «+» в таб-баре открывает форму создания события напрямую.
	// Голосовой захват остаётся главным сценарием на домашней (орб → /capture).
	router.push("/add-entry");
}

// Проверяем настройки темы при загрузке приложения
onBeforeMount(() => {
	const savedSettings = localStorage.getItem("cbd-diary-settings");
	if (savedSettings) {
		try {
			const settings = JSON.parse(savedSettings);
			if (settings.app?.darkMode) {
				document.documentElement.classList.add("dark");
			}
		} catch (error) {
			console.error("Ошибка загрузки настроек темы:", error);
		}
	}
});
</script>

<style>
/* Глобальные стили для приложения */
#app {
	font-family: var(--font-primary);
	color: var(--text-primary);
	background: var(--bg-secondary);
	min-height: 100vh;
}

/* Убираем дефолтные отступы */
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

/* Плавный переход при смене темы */
body {
	transition: background-color var(--transition-slow) var(--ease-in-out),
		color var(--transition-slow) var(--ease-in-out);
}

/* Стили для Quasar компонентов */
.q-page {
	background: transparent;
}

.q-layout {
	background: var(--bg-secondary);
}

/* Анимации для роутера */
.router-enter-active,
.router-leave-active {
	transition: opacity var(--transition-base) var(--ease-in-out),
		transform var(--transition-base) var(--ease-in-out);
}

.router-enter-from {
	opacity: 0;
	transform: translateX(20px);
}

.router-leave-to {
	opacity: 0;
	transform: translateX(-20px);
}
</style>