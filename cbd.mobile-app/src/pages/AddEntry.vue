<template>
	<div class="add-entry-page diary-theme">
		<div class="add-entry-container">
			<!-- Шапка -->
			<header class="add-entry-header">
				<button class="back-btn" @click="$router.go(-1)" aria-label="Назад">
					<q-icon name="arrow_back" />
				</button>
				<h1 class="page-title">{{ t("entry.newEntry", "Новая запись") }}</h1>
				<div class="header-spacer"></div>
			</header>

			<!-- Форма -->
			<div class="entry-form" v-if="!isLoading">
				<!-- Ситуация -->
				<section class="form-group">
					<div class="group-header">
						<h3 class="group-label">{{ t("entry.situation", "Ситуация") }}</h3>
						<q-icon name="help_outline" class="help-ic">
							<q-tooltip class="diary-tooltip">
								{{
									t(
										"entry.situationTooltip",
										"Опишите что произошло, где вы были, с кем, какие обстоятельства"
									)
								}}
							</q-tooltip>
						</q-icon>
					</div>
					<textarea
						v-model="situation"
						class="diary-textarea"
						rows="2"
						:placeholder="t('entry.situationPlaceholder', 'Что произошло?..')"
						@input="autosize"
					></textarea>
				</section>

				<!-- Мысли и эмоции -->
				<section class="form-group">
					<div class="group-header">
						<h3 class="group-label">
							{{ t("entry.thoughtsAndEmotions", "Мысли и эмоции") }}
						</h3>
						<q-icon name="help_outline" class="help-ic">
							<q-tooltip class="diary-tooltip">
								{{
									t(
										"entry.thoughtsAndEmotionsTooltip",
										'Добавьте до 3 цепочек "мысль → эмоция". Первая обязательна'
									)
								}}
							</q-tooltip>
						</q-icon>
					</div>

					<div
						v-for="(chain, index) in thoughtChains"
						:key="index"
						class="thought-chain"
					>
						<div class="chain-header">
							<span class="chain-number">{{ index + 1 }}</span>
							<span class="chain-title">{{ t("entry.thought", "Мысль") }}</span>
							<button
								v-if="index > 0"
								@click="removeThoughtChain(index)"
								class="chain-remove"
								aria-label="Убрать мысль"
							>
								<q-icon name="close" />
							</button>
						</div>

						<textarea
							v-model="chain.thought"
							class="diary-textarea"
							rows="2"
							:placeholder="
								t('entry.thoughtPlaceholder', 'Какая мысль пришла в голову?..')
							"
							@input="autosize"
						></textarea>

						<div class="emotions-section">
							<div class="emotions-header">
								<span class="emotions-label">{{
									t("entry.emotions", "Эмоции")
								}}</span>
								<button
									@click="showEmotionWheel(index)"
									class="add-emotion-btn"
									:disabled="chain.emotions.length >= 5"
								>
									<q-icon name="add" />
									{{
										chain.emotions.length === 0
											? t("common.select", "Выбрать")
											: t("common.add", "Добавить")
									}}
								</button>
							</div>

							<div v-if="chain.emotions.length > 0" class="selected-emotions">
								<button
									v-for="emotion in chain.emotions"
									:key="emotion.id"
									class="emotion-tag"
									@click="removeEmotion(index, emotion.id)"
								>
									<i
										class="emotion-dot"
										:style="{ background: emotionDot(emotion.id) }"
									></i>
									<span class="emotion-name">{{ emotion.name }}</span>
									<em class="emotion-intensity">{{ emotion.intensity }}/10</em>
									<q-icon name="close" class="emotion-x" />
								</button>
							</div>
						</div>
					</div>

					<button
						v-if="thoughtChains.length < 3"
						@click="addThoughtChain"
						class="add-thought-btn"
					>
						<q-icon name="add" />
						{{ t("entry.addThought", "Добавить мысль") }}
					</button>
				</section>

				<!-- Реакции -->
				<section class="form-group">
					<div class="group-header">
						<h3 class="group-label">{{ t("entry.reactions", "Реакции") }}</h3>
						<q-icon name="help_outline" class="help-ic">
							<q-tooltip class="diary-tooltip">
								{{
									t(
										"entry.reactionsTooltip",
										"Опишите что вы сделали, как отреагировали, как себя вели"
									)
								}}
							</q-tooltip>
						</q-icon>
					</div>
					<textarea
						v-model="reactions"
						class="diary-textarea"
						rows="2"
						:placeholder="
							t('entry.reactionsPlaceholder', 'Что вы сделали? Как отреагировали?..')
						"
						@input="autosize"
					></textarea>
				</section>

				<!-- Сохранить -->
				<button
					class="lamp-btn save-btn"
					:disabled="!canSave || isSaving"
					@click="saveEntry"
				>
					{{ isSaving ? t("common.saving", "Сохраняю…") : t("entry.saveEntry", "Сохранить запись") }}
				</button>
			</div>

			<!-- Загрузка -->
			<div v-if="isLoading" class="loading-state">
				<p class="loading-line">{{ t("common.loading", "Загрузка…") }}</p>
			</div>
		</div>

		<!-- Колесо эмоций -->
		<CbdEmotionWheelPicker
			class="CbdEmotionWheelPicker"
			v-model="showingEmotionWheel"
			:categories="emotionCategoriesForWheel"
			:emotions="emotionsForWheel"
			@select="onEmotionSelected"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CbdEmotionWheelPicker } from "../components/ui";
