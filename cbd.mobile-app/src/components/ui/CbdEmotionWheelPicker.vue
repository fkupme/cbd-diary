<template>
	<q-dialog
		v-model="isOpen"
		position="bottom"
		transition-show="jump-up"
		transition-hide="jump-down"
		persistent
	>
		<q-card class="bottom-sheet-card diary-theme">
			<!-- Хват-полоска -->
			<div class="sheet-grip"></div>

			<!-- Заголовок с прогрессом -->
			<div class="emotion-wheel-header">
				<button
					v-if="currentStep > 1 && !isSearching"
					@click="goBack"
					class="sheet-icon-btn"
					aria-label="Назад"
				>
					<q-icon name="arrow_back" />
				</button>
				<div v-else class="sheet-icon-spacer"></div>

				<div class="wheel-headline">
					<div class="wheel-steps">
						<span
							v-for="s in 3"
							:key="s"
							class="wheel-step-seg"
							:class="{ on: s <= currentStep }"
						></span>
					</div>
					<div class="wheel-title">{{ currentStepTitle }}</div>
				</div>

				<button @click="closeModal" class="sheet-icon-btn" aria-label="Закрыть">
					<q-icon name="close" />
				</button>
			</div>

			<!-- Поиск эмоций: строка тетради -->
			<div class="search-field" :class="{ 'has-value': searchQuery }">
				<q-icon name="search" class="search-ic" />
				<input
					v-model="searchQuery"
					type="text"
					:placeholder="t('wheel.search', 'Поиск эмоций')"
				/>
				<button
					v-if="searchQuery"
					class="search-clear"
					@click="onClearSearch"
					aria-label="Очистить"
				>
					×
				</button>
				<span class="line-rule"></span>
			</div>

			<!-- Контент -->
			<div class="wheel-container">
				<!-- Результаты поиска -->
				<div v-if="isSearching" class="search-results">
					<ul class="search-list">
						<li
							v-for="item in filteredEmotions"
							:key="item.id"
							class="search-row"
							@click="quickPickEmotion(item)"
						>
							<i
								class="search-dot"
								:style="{ background: getCategoryHex(item.category_id) }"
							></i>
							<span class="search-name">{{ item.name }}</span>
							<span v-if="item.emoji" class="search-emoji">{{ item.emoji }}</span>
						</li>
						<li v-if="!filteredEmotions.length" class="search-empty">
							{{ t("wheel.nothing", "Ничего не нашлось") }}
						</li>
					</ul>
				</div>

				<!-- Обычное колесо -->
				<transition v-else name="wheel-transition" mode="out-in">
					<div :key="currentStep" class="wheel-step">
						<!-- Шаг 1: Категории -->
						<div v-if="currentStep === 1" class="custom-wheel">
							<div
								class="wheel-3d"
								ref="categoryWheel"
								@touchstart="handleTouchStart"
								@touchmove="handleTouchMove"
								@touchend="handleTouchEnd"
								@mousedown="handleMouseDown"
								@mousemove="handleMouseMove"
								@mouseup="handleMouseUp"
							>
								<div
									v-for="(option, index) in categoryOptions"
									:key="option.value"
									class="wheel-item"
									:class="{ selected: selectedCategoryIndex === index }"
									:style="
										getWheelItemStyle(
											index,
											categoryOptions.length,
											currentRotation.category
										)
									"
								>
									<div
										:class="[
											'category-chip',
											getCategoryChipColor(option.value),
										]"
									>
										{{ option.text }}
									</div>
								</div>
							</div>
						</div>

						<!-- Шаг 2: Эмоции -->
						<div v-if="currentStep === 2" class="custom-wheel">
							<div
								class="wheel-3d"
								ref="emotionWheel"
								@touchstart="handleTouchStart"
								@touchmove="handleTouchMove"
								@touchend="handleTouchEnd"
								@mousedown="handleMouseDown"
								@mousemove="handleMouseMove"
								@mouseup="handleMouseUp"
							>
								<div
									v-for="(option, index) in emotionOptions"
									:key="option.value"
									class="wheel-item"
									:class="{ selected: selectedEmotionIndex === index }"
									:style="
										getWheelItemStyle(
											index,
											emotionOptions.length,
											currentRotation.emotion
										)
									"
									@click="quickPickEmotionId(option.value)"
								>
									<div :class="['emotion-chip', getEmotionChipColor()]">
										{{ option.text }}
									</div>
								</div>
							</div>
						</div>

						<!-- Шаг 3: Интенсивность -->
						<div v-if="currentStep === 3" class="custom-wheel">
							<div class="intensity-description">
								<div class="selected-emotion-display">
									<span class="display-text">{{ selectedEmotionName }}</span>
								</div>
							</div>

							<div
								class="wheel-3d"
								ref="intensityWheel"
								@touchstart="handleTouchStart"
								@touchmove="handleTouchMove"
								@touchend="handleTouchEnd"
								@mousedown="handleMouseDown"
								@mousemove="handleMouseMove"
								@mouseup="handleMouseUp"
							>
								<div
									v-for="(option, index) in intensityOptions"
									:key="option.value"
									class="wheel-item"
									:class="{ selected: selectedIntensityIndex === index }"
									:style="
										getWheelItemStyle(
											index,
											intensityOptions.length,
											currentRotation.intensity
										)
									"
								>
									<div class="intensity-chip">
										<div class="intensity-content">
											<div class="intensity-dots">
												<div
													v-for="dot in 10"
													:key="dot"
													class="intensity-dot"
													:class="{ active: dot <= parseInt(option.value) }"
												/>
											</div>
											<span class="intensity-text">{{ option.text }}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</transition>
			</div>
		</q-card>
	</q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useLocalization } from "../../composables/useLocalization";
