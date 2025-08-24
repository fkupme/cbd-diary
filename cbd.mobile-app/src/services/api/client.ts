/**
 * API Client
 * Базовый клиент для всех API вызовов с использованием Facade Pattern
 */

import { HttpService } from '../HttpService';
import { SecureStorageService } from '../SecureStorageService';
import { API_CONFIG, getCurrentBaseURL, type ApiMethod } from './config';
import type {
	ApiError,
	ApiResponse,
	AuthenticatedRequestOptions,
} from './types';

export class ApiClient {
	private static instance: ApiClient;
	private httpService: HttpService;
	private secureStorage: SecureStorageService;
	private authToken: string | null = null;
	private refreshToken: string | null = null;
	private isRefreshing = false;
	private refreshPromise: Promise<string> | null = null;
	private isInitialized = false;
	private initPromise: Promise<void> | null = null;

	private constructor() {
		this.httpService = HttpService.getInstance();
		this.secureStorage = SecureStorageService.getInstance();
		// Запускаем инициализацию, но не ждем ее в конструкторе
		this.initPromise = this.initialize();
	}

	static getInstance(): ApiClient {
		if (!ApiClient.instance) {
			ApiClient.instance = new ApiClient();
		}
		return ApiClient.instance;
	}

	/**
	 * Инициализация API клиента
	 */
	private async initialize(): Promise<void> {
		try {
			// Инициализируем HttpService с base URL
			await this.httpService.initialize(getCurrentBaseURL());

			// Устанавливаем базовые заголовки
			this.httpService.setDefaultHeaders(API_CONFIG.HEADERS);

			// Загружаем сохраненные токены
			await this.loadTokens();

			this.isInitialized = true;
			console.log('🔌 ApiClient инициализирован');
		} catch (error) {
			console.error('❌ Ошибка инициализации ApiClient:', error);
			this.isInitialized = false;
			throw error;
		}
	}

	/**
	 * Убедиться, что клиент инициализирован
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.isInitialized && this.initPromise) {
			await this.initPromise;
		}
	}

	/**
	 * Публичный метод ожидания готовности клиента
	 */
	public async ready(): Promise<void> {
		await this.ensureInitialized();
	}

	/**
	 * Загрузить токены из безопасного хранилища
	 */
	private async loadTokens(): Promise<void> {
		try {
			const tokens = await this.secureStorage.getAPITokens();

			if (tokens?.access) {
				this.authToken = tokens.access;
				this.httpService.setDefaultHeaders({
					...API_CONFIG.HEADERS,
					Authorization: `Bearer ${tokens.access}`,
				});
			}

			if (tokens?.refresh) {
				this.refreshToken = tokens.refresh;
			}
		} catch (error) {
			console.warn('⚠️ Не удалось загрузить токены:', error);
		}
	}

	/**
	 * Сохранить токены в безопасное хранилище
	 */
	public async setTokens(
		accessToken: string,
		refreshToken: string
	): Promise<void> {
		try {
			this.authToken = accessToken;
			this.refreshToken = refreshToken;

			await this.secureStorage.storeAPITokens({
				access: accessToken,
				refresh: refreshToken,
			});

			this.httpService.setDefaultHeaders({
				...API_CONFIG.HEADERS,
				Authorization: `Bearer ${accessToken}`,
			});

			console.log('🔐 Токены сохранены');
		} catch (error) {
			console.error('❌ Ошибка сохранения токенов:', error);
			throw error;
		}
	}

	/**
	 * Очистить токены
	 */
	public async clearTokens(): Promise<void> {
		try {
			this.authToken = null;
			this.refreshToken = null;

			await this.secureStorage.removeSecure('api_tokens');

			this.httpService.setDefaultHeaders(API_CONFIG.HEADERS);

			console.log('🗑️ Токены очищены');
		} catch (error) {
			console.error('❌ Ошибка очистки токенов:', error);
		}
	}

	/**
	 * Обновить access token
	 */
	private async refreshAccessToken(): Promise<string> {
		if (!this.refreshToken) {
			throw new Error('Refresh token не найден');
		}

		if (this.isRefreshing && this.refreshPromise) {
			return this.refreshPromise;
		}

		this.isRefreshing = true;
		this.refreshPromise = this.performTokenRefresh();

		try {
			const newAccessToken = await this.refreshPromise;
			this.isRefreshing = false;
			this.refreshPromise = null;
			return newAccessToken;
		} catch (error) {
			this.isRefreshing = false;
			this.refreshPromise = null;
			throw error;
		}
	}

	/**
	 * Выполнить обновление токена
	 */
	private async performTokenRefresh(): Promise<string> {
		try {
			const response = await this.httpService.request<
				ApiResponse<{
					tokens?: { access: string; refresh: string };
					accessToken?: string;
				}>
			>({
				method: 'POST',
				endpoint: API_CONFIG.ENDPOINTS.AUTH.REFRESH,
				data: { refreshToken: this.refreshToken },
				headers: API_CONFIG.HEADERS, // Без Authorization header
			});

			if (response.success && response.data) {
				if ((response.data as any).tokens) {
					const { access, refresh } = (response.data as any).tokens;
					await this.setTokens(access, refresh);
					return access;
				}
				if ((response.data as any).accessToken) {
					const access = (response.data as any).accessToken as string;
					// refresh не вернулся — используем текущий
					await this.setTokens(access, this.refreshToken as string);
					return access;
				}
			}

			throw new Error('Невалидный ответ при обновлении токена');
		} catch (error) {
			// Если refresh token недействителен, очищаем все токены
			await this.clearTokens();
			throw new Error('Сессия истекла, требуется повторная авторизация');
		}
	}

