import { isTauriRuntime } from '@cbd/platform';

// Ленивый invoke: на web нативного API нет — биометрия отдаётся как недоступная.
async function getInvoke() {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke;
}

export interface BiometricResult {
	isAvailable: boolean;
	biometryType: 'none' | 'fingerprint' | 'face' | 'touch' | 'mixed';
	deviceIsSecure: boolean;
	reason?: string;
}

export interface AuthenticationOptions {
	reason: string;
	cancelTitle?: string;
	fallbackTitle?: string;
	disableFallback?: boolean;
}

export class BiometricService {
	private static instance: BiometricService;

	public static getInstance(): BiometricService {
		if (!BiometricService.instance) {
			BiometricService.instance = new BiometricService();
		}
		return BiometricService.instance;
	}

	/**
	 * Проверяет доступность биометрической аутентификации
	 */
	async checkAvailability(): Promise<BiometricResult> {
		// В браузере/PWA нативной биометрии нет — app-lock просто скрывается.
		if (!isTauriRuntime()) {
			return {
				isAvailable: false,
				biometryType: 'none',
				deviceIsSecure: false,
				reason: 'Биометрия недоступна в веб-версии',
			};
		}
		try {
			console.log('🔍 Проверяем доступность биометрии');
			const invoke = await getInvoke();
			const result = await invoke<BiometricResult>(
				'check_biometric_availability'
			);
			console.log('✅ Результат проверки биометрии:', result);
			return result;
		} catch (error) {
			console.error('❌ Ошибка проверки биометрии:', error);
			return {
				isAvailable: false,
				biometryType: 'none',
				deviceIsSecure: false,
				reason: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Выполняет биометрическую аутентификацию
	 */
	async authenticate(options: AuthenticationOptions): Promise<boolean> {
		try {
			console.log('🔐 Начинаем биометрическую аутентификацию:', options.reason);

			// Сначала проверяем доступность
			const availability = await this.checkAvailability();
			if (!availability.isAvailable) {
				throw new Error(
					availability.reason || 'Биометрическая аутентификация недоступна'
				);
			}

			const invoke = await getInvoke();
			const result = await invoke<boolean>('authenticate_biometric', {
				reason: options.reason,
			});

			console.log('✅ Результат аутентификации:', result);
			return result;
		} catch (error) {
			console.error('❌ Ошибка аутентификации:', error);
			throw error;
		}
	}

	/**
	 * Аутентификация для входа в приложение
	 */
	async authenticateForLogin(): Promise<boolean> {
		return this.authenticate({
			reason: 'Войдите в приложение, используя биометрию',
			cancelTitle: 'Отмена',
			fallbackTitle: 'Использовать пароль',
		});
	}

	/**
	 * Аутентификация для защищенных действий
	 */
	async authenticateForSecureAction(action: string): Promise<boolean> {
		return this.authenticate({
			reason: `Подтвердите действие: ${action}`,
			cancelTitle: 'Отмена',
		});
	}

	/**
	 * Проверяет, включена ли биометрическая аутентификация в настройках
	 */
	async isBiometricEnabled(): Promise<boolean> {
		const enabled = localStorage.getItem('biometric_enabled');
		return enabled === 'true';
	}

	/**
	 * Включает/выключает биометрическую аутентификацию
	 */
	async setBiometricEnabled(enabled: boolean): Promise<void> {
		if (enabled) {
			// Проверяем доступность перед включением
			const availability = await this.checkAvailability();
			if (!availability.isAvailable) {
				throw new Error(
					'Биометрическая аутентификация недоступна на этом устройстве'
				);
			}

			// Требуем аутентификацию для включения биометрии
			const authenticated = await this.authenticate({
				reason: 'Подтвердите включение биометрической аутентификации',
			});

			if (!authenticated) {
				throw new Error('Аутентификация не пройдена');
			}
		}

		localStorage.setItem('biometric_enabled', enabled.toString());
		console.log(`🔐 Биометрия ${enabled ? 'включена' : 'выключена'}`);
	}

	/**
	 * Получает тип доступной биометрии
	 */
	async getBiometryType(): Promise<string> {
		const result = await this.checkAvailability();

		switch (result.biometryType) {
			case 'fingerprint':
				return 'Отпечаток пальца';
			case 'face':
				return 'Распознавание лица';
			case 'touch':
				return 'Touch ID';
			case 'mixed':
				return 'Биометрия';
			default:
				return 'Недоступно';
		}
	}

	/**
	 * Проверяет, безопасно ли устройство (установлен ли PIN/пароль)
	 */
	async isDeviceSecure(): Promise<boolean> {
		const result = await this.checkAvailability();
		return result.deviceIsSecure;
	}
}

// Единый платформо-безопасный синглтон (web → биометрия недоступна)
export const biometricService = BiometricService.getInstance();
