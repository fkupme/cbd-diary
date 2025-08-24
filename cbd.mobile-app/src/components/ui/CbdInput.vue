<template>
	<div class="cbd-input">
		<q-input
			v-if="!multiline"
			v-model="model"
			:class="[
				'cbd-input__field',
				`cbd-input__field--${variant}`,
				{ 'cbd-input__field--error': hasError },
			]"
			:type="type"
			:label="label"
			:placeholder="placeholder"
			:filled="variant === 'filled'"
			:outlined="variant === 'outlined'"
			:standout="variant === 'standout'"
			:dense="size === 'sm'"
			:disable="disabled"
			:readonly="readonly"
			:loading="loading"
			:prefix="prefix"
			:suffix="suffix"
			:error="hasError"
			:error-message="errorMessage"
			:hint="hint"
			:counter="counter"
			:maxlength="maxlength"
			:autofocus="autofocus"
			:clearable="clearable"
			:bottom-slots="!!hint || hasError"
			@input="handleInput"
			@focus="handleFocus"
			@blur="handleBlur"
			@clear="handleClear"
			v-bind="$attrs"
		>
			<!-- Prepend слот -->
			<template v-if="icon || $slots.prepend" #prepend>
				<q-icon v-if="icon" :name="icon" />
				<slot v-if="$slots.prepend" name="prepend" />
			</template>

			<!-- Append слот -->
			<template v-if="iconRight || $slots.append" #append>
				<q-icon v-if="iconRight" :name="iconRight" />
				<slot v-if="$slots.append" name="append" />
			</template>
		</q-input>

		<!-- Textarea вариант -->
		<q-input
			v-else
			v-model="model"
			:class="[
				'cbd-input__field',
				`cbd-input__field--${variant}`,
				{ 'cbd-input__field--error': hasError },
			]"
			type="textarea"
			:label="label"
			:placeholder="placeholder"
			:filled="variant === 'filled'"
			:outlined="variant === 'outlined'"
			:standout="variant === 'standout'"
			:dense="size === 'sm'"
			:disable="disabled"
			:readonly="readonly"
			:loading="loading"
			:prefix="prefix"
			:suffix="suffix"
			:error="hasError"
			:error-message="errorMessage"
			:hint="hint"
			:counter="counter"
			:maxlength="maxlength"
			:autofocus="autofocus"
			:clearable="clearable"
			:rows="rows"
			:autogrow="autogrow"
			:bottom-slots="!!hint || hasError"
			@input="handleInput"
			@focus="handleFocus"
			@blur="handleBlur"
			@clear="handleClear"
			v-bind="$attrs"
		>
			<!-- Prepend слот -->
			<template v-if="icon || $slots.prepend" #prepend>
				<q-icon v-if="icon" :name="icon" />
				<slot v-if="$slots.prepend" name="prepend" />
			</template>

			<!-- Append слот -->
			<template v-if="iconRight || $slots.append" #append>
				<q-icon v-if="iconRight" :name="iconRight" />
				<slot v-if="$slots.append" name="append" />
			</template>
		</q-input>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	modelValue?: string | number;
	type?: "text" | "email" | "password" | "number" | "tel" | "url";
	variant?: "filled" | "outlined" | "standout" | "underline" | "textarea";
	size?: "sm" | "md";
	label?: string;
	placeholder?: string;
	hint?: string;
	errorMessage?: string;
	prefix?: string;
	suffix?: string;
	icon?: string;
	iconRight?: string;
	disabled?: boolean;
	readonly?: boolean;
	loading?: boolean;
	counter?: boolean;
	maxlength?: number;
	autofocus?: boolean;
	clearable?: boolean;
	required?: boolean;
	multiline?: boolean;
	rows?: number;
	autogrow?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: "",
	type: "text",
	variant: "outlined",
	size: "md",
	disabled: false,
	readonly: false,
	loading: false,
	counter: false,
	autofocus: false,
	clearable: false,
	required: false,
	multiline: false,
	rows: 4,
	autogrow: false,
});

const emit = defineEmits<{
	"update:modelValue": [value: string | number];
	input: [value: string | number];
	focus: [event: Event];
	blur: [event: Event];
	clear: [];
}>();

const model = computed({
	get: () => props.modelValue,
	set: (value) => emit("update:modelValue", value),
});

const hasError = computed(() => {
	return !!props.errorMessage || (props.required && !props.modelValue);
});

function handleInput(value: string | number) {
	emit("input", value);
}

function handleFocus(event: Event) {
	emit("focus", event);
}

function handleBlur(event: Event) {
	emit("blur", event);
}

function handleClear() {
	emit("clear");
}
</script>