import { useKeyboardHandling } from "../composables/useKeyboardHandling";
import { useLocalization } from "../composables/useLocalization";

// Обновляем импорты для новых stores и композаблов
import { useSync } from "../composables/useApiIntegration";
import type {
	CreateCBTEmotionRequest,
	CreateCBTThoughtRequest,
} from "../services/api/types";
import { useCBTStore, useEmotionsStore } from "../stores";

interface SelectedEmotion {
	id: number;
	name: string;
	emoji: string;
	intensity: number;
}

interface ThoughtChain {
	thought: string;
	emotions: SelectedEmotion[];
}

const router = useRouter();
const route = useRoute();

// Stores и композаблы
const cbtStore = useCBTStore();
const emotionsStore = useEmotionsStore();
const sync = useSync();
const { t } = useLocalization();

// Состояние загрузки
const isLoading = ref(true);
const isSaving = computed(() => cbtStore.isSaving);

// Данные формы
const situation = ref("");
const thoughtChains = ref<ThoughtChain[]>([{ thought: "", emotions: [] }]);
const reactions = ref("");

// Колесо эмоций
const showingEmotionWheel = ref(false);
const currentChainIndex = ref(0);

const canSave = computed(() => {
	return (
		situation.value.trim() &&
		thoughtChains.value[0].thought.trim() &&
		thoughtChains.value[0].emotions.length > 0 &&
		reactions.value.trim()
	);
});

// Computed свойства для совместимости с компонентом колеса эмоций
// (колесо ждёт name_key/category_id — отдаём их из канонических полей)
const emotionCategoriesForWheel = computed<any[]>(() =>
	emotionsStore.emotionCategories.map(cat => {
		const name = t(cat.nameKey, cat.name || "");
		return { ...cat, name, name_key: cat.nameKey };
	})
);

const emotionsForWheel = computed<any[]>(() =>
	emotionsStore.emotions.map(emotion => {
		const name = t(emotion.nameKey, emotion.name || "");
		return {
			...emotion,
			name,
			name_key: emotion.nameKey,
			category_id: emotion.categoryId,
		};
	})
);

// Методы для цепочек мыслей
function addThoughtChain() {
	if (thoughtChains.value.length < 3) {
		thoughtChains.value.push({ thought: "", emotions: [] });
	}
}

function removeThoughtChain(index: number) {
	if (index > 0) {
		thoughtChains.value.splice(index, 1);
	}
}

