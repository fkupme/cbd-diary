import { io, Socket } from 'socket.io-client';
import { authService } from './api';
import { getCurrentBaseURL } from './api/config';
import { SecureStorageService } from './SecureStorageService';

export class SocketService {
	private static instance: SocketService;
	private socket: Socket | null = null;
	private notifySocket: Socket | null = null;

	static getInstance(): SocketService {
		if (!SocketService.instance) {
			SocketService.instance = new SocketService();
		}
		return SocketService.instance;
	}

	private buildSocket(origin: string): Socket {
		return io(`${origin}/ws/chat`, {
			transports: ['websocket'],
			autoConnect: false,
			reconnection: true,
			reconnectionDelay: 500,
			reconnectionAttempts: Infinity,
		});
	}

	private buildNotifySocket(origin: string): Socket {
		return io(`${origin}/ws/notifications`, {
			transports: ['websocket'],
			autoConnect: false,
			reconnection: true,
			reconnectionDelay: 500,
			reconnectionAttempts: Infinity,
		});
	}

	async connectAsync(): Promise<Socket> {
		if (this.socket && this.socket.connected) return this.socket;

		const apiBase = getCurrentBaseURL();
		const origin = apiBase.replace(/\/api\/v1$/, '');

		if (!this.socket) {
			this.socket = this.buildSocket(origin);
			// Диагностика проблем подключения
			this.socket.on('connect_error', (e: any) => {
				console.warn('[Socket] connect_error:', e?.message || e);
			});
			this.socket.on('disconnect', (reason: any) => {
				console.warn('[Socket] disconnect:', reason);
			});
		}

		// Ждём токен из безопасного хранилища, если он не прогружен ещё в apiClient
		const storage = SecureStorageService.getInstance();
		let token = authService.getAuthToken();
		if (!token) {
			try {
				const tokens = await storage.getAPITokens();
				token = tokens?.access || null;
			} catch {}
		}

		// Устанавливаем auth и query с Bearer-префиксом и коннектимся
		const bearer = token
			? token.startsWith('Bearer ')
				? token
				: `Bearer ${token}`
			: undefined;
		(this.socket as any).auth = bearer ? { token: bearer } : undefined;
		try {
			// Дополнительно продублируем через query для совместимости
			(this.socket as any).io.opts.query = bearer ? { token: bearer } : {};
		} catch {}
		if (!this.socket.connected) this.socket.connect();
		return this.socket;
	}

	async connectNotificationsAsync(): Promise<Socket> {
		if (this.notifySocket && this.notifySocket.connected)
			return this.notifySocket;
		const apiBase = getCurrentBaseURL();
		const origin = apiBase.replace(/\/api\/v1$/, '');
		if (!this.notifySocket) this.notifySocket = this.buildNotifySocket(origin);

		const storage = SecureStorageService.getInstance();
		let token = authService.getAuthToken();
		if (!token) {
			try {
				const tokens = await storage.getAPITokens();
				token = tokens?.access || null;
			} catch {}
		}
		(this.notifySocket as any).auth = token ? { token } : undefined;
		if (!this.notifySocket.connected) this.notifySocket.connect();
		return this.notifySocket;
	}

	connect(): Socket {
		if (!this.socket) {
			const origin = getCurrentBaseURL().replace(/\/api\/v1$/, '');
			this.socket = this.buildSocket(origin);
		}
		void this.connectAsync();
		return this.socket;
	}

	connectNotifications(): Socket {
		if (!this.notifySocket) {
			const origin = getCurrentBaseURL().replace(/\/api\/v1$/, '');
			this.notifySocket = this.buildNotifySocket(origin);
		}
		void this.connectNotificationsAsync();
		return this.notifySocket;
	}

	async joinChat(chatId: string): Promise<void> {
		const s = await this.connectAsync();
		s.emit('join', { chatId });
	}

	async joinChatAsync(chatId: string, timeoutMs = 4000): Promise<boolean> {
		return new Promise(async resolve => {
			const s = await this.connectAsync();
			let done = false;
			const onJoined = (p: any) => {
				if (p?.chatId === chatId) {
					done = true;
					s.off('joined', onJoined);
					resolve(true);
				}
			};
			s.on('joined', onJoined);
			s.emit('join', { chatId });
			setTimeout(() => {
				if (!done) {
					s.off('joined', onJoined);
					resolve(false);
				}
			}, timeoutMs);
		});
	}

	emitAiGenerate(chatId: string): void {
		void this.connectAsync().then(s => s.emit('ai_generate', { chatId }));
	}

	onMessage(handler: (payload: any) => void): void {
		void this.connectAsync().then(s => s.on('message', handler));
	}

	offMessage(handler: (payload: any) => void): void {
		this.socket?.off('message', handler);
	}

	onAiDelta(
		handler: (payload: { chatId: string; delta: string }) => void
	): void {
		void this.connectAsync().then(s => s.on('ai_delta', handler));
	}

	offAiDelta(
		handler: (payload: { chatId: string; delta: string }) => void
	): void {
		this.socket?.off('ai_delta', handler as any);
	}

	onAiDone(handler: (payload: { chatId: string }) => void): void {
		void this.connectAsync().then(s => s.on('ai_done', handler));
	}

	offAiDone(handler: (payload: { chatId: string }) => void): void {
		this.socket?.off('ai_done', handler as any);
	}

	onAiError(
		handler: (payload: { chatId: string; error: string }) => void
	): void {
		void this.connectAsync().then(s => s.on('ai_error', handler));
	}

	offAiError(
		handler: (payload: { chatId: string; error: string }) => void
	): void {
		this.socket?.off('ai_error', handler as any);
	}

	// === Notifications namespace ===
	subscribeNotifications(): void {
		void this.connectNotificationsAsync().then(s => s.emit('subscribe', {}));
	}

	onNotification(handler: (payload: any) => void): void {
		void this.connectNotificationsAsync().then(s =>
			s.on('notification', handler)
		);
	}
	offNotification(handler: (payload: any) => void): void {
		this.notifySocket?.off('notification', handler as any);
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
		if (this.notifySocket) {
			this.notifySocket.disconnect();
			this.notifySocket = null;
		}
	}
}

export const socketService = SocketService.getInstance();
