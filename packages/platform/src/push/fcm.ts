/**
 * Тонкая обёртка над Firebase Cloud Messaging (web).
 * Фреймворк-агностична: принимает конфиг + vapid-ключ, отдаёт работу с токеном.
 * Vue-композабл в приложении (useFcmPush) строится поверх этого.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
	deleteToken,
	getMessaging,
	getToken,
	isSupported,
	onMessage,
	type MessagePayload,
	type Messaging,
} from 'firebase/messaging';

export interface FcmWebConfig {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	messagingSenderId: string;
	appId: string;
	/** Web Push certificate (VAPID key) из Firebase Console → Cloud Messaging. */
	vapidKey: string;
}

export interface FcmClient {
	/** Запросить/получить токен устройства (требует уже выданного разрешения). */
	getDeviceToken(
		serviceWorkerRegistration?: ServiceWorkerRegistration
	): Promise<string | null>;
	/** Сообщения, пришедшие пока вкладка на переднем плане. */
	onForegroundMessage(cb: (payload: MessagePayload) => void): () => void;
	/** Удалить текущий токен (отписка). */
	removeDeviceToken(): Promise<boolean>;
}

function hasAllConfig(config: Partial<FcmWebConfig>): config is FcmWebConfig {
	return Boolean(
		config.apiKey &&
			config.projectId &&
			config.messagingSenderId &&
			config.appId &&
			config.vapidKey
	);
}

/**
 * Создать FCM-клиент. Возвращает null, если окружение не поддерживает messaging
 * (нет SW/Push API, не задан конфиг) — вызывающая сторона тихо деградирует.
 */
export async function createFcmClient(
	config: Partial<FcmWebConfig>
): Promise<FcmClient | null> {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
		return null;
	}
	if (!hasAllConfig(config)) {
		console.warn('[fcm] неполный конфиг Firebase — web push отключён');
		return null;
	}
	if (!(await isSupported().catch(() => false))) {
		console.warn('[fcm] Firebase Messaging не поддерживается в этом браузере');
		return null;
	}

	const app: FirebaseApp = getApps().length
		? getApp()
		: initializeApp({
				apiKey: config.apiKey,
				authDomain: config.authDomain,
				projectId: config.projectId,
				storageBucket: config.storageBucket,
				messagingSenderId: config.messagingSenderId,
				appId: config.appId,
		  });

	const messaging: Messaging = getMessaging(app);
	const vapidKey = config.vapidKey;

	return {
		async getDeviceToken(serviceWorkerRegistration) {
			try {
				const token = await getToken(messaging, {
					vapidKey,
					...(serviceWorkerRegistration ? { serviceWorkerRegistration } : {}),
				});
				return token || null;
			} catch (error) {
				console.warn('[fcm] getToken failed:', error);
				return null;
			}
		},
		onForegroundMessage(cb) {
			return onMessage(messaging, cb);
		},
		async removeDeviceToken() {
			try {
				return await deleteToken(messaging);
			} catch {
				return false;
			}
		},
	};
}
