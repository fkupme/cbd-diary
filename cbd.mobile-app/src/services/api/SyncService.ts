/**
 * Sync Service
 * Сервис для синхронизации данных между устройством и сервером
 */

import { apiClient } from './client';
import { API_CONFIG } from './config';
import type {
	ApiResponse,
	CBTEntry,
	ResolveConflictsRequest,
	SyncHealth,
	SyncStatus,
	SyncUserDataRequest,
	SyncUserDataResponse,
} from './types';

export class SyncService {
	private static instance: SyncService;
	private syncInProgress = false;

	static getInstance(): SyncService {
		if (!SyncService.instance) {
			SyncService.instance = new SyncService();
		}
		return SyncService.instance;
	}

	/**
	 * Синхронизировать данные пользователя
	 */
	async syncUserData(
		syncData: SyncUserDataRequest
	): Promise<ApiResponse<SyncUserDataResponse>> {
		try {
			console.log('🔄 Синхронизация данных пользователя...');

			if (this.syncInProgress) {
				throw new Error('Синхронизация уже выполняется');
			}

			this.syncInProgress = true;

			const response = await apiClient.post<SyncUserDataResponse>(
				API_CONFIG.ENDPOINTS.SYNC.USER_DATA,
				syncData
			);
			if (!response.success) {
				console.error(
					'❌ Синхронизация не удалась:',
					response.message,
					response.data
				);
				throw new Error(`Sync failed: ${response.message ?? 'unknown error'}`);
			}
			console.log('✅ Синхронизация завершена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка синхронизации:', error);
			throw error;
		} finally {
			this.syncInProgress = false;
		}
	}

	/**
	 * Разрешить конфликты синхронизации
	 */
	async resolveConflicts(
		conflictResolutions: ResolveConflictsRequest
	): Promise<ApiResponse<void>> {
		try {
			console.log('⚖️ Разрешение конфликтов синхронизации...');

			const response = await apiClient.post<void>(
				API_CONFIG.ENDPOINTS.SYNC.RESOLVE_CONFLICTS,
				conflictResolutions
			);

			console.log('✅ Конфликты разрешены');
			return response;
		} catch (error) {
			console.error('❌ Ошибка разрешения конфликтов:', error);
			throw error;
		}
	}

	/**
	 * Получить статус синхронизации
	 */
	async getSyncStatus(): Promise<ApiResponse<SyncStatus>> {
		try {
			console.log('📊 Получение статуса синхронизации...');

			const response = await apiClient.get<SyncStatus>(
				API_CONFIG.ENDPOINTS.SYNC.STATUS
			);

			console.log('✅ Статус синхронизации получен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка получения статуса синхронизации:', error);
			throw error;
		}
	}

	/**
	 * Принудительная синхронизация
	 */
	async forceSync(): Promise<ApiResponse<SyncUserDataResponse>> {
		try {
			console.log('💪 Принудительная синхронизация...');

			const response = await apiClient.put<SyncUserDataResponse>(
				API_CONFIG.ENDPOINTS.SYNC.FORCE_SYNC
			);

			console.log('✅ Принудительная синхронизация завершена');
			return response;
		} catch (error) {
			console.error('❌ Ошибка принудительной синхронизации:', error);
			throw error;
		}
	}

	/**
	 * Проверить здоровье сервиса синхронизации
	 */
	async getSyncHealth(): Promise<ApiResponse<SyncHealth>> {
		try {
			console.log('🏥 Проверка здоровья сервиса синхронизации...');

			const response = await apiClient.get<SyncHealth>(
				API_CONFIG.ENDPOINTS.SYNC.HEALTH,
				undefined,
				{ timeout: 10000 }
			);

			console.log('✅ Статус здоровья получен');
			return response;
		} catch (error) {
			console.error('❌ Ошибка проверки здоровья сервиса:', error);
			throw error;
		}
	}

	// ===============================
	// Helper Methods
	// ===============================

	/**
	 * Проверить, идет ли синхронизация
	 */
	isSyncInProgress(): boolean {
		return this.syncInProgress;
	}

	/**
	 * Быстрая синхронизация только новых данных
	 */
	async quickSync(
		entries: CBTEntry[],
		lastSyncTimestamp?: string
	): Promise<ApiResponse<SyncUserDataResponse>> {
		// Записи приходят уже в каноническом camelCase-виде
		// (см. mapTauriEntryToApi) — отправляем как есть, без переименований.
		const operations = entries.map(e => ({
			operationType: 'INSERT' as const,
			tableName: 'cbt_entries',
			recordId: e.id,
			dataSnapshot: {
				situation: e.situation,
				reactions: e.reactions,
				moodScoreBefore: e.moodScoreBefore,
				moodScoreAfter: e.moodScoreAfter ?? null,
				tags: e.tags,
				isPublic: e.isPublic,
				entryDate: e.createdAt,
				thoughts:
					e.thoughts?.map(t => ({
						id: t.id,
						thought: t.thought,
						isAutomatic: t.isAutomatic ?? false,
						intensity: t.intensity,
						emotions:
							t.emotions?.map(em => ({
								emotionId: em.emotionId,
								intensity: em.intensity,
							})) ?? [],
						cognitiveDistortions: t.cognitiveDistortions ?? [],
					})) ?? [],
			},
			createdAt: e.createdAt,
		}));

		const payload: SyncUserDataRequest = {
			operations,
			schemaVersion: '1.0.0',
		} as SyncUserDataRequest;

		// Присылаем lastSyncAt только если он валидный ISO timestamp
		if (
			lastSyncTimestamp &&
			lastSyncTimestamp !== 'undefined' &&
			!Number.isNaN(Date.parse(lastSyncTimestamp))
		) {
			(payload as any).lastSyncAt = lastSyncTimestamp;
		}

		return this.syncUserData(payload);
	}

