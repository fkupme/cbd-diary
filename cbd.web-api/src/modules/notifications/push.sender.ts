import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../database/prisma.service';

interface RemotePushPayload {
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, any>;
}

/**
 * Отправка remote push через Firebase Cloud Messaging (HTTP v1, firebase-admin).
 * Шлёт на все платформы пользователя (Android/iOS/Web). Инициализация ленивая,
 * из service account в env FIREBASE_SERVICE_ACCOUNT (полный JSON). Если не задан —
 * сервис тихо деградирует (push не отправляется), приложение продолжает работать.
 */
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);
  private app: admin.app.App | null = null;
  private initTried = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getApp(): admin.app.App | null {
    if (this.app) return this.app;
    if (this.initTried) return null;
    this.initTried = true;

    // Принимаем service account как base64 (надёжно для CI/.env — одна строка,
    // без переносов и кавычек) ИЛИ как сырой JSON (удобно для локального .env).
    const b64 = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_B64');
    const raw = b64
      ? Buffer.from(b64, 'base64').toString('utf8')
      : this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT(_B64) не задан — remote push отключён',
      );
      return null;
    }

    try {
      const serviceAccount = JSON.parse(raw);
      this.app =
        admin.apps.length && admin.apps[0]
          ? admin.apps[0]
          : admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
      this.logger.log('firebase-admin инициализирован для push');
      return this.app;
    } catch (e) {
      this.logger.error(`Не удалось инициализировать firebase-admin: ${e}`);
      return null;
    }
  }

  /** FCM data-payload требует строковые значения. */
  private toStringData(data?: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    if (!data) return out;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) continue;
      out[k] = typeof v === 'string' ? v : String(v);
    }
    return out;
  }

  /** Отправить push на конкретные токены (любая платформа). */
  async sendToTokens(
    tokens: string[],
    payload: RemotePushPayload,
  ): Promise<{ success: number; failure: number }> {
    const app = this.getApp();
    if (!app || tokens.length === 0) {
      return { success: 0, failure: tokens.length };
    }

    const data = this.toStringData(payload.data);
    let success = 0;
    let failure = 0;
    const invalidTokens: string[] = [];

    // sendEachForMulticast принимает до 500 токенов за вызов
    const chunkSize = 500;
    for (let i = 0; i < tokens.length; i += chunkSize) {
      const batch = tokens.slice(i, i + chunkSize);
      try {
        const res = await admin.messaging(app).sendEachForMulticast({
          tokens: batch,
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl || undefined,
          },
          data,
          webpush: {
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
            },
            fcmOptions: { link: '/' },
          },
          android: {
            priority: 'high',
            notification: { channelId: 'general' },
          },
        });
        success += res.successCount;
        failure += res.failureCount;
        res.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.code || '';
            if (
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token') ||
              code.includes('invalid-argument')
            ) {
              invalidTokens.push(batch[idx]);
            }
          }
        });
      } catch (e) {
        this.logger.warn(`push batch send failed: ${e}`);
        failure += batch.length;
      }
    }

    // Гасим протухшие токены, чтобы не слать на них впредь
    if (invalidTokens.length > 0) {
      await this.prisma.devicePushToken
        .updateMany({
          where: { token: { in: invalidTokens } },
          data: { enabled: false },
        })
        .catch(() => undefined);
      this.logger.log(`Отключено протухших токенов: ${invalidTokens.length}`);
    }

    return { success, failure };
  }

  /** Отправить push всем токенам указанных пользователей (Android/iOS/Web). */
  async sendPushToUsers(
    userIds: string[],
    payload: RemotePushPayload,
  ): Promise<{ success: number; failure: number }> {
    if (userIds.length === 0) return { success: 0, failure: 0 };
    const rows = await this.prisma.devicePushToken.findMany({
      where: { userId: { in: userIds }, enabled: true },
      select: { token: true },
    });
    return this.sendToTokens(
      rows.map((r) => r.token),
      payload,
    );
  }

  /**
   * Совместимость со старым вызовом из контроллера. Раньше слал только Android
   * через legacy FCM HTTP API (Google его отключил); теперь — все платформы
   * через firebase-admin.
   */
  async sendFcmToUsers(
    userIds: string[],
    payload: RemotePushPayload,
  ): Promise<{ success: number; failure: number }> {
    return this.sendPushToUsers(userIds, payload);
  }
}
