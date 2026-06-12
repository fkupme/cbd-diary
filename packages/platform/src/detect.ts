/**
 * Платформенная детекция рантайма.
 * Единая точка правды: Tauri (Android/iOS/desktop webview) vs обычный браузер,
 * плюс признаки PWA (standalone) и iOS — нужны для install/push-флоу.
 */

export type PlatformKind = 'tauri' | 'web';

interface TauriGlobals {
	__TAURI__?: unknown;
	__TAURI_INTERNALS__?: unknown;
	isTauri?: boolean;
}

/** Запущены ли мы внутри Tauri-вебвью (нативная сборка Android/iOS/desktop). */
export function isTauriRuntime(): boolean {
	if (typeof globalThis === 'undefined') return false;
	const g = globalThis as typeof globalThis & TauriGlobals;
	return Boolean(g.isTauri || g.__TAURI_INTERNALS__ || g.__TAURI__);
}

/** Текущая платформа в терминах сборки. */
export function platformKind(): PlatformKind {
	return isTauriRuntime() ? 'tauri' : 'web';
}

/** Запущено ли приложение как установленная PWA (standalone-режим). */
export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	const mql = window.matchMedia?.('(display-mode: standalone)');
	const iosStandalone = (window.navigator as unknown as { standalone?: boolean })
		.standalone;
	return Boolean(mql?.matches || iosStandalone);
}

/** iOS Safari/WebKit (важно: там нет beforeinstallprompt, установка только вручную). */
export function isIos(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent || '';
	const iOSDevice = /iPad|iPhone|iPod/.test(ua);
	// iPadOS 13+ маскируется под Mac — детектим по тач-точкам
	const iPadOS =
		navigator.platform === 'MacIntel' &&
		(navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1;
	return iOSDevice || iPadOS;
}

/** Поддерживает ли окружение web push (Notification + Service Worker + PushManager). */
export function supportsWebPush(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		'Notification' in window &&
		'serviceWorker' in navigator &&
		'PushManager' in window
	);
}

/** Безопасный ли контекст для SW/push (https или localhost). */
export function isSecurePushContext(): boolean {
	if (typeof window === 'undefined') return false;
	return window.isSecureContext || window.location.hostname === 'localhost';
}
