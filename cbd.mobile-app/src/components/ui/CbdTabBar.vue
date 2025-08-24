<template>
	<div class="cbd-tab-bar">
		<div class="cbd-tab-bar__container">
			<!-- Левые табы -->
			<div class="cbd-tab-bar__side cbd-tab-bar__side--left">
				<button
					v-for="tab in leftTabs"
					:key="tab.name"
					:class="[
						'cbd-tab-bar__tab',
						{ 'cbd-tab-bar__tab--active': activeTab === tab.name },
					]"
					@click="handleTabChange(tab.name)"
				>
					<q-icon
						:name="tab.icon"
						:class="[
							'cbd-tab-bar__icon',
							{ 'cbd-tab-bar__icon--active': activeTab === tab.name },
						]"
					/>

					<!-- Бейдж -->
					<q-badge
						v-if="tab.badge && tab.badge > 0"
						:label="tab.badge > 99 ? '99+' : tab.badge"
						color="negative"
						floating
						rounded
						class="cbd-tab-bar__badge"
					/>
				</button>
			</div>

			<!-- Центральный таб с плюсом -->
			<button
				:class="[
					'cbd-tab-bar__add-btn',
					{ 'cbd-tab-bar__add-btn--active': activeTab === 'add' },
				]"
				@click="handleAddClick"
			>
				<q-icon name="add" class="cbd-tab-bar__add-icon" />
			</button>

			<!-- Правые табы -->
			<div class="cbd-tab-bar__side cbd-tab-bar__side--right">
				<button
					v-for="tab in rightTabs"
					:key="tab.name"
					:class="[
						'cbd-tab-bar__tab',
						{ 'cbd-tab-bar__tab--active': activeTab === tab.name },
					]"
					@click="handleTabChange(tab.name)"
				>
					<q-icon
						:name="tab.icon"
						:class="[
							'cbd-tab-bar__icon',
							{ 'cbd-tab-bar__icon--active': activeTab === tab.name },
						]"
					/>

					<!-- Бейдж -->
					<q-badge
						v-if="tab.badge && tab.badge > 0"
						:label="tab.badge > 99 ? '99+' : tab.badge"
						color="negative"
						floating
						rounded
						class="cbd-tab-bar__badge"
					/>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

interface Tab {
	name: string;
	label?: string;
	icon: string;
	badge?: number;
	disabled?: boolean;
}

interface Props {
	tabs: Tab[];
	modelValue?: string;
	elevated?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: "",
	elevated: true,
});

const emit = defineEmits<{
	"update:modelValue": [value: string];
	"tab-change": [tab: Tab];
	"add-click": [];
}>();

const activeTab = ref(props.modelValue || props.tabs[0]?.name || "");

// Разделяем табы на левые и правые
const leftTabs = computed(() => props.tabs.slice(0, 2));
const rightTabs = computed(() => props.tabs.slice(2));

// Синхронизация с внешним значением
watch(
	() => props.modelValue,
	(newValue) => {
		if (newValue && newValue !== activeTab.value) {
			activeTab.value = newValue;
		}
	}
);

function handleTabChange(tabName: string) {
	const tab = props.tabs.find((t) => t.name === tabName);
	if (tab && !tab.disabled) {
		activeTab.value = tabName;
		emit("update:modelValue", tabName);
		emit("tab-change", tab);
	}
}

function handleAddClick() {
	emit("add-click");
}
</script>

<style lang="scss" scoped>
.cbd-tab-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 1000;
	background: var(--bg-primary);
	border-top: 1px solid var(--border-color);
	box-shadow: var(--shadow-lg);
	transition: background-color var(--transition-base) var(--ease-in-out);

	&__container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-4);
		height: 64px;
		position: relative;
	}

	&__side {
		display: flex;
		gap: var(--space-3);
		flex: 1;

		&--left {
			justify-content: space-evenly;
		}

		&--right {
			justify-content: space-evenly;
		}
	}

	&__tab {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border: none;
		background: none;
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: all var(--transition-fast) var(--ease-in-out);

		&:hover:not(&--active) {
			background: var(--bg-hover);
		}

		&:active {
			background: var(--bg-active);
			transform: scale(0.95);
		}

		&--active {
			background: rgba(var(--primary), 0.1);

			// Для темной темы
			:root.dark & {
				background: rgba(96, 165, 250, 0.15);
			}
		}
	}

	&__icon {
		font-size: 24px;
		color: var(--text-secondary);
		transition: all var(--transition-fast) var(--ease-in-out);

		&--active {
			color: var(--primary);
		}
	}

	&__badge {
		position: absolute;
		top: 8px;
		right: 8px;
		font-size: 10px;
		min-width: 16px;
		height: 16px;
	}

	&__add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		background: var(--primary);
		border: none;
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all var(--transition-base) var(--ease-out);
		box-shadow: var(--shadow-md);
		position: relative;
		margin-top: -12px;

		&::before {
			content: "";
			position: absolute;
			inset: -4px;
			background: var(--bg-primary);
			border-radius: var(--radius-full);
			z-index: -1;
		}

		&:hover {
			transform: translateY(-2px);
			box-shadow: var(--shadow-lg);
			background: var(--primary-hover);
		}

		&:active {
			transform: translateY(0);
			background: var(--primary-active);
		}

		&--active {
			background: var(--secondary);

			&:hover {
				background: var(--secondary-hover);
			}

			&:active {
				background: var(--secondary-active);
			}
		}
	}

	&__add-icon {
		font-size: 28px;
		color: var(--text-inverse);
	}
}

// Адаптивность
@media (min-width: 768px) {
	.cbd-tab-bar {
		&__container {
			max-width: 400px;
			margin: 0 auto;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		}
	}
}

// Анимация появления
.cbd-tab-bar {
	animation: slide-up var(--transition-slow) var(--ease-out);

	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
}

// Индикатор активного таба
.cbd-tab-bar__tab--active {
	&::after {
		content: "";
		position: absolute;
		bottom: -8px;
		left: 50%;
		width: 32px;
		height: 3px;
		background: var(--primary);
		border-radius: var(--radius-full);
		transform: translateX(-50%);
		animation: tab-indicator var(--transition-base) var(--ease-out);
	}
}

@keyframes tab-indicator {
	from {
		width: 0;
		opacity: 0;
	}
	to {
		width: 32px;
		opacity: 1;
	}
}

// Safe area для iOS
@supports (padding-bottom: env(safe-area-inset-bottom)) {
	.cbd-tab-bar {
		padding-bottom: env(safe-area-inset-bottom);

		&__container {
			margin-bottom: env(safe-area-inset-bottom);
		}
	}
}
</style> 