const { t } = useLocalization();

// Types
interface EmotionCategory {
	id: number;
	name: string;
	color: string;
	created_at: string;
}

interface Emotion {
	id: number;
	category_id: number;
	name: string;
	emoji: string;
	intensity?: number;
	created_at: string;
}

interface SelectedEmotion {
	categoryId: number;
	categoryName: string;
	emotionId: number;
	emotionName: string;
	emoji: string;
	intensity: number;
}

// Props
interface Props {
	modelValue: boolean;
	categories: EmotionCategory[];
	emotions: Emotion[];
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: false,
	categories: () => [],
	emotions: () => [],
});

// Emits
const emit = defineEmits<{
	"update:modelValue": [value: boolean];
	select: [emotion: SelectedEmotion];
}>();

// Dialog state
const isOpen = computed({
	get: () => props.modelValue,
	set: (v: boolean) => emit("update:modelValue", v),
});

// Touch/Mouse state
const isDragging = ref(false);
const startY = ref(0);
const currentRotation = ref({
	category: 0,
	emotion: 0,
	intensity: 0,
});
const dragVelocity = ref(0);
const lastDragTime = ref(0);
const lastDragY = ref(0);

// Search state
const searchQuery = ref("");
const isSearching = computed(() => searchQuery.value.trim().length > 0);
const filteredEmotions = computed(() => {
	if (!isSearching.value) return [] as Emotion[];
	const q = searchQuery.value.trim().toLowerCase();
	return props.emotions
		.filter((e) => e.name.toLowerCase().includes(q))
		.slice(0, 100);
});

// State
const currentStep = ref(1);
const currentStepTitle = computed(() => {
	switch (currentStep.value) {
		case 1:
			return t("wheel.category", "Категория") as string;
		case 2:
			return t("wheel.emotion", "Эмоция") as string;
		case 3:
			return t("wheel.intensity", "Интенсивность") as string;
		default:
			return "";
	}
});

