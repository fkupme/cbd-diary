/**
 * API Integration Composable
 * Интеграция API сервисов с Vue композаблами
 */

import {
	analyticsService,
	apiServicesManager,
	authService,
	cbtService,
	emotionsService,
	syncService,
	userService,
	type CBTEntry,
	type Emotion,
	type EmotionCategory,
	type User,
	type UserStats,
} from '@/services/api';
import { databaseService } from '@/services/DatabaseService';
import { invoke } from '@tauri-apps/api/core';
import { computed, onMounted, onUnmounted, ref } from 'vue';

/**
 * Композабл для работы с аутентификацией
 */
export function useAuth() {
	const isAuthenticated = ref(authService.isAuthenticated());
	const currentUser = ref<User | null>(null);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	const login = async (email: string, password: string) => {
		isLoading.value = true;
		error.value = null;

		try {
			const result = await authService.login({ email, password });

			if (result.success) {
				isAuthenticated.value = true;
				currentUser.value = result.data.user;

				// Получаем полный профиль пользователя
				await loadCurrentUser();

				// Локальная (SQLite) сессия: логиним того же пользователя по email в Tauri
				try {
					await invoke('login_or_create_user', {
						email: result.data.user.email,
						name:
							(result.data.user as any).name ||
							(result.data.user as any).username ||
							null,
						preferred_language:
							(result.data.user as any).preferredLanguage ||
							(result.data.user as any).preferred_language ||
							'ru',
					});
				} catch (e) {
					console.warn(
						'⚠️ Не удалось залогинить локального пользователя в Tauri:',
						e
					);
				}

				// После авторизации: если онлайн — синкаем каталог эмоций с сервера
				// в SQLite. Сервер — источник истины: каталог пересобирается с
				// СЕРВЕРНЫМИ id, ссылки в существующих записях ремапятся (Rust).
				try {
					const online = navigator.onLine;
					if (online) {
						console.log('🔁 Синк каталога эмоций после логина...');
						const full = await emotionsService.getFullEmotionsStructure();

						const categoriesPayload = full.categories
							.filter(c => c.id && c.nameKey)
							.map(c => ({
								id: c.id,
								name_key: c.nameKey,
								color: c.color ?? null,
								icon: c.icon ?? null,
								sort_order: c.sortOrder ?? 0,
								is_active: c.isActive ?? true,
							}));

						const emotionsPayload = full.emotions
							.filter(e => e.id && e.nameKey)
							.map(e => ({
								id: e.id,
								category_id: e.categoryId ?? null,
								category_external_key: e.category?.nameKey ?? undefined,
								name_key: e.nameKey,
								emoji: e.emoji,
								intensity_default: e.intensityDefault ?? 5,
								synonyms: Array.isArray(e.synonyms)
									? e.synonyms.filter(s => typeof s === 'string')
									: [],
								opposite_emotion_id: e.oppositeEmotionId ?? undefined,
								sort_order: e.sortOrder ?? 0,
								is_active: e.isActive ?? true,
								server_updated_at: new Date().toISOString(),
							}));

						const upserted = await invoke<number>('sync_emotions_from_server', {
							emotions: emotionsPayload,
							categories: categoriesPayload,
						});
						console.log(`✅ Каталог эмоций синкнут в SQLite: ${upserted}`);
					} else {
						console.log('⚠️ Оффлайн, пропускаем синк эмоций');
					}
				} catch (syncErr) {
					console.warn('⚠️ Ошибка синка эмоций после логина:', syncErr);
				}

				return result.data;
			} else {
				throw new Error('Авторизация не удалась');
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка авторизации';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const register = async (
		email: string,
		password: string,
		username?: string
	) => {
		isLoading.value = true;
		error.value = null;

		try {
			const result = await authService.register({ email, password, username });

			if (result.success) {
				isAuthenticated.value = true;
				currentUser.value = result.data.user;
				return result.data;
			} else {
				throw new Error('Регистрация не удалась');
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка регистрации';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const logout = async () => {
		isLoading.value = true;

		try {
			await authService.logout();
			isAuthenticated.value = false;
			currentUser.value = null;
		} catch (err: any) {
			console.warn('Ошибка при выходе:', err);
		} finally {
			isLoading.value = false;
		}
	};

	const loadCurrentUser = async () => {
		if (!isAuthenticated.value) return;

		try {
			const result = await userService.getCurrentUser();
			if (result.success) {
				currentUser.value = result.data;
			}
		} catch (err) {
			console.warn('Не удалось загрузить профиль пользователя:', err);
		}
	};

	const validateSession = async () => {
		try {
			const isValid = await authService.validateSession();
			if (!isValid) {
				isAuthenticated.value = false;
				currentUser.value = null;
			}
			return isValid;
		} catch {
			return false;
		}
	};

	// Проверяем сессию при инициализации
	onMounted(async () => {
		if (isAuthenticated.value) {
			await loadCurrentUser();
			await validateSession();
		}
	});

	return {
		// State
		isAuthenticated: computed(() => isAuthenticated.value),
		currentUser: computed(() => currentUser.value),
		isLoading: computed(() => isLoading.value),
		error: computed(() => error.value),

		// Actions
		login,
		register,
		logout,
		loadCurrentUser,
		validateSession,
	};
}

/**
 * Композабл для работы с эмоциями
 */
export function useEmotions() {
	const categories = ref<EmotionCategory[]>([]);
	const emotions = ref<Emotion[]>([]);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	const loadAll = async () => {
		isLoading.value = true;
		error.value = null;

		// Читаем строго из локальной БД (источник истины)
		try {
			const [catsLocal, emotionsLocal] = await Promise.all([
				databaseService.getEmotionCategoriesLocal(),
				databaseService.getEmotionsLocal(),
			]);
			categories.value = catsLocal;
			emotions.value = emotionsLocal;
		} catch (localErr: any) {
			console.warn('⚠️ Не удалось загрузить эмоции локально:', localErr);
			error.value = localErr.message || 'Ошибка локальной загрузки эмоций';
		} finally {
			isLoading.value = false;
		}
	};

	const getEmotionById = (id: number) => {
		return emotions.value.find(emotion => emotion.id === id);
	};

	const getCategoryById = (id: number) => {
		return categories.value.find(category => category.id === id);
	};

	const getEmotionsByCategory = (categoryId: number) => {
		return emotions.value.filter(emotion => emotion.categoryId === categoryId);
	};

	const searchEmotions = async (query: string) => {
		try {
			const result = await emotionsService.searchEmotions(query);
			return result.success ? result.data : [];
		} catch (err) {
			console.warn('Ошибка поиска эмоций:', err);
			return [];
		}
	};

	return {
		// State
		categories: computed(() => categories.value),
		emotions: computed(() => emotions.value),
		isLoading: computed(() => isLoading.value),
		error: computed(() => error.value),

		// Getters
		getEmotionById,
		getCategoryById,
		getEmotionsByCategory,

		// Actions
		loadAll,
		searchEmotions,
	};
}

/**
 * Композабл для работы с CBT записями
 */
export function useCBTEntries() {
	const entries = ref<CBTEntry[]>([]);
	const currentEntry = ref<CBTEntry | null>(null);
	const isLoading = ref(false);
	const isSaving = ref(false);
	const error = ref<string | null>(null);

	const loadEntries = async (params?: any) => {
		isLoading.value = true;
		error.value = null;

		try {
			// 1) Локально (SQLite via Tauri) — источник истины
			const local = await databaseService.getCBTEntries(params?.limit ?? 100);
			entries.value = local;

			// 2) Пытаемся обновить с сервера (если онлайн)
			try {
				const result = await cbtService.getEntries(params);
				if (result.success && result.data?.length) {
					// Пока упрощенно: заменить локальный список серверным
					entries.value = result.data;
				}
			} catch (apiErr) {
				console.warn('⚠️ CBT не обновлены с API, работаем локально:', apiErr);
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка загрузки записей';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const createEntry = async (entryData: any) => {
		isSaving.value = true;
		error.value = null;

		try {
			// Локально сначала
			const created = await databaseService.createCBTEntry(entryData);
			entries.value.unshift(created);

			// Фоновая попытка отправить на сервер
			cbtService
				.createEntry(entryData)
				.catch(err =>
					console.warn('⚠️ API createEntry failed (offline ok):', err)
				);

			return created;
		} catch (err: any) {
			error.value = err.message || 'Ошибка создания записи';
			throw err;
		} finally {
			isSaving.value = false;
		}
	};

	const updateEntry = async (id: string, entryData: any) => {
		isSaving.value = true;
		error.value = null;

		try {
			// Локально
			const updated = await databaseService.updateCBTEntry(id, entryData);
			const idx = entries.value.findIndex(e => e.id === id);
			if (idx !== -1) entries.value[idx] = updated;

			// Фоновая попытка апдейта на сервере
			cbtService
				.updateEntry(id, entryData)
				.catch(err =>
					console.warn('⚠️ API updateEntry failed (offline ok):', err)
				);

			return updated;
		} catch (err: any) {
			error.value = err.message || 'Ошибка обновления записи';
			throw err;
		} finally {
			isSaving.value = false;
		}
	};

	const deleteEntry = async (id: string) => {
		try {
			// Локально
			await databaseService.deleteCBTEntry(id);
			entries.value = entries.value.filter(e => e.id !== id);

			// Фон
			cbtService
				.deleteEntry(id)
				.catch(err =>
					console.warn('⚠️ API deleteEntry failed (offline ok):', err)
				);
		} catch (err: any) {
			error.value = err.message || 'Ошибка удаления записи';
			throw err;
		}
	};

	const updateMoodAfter = async (id: string, moodScore: number) => {
		try {
			const updated = await databaseService.updateCBTEntry(id, {
				moodScoreAfter: moodScore,
			});
			const idx = entries.value.findIndex(e => e.id === id);
			if (idx !== -1) entries.value[idx] = updated;

			// Фон
			cbtService
				.updateMoodAfter(id, { moodScoreAfter: moodScore })
				.catch(err =>
					console.warn('⚠️ API updateMoodAfter failed (offline ok):', err)
				);

			return updated;
		} catch (err: any) {
			error.value = err.message || 'Ошибка обновления настроения';
			throw err;
		}
	};

	const getRecentEntries = async (limit: number = 10) => {
		try {
			// Локально быстро
			const local = await databaseService.getCBTEntries(limit);

			// Попробуем сервер
			try {
				const result = await cbtService.getRecentEntries(limit);
				return result.success ? result.data : local;
			} catch {
				return local;
			}
		} catch (err) {
			console.warn('Ошибка получения последних записей (локально):', err);
			// Сервер как fallback
			try {
				const result = await cbtService.getRecentEntries(limit);
				return result.success ? result.data : [];
			} catch {
				return [];
			}
		}
	};

	return {
		// State
		entries: computed(() => entries.value),
		currentEntry: computed(() => currentEntry.value),
		isLoading: computed(() => isLoading.value),
		isSaving: computed(() => isSaving.value),
		error: computed(() => error.value),

		// Actions
		loadEntries,
		createEntry,
		updateEntry,
		deleteEntry,
		updateMoodAfter,
		getRecentEntries,
	};
}

/**
 * Композабл для работы с аналитикой
 */
export function useAnalytics() {
	const userStats = ref<UserStats | null>(null);
	const dashboard = ref<any>(null);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	const loadUserStats = async () => {
		isLoading.value = true;
		error.value = null;

		try {
			const result = await analyticsService.getUserStats();
			if (result.success) {
				userStats.value = result.data;
			}
		} catch (err: any) {
			error.value = err.message || 'Ошибка загрузки статистики';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const loadFullDashboard = async () => {
		isLoading.value = true;
		error.value = null;

		try {
			dashboard.value = await analyticsService.getFullDashboard();
		} catch (err: any) {
			error.value = err.message || 'Ошибка загрузки панели аналитики';
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const refreshStats = async () => {
		try {
			await analyticsService.refreshStats();
			await loadUserStats();
		} catch (err: any) {
			error.value = err.message || 'Ошибка обновления статистики';
			throw err;
		}
	};

	return {
		// State
		userStats: computed(() => userStats.value),
		dashboard: computed(() => dashboard.value),
		isLoading: computed(() => isLoading.value),
		error: computed(() => error.value),

		// Actions
		loadUserStats,
		loadFullDashboard,
		refreshStats,
	};
}

/**
 * Композабл для работы с синхронизацией
 */
export function useSync() {
	const isOnline = ref(navigator.onLine);
	const isSyncing = ref(false);
	const lastSyncTime = ref<string | null>(null);
	const conflicts = ref<any[]>([]);

	const checkOnlineStatus = () => {
		isOnline.value = navigator.onLine;
	};

	const performSync = async () => {
		if (isSyncing.value) return;

		isSyncing.value = true;

		try {
			// 1) Берём локальные записи (SQLite) как источник истины для операций
			const localEntries = await databaseService.getCBTEntries(1000);

			// Если локально пусто, делаем bootstrap-пулл — не передаем lastSync,
			// чтобы сервер вернул все операции с нуля
			const storedLastSync = syncService.getLastSyncTimestamp();
			const lastSync =
				localEntries.length === 0 ? undefined : storedLastSync || undefined;
			const syncResult = await syncService.autoSync(
				localEntries as any,
				lastSync || undefined
			);

			if (syncResult.success) {
				// Применяем операции сервера локально
				const resp: any = syncResult.data;
				const serverOps: any[] = resp?.serverOperations || [];

				for (const op of serverOps) {
					if (op.tableName !== 'cbt_entries') continue;
					const snap = op.dataSnapshot || {};
					const serverId = String(op.recordId);

					if (op.operationType === 'INSERT') {
						const createPayload = {
							situation: String(snap.situation || ''),
							thoughts: Array.isArray(snap.thoughts)
								? snap.thoughts.map((t: any) => ({
										thought: String(t.thought || ''),
										isAutomatic: !!(t.isAutomatic || t.is_automatic),
										intensity: Number(t.intensity ?? 5),
										emotions: Array.isArray(t.emotions)
											? t.emotions
													.map((e: any) => ({
														emotionId: e.emotionId ?? e.emotion_id,
														intensity: Number(e.intensity ?? 5),
													}))
													.filter((e: any) => e.emotionId != null)
											: [],
										cognitiveDistortions: (t.cognitiveDistortions ||
											t.cognitive_distortions ||
											[]) as string[],
								  }))
								: [],
							reactions: String(snap.reactions || ''),
							moodScoreBefore:
								snap.moodScoreBefore != null
									? Number(snap.moodScoreBefore)
									: undefined,
							moodScoreAfter:
								snap.moodScoreAfter != null
									? Number(snap.moodScoreAfter)
									: undefined,
							tags: Array.isArray(snap.tags) ? snap.tags : [],
							entryDate: snap.entryDate,
						} as any;
						try {
							await databaseService.upsertCBTEntryFromServer(
								serverId,
								createPayload
							);
						} catch (e) {
							console.warn(
								'⚠️ Не удалось применить INSERT serverOp локально:',
								e
							);
						}
					}

					if (op.operationType === 'UPDATE') {
						const updatePayload: any = {};
						if (snap.situation !== undefined)
							updatePayload.situation = String(snap.situation);
						if (snap.reactions !== undefined)
							updatePayload.reactions = String(snap.reactions);
						if (snap.moodScoreBefore !== undefined)
							updatePayload.moodScoreBefore = Number(snap.moodScoreBefore);
						if (snap.moodScoreAfter !== undefined)
							updatePayload.moodScoreAfter = Number(snap.moodScoreAfter);
						if (snap.tags !== undefined)
							updatePayload.tags = Array.isArray(snap.tags) ? snap.tags : [];
						if (snap.thoughts !== undefined) {
							updatePayload.thoughts = Array.isArray(snap.thoughts)
								? snap.thoughts.map((t: any) => ({
										thought: String(t.thought || ''),
										isAutomatic: !!(t.isAutomatic || t.is_automatic),
										intensity: Number(t.intensity ?? 5),
										emotions: Array.isArray(t.emotions)
											? t.emotions
													.map((e: any) => ({
														emotionId: e.emotionId ?? e.emotion_id,
														intensity: Number(e.intensity ?? 5),
													}))
													.filter((e: any) => e.emotionId != null)
											: [],
										cognitiveDistortions: (t.cognitiveDistortions ||
											t.cognitive_distortions ||
											[]) as string[],
								  }))
								: [];
						}
						try {
							await databaseService.updateCBTEntryByServerId(
								serverId,
								updatePayload
							);
						} catch (e) {
							console.warn(
								'⚠️ Не удалось применить UPDATE serverOp локально:',
								e
							);
						}
					}

					if (op.operationType === 'DELETE') {
						try {
							await databaseService.deleteCBTEntryByServerId(serverId);
						} catch (e) {
							console.warn(
								'⚠️ Не удалось применить DELETE serverOp локально:',
								e
							);
						}
					}
				}

				// После применения serverOps делаем безопасную сверку с сервером и подтягиваем недостающие записи
				try {
					const srv = await cbtService.getEntries({ limit: 1000 });
					if (srv.success && Array.isArray(srv.data)) {
						for (const e of srv.data) {
							const payload: any = {
								situation: e.situation,
								thoughts: (e.thoughts || []).map((t: any) => ({
									thought: t.thought,
									isAutomatic: !!(t.isAutomatic || t.is_automatic),
									intensity: Number(t.intensity ?? 5),
									emotions: (t.emotions || [])
										.map((em: any) => ({
											emotionId: em.emotionId ?? em.emotion_id,
											intensity: Number(em.intensity ?? 5),
										}))
										.filter((em: any) => em.emotionId != null),
									cognitiveDistortions:
										t.cognitiveDistortions || t.cognitive_distortions || [],
								})),
								reactions: e.reactions,
								moodScoreBefore: e.moodScoreBefore,
								moodScoreAfter: e.moodScoreAfter,
								tags: e.tags || [],
								entryDate:
									(e as any).entryDate ||
									(e as any).createdAt ||
									(e as any).created_at,
							};
							try {
								await databaseService.upsertCBTEntryFromServer(e.id, payload);
							} catch {}
						}
					}
				} catch (impErr) {
					console.warn('⚠️ Сверка с сервером (pull) не удалась:', impErr);
				}

				lastSyncTime.value = resp.newSyncTimestamp || resp.lastSyncTimestamp;
				if (lastSyncTime.value) {
					syncService.setLastSyncTimestamp(lastSyncTime.value);
				}

				// Обновим локальный список записей после применения
				try {
					const refreshed = await databaseService.getCBTEntries(100);
					console.log('🔄 Локальные записи после serverOps:', refreshed.length);

					// Fallback-bootstrap: если локально пусто, тянем с сервера и импортируем
					if (refreshed.length === 0) {
						try {
							const srv = await cbtService.getEntries({ limit: 1000 });
							if (
								srv.success &&
								Array.isArray(srv.data) &&
								srv.data.length > 0
							) {
								for (const e of srv.data) {
									const payload: any = {
										situation: e.situation,
										thoughts: (e.thoughts || []).map((t: any) => ({
											thought: t.thought,
											isAutomatic: !!(t.isAutomatic || t.is_automatic),
											intensity: Number(t.intensity ?? 5),
											emotions: (t.emotions || [])
												.map((em: any) => ({
													emotionId: em.emotionId ?? em.emotion_id,
													intensity: Number(em.intensity ?? 5),
												}))
												.filter((em: any) => em.emotionId != null),
											cognitiveDistortions:
												t.cognitiveDistortions || t.cognitive_distortions || [],
										})),
										reactions: e.reactions,
										moodScoreBefore: e.moodScoreBefore,
										moodScoreAfter: e.moodScoreAfter,
										tags: e.tags || [],
										entryDate:
											(e as any).createdAt ||
											(e as any).created_at ||
											(e as any).entryDate,
									};
									try {
										await databaseService.createCBTEntry(payload);
									} catch {}
								}
								const afterImport = await databaseService.getCBTEntries(100);
								console.log(
									'📥 Импортировано с сервера в локальную БД:',
									afterImport.length
								);
							}
						} catch (impErr) {
							console.warn('⚠️ Bootstrap pull не удался:', impErr);
						}
					}
				} catch {}

				// Проверяем конфликты безопасно
				const conflictInfo = await syncService.getPendingConflicts();
				if (conflictInfo.hasConflicts) {
					console.warn('Обнаружены конфликты синхронизации:', conflictInfo);
				}
			}
		} catch (err) {
			console.error('Ошибка синхронизации:', err);
		} finally {
			isSyncing.value = false;
		}
	};

	const forceSync = async () => {
		try {
			await syncService.forceSync();
			lastSyncTime.value = new Date().toISOString();
		} catch (err) {
			console.error('Ошибка принудительной синхронизации:', err);
			throw err;
		}
	};

	// Слушаем события подключения
	onMounted(() => {
		window.addEventListener('online', checkOnlineStatus);
		window.addEventListener('offline', checkOnlineStatus);

		// Автоматическая синхронизация при подключении
		window.addEventListener('online', performSync);

		// Первоначальная синхронизация
		if (isOnline.value) {
			performSync();
		}
	});

	onUnmounted(() => {
		window.removeEventListener('online', checkOnlineStatus);
		window.removeEventListener('offline', checkOnlineStatus);
		window.removeEventListener('online', performSync);
	});

	return {
		// State
		isOnline: computed(() => isOnline.value),
		isSyncing: computed(() => isSyncing.value),
		lastSyncTime: computed(() => lastSyncTime.value),
		conflicts: computed(() => conflicts.value),

		// Actions
		performSync,
		forceSync,
	};
}

/**
 * Главный композабл для управления всеми API сервисами
 */
export function useApiServices() {
	const isInitialized = ref(false);
	const healthStatus = ref<any>(null);

	const initialize = async () => {
		try {
			await apiServicesManager.initialize();
			isInitialized.value = true;

			// Проверяем здоровье сервисов
			healthStatus.value = await apiServicesManager.healthCheck();
		} catch (err) {
			console.error('Ошибка инициализации API сервисов:', err);
			throw err;
		}
	};

	const checkHealth = async () => {
		try {
			healthStatus.value = await apiServicesManager.healthCheck();
			return healthStatus.value;
		} catch (err) {
			console.error('Ошибка проверки здоровья сервисов:', err);
			return { api: false, auth: false, sync: false, overall: false };
		}
	};

	const clearAll = async () => {
		try {
			await apiServicesManager.clearAll();
			isInitialized.value = false;
			healthStatus.value = null;
		} catch (err) {
			console.error('Ошибка очистки данных:', err);
		}
	};

	return {
		// State
		isInitialized: computed(() => isInitialized.value),
		healthStatus: computed(() => healthStatus.value),

		// Actions
		initialize,
		checkHealth,
		clearAll,
	};
}
