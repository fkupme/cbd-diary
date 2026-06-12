import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSocket = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getUserIdFromSocket(client: Socket): string | null {
    try {
      const raw = (client.handshake.auth?.token ||
        client.handshake.query?.token) as string | undefined;
      if (!raw) return null;
      const token = raw.replace(/^Bearer\s+/i, '');
      const secret = this.configService.get<string>('jwt.accessSecret');
      const payload: any = this.jwtService.verify(token, { secret });
      return payload?.sub || payload?.id || null;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    // Любая ошибка в обработчике подключения НЕ должна ронять процесс:
    // необработанное исключение здесь убивало весь HTTP-сервер (ERR_EMPTY_RESPONSE).
    try {
      const userId = this.getUserIdFromSocket(client);
      if (!userId) {
        client.disconnect(true);
        return;
      }

      // Закрываем предыдущее подключение пользователя, если есть
      const prevId = this.userSocket.get(userId);
      if (prevId && prevId !== client.id) {
        const prev = this.findSocketById(prevId);
        try {
          prev?.disconnect(true);
        } catch {}
      }

      this.userSocket.set(userId, client.id);
      client.join(`user:${userId}`);
    } catch (err) {
      console.error('[NotificationsGateway] handleConnection error:', err);
      try {
        client.disconnect(true);
      } catch {}
    }
  }

  // Найти сокет по id, не завязываясь на то, инжектится ли в @WebSocketServer()
  // корневой Server или Namespace (у Namespace `.sockets` уже Map, у Server —
  // это namespace, а Map лежит в `.sockets.sockets`). Раньше хардкод
  // `server.sockets.sockets.get` падал на namespaced-гейтвее.
  private findSocketById(id: string): Socket | undefined {
    const srv: any = this.server;
    if (srv?.sockets instanceof Map) {
      return srv.sockets.get(id);
    }
    if (srv?.sockets?.sockets instanceof Map) {
      return srv.sockets.sockets.get(id);
    }
    return undefined;
  }

  handleDisconnect(client: Socket) {
    // Очищаем маппинг пользователя, у которого этот сокет был активен
    for (const [uid, sid] of this.userSocket.entries()) {
      if (sid === client.id) {
        this.userSocket.delete(uid);
        break;
      }
    }
  }

  // Технический канал для подписки
  @SubscribeMessage('subscribe')
  onSubscribe(@ConnectedSocket() client: Socket, @MessageBody() _payload: any) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) return client.disconnect(true);
    client.join(`user:${userId}`);
    client.emit('subscribed', { ok: true });
  }

  // Отправить payload конкретным пользователям
  emitToUsers(userIds: string[], event: string, payload: any) {
    for (const id of userIds) {
      this.server.to(`user:${id}`).emit(event, payload);
    }
  }
}
