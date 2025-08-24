<template>
	<q-card
		:class="[
			'cbd-emotion-card',
			`cbd-emotion-card--${emotion}`,
			`cbd-emotion-card--${size}`,
			{
				'cbd-emotion-card--selected': selected,
				'cbd-emotion-card--interactive': interactive,
			},
		]"
		flat
		@click="handleClick"
	>
		<q-card-section class="cbd-emotion-card__content text-center">
			<!-- Эмодзи -->
			<div class="cbd-emotion-card__emoji">
				{{ emojiMap[emotion] }}
			</div>

			<!-- Название эмоции -->
			<div class="cbd-emotion-card__label">
				{{ label || emotionLabels[emotion] }}
			</div>

			<!-- Интенсивность (опционально) -->
			<div
				v-if="showIntensity && intensity"
				class="cbd-emotion-card__intensity"
			>
				<div class="intensity-dots">
					<div
						v-for="dot in 5"
						:key="dot"
						class="intensity-dot"
						:class="{ active: dot <= intensity }"
					/>
				</div>
			</div>

			<!-- Дополнительная информация -->
			<div v-if="description" class="cbd-emotion-card__description">
				{{ description }}
			</div>

			<!-- Слот для кастомного контента -->
			<slot />
		</q-card-section>

		<!-- Индикатор выбора -->
		<q-icon
			v-if="selected"
			name="check_circle"
			class="cbd-emotion-card__check"
		/>
	</q-card>
</template>

<script setup lang="ts">
interface Props {
	emotion:
		| "joy"
		| "sadness"
		| "anger"
		| "fear"
		| "shame"
		| "surprise"
		| "neutral";
	label?: string;
	description?: string;
	size?: "sm" | "md" | "lg";
	selected?: boolean;
	interactive?: boolean;
	intensity?: number; // 1-5
	showIntensity?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	size: "md",
	selected: false,
	interactive: true,
	intensity: 0,
	showIntensity: false,
});

const emit = defineEmits<{
	click: [emotion: string];
	select: [emotion: string];
}>();

import { useLocalization } from "../../composables/useLocalization";
const { t } = useLocalization();

// Маппинг эмоций на эмодзи
const emojiMap = {
	joy: "😊",
	sadness: "😢",
	anger: "😡",
	fear: "😨",
	shame: "😳",
	surprise: "😲",
	neutral: "😐",
};

// Локализованные названия категорий эмоций
const keyMap: Record<string, string> = {
	joy: "emotion_category.joy",
	sadness: "emotion_category.sadness",
	anger: "emotion_category.anger",
	fear: "emotion_category.fear",
	shame: "emotion_category.shame",
	surprise: "emotion_category.surprise",
	neutral: "emotion_category.neutral",
};

const emotionLabels = {
	joy: t(keyMap.joy, "Радость") as string,
	sadness: t(keyMap.sadness, "Грусть") as string,
	anger: t(keyMap.anger, "Злость") as string,
	fear: t(keyMap.fear, "Страх") as string,
	shame: t(keyMap.shame, "Стыд") as string,
	surprise: t(keyMap.surprise, "Удивление") as string,
	neutral: t(keyMap.neutral, "Нейтрально") as string,
};

function handleClick() {
	if (props.interactive) {
		emit("click", props.emotion);
		emit("select", props.emotion);
	}
}
</script>

<style lang="scss" scoped>
.cbd-emotion-card {
	position: relative;
	border-radius: var(--radius-lg);
	border: 1px solid var(--neutral-light);
	background: var(--neutral-white);
	cursor: pointer;
	transition: all 0.2s ease;
	overflow: hidden;

	&--interactive {
		&:hover {
			transform: translateY(-2px);
			box-shadow: var(--shadow-md);
			border-color: var(--neutral-medium);
		}

		&:active {
			transform: translateY(0);
		}
	}

	&--selected {
		border-color: var(--primary-blue);
		box-shadow: var(--shadow-md);

		&::after {
			content: "";
			position: absolute;
			inset: 0;
			border: 2px solid var(--primary-blue);
			border-radius: var(--radius-lg);
			pointer-events: none;
		}
	}

	// Размеры
	&--sm {
		.cbd-emotion-card__emoji {
			font-size: 24px;
		}

		.cbd-emotion-card__label {
			font-size: var(--text-small);
		}
	}

	&--md {
		.cbd-emotion-card__emoji {
			font-size: 32px;
		}

		.cbd-emotion-card__label {
			font-size: var(--text-body);
		}
	}

	&--lg {
		.cbd-emotion-card__emoji {
			font-size: 40px;
		}

		.cbd-emotion-card__label {
			font-size: var(--text-h4);
		}
	}

	// Минималистичные цвета для эмоций
	&--joy {
		.cbd-emotion-card__content {
			background: var(--emotion-joy-primary);
			border-left: 4px solid var(--emotion-joy-accent);
		}
		.cbd-emotion-card__label {
			color: var(--text-primary);
		}
	}

	&--sadness {
		.cbd-emotion-card__content {
			background: var(--emotion-sadness-primary);
			border-left: 4px solid var(--emotion-sadness-accent);
		}
		.cbd-emotion-card__label {
			color: var(--text-primary);
		}
	}

	&--anger {
		.cbd-emotion-card__content {
			background: var(--emotion-anger-primary);
			border-left: 4px solid var(--emotion-anger-accent);
		}
		.cbd-emotion-card__label {
			color: var(--text-primary);
		}
	}

	&--fear {
		.cbd-emotion-card__content {
			background: var(--emotion-fear-primary);
			border-left: 4px solid var(--emotion-fear-accent);
		}
		.cbd-emotion-card__label {
			color: var(--text-primary);
		}
	}

	&--shame {
		.cbd-emotion-card__content {
			background: var(--emotion-shame-primary);
			border-left: 4px solid var(--emotion-shame-accent);
		}
		.cbd-emotion-card__label {
			color: var(--text-primary);
		}
	}

	&--surprise {
		.cbd-emotion-card__content {
			background: var(--emotion-surprise-primary);
			border-left: 4px solid var(--emotion-surprise-accent);
		}
		.cbd-emotion-card__label {
			color: var(--text-primary);
		}
	}

	&--neutral {
		.cbd-emotion-card__content {
			background: var(--neutral-lightest);
			border-left: 4px solid var(--neutral-medium);
		}
		.cbd-emotion-card__label {
			color: var(--text-primary);
		}
	}

	&__content {
		padding: var(--space-md);
		border-radius: var(--radius-md);
	}

	&__emoji {
		margin-bottom: var(--space-sm);
		line-height: 1;
	}

	&__label {
		font-weight: var(--weight-medium);
		line-height: var(--line-height-tight);
		margin-bottom: var(--space-xs);
	}

	&__description {
		font-size: var(--text-caption);
		color: var(--text-secondary);
		margin-top: var(--space-xs);
	}

	&__intensity {
		margin-top: var(--space-sm);

		.intensity-dots {
			display: flex;
			justify-content: center;
			gap: var(--space-xs);
		}

		.intensity-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--neutral-light);
			transition: all 0.2s ease;

			&.active {
				background: var(--primary-blue);
			}
		}
	}

	&__check {
		position: absolute;
		top: var(--space-sm);
		right: var(--space-sm);
		color: var(--primary-blue);
		font-size: 20px;
	}
}
</style> 