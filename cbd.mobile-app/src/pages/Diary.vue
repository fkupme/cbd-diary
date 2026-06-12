<template>
	<div class="diary-page diary-theme">
		<div class="diary-inner">
			<!-- Шапка -->
			<header class="diary-head">
				<h1 class="diary-title">{{ t("diary.title", "Дневник") }}</h1>
				<span class="diary-count" v-if="cbtStore.entries.length">
					{{ cbtStore.entries.length }}
					{{ pluralize(cbtStore.entries.length, ["запись", "записи", "записей"]) }}
				</span>
			</header>

			<!-- Поиск: строка тетради -->
			<div class="line-field search-field" :class="{ 'has-value': query }">
				<q-icon name="search" class="search-ic" />
				<input
					v-model="query"
					type="text"
					:placeholder="t('diary.searchPlaceholder', 'Поиск: мысли, эмоции, ситуации')"
				/>
				<button v-if="query" class="clear-btn" @click="query = ''" aria-label="Очистить">
					×
				</button>
				<span class="line-rule"></span>
			</div>

			<!-- Фильтры по дате -->
			<div class="filter-row">
				<button
					v-for="f in dateFilters"
					:key="f.value"
					class="filter-chip"
					:class="{ active: activeFilter === f.value }"
					@click="activeFilter = f.value"
				>
					{{ f.label }}
				</button>
			</div>

			<!-- Сортировка -->
			<div class="sort-row" v-if="cbtStore.entries.length > 1">
				<span class="sort-label">{{ t("diary.sortBy", "Сортировка") }}</span>
				<div class="select-wrap">
					<select v-model="sortBy">
						<option v-for="o in sortOptions" :key="o.value" :value="o.value">
							{{ o.label }}
						</option>
					</select>
					<q-icon name="expand_more" class="select-ic" />
				</div>
			</div>

			<!-- Скелетон: данные ещё подтягиваются (локально пусто, идёт дофетч) -->
			<ul class="entries" v-if="showSkeleton" aria-hidden="true">
				<li v-for="n in 3" :key="'sk-' + n" class="page-card sk-card">
					<div class="sk-line sk-time"></div>
					<div class="sk-line sk-text"></div>
					<div class="sk-line sk-text sk-short"></div>
					<div class="sk-tags">
						<span class="sk-chip"></span>
						<span class="sk-chip"></span>
					</div>
				</li>
			</ul>

			<!-- Записи -->
			<ul class="entries" v-else-if="filteredEntries.length > 0">
				<li
					v-for="entry in filteredEntries"
					:key="entry.id"
					class="page-card"
					:class="{ expanded: expandedEntries.has(entry.id) }"
				>
					<button class="page-head" @click="toggleEntry(entry.id)">
						<span class="page-time">{{ formatTime(getEntryCreatedAt(entry)) }}</span>
						<q-icon
							:name="expandedEntries.has(entry.id) ? 'expand_less' : 'expand_more'"
							class="chevron"
						/>
					</button>

					<p class="page-situation">
					{{
						expandedEntries.has(entry.id)
							? entry.situation || t("common.noDescription", "Без описания")
							: getSituationPreview(entry)
					}}
				</p>

					<!-- Свёрнуто: ink-теги эмоций -->
					<div
						v-if="!expandedEntries.has(entry.id)"
						class="ink-tags"
						v-show="getEntryEmotions(entry).length"
					>
						<span
							v-for="emotion in getEntryEmotions(entry)"
							:key="emotion.id"
							class="ink-tag"
						>
							<i class="ink-dot" :style="{ background: getEmotionDotColor(emotion.id) }"></i>
							{{ emotion.name }}
						</span>
					</div>

					<!-- Развёрнуто -->
					<div v-if="expandedEntries.has(entry.id)" class="page-detail">
						<section
							class="detail-section"
							v-if="getEntryData(entry).thoughts.length > 0"
						>
							<h4 class="detail-label">
								{{ t("diary.thoughtsAndEmotions", "Мысли и эмоции") }}
							</h4>
							<div
								v-for="(thought, index) in getEntryData(entry).thoughts"
								:key="index"
								class="thought"
							>
								<p class="thought-text">
									<b>{{ index + 1 }}.</b> {{ thought.text }}
								</p>
								<div class="ink-tags" v-show="thought.emotions.length">
									<span
										v-for="emotion in thought.emotions"
										:key="emotion.name"
										class="ink-tag"
									>
										<i
											class="ink-dot"
											:style="{ background: getEmotionDotColor(emotion.id || 1) }"
										></i>
										{{ emotion.name }}
										<em class="ink-intensity">{{ emotion.intensity }}/10</em>
									</span>
								</div>
							</div>
						</section>

						<section class="detail-section" v-if="getEntryData(entry).reactions">
							<h4 class="detail-label">
								{{ t("diary.reactions", "Реакции и действия") }}
							</h4>
							<p class="detail-text">{{ getEntryData(entry).reactions }}</p>
						</section>

						<button
							class="chat-btn"
							:class="{ filled: !!getEntryData(entry).chatId }"
							@click="onChatClick(entry)"
						>
							<q-icon name="psychology" />
							{{
								getEntryData(entry).chatId
									? t("diary.goToChat", "Перейти в чат")
									: t("diary.aiChat", "Разобрать с нейросетью")
							}}
						</button>
					</div>
				</li>
			</ul>

			<!-- Пусто -->
			<div v-else class="diary-empty">
				<p class="empty-line">
					{{
						query || activeFilter !== "all"
							? t("diary.emptyFiltered", "Ничего не нашлось")
							: t("diary.emptyTitle", "Пока нет записей")
					}}
				</p>
				<p class="empty-sub">
					{{
						query || activeFilter !== "all"
							? t("diary.emptyFilteredSub", "Попробуйте изменить поиск или фильтр")
							: t("diary.emptyText", "Начните с записи момента, который сегодня зацепил")
					}}
				</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
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