const selectedCategoryIndex = ref(0);
const selectedEmotionIndex = ref(0);
const selectedIntensityIndex = ref(4);

// Центрирование по умолчанию
const getCenterIndex = (optionsLength: number) => Math.floor(optionsLength / 2);

// Computed
const categoryOptions = computed(() => {
	return props.categories.map((cat) => ({
		value: cat.id.toString(),
		text: cat.name,
	}));
});

const emotionOptions = computed(() => {
	if (categoryOptions.value.length === 0) return [];

	const selectedCategory = categoryOptions.value[selectedCategoryIndex.value];
	if (!selectedCategory) return [];

	const categoryId = parseInt(selectedCategory.value);
	return props.emotions
		.filter((emotion) => emotion.category_id === categoryId)
		.map((emotion) => ({
			value: emotion.id.toString(),
			text: emotion.name,
		}));
});

const intensityOptions = computed(() => {
	return Array.from({ length: 10 }, (_, i) => ({
		value: (i + 1).toString(),
		text: getIntensityLabel(i + 1),
	}));
});

const selectedEmotionName = computed(() => {
	if (emotionOptions.value.length === 0) return "";
	const emotionOption = emotionOptions.value[selectedEmotionIndex.value];
	return emotionOption?.text || "";
});

// Watch для автоматического центрирования при открытии
watch(
	() => props.modelValue,
	(newValue) => {
		if (newValue && categoryOptions.value.length > 0) {
			// Центрируем при открытии модала
			const centerIndex = getCenterIndex(categoryOptions.value.length);
			selectedCategoryIndex.value = centerIndex;
			currentRotation.value.category = -centerIndex * 80;
		}
	}
);

// Touch/Mouse handlers
const handleTouchStart = (event: TouchEvent) => {
	isDragging.value = true;
	startY.value = event.touches[0].clientY;
	lastDragY.value = event.touches[0].clientY;
	lastDragTime.value = Date.now();
	dragVelocity.value = 0;
};

const handleTouchMove = (event: TouchEvent) => {
	if (!isDragging.value) return;
	event.preventDefault();

	const currentY = event.touches[0].clientY;
	const deltaY = currentY - lastDragY.value;
	const currentTime = Date.now();
	const deltaTime = currentTime - lastDragTime.value;

	if (deltaTime > 0) {
		dragVelocity.value = deltaY / deltaTime;
	}

	updateWheelRotation(deltaY);

	lastDragY.value = currentY;
	lastDragTime.value = currentTime;
};

const handleTouchEnd = () => {
	if (!isDragging.value) return;
	isDragging.value = false;

	finishWheelSelection();
};

const handleMouseDown = (event: MouseEvent) => {
	isDragging.value = true;
	startY.value = event.clientY;
	lastDragY.value = event.clientY;
	lastDragTime.value = Date.now();
	dragVelocity.value = 0;

	document.addEventListener("mousemove", handleMouseMove);
	document.addEventListener("mouseup", handleMouseUp);
};

const handleMouseMove = (event: MouseEvent) => {
	if (!isDragging.value) return;
	event.preventDefault();

	const currentY = event.clientY;
	const deltaY = currentY - lastDragY.value;
	const currentTime = Date.now();
	const deltaTime = currentTime - lastDragTime.value;

	if (deltaTime > 0) {
		dragVelocity.value = deltaY / deltaTime;
	}

	updateWheelRotation(deltaY);

	lastDragY.value = currentY;
	lastDragTime.value = currentTime;
};

const handleMouseUp = () => {
	if (!isDragging.value) return;
	isDragging.value = false;

	document.removeEventListener("mousemove", handleMouseMove);
	document.removeEventListener("mouseup", handleMouseUp);

	finishWheelSelection();
};

