<template>
	<div class="diary-page">
		<div class="diary-container">
			<!-- Header -->
			<div class="diary-header">
				<h1 class="page-title">{{ t("diary.title", "Мой дневник") }}</h1>
				<CbdButton
					variant="primary"
					size="sm"
					icon="add"
					@click="$router.push('/add-entry')"
				>
					{{ t("diary.add", "Добавить") }}
				</CbdButton>
			</div>

			<!-- Поиск и сортировка -->
			<div class="filters">
				<q-input
					v-model="query"
					:placeholder="
						t('diary.searchPlaceholder', 'Поиск: мысли, эмоции, ситуации')
					"
					outlined
					dense
					clearable
					class="q-mb-sm"
				>
					<template #prepend>
						<q-icon name="search" />
					</template>
				</q-input>

				<div class="filter-tabs">
					<q-btn-toggle
						v-model="activeFilter"
						:options="dateFilters"
						color="primary"
						text-color="white"
						unelevated
						class="full-width filter-tabs-bar"
					/>
				</div>

				<div class="sort-row">
					<q-select
						v-model="sortBy"
						:options="sortOptions"
						:label="t('diary.sortBy', 'Сортировать по')"
						outlined
						dense
					/>
				</div>
			</div>

			<!-- Записи -->
			<div class="entries-list" v-if="filteredEntries.length > 0">
				<div
					v-for="entry in filteredEntries"
					:key="entry.id"
					class="entry-card"
					:class="{ 'entry-card--expanded': expandedEntries.has(entry.id) }"
				>
					<!-- Свернутое состояние -->
					<div class="entry-compact" @click="toggleEntry(entry.id)">
						<div class="entry-compact-header">
							<div class="entry-time">
								{{ formatTime(getEntryCreatedAt(entry)) }}
							</div>
							<div class="entry-actions">
								<q-btn
									class="expand-btn"
									flat
									round
									:icon="
										expandedEntries.has(entry.id)
											? 'expand_less'
											: 'expand_more'
									"
								/>
							</div>
						</div>
						<div class="entry-compact-content">
							<div class="entry-situation-preview">
								{{ getSituationPreview(entry) }}
							</div>
							<div
								v-if="!expandedEntries.has(entry.id)"
								class="entry-emotions-compact"
							>
								<q-chip
									v-for="emotion in getEntryEmotions(entry)"
									:key="emotion.id"
									:color="getEmotionChipColor(emotion.id)"
									text-color="white"
									size="sm"
									class="emotion-chip-compact"
								>
									{{ emotion.name }}
								</q-chip>
							</div>
						</div>
					</div>

					<!-- Развернутое состояние -->
					<div v-if="expandedEntries.has(entry.id)" class="entry-expanded">
						<div class="entry-detailed">
							<div class="entry-section" v-if="getEntryData(entry).situation">
								<h4 class="section-title">
									{{ t("entry.situation", "Ситуация") }}
								</h4>
								<p class="section-content">
									{{ getEntryData(entry).situation }}
								</p>
							</div>

							<div
								class="entry-section"
								v-if="getEntryData(entry).thoughts.length > 0"
							>
								<h4 class="section-title">
									{{ t("diary.thoughtsAndEmotions", "Мысли и эмоции") }}
								</h4>
								<div
									v-for="(thought, index) in getEntryData(entry).thoughts"
									:key="index"
									class="thought-block"
								>
									<div class="thought-text">
										<strong>{{ index + 1 }}.</strong> {{ thought.text }}
									</div>
									<div class="thought-emotions">
										<q-chip
											v-for="emotion in thought.emotions"
											:key="emotion.name"
											:color="getEmotionChipColor(emotion.id || 1)"
											text-color="white"
											size="sm"
											class="emotion-chip-detailed"
										>
											{{ emotion.name }} ({{ emotion.intensity }}/10)
										</q-chip>
									</div>
								</div>
							</div>

							<div class="entry-section" v-if="getEntryData(entry).reactions">
								<h4 class="section-title">
									{{ t("diary.reactions", "Реакции и действия") }}
								</h4>
								<p class="section-content">
									{{ getEntryData(entry).reactions }}
								</p>
							</div>

							<div class="entry-actions-expanded">
								<q-btn
									class="ai-chat-btn"
									:class="{
										'ai-chat-btn--filled': !!getEntryData(entry).chatId,
									}"
									@click="onChatClick(entry)"
									flat
									icon="psychology"
								>
									{{
										getEntryData(entry).chatId
											? t("diary.goToChat", "Перейти в чат")
											: t("diary.aiChat", "Начать чат с нейросетью")
									}}
								</q-btn>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Пустое состояние -->
			<div v-else class="empty-state">
				<div class="empty-icon">📝</div>
				<h3 class="empty-title">
					{{ t("diary.emptyTitle", "Пока нет записей") }}
				</h3>
				<p class="empty-text">
					{{
						t(
							"diary.emptyText",
							"Начните отслеживать свои эмоции, добавив первую запись"
						)
					}}
				</p>
				<CbdButton
					variant="primary"
					size="lg"
					@click="$router.push('/add-entry')"
				>
					{{ t("diary.addEntry", "Добавить запись") }}
				</CbdButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { CbdButton } from "../components/ui";