// Методы для колеса эмоций
function showEmotionWheel(chainIndex: number) {
	currentChainIndex.value = chainIndex;
	showingEmotionWheel.value = true;
}

function onEmotionSelected(emotion: any) {
	const chain = thoughtChains.value[currentChainIndex.value];

	// Проверяем, что эмоция еще не добавлена
	const exists = chain.emotions.find((e: any) => e.id === emotion.emotionId);

	if (!exists && chain.emotions.length < 5) {
		// Получаем переведенное название эмоции
		const emotionData = emotionsStore.getEmotionById(emotion.emotionId);
		const translatedName = emotionData
			? t(emotionData.nameKey)
			: emotion.emotionName;

		chain.emotions.push({
			id: emotion.emotionId,
			name: translatedName, // Используем переведенное название
			emoji: emotion.emoji,
			intensity: emotion.intensity,
		});
	}

	showingEmotionWheel.value = false;
}

function removeEmotion(chainIndex: number, emotionId: number) {
	const chain = thoughtChains.value[chainIndex];
	chain.emotions = chain.emotions.filter((e) => e.id !== emotionId);
}

// Цвет точки эмоции — из цвета категории (как в дневнике)
function emotionDot(emotionId: number): string {
	const emotion = emotionsStore.getEmotionById(emotionId);
	if (!emotion) return "var(--lamp)";
	const cat = emotionsStore.getCategoryById(emotion.categoryId);
	return (cat as any)?.color || "var(--lamp)";
}

// Авто-рост текстовых полей под содержимое
function autosize(e: Event) {
	const el = e.target as HTMLTextAreaElement;
	el.style.height = "auto";
	el.style.height = `${el.scrollHeight}px`;
}

// Сохранение записи с новыми API сервисами
async function saveEntry() {
	if (!canSave.value) return;

	try {
		// Преобразуем данные под новую схему API
		const thoughtChainInputs: CreateCBTThoughtRequest[] =
			thoughtChains.value.map((chain) => ({
				thought: chain.thought,
				isAutomatic: false,
				intensity: 5,
				emotions: chain.emotions.map((emotion) => ({
					emotionId: emotion.id,
					intensity: emotion.intensity,
				})) as CreateCBTEmotionRequest[],
				cognitiveDistortions: [],
			}));

		// Создаем запись через store (который использует API сервисы)
		const newEntry = await cbtStore.createEntry({
			situation: situation.value,
			thoughts: thoughtChainInputs,
			reactions: reactions.value,
			moodScoreBefore: thoughtChains.value[0]?.emotions[0]?.intensity || 5,
			tags: [], // Можно добавить теги позже
		});

		console.log("✅ Запись создана через API:", newEntry?.id);

		// Показываем статус синхронизации
		if (sync.isOnline.value) {
			console.log("🌐 Запись синхронизирована онлайн");
		} else {
			console.log(
				"📱 Запись сохранена локально (синхронизируется при подключении)"
			);
		}

		// Возвращаемся на предыдущую страницу
		router.go(-1);
	} catch (error) {
		console.error("❌ Ошибка сохранения записи через API:", error);

		// Показываем более детальную ошибку пользователю
		const errorMessage =
			error instanceof Error
				? error.message
				: "Неизвестная ошибка при сохранении";

		alert(`Ошибка при сохранении записи: ${errorMessage}. Попробуйте еще раз.`);
	}
}

