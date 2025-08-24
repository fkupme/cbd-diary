<template>
	<div class="add-entry-page">
		<div class="add-entry-container">
			<!-- Header -->
			<div class="add-entry-header">
				<q-btn
					class="back-btn"
					@click="$router.go(-1)"
					round
					flat
					icon="arrow_back"
				/>
				<h1 class="page-title">{{ t("entry.newEntry", "Новая запись") }}</h1>
				<div class="header-spacer"></div>
			</div>

			<!-- Единая форма -->
			<div class="entry-form" v-if="!isLoading">
				<div class="form-card">
					<!-- Ситуация -->
					<div class="form-group">
						<div class="group-header">
							<h3 class="group-title">{{ t("entry.situation") }}</h3>
							<q-btn
								class="help-btn"
								@click="showHelp('situation')"
								round
								flat
								icon="help_outline"
							>
								<q-tooltip>
									{{
										t(
											"entry.situationTooltip",
											"Опишите что произошло, где вы были, с кем, какие обстоятельства"
										)
									}}
								</q-tooltip>
							</q-btn>
						</div>
						<CbdInput
							v-model="situation"
							:placeholder="t('entry.situationPlaceholder', 'Что произошло?..')"
							variant="textarea"
							outlined
							multiline
							autogrow
							:label="t('entry.situationLabel', 'Опишите ситуацию')"
						/>
					</div>

					<!-- Мысли и эмоции -->
					<div class="form-group">
						<div class="group-header">
							<h3 class="group-title">
								{{ t("entry.thoughtsAndEmotions", "Мысли и эмоции") }}
							</h3>
							<q-btn
								class="help-btn"
								@click="showHelp('thoughts')"
								round
								flat
								icon="help_outline"
							>
								<q-tooltip>
									{{
										t(
											"entry.thoughtsAndEmotionsTooltip",
											'Добавьте до 3 цепочек "мысль → эмоция". Первая обязательна'
										)
									}}
								</q-tooltip>
							</q-btn>
						</div>

						<div
							v-for="(chain, index) in thoughtChains"
							:key="index"
							class="thought-chain"
						>
							<div class="chain-header">
								<span class="chain-number">{{ index + 1 }}</span>
								<span class="chain-title">{{
									t("entry.thought", "Мысль")
								}}</span>
								<q-btn
									v-if="index > 0"
									@click="removeThoughtChain(index)"
									class="remove-btn"
									round
									flat
									icon="close"
								/>
							</div>

							<CbdInput
								v-model="chain.thought"
								:placeholder="
									t(
										'entry.thoughtPlaceholder',
										'Какая мысль пришла в голову?..'
									)
								"
								variant="textarea"
								outlined
								:label="t('entry.thought', 'Мысль')"
								multiline
								autogrow
							/>

							<div class="emotions-section">
								<div class="emotions-header">
									<span class="emotions-label">{{
										t("entry.emotions", "Эмоции")
									}}</span>
									<q-btn
										@click="showEmotionWheel(index)"
										class="add-emotion-btn"
										:disabled="chain.emotions.length >= 5"
										flat
										icon="add"
									>
										{{
											chain.emotions.length === 0
												? t("common.select", "Выбрать")
												: t("common.add", "Добавить")
										}}
									</q-btn>
								</div>

								<div v-if="chain.emotions.length > 0" class="selected-emotions">
									<q-chip
										v-for="emotion in chain.emotions"
										:key="emotion.id"
										:color="getEmotionChipColor(emotion.id)"
										text-color="white"
										removable
										@remove="removeEmotion(index, emotion.id)"
										class="emotion-chip"
									>
										<span class="emotion-text">{{ emotion.name }}</span>
										<span class="emotion-intensity"
											>{{ emotion.intensity }}/10</span
										>
									</q-chip>
								</div>
							</div>
						</div>

						<q-btn
							v-if="thoughtChains.length < 3"
							@click="addThoughtChain"
							class="add-thought-btn"
							flat
							icon="add"
						>
							{{ t("entry.addThought", "Добавить мысль") }}
						</q-btn>
					</div>

					<!-- Реакции -->
					<div class="form-group">
						<div class="group-header">
							<h3 class="group-title">{{ t("entry.reactions") }}</h3>
							<q-btn
								class="help-btn"
								@click="showHelp('reactions')"
								round
								flat
								icon="help_outline"
							>
								<q-tooltip>
									{{
										t(
											"entry.reactionsTooltip",
											"Опишите что вы сделали, как отреагировали, как себя вели"
										)
									}}
								</q-tooltip>
							</q-btn>
						</div>
						<CbdInput
							v-model="reactions"
							:placeholder="
								t(
									'entry.reactionsPlaceholder',
									'Что вы сделали? Как отреагировали?..'
								)
							"
							variant="textarea"
							outlined
							:label="t('entry.reactions')"
							multiline
							autogrow
						/>
					</div>

					<!-- Кнопка сохранения -->
					<CbdButton
						:loading="isSaving"
						:disabled="!canSave"
						variant="primary"
						size="lg"
						class="save-btn"
						@click="saveEntry"
					>
						{{ t("entry.saveEntry", "Сохранить запись") }}
					</CbdButton>
				</div>
			</div>

			<!-- Загрузка -->
			<div v-if="isLoading" class="loading-state">
				<div class="loading-spinner">⏳</div>
				<p>{{ t("common.loading") }}</p>
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
import { useRouter } from "vue-router";
import { CbdButton, CbdEmotionWheelPicker, CbdInput } from "../components/ui";
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
const emotionCategoriesForWheel = computed<any[]>(() =>
	emotionsStore.emotionCategories.map((cat: any) => {
		const key = cat.name_key ?? cat.nameKey ?? cat.name_key;
		const name = t(key as string, cat.name || "");
		return { ...cat, name, name_key: key };
	})
);