import { useLocalization } from "../composables/useLocalization";
import { chatService } from "../services/api";
import { useCBTStore } from "../stores/cbt";
import { useEmotionsStore } from "../stores/emotions";

// Stores
const router = useRouter();
const cbtStore = useCBTStore();
const emotionsStore = useEmotionsStore();

const { t } = useLocalization();

const activeFilter = ref("all");
const expandedEntries = ref(new Set<string>());
const query = ref("");

const sortBy = ref<"date_desc" | "date_asc" | "emotion" | "thought_len">(
	"date_desc"
);
const sortOptions = [
	{ label: t("diary.sort.dateDesc", "Сначала новые"), value: "date_desc" },
	{ label: t("diary.sort.dateAsc", "Сначала старые"), value: "date_asc" },
	{ label: t("diary.sort.emotion", "По кол-ву эмоций"), value: "emotion" },
	{
		label: t("diary.sort.thoughtLen", "По длине мыслей"),
		value: "thought_len",
	},
];

const dateFilters = [
	{ value: "all", label: t("diary.filter.all", "Все") },
	{ value: "today", label: t("diary.filter.today", "Сегодня") },
	{ value: "week", label: t("diary.filter.week", "Неделя") },
	{ value: "month", label: t("diary.filter.month", "Месяц") },
];

const filteredEntries = computed(() => {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
	const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

	const q = query.value.trim().toLowerCase();

	const set = cbtStore.entries
		.filter((entry) => {
			const entryDate = new Date(
				(entry as any).createdAt || (entry as any).created_at
			);
			switch (activeFilter.value) {
				case "today":
					return entryDate >= today;
				case "week":
					return entryDate >= weekAgo;
				case "month":
					return entryDate >= monthAgo;
				default:
					return true;
			}
		})
		.filter((entry) => {
			if (!q) return true;
			const data = getEntryData(entry);
			// Поиск по ситуации
			const inSituation = (data.situation || "").toLowerCase().includes(q);
			// Поиск по мыслям
			const inThoughts = data.thoughts.some((th: any) =>
				(th.text || "").toLowerCase().includes(q)
			);
			// Поиск по названиям эмоций
			const inEmotions = data.thoughts.some((th: any) =>
				th.emotions.some((e: any) => (e.name || "").toLowerCase().includes(q))
			);
			return inSituation || inThoughts || inEmotions;
		});

	// Сортировка
	const sorted = [...set].sort((a, b) => {
		const aData = getEntryData(a);
		const bData = getEntryData(b);
		const aDate = new Date(
			(a as any).createdAt || (a as any).created_at
		).getTime();
		const bDate = new Date(
			(b as any).createdAt || (b as any).created_at
		).getTime();
		switch (sortBy.value) {
			case "date_asc":
				return aDate - bDate;
			case "emotion": {
				const aEm = aData.thoughts.reduce(
					(sum: number, th: any) => sum + (th.emotions?.length || 0),
					0
				);
				const bEm = bData.thoughts.reduce(
					(sum: number, th: any) => sum + (th.emotions?.length || 0),
					0
				);
				return bEm - aEm;
			}
			case "thought_len": {
				const aLen = aData.thoughts.reduce(
					(sum: number, th: any) => sum + (th.text?.length || 0),
					0
				);
				const bLen = bData.thoughts.reduce(
					(sum: number, th: any) => sum + (th.text?.length || 0),
					0
				);
				return bLen - aLen;
			}
			case "date_desc":
			default:
				return bDate - aDate;
		}
	});

	return sorted;
});

