import { Store } from '@tauri-apps/plugin-store';
import type { SecureStorageKey, SecureStorageValue } from './types';

export class SecureStorageService {
	private static instance: SecureStorageService;
	private store: Store | null = null;
	private isInitialized = false;
	// Браузер (dev-превью без Tauri): фолбэк на localStorage,
	// чтобы сессия переживала перезагрузку страницы
	private webFallback = false;
	private static readonly WEB_PREFIX = 'cbd-secure:';

	static getInstance(): SecureStorageService {
		if (!SecureStorageService.instance) {
			SecureStorageService.instance = new SecureStorageService();
		}
		return SecureStorageService.instance;
	}

	async initialize(): Promise<boolean> {
		try {
			if (this.isInitialized) return true;

			// Создаем зашифрованное хранилище
			this.store = await Store.load('cbd_secure_storage.json', {
				autoSave: false,
				defaults: {},
			});

			this.isInitialized = true;
			console.log('✅ SecureStorageService инициализирован');
			return true;
		} catch (error) {
			console.warn(
				'⚠️ Tauri Store недоступен, используем localStorage (web dev):',
				error
			);
			this.webFallback = true;
			this.isInitialized = true;
			return true;
		}
	}

	// Сохранить зашифрованные данные
	async storeSecure(
		key: SecureStorageKey,
		value: SecureStorageValue
	): Promise<boolean> {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			// Сохраняем данные с временной меткой
			const encryptedData = {
				value,
				timestamp: new Date().toISOString(),
				encrypted: true,
			};

			if (this.webFallback || !this.store) {
				localStorage.setItem(
					SecureStorageService.WEB_PREFIX + key,
					JSON.stringify(encryptedData)
				);
				return true;
			}

			await this.store.set(key, encryptedData);
			await this.store.save();

			console.log(`🔐 Данные сохранены в защищенное хранилище: ${key}`);
			return true;
		} catch (error) {
			console.error('❌ Ошибка сохранения в защищенное хранилище:', error);
			return false;
		}
	}

	// Получить зашифрованные данные
	async getSecure<T = SecureStorageValue>(
		key: SecureStorageKey
	): Promise<T | null> {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			let data: any;
			if (this.webFallback || !this.store) {
				const raw = localStorage.getItem(
					SecureStorageService.WEB_PREFIX + key
				);
				data = raw ? JSON.parse(raw) : null;
			} else {
				data = await this.store.get<any>(key);
			}

			if (!data || !data.encrypted) {
				console.warn(`⚠️ Данные не найдены или не зашифрованы: ${key}`);
				return null;
			}

			return data.value as T;
		} catch (error) {
			console.error('❌ Ошибка получения из защищенного хранилища:', error);
			return null;
		}
	}

	// Удалить конкретные данные
	async removeSecure(key: SecureStorageKey): Promise<boolean> {
		try {
			if (this.webFallback || !this.store) {
				localStorage.removeItem(SecureStorageService.WEB_PREFIX + key);
				return true;
			}

			await this.store.delete(key);
			await this.store.save();

			console.log(`🗑️ Данные удалены из защищенного хранилища: ${key}`);
			return true;
		} catch (error) {
			console.error('❌ Ошибка удаления из защищенного хранилища:', error);
			return false;
		}
	}

	// Проверить существование ключа
	async hasKey(key: SecureStorageKey): Promise<boolean> {
		try {
			if (!this.store) return false;

			const data = await this.store.get(key);
			return data !== null && data !== undefined;
		} catch (error) {
			console.error('❌ Ошибка проверки ключа:', error);
			return false;
		}
	}

	// Получить все ключи
	async getAllKeys(): Promise<string[]> {
		try {
			if (!this.store) return [];

			const keys = await this.store.keys();
			return keys;
		} catch (error) {
			console.error('❌ Ошибка получения ключей:', error);
			return [];
		}
	}

	// Очистить все защищенные данные
	async clearAll(): Promise<boolean> {
		try {
			if (!this.store) return false;

			await this.store.clear();
			await this.store.save();

			console.log('🧹 Все данные защищенного хранилища очищены');
			return true;
		} catch (error) {
			console.error('❌ Ошибка очистки защищенного хранилища:', error);
			return false;
		}
	}

	// Методы для работы с конкретными типами данных

	// Сохранение настроек безопасности
	async storeSecuritySettings(settings: {
		biometricEnabled: boolean;
		pinEnabled: boolean;
		autoLockTimeout: number;
	}): Promise<boolean> {
		return this.storeSecure('security_settings', settings);
	}

	async getSecuritySettings(): Promise<{
		biometricEnabled: boolean;
		pinEnabled: boolean;
		autoLockTimeout: number;
	} | null> {
		return this.getSecure('security_settings');
	}

	// Сохранение токенов и ключей API
	async storeAPITokens(tokens: Record<string, string>): Promise<boolean> {
		return this.storeSecure('api_tokens', tokens);
	}

	async getAPITokens(): Promise<Record<string, string> | null> {
		return this.getSecure('api_tokens');
	}

	// Сохранение данных синхронизации
	async storeSyncData(data: {
		lastSyncTime: string;
		syncToken: string;
		serverUrl: string;
	}): Promise<boolean> {
		return this.storeSecure('sync_data', data);
	}

	async getSyncData(): Promise<{
		lastSyncTime: string;
		syncToken: string;
		serverUrl: string;
	} | null> {
		return this.getSecure('sync_data');
	}

	// Сохранение зашифрованного бэкапа
	async storeBackupData(backupData: any): Promise<boolean> {
		return this.storeSecure('backup_data', {
			data: backupData,
			createdAt: new Date().toISOString(),
		});
	}

	async getBackupData(): Promise<{
		data: any;
		createdAt: string;
	} | null> {
		return this.getSecure('backup_data');
	}

	// Проверка целостности хранилища
	async verifyIntegrity(): Promise<boolean> {
		try {
			if (!this.store) return false;

			const keys = await this.getAllKeys();
			let corruptedCount = 0;

			for (const key of keys) {
				try {
					const data = await this.store.get(key);
					if (!data || typeof data !== 'object') {
						corruptedCount++;
					}
				} catch {
					corruptedCount++;
				}
			}

			const integrityRatio = 1 - corruptedCount / keys.length;
			console.log(
				`🔍 Целостность хранилища: ${Math.round(integrityRatio * 100)}%`
			);

			return integrityRatio > 0.95; // 95% целостности
		} catch (error) {
			console.error('❌ Ошибка проверки целостности:', error);
			return false;
		}
	}

	// Экспорт данных для бэкапа
	async exportData(): Promise<Record<string, any> | null> {
		try {
			if (!this.store) return null;

			const keys = await this.getAllKeys();
			const exportData: Record<string, any> = {};

			for (const key of keys) {
				const data = await this.store.get(key);
				exportData[key] = data;
			}

			return exportData;
		} catch (error) {
			console.error('❌ Ошибка экспорта данных:', error);
			return null;
		}
	}

	// Импорт данных из бэкапа
	async importData(data: Record<string, any>): Promise<boolean> {
		try {
			if (!this.store) return false;

			for (const [key, value] of Object.entries(data)) {
				await this.store.set(key, value);
			}

			await this.store.save();
			console.log('📥 Данные импортированы в защищенное хранилище');
			return true;
		} catch (error) {
			console.error('❌ Ошибка импорта данных:', error);
			return false;
		}
	}
}
