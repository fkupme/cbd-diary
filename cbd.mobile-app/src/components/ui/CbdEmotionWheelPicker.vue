<template>
	<q-dialog
		v-model="isOpen"
		position="bottom"
		transition-show="jump-up"
		transition-hide="jump-down"
		persistent
	>
		<q-card class="bottom-sheet-card">
			<!-- Заголовок с прогрессом -->
			<div class="emotion-wheel-header">
				<div class="emotion-wheel-controls">
					<q-btn
						v-if="currentStep > 1 && !isSearching"
						@click="goBack"
						class="emotion-wheel-close"
						icon="arrow_back"
						round
						flat
					/>

					<q-btn
						@click="closeModal"
						icon="close"
						class="emotion-wheel-close"
						round
						flat
					/>
				</div>
				<div class="emotion-wheel-info">
					<q-circular-progress
						:value="(currentStep / 3) * 100"
						size="60px"
						show-value
						:thickness="0.15"
						color="primary"
						track-color="rgba(255, 255, 255, 0.3)"
						class="emotion-progress-circle"
					>
						<div class="progress-text">{{ currentStep }}/3</div>
					</q-circular-progress>
					<div class="wheel-title">
						{{ currentStepTitle }}
					</div>
				</div>
			</div>

			<!-- Поиск эмоций -->
			<div class="search-bar">
				<q-input
					v-model="searchQuery"
					:placeholder="t('wheel.search', 'Поиск эмоций')"
					standout
					dense
					clearable
					@clear="onClearSearch"
					:debounce="200"
					prefix-icon="search"
				>
					<template #prepend>
						<q-icon name="search" />
					</template>
				</q-input>
			</div>

			<!-- Контент -->
			<div class="wheel-container">
				<!-- Результаты поиска -->
				<div v-if="isSearching" class="search-results">
					<q-virtual-scroll
						:items="filteredEmotions"
						separator
						v-slot="{ item }"
						class="search-list"
					>
						<q-item clickable @click="quickPickEmotion(item)">
							<q-item-section>
								<div class="search-item">
									<q-chip
										:color="getCategoryChipColor(String(item.category_id))"
										text-color="white"
										dense
									>
										{{ item.name }}
									</q-chip>
									<span class="search-item-emoji">{{ item.emoji || "" }}</span>
								</div>
							</q-item-section>
						</q-item>
					</q-virtual-scroll>
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
									<q-chip
										color="purple"
										text-color="white"
										class="intensity-chip"
									>
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
									</q-chip>
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
.emotion-wheel-info {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.bottom-sheet-card {
	border-radius: var(--radius-xl) var(--radius-xl) 0 0;
	background: var(--bg-elevated);
	border: 1px solid var(--border-color);
	box-shadow: var(--shadow-xl);
	max-height: 90vh;
	display: flex;
	flex-direction: column;
}

.emotion-wheel-content {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.emotion-wheel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-5);
	border-bottom: 1px solid var(--border-color);
	background: var(--bg-secondary);
}