async function loadEntries() {
	try {
		await cbtStore.loadEntries();
		console.log("Загружено записей:", cbtStore.entries.length);
	} catch (error) {
		console.error("Ошибка загрузки записей:", error);
	}
}

async function loadEmotions() {
	try {
		await emotionsStore.loadAll();
	} catch (error) {
		console.error("Ошибка загрузки эмоций:", error);
	}
}

async function hydrateChatFlags(limit: number = 30) {
	try {
		const entries = cbtStore.entries.slice(0, limit) as any[];
		const tasks = entries
			.filter((e) => !(e as any).chatId && !(e as any).chat_id)
			.map(async (e) => {
				try {
					const exists = await chatService.getByEntry(e.id);
					if (exists) {
						(e as any).chatId = exists.id;
					}
				} catch {}
			});
		await Promise.all(tasks.map((p) => p.catch(() => undefined)));
	} catch (err) {
		console.warn("Не удалось проверить наличие чатов:", err);
	}
}

// function getEmotionEmoji(emotionId: number): string {
// 	return emotionsStore.getEmotionEmoji(emotionId);
// }

// function getEmotionName(emotionId: number): string {
// 	return emotionsStore.getEmotionName(emotionId);
// }

// function formatDate(dateStr: string): string {
// 	const date = new Date(dateStr);
// 	const now = new Date();
// 	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
// 	const entryDate = new Date(
// 		date.getFullYear(),
// 		date.getMonth(),
// 		date.getDate()
// 	);

// 	if (entryDate.getTime() === today.getTime()) {
// 		return `Сегодня, ${date.toLocaleTimeString("ru-RU", {
// 			hour: "2-digit",
// 			minute: "2-digit",
// 		})}`;
// 	}

// 	const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
// 	if (entryDate.getTime() === yesterday.getTime()) {
// 		return `Вчера, ${date.toLocaleTimeString("ru-RU", {
// 			hour: "2-digit",
// 			minute: "2-digit",
// 		})}`;
// 	}

// 	return date.toLocaleDateString("ru-RU", {
// 		day: "numeric",
// 		month: "short",
// 		hour: "2-digit",
// 		minute: "2-digit",
// 	});
// }

function toggleEntry(entryId: string) {
	if (expandedEntries.value.has(entryId)) {
		expandedEntries.value.delete(entryId);
	} else {
		expandedEntries.value.add(entryId);
	}
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
		return date.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	}
	const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
	if (entryDate.getTime() === yesterday.getTime()) {
		return `${t("common.yesterday", "Вчера")} ${date.toLocaleTimeString(
			undefined,
			{ hour: "2-digit", minute: "2-digit" }
		)}`;
	}
	return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function getEntryCreatedAt(entry: any): string {
	return (entry && (entry.createdAt || entry.created_at)) as string;
}

function getEntryEmotions(entry: any): Array<{ id: number; name: string }> {
	// Получаем эмоции из цепочек мыслей
	const thoughts = cbtStore.getEntryThoughts(entry);
	const emotions: Array<{ id: number; name: string }> = [];

	thoughts.forEach((thought) => {
		thought.emotions.forEach((emotion) => {
			const em = emotionsStore.getEmotionById(
				(emotion as any).emotionId || (emotion as any).emotion_id
			);
			const emotionName = em
				? (t((em as any).name_key, (em as any).name || "") as string)
				: "";
			const emotionId =
				(emotion as any).emotionId || (emotion as any).emotion_id;
			if (emotionName && !emotions.find((e) => e.id === emotionId)) {
				emotions.push({
					id: emotionId,
					name: emotionName,
				});
			}
		});
	});

	return emotions;
}

function getEmotionChipColor(emotionId: number): string {
	const emotion = emotionsStore.getEmotionById(emotionId);
	if (!emotion) return "blue";

	// Простая логика цветов по category_id/categoryId
	const colorMap: Record<number, string> = {
		1: "red", // Гнев
		2: "teal", // Страх
		3: "blue", // Грусть
		4: "green", // Радость
		5: "purple", // Любовь
	};

	return (
		colorMap[(emotion as any).categoryId || (emotion as any).category_id] ||
		"primary"
	);
}

