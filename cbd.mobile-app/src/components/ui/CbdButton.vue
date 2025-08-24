<template>
	<q-btn
		:class="[
			'cbd-button',
			`cbd-button--${variant}`,
			`cbd-button--${size}`,
			{ 'cbd-button--loading': loading },
		]"
		:color="quasarColor"
		:size="size"
		:loading="loading"
		:disable="disabled"
		:flat="variant === 'ghost'"
		:outline="variant === 'ghost'"
		:rounded="rounded"
		:icon="icon"
		:icon-right="iconRight"
		@click="handleClick"
		v-bind="$attrs"
	>
		<template v-if="$slots.default">
			<slot />
		</template>
		<template v-else>
			{{ label }}
		</template>
	</q-btn>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
	size?: "xs" | "sm" | "md" | "lg" | "xl";
	label?: string;
	icon?: string;
	iconRight?: string;
	loading?: boolean;
	disabled?: boolean;
	rounded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "primary",
	size: "md",
	label: "",
	loading: false,
	disabled: false,
	rounded: false,
});

const emit = defineEmits<{
	click: [event: Event];
}>();

// Маппинг наших вариантов на цвета Quasar
const quasarColor = computed(() => {
	const colorMap = {
		primary: "primary",
		secondary: "secondary",
		success: "positive",
		danger: "negative",
		ghost: "primary",
	};
	return colorMap[props.variant];
});

function handleClick(event: Event) {
	if (!props.disabled && !props.loading) {
		emit("click", event);
	}
}
</script>

<style lang="scss" scoped>
.cbd-button {
	font-weight: var(--font-medium);
	transition: all var(--transition-base) var(--ease-in-out);
	border-radius: var(--radius-base) !important;
	text-transform: none !important;
	letter-spacing: normal !important;
	font-family: var(--font-primary) !important;

	&:hover:not(.q-btn--disable) {
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	&:active:not(.q-btn--disable) {
		transform: translateY(0);
		box-shadow: var(--shadow-sm);
	}

	// Варианты кнопок
	&--primary {
		background: var(--primary) !important;
		color: var(--text-inverse) !important;

		&:hover:not(.q-btn--disable) {
			background: var(--primary-hover) !important;
		}

		&:active:not(.q-btn--disable) {
			background: var(--primary-active) !important;
		}

		:deep(.q-btn__wrapper) {
			&:before {
				box-shadow: none;
			}
		}
	}

	&--secondary {
		background: var(--secondary) !important;
		color: var(--text-inverse) !important;

		&:hover:not(.q-btn--disable) {
			background: var(--secondary-hover) !important;
		}

		&:active:not(.q-btn--disable) {
			background: var(--secondary-active) !important;
		}
	}

	&--ghost {
		background: transparent !important;
		color: var(--primary) !important;
		border: 1px solid var(--border-color) !important;
		box-shadow: none !important;

		&:hover:not(.q-btn--disable) {
			background: var(--bg-hover) !important;
			border-color: var(--primary) !important;
			transform: none;
		}

		&:active:not(.q-btn--disable) {
			background: var(--bg-active) !important;
		}

		:deep(.q-btn__wrapper) {
			padding: 0;

			&:before {
				border: none;
			}
		}
	}

	&--success {
		background: var(--success) !important;
		color: var(--text-inverse) !important;

		&:hover:not(.q-btn--disable) {
			filter: brightness(1.1);
		}

		&:active:not(.q-btn--disable) {
			filter: brightness(0.95);
		}
	}

	&--danger {
		background: var(--error) !important;
		color: var(--text-inverse) !important;

		&:hover:not(.q-btn--disable) {
			filter: brightness(1.1);
		}

		&:active:not(.q-btn--disable) {
			filter: brightness(0.95);
		}
	}

	// Размеры
	&--xs {
		padding: var(--space-1) var(--space-2) !important;
		font-size: var(--text-xs) !important;
		min-height: 28px !important;

		:deep(.q-btn__wrapper) {
			padding: var(--space-1) var(--space-2);
			min-height: 24px;
		}
	}

	&--sm {
		padding: var(--space-2) var(--space-3) !important;
		font-size: var(--text-sm) !important;
		min-height: 36px !important;

		:deep(.q-btn__wrapper) {
			padding: var(--space-2) var(--space-3);
			min-height: 32px;
		}
	}

	&--md {
		padding: var(--space-2) var(--space-4) !important;
		font-size: var(--text-base) !important;
		min-height: 44px !important;

		:deep(.q-btn__wrapper) {
			padding: var(--space-2) var(--space-4);
			min-height: 40px;
		}
	}

	&--lg {
		padding: var(--space-3) var(--space-6) !important;
		font-size: var(--text-lg) !important;
		min-height: 52px !important;

		:deep(.q-btn__wrapper) {
			padding: var(--space-3) var(--space-6);
			min-height: 48px;
		}
	}

	&--xl {
		padding: var(--space-4) var(--space-8) !important;
		font-size: var(--text-xl) !important;
		min-height: 60px !important;

		:deep(.q-btn__wrapper) {
			padding: var(--space-4) var(--space-8);
			min-height: 56px;
		}
	}

	// Состояние загрузки
	&--loading {
		opacity: 0.8;

		:deep(.q-spinner) {
			color: currentColor !important;
		}
	}

	// Состояние disabled
	&.q-btn--disable {
		opacity: 0.5 !important;
		cursor: not-allowed !important;
	}

	// Иконки
	:deep(.q-icon) {
		font-size: 1.2em;

		&.on-left {
			margin-right: var(--space-2);
		}

		&.on-right {
			margin-left: var(--space-2);
		}
	}

	// Ripple эффект
	:deep(.q-btn__content) {
		transition: opacity var(--transition-fast) var(--ease-in-out);
	}
}

// Темная тема - дополнительные стили
:root.dark {
	.cbd-button {
		&--ghost {
			color: var(--primary) !important;
			border-color: var(--border-color) !important;

			&:hover:not(.q-btn--disable) {
				background: rgba(255, 255, 255, 0.1) !important;
				border-color: var(--primary) !important;
			}

			&:active:not(.q-btn--disable) {
				background: rgba(255, 255, 255, 0.15) !important;
			}
		}
	}
}
</style> 