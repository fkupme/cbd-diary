import {
	createChannel,
	Importance,
	isPermissionGranted,
	requestPermission,
	sendNotification as tauriSendNotification,
	Visibility,
} from '@tauri-apps/plugin-notification';
import { HttpService } from './HttpService';
import { socketService } from './SocketService';
import { authService } from './api';

interface NotificationAction {
	id: string;
	title: string;
	// Доп. данные, например задержка
	delayMinutes?: number;
}

interface NotificationData {
	title: string;
	body: string;
	icon?: string;
	sound?: string;
	tag?: string;
	channelId?: string;
	actions?: NotificationAction[];
	backgroundImage?: string;
	backgroundImageBase64?: string;
	backgroundOpacity?: number;
}

interface ScheduledNotificationData extends NotificationData {
	scheduled: Date;
}

export class NotificationService {
	private static instance: NotificationService;
	private hasPermission: boolean = false;
	private channelsCreated: boolean = false;
	private isInitialized: boolean = false;
	// private isSubscribed: boolean = false; // больше не нужен – мешает переподписке
	private notifyHandler?: (payload: any) => Promise<void> | void;

	static getInstance(): NotificationService {
		if (!NotificationService.instance) {
			NotificationService.instance = new NotificationService();
		}
		return NotificationService.instance;
	}

	async initialize(): Promise<boolean> {
		if (this.isInitialized) return true;

		try {
			console.log('🔔 Initializing NotificationService...');

			// Проверяем разрешения
			await this.checkPermissions();

			// Создаем каналы уведомлений для Android
			await this.createChannels();

			// Подписываемся на серверные уведомления через сокеты
			this.subscribeServerNotifications();

			// Пытаемся инициализировать remote push плагин (FCM/APNs)
			void this.tryInitRemotePush();

			this.isInitialized = true;
			console.log('✅ NotificationService initialized successfully');
			return true;
		} catch (error) {
			console.error('❌ Failed to initialize NotificationService:', error);
			return false;
		}
	}

	private async checkPermissions(): Promise<void> {
		try {
			console.log('🔍 Checking notification permissions...');

			this.hasPermission = await isPermissionGranted();
			console.log(`📝 Current permission status: ${this.hasPermission}`);

			if (!this.hasPermission) {
				console.log('🙏 Requesting notification permission...');
				const permission = await requestPermission();
				this.hasPermission = permission === 'granted';
				console.log(`📝 Permission granted: ${this.hasPermission}`);
			}
		} catch (error) {
			console.error('❌ Error checking notification permissions:', error);
			this.hasPermission = false;
		}
	}

	private async createChannels(): Promise<void> {
		if (this.channelsCreated) return;

		try {
			console.log('📋 Creating notification channels...');

			// Канал для общих уведомлений - МАКСИМАЛЬНАЯ важность
			await createChannel({
				id: 'general',
				name: 'General Notifications',
				description: 'General app notifications',
				importance: Importance.High, // Максимальная важность для всплывающих
				visibility: Visibility.Public,
				lights: true,
				lightColor: '#4CAF50',
				vibration: true,
				sound: 'default', // Стандартный звук
			});

			// Канал для напоминаний - МАКСИМАЛЬНАЯ важность
			await createChannel({
				id: 'reminders',
				name: 'Mood Reminders',
				description: 'Reminders to log your mood',
				importance: Importance.High, // Максимальная важность
				visibility: Visibility.Public,
				lights: true,
				lightColor: '#2196F3',
				vibration: true,
				sound: 'default',
			});

			// Канал для срочных уведомлений - МАКСИМАЛЬНАЯ важность
			await createChannel({
				id: 'urgent',
				name: 'Urgent Notifications',
				description: 'Important urgent notifications',
				importance: Importance.High, // Максимальная важность
				visibility: Visibility.Public,
				lights: true,
				lightColor: '#FF5722',
				vibration: true,
				sound: 'default',
			});

			this.channelsCreated = true;
			console.log('✅ Notification channels created successfully');
		} catch (error) {
			console.error('❌ Failed to create notification channels:', error);
		}
	}