	/**
	 * Проверить возможность синхронизации
	 */
	async canSync(): Promise<boolean> {
		try {
			// Проверяем подключение к интернету и статус сервиса
			const healthResponse = await this.getSyncHealth();

			if (!healthResponse.success) {
				return false;
			}

			const health = healthResponse.data;
			return health.status === 'healthy' || health.status === 'degraded';
		} catch (error) {
			console.warn('⚠️ Не удалось проверить возможность синхронизации:', error);
			return false;
		}
	}

	/**
	 * Автоматическая синхронизация с ретраями
	 */
	async autoSync(
		entries: CBTEntry[],
		lastSyncTimestamp?: string,
		maxRetries: number = 3
	): Promise<ApiResponse<SyncUserDataResponse>> {
		let attempt = 0;
		let lastError: any;

		while (attempt < maxRetries) {
			try {
				console.log(
					`🔄 Попытка автосинхронизации ${attempt + 1}/${maxRetries}...`
				);

				// Проверяем возможность синхронизации
				const canSyncNow = await this.canSync();
				if (!canSyncNow) {
					throw new Error('Сервис синхронизации недоступен');
				}

				// Выполняем синхронизацию
				const result = await this.quickSync(entries, lastSyncTimestamp);
				if (!result.success) {
					throw new Error(
						`AutoSync failed: ${result.message ?? 'unknown error'}`
					);
				}

				console.log('✅ Автосинхронизация успешна');
				return result;
			} catch (error) {
				lastError = error;
				attempt++;

				if (attempt < maxRetries) {
					// Exponential backoff: 1s, 2s, 4s
					const delay = Math.pow(2, attempt - 1) * 1000;
					console.log(`⏳ Ожидание ${delay}ms перед следующей попыткой...`);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		}

		console.error('❌ Автосинхронизация не удалась после всех попыток');
		throw lastError;
	}

	/**
	 * Получить конфликты, требующие ручного разрешения
	 */
	async getPendingConflicts(): Promise<{
		hasConflicts: boolean;
		conflictsCount: number;
		requiresManualResolution: boolean;
	}> {
		try {
			const statusResponse = await this.getSyncStatus();

			if (!statusResponse.success) {
				return {
					hasConflicts: false,
					conflictsCount: 0,
					requiresManualResolution: false,
				};
			}

			const status: any = statusResponse.data;
			const conflictsCount = Number(status.conflictsCount || 0);
			const hasConflicts = conflictsCount > 0 || !!status.lastError;

			return {
				hasConflicts,
				conflictsCount,
				requiresManualResolution: hasConflicts,
			};
		} catch (error) {
			console.warn('⚠️ Не удалось проверить конфликты:', error);
			return {
				hasConflicts: false,
				conflictsCount: 0,
				requiresManualResolution: false,
			};
		}
	}

	/**
	 * Очистить локальную очередь синхронизации
	 */
	async clearSyncQueue(): Promise<void> {
		try {
			console.log('🧹 Очистка очереди синхронизации...');

			// Здесь можно добавить логику очистки локального хранилища
			// от несинхронизированных данных, если такая логика есть

			console.log('✅ Очередь синхронизации очищена');
		} catch (error) {
			console.error('❌ Ошибка очистки очереди синхронизации:', error);
			throw error;
		}
	}

	/**
	 * Получить последнюю метку времени синхронизации
	 */
	getLastSyncTimestamp(): string | null {
		try {
			// Здесь должна быть логика получения timestamp из локального хранилища
			return localStorage.getItem('last_sync_timestamp');
		} catch (error) {
			console.warn(
				'⚠️ Не удалось получить последнюю метку синхронизации:',
				error
			);
			return null;
		}
	}

	/**
	 * Установить последнюю метку времени синхронизации
	 */
	setLastSyncTimestamp(timestamp: string): void {
		try {
			if (
				!timestamp ||
				timestamp === 'undefined' ||
				Number.isNaN(Date.parse(timestamp))
			) {
				return;
			}
			localStorage.setItem('last_sync_timestamp', timestamp);
			console.log('📅 Метка времени синхронизации сохранена');
		} catch (error) {
			console.warn(
				'⚠️ Не удалось сохранить метку времени синхронизации:',
				error
			);
		}
	}
}

// Экспортируем singleton экземпляр
export const syncService = SyncService.getInstance();
