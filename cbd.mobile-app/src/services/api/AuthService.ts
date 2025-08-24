/**
 * Auth Service
 * Сервис для работы с аутентификацией
 */

import { apiClient } from './client';
import { API_CONFIG } from './config';
import type {
	ApiResponse,
	AuthResponse,
	LoginRequest,
	RefreshTokenRequest,
	RefreshTokenResponse,
	RegisterRequest,
	User,
} from './types';

export class AuthService {
	private static instance: AuthService;

	static getInstance(): AuthService {
		if (!AuthService.instance) {
			AuthService.instance = new AuthService();
		}
		return AuthService.instance;
	}

	/**
	 * Авторизация пользователя
	 */
	async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
		try {
			console.log('🔑 Авторизация пользователя...');

			const response = await apiClient.post<AuthResponse>(
				API_CONFIG.ENDPOINTS.AUTH.LOGIN,
				credentials,
				{ requireAuth: false }
			);

			if (response.success && response.data?.accessToken) {
				// Сохраняем токены в API клиенте
				await apiClient.setTokens(
					response.data.accessToken,
					response.data.refreshToken
				);

				console.log('✅ Авторизация успешна, токены сохранены');
			}

			return response;
		} catch (error) {
			console.error('❌ Ошибка авторизации:', error);
			throw error;
		}
	}

	/**
	 * Регистрация нового пользователя
	 */
	async register(
		userData: RegisterRequest
	): Promise<ApiResponse<AuthResponse>> {
		try {
			console.log('📝 Регистрация пользователя...');

			// Маппинг полей под бекенд: username -> name, язык по умолчанию
			const payload = {
				email: userData.email,
				password: userData.password,
				name: userData.name ?? userData.username,
				preferredLanguage: userData.preferredLanguage ?? 'ru',
			};

			const response = await apiClient.post<AuthResponse>(
				API_CONFIG.ENDPOINTS.AUTH.REGISTER,
				payload,
				{ requireAuth: false }
			);

			if (response.success && response.data?.accessToken) {
				// Сохраняем токены в API клиенте
				await apiClient.setTokens(
					response.data.accessToken,
					response.data.refreshToken
				);

				console.log('✅ Регистрация успешна, токены сохранены');
			}

			return response;
		} catch (error) {
			console.error('❌ Ошибка регистрации:', error);
			throw error;
		}
	}

	/**
	 * Обновление токена доступа
	 */
	async refreshToken(
		refreshTokenData: RefreshTokenRequest
	): Promise<ApiResponse<RefreshTokenResponse>> {
		try {
			console.log('🔄 Обновление токена...');

			const response = await apiClient.post<RefreshTokenResponse>(
				API_CONFIG.ENDPOINTS.AUTH.REFRESH,
				refreshTokenData,
				{ requireAuth: false }
			);

			if (response.success && response.data?.accessToken) {
				// Refresh токен остается тем же, обновляем только access токен
				await apiClient.setTokens(
					response.data.accessToken,
					refreshTokenData.refreshToken // используем тот же refresh токен
				);

				console.log('✅ Access токен обновлен');
			}

			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления токена:', error);
			throw error;
		}
	}

	/**
	 * Выход из системы
	 */
	async logout(): Promise<void> {
		try {
			console.log('👋 Выход из системы...');

			// Попытка уведомить сервер о выходе (не критично если не получится)
			try {
				await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
			} catch (logoutError) {
				console.warn('⚠️ Не удалось уведомить сервер о выходе:', logoutError);
			}

			// Очищаем токены локально
			await apiClient.clearTokens();

			console.log('✅ Выход выполнен');
		} catch (error) {
			console.error('❌ Ошибка при выходе:', error);
			// Всё равно очищаем токены при ошибке
			await apiClient.clearTokens();
		}
	}

	/**
	 * Проверить, авторизован ли пользователь
	 */
	isAuthenticated(): boolean {
		return apiClient.isAuthenticated();
	}

	/**
	 * Получить текущий токен
	 */
	getAuthToken(): string | null {
		return apiClient.getAuthToken();
	}

	/**
	 * Получить текущего пользователя (из токена)
	 * Примечание: Этот метод может быть расширен для парсинга JWT токена
	 */
	getCurrentUser(): User | null {
		// TODO: Реализовать парсинг JWT токена для получения информации о пользователе
		// Пока возвращаем null, так как нужно парсить JWT
		const token = this.getAuthToken();
		if (!token) {
			return null;
		}

		try {
			// Простейший парсинг JWT (без проверки подписи)
			const payload = JSON.parse(atob(token.split('.')[1]));
			return {
				id: payload.sub || payload.id,
				email: payload.email,
				username: payload.username,
				createdAt: payload.createdAt || new Date().toISOString(),
				updatedAt: payload.updatedAt || new Date().toISOString(),
			} as User;
		} catch (error) {
			console.warn('⚠️ Не удалось парсить токен:', error);
			return null;
		}
	}

	/**
	 * Проверить валидность токена
	 */
	isTokenValid(): boolean {
		const token = this.getAuthToken();
		if (!token) {
			return false;
		}

		try {
			// Простейшая проверка истечения токена
			const payload = JSON.parse(atob(token.split('.')[1]));
			const currentTime = Math.floor(Date.now() / 1000);

			return payload.exp && payload.exp > currentTime;
		} catch (error) {
			console.warn('⚠️ Не удалось проверить токен:', error);
			return false;
		}
	}

	/**
	 * Форсированная проверка соединения с сервером
	 */
	async validateSession(): Promise<boolean> {
		try {
			// Должен быть валидный токен
			if (!this.isAuthenticated() || !this.isTokenValid()) {
				return false;
			}

			// Получаем userId из токена и дергаем защищенный эндпоинт профиля
			const current = this.getCurrentUser();
			if (!current?.id) {
				return false;
			}

			await apiClient.get(
				API_CONFIG.ENDPOINTS.USERS.PROFILE(current.id),
				undefined,
				{ timeout: 5000 }
			);
			return true;
		} catch (error) {
			console.warn('⚠️ Сессия невалидна:', error);
			return false;
		}
	}
}

// Экспортируем singleton экземпляр
export const authService = AuthService.getInstance();