function getEntryData(entry: any) {
	// Теперь данные уже структурированы в CBT формате
	const thoughts = cbtStore.getEntryThoughts(entry);

	const formattedThoughts = thoughts.map((thought) => ({
		text: thought.thought,
		emotions: thought.emotions.map((emotion) => {
			const emotionId =
				(emotion as any).emotionId || (emotion as any).emotion_id;
			const em = emotionsStore.getEmotionById(emotionId);
			const name = em
				? (t((em as any).name_key, (em as any).name || "") as string)
				: "";
			return {
				name,
				intensity: (emotion as any).intensity.toString(),
				id: emotionId,
			};
		}),
	}));

	return {
		situation: entry.situation,
		thoughts: formattedThoughts,
		reactions: entry.reactions,
		chatId: (entry as any).chatId || (entry as any).chat_id,
	};
}

async function onChatClick(entry: any) {
	try {
		console.log("[CHAT] click: entry", entry?.id);
		const chatId = (entry as any).chatId || (entry as any).chat_id;
		if (chatId) {
			console.log("[CHAT] navigate existing chat", chatId);
			router.push({ name: "Chat", params: { chatId } });
			return;
		}
		const serverEntryId =
			(entry as any).serverId || (entry as any).server_id || entry.id;
		console.log("[CHAT] create/get by entry", serverEntryId);
		const chat = await chatService.getOrCreateByEntry(serverEntryId);
		console.log("[CHAT] created or found", chat?.id);
		const target = cbtStore.getEntryById(entry.id);
		if (target) (target as any).chatId = chat.id;
		console.log("[CHAT] navigate new chat", chat?.id);
		router.push({ name: "Chat", params: { chatId: chat.id } });
	} catch (e) {
		console.error("[CHAT] open error", e);
	}
}

function getSituationPreview(entry: any): string {
	if (!entry.situation)
		return String(t("common.noDescription", "Без описания"));

	const words = entry.situation.split(" ").slice(0, 3);
	return words.length >= 3 ? words.join(" ") + "..." : entry.situation;
}

// Автообновление при возврате на страницу
function refreshData() {
	loadEmotions();
	loadEntries().then(() => hydrateChatFlags());
}

onMounted(() => {
	refreshData();

	// Обновляем данные при фокусе на странице
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) {
			refreshData();
		}
	});
});
</script>

<style lang="scss" scoped>
.diary-page {
	min-height: 100vh;
	background: var(--bg-secondary);
	padding-bottom: 80px;
	transition: background-color var(--transition-base) var(--ease-in-out);
}

.diary-container {
	max-width: 500px;
	margin: 0 auto;
	padding: var(--space-4);
}

.diary-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: var(--space-6);
}

.page-title {
	font-size: var(--text-3xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
}

.filters {
	margin-bottom: var(--space-6);
}

.filter-tabs {
	display: flex;
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: var(--space-1);
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--border-color);
}

.filter-tab {
	flex: 1;
	padding: var(--space-2) var(--space-3);
	border: none;
	background: transparent;
	color: var(--text-secondary);
	font-size: var(--text-sm);
	font-weight: var(--font-medium);
	border-radius: var(--radius-base);
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
}

.filter-tab:hover {
	color: var(--text-primary);
	background: var(--bg-hover);
}

.filter-tab--active {
	background: var(--primary);
	color: var(--text-inverse);
}

.filter-tab--active:hover {
	background: var(--primary-hover);
}

.entries-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.entry-card {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-sm);
	transition: all var(--transition-base) var(--ease-out);
	overflow: hidden;
	border: 1px solid var(--border-color);
}

.entry-card:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-md);
	border-color: var(--primary);
}

.entry-card--expanded {
	box-shadow: var(--shadow-lg);
	border-color: var(--primary);
}

/* Свернутое состояние */
.entry-compact {
	padding: var(--space-4);
	cursor: pointer;
	transition: background-color var(--transition-fast) var(--ease-in-out);
}

.entry-compact:hover {
	background: var(--bg-hover);
}

.entry-compact-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: var(--space-3);
}

.entry-time {
	font-size: var(--text-sm);
	font-weight: var(--font-medium);
	color: var(--text-primary);
}