// Скелетон только на «холодном» старте: локально пусто и идёт загрузка/дофетч
const showSkeleton = computed(
	() => cbtStore.isLoading && cbtStore.entries.length === 0
);

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

async function hydrateChatFlags() {
	// Один GET /chat вместо N запросов по каждой записи: сервер отдаёт все
	// чаты пользователя (id + cbtEntryId), маппим локально.
	try {
		const needHydration = (cbtStore.entries as any[]).some(
			(e) => !(e as any).chatId && !(e as any).chat_id
		);
		if (!needHydration) return;

		const chats = await chatService.listChats();
		if (!chats.length) return;

		const chatByEntry = new Map<string, string>();
		for (const c of chats) {
			if ((c as any).cbtEntryId) chatByEntry.set((c as any).cbtEntryId, c.id);
		}

		for (const e of cbtStore.entries as any[]) {
			if ((e as any).chatId || (e as any).chat_id) continue;
			const chatId =
				chatByEntry.get(e.id) ||
				chatByEntry.get((e as any).serverId || (e as any).server_id || "");
			if (chatId) {
				cbtStore.setEntryChatId(e.id, chatId);
			}
		}
	} catch (err) {
		console.warn("Не удалось проверить наличие чатов:", err);
	}
}

function pluralize(n: number, forms: [string, string, string]): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return forms[0];
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
	return forms[2];
}

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
		return `${t("common.today", "Сегодня")}, ${date.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		})}`;
	}
	const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
	if (entryDate.getTime() === yesterday.getTime()) {
		return `${t("common.yesterday", "Вчера")}, ${date.toLocaleTimeString(
			undefined,
			{ hour: "2-digit", minute: "2-digit" }
		)}`;
	}
	return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
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
			// Каталог эмоций приходит в camelCase (nameKey); раньше читали snake
			// `name_key` → ключ для t() был undefined → на экране оставался сырой ключ.
			const emotionName = em
				? (t(
						(em as any).nameKey || (em as any).name_key,
						(em as any).name || ""
				  ) as string)
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

