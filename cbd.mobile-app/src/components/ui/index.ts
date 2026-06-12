// CBD Mood Diary UI Kit
// Экспорт всех UI компонентов

export { default as CbdButton } from './CbdButton.vue';
export { default as CbdEmotionCard } from './CbdEmotionCard.vue';
export { default as CbdEmotionWheelPicker } from './CbdEmotionWheelPicker.vue';
export { default as CbtFaqAccordion } from './CbtFaqAccordion.vue';
export { default as CbdInput } from './CbdInput.vue';
export { default as CbdModal } from './CbdModal.vue';
export { default as CbdTabBar } from './CbdTabBar.vue';

// Типы для TypeScript
export type ButtonVariant =
	| 'primary'
	| 'secondary'
	| 'success'
	| 'danger'
	| 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type InputVariant = 'filled' | 'outlined' | 'standout' | 'underline';
export type EmotionType =
	| 'joy'
	| 'sadness'
	| 'anger'
	| 'fear'
	| 'shame'
	| 'surprise'
	| 'neutral';

export interface Tab {
	name: string;
	icon: string;
	label?: string;
	badge?: number;
	disabled?: boolean;
}
