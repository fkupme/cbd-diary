import { io, Socket } from 'socket.io-client';
import { authService } from './api';
import { apiClient } from './api/client';
import { getCurrentBaseURL } from './api/config';
import { SecureStorageService } from './SecureStorageService';

export class SocketService {
	private static instance: SocketService;
	private socket: Socket | null = null;
	private notifySocket: Socket | null = null;
	// Комнаты, в которых мы должны состоять: после любого реконнекта
	// membership на сервере теряется — заходим заново сами.
	private joinedChats = new Set<string>();
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	static getInstance(): SocketService {
		if (!SocketService.instance) {
			SocketService.instance = new SocketService();
		}
		return SocketService.instance;
	}

	// Свежий access token на КАЖДУЮ попытку коннекта (включая авто-реконнекты).
	// Раньше auth ставился один раз при первом connect — после истечения токена
	// (TTL 15 мин) реконнект приходил со старым токеном и сервер рубил соединение.
	private async freshBearer(): Promise<string | undefined> {
		let token: string | null = null;
		try {
			token = await apiClient.ensureFreshAccessToken();
		} catch {}
		if (!token) {
			token = authService.getAuthToken();
		}
		if (!token) {
			try {
				const tokens = await SecureStorageService.getInstance().getAPITokens();
				token = tokens?.access || null;
			} catch {}
		}
		if (!token) return undefined;
		return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
	}

	private authCallback = (cb: (data: object) => void) => {
		void this.freshBearer().then(bearer =>
			cb(bearer ? { token: bearer } : {})
		);
	};

	private buildSocket(origin: string): Socket {
		const s = io(`${origin}/ws/chat`, {
			transports: ['websocket'],
			autoConnect: false,
			reconnection: true,
			reconnectionDelay: 500,
			reconnectionDelayMax: 5000,
			reconnectionAttempts: Infinity,
			auth: this.authCallback,
		});

		s.on('connect', () => {
			console.log('[Socket] connect:', s.id);
			// Восстанавливаем комнаты после (ре)коннекта
			for (const chatId of this.joinedChats) {
				s.emit('join', { chatId });
			}
		});
		s.on('connect_error', (e: any) => {
			console.warn('[Socket] connect_error:', e?.message || e);
		});
		s.on('disconnect', (reason: any) => {
			console.warn('[Socket] disconnect:', reason);
			// 'io server disconnect' (например, истёкший токен на хендшейке)
			// socket.io сам НЕ реконнектит — переподключаемся вручную со свежим auth.
			if (reason === 'io server disconnect') {
				this.scheduleManualReconnect(s);
			}
		});
		return s;
	}

	private scheduleManualReconnect(s: Socket, delayMs = 1000): void {
		if (this.reconnectTimer) return;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (!s.connected && authService.isAuthenticated()) {
				console.log('[Socket] manual reconnect after server disconnect');
				s.connect();
			}
		}, delayMs);
	}

	private buildNotifySocket(origin: string): Socket {
		const s = io(`${origin}/ws/notifications`, {
			transports: ['websocket'],
			autoConnect: false,
			reconnection: true,
			reconnectionDelay: 500,
			reconnectionDelayMax: 5000,
			reconnectionAttempts: Infinity,
			auth: this.authCallback,
		});
		s.on('connect', () => s.emit('subscribe', {}));
		s.on('disconnect', (reason: any) => {
			if (reason === 'io server disconnect') {
				setTimeout(() => {
					if (!s.connected && authService.isAuthenticated()) s.connect();
				}, 1000);
			}
		});
		return s;
	}

	async connectAsync(): Promise<Socket> {
		if (this.socket && this.socket.connected) return this.socket;

		const apiBase = getCurrentBaseURL();
		const origin = apiBase.replace(/\/api\/v1$/, '');

		if (!this.socket) {
			this.socket = this.buildSocket(origin);
		}
		if (!this.socket.connected) this.socket.connect();
		return this.socket;
	}

	async connectNotificationsAsync(): Promise<Socket> {
		if (this.notifySocket && this.notifySocket.connected)
			return this.notifySocket;
		const apiBase = getCurrentBaseURL();
		const origin = apiBase.replace(/\/api\/v1$/, '');
		if (!this.notifySocket) this.notifySocket = this.buildNotifySocket(origin);
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
		this.joinedChats.add(chatId);
		const s = await this.connectAsync();
		s.emit('join', { chatId });
	}

	async joinChatAsync(chatId: string, timeoutMs = 4000): Promise<boolean> {
		this.joinedChats.add(chatId);
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

	leaveChat(chatId: string): void {
		this.joinedChats.delete(chatId);
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
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
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