// Загрузка данных с использованием новых stores
async function loadData() {
	try {
		console.log("🔄 Загрузка данных через обновленные stores...");

		// Проверяем нужно ли загружать эмоции
		if (emotionsStore.emotions.length === 0 || emotionsStore.needsRefresh) {
			await emotionsStore.loadAll();
		}

		// Диагностические логи по эмоциям/категориям
		try {
			console.group("🧩 Emotions diagnostic");
			console.log("Categories:", emotionsStore.emotionCategories.length);
			console.log("Emotions:", emotionsStore.emotions.length);
			for (const cat of emotionsStore.emotionCategories) {
				const byCat = emotionsStore.emotions.filter(
					e => e.categoryId === cat.id
				);
				console.log(
					`[${cat.id}] ${cat.nameKey}`,
					byCat.length,
					byCat.slice(0, 3).map(e => ({
						id: e.id,
						key: e.nameKey,
						cat: e.categoryId,
					}))
				);
			}
			console.groupEnd();
		} catch (logErr) {
			console.warn("Emotions diagnostic logging failed:", logErr);
		}

		console.log("✅ Данные загружены:", {
			emotions: emotionsStore.emotions.length,
			categories: emotionsStore.emotionCategories.length,
			online: sync.isOnline.value,
			lastSync: sync.lastSyncTime.value,
		});
	} catch (error) {
		console.error("❌ Ошибка загрузки данных:", error);

		// При ошибке API используем кэшированные данные
		if (emotionsStore.emotions.length > 0) {
			console.log("📱 Используем кэшированные данные эмоций");
		} else {
			alert(
				"Не удалось загрузить данные эмоций. Проверьте подключение к интернету."
			);
		}
	} finally {
		isLoading.value = false;
	}
}

onMounted(() => {
	// Текст из голосового/быстрого захвата (/capture) — предзаполняем ситуацию
	const fromCapture = route.query.situation;
	if (typeof fromCapture === "string" && fromCapture.trim()) {
		situation.value = fromCapture.trim();
	}
	loadData();
});

// Используем композабл для обработки клавиатуры
useKeyboardHandling(".add-entry-page", 320);
</script>

<style scoped>
.add-entry-page {
	position: relative;
	height: 100dvh;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	overflow-x: hidden;
}

.add-entry-container {
	width: 100%;
	max-width: 460px;
	margin: 0 auto;
	padding: max(5dvh, 28px) 24px max(40px, env(safe-area-inset-bottom));
}

/* ===== Шапка ===== */
.add-entry-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: max(3dvh, 22px);
	padding-top: env(safe-area-inset-top);
	animation: rise 0.5s ease-out both;
}

.back-btn {
	width: 42px;
	height: 42px;
	display: grid;
	place-items: center;
	border: 1px solid var(--line);
	background: rgba(237, 230, 214, 0.04);
	color: var(--paper-dim);
	border-radius: 50%;
	cursor: pointer;
	transition: color 0.2s ease, border-color 0.2s ease;
}
.back-btn:hover {
	color: var(--paper);
	border-color: rgba(240, 178, 100, 0.4);
}
.back-btn .q-icon {
	font-size: 20px;
}

.page-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: 24px;
	letter-spacing: -0.01em;
	color: var(--paper);
	margin: 0;
}
.header-spacer {
	width: 42px;
}

/* ===== Секции ===== */
.form-group {
	margin-bottom: 26px;
	animation: rise 0.5s ease-out 0.06s both;
}

.group-header {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;
}
.group-label {
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.09em;
	text-transform: uppercase;
	color: var(--paper-dim);
	margin: 0;
}
.help-ic {
	font-size: 16px;
	color: rgba(151, 144, 126, 0.6);
	cursor: help;
}

/* ===== Текстовые поля ===== */
.diary-textarea {
	width: 100%;
	resize: none;
	min-height: 54px;
	background: rgba(26, 31, 43, 0.55);
	border: 1px solid var(--line);
	border-radius: 14px;
	padding: 13px 15px;
	color: var(--paper);
	font-family: inherit;
	font-size: 16px;
	line-height: 1.5;
	outline: none;
	caret-color: var(--lamp);
	transition: border-color 0.2s ease, background 0.2s ease;
}
.diary-textarea::placeholder {
	color: rgba(151, 144, 126, 0.5);
}
.diary-textarea:focus {
	border-color: rgba(240, 178, 100, 0.55);
	background: rgba(26, 31, 43, 0.8);
}

