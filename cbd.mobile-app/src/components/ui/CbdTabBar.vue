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
/* «Вечерний дневник»: тёмная панель + лампа-«плюс».
   Палитра задаётся локально (компонент живёт вне .diary-theme). */
.cbd-tab-bar {
	--ink-soft: #161a24;
	--paper: #ede6d6;
	--paper-dim: #8a8474;
	--lamp: #f0b264;
	--line: rgba(237, 230, 214, 0.1);

	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 1000;
	background: rgba(18, 21, 29, 0.92);
	backdrop-filter: blur(14px);
	-webkit-backdrop-filter: blur(14px);
	border-top: 1px solid var(--line);
	animation: slide-up 0.45s cubic-bezier(0.22, 1, 0.36, 1);

	&__container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 18px;
		height: 62px;
		position: relative;
	}

	&__side {
		display: flex;
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
		border-radius: 14px;
		cursor: pointer;
		transition: transform 0.1s ease;

		&:active {
			transform: scale(0.92);
		}
	}

	&__icon {
		font-size: 23px;
		color: var(--paper-dim);
		transition: color 0.2s ease, transform 0.2s ease;

		&--active {
			color: var(--lamp);
			transform: translateY(-1px);
		}
	}

	&__badge {
		position: absolute;
		top: 6px;
		right: 6px;
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
		border: none;
		border-radius: 50%;
		cursor: pointer;
		position: relative;
		margin-top: -16px;
		color: #181203;
		background: radial-gradient(
			circle at 50% 38%,
			#f7c887 0%,
			var(--lamp) 58%,
			#d99a45 100%
		);
		box-shadow:
			0 0 0 5px rgba(18, 21, 29, 0.92),
			0 8px 26px -6px rgba(240, 178, 100, 0.6),
			0 0 36px -6px rgba(240, 178, 100, 0.45);
		transition: transform 0.12s ease, box-shadow 0.2s ease;

		&:active {
			transform: scale(0.94);
		}

		&--active {
			transform: rotate(45deg);
		}
	}

	&__add-icon {
		font-size: 28px;
		color: #181203;
	}
}

// Индикатор активного таба — янтарная точка
.cbd-tab-bar__tab--active::after {
	content: "";
	position: absolute;
	bottom: 2px;
	left: 50%;
	width: 5px;
	height: 5px;
	background: var(--lamp);
	border-radius: 50%;
	transform: translateX(-50%);
	box-shadow: 0 0 8px -1px var(--lamp);
	animation: tab-dot 0.3s ease-out;
}

@keyframes tab-dot {
	from {
		opacity: 0;
		transform: translate(-50%, 4px);
	}
	to {
		opacity: 1;
		transform: translate(-50%, 0);
	}
}

@keyframes slide-up {
	from {
		transform: translateY(100%);
	}
	to {
		transform: translateY(0);
	}
}

// Адаптивность
@media (min-width: 768px) {
	.cbd-tab-bar__container {
		max-width: 440px;
		margin: 0 auto;
	}
}

// Safe area для iOS
@supports (padding-bottom: env(safe-area-inset-bottom)) {
	.cbd-tab-bar {
		padding-bottom: env(safe-area-inset-bottom);
	}
}

@media (prefers-reduced-motion: reduce) {
	.cbd-tab-bar {
		animation: none;
	}
	.cbd-tab-bar__tab--active::after {
		animation: none;
	}
}
</style>