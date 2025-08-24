import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

interface RemotePushPayload {
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, any>;
}

@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getFcmServerKey(): string | null {
    return this.config.get<string>('FCM_SERVER_KEY') || null;
  }

  async sendFcmToUsers(
    userIds: string[],
    payload: RemotePushPayload,
  ): Promise<{ success: number; failure: number }> {
    const serverKey = this.getFcmServerKey();
    if (!serverKey) {
      this.logger.warn(
        'FCM_SERVER_KEY is not configured; skipping remote push',
      );
      return { success: 0, failure: userIds.length };
    }

    // Собираем токены Android
    const tokens = await this.prisma.devicePushToken.findMany({
      where: { userId: { in: userIds }, platform: 'ANDROID', enabled: true },
      select: { token: true },
    });

    if (tokens.length === 0) return { success: 0, failure: 0 };

    // Отправляем батчами (до ~1000 токенов на запрос)
    const chunkSize = 500;
    let success = 0;
    let failure = 0;

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const batch = tokens.slice(i, i + chunkSize).map((t) => t.token);
      try {
        const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${serverKey}`,
          },
          body: JSON.stringify({
            registration_ids: batch,
            notification: {
              title: payload.title,
              body: payload.body,
              image: payload.imageUrl || undefined,
            },
            android: {
              notification: {
                image: payload.imageUrl || undefined,
                channel_id: 'general',
                priority: 'HIGH',
              },
            },
            data: payload.data || {},
          }),
        });
        const json: any = await resp.json().catch(() => ({}));
        success += Number(json?.success) || 0;
        failure += Number(json?.failure) || 0;
      } catch (e) {
        this.logger.warn(`FCM batch send failed: ${e}`);
        failure += batch.length;
      }
    }

    return { success, failure };
  }
}
