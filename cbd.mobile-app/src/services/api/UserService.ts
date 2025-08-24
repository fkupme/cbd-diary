/**
 * User Service
 * Сервис для работы с пользователями
 */

import { apiClient } from './client';
import { API_CONFIG } from './config';
import type {
	ApiResponse,
	ChangePasswordRequest,
	PaginationParams,
	UpdateUserRequest,
	User,
} from './types';

export class UserService {
	private static instance: UserService;

	static getInstance(): UserService {
		if (!UserService.instance) {
			UserService.instance = new UserService();
		}
		return UserService.instance;
	}

	/**
	 * Получить список всех пользователей (для админов)
	 */
	async getUsers(params?: PaginationParams): Promise<ApiResponse<User[]>> {
		try {
			console.log('👥 Получение списка пользователей...');

			const response = await apiClient.get<User[]>(
				API_CONFIG.ENDPOINTS.USERS.BASE,
				params
			);

			console.log('✅ Список пользователей получен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения пользователей:', error);
			throw error;
		}
	}

	/**
	 * Получить пользователя по ID
	 */
	async getUserById(id: string): Promise<ApiResponse<User>> {
		try {
			console.log(`👤 Получение пользователя ${id}...`);

			const response = await apiClient.get<User>(
				API_CONFIG.ENDPOINTS.USERS.PROFILE(id)
			);

			console.log('✅ Пользователь получен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения пользователя:', error);
			throw error;
		}
	}

	/**
	 * Создать нового пользователя (для админов)
	 */
	async createUser(userData: UpdateUserRequest): Promise<ApiResponse<User>> {
		try {
			console.log('➕ Создание пользователя...');

			const response = await apiClient.post<User>(
				API_CONFIG.ENDPOINTS.USERS.BASE,
				userData
			);

			console.log('✅ Пользователь создан');
			return response;
		} catch (error) {
			console.error('❌ Ошибка создания пользователя:', error);
			throw error;
		}
	}

	/**
	 * Обновить данные пользователя
	 */
	async updateUser(
		id: string,
		userData: UpdateUserRequest
	): Promise<ApiResponse<User>> {
		try {
			console.log(`✏️ Обновление пользователя ${id}...`);

			const response = await apiClient.patch<User>(
				API_CONFIG.ENDPOINTS.USERS.PROFILE(id),
				userData
			);

			console.log('✅ Данные пользователя обновлены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления пользователя:', error);
			throw error;
		}
	}

	/**
	 * Удалить пользователя (для админов)
	 */
	async deleteUser(id: string): Promise<ApiResponse<void>> {
		try {
			console.log(`🗑️ Удаление пользователя ${id}...`);

			const response = await apiClient.delete<void>(
				API_CONFIG.ENDPOINTS.USERS.PROFILE(id)
			);

			console.log('✅ Пользователь удален');
			return response;
		} catch (error) {
			console.error('❌ Ошибка удаления пользователя:', error);
			throw error;
		}
	}

	/**
	 * Изменить пароль пользователя
	 */
	async changePassword(
		id: string,
		passwordData: ChangePasswordRequest
	): Promise<ApiResponse<void>> {
		try {
			console.log(`🔐 Изменение пароля пользователя ${id}...`);

			const response = await apiClient.post<void>(
				API_CONFIG.ENDPOINTS.USERS.CHANGE_PASSWORD(id),
				passwordData
			);

			console.log('✅ Пароль изменен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка изменения пароля:', error);
			throw error;
		}
	}

	/**
	 * Получить текущего пользователя
	 */
	async getCurrentUser(): Promise<ApiResponse<User>> {
		try {
			console.log('👤 Получение текущего пользователя...');

			// Определяем ID текущего пользователя из токена
			const { authService } = await import('./AuthService');
			const me = authService.getCurrentUser();
			if (!me?.id) {
				throw new Error('Пользователь не авторизован');
			}

			const response = await apiClient.get<User>(
				API_CONFIG.ENDPOINTS.USERS.PROFILE(me.id)
			);

			console.log('✅ Текущий пользователь получен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения текущего пользователя:', error);
			throw error;
		}
	}

	/**
	 * Обновить профиль текущего пользователя
	 */
	async updateCurrentUser(
		userData: UpdateUserRequest
	): Promise<ApiResponse<User>> {
		try {
			console.log('✏️ Обновление текущего пользователя...');

			const { authService } = await import('./AuthService');
			const me = authService.getCurrentUser();
			if (!me?.id) {
				throw new Error('Пользователь не авторизован');
			}

			// Передаём на сервер все поддерживаемые поля
			const payload: Record<string, any> = {};
			if (userData.email) payload.email = userData.email;
			if (userData.username || userData.name)
				payload.name = userData.name ?? userData.username;
			if (userData.preferredLanguage)
				payload.preferredLanguage = userData.preferredLanguage;
			if (typeof userData.age !== 'undefined') payload.age = userData.age;
			if (typeof userData.gender !== 'undefined')
				payload.gender = userData.gender;
			if (typeof userData.goals !== 'undefined') payload.goals = userData.goals;
			if (typeof userData.experienceLevel !== 'undefined')
				payload.experienceLevel = userData.experienceLevel;
			if (typeof userData.meditationFrequency !== 'undefined')
				payload.meditationFrequency = userData.meditationFrequency;
			if (typeof userData.stressLevel !== 'undefined')
				payload.stressLevel = userData.stressLevel;
			if (typeof userData.sleepQuality !== 'undefined')
				payload.sleepQuality = userData.sleepQuality;
			if (typeof userData.timezone !== 'undefined')
				payload.timezone = userData.timezone;
			if (typeof userData.pushEnabled !== 'undefined')
				payload.pushEnabled = userData.pushEnabled;

			const response = await apiClient.patch<User>(
				API_CONFIG.ENDPOINTS.USERS.PROFILE(me.id),
				payload
			);

			console.log('✅ Профиль обновлен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка обновления профиля:', error);
			throw error;
		}
	}

	/**
	 * Изменить пароль текущего пользователя
	 */
	async changeCurrentUserPassword(
		passwordData: ChangePasswordRequest
	): Promise<ApiResponse<void>> {
		try {
			console.log('🔐 Изменение пароля...');

			const { authService } = await import('./AuthService');
			const me = authService.getCurrentUser();
			if (!me?.id) {
				throw new Error('Пользователь не авторизован');
			}

			const response = await apiClient.post<void>(
				API_CONFIG.ENDPOINTS.USERS.CHANGE_PASSWORD(me.id),
				passwordData
			);

			console.log('✅ Пароль изменен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка изменения пароля:', error);
			throw error;
		}
	}

	/**
	 * Удалить аккаунт текущего пользователя
	 */
	async deleteCurrentUser(): Promise<ApiResponse<void>> {
		try {
			console.log('🗑️ Удаление аккаунта...');

			const { authService } = await import('./AuthService');
			const me = authService.getCurrentUser();
			if (!me?.id) {
				throw new Error('Пользователь не авторизован');
			}

			const response = await apiClient.delete<void>(
				API_CONFIG.ENDPOINTS.USERS.PROFILE(me.id)
			);

			console.log('✅ Аккаунт удален');
			return response;
		} catch (error) {
			console.error('❌ Ошибка удаления аккаунта:', error);
			throw error;
		}
	}
}

// Экспортируем singleton экземпляр
export const userService = UserService.getInstance();
