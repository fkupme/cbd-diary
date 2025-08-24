import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface NotificationPayload {
  title?: string | null;
  message?: string | null;
  time?: string | null; // ISO string for scheduled time
  functions?: any | null; // TODO: describe actions schema
  userIds?: string[] | null;
  birthday?: string | null; // filter example
  filters?: Record<string, any> | null;
  backgroundColor?: string | null;
  backgroundImage?: string | null;
  backgroundImageBase64?: string | null;
  backgroundOpacity?: number | null;
  forceToAll?: boolean | null; // send even if user opted out
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async selectTargetUserIds(payload: NotificationPayload): Promise<string[]> {
    const userIds = payload.userIds ?? undefined;
    const forceToAll = Boolean(payload.forceToAll);

    if (Array.isArray(userIds) && userIds.length > 0) {
      if (forceToAll) return userIds;
      const allowed = await this.prisma.user.findMany({
        where: { id: { in: userIds }, pushEnabled: true },
        select: { id: true },
      });
      return allowed.map((u) => u.id);
    }

    const where: any = {};
    if (!forceToAll) where.pushEnabled = true;

    // Примитивная обработка фильтров
    const f = (payload.filters || {}) as any;
    if (typeof f.preferredLanguage === 'string')
      where.preferredLanguage = f.preferredLanguage;
    if (typeof f.gender === 'string') where.gender = f.gender.toUpperCase();
    if (typeof f.minAge === 'number' || typeof f.maxAge === 'number') {
      const gte = typeof f.minAge === 'number' ? f.minAge : undefined;
      const lte = typeof f.maxAge === 'number' ? f.maxAge : undefined;
      where.age = {
        ...(gte !== undefined ? { gte } : {}),
        ...(lte !== undefined ? { lte } : {}),
      } as any;
    }

    // Фильтр по дню рождения (YYYY-MM-DD) — берём месяц/день из dateOfBirth
    if (payload.birthday) {
      try {
        const [y, m, d] = String(payload.birthday)
          .split('-')
          .map((x) => Number(x));
        if (m && d) {
          // Prisma не умеет напрямую по части даты: фильтруем постфактум
          const candidates = await this.prisma.user.findMany({
            where,
            select: { id: true, dateOfBirth: true },
          });
          return candidates
            .filter((u) => {
              if (!u.dateOfBirth) return false;
              const mm = u.dateOfBirth.getUTCMonth() + 1;
              const dd = u.dateOfBirth.getUTCDate();
              return mm === m && dd === d;
            })
            .map((u) => u.id);
        }
      } catch {}
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async dispatchOrSchedule(
    targets: string[],
    payload: Omit<NotificationPayload, 'userIds'>,
    emitter: (userIds: string[], event: string, p: any) => void,
  ) {
    const eventPayload = {
      title: payload.title || 'Уведомление',
      message: payload.message || '',
      time: payload.time,
      functions: payload.functions,
      backgroundColor: payload.backgroundColor,
      backgroundImage: payload.backgroundImage,
      backgroundImageBase64: payload.backgroundImageBase64,
      backgroundOpacity: payload.backgroundOpacity,
    };

    // Если указано время в будущем — ставим таймер (in-memory)
    if (payload.time) {
      const when = new Date(payload.time);
      if (Number.isFinite(when.getTime()) && when.getTime() > Date.now()) {
        const delay = when.getTime() - Date.now();
        setTimeout(() => {
          try {
            emitter(targets, 'notification', eventPayload);
          } catch {}
        }, delay);
        return {
          accepted: true,
          scheduledAt: when.toISOString(),
          recipients: targets.length,
        };
      }
    }

    // Иначе — шлём сразу
    emitter(targets, 'notification', eventPayload);
    return { accepted: true, recipients: targets.length };
  }

  async registerDeviceToken(params: {
    userId?: string | null;
    token: string;
    platform: 'ANDROID' | 'IOS';
    deviceId?: string | null;
  }) {
    const { userId, token, platform, deviceId } = params;
    const now = new Date();
    // upsert по токену
    const rec = await this.prisma.devicePushToken.upsert({
      where: { token },
      update: {
        userId: userId ?? undefined,
        platform,
        deviceId: deviceId ?? undefined,
        enabled: true,
        lastSeenAt: now,
      },
      create: {
        token,
        platform,
        userId: userId ?? undefined,
        deviceId: deviceId ?? undefined,
        enabled: true,
        lastSeenAt: now,
      },
    });
    return rec;
  }
}