const updateWheelRotation = (deltaY: number) => {
	const rotationDelta = deltaY * 1.5; // Чувствительность

	if (currentStep.value === 1) {
		currentRotation.value.category += rotationDelta;
	} else if (currentStep.value === 2) {
		currentRotation.value.emotion += rotationDelta;
	} else if (currentStep.value === 3) {
		currentRotation.value.intensity += rotationDelta;
	}

	// Подсвечиваем центральный элемент сразу во время прокрутки, а не только
	// после отпускания — иначе .selected «отстаёт» от того, что под рамкой.
	syncSelectedToCenter();
};

// Текущий индекс по центру = -rotation / itemHeight (как в finishWheelSelection)
const syncSelectedToCenter = () => {
	const itemHeight = 80;
	let options: any[] = [];
	let rotation = 0;

	if (currentStep.value === 1) {
		options = categoryOptions.value;
		rotation = currentRotation.value.category;
	} else if (currentStep.value === 2) {
		options = emotionOptions.value;
		rotation = currentRotation.value.emotion;
	} else {
		options = intensityOptions.value;
		rotation = currentRotation.value.intensity;
	}

	if (options.length === 0) return;

	let idx = Math.round(-rotation / itemHeight);
	idx = Math.max(0, Math.min(idx, options.length - 1));

	if (currentStep.value === 1) {
		selectedCategoryIndex.value = idx;
	} else if (currentStep.value === 2) {
		selectedEmotionIndex.value = idx;
	} else {
		selectedIntensityIndex.value = idx;
	}
};

const finishWheelSelection = () => {
	let options: any[] = [];
	let currentRotationValue = 0;

	if (currentStep.value === 1) {
		options = categoryOptions.value;
		currentRotationValue = currentRotation.value.category;
	} else if (currentStep.value === 2) {
		options = emotionOptions.value;
		currentRotationValue = currentRotation.value.emotion;
	} else if (currentStep.value === 3) {
		options = intensityOptions.value;
		currentRotationValue = currentRotation.value.intensity;
	}

	if (options.length === 0) return;

	const itemHeight = 80;
	let selectedIndex = Math.round(-currentRotationValue / itemHeight);
	selectedIndex = Math.max(0, Math.min(selectedIndex, options.length - 1));
	const normalizedIndex = selectedIndex;

	const targetRotation = -normalizedIndex * itemHeight;

	if (currentStep.value === 1) {
		currentRotation.value.category = targetRotation;
		selectedCategoryIndex.value = normalizedIndex;
		setTimeout(() => {
			if (currentStep.value === 1) {
				currentStep.value = 2;
				const centerIndex = getCenterIndex(emotionOptions.value.length);
				selectedEmotionIndex.value = centerIndex;
				currentRotation.value.emotion = -centerIndex * itemHeight;
			}
		}, 250);
	} else if (currentStep.value === 2) {
		currentRotation.value.emotion = targetRotation;
		selectedEmotionIndex.value = normalizedIndex;
		setTimeout(() => {
			if (currentStep.value === 2) {
				currentStep.value = 3;
				selectedIntensityIndex.value = 4; // Средняя интенсивность
				currentRotation.value.intensity = -4 * itemHeight;
			}
		}, 200);
	} else if (currentStep.value === 3) {
		currentRotation.value.intensity = targetRotation;
		selectedIntensityIndex.value = normalizedIndex;
		setTimeout(() => {
			confirmSelection();
		}, 150);
	}
};

const confirmSelection = () => {
	const categoryOption = categoryOptions.value[selectedCategoryIndex.value];
	const emotionOption = emotionOptions.value[selectedEmotionIndex.value];
	const intensityOption = intensityOptions.value[selectedIntensityIndex.value];

	if (!categoryOption || !emotionOption || !intensityOption) return;

	const result: SelectedEmotion = {
		categoryId: parseInt(categoryOption.value),
		categoryName: categoryOption.text,
		emotionId: parseInt(emotionOption.value),
		emotionName: emotionOption.text,
		emoji: "",
		intensity: parseInt(intensityOption.value),
	};

	emit("select", result);
	closeModal();
};