	/**
	 * Обработка ошибок
	 */
	private handleError(error: any): ApiError {
		console.error('🚨 API Error:', error);

		// Если это уже обработанная ошибка
		if (error.success === false) {
			return error as ApiError;
		}

		// Стандартная обработка ошибок
		const statusCode = error.response?.status || error.status || 500;
		let errorMessage = 'Неизвестная ошибка';
		let errorCode = 'UNKNOWN_ERROR';

		if (error.response?.data) {
			errorMessage =
				error.response.data.message ||
				error.response.data.error ||
				errorMessage;
			errorCode = error.response.data.code || errorCode;
		} else if (error.message) {
			errorMessage = error.message;
		}

		return {
			success: false,
			error: {
				code: errorCode,
				message: errorMessage,
				details: error.response?.data || error,
			},
			statusCode,
		};
	}

	/**
	 * Выполнить API запрос
	 */
	public async request<T = any>(
		method: ApiMethod,
		endpoint: string,
		data?: any,
		options: AuthenticatedRequestOptions = {}
	): Promise<ApiResponse<T>> {
		try {
			// Убеждаемся, что клиент инициализирован
			await this.ensureInitialized();

			const { requireAuth = true, ...requestOptions } = options;

			// Подготавливаем заголовки
			const headers: Record<string, string> = {
				...API_CONFIG.HEADERS,
				...requestOptions.headers,
			};

			// Если нужна аутентификация
			if (requireAuth) {
				if (!this.authToken) {
					throw new Error('Требуется авторизация');
				}
				headers.Authorization = `Bearer ${this.authToken}`;
			}

			// Выполняем запрос
			const response = await this.httpService.request<ApiResponse<T>>({
				method,
				endpoint,
				data,
				headers,
				timeout: requestOptions.timeout || API_CONFIG.HTTP.TIMEOUT,
				...requestOptions,
			});

			// Если получили 401 без исключения — выполняем refresh и ретраим
			if (
				response?.status === 401 &&
				requireAuth !== false &&
				this.authToken &&
				this.refreshToken
			) {
				try {
					await this.refreshAccessToken();
					const retryHeaders = {
						...API_CONFIG.HEADERS,
						...options.headers,
						Authorization: `Bearer ${this.authToken}`,
					};
					const retryResponse = await this.httpService.request<ApiResponse<T>>({
						method,
						endpoint,
						data,
						headers: retryHeaders,
						timeout: options.timeout || API_CONFIG.HTTP.TIMEOUT,
						...options,
					});
					return retryResponse;
				} catch (refreshError) {
					await this.clearTokens();
					try {
						const { default: router } = await import('@/router');
						if (router.currentRoute.value.path !== '/login') {
							router.push('/login');
						}
					} catch {}
					throw this.handleError(refreshError);
				}
			}

			return response;
		} catch (error: any) {
			// Если получили 401 и токен есть, пытаемся обновить
			if (
				error.response?.status === 401 &&
				this.authToken &&
				this.refreshToken &&
				options.requireAuth !== false
			) {
				try {
					await this.refreshAccessToken();

					// Повторяем запрос с новым токеном
					const newHeaders = {
						...API_CONFIG.HEADERS,
						...options.headers,
						Authorization: `Bearer ${this.authToken}`,
					};

					const retryResponse = await this.httpService.request<ApiResponse<T>>({
						method,
						endpoint,
						data,
						headers: newHeaders,
						timeout: options.timeout || API_CONFIG.HTTP.TIMEOUT,
						...options,
					});

					return retryResponse;
				} catch (refreshError) {
					// Если обновление токена не удалось, очищаем токены и уводим на /login (мягко)
					await this.clearTokens();
					try {
						const { default: router } = await import('@/router');
						if (router.currentRoute.value.path !== '/login') {
							router.push('/login');
						}
					} catch {}
					throw this.handleError(refreshError);
				}
			}

			throw this.handleError(error);
		}
	}

	/**
	 * GET запрос
	 */
	public async get<T = any>(
		endpoint: string,
		params?: Record<string, any>,
		options?: AuthenticatedRequestOptions
	): Promise<ApiResponse<T>> {
		return this.request<T>('GET', endpoint, undefined, { ...options, params });
	}

	/**
	 * POST запрос
	 */
	public async post<T = any>(
		endpoint: string,
		data?: any,
		options?: AuthenticatedRequestOptions
	): Promise<ApiResponse<T>> {
		return this.request<T>('POST', endpoint, data, options);
	}

	/**
	 * PUT запрос
	 */
	public async put<T = any>(
		endpoint: string,
		data?: any,
		options?: AuthenticatedRequestOptions
	): Promise<ApiResponse<T>> {
		return this.request<T>('PUT', endpoint, data, options);
	}

	/**
	 * PATCH запрос
	 */
	public async patch<T = any>(
		endpoint: string,
		data?: any,
		options?: AuthenticatedRequestOptions
	): Promise<ApiResponse<T>> {
		return this.request<T>('PATCH', endpoint, data, options);
	}

	/**
	 * DELETE запрос
	 */
	public async delete<T = any>(
		endpoint: string,
		options?: AuthenticatedRequestOptions
	): Promise<ApiResponse<T>> {
		return this.request<T>('DELETE', endpoint, undefined, options);
	}

	/**
	 * Проверить статус соединения
	 */
	public async health(): Promise<boolean> {
		try {
			await this.get('/health', undefined, {
				requireAuth: false,
				timeout: 5000,
			});
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Получить текущий токен
	 */
	public getAuthToken(): string | null {
		return this.authToken;
	}

	/**
	 * Проверить авторизацию
	 */
	public isAuthenticated(): boolean {
		return !!this.authToken;
	}
}

// Экспортируем singleton экземпляр
export const apiClient = ApiClient.getInstance();