const emotionsForWheel = computed<any[]>(() =>
	emotionsStore.emotions.map((emotion: any) => {
		const key = emotion.name_key ?? emotion.nameKey ?? emotion.name_key;
		const name = t(key as string, emotion.name || "");
		const category_id =
			emotion.category_id ?? emotion.categoryId ?? emotion.categoryid;
		return { ...emotion, name, name_key: key, category_id };
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
			? t(emotionData.name_key)
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

function getEmotionChipColor(emotionId: number): string {
	const emotion = emotionsStore.getEmotionById(emotionId);
	if (!emotion) return "blue";

	const category = emotionsStore.getCategoryById(emotion.categoryId);
	if (!category) return "blue";

	// Маппинг цветов категорий на цвета Quasar
	const colorMap: Record<string, string> = {
		red: "red",
		blue: "blue",
		green: "green",
		orange: "orange",
		purple: "purple",
		teal: "teal",
		amber: "amber",
		pink: "pink",
	};

	return colorMap[category.color] || "primary";
}

function showHelp(type: string) {
	// Заглушка для хелпа, можно добавить модалки или что-то еще
	console.log(`Help for: ${type}`);
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
				const byCat = emotionsStore.emotions.filter((e: any) => {
					const cid = (e.categoryId ?? e.category_id ?? e.categoryid) as number;
					return Number(cid) === Number(cat.id);
				});
				console.log(
					`[${cat.id}] ${cat.name_key || cat.name}`,
					byCat.length,
					byCat.slice(0, 3).map((e: any) => ({
						id: e.id,
						key: e.name_key || e.name,
						cat: e.categoryId ?? e.category_id ?? e.categoryid,
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
	loadData();
});

// Используем композабл для обработки клавиатуры
useKeyboardHandling(".add-entry-page", 320);
</script>

<style scoped>
.add-entry-page {
	min-height: 100vh;
	position: relative;
	background: var(--bg-secondary);
	/* padding-bottom: env(safe-area-inset-bottom); */
	overflow-x: hidden;
	transition: background-color var(--transition-base) var(--ease-in-out);
}

.add-entry-container {
	margin: 0 auto;
	padding-inline: var(--space-3);
	max-width: 600px;
	margin-bottom: 60px;
}

.add-entry-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--space-4);
	padding-top: env(safe-area-inset-top);
}

.back-btn {
	width: 44px;
	height: 44px;
	border: none;
	background: var(--bg-primary);
	border-radius: var(--radius-full);
	box-shadow: var(--shadow-sm);
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all var(--transition-fast) var(--ease-in-out);
	cursor: pointer;
}

.back-btn:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-md);
}

.back-btn:active {
	transform: translateY(0);
	box-shadow: var(--shadow-sm);
}

.back-btn .q-icon {
	font-size: 20px;
	color: var(--text-primary);
}

.page-title {
	font-size: var(--text-2xl);
	font-weight: var(--font-bold);
	color: var(--text-primary);
	margin: 0;
}

.header-spacer {
	width: 44px;
}

.form-card {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: var(--space-6);
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--border-color);
}

.form-group {
	margin-bottom: var(--space-6);
}

.form-group:last-child {
	margin-bottom: 0;
}

.group-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--space-3);
}

.group-title {
	font-size: var(--text-lg);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	margin: 0;
}

.help-btn {
	width: 32px;
	height: 32px;
	border: none;
	background: var(--bg-hover);
	border-radius: var(--radius-full);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
}

.help-btn:hover {
	background: var(--primary);
	color: var(--text-inverse);
}

.help-btn .q-icon {
	font-size: 18px;
	color: var(--text-secondary);
}