	private async tryInitRemotePush() {
		try {
			if (!(globalThis as any).__TAURI_INTERNALS__ && !(globalThis as any).isTauri && !(globalThis as any).__TAURI__) return;
			const pkgName = 'tauri-plugin-remote-push' + '-api';
			// @vite-ignore
			const mod = await import(/* @vite-ignore */ pkgName).catch(() => null);
			if (!mod) return;
			const perm = await mod.requestPermission();
			if (perm?.granted) {
				const token = await mod.getToken();
				console.log('[RemotePush] device token:', token);
				// Отправляем токен на сервер
				try {
					const http = HttpService.getInstance();
					const me = authService.getCurrentUser();
					await http.post('/api/v1/notifications/register', {
						userId: me?.id ?? undefined,
						platform: (navigator.userAgent || '')
							.toLowerCase()
							.includes('android')
							? 'ANDROID'
							: 'IOS',
						token,
						deviceId: undefined,
					});
					console.log('[RemotePush] token registered on backend');
				} catch (e) {
					console.warn('[RemotePush] backend register failed', e);
				}
			}
			await mod.onTokenRefresh(async (t: string) => {
				console.log('[RemotePush] token refreshed:', t);
				try {
					const http = HttpService.getInstance();
					const me = authService.getCurrentUser();
					await http.post('/api/v1/notifications/register', {
						userId: me?.id ?? undefined,
						platform: (navigator.userAgent || '')
							.toLowerCase()
							.includes('android')
							? 'ANDROID'
							: 'IOS',
						token: t,
					});
					console.log('[RemotePush] token re-registered on backend');
				} catch (e) {
					console.warn('[RemotePush] backend re-register failed', e);
				}
			});
			await mod.onNotificationReceived((n: any) => {
				console.log('[RemotePush] notification payload:', n);
				void this.sendInstant({
					title: String(n?.title ?? 'Уведомление'),
					body: String(n?.body ?? ''),
					channelId: 'general',
				});
			});
		} catch (e) {
			console.warn('[RemotePush] init skipped:', e);
		}
	}

