<template>
	<Teleport to="body">
		<Transition name="pwa-onb">
			<div v-if="content" class="pwa-onb" role="dialog" aria-modal="false">
				<div class="pwa-onb__card">
					<div class="pwa-onb__icon">{{ content.icon }}</div>
					<div class="pwa-onb__body">
						<div class="pwa-onb__title">{{ content.title }}</div>
						<p class="pwa-onb__text">{{ content.text }}</p>
						<div class="pwa-onb__actions">
							<CbdButton
								:label="content.confirm"
								variant="primary"
								size="md"
								:loading="busy"
								@click="confirm"
							/>
							<CbdButton
								v-if="content.dismiss"
								:label="content.dismiss"
								variant="ghost"
								size="md"
								:disabled="busy"
								@click="dismiss"
							/>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CbdButton from '@/components/ui/CbdButton.vue';
import { usePwaOnboarding } from '@/composables/usePwaOnboarding';

const { mode, busy, confirm, dismiss } = usePwaOnboarding();

interface Card {
	icon: string;
	title: string;
	text: string;
	confirm: string;
	dismiss?: string;
}

const content = computed<Card | null>(() => {
	switch (mode.value) {
		case 'install':
			return {
				icon: '📲',
				title: 'Установить CBD Diary',
				text: 'Добавьте дневник на главный экран — открывается как обычное приложение и работает в полноэкранном режиме.',
				confirm: 'Установить',
				dismiss: 'Не сейчас',
			};
		case 'install-ios':
			return {
				icon: '📲',
				title: 'Добавить на экран «Домой»',
				text: 'В Safari нажмите «Поделиться», затем «На экран „Домой"». После установки можно будет включить уведомления.',
				confirm: 'Понятно',
				dismiss: 'Не сейчас',
			};
		case 'push':
			return {
				icon: '🔔',
				title: 'Включить уведомления',
				text: 'Напоминания вести дневник и важные сообщения будут приходить как пуш-уведомления.',
				confirm: 'Включить',
				dismiss: 'Не сейчас',
			};
		default:
			return null;
	}
});
</script>

<style scoped lang="scss">
.pwa-onb {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 4000;
	display: flex;
	justify-content: center;
	padding: 16px;
	padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
	pointer-events: none;
}

.pwa-onb__card {
	pointer-events: auto;
	width: 100%;
	max-width: 460px;
	display: flex;
	gap: 14px;
	padding: 18px;
	border-radius: 18px;
	background: var(--ink-soft, #1a1f2b);
	border: 1px solid rgba(240, 178, 100, 0.28);
	box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
	color: var(--paper, #ede6d6);
}

.pwa-onb__icon {
	font-size: 28px;
	line-height: 1.2;
	flex: 0 0 auto;
}

.pwa-onb__body {
	flex: 1 1 auto;
	min-width: 0;
}

.pwa-onb__title {
	font-weight: 600;
	font-size: 16px;
	margin-bottom: 4px;
	color: var(--paper, #ede6d6);
}

.pwa-onb__text {
	margin: 0 0 14px;
	font-size: 13.5px;
	line-height: 1.45;
	color: var(--paper-dim, #97907e);
}

.pwa-onb__actions {
	display: flex;
	gap: 10px;
	flex-wrap: wrap;
}

/* Появление снизу */
.pwa-onb-enter-active,
.pwa-onb-leave-active {
	transition: opacity 0.22s ease, transform 0.22s ease;
}
.pwa-onb-enter-from,
.pwa-onb-leave-to {
	opacity: 0;
	transform: translateY(16px);
}
</style>
