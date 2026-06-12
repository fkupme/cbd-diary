/**
 * Перехват и управление промптом установки PWA.
 * Браузер кидает `beforeinstallprompt` один раз; мы его перехватываем, гасим
 * дефолтную мини-плашку и держим отложенный prompt, чтобы показать СВОЁ
 * предложение установки в нужный момент флоу.
 */

interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{
		outcome: 'accepted' | 'dismissed';
		platform: string;
	}>;
	prompt(): Promise<void>;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}
	interface Window {
		__cbdDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
	}
}

const CAPTURED_EVENT = 'cbd:beforeinstallprompt';
const INSTALLED_EVENT = 'cbd:appinstalled';

let listenersBound = false;

/**
 * Навесить глобальные слушатели как можно раньше (до маунта приложения),
 * иначе `beforeinstallprompt` можно пропустить. Идемпотентно.
 */
export function setupInstallPromptCapture(): void {
	if (typeof window === 'undefined' || listenersBound) return;
	listenersBound = true;

	window.addEventListener('beforeinstallprompt', event => {
		event.preventDefault();
		window.__cbdDeferredInstallPrompt = event;
		window.dispatchEvent(new CustomEvent(CAPTURED_EVENT));
	});

	window.addEventListener('appinstalled', () => {
		window.__cbdDeferredInstallPrompt = null;
		window.dispatchEvent(new CustomEvent(INSTALLED_EVENT));
	});
}

/** Есть ли отложенный промпт (можно ли показать кнопку «Установить»). */
export function canPromptInstall(): boolean {
	return typeof window !== 'undefined' && Boolean(window.__cbdDeferredInstallPrompt);
}

/**
 * Показать нативный системный промпт установки и вернуть выбор пользователя.
 * `unavailable` — промпта нет (iOS, уже установлено, неподдерживаемо).
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
	if (typeof window === 'undefined') return 'unavailable';
	const deferred = window.__cbdDeferredInstallPrompt;
	if (!deferred) return 'unavailable';

	try {
		await deferred.prompt();
		const choice = await deferred.userChoice;
		window.__cbdDeferredInstallPrompt = null;
		return choice.outcome;
	} catch {
		window.__cbdDeferredInstallPrompt = null;
		return 'unavailable';
	}
}

/** Подписка на перехват `beforeinstallprompt` (для реактивного UI). */
export function onInstallPromptCaptured(cb: () => void): () => void {
	if (typeof window === 'undefined') return () => {};
	window.addEventListener(CAPTURED_EVENT, cb);
	return () => window.removeEventListener(CAPTURED_EVENT, cb);
}

/** Подписка на факт установки приложения. */
export function onAppInstalled(cb: () => void): () => void {
	if (typeof window === 'undefined') return () => {};
	window.addEventListener(INSTALLED_EVENT, cb);
	return () => window.removeEventListener(INSTALLED_EVENT, cb);
}
