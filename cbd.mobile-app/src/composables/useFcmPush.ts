/**
 * Web push (FCM) для браузера/PWA.
 * Поверх @cbd/platform: регистрируем service worker, запрашиваем разрешение,
 * берём FCM-токен и регистрируем его на бэке (POST /notifications/register,
 * platform=WEB). Бэкенд уже умеет слать пуши по этим токенам.
 *
 * На нативной сборке (Tauri) ничего не делает — там свой remote-push механизм.
 */

import { firebaseWebConfig, hasFirebaseConfig, serviceWorkerUrlWithConfig } from '@/config/firebase';
import { apiClient } from '@/services/api/client';
import { authService } from '@/services/api/AuthService';
import { notificationService } from '@/services/NotificationService';
import {
	createFcmClient,
	isSecurePushContext,
	isTauriRuntime,
	registerServiceWorker,
	supportsWebPush,
	type FcmClient,
} from '@cbd/platform';

let clientPromise: Promise<FcmClient | null> | null = null;
let foregroundBound = false;

async function ensureClient(): Promise<FcmClient | null> {
	if (!clientPromise) {
		clientPromise = createFcmClient(firebaseWebConfig());
	}
	return clientPromise;
}

export function useFcmPush() {
	/**
	 * Включить web push: (опционально) запросить разрешение, получить токен,
	 * зарегистрировать его на бэке. Возвращает токен или null.
	 */
	const enablePushNotifications = async (
		requestPermission = true
	): Promise<string | null> => {
		if (isTauriRuntime()) return null;
		if (!supportsWebPush()) {
			console.warn('[push] web push не поддерживается в этом браузере');
			return null;
		}
		if (!isSecurePushContext()) {
			console.warn('[push] нужен https (или localhost) для web push');
			return null;
		}
		if (!hasFirebaseConfig()) {
			console.warn('[push] Firebase web-config не задан — web push выключен');
			return null;
		}

		let permission = Notification.permission;
		if (permission === 'default' && requestPermission) {
			permission = await Notification.requestPermission();
		}
		if (permission !== 'granted') {
			console.warn('[push] разрешение на уведомления не выдано:', permission);
			return null;
		}

		// SW с конфигом в query — единый источник env
		const registration = await registerServiceWorker(
			serviceWorkerUrlWithConfig()
		);
		const client = await ensureClient();
		if (!client || !registration) return null;

		const token = await client.getDeviceToken(registration);
		if (!token) {
			console.warn('[push] пустой FCM-токен');
			return null;
		}

		// Регистрируем токен на бэке (platform=WEB)
		try {
			const me = authService.getCurrentUser();
			await apiClient.post('/notifications/register', {
				userId: me?.id ?? undefined,
				platform: 'WEB',
				token,
			});
		} catch (e) {
			console.warn('[push] не удалось зарегистрировать токен на сервере', e);
		}

		setupForegroundNotifications();
		return token;
	};

	/** Показывать пуши, пришедшие пока вкладка активна (foreground). */
	const setupForegroundNotifications = async () => {
		if (foregroundBound) return;
		const client = await ensureClient();
		if (!client) return;
		foregroundBound = true;

		client.onForegroundMessage(payload => {
			const n = payload.notification;
			void notificationService.sendInstant({
				title: n?.title || 'CBD Diary',
				body: n?.body || '',
				channelId: 'general',
			});
		});
	};

	return { enablePushNotifications, setupForegroundNotifications };
}