.help-btn:hover .q-icon {
	color: var(--text-inverse);
}

.thought-chain {
	border: 1px solid var(--border-color);
	border-radius: var(--radius-base);
	padding: var(--space-4);
	margin-bottom: var(--space-3);
	background: var(--bg-secondary);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.thought-chain:hover {
	border-color: var(--border-color-hover);
	box-shadow: var(--shadow-sm);
}

.chain-header {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	margin-bottom: var(--space-3);
}

.chain-number {
	background: var(--primary);
	color: var(--text-inverse);
	width: 24px;
	height: 24px;
	border-radius: var(--radius-full);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: var(--text-sm);
	font-weight: var(--font-bold);
}

.chain-title {
	font-weight: var(--font-medium);
	color: var(--text-primary);
	flex: 1;
}

.remove-btn {
	width: 24px;
	height: 24px;
	border: none;
	background: var(--error);
	border-radius: var(--radius-full);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all var(--transition-fast) var(--ease-in-out);
}

.remove-btn:hover {
	transform: scale(1.1);
	box-shadow: var(--shadow-sm);
}

.remove-btn .q-icon {
	font-size: 14px;
	color: var(--text-inverse);
}

.emotions-section {
	margin-top: var(--space-3);
}

.emotions-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--space-2);
}

.emotions-label {
	font-weight: var(--font-medium);
	color: var(--text-primary);
}

.add-emotion-btn {
	background: var(--primary);
	color: var(--text-inverse);
	border: none;
	border-radius: var(--radius-sm);
	padding: var(--space-1) var(--space-2);
	font-size: var(--text-sm);
	font-weight: var(--font-medium);
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: var(--space-1);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.add-emotion-btn:hover:not(:disabled) {
	background: var(--primary-hover);
	transform: translateY(-1px);
	box-shadow: var(--shadow-sm);
}

.add-emotion-btn:active:not(:disabled) {
	background: var(--primary-active);
	transform: translateY(0);
}

.add-emotion-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.selected-emotions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-1);
	margin-top: var(--space-2);
}

.emotion-chip {
	border-radius: var(--radius-sm) !important;
	font-size: var(--text-sm);
	box-shadow: var(--shadow-xs);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.emotion-chip:hover {
	transform: translateY(-1px);
	box-shadow: var(--shadow-sm);
}

.emotion-text {
	font-weight: var(--font-medium);
}

.emotion-intensity {
	opacity: 0.9;
	background: rgba(255, 255, 255, 0.2);
	border-radius: var(--radius-sm);
	padding: 2px 6px;
	margin-left: 4px;
	font-size: var(--text-xs);
}

.add-thought-btn {
	background: var(--bg-primary);
	border: 2px dashed var(--border-color);
	border-radius: var(--radius-base);
	padding: var(--space-3);
	cursor: pointer;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	color: var(--text-secondary);
	font-weight: var(--font-medium);
	transition: all var(--transition-fast) var(--ease-in-out);
}

.add-thought-btn:hover {
	border-color: var(--primary);
	color: var(--primary);
	background: var(--bg-hover);
}

.save-btn {
	width: 100%;
	height: 52px;
	font-weight: var(--font-semibold);
	margin-top: var(--space-4);
}

.loading-state {
	text-align: center;
	padding: var(--space-8);
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--border-color);
}

.loading-spinner {
	font-size: 48px;
	margin-bottom: var(--space-3);
	animation: spin 2s linear infinite;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

/* Адаптация для мобильных устройств */
@media (max-width: 768px) {
	.add-entry-container {
		padding: var(--space-2);
	}

	.form-card {
		padding: var(--space-4);
	}

	.page-title {
		font-size: var(--text-xl);
	}
}

/* Исправление для виртуальной клавиатуры */
.add-entry-page {
	height: 100vh;
	height: 100dvh;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	contain: layout style;
}

.add-entry-container {
	min-height: calc(100vh - 80px);
	min-height: calc(100dvh - 80px);
}

/* Специально для iOS - поддержка Visual Viewport API */
@supports (height: 100dvh) {
	.add-entry-page {
		height: 100dvh;
	}

	.add-entry-container {
		min-height: calc(100dvh - 80px);
	}
}

/* Поддержка iOS safe area */
@supports (padding: max(0px)) {
	.add-entry-page {
		padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
	}

	.add-entry-header {
		padding-top: max(var(--space-3), env(safe-area-inset-top));
	}
}

/* Темная тема - дополнительные стили для эмоций */
@media (prefers-color-scheme: dark) {
	.emotion-chip {
		/* Чипы эмоций в темной теме имеют более насыщенные цвета */
		filter: brightness(1.1);
	}

	.thought-chain {
		background: var(--bg-tertiary);
	}
}
</style> 