	private async buildIconFromBase64(
		base64?: string,
		opacity?: number
	): Promise<string | undefined> {
		if (!base64) return undefined;
		try {
			const img = new Image();
			img.src = `data:image/png;base64,${base64}`;
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('image load failed'));
			});
			const canvas = document.createElement('canvas');
			const size = 256;
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');
			if (!ctx) return undefined;
			// Рисуем фоновую картинку вписанную
			const ratio = Math.min(size / img.width, size / img.height);
			const w = img.width * ratio;
			const h = img.height * ratio;
			const x = (size - w) / 2;
			const y = (size - h) / 2;
			ctx.drawImage(img, x, y, w, h);
			// Накладываем полупрозрачный тёмный слой, чтобы текст читался
			const alpha = Math.max(0, Math.min(1, opacity ?? 0.4));
			ctx.fillStyle = `rgba(0,0,0,${alpha})`;
			ctx.fillRect(0, 0, size, size);
			return canvas.toDataURL('image/png');
		} catch (e) {
			console.warn('buildIconFromBase64 failed', e);
			return undefined;
		}
	}

	private subscribeServerNotifications() {
		const sock = socketService.connectNotifications();
		const resub = () => {
			console.log('[NotifySocket] subscribe emit');
			sock.emit('subscribe', {});
		};
		sock.on('connect', () => {
			console.log('[NotifySocket] connected', (sock as any).id);
			resub();
			// При каждом подключении переустанавливаем обработчик
			this.attachNotificationHandler(sock);
		});
		sock.on('connect_error', (e: any) => {
			console.warn('[NotifySocket] connect_error', e?.message || e);
		});
		sock.on('disconnect', (reason: any) => {
			console.warn('[NotifySocket] disconnect', reason);
		});
		resub();
		this.attachNotificationHandler(sock);
	}

	private attachNotificationHandler(sock: any) {
		try {
			// Снимаем старый обработчик, если был
			if (this.notifyHandler) {
				try {
					sock.off('notification', this.notifyHandler as any);
				} catch {}
			}

			const handler = async (payload: any) => {
				console.log('[NotifySocket] notification event', payload);
				try {
					const title = payload?.title || 'CBD Diary';
					const body = payload?.message || '';
					const backgroundImage = payload?.backgroundImage as
						| string
						| undefined;
					const backgroundImageBase64 = payload?.backgroundImageBase64 as
						| string
						| undefined;
					const backgroundOpacity =
						typeof payload?.backgroundOpacity === 'number'
							? payload.backgroundOpacity
							: undefined;
					const actions: NotificationAction[] = [];
					const fn = payload?.functions;
					if (fn && typeof fn === 'object') {
						if (fn.action === 'create_entry') {
							actions.push({ id: 'create_entry', title: 'Создать запись' });
						}
						if (fn.action === 'remind_later' || fn.remindLaterMinutes) {
							const delay = Number(fn.remindLaterMinutes || 15) || 15;
							actions.push({
								id: 'remind_later',
								title: 'Напомнить позже',
								delayMinutes: delay,
							});
						}
					}
					let iconUrl: string | undefined;
					if (backgroundImageBase64) {
						iconUrl = await this.buildIconFromBase64(
							backgroundImageBase64,
							backgroundOpacity
						);
					}
					console.log('[NotifyLocal] show', { title, body });
					await this.sendInstant({
						title,
						body,
						channelId: 'general',
						icon: iconUrl,
						backgroundImage,
						backgroundImageBase64,
						backgroundOpacity,
						actions,
					});
					if (fn?.autoRemindInMinutes) {
						const delay = Number(fn.autoRemindInMinutes) || 15;
						const when = new Date(Date.now() + delay * 60_000);
						console.log('[NotifyLocal] schedule fallback', delay, 'min');
						await this.scheduleReminder({
							title,
							body,
							scheduled: when,
							channelId: 'reminders',
						});
					}
				} catch (e) {
					console.warn('Failed to handle server notification', e);
				}
			};

			sock.on('notification', handler);
			this.notifyHandler = handler;
			console.log('[NotifySocket] handler attached');
		} catch (e) {
			console.warn('[NotifySocket] attach handler failed', e);
		}
	}

	async sendInstant(data: NotificationData): Promise<boolean> {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			console.log('📤 Sending instant notification:', data);

			if (!this.hasPermission) {
				console.error('❌ Cannot send notification: Permission denied');
				return false;
			}

			// Создаем уникальный тег для каждого уведомления
			const uniqueTag = `notification_${Date.now()}_${Math.random()
				.toString(36)
				.substr(2, 9)}`;

			const notificationPayload: any = {
				title: data.title,
				body: data.body,
				icon: data.icon, // теперь возможно подсовываем собранную dataURL
				sound: data.sound,
				tag: data.tag || uniqueTag,
				channelId: data.channelId || 'general',
				ongoing: false,
				silent: false,
				// Если платформа поддерживает — пробросим actions
				actions: (data.actions || []).map(a => ({ id: a.id, title: a.title })),
			};

			console.log('🚀 Sending notification with payload:', notificationPayload);
			await tauriSendNotification(notificationPayload);

			// Локальная обработка действия по клику не поддерживается системно везде.
			// Фоллбек: если одно действие и его можно выполнить сразу (remind/create) — обрабатываем здесь.
			for (const act of data.actions || []) {
				if (act.id === 'remind_later' && typeof act.delayMinutes === 'number') {
					// Ничего не делаем прямо сейчас — пользователь сам нажмёт кнопку в системном уведомлении, если поддерживается
					continue;
				}
			}

			console.log('✅ Instant notification sent successfully');
			return true;
		} catch (error) {
			console.error('❌ Failed to send instant notification:', error);
			return false;
		}
	}

	async scheduleReminder(data: ScheduledNotificationData): Promise<boolean> {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			console.log('⏰ Scheduling reminder notification:', data);

			if (!this.hasPermission) {
				console.error('❌ Cannot schedule notification: Permission denied');
				return false;
			}

			const now = new Date();
			const delay = data.scheduled.getTime() - now.getTime();

			if (delay <= 0) {
				console.log('⚡ Schedule time has passed, sending immediately');
				return await this.sendInstant({
					...data,
					channelId: data.channelId || 'reminders',
				});
			}

			console.log(`⏲️ Scheduling notification for ${delay}ms from now`);

			setTimeout(async () => {
				try {
					console.log('🔔 Executing scheduled notification');
					await this.sendInstant({
						title: `[Scheduled] ${data.title}`,
						body: data.body,
						icon: data.icon,
						sound: data.sound,
						tag: data.tag,
						channelId: data.channelId || 'reminders',
						backgroundImage: data.backgroundImage,
						actions: data.actions,
					});
				} catch (error) {
					console.error('❌ Failed to send scheduled notification:', error);
				}
			}, delay);

			console.log('✅ Reminder notification scheduled successfully');
			return true;
		} catch (error) {
			console.error('❌ Failed to schedule reminder notification:', error);
			return false;
		}
	}

	async sendCritical(data: NotificationData): Promise<boolean> {
		try {
			console.log('🚨 Sending critical notification:', data);
			return await this.sendInstant({
				...data,
				channelId: 'urgent',
			});
		} catch (error) {
			console.error('❌ Failed to send critical notification:', error);
			return false;
		}
	}

	async getPermissionStatus(): Promise<boolean> {
		try {
			this.hasPermission = await isPermissionGranted();
			return this.hasPermission;
		} catch (error) {
			console.error('❌ Failed to get permission status:', error);
			return false;
		}
	}

	async requestPermissions(): Promise<boolean> {
		try {
			console.log('🙏 Requesting notification permissions...');
			const permission = await requestPermission();
			this.hasPermission = permission === 'granted';
			console.log(`✅ Permission result: ${this.hasPermission}`);
			return this.hasPermission;
		} catch (error) {
			console.error('❌ Failed to request permissions:', error);
			return false;
		}
	}

	// Настроить ежедневные напоминания
	async setupDailyReminders(times: string[]): Promise<boolean> {
		try {
			console.warn('⚠️ Ежедневные напоминания не поддерживаются в текущем API');
			console.log(
				'📅 Для ежедневных напоминаний используйте внешний планировщик'
			);

			// Отправляем тестовое уведомление
			const testResult = await this.sendInstant({
				title: '💊 Система напоминаний настроена',
				body: `Времена: ${times.join(
					', '
				)}. Используйте внешний планировщик для автоматических напоминаний.`,
				channelId: 'general',
			});

			return testResult;
		} catch (error) {
			console.error('❌ Ошибка настройки ежедневных напоминаний:', error);
			return false;
		}
	}

	// Отменить все напоминания
	async cancelAllReminders(): Promise<void> {
		try {
			console.warn(
				'⚠️ Отмена всех напоминаний не поддерживается в упрощенном API'
			);
			console.log('🗑️ Функция отмены всех напоминаний недоступна');
		} catch (error) {
			console.error('❌ Ошибка отмены напоминаний:', error);
		}
	}

	// Уведомление о приеме CBD
	async notifyMedication(dose: number): Promise<boolean> {
		return this.sendInstant({
			title: '💊 Время приема CBD',
			body: `Рекомендуемая доза: ${dose}mg. Не забудьте записать эффект через час.`,
			channelId: 'reminders',
		});
	}

	// Уведомление о завершении записи
	async notifyEntryComplete(): Promise<boolean> {
		return this.sendInstant({
			title: '✅ Запись сохранена',
			body: 'Ваша запись настроения добавлена в дневник.',
			channelId: 'general',
		});
	}
}