function getCategoryChipColor(categoryId: string): string {
	const colors = ["red", "teal", "blue", "green", "amber"];
	const id = parseInt(categoryId);
	return colors[(id - 1) % colors.length] || "grey";
}

// Реальный hex категории (для точки-маркера в «вечернем дневнике»)
function getCategoryHex(categoryId: number | string): string {
	const cat = props.categories.find((c) => c.id === Number(categoryId));
	return cat?.color || "var(--lamp)";
}

function getEmotionChipColor(): string {
	if (categoryOptions.value.length === 0) return "grey";
	const selectedCategory = categoryOptions.value[selectedCategoryIndex.value];
	if (!selectedCategory) return "grey";
	return getCategoryChipColor(selectedCategory.value);
}

function goBack() {
	if (currentStep.value > 1) {
		currentStep.value--;
	}
}

function getIntensityLabel(intensity: number): string {
	const labels = [
		t("wheel.intensity.1", "Едва заметно") as string,
		t("wheel.intensity.2", "Слегка") as string,
		t("wheel.intensity.3", "Немного") as string,
		t("wheel.intensity.4", "Заметно") as string,
		t("wheel.intensity.5", "Умеренно") as string,
		t("wheel.intensity.6", "Довольно сильно") as string,
		t("wheel.intensity.7", "Сильно") as string,
		t("wheel.intensity.8", "Очень сильно") as string,
		t("wheel.intensity.9", "Крайне сильно") as string,
		t("wheel.intensity.10", "Максимально") as string,
	];
	return labels[intensity - 1] || intensity.toString();
}

function getWheelItemStyle(
	index: number,
	_totalItems: number,
	rotation: number = 0
) {
	const itemHeight = 80;
	const translateY = index * itemHeight + rotation;
	const distanceFromCenter = Math.abs(translateY);
	const maxDistance = itemHeight * 2.5;

	const opacity = Math.max(0.2, 1 - distanceFromCenter / maxDistance);
	const scale = Math.max(0.7, 1 - (distanceFromCenter / maxDistance) * 0.3);

	return {
		transform: `translateY(${translateY}px) scale(${scale})`,
		opacity,
		zIndex: Math.round((maxDistance - distanceFromCenter) * 10),
		transition: isDragging.value ? "none" : "all 0.3s ease-out",
	};
}

function closeModal() {
	emit("update:modelValue", false);
	resetState();
}

function resetState() {
	currentStep.value = 1;
	const centerCategoryIndex = getCenterIndex(categoryOptions.value.length);
	selectedCategoryIndex.value = centerCategoryIndex;
	selectedEmotionIndex.value = 0;
	selectedIntensityIndex.value = 4;
	currentRotation.value = {
		category: -centerCategoryIndex * 80,
		emotion: 0,
		intensity: -4 * 80,
	};
	searchQuery.value = "";
}

function onClearSearch() {
	searchQuery.value = "";
}

// Быстрый выбор эмоции из поиска
function quickPickEmotion(item: Emotion) {
	const categoryIndex = categoryOptions.value.findIndex(
		(c) => parseInt(c.value) === item.category_id
	);
	if (categoryIndex >= 0) {
		selectedCategoryIndex.value = categoryIndex;
	}
	const emotionIndex = props.emotions
		.filter((e) => e.category_id === item.category_id)
		.findIndex((e) => e.id === item.id);
	if (emotionIndex >= 0) {
		selectedEmotionIndex.value = emotionIndex;
	}
	// Центрируем интенсивность как в обычном потоке (шаг 2 → 3)
	selectedIntensityIndex.value = 4;
	currentRotation.value.intensity = -4 * 80;
	// Выходим из режима поиска — иначе список висит поверх колеса и кажется,
	// что выбор «не срабатывает».
	searchQuery.value = "";
	currentStep.value = 3;
}

