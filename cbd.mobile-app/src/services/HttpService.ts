import type { HttpRequestOptions, HttpResponse } from './types';

// Всегда используем браузерный fetch — CORS уже настроен на сервере
// для http://tauri.localhost. Tauri plugin-http на Android имеет баг:
// ReadableStream тела ответа никогда не доставляет данные.
const universalFetch = window.fetch.bind(window);

export class HttpService {
	private static instance: HttpService;
	private baseURL: string = '';
	private defaultHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	};
	private isInitialized = false;

	static getInstance(): HttpService {
		if (!HttpService.instance) {
			HttpService.instance = new HttpService();
		}
		return HttpService.instance;
	}

	constructor() {
		console.log('🌐 HttpService инициализирован');
	}

	async initialize(baseURL?: string): Promise<boolean> {
		try {
			this.baseURL = baseURL || '';

			// Устанавливаем базовые заголовки
			this.defaultHeaders = {
				'Content-Type': 'application/json',
				'User-Agent': 'CBD-Diary-Mobile/1.0',
			};

			this.isInitialized = true;
			console.log('🌐 HttpService инициализирован');
			return true;
		} catch (error) {
			console.error('❌ Ошибка инициализации HttpService:', error);
			return false;
		}
	}

	// Установить базовый URL
	setBaseURL(url: string): void {
		this.baseURL = url;
		console.log(`🔗 BaseURL установлен: ${url}`);
	}

	// Установить заголовки по умолчанию
	setDefaultHeaders(headers: Record<string, string>): void {
		this.defaultHeaders = { ...this.defaultHeaders, ...headers };
		console.log('📋 Заголовки по умолчанию обновлены:', this.defaultHeaders);
	}

	// Установить токен авторизации
	setAuthToken(token: string): void {
		this.defaultHeaders['Authorization'] = `Bearer ${token}`;
		console.log('🔐 Токен авторизации установлен');
	}

	// Удалить токен авторизации
	clearAuthToken(): void {
		delete this.defaultHeaders['Authorization'];
		console.log('🔓 Токен авторизации удален');
	}

	private buildFullURL(endpoint: string): string {
		if (endpoint.startsWith('http')) {
			return endpoint;
		}

		// Убираем завершающий слэш из baseURL и начальный из endpoint
		const cleanBaseURL = this.baseURL.replace(/\/+$/, '');
		const cleanEndpoint = endpoint.replace(/^\/+/, '');

		// Соединяем с одним слэшем
		return `${cleanBaseURL}/${cleanEndpoint}`;
	}

	private async makeRequest<T = any>(
		request: HttpRequestOptions
	): Promise<HttpResponse<T>> {
		try {
			const fullUrl = this.buildFullURL(request.url || '');
			console.log(`🚀 [${request.method || 'GET'}] ${fullUrl}`);
			try {
				const headersOut = JSON.stringify({
					...this.defaultHeaders,
					...request.headers,
				});
				console.log(`📤 Заголовки: ${headersOut}`);
			} catch {
				console.log('📤 Заголовки: [unserializable]');
			}
			try {
				const bodyOut =
					request.body !== undefined
						? JSON.stringify(request.body)
						: 'undefined';
				console.log(`📤 Тело запроса: ${bodyOut}`);
			} catch {
				console.log('📤 Тело запроса: [unserializable]');
			}

			// Используем универсальный fetch (Tauri или браузерный)
			const response = await universalFetch(fullUrl, {
				method: request.method || 'GET',
				headers: {
					...this.defaultHeaders,
					...request.headers,
				},
				body: request.body ? JSON.stringify(request.body) : undefined,
			});

		console.log(`📨 [${response.status}] Ответ получен от ${fullUrl}`);

			let parsedBody: any = null;
			try {
				parsedBody = await response.json();
			} catch {
				try {
					const text = await response.text();
					parsedBody = text ? JSON.parse(text) : null;
				} catch (parseError) {
					console.warn('⚠️ Ошибка парсинга тела ответа:', parseError);
					parsedBody = null;
				}
			}

			// Сформируем стандартный ответ HttpResponse
			const result: HttpResponse<any> = {
				data: parsedBody,
				status: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers.entries()),
			};

			console.log(`✅ [${response.status}] Ответ обработан успешно`);
			return result as HttpResponse<T>;
		} catch (error) {
			console.error(
				`❌ [HTTP Error] ${request.method || 'GET'} ${request.url}:`,
				error
			);
			throw error;
		}
	}

	// GET запрос
	async get<T = any>(
		url: string,
		options: HttpRequestOptions = {}
	): Promise<HttpResponse<T>> {
		return this.makeRequest<T>({
			url,
			method: 'GET',
			headers: options.headers,
			timeout: options.timeout,
		});
	}

	// POST запрос
	async post<T = any>(
		url: string,
		data?: any,
		options: HttpRequestOptions = {}
	): Promise<HttpResponse<T>> {
		return this.makeRequest<T>({
			url,
			method: 'POST',
			body: data,
			headers: options.headers,
			timeout: options.timeout,
		});
	}

	// PUT запрос
	async put<T = any>(
		url: string,
		data?: any,
		options: HttpRequestOptions = {}
	): Promise<HttpResponse<T>> {
		return this.makeRequest<T>({
			url,
			method: 'PUT',
			body: data,
			headers: options.headers,
			timeout: options.timeout,
		});
	}

	// PATCH запрос
	async patch<T = any>(
		url: string,
		data?: any,
		options: HttpRequestOptions = {}
	): Promise<HttpResponse<T>> {
		return this.makeRequest<T>({
			url,
			method: 'PATCH',
			body: data,
			headers: options.headers,
			timeout: options.timeout,
		});
	}

	// DELETE запрос
	async delete<T = any>(
		url: string,
		options: HttpRequestOptions = {}
	): Promise<HttpResponse<T>> {
		return this.makeRequest<T>({
			url,
			method: 'DELETE',
			headers: options.headers,
			timeout: options.timeout,
		});
	}

	// Универсальный запрос (для совместимости с ApiClient)
	async request<T = any>(options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
		endpoint?: string;
		url?: string;
		data?: any;
		body?: any;
		headers?: Record<string, string>;
		timeout?: number;
		[key: string]: any;
	}): Promise<{
		success: boolean;
		data: T;
		status?: number;
		message?: string;
		meta?: any;
	}> {
		try {
			// Определяем URL (приоритет endpoint, потом url)
			const requestUrl = options.endpoint || options.url || '';

			// Определяем body (приоритет data, потом body)
			const requestBody = options.data || options.body;

			const response = await this.makeRequest<any>({
				url: requestUrl,
				method: options.method || 'GET',
				body: requestBody,
				headers: options.headers,
				timeout: options.timeout,
			});

			// Нормализуем ответ API: если сервер уже вернул envelope { success, data, message, meta }
			let success = response.status >= 200 && response.status < 300;
			let message = response.statusText;
			let meta: any = undefined;
			let payload: any = response.data;

			if (payload && typeof payload === 'object') {
				// Если это уже стандартная форма нашего бэкенда
				const hasSuccess = Object.prototype.hasOwnProperty.call(
					payload,
					'success'
				);
				const hasData = Object.prototype.hasOwnProperty.call(payload, 'data');
				if (hasSuccess || hasData) {
					if (hasSuccess) success = !!payload.success;
					if (payload.message) message = payload.message;
					if (payload.meta) meta = payload.meta;
					payload = hasData ? payload.data : payload;
				}
			}

			return {
				success,
				data: payload as T,
				status: response.status,
				message,
				meta,
			};
		} catch (error: any) {
			console.error('🚨 API Error:', error);

			return {
				success: false,
				data: null as T,
				status: error.response?.status || error.status || 500,
				message: error.message || 'Network error',
			};
		}
	}

	// Методы для работы с CBD Diary API

	// Синхронизация записей настроения
	async syncMoodEntries(
		entries: any[]
	): Promise<HttpResponse<{ synced: number; conflicts: any[] }>> {
		return this.post('/api/v1/mood-entries/sync', { entries });
	}

	// Получение записей с сервера
	async getMoodEntries(since?: string): Promise<HttpResponse<any[]>> {
		const params = since ? `?since=${encodeURIComponent(since)}` : '';
		return this.get(`/api/v1/mood-entries${params}`);
	}

	// Создание записи настроения
	async createMoodEntry(entry: any): Promise<HttpResponse<any>> {
		return this.post('/api/v1/mood-entries', entry);
	}

	// Обновление записи настроения
	async updateMoodEntry(id: string, entry: any): Promise<HttpResponse<any>> {
		return this.put(`/api/v1/mood-entries/${id}`, entry);
	}

	// Удаление записи настроения
	async deleteMoodEntry(id: string): Promise<HttpResponse<any>> {
		return this.delete(`/api/v1/mood-entries/${id}`);
	}

	// Регистрация пользователя
	async register(userData: {
		email: string;
		password: string;
		name?: string;
	}): Promise<HttpResponse<{ user: any; token: string }>> {
		return this.post('/api/v1/auth/register', userData);
	}

	// Вход пользователя
	async login(credentials: {
		email: string;
		password: string;
	}): Promise<HttpResponse<{ user: any; token: string }>> {
		return this.post('/api/v1/auth/login', credentials);
	}

	// Выход пользователя
	async logout(): Promise<HttpResponse<any>> {
		const response = await this.post('/api/v1/auth/logout');
		this.clearAuthToken();
		return response;
	}

	// Обновление токена
	async refreshToken(
		refreshToken: string
	): Promise<HttpResponse<{ token: string }>> {
		return this.post('/api/v1/auth/refresh', { refreshToken });
	}

	// Получение профиля пользователя
	async getUserProfile(): Promise<HttpResponse<any>> {
		return this.get('/api/v1/user/profile');
	}

	// Обновление профиля пользователя
	async updateUserProfile(profileData: any): Promise<HttpResponse<any>> {
		return this.put('/api/v1/user/profile', profileData);
	}

	// Получение статистики
	async getAnalytics(params: {
		startDate?: string;
		endDate?: string;
		groupBy?: 'day' | 'week' | 'month';
	}): Promise<HttpResponse<any>> {
		const queryParams = new URLSearchParams();
		if (params.startDate) queryParams.set('startDate', params.startDate);
		if (params.endDate) queryParams.set('endDate', params.endDate);
		if (params.groupBy) queryParams.set('groupBy', params.groupBy);

		const query = queryParams.toString();
		return this.get(`/api/v1/analytics${query ? `?${query}` : ''}`);
	}

	// Экспорт данных
	async exportData(
		format: 'json' | 'csv' | 'pdf' = 'json'
	): Promise<HttpResponse<any>> {
		return this.get(`/api/v1/export?format=${format}`, {
			responseType: format === 'json' ? 'json' : 'blob',
		});
	}

	// Проверка соединения с сервером
	async checkConnection(): Promise<boolean> {
		try {
			const response = await this.get('/api/v1/sync/health', { timeout: 5000 });
			return response.status === 200;
		} catch {
			return false;
		}
	}

	// Получение конфигурации сервера
	async getServerConfig(): Promise<
		HttpResponse<{
			version: string;
			features: string[];
			limits: Record<string, number>;
		}>
	> {
		return this.get('/api/v1/config');
	}

	// Получение статистики HTTP клиента
	getStats(): {
		baseURL: string;
		hasAuthToken: boolean;
		isInitialized: boolean;
	} {
		return {
			baseURL: this.baseURL,
			hasAuthToken: !!this.defaultHeaders['Authorization'],
			isInitialized: this.isInitialized,
		};
	}
}
