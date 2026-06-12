/**
 * Регистрация service worker для PWA (нужен и для web push, и для эвристик
 * установки в Chromium). Идемпотентна — повторный вызов вернёт ту же регистрацию.
 */

export async function registerServiceWorker(
	scriptUrl = '/firebase-messaging-sw.js'
): Promise<ServiceWorkerRegistration | null> {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
		return null;
	}

	try {
		const existing = await navigator.serviceWorker.getRegistration();
		if (existing && existing.active?.scriptURL.endsWith(scriptUrl)) {
			return existing;
		}
		return await navigator.serviceWorker.register(scriptUrl);
	} catch (error) {
		console.warn('[pwa] service worker registration failed:', error);
		return null;
	}
}
