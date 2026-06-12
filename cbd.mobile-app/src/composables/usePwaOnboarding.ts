/**
 * Оркестратор PWA-онбординга (web). Строгий флоу:
 *
 *   1. Ждём beforeinstallprompt → показываем СВОЁ предложение «установить».
 *   2. Пользователь ставит приложение → пуши предлагаем уже в установленной
 *      PWA (standalone), не во вкладке (ставим флаг pendingPushOffer).
 *   3. Пользователь отказывается от установки → сразу предлагаем пуши в браузере.
 *
 * iOS Safari (нет beforeinstallprompt) → показываем ручную инструкцию
 * «Поделиться → На экран Домой»; пуши там работают только в установленной PWA.
 */

import { hasFirebaseConfig } from '@/config/firebase';
import {
	canPromptInstall,
	isIos,
	isStandalone,
	isTauriRuntime,
	onAppInstalled,
	onInstallPromptCaptured,
	promptInstall,
	supportsWebPush,
} from '@cbd/platform';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useFcmPush } from './useFcmPush';

const PENDING_PUSH_KEY = 'cbd.pwa.pendingPushOffer';
const PUSH_PROMPTED_KEY = 'cbd.pwa.pushPrompted';
const INSTALL_DISMISSED_KEY = 'cbd.pwa.installDismissed';

export type OnboardingMode = 'install' | 'install-ios' | 'push';

export function usePwaOnboarding() {
	const { enablePushNotifications } = useFcmPush();

	const mode = ref<OnboardingMode | null>(null);
	const busy = ref(false);
	const visible = computed(() => mode.value !== null);

	let offCapture = () => {};
	let offInstalled = () => {};

	const pushAlreadyHandled = () =>
		typeof Notification === 'undefined' ||
		Notification.permission !== 'default' ||
		localStorage.getItem(PUSH_PROMPTED_KEY) === '1';

	const installDismissed = () =>
		localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';

	/** Показать предложение пушей, если это уместно. true — если показали. */
	const offerPush = (): boolean => {
		if (!supportsWebPush() || !hasFirebaseConfig()) return false;
		if (pushAlreadyHandled()) return false;
		mode.value = 'push';
		return true;
	};

	const evaluate = () => {
		if (isTauriRuntime() || typeof window === 'undefined') return;

		// Уже установлено (standalone): предлагаем пуши «на устройстве»
		if (isStandalone()) {
			const pending = localStorage.getItem(PENDING_PUSH_KEY) === '1';
			if (pending || !pushAlreadyHandled()) offerPush();
			return;
		}

		// Браузерная вкладка
		if (installDismissed()) {
			// Установку уже отклоняли — можем ещё предложить пуши в браузере
			offerPush();
			return;
		}

		if (isIos()) {
			// iOS Safari: программной установки нет — ручная инструкция
			mode.value = 'install-ios';
			return;
		}

		if (canPromptInstall()) {
			mode.value = 'install';
		}
	};

	onMounted(() => {
		offCapture = onInstallPromptCaptured(() => {
			if (!isStandalone() && mode.value === null && !installDismissed()) {
				mode.value = 'install';
			}
		});
		offInstalled = onAppInstalled(() => {
			// Установка прошла — пуши предложим при запуске установленной PWA
			localStorage.setItem(PENDING_PUSH_KEY, '1');
			mode.value = null;
		});
		evaluate();
	});

	onUnmounted(() => {
		offCapture();
		offInstalled();
	});

	/** Подтверждение текущего шага (главная кнопка карточки). */
	const confirm = async () => {
		if (busy.value) return;
		busy.value = true;
		try {
			if (mode.value === 'install') {
				const outcome = await promptInstall();
				if (outcome === 'accepted') {
					// Пуши — позже, в standalone-запуске
					localStorage.setItem(PENDING_PUSH_KEY, '1');
					mode.value = null;
				} else {
					// dismissed / unavailable → предлагаем пуши прямо в браузере
					localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
					if (!offerPush()) mode.value = null;
				}
			} else if (mode.value === 'install-ios') {
				localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
				mode.value = null;
			} else if (mode.value === 'push') {
				localStorage.setItem(PUSH_PROMPTED_KEY, '1');
				localStorage.removeItem(PENDING_PUSH_KEY);
				await enablePushNotifications(true);
				mode.value = null;
			}
		} finally {
			busy.value = false;
		}
	};

	/** Отклонение текущего шага («Не сейчас»). */
	const dismiss = () => {
		if (mode.value === 'install' || mode.value === 'install-ios') {
			// Отказ от установки → по флоу сразу предлагаем пуши в браузере
			localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
			if (!offerPush()) mode.value = null;
		} else if (mode.value === 'push') {
			localStorage.setItem(PUSH_PROMPTED_KEY, '1');
			localStorage.removeItem(PENDING_PUSH_KEY);
			mode.value = null;
		} else {
			mode.value = null;
		}
	};

	return { visible, mode, busy, confirm, dismiss };
}