function getEmotionDotColor(emotionId: number): string {
	const emotion = emotionsStore.getEmotionById(emotionId);
	if (!emotion) return "var(--lamp)";
	const category = emotionsStore.getCategoryById(
		(emotion as any).categoryId ?? (emotion as any).category_id
	);
	return (category as any)?.color || "var(--lamp)";
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
				? (t(
						(em as any).nameKey || (em as any).name_key,
						(em as any).name || ""
				  ) as string)
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

	const max = 90;
	return entry.situation.length <= max
		? entry.situation
		: entry.situation.slice(0, max) + "…";
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

<style scoped>
.diary-page {
	padding-bottom: 96px;
}

.diary-inner {
	width: 100%;
	max-width: 440px;
	margin: 0 auto;
	padding: max(6dvh, 36px) 24px 24px;
}

/* ===== Скелетон загрузки ===== */
.sk-card {
	pointer-events: none;
}
.sk-line {
	height: 12px;
	border-radius: 6px;
	background: linear-gradient(
		90deg,
		rgba(237, 230, 214, 0.06) 25%,
		rgba(237, 230, 214, 0.13) 50%,
		rgba(237, 230, 214, 0.06) 75%
	);
	background-size: 200% 100%;
	animation: sk-shimmer 1.4s ease-in-out infinite;
	margin-bottom: 10px;
}
.sk-time {
	width: 38%;
	height: 10px;
}
.sk-text {
	width: 92%;
}
.sk-short {
	width: 64%;
}
.sk-tags {
	display: flex;
	gap: 8px;
	margin-top: 4px;
}
.sk-chip {
	width: 72px;
	height: 20px;
	border-radius: 10px;
	background: linear-gradient(
		90deg,
		rgba(237, 230, 214, 0.06) 25%,
		rgba(237, 230, 214, 0.13) 50%,
		rgba(237, 230, 214, 0.06) 75%
	);
	background-size: 200% 100%;
	animation: sk-shimmer 1.4s ease-in-out infinite;
}
@keyframes sk-shimmer {
	0% {
		background-position: 200% 0;
	}
	100% {
		background-position: -200% 0;
	}
}

/* ===== Шапка ===== */
.diary-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 22px;
	animation: rise 0.5s ease-out both;
}

.diary-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: clamp(30px, 9vw, 38px);
	letter-spacing: -0.015em;
	margin: 0;
}

.diary-count {
	font-size: 13px;
	color: var(--paper-dim);
	white-space: nowrap;
}

/* ===== Поиск: строка тетради ===== */
.search-field {
	position: relative;
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 20px;
	animation: rise 0.5s ease-out 0.05s both;
}

.search-ic {
	font-size: 20px;
	color: var(--paper-dim);
	flex-shrink: 0;
}

.search-field input {
	flex: 1;
	min-width: 0;
	background: transparent;
	border: none;
	outline: none;
	padding: 9px 0;
	color: var(--paper);
	font-family: inherit;
	font-size: 16px;
	caret-color: var(--lamp);
}
.search-field input::placeholder {
	color: rgba(151, 144, 126, 0.55);
}

.clear-btn {
	flex-shrink: 0;
	width: 26px;
	height: 26px;
	border: none;
	background: rgba(237, 230, 214, 0.08);
	color: var(--paper-dim);
	border-radius: 50%;
	font-size: 18px;
	line-height: 1;
	cursor: pointer;
}
.clear-btn:hover {
	color: var(--paper);
}

.line-rule {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 1px;
	background: var(--line);
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
.search-field:focus-within .line-rule::after {
	transform: scaleX(1);
}

/* ===== Фильтры ===== */
.filter-row {
	display: flex;
	gap: 8px;
	margin-bottom: 16px;
	animation: rise 0.5s ease-out 0.1s both;
}

.filter-chip {
	flex: 1;
	appearance: none;
	border: 1px solid var(--line);
	background: transparent;
	color: var(--paper-dim);
	font-family: inherit;
	font-size: 13.5px;
	padding: 8px 4px;
	border-radius: 999px;
	cursor: pointer;
	transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.filter-chip:hover {
	color: var(--paper);
}
.filter-chip.active {
	color: var(--lamp);
	border-color: rgba(240, 178, 100, 0.55);
	background: rgba(240, 178, 100, 0.08);
}

/* ===== Сортировка ===== */
.sort-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 22px;
	animation: rise 0.5s ease-out 0.14s both;
}
.sort-label {
	font-size: 12px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--paper-dim);
}
.select-wrap {
	position: relative;
	display: flex;
	align-items: center;
}
.select-wrap select {
	appearance: none;
	-webkit-appearance: none;
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	color: var(--paper);
	font-family: inherit;
	font-size: 13.5px;
	padding: 8px 32px 8px 13px;
	border-radius: 10px;
	cursor: pointer;
	outline: none;
}
.select-wrap select:focus {
	border-color: rgba(240, 178, 100, 0.55);
}
.select-wrap select option {
	background: #161a24;
	color: var(--paper);
}
.select-ic {
	position: absolute;
	right: 8px;
	font-size: 18px;
	color: var(--paper-dim);
	pointer-events: none;
}