.emotion-wheel-controls {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.emotion-wheel-close {
	transition: all var(--transition-fast) var(--ease-in-out);
	border-radius: var(--radius-full);
	aspect-ratio: 1;
	width: 36px;
	background: var(--bg-hover);
	color: var(--text-secondary);

	&:hover {
		background: var(--bg-active);
		color: var(--text-primary);
		transform: scale(1.05);
	}
}

.search-bar {
	padding: 0 var(--space-5) var(--space-3);
}

.search-results {
	width: 100%;
	padding: 0 var(--space-3);
}

.search-list {
	max-height: 50vh;
}

.search-item {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.search-item-emoji {
	font-size: 18px;
}

.emotion-progress-circle {
	margin: 0 auto;
	color: var(--primary) !important;

	:deep(.q-circular-progress__track) {
		stroke: var(--border-color) !important;
	}

	:deep(.q-circular-progress__center) {
		color: var(--text-primary) !important;
	}
}

.progress-text {
	color: var(--text-primary);
	font-size: var(--text-base);
	font-weight: var(--font-semibold);
	text-align: center;
}

.wheel-container {
	flex: 1;
	padding: var(--space-10) var(--space-5);
	min-height: 300px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.wheel-step {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.wheel-transition-enter-active,
.wheel-transition-leave-active {
	transition: all var(--transition-slow) var(--ease-in-out);
}

.wheel-transition-enter-from {
	opacity: 0;
	transform: translateX(50px);
}

.wheel-transition-leave-to {
	opacity: 0;
	transform: translateX(-50px);
}

.custom-wheel {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.wheel-title {
	font-size: var(--text-xl);
	font-weight: var(--font-semibold);
	color: var(--text-primary);
	text-align: center;
}

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
		black 20%,
		black 80%,
		transparent 100%
	);

	&:active {
		cursor: grabbing;
	}
}

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
	font-weight: var(--font-semibold);
	font-size: var(--text-base);
	border-radius: var(--radius-lg) !important;
	box-shadow: var(--shadow-sm);
	transition: all var(--transition-base) var(--ease-in-out);
	background: var(--bg-elevated);
	border: 1px solid var(--border-color);
}

// Цвета для категорий эмоций
.red {
	background: var(--emotion-anger-light);
	color: var(--emotion-anger-dark);
	border-color: var(--emotion-anger);
}

.teal {
	background: var(--emotion-surprise-light);
	color: var(--emotion-surprise-dark);
	border-color: var(--emotion-surprise);
}

.blue {
	background: var(--emotion-sadness-light);
	color: var(--emotion-sadness-dark);
	border-color: var(--emotion-sadness);
}

.green {
	background: var(--secondary-light);
	color: var(--secondary-dark);
	border-color: var(--secondary);
}

.amber {
	background: var(--emotion-joy-light);
	color: var(--emotion-joy-dark);
	border-color: var(--emotion-joy);
}

.purple {
	background: var(--emotion-fear-light);
	color: var(--emotion-fear-dark);
	border-color: var(--emotion-fear);
}

:root.dark {
	.red {
		background: rgba(248, 113, 113, 0.1);
		color: var(--emotion-anger);
		border-color: rgba(248, 113, 113, 0.3);
	}

	.teal {
		background: rgba(103, 232, 249, 0.1);
		color: var(--emotion-surprise);
		border-color: rgba(103, 232, 249, 0.3);
	}

	.blue {
		background: rgba(96, 165, 250, 0.1);
		color: var(--emotion-sadness);
		border-color: rgba(96, 165, 250, 0.3);
	}

	.green {
		background: rgba(134, 239, 172, 0.1);
		color: var(--secondary);
		border-color: rgba(134, 239, 172, 0.3);
	}

	.amber {
		background: rgba(252, 211, 77, 0.1);
		color: var(--emotion-joy);
		border-color: rgba(252, 211, 77, 0.3);
	}

	.purple {
		background: rgba(167, 139, 250, 0.1);
		color: var(--emotion-fear);
		border-color: rgba(167, 139, 250, 0.3);
	}
}

.intensity-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-2);
}

.intensity-description {
	margin-bottom: var(--space-5);
	text-align: center;
}

.selected-emotion-display {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-4);
	margin-bottom: var(--space-4);
	padding: var(--space-5);
	background: linear-gradient(135deg, var(--primary), var(--primary-dark));
	border-radius: var(--radius-xl);
	color: var(--text-inverse);
	box-shadow: var(--shadow-md);
}

.display-text {
	font-size: var(--text-2xl);
	font-weight: var(--font-semibold);
}

.intensity-dots {
	display: flex;
	gap: 3px;
}

.intensity-dot {
	width: 8px;
	height: 8px;
	border-radius: var(--radius-full);
	background: var(--border-color);
	transition: background-color var(--transition-fast) var(--ease-in-out);

	&.active {
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary);
	}
}

.intensity-text {
	font-size: var(--text-sm);
	font-weight: var(--font-semibold);
	text-align: center;
}

@media (max-width: 768px) {
	.wheel-container {
		padding: var(--space-5) var(--space-3);
		min-height: 260px;
	}
	.wheel-item {
		width: 260px;
		height: 60px;
		margin-left: -130px;
		margin-top: -30px;
	}
	.wheel-title {
		font-size: var(--text-lg);
	}
}
</style> 