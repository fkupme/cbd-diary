import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { NotificationsGateway } from './notifications.gateway';
import {
  NotificationPayload,
  NotificationsService,
} from './notifications.service';
import { PushSenderService } from './push.sender';

export class CreateNotificationDto {
  @ApiPropertyOptional({
    description: 'Заголовок уведомления',
    example: 'Напоминание',
  })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({
    description: 'Текст уведомления',
    example: 'Пора заполнить дневник',
  })
  @IsOptional()
  @IsString()
  message?: string | null;

  @ApiPropertyOptional({
    description: 'Время показа (ISO 8601) для планирования',
    example: '2025-08-11T16:30:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  time?: string | null;

  @ApiPropertyOptional({
    description:
      'Действия/кнопки (произвольный объект) — например, create_entry',
    type: 'object',
    example: { action: 'create_entry' },
  })
  @IsOptional()
  functions?: any | null;

  @ApiPropertyOptional({
    description: 'Список userId для таргетинга',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  userIds?: string[] | null;

  @ApiPropertyOptional({
    description: 'Фильтр по дню рождения (YYYY-MM-DD)',
    example: '1990-05-12',
  })
  @IsOptional()
  @IsString()
  birthday?: string | null;

  @ApiPropertyOptional({ description: 'Произвольные фильтры', type: 'object' })
  @IsOptional()
  filters?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: 'Фоновый цвет в HEX',
    example: '#4CAF50',
  })
  @IsOptional()
  @IsHexColor()
  backgroundColor?: string | null;

  @ApiPropertyOptional({
    description: 'URL фонового изображения',
    example: 'https://example.com/bg.png',
  })
  @IsOptional()
  @IsUrl()
  backgroundImage?: string | null;

  @ApiPropertyOptional({
    description: 'Изображение фона в base64 (data без префикса)',
    example: 'iVBORw0KGgoAAAANSUhEUgAA...',
  })
  @IsOptional()
  @IsString()
  backgroundImageBase64?: string | null;

  @ApiPropertyOptional({
    description: 'Прозрачность фона 0..1',
    example: 0.4,
    default: 0.4,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  backgroundOpacity?: number | null;

  @ApiPropertyOptional({
    description: 'Отправить всем, даже если отключены пуши',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceToAll?: boolean | null;
}

class RegisterPushTokenDto {
  @ApiPropertyOptional({ description: 'User ID владельца токена' })
  @IsOptional()
  @IsString()
  userId?: string | null;

  @ApiPropertyOptional({ description: 'Платформа', example: 'ANDROID' })
  @IsString()
  platform!: 'ANDROID' | 'IOS';

  @ApiPropertyOptional({
    description: 'Токен устройства',
    example: 'fcmtoken...',
  })
  @IsString()
  token!: string;

  @ApiPropertyOptional({
    description: 'Идентификатор устройства',
    example: 'device-abc',
  })
  @IsOptional()
  @IsString()
  deviceId?: string | null;
}

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly pushSender: PushSenderService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Создать и разослать уведомление (live/queue)' })
  @ApiBody({ type: CreateNotificationDto })
  @ApiResponse({ status: 202, description: 'Уведомление принято к отправке' })
  async create(@Body() dto: CreateNotificationDto) {
    const payload: NotificationPayload = {
      title: dto.title ?? 'Уведомление',
      message: dto.message ?? '',
      time: dto.time ?? null,
      functions: dto.functions ?? null,
      userIds: dto.userIds ?? null,
      birthday: dto.birthday ?? null,
      filters: dto.filters ?? null,
      backgroundColor: dto.backgroundColor ?? null,
      backgroundImage: dto.backgroundImage ?? null,
      backgroundImageBase64: dto.backgroundImageBase64 ?? null,
      backgroundOpacity: dto.backgroundOpacity ?? null,
      forceToAll: dto.forceToAll ?? null,
    };

    const targets = await this.service.selectTargetUserIds(payload);

    const result = await this.service.dispatchOrSchedule(
      targets,
      payload,
      (ids, ev, p) => this.gateway.emitToUsers(ids, ev, p),
    );

    // Параллельно отправим remote push (Android/FCM), если настроен ключ
    void this.pushSender
      .sendFcmToUsers(targets, {
        title: payload.title || 'Уведомление',
        body: payload.message || '',
        imageUrl: payload.backgroundImage || undefined,
        data: {
          action: payload.functions?.action || undefined,
          remindLaterMinutes:
            payload.functions?.remindLaterMinutes || undefined,
        },
      })
      .catch(() => undefined);

    return result;
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Зарегистрировать/обновить push-токен устройства' })
  @ApiBody({ type: RegisterPushTokenDto })
  async register(@Body() dto: RegisterPushTokenDto) {
    const rec = await this.service.registerDeviceToken({
      userId: dto.userId ?? null,
      token: dto.token,
      platform: dto.platform,
      deviceId: dto.deviceId ?? null,
    });
    return { success: true, data: { id: rec.id } };
  }
}
