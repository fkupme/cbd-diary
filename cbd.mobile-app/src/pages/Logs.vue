<template>
	<q-page class="flex column q-pa-md">
		<div class="row items-center justify-between q-mb-md">
			<h4 class="text-h4 q-ma-none">
				{{ t("logs.title", "🔍 Логи приложения") }}
			</h4>
			<q-btn
				@click="copyLogs"
				icon="content_copy"
				:label="t('logs.copy', 'Копировать')"
				color="primary"
				:disable="logs.length === 0"
			/>
		</div>

		<q-card class="col">
			<q-card-section class="q-pa-none">
				<q-scroll-area
					style="height: 70vh"
					class="bg-grey-9 text-white q-pa-md"
				>
					<div v-if="logs.length === 0" class="text-center text-grey-5">
						{{ t("logs.empty", "Логов пока нет...") }}
					</div>
					<div
						v-for="(log, index) in logs"
						:key="index"
						:class="`log-entry log-${log.level}`"
						class="q-mb-xs"
					>
						<span class="text-grey-5">[{{ log.timestamp }}]</span>
						<span :class="`text-${getLevelColor(log.level)}`"
							>[{{ log.level.toUpperCase() }}]</span
						>
						{{ log.message }}
					</div>
				</q-scroll-area>
			</q-card-section>
		</q-card>

		<div class="row q-mt-md q-gutter-sm">
			<q-btn
				@click="clearLogs"
				icon="clear"
				:label="t('logs.clear', 'Очистить')"
				color="negative"
				outline
			/>
			<q-btn
				@click="testLogs"
				icon="bug_report"
				:label="t('logs.testLogs', 'Тест логов')"
				color="secondary"
				outline
			/>
			<q-btn
				@click="testCommands"
				icon="code"
				:label="t('logs.testCommands', 'Тест команд')"
				color="warning"
				outline
			/>
		</div>
	</q-page>
</template>

<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { copyToClipboard } from "quasar";
import { onMounted, onUnmounted, ref } from "vue";
import { useLocalization } from "../composables/useLocalization";

interface LogEntry {
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	message: string;
}

const logs = ref<LogEntry[]>([]);

const addLog = (level: LogEntry["level"], message: string) => {
	logs.value.push({
		timestamp: new Date().toLocaleTimeString(),
		level,
		message,
	});
	// Ограничиваем количество логов
	if (logs.value.length > 1000) {
		logs.value = logs.value.slice(-500);
	}
};

const getLevelColor = (level: string) => {
	switch (level) {
		case "error":
			return "red";
		case "warn":
			return "orange";
		case "info":
			return "blue";
		case "debug":
			return "grey";
		default:
			return "white";
	}
};

const copyLogs = async () => {
	const logText = logs.value
		.map(
			(log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
		)
		.join("\n");

	try {
		await copyToClipboard(logText);
		addLog(
			"info",
			String(t("logs.copied", "📋 Логи скопированы в буфер обмена!"))
		);
	} catch (error) {
		addLog(
			"error",
			`${t("logs.copyError", "❌ Ошибка копирования:")} ${error}`
		);
	}
};

const clearLogs = () => {
	logs.value = [];
	addLog("info", String(t("logs.cleared", "🧹 Логи очищены")));
};

const testLogs = () => {
	addLog(
		"debug",
		String(t("logs.sample.debug", "🐛 Тестовое отладочное сообщение"))
	);
	addLog(
		"info",
		String(t("logs.sample.info", "ℹ️ Тестовое информационное сообщение"))
	);
	addLog("warn", String(t("logs.sample.warn", "⚠️ Тестовое предупреждение")));
	addLog("error", String(t("logs.sample.error", "❌ Тестовая ошибка")));
};

const testCommands = async () => {
	addLog(
		"info",
		String(t("logs.testingCommands", "🧪 Тестируем команды Rust..."))
	);

	const commands = [
		"greet",
		"get_emotions",
		"get_mood_entries",
		"get_emotion_categories",
	];

	for (const command of commands) {
		try {
			addLog(
				"debug",
				`${t("logs.callCommand", "Вызываем команду")}: ${command}` as string
			);
			const result = await invoke(
				command,
				command === "greet" ? { name: "Test" } : {}
			);
			addLog("info", `✅ ${command}: ${JSON.stringify(result)}`);
		} catch (error) {
			addLog("error", `❌ ${command}: ${error}`);
		}
	}
};

// Перехватываем console методы для логирования
const originalConsole = {
	log: console.log,
	warn: console.warn,
	error: console.error,
	info: console.info,
};

const setupConsoleIntercept = () => {
	console.log = (...args) => {
		addLog("info", args.join(" "));
		originalConsole.log(...args);
	};

	console.warn = (...args) => {
		addLog("warn", args.join(" "));
		originalConsole.warn(...args);
	};

	console.error = (...args) => {
		addLog("error", args.join(" "));
		originalConsole.error(...args);
	};

	console.info = (...args) => {
		addLog("info", args.join(" "));
		originalConsole.info(...args);
	};
};

const restoreConsole = () => {
	console.log = originalConsole.log;
	console.warn = originalConsole.warn;
	console.error = originalConsole.error;
	console.info = originalConsole.info;
};

const { t } = useLocalization();

onMounted(() => {
	setupConsoleIntercept();
	addLog("info", "🚀 Страница логов загружена");
});

onUnmounted(() => {
	restoreConsole();
});
</script>

<style scoped>
.logs-page {
	min-height: 100vh;
	background: var(--bg-secondary);
	padding-bottom: 80px;
	transition: background-color var(--transition-base) var(--ease-in-out);
}

.logs-container {
	max-width: 800px;
	margin: 0 auto;
	padding: var(--space-4);
}

.logs-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: var(--space-6);
}

.page-title {
	font-size: var(--text-2xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
}

.controls {
	display: flex;
	gap: var(--space-3);
}

.logs-list {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--border-color);
}

.log-item {
	padding: var(--space-3);
	border-bottom: 1px solid var(--border-color);
	font-family: var(--font-mono);
	font-size: var(--text-sm);
	transition: background-color var(--transition-fast) var(--ease-in-out);
}

.log-item:last-child {
	border-bottom: none;
}

.log-item:hover {
	background: var(--bg-hover);
}

.log-timestamp {
	color: var(--text-secondary);
	margin-right: var(--space-2);
}

.log-level {
	font-weight: var(--font-semibold);
	margin-right: var(--space-2);
}

.log-level--info {
	color: var(--info);
}

.log-level--warn {
	color: var(--warning);
}

.log-level--error {
	color: var(--error);
}

.log-message {
	color: var(--text-primary);
}

.empty-state {
	text-align: center;
	padding: var(--space-8);
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--border-color);
}

.empty-icon {
	font-size: 48px;
	margin-bottom: var(--space-3);
	opacity: 0.8;
}

.empty-text {
	color: var(--text-secondary);
}

/* Темная тема */
:root.dark {
	.logs-list {
		background: var(--bg-tertiary);
		border-color: var(--bg-tertiary);
	}

	.log-item {
		border-color: var(--bg-primary);
	}
}

/* Адаптация */
@media (max-width: 600px) {
	.logs-container {
		padding: var(--space-3);
	}

	.logs-header {
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
	}

	.controls {
		width: 100%;
	}
}
</style> 