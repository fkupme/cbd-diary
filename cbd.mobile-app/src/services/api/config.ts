/**
 * API Configuration
 * Централизованная конфигурация для всех API вызовов
 */

export const API_CONFIG = {
	// Base URLs для разных окружений
	BASE_URL: {
		development: 'http://127.0.0.1:3002/api/v1',
		local: 'http://localhost:3002/api/v1', // Fallback для локальной разработки
		androidEmulator: 'http://10.0.2.2:3002/api/v1',
		hostDockerInternal: 'http://host.docker.internal:3002/api/v1',
		production: 'https://api.cbd-diary.com/api/v1',
		staging: 'https://staging-api.cbd-diary.com/api/v1',
	},

	// Endpoints для каждого домена
	ENDPOINTS: {
		// Auth endpoints
		AUTH: {
			LOGIN: '/auth/login',
			REGISTER: '/auth/register',
			REFRESH: '/auth/refresh',
			LOGOUT: '/auth/logout',
		},

		// Users endpoints
		USERS: {
			BASE: '/users',
			PROFILE: (id: string) => `/users/${id}`,
			CHANGE_PASSWORD: (id: string) => `/users/${id}/change-password`,
		},

		// Emotions endpoints
		EMOTIONS: {
			CATEGORIES: '/emotions/categories',
			CATEGORY: (id: number) => `/emotions/categories/${id}`,
			EMOTIONS: '/emotions',
			EMOTION: (id: number) => `/emotions/${id}`,
		},

		// CBT endpoints
		CBT: {
			ENTRIES: '/cbt/entries',
			ENTRY: (id: string) => `/cbt/entries/${id}`,
			TAGS: '/cbt/entries/tags/all',
			MOOD_AFTER: (id: string) => `/cbt/entries/${id}/mood-after`,
		},

		// Chat endpoints
		CHAT: {
			BY_ENTRY: (entryId: string) => `/chat/entries/${entryId}`,
			MESSAGES: (chatId: string) => `/chat/${chatId}/messages`,
			FINALIZE: (chatId: string) => `/chat/${chatId}/finalize`,
		},

		// Analytics endpoints
		ANALYTICS: {
			USER_STATS: '/analytics/user-stats',
			EMOTIONS: '/analytics/emotions',
			MOOD_TRENDS: '/analytics/mood-trends',
			COGNITIVE_INSIGHTS: '/analytics/cognitive-insights',
			PROGRESS_REPORT: '/analytics/progress-report',
			SUMMARY: '/analytics/summary',
			REFRESH_STATS: '/analytics/refresh-stats',
		},

		// Sync endpoints
		SYNC: {
			USER_DATA: '/sync/user-data',
			RESOLVE_CONFLICTS: '/sync/resolve-conflicts',
			STATUS: '/sync/status',
			FORCE_SYNC: '/sync/force-sync',
			HEALTH: '/sync/health',
		},
	},

	// HTTP Configuration
	HTTP: {
		TIMEOUT: 30000, // 30 секунд
		RETRY_ATTEMPTS: 3,
		RETRY_DELAY: 1000, // 1 секунда
	},

	// Headers
	HEADERS: {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'User-Agent': 'CBD-Diary-Mobile/1.0',
	},

	// Status codes
	STATUS_CODES: {
		SUCCESS: 200,
		CREATED: 201,
		NO_CONTENT: 204,
		BAD_REQUEST: 400,
		UNAUTHORIZED: 401,
		FORBIDDEN: 403,
		NOT_FOUND: 404,
		INTERNAL_SERVER_ERROR: 500,
	},
} as const;

function normalizeBaseURL(url?: string | null): string | null {
	if (!url) {
		return null;
	}

	return url.replace(/\/+$/, '');
}

function getConfiguredBaseURL(): string | null {
	return normalizeBaseURL(import.meta.env.VITE_API_BASE_URL);
}

export function isTauriRuntime(): boolean {
	const runtime = globalThis as typeof globalThis & {
		__TAURI__?: unknown;
		__TAURI_INTERNALS__?: unknown;
		isTauri?: boolean;
	};

	return Boolean(
		runtime.isTauri || runtime.__TAURI_INTERNALS__ || runtime.__TAURI__
	);
}

function detectMobilePlatform(): 'android' | 'ios' | 'unknown' {
	const userAgent = navigator.userAgent || '';

	if (/Android/i.test(userAgent)) {
		return 'android';
	}

	if (/iPhone|iPad|iPod|iOS/i.test(userAgent)) {
		return 'ios';
	}

	return 'unknown';
}

function uniqueURLs(urls: Array<string | null | undefined>): string[] {
	return Array.from(
		new Set(urls.map((url) => normalizeBaseURL(url)).filter(Boolean) as string[])
	);
}

/**
 * Получить текущий base URL в зависимости от окружения
 */
export function getCurrentBaseURL(): string {
	const configuredBaseURL = getConfiguredBaseURL();
	if (configuredBaseURL) {
		return configuredBaseURL;
	}

	// В production приложении можно использовать переменные окружения
	const environment = import.meta.env.MODE || 'development';

	if (environment === 'production') {
		return API_CONFIG.BASE_URL.production;
	} else if (environment === 'staging') {
		return API_CONFIG.BASE_URL.staging;
	}

	// В development пробуем разные варианты
	const isMobile = isTauriRuntime();

	if (isMobile) {
		const platform = detectMobilePlatform();

		if (platform === 'android') {
			return API_CONFIG.BASE_URL.androidEmulator;
		}

		return API_CONFIG.BASE_URL.development;
	} else {
		// Для веб-версии используем localhost
		return API_CONFIG.BASE_URL.local;
	}
}

/**
 * Получить список всех возможных URLs для fallback
 */
export function getFallbackURLs(): string[] {
	const configuredBaseURL = getConfiguredBaseURL();
	const environment = import.meta.env.MODE || 'development';

	if (environment !== 'development') {
		return uniqueURLs([configuredBaseURL, getCurrentBaseURL()]);
	}

	// В development предоставляем несколько вариантов
	return uniqueURLs([
		configuredBaseURL,
		API_CONFIG.BASE_URL.development,
		API_CONFIG.BASE_URL.local,
		API_CONFIG.BASE_URL.androidEmulator,
		API_CONFIG.BASE_URL.hostDockerInternal,
	]);
}

/**
 * Типы для конфигурации
 */
export type ApiEndpoint = string;
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiEnvironment = keyof typeof API_CONFIG.BASE_URL;