/* ===== Цепочка мысли ===== */
.thought-chain {
	border: 1px solid var(--line);
	border-radius: 16px;
	padding: 15px;
	margin-bottom: 12px;
	background: rgba(18, 21, 29, 0.4);
}

.chain-header {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 11px;
}
.chain-number {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	display: grid;
	place-items: center;
	background: rgba(240, 178, 100, 0.14);
	border: 1px solid rgba(240, 178, 100, 0.45);
	color: var(--lamp);
	font-size: 13px;
	font-weight: 600;
	font-family: "Spectral", Georgia, serif;
}
.chain-title {
	flex: 1;
	font-size: 12px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--paper-dim);
}
.chain-remove {
	width: 26px;
	height: 26px;
	display: grid;
	place-items: center;
	border: none;
	background: none;
	color: var(--paper-dim);
	border-radius: 50%;
	cursor: pointer;
	transition: color 0.2s ease;
}
.chain-remove:hover {
	color: var(--coral);
}
.chain-remove .q-icon {
	font-size: 17px;
}

/* ===== Эмоции ===== */
.emotions-section {
	margin-top: 12px;
}
.emotions-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10px;
}
.emotions-label {
	font-size: 12px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--paper-dim);
}
.add-emotion-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	appearance: none;
	border: 1px solid rgba(240, 178, 100, 0.5);
	background: transparent;
	color: var(--lamp);
	font-family: inherit;
	font-size: 13px;
	font-weight: 500;
	padding: 6px 12px;
	border-radius: 999px;
	cursor: pointer;
	transition: background 0.2s ease;
}
.add-emotion-btn .q-icon {
	font-size: 16px;
}
.add-emotion-btn:hover:not(:disabled) {
	background: rgba(240, 178, 100, 0.1);
}
.add-emotion-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.selected-emotions {
	display: flex;
	flex-wrap: wrap;
	gap: 7px;
}
.emotion-tag {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	appearance: none;
	border: 1px solid var(--line);
	background: rgba(26, 31, 43, 0.6);
	color: var(--paper);
	font-family: inherit;
	font-size: 13px;
	padding: 5px 9px 5px 8px;
	border-radius: 999px;
	cursor: pointer;
	transition: border-color 0.2s ease;
}
.emotion-tag:hover {
	border-color: rgba(226, 109, 92, 0.5);
}
.emotion-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	flex-shrink: 0;
}
.emotion-name {
	color: var(--paper);
}
.emotion-intensity {
	font-style: normal;
	color: var(--paper-dim);
	font-size: 11.5px;
}
.emotion-x {
	font-size: 15px;
	color: var(--paper-dim);
	margin-left: 1px;
}
.emotion-tag:hover .emotion-x {
	color: var(--coral);
}

/* ===== Добавить мысль ===== */
.add-thought-btn {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	appearance: none;
	border: 1px dashed var(--line);
	background: transparent;
	color: var(--paper-dim);
	font-family: inherit;
	font-size: 14px;
	padding: 12px;
	border-radius: 14px;
	cursor: pointer;
	transition: color 0.2s ease, border-color 0.2s ease;
}
.add-thought-btn .q-icon {
	font-size: 18px;
}
.add-thought-btn:hover {
	color: var(--lamp);
	border-color: rgba(240, 178, 100, 0.4);
}

/* ===== Сохранить ===== */
.save-btn {
	width: 100%;
	height: 54px;
	border-radius: 16px;
	font-size: 16px;
	margin-top: 26px;
}
.save-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	box-shadow: none;
}

/* ===== Загрузка ===== */
.loading-state {
	text-align: center;
	padding: max(12dvh, 80px) 0;
}
.loading-line {
	font-family: "Spectral", Georgia, serif;
	font-style: italic;
	font-size: 18px;
	color: var(--paper-dim);
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
	.add-entry-header,
	.form-group {
		animation: none;
	}
}
</style>