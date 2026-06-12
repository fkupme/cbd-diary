/**
 * Публичный web-конфиг Firebase для web push (FCM).
 * Значения берём из VITE_FIREBASE_* (при web-сборке подставляются из env,
 * в CI — из GitHub Secrets). Это не секрет — он и так уезжает в браузер.
 * Серверный секрет (service account) живёт ТОЛЬКО на бэке.
 */

import type { FcmWebConfig } from '@cbd/platform';

export function firebaseWebConfig(): FcmWebConfig {
	const env = import.meta.env;
	return {
		apiKey: env.VITE_FIREBASE_API_KEY || '',
		authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
		projectId: env.VITE_FIREBASE_PROJECT_ID || '',
		storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
		messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
		appId: env.VITE_FIREBASE_APP_ID || '',
		vapidKey: env.VITE_FIREBASE_VAPID_KEY || '',
	};
}

/** Задан ли минимально необходимый конфиг (иначе web push молча выключен). */
export function hasFirebaseConfig(): boolean {
	const c = firebaseWebConfig();
	return Boolean(
		c.apiKey && c.projectId && c.messagingSenderId && c.appId && c.vapidKey
	);
}

/**
 * URL service worker с публичным конфигом в query — так firebase-messaging-sw.js
 * получает конфиг из единого env-источника, без хардкода в статическом файле.
 */
export function serviceWorkerUrlWithConfig(
	path = '/firebase-messaging-sw.js'
): string {
	const c = firebaseWebConfig();
	const params = new URLSearchParams({
		apiKey: c.apiKey,
		authDomain: c.authDomain,
		projectId: c.projectId,
		storageBucket: c.storageBucket,
		messagingSenderId: c.messagingSenderId,
		appId: c.appId,
	});
	return `${path}?${params.toString()}`;
}
