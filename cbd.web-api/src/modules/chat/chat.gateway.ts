import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

// pingInterval/pingTimeout заданы явно: вебвью мобильного приложения в фоне
// троттлит таймеры и пропускает понги — даём 60с форы вместо дефолтных 20с,
// чтобы короткий фон/идл не убивал соединение.
@WebSocketGateway({
  namespace: '/ws/chat',
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // In-memory флаг выполнения для предотвращения конкурентных генераций на один чат
  private readonly generatingChats = new Set<string>();

  private getUserIdFromSocket(client: Socket): string | null {
    try {
      const raw = (client.handshake.auth?.token ||
        client.handshake.query?.token) as string | undefined;
      if (!raw) {
        this.logger.warn(
          `WS no token in handshake: id=${client.id}, authKeys=${Object.keys(
            (client.handshake as any)?.auth || {},
          ).join(',')}, queryKeys=${Object.keys(
            (client.handshake as any)?.query || {},
          ).join(',')}`,
        );
        return null;
      }
      const token = raw.replace(/^Bearer\s+/i, '');
      this.logger.log(`WS token received len=${token.length}, id=${client.id}`);
      const secret = this.configService.get<string>('jwt.accessSecret');
      const payload: any = this.jwtService.verify(token, { secret });
      return payload?.sub || payload?.id || null;
    } catch (e: any) {
      this.logger.error(
        `WS token verify failed id=${client.id}: ${e?.message || e}`,
      );
      return null;
    }
  }

  handleConnection(client: Socket) {
    const hasAuthToken = !!(
      (client.handshake as any)?.auth?.token ||
      (client.handshake as any)?.query?.token
    );
    const userId = this.getUserIdFromSocket(client);
    this.logger.log(
      `WS connect: hasAuth=${hasAuthToken}, userId=${userId ?? 'null'}, id=${client.id}`,
    );
    if (!userId) {
      this.logger.warn(`WS disconnect (no auth): id=${client.id}`);
      client.disconnect(true);
      return;
    }
    // Токен проверяем ОДИН раз на хендшейке и кэшируем userId на соединении.
    // Иначе access-токен (TTL 15 мин) истекает посреди живой сессии, очередное
    // событие не проходит verify и сокет молча убивается disconnect(true).
    client.data.userId = userId;
  }

  private resolveUserId(client: Socket): string | null {
    return (client.data?.userId as string) || this.getUserIdFromSocket(client);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const userId = this.resolveUserId(client);
    if (!userId) return client.disconnect(true);
    this.logger.log(`join: user=${userId}, chat=${payload?.chatId}`);
    client.join(`chat:${payload.chatId}`);
    // Отвечаем только инициатору; в комнату рассылать не требуется
    client.emit('joined', { chatId: payload.chatId });

    try {
      const msgs = await this.chatService.listMessages(userId, payload.chatId);
      const lastSystem = [...msgs].reverse().find((m) => m.role === 'SYSTEM');
      if (lastSystem) {
        client.emit('message', { ...lastSystem, chatId: payload.chatId });
      }
    } catch {}
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      chatId: string;
      role?: 'USER' | 'AI' | 'SYSTEM';
      content: string;
    },
  ) {
    const userId = this.resolveUserId(client);
    if (!userId) return client.disconnect(true);
    const role = payload.role || 'USER';
    const msg = await this.chatService.addMessage(
      userId,
      payload.chatId,
      role,
      payload.content,
    );
    // Рассылаем: инициатору и остальным в комнате (без дублирования для инициатора)
    client.emit('message', msg);
    client.to(`chat:${payload.chatId}`).emit('message', msg);
  }

  @SubscribeMessage('ai_generate')
  async handleAiGenerate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const userId = this.resolveUserId(client);
    if (!userId) return client.disconnect(true);
    this.logger.log(`ai_generate: user=${userId}, chat=${payload?.chatId}`);

    const chatRoom = `chat:${payload.chatId}`;

    // Немедленный ACK для диагностики: отправляем инициатору и остальным в комнате (без дубля для инициатора)
    client.emit('ai_ack', { chatId: payload.chatId });
    client.to(chatRoom).emit('ai_ack', { chatId: payload.chatId });

    // Если по этому чату уже идёт генерация — сигнализируем повторный старт и выходим
    if (this.generatingChats.has(payload.chatId)) {
      client.emit('ai_started', { chatId: payload.chatId });
      client.to(chatRoom).emit('ai_started', { chatId: payload.chatId });
      return;
    }

    this.generatingChats.add(payload.chatId);

    // Сигнализируем клиентам, что генерация началась
    client.emit('ai_started', { chatId: payload.chatId });
    client.to(chatRoom).emit('ai_started', { chatId: payload.chatId });

    try {
      let full = '';
      await this.chatService.streamAiReply(
        userId,
        payload.chatId,
        async (delta) => {
          full += delta;
          // Стримим куски: единичная доставка инициатору + остальным
          client.emit('ai_delta', { chatId: payload.chatId, delta });
          client
            .to(chatRoom)
            .emit('ai_delta', { chatId: payload.chatId, delta });
        },
      );

      if (full && full.trim().length > 0) {
        const saved = await this.chatService.addMessage(
          userId,
          payload.chatId,
          'AI',
          full,
        );
        // Сообщение всем участникам, без дублирования для инициатора
        client.emit('message', saved);
        client.to(chatRoom).emit('message', saved);
      }
      client.emit('ai_done', { chatId: payload.chatId });
      client.to(chatRoom).emit('ai_done', { chatId: payload.chatId });
    } catch (e: any) {
      this.logger.error(
        `ai_generate failed for chat=${payload?.chatId}, user=${userId}: ${e?.message || e}`,
      );
      const errorPayload = {
        chatId: payload.chatId,
        error: e?.message || 'AI error',
      };
      client.emit('ai_error', errorPayload);
      client.to(chatRoom).emit('ai_error', errorPayload);
    } finally {
      this.generatingChats.delete(payload.chatId);
    }
  }
}
