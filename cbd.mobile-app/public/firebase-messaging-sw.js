/* global importScripts, firebase, self, clients */
/**
 * Service worker для web push (Firebase Cloud Messaging) + эвристик установки PWA.
 *
 * Конфиг Firebase (публичный web-config) прилетает в SW через query-параметры
 * при регистрации из приложения: navigator.serviceWorker.register(
 *   '/firebase-messaging-sw.js?apiKey=...&projectId=...&...'
 * ). Так единым источником правды остаётся VITE_FIREBASE_* из env — ничего не
 * хардкодим в статическом файле.
 */

importScripts(
	'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js'
);
importScripts(
	'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js'
);

const params = new URL(self.location).searchParams;
const firebaseConfig = {
	apiKey: params.get('apiKey') || '',
	authDomain: params.get('authDomain') || '',
	projectId: params.get('projectId') || '',
	storageBucket: params.get('storageBucket') || '',
	messagingSenderId: params.get('messagingSenderId') || '',
	appId: params.get('appId') || '',
};

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(self.clients.claim());
});

// Пассивный fetch-обработчик: его НАЛИЧИЕ нужно для install-эвристик Chromium,
// но мы НИЧЕГО не перехватываем (никаких respondWith) — браузер обрабатывает все
// запросы сам. Любой respondWith(fetch(...)) ломал SPA-навигации и кросс-ориджин
// к API, поэтому не вмешиваемся вовсе.
self.addEventListener('fetch', () => {});

// Инициализируем messaging только если конфиг реально передан.
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
	firebase.initializeApp(firebaseConfig);
	const messaging = firebase.messaging();

	messaging.onBackgroundMessage(payload => {
		const data = payload.data || {};
		const notification = payload.notification || {};
		const entryId = data.entryId || data.entry_id || data.recordId;

		self.registration.showNotification(notification.title || 'CBD Diary', {
			body: notification.body || '',
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			tag: entryId ? `entry:${entryId}` : undefined,
			data,
		});
	});
}

self.addEventListener('notificationclick', event => {
	event.notification.close();

	const targetUrl = new URL('/', self.location.origin).href;

	event.waitUntil(
		clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then(clientList => {
				for (const client of clientList) {
					if ('focus' in client) {
						client.navigate(targetUrl);
						return client.focus();
					}
				}
				if (clients.openWindow) {
					return clients.openWindow(targetUrl);
				}
				return null;
			})
	);
});
