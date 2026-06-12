/**
 * Реактивная обёртка над промптом установки PWA (для UI, напр. в Настройках).
 */

import {
	canPromptInstall,
	isIos,
	isStandalone,
	onAppInstalled,
	onInstallPromptCaptured,
	promptInstall,
} from '@cbd/platform';
import { onMounted, onUnmounted, ref } from 'vue';

export function usePwaInstall() {
	const canInstall = ref(canPromptInstall());
	const installed = ref(isStandalone());

	let offCapture = () => {};
	let offInstalled = () => {};

	onMounted(() => {
		offCapture = onInstallPromptCaptured(() => {
			canInstall.value = canPromptInstall();
		});
		offInstalled = onAppInstalled(() => {
			canInstall.value = false;
			installed.value = true;
		});
	});

	onUnmounted(() => {
		offCapture();
		offInstalled();
	});

	const install = async () => {
		const outcome = await promptInstall();
		canInstall.value = canPromptInstall();
		return outcome;
	};

	return {
		canInstall,
		installed,
		isIosManual: isIos() && !isStandalone(),
		install,
	};
}