// Быстрый переход на шаг 3 при клике по эмоции на шаге 2
function quickPickEmotionId(emotionIdStr: string) {
	const emotionId = parseInt(emotionIdStr);
	const selected = props.emotions.find((e) => e.id === emotionId);
	if (!selected) return;
	quickPickEmotion(selected);
}
</script>

<style lang="scss" scoped>
/* «Вечерний дневник»: тёмный bottom-sheet с лампой-акцентом. */
.bottom-sheet-card.diary-theme {
	min-height: 0;
	border-radius: 24px 24px 0 0;
	background:
		radial-gradient(120% 80% at 50% -10%, rgba(240, 178, 100, 0.08) 0%, rgba(240, 178, 100, 0) 55%),
		#14181f;
	border-top: 1px solid var(--line);
	box-shadow: 0 -24px 60px -20px rgba(0, 0, 0, 0.7);
	max-height: 92vh;
	display: flex;
	flex-direction: column;
	color: var(--paper);
	font-family: "Onest", system-ui, sans-serif;
}

.sheet-grip {
	width: 38px;
	height: 4px;
	border-radius: 999px;
	background: rgba(237, 230, 214, 0.22);
	margin: 10px auto 2px;
}

.emotion-wheel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 18px 14px;
}

.sheet-icon-btn {
	flex-shrink: 0;
	width: 38px;
	height: 38px;
	display: grid;
	place-items: center;
	border: 1px solid var(--line);
	background: rgba(237, 230, 214, 0.04);
	color: var(--paper-dim);
	border-radius: 50%;
	cursor: pointer;
	transition: color 0.2s ease, border-color 0.2s ease;
}
.sheet-icon-btn:hover {
	color: var(--paper);
	border-color: rgba(240, 178, 100, 0.4);
}
.sheet-icon-btn .q-icon {
	font-size: 20px;
}
.sheet-icon-spacer {
	width: 38px;
	flex-shrink: 0;
}