/* ===== Записи ===== */
.entries {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
	animation: rise 0.5s ease-out 0.18s both;
}

.page-card {
	background: rgba(26, 31, 43, 0.6);
	border: 1px solid var(--line);
	border-radius: 16px;
	padding: 15px 18px;
	transition: border-color 0.2s ease, background 0.2s ease;
}
.page-card.expanded {
	border-color: rgba(240, 178, 100, 0.4);
	background: rgba(26, 31, 43, 0.85);
}

.page-head {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	border: none;
	background: none;
	padding: 0;
	cursor: pointer;
	color: inherit;
}
.page-time {
	font-size: 12.5px;
	color: var(--paper-dim);
}
.chevron {
	font-size: 22px;
	color: var(--paper-dim);
	transition: color 0.2s ease;
}
.page-card.expanded .chevron {
	color: var(--lamp);
}

.page-situation {
	font-size: 15.5px;
	line-height: 1.45;
	color: var(--paper);
	margin: 8px 0 0;
}

/* ===== ink-теги эмоций ===== */
.ink-tags {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
	margin-top: 10px;
}
.ink-tag {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 12px;
	color: var(--paper-faint);
	border: 1px solid var(--line);
	border-radius: 999px;
	padding: 3px 9px 3px 7px;
	white-space: nowrap;
}
.ink-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex-shrink: 0;
}
.ink-intensity {
	font-style: normal;
	color: var(--paper-dim);
	font-size: 11px;
}

/* ===== Развёрнутая часть ===== */
.page-detail {
	margin-top: 14px;
	padding-top: 14px;
	border-top: 1px solid var(--line);
	animation: detail-in 0.25s ease-out both;
}

@keyframes detail-in {
	from {
		opacity: 0;
		transform: translateY(-4px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.detail-section {
	margin-bottom: 16px;
}
.detail-section:last-of-type {
	margin-bottom: 16px;
}
.detail-label {
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.09em;
	text-transform: uppercase;
	color: var(--paper-dim);
	margin: 0 0 7px;
}
.detail-text {
	font-size: 15px;
	line-height: 1.5;
	color: var(--paper);
	margin: 0;
}

.thought {
	padding: 12px 14px;
	background: rgba(18, 21, 29, 0.5);
	border: 1px solid var(--line);
	border-radius: 12px;
	margin-bottom: 8px;
}
.thought:last-child {
	margin-bottom: 0;
}
.thought-text {
	font-size: 14.5px;
	line-height: 1.45;
	color: var(--paper);
	margin: 0;
}
.thought-text b {
	color: var(--lamp);
	font-weight: 600;
}
.thought .ink-tags {
	margin-top: 9px;
}

/* ===== Кнопка чата ===== */
.chat-btn {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	appearance: none;
	border: 1px solid rgba(240, 178, 100, 0.5);
	background: transparent;
	color: var(--lamp);
	font-family: inherit;
	font-size: 14.5px;
	font-weight: 500;
	padding: 12px;
	border-radius: 13px;
	cursor: pointer;
	transition: background 0.2s ease, color 0.2s ease;
}
.chat-btn .q-icon {
	font-size: 19px;
}
.chat-btn:hover {
	background: rgba(240, 178, 100, 0.1);
}
.chat-btn.filled {
	border-color: transparent;
	background: var(--lamp);
	color: #181203;
	box-shadow: 0 8px 24px -10px rgba(240, 178, 100, 0.6);
}
.chat-btn.filled:hover {
	background: var(--lamp-deep);
}

/* ===== Пусто ===== */
.diary-empty {
	margin-top: max(8dvh, 56px);
	text-align: center;
}
.empty-line {
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 21px;
	color: var(--paper-dim);
	margin: 0 0 8px;
}
.empty-sub {
	font-size: 14px;
	line-height: 1.5;
	color: var(--paper-dim);
	margin: 0 auto;
	max-width: 30ch;
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
	.diary-head,
	.search-field,
	.filter-row,
	.sort-row,
	.entries,
	.page-detail {
		animation: none;
	}
}
</style>