.entry-actions {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.expand-btn {
	border: none;
	background: transparent;
	color: var(--text-secondary);
	cursor: pointer;
	padding: var(--space-1);
	border-radius: var(--radius-full);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.expand-btn:hover {
	background: var(--bg-active);
	color: var(--text-primary);
}

.entry-compact-content {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.entry-situation-preview {
	font-size: var(--text-base);
	color: var(--text-primary);
	font-weight: var(--font-medium);
	line-height: var(--leading-normal);
}

.entry-emotions-compact {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-1);
}

.emotion-chip-compact {
	font-size: var(--text-xs) !important;
	height: 24px !important;
	padding: 0 var(--space-2) !important;
	box-shadow: var(--shadow-xs);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.emotion-chip-compact:hover {
	transform: translateY(-1px);
	box-shadow: var(--shadow-sm);
}

/* Развернутое состояние */
.entry-expanded {
	border-top: 1px solid var(--border-color);
	background: var(--bg-secondary);
}

.entry-detailed {
	padding: var(--space-4);
}

.entry-section {
	margin-bottom: var(--space-4);
}

.entry-section:last-of-type {
	margin-bottom: 0;
}

.section-title {
	font-size: var(--text-xs);
	font-weight: var(--font-semibold);
	color: var(--text-secondary);
	text-transform: uppercase;
	letter-spacing: 0.5px;
	margin-bottom: var(--space-2);
}

.section-content {
	font-size: var(--text-base);
	color: var(--text-primary);
	line-height: var(--leading-relaxed);
	margin: 0;
}

.thought-block {
	margin-bottom: var(--space-3);
	padding: var(--space-3);
	background: var(--bg-primary);
	border-radius: var(--radius-base);
	border: 1px solid var(--border-color);
}

.thought-block:last-child {
	margin-bottom: 0;
}

.thought-text {
	margin-bottom: var(--space-2);
	font-size: var(--text-base);
	color: var(--text-primary);
	line-height: var(--leading-normal);
}

.thought-emotions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-1);
}

.emotion-chip-detailed {
	font-size: var(--text-xs) !important;
	height: 22px !important;
	padding: 0 var(--space-2) !important;
}

.entry-actions-expanded {
	margin-top: var(--space-4);
	padding-top: var(--space-4);
	border-top: 1px solid var(--border-color);
}

.ai-chat-btn {
	width: 100%;
	padding: var(--space-3);
	border: 2px dashed var(--primary);
	background: transparent;
	color: var(--primary);
	border-radius: var(--radius-base);
	cursor: pointer;
	font-weight: var(--font-medium);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.ai-chat-btn:hover {
	background: var(--primary);
	color: var(--text-inverse);
	transform: translateY(-1px);
	box-shadow: var(--shadow-sm);
}

.ai-chat-btn:active {
	transform: translateY(0);
	box-shadow: none;
}

.ai-chat-btn--filled {
	border-style: solid;
	border-width: 0;
	background: var(--primary);
	color: var(--text-inverse);
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
	font-size: 64px;
	margin-bottom: var(--space-4);
	opacity: 0.8;
}

.empty-title {
	font-size: var(--text-2xl);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	margin-bottom: var(--space-2);
}

.empty-text {
	color: var(--text-secondary);
	line-height: var(--leading-normal);
	margin-bottom: var(--space-6);
	max-width: 300px;
	margin-inline: auto;
}

/* Темная тема - дополнительные стили */
:root.dark .thought-block {
	background: var(--bg-tertiary);
	border-color: var(--bg-tertiary);
}

:root.dark .entry-expanded {
	background: var(--bg-tertiary);
}

:root.dark .emotion-chip-compact,
:root.dark .emotion-chip-detailed {
	/* Более яркие цвета эмоций в темной теме */
	filter: brightness(1.1);
}

/* Responsive */
@media (max-width: 500px) {
	.diary-container {
		padding: var(--space-3);
	}

	.page-title {
		font-size: var(--text-2xl);
	}

	.filter-tabs {
		gap: var(--space-1);
		padding: var(--space-1);
	}

	.filter-tab {
		padding: var(--space-2);
		font-size: var(--text-xs);
	}
}

.sort-row {
	margin-top: var(--space-2);
	display: flex;
	gap: var(--space-2);
}
</style> 