.wheel-headline {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.wheel-steps {
	display: flex;
	gap: 5px;
}
.wheel-step-seg {
	width: 22px;
	height: 3px;
	border-radius: 999px;
	background: var(--line);
	transition: background 0.3s ease;
}
.wheel-step-seg.on {
	background: var(--lamp);
}

.wheel-title {
	font-family: "Spectral", Georgia, serif;
	font-weight: 500;
	font-size: 20px;
	letter-spacing: -0.01em;
	color: var(--paper);
	text-align: center;
}

/* Поиск: строка тетради */
.search-field {
	position: relative;
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0 22px 6px;
}
.search-ic {
	font-size: 19px;
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
.search-clear {
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

/* Результаты поиска */
.search-results {
	width: 100%;
	padding: 6px 14px 16px;
}
.search-list {
	list-style: none;
	margin: 0;
	padding: 0;
	max-height: 52vh;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}
.search-row {
	display: flex;
	align-items: center;
	gap: 11px;
	padding: 12px 10px;
	border-radius: 12px;
	cursor: pointer;
	transition: background 0.15s ease;
}
.search-row:hover {
	background: rgba(237, 230, 214, 0.05);
}
.search-dot {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	flex-shrink: 0;
}
.search-name {
	flex: 1;
	font-size: 15.5px;
	color: var(--paper);
}
.search-emoji {
	font-size: 18px;
}
.search-empty {
	text-align: center;
	color: var(--paper-dim);
	padding: 28px 0;
	font-style: italic;
	font-family: "Spectral", Georgia, serif;
}

/* Контейнер колеса */
.wheel-container {
	flex: 1;
	padding: 22px 20px 36px;
	min-height: 300px;
	display: flex;
	align-items: center;
	justify-content: center;
}
.wheel-step,
.custom-wheel {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.wheel-transition-enter-active,
.wheel-transition-leave-active {
	transition: all 0.3s ease;
}
.wheel-transition-enter-from {
	opacity: 0;
	transform: translateX(40px);
}
.wheel-transition-leave-to {
	opacity: 0;
	transform: translateX(-40px);
}

/* 3D-колесо */
.wheel-3d {
	position: relative;
	width: 100%;
	height: 300px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	user-select: none;
	touch-action: pan-y;
	cursor: grab;
	mask-image: linear-gradient(
		to bottom,
		transparent 0%,
		black 22%,
		black 78%,
		transparent 100%
	);
	-webkit-mask-image: linear-gradient(
		to bottom,
		transparent 0%,
		black 22%,
		black 78%,
		transparent 100%
	);
}
.wheel-3d:active {
	cursor: grabbing;
}

/* Центральная «рамка выбора» убрана — подсветки самого выбранного элемента
   (.wheel-item.selected) достаточно, иначе получается двойная обводка. */

.wheel-item {
	position: absolute;
	width: 280px;
	height: 70px;
	left: 50%;
	top: 50%;
	margin-left: -140px;
	margin-top: -35px;
	pointer-events: auto;
	transform-origin: center center;
}

.category-chip,
.emotion-chip,
.intensity-chip {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 500;
	font-size: 16px;
	border-radius: 14px;
	background: rgba(26, 31, 43, 0.5);
	border: 1px solid var(--line);
	color: var(--paper-dim);
	transition: color 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}

/* Выбранный (по центру) — зажигается лампой */
.wheel-item.selected .category-chip,
.wheel-item.selected .emotion-chip,
.wheel-item.selected .intensity-chip {
	color: var(--paper);
	border-color: rgba(240, 178, 100, 0.6);
	background: rgba(240, 178, 100, 0.12);
	box-shadow: 0 0 24px -10px rgba(240, 178, 100, 0.5);
}

/* убираем «радужные» классы старой темы — в дневнике всё чернильное */
.category-chip.red,
.category-chip.teal,
.category-chip.blue,
.category-chip.green,
.category-chip.amber,
.category-chip.purple,
.emotion-chip.red,
.emotion-chip.teal,
.emotion-chip.blue,
.emotion-chip.green,
.emotion-chip.amber,
.emotion-chip.purple {
	background: rgba(26, 31, 43, 0.5);
	border-color: var(--line);
	color: var(--paper-dim);
}
.wheel-item.selected .category-chip,
.wheel-item.selected .emotion-chip {
	color: var(--paper);
}

/* Шаг 3: выбранная эмоция — янтарная плашка */
.intensity-description {
	margin-bottom: 18px;
	text-align: center;
}
.selected-emotion-display {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 10px 22px;
	background: radial-gradient(circle at 50% 30%, #f7c887 0%, var(--lamp) 60%, var(--lamp-deep) 100%);
	border-radius: 999px;
	color: #181203;
	box-shadow: 0 10px 30px -12px rgba(240, 178, 100, 0.6);
}
.display-text {
	font-family: "Spectral", Georgia, serif;
	font-size: 20px;
	font-weight: 500;
}

.intensity-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 7px;
}
.intensity-dots {
	display: flex;
	gap: 3px;
}
.intensity-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: rgba(237, 230, 214, 0.18);
	transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
.intensity-dot.active {
	background: var(--lamp);
	box-shadow: 0 0 8px -1px var(--lamp);
}
.intensity-text {
	font-size: 13px;
	color: inherit;
}

@media (max-width: 768px) {
	.wheel-container {
		padding: 18px 14px 30px;
		min-height: 260px;
	}
	.wheel-item {
		width: 260px;
		height: 60px;
		margin-left: -130px;
		margin-top: -30px;
	}
	.wheel-title {
		font-size: 18px;
	}
}

@media (prefers-reduced-motion: reduce) {
	.wheel-transition-enter-active,
	.wheel-transition-leave-active {
		transition: none;
	}
}
</style>