<style lang="scss" scoped>
.cbd-input {
	margin-bottom: var(--space-4);

	&__field {
		font-family: var(--font-primary);
		transition: all var(--transition-base) var(--ease-in-out);

		// Общие стили для всех вариантов
		:deep(.q-field__input) {
			color: var(--input-text);
			font-size: var(--text-base);
			line-height: var(--leading-normal);
			font-weight: var(--font-normal);
		}

		:deep(.q-field__label) {
			color: var(--text-secondary);
			font-weight: var(--font-medium);
			font-size: var(--text-sm);
			transition: color var(--transition-fast) var(--ease-in-out);
		}

		:deep(.q-field__bottom) {
			font-size: var(--text-xs);
			padding-top: var(--space-1);
		}

		// Стиль outlined (основной)
		&--outlined {
			:deep(.q-field__control) {
				border-radius: var(--radius-base);
				height: 48px;
				background: var(--input-bg);
				transition: all var(--transition-base) var(--ease-in-out);
			}

			:deep(.q-field__control:hover) {
				background: var(--input-bg-hover);
			}

			:deep(.q-field__control-container) {
				padding: 0 var(--space-3);
			}

			:deep(.q-field__native) {
				color: var(--input-text);
				background: transparent;

				&::placeholder {
					color: var(--input-placeholder);
				}
			}

			:deep(.q-field__outline) {
				border-color: var(--input-border);
				border-width: var(--border-width);
				transition: all var(--transition-fast) var(--ease-in-out);
			}

			:deep(.q-field--focused .q-field__outline) {
				border-color: var(--input-border-focus);
				border-width: var(--border-width-focus);
			}

			:deep(.q-field__control:hover .q-field__outline) {
				border-color: var(--input-border-hover);
			}

			:deep(.q-field--focused .q-field__label) {
				color: var(--primary);
			}
		}

		// Стиль filled (альтернативный)
		&--filled {
			:deep(.q-field__control) {
				background: var(--bg-tertiary);
				border-radius: var(--radius-base);
				height: 48px;
				transition: all var(--transition-base) var(--ease-in-out);
			}

			:deep(.q-field__control:before) {
				border-color: transparent;
				background: transparent;
			}

			:deep(.q-field__control:after) {
				display: none;
			}

			:deep(.q-field__control:hover) {
				background: var(--input-bg-hover);
			}

			:deep(.q-field--focused .q-field__control) {
				background: var(--input-bg-focus);
				box-shadow: 0 0 0 var(--border-width-focus) var(--primary);
			}

			:deep(.q-field__native) {
				color: var(--input-text);
				background: transparent;

				&::placeholder {
					color: var(--input-placeholder);
				}
			}

			:deep(.q-field__control-container) {
				padding: 0 var(--space-3);
			}

			:deep(.q-field--focused .q-field__label) {
				color: var(--primary);
			}
		}

		// Стиль standout
		&--standout {
			:deep(.q-field__control) {
				background: var(--bg-tertiary);
				border-radius: var(--radius-base);
				height: 48px;
				transition: all var(--transition-base) var(--ease-in-out);
				border: var(--border-width) solid transparent;
			}

			:deep(.q-field__control:before) {
				display: none;
			}

			:deep(.q-field__control:after) {
				display: none;
			}

			:deep(.q-field__control:hover) {
				background: var(--input-bg-hover);
				border-color: var(--input-border-hover);
			}

			:deep(.q-field--focused .q-field__control) {
				background: var(--input-bg-focus);
				box-shadow: var(--shadow-base);
				transform: translateY(-1px);
				border-color: var(--primary);
			}

			:deep(.q-field__native) {
				color: var(--input-text);
				background: transparent;

				&::placeholder {
					color: var(--input-placeholder);
				}
			}

			:deep(.q-field__control-container) {
				padding: 0 var(--space-3);
			}

			:deep(.q-field--focused .q-field__label) {
				color: var(--primary);
			}
		}

		// Состояние ошибки
		&--error {
			:deep(.q-field__control:before),
			:deep(.q-field__outline) {
				border-color: var(--error) !important;
			}

			:deep(.q-field__bottom) {
				color: var(--error-text);
			}

			:deep(.q-field__label) {
				color: var(--error) !important;
			}

			:deep(.q-field__control) {
				background: var(--error-bg);
			}
		}

		// Состояние disabled
		:deep(.q-field--disabled) {
			opacity: 0.6;

			.q-field__control {
				background: var(--input-bg-disabled) !important;
				cursor: not-allowed;
			}

			.q-field__native {
				color: var(--text-disabled);
			}
		}

		// Иконки
		:deep(.q-field__prepend),
		:deep(.q-field__append) {
			.q-icon {
				color: var(--text-secondary);
				font-size: 20px;
				transition: color var(--transition-fast) var(--ease-in-out);
			}
		}

		:deep(.q-field--focused) {
			.q-field__prepend .q-icon,
			.q-field__append .q-icon {
				color: var(--primary);
			}
		}

		// Textarea специфичные стили
		:deep(textarea.q-field__native) {
			resize: vertical;
			min-height: 80px;
			padding: var(--space-2) 0;
		}

		// Счетчик символов
		:deep(.q-field__counter) {
			color: var(--text-tertiary);
			font-size: var(--text-xs);
		}

		// Очистка
		:deep(.q-field__append-inner) {
			.q-icon {
				cursor: pointer;

				&:hover {
					color: var(--primary);
				}
			}
		}
	}
}

// Темная тема
:root.dark .cbd-input {
	&__field {
		&--filled {
			:deep(.q-field__control) {
				background: var(--neutral-lightest);
			}
		}

		&--standout {
			:deep(.q-field--focused .q-field__control) {
				background: var(--neutral-lightest);
			}
		}
	}
}
</style> 