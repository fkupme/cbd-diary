/**
 * User Store
 * Управление состоянием пользователя с интеграцией API
 */

import { useApiServices, useAuth } from '@/composables/useApiIntegration';
import type { UpdateUserRequest } from '@/services/api/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useUserStore = defineStore('user', () => {
	// Используем композаблы для API интеграции
	const apiServices = useApiServices();
	const auth = useAuth();

	// State
	const isLoading = ref(false);
	const error = ref<string | null>(null);
	const preferences = ref({
		theme: 'auto' as 'light' | 'dark' | 'auto',
		language: 'ru',
		notifications: true,
		biometricEnabled: false,
		privacyMode: false,
	});

	// Getters (используем computed из композабла auth)
	const user = computed(() => auth.currentUser.value);
	const isAuthenticated = computed(() => auth.isAuthenticated.value);
	const isAuthLoading = computed(() => auth.isLoading.value);
	const authError = computed(() => auth.error.value);

	// Actions for authentication
	const login = async (email: string, password: string) => {
		error.value = null;

		try {
			const result = await auth.login(email, password);
			console.log('✅ Пользователь авторизован:', result.user);
			return result;
		} catch (err: any) {
			error.value = err.message;
			throw err;
		}
	};

	const register = async (
		email: string,
		password: string,
		username?: string
	) => {
		error.value = null;

		try {
			const result = await auth.register(email, password, username);
			console.log('✅ Пользователь зарегистрирован:', result.user);
			return result;
		} catch (err: any) {
			error.value = err.message;
			throw err;
		}
	};

	const logout = async () => {
		try {
			await auth.logout();

			// Очищаем локальные предпочтения при выходе
			preferences.value = {
				theme: 'auto',
				language: 'ru',
				notifications: true,
				biometricEnabled: false,
				privacyMode: false,
			};

			console.log('✅ Пользователь вышел из системы');
		} catch (err: any) {
			error.value = err.message;
			throw err;
		}
	};

	const refreshUser = async () => {
		if (!isAuthenticated.value) return;

		try {
			await auth.loadCurrentUser();
		} catch (err: any) {
			error.value = err.message;
			throw err;
		}
	};

	const validateSession = async () => {
		try {
			return await auth.validateSession();
		} catch (err: any) {
			error.value = err.message;
			return false;
		}
	};

	// Actions for user profile management
	const updateProfile = async (userData: UpdateUserRequest) => {
		isLoading.value = true;
		error.value = null;

		try {
			const { userService } = await import('@/services/api');
			const result = await userService.updateCurrentUser(userData);

			if (result.success) {
				// Обновляем данные пользователя в auth композабле
				await auth.loadCurrentUser();
				console.log('✅ Профиль обновлен');
				return result.data;
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка обновления профиля';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const changePassword = async (
		currentPassword: string,
		newPassword: string
	) => {
		isLoading.value = true;
		error.value = null;

		try {
			const { userService } = await import('@/services/api');
			const result = await userService.changeCurrentUserPassword({
				currentPassword,
				newPassword,
			});

			if (result.success) {
				console.log('✅ Пароль изменен');
				return true;
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка изменения пароля';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const deleteAccount = async () => {
		isLoading.value = true;
		error.value = null;

		try {
			const { userService } = await import('@/services/api');
			const result = await userService.deleteCurrentUser();

			if (result.success) {
				// Очищаем все данные при удалении аккаунта
				await apiServices.clearAll();
				console.log('✅ Аккаунт удален');
				return true;
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка удаления аккаунта';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	// Preferences management
	const updatePreferences = (
		newPreferences: Partial<typeof preferences.value>
	) => {
		preferences.value = { ...preferences.value, ...newPreferences };

		// Сохраняем в localStorage
		try {
			localStorage.setItem(
				'user-preferences',
				JSON.stringify(preferences.value)
			);
		} catch (err) {
			console.warn('Не удалось сохранить предпочтения:', err);
		}
	};

	const loadPreferences = () => {
		try {
			const stored = localStorage.getItem('user-preferences');
			if (stored) {
				const parsed = JSON.parse(stored);
				preferences.value = { ...preferences.value, ...parsed };
			}
		} catch (err) {
			console.warn('Не удалось загрузить предпочтения:', err);
		}
	};

	const toggleTheme = () => {
		const themes: Array<typeof preferences.value.theme> = [
			'light',
			'dark',
			'auto',
		];
		const currentIndex = themes.indexOf(preferences.value.theme);
		const nextIndex = (currentIndex + 1) % themes.length;
		updatePreferences({ theme: themes[nextIndex] });
	};

	const setLanguage = (language: string) => {
		updatePreferences({ language });
	};

	const toggleNotifications = () => {
		updatePreferences({ notifications: !preferences.value.notifications });
	};

	const toggleBiometric = () => {
		updatePreferences({
			biometricEnabled: !preferences.value.biometricEnabled,
		});
	};

	const togglePrivacyMode = () => {
		updatePreferences({ privacyMode: !preferences.value.privacyMode });
	};

	// Utility functions
	const getUserDisplayName = () => {
		if (!user.value) return 'Пользователь';
		return user.value.username || user.value.email || 'Пользователь';
	};

	const getUserInitials = () => {
		const displayName = getUserDisplayName();
		return displayName
			.split(' ')
			.map(name => name.charAt(0).toUpperCase())
			.slice(0, 2)
			.join('');
	};

	// Инициализация
	const initialize = async () => {
		try {
			// Инициализируем API сервисы
			if (!apiServices.isInitialized.value) {
				await apiServices.initialize();
			}

			// Загружаем предпочтения
			loadPreferences();

			// Проверяем сессию если пользователь авторизован
			if (isAuthenticated.value) {
				await validateSession();
			}

			console.log('✅ User store инициализирован');
		} catch (err) {
			console.error('❌ Ошибка инициализации user store:', err);
		}
	};

	// Computed для удобства
	const hasFullProfile = computed(() => {
		return (
			user.value &&
			user.value.profile &&
			(user.value.profile.firstName || user.value.profile.lastName)
		);
	});

	const isProfileComplete = computed(() => {
		return user.value && user.value.email && hasFullProfile.value;
	});

	return {
		// State
		user,
		isAuthenticated,
		isLoading: computed(() => isLoading.value || isAuthLoading.value),
		error: computed(() => error.value || authError.value),
		preferences: computed(() => preferences.value),

		// Computed
		hasFullProfile,
		isProfileComplete,

		// Actions - Authentication
		login,
		register,
		logout,
		refreshUser,
		validateSession,

		// Actions - Profile
		updateProfile,
		changePassword,
		deleteAccount,

		// Actions - Preferences
		updatePreferences,
		loadPreferences,
		toggleTheme,
		setLanguage,
		toggleNotifications,
		toggleBiometric,
		togglePrivacyMode,

		// Utility
		getUserDisplayName,
		getUserInitials,
		initialize,
	};
});

// Экспортируем типы для использования в других местах
export type UserStore = ReturnType<typeof useUserStore>;
