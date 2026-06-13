import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { createApiResponse } from '../../common/helpers/response.helper';
import { ApiResponse } from '../../common/types/api-response.type';
import { PrismaService } from '../../database/prisma.service';
import {
  ConflictResolutionDto,
  SyncRequestDto,
  SyncResponseDto,
  SyncStatusDto,
} from './dto/sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth('JWT-auth')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly prisma: PrismaService,
  ) {}

  private extractUserId(req: Request): string {
    const user: any = (req as any).user;
    if (user?.id) return user.id;
    if (user?.sub) return user.sub;
    throw new Error('Unauthorized: unable to determine user id');
  }

  @Post('user-data')
  @ApiOperation({
    summary: 'Синхронизация данных пользователя',
    description:
      'Синхронизирует данные между мобильным приложением и сервером с обработкой конфликтов.',
  })
  @ApiBody({
    type: SyncRequestDto,
    description: 'Запрос на синхронизацию с операциями от клиента',
    examples: {
      example1: {
        summary: 'Пример синхронизации',
        value: {
          lastSyncAt: '2024-01-01T10:00:00Z',
          operations: [
            {
              operationType: 'INSERT',
              tableName: 'cbt_entries',
              recordId: 'uuid-1',
              dataSnapshot: {
                situation: 'Новая ситуация',
                thoughts: [],
                reactions: 'Реакция',
                entryDate: '2024-01-01T12:00:00Z',
              },
              createdAt: '2024-01-01T11:00:00Z',
            },
          ],
          schemaVersion: '1.0.0',
        },
      },
    },
  })
  @SwaggerResponse({
    status: 200,
    description: 'Синхронизация выполнена',
    schema: {
      example: {
        success: true,
        data: {
          success: true,
          serverOperations: [],
          conflicts: [],
          newSyncTimestamp: '2024-01-01T12:00:00Z',
          stats: {
            processedOperations: 1,
            appliedOperations: 1,
            conflictCount: 0,
            errorCount: 0,
          },
        },
      },
    },
  })
  @SwaggerResponse({
    status: 400,
    description: 'Неверные данные синхронизации',
  })
  async syncUserData(
    @Req() req: Request,
    @Body() syncRequest: SyncRequestDto,
  ): Promise<ApiResponse<SyncResponseDto>> {
    const userId = this.extractUserId(req);

    const result = await this.syncService.syncUserData(userId, syncRequest);

    return createApiResponse(result, req.url);
  }

  @Post('resolve-conflicts')
  @ApiOperation({
    summary: 'Разрешение конфликтов синхронизации',
    description:
      'Разрешает конфликты синхронизации с помощью стратегий разрешения.',
  })
  @ApiBody({
    type: [ConflictResolutionDto],
    description: 'Массив разрешений конфликтов',
    examples: {
      example1: {
        summary: 'Пример разрешения конфликтов',
        value: [
          {
            recordId: 'uuid-1',
            tableName: 'cbt_entries',
            resolution: 'CLIENT_WINS',
          },
          {
            recordId: 'uuid-2',
            tableName: 'cbt_entries',
            resolution: 'MERGE',
            mergedData: {
              situation: 'Объединенная ситуация',
              reactions: 'Объединенная реакция',
            },
          },
        ],
      },
    },
  })
  @SwaggerResponse({
    status: 200,
    description: 'Конфликты разрешены',
    schema: {
      example: {
        success: true,
        data: {
          success: true,
          resolvedCount: 2,
          errors: [],
        },
      },
    },
  })
  @SwaggerResponse({
    status: 400,
    description: 'Ошибка разрешения конфликтов',
  })
  async resolveConflicts(
    @Req() req: Request,
    @Body() resolutions: ConflictResolutionDto[],
  ): Promise<
    ApiResponse<{ success: boolean; resolvedCount: number; errors: string[] }>
  > {
    const userId = this.extractUserId(req);

    const result = await this.syncService.resolveConflicts(userId, resolutions);

    return createApiResponse(result, req.url);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Получить статус синхронизации',
    description: 'Возвращает текущий статус синхронизации пользователя.',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Статус синхронизации',
    schema: {
      example: {
        success: true,
        data: {
          userId: 'user-uuid',
          lastSyncAt: '2024-01-01T10:00:00Z',
          pendingOperationsCount: 0,
          conflictsCount: 0,
          syncStatus: 'UP_TO_DATE',
        },
      },
    },
  })
  async getSyncStatus(
    @Req() req: Request,
  ): Promise<ApiResponse<SyncStatusDto>> {
    const userId = this.extractUserId(req);

    const status = await this.syncService.getSyncStatus(userId);

    return createApiResponse(status, req.url);
  }

  @Put('force-sync')
  @ApiOperation({
    summary: 'Принудительная синхронизация',
    description:
      'Сбрасывает ошибки синхронизации и заставляет пользователя синхронизироваться заново.',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Принудительная синхронизация выполнена',
    schema: {
      example: {
        success: true,
        message: 'Синхронизация сброшена',
      },
    },
  })
  async forceSync(
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string }>> {
    const userId = this.extractUserId(req);

    await this.syncService.forceSyncUser(userId);

    return createApiResponse({ message: 'Синхронизация сброшена' }, req.url);
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Проверка доступности сервиса синхронизации',
    description: 'Возвращает статус работоспособности сервиса синхронизации.',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Сервис работает',
    schema: {
      example: {
        success: true,
        data: {
          status: 'healthy',
          timestamp: '2024-01-01T12:00:00Z',
          version: '1.0.0',
        },
      },
    },
  })
  async healthCheck(
    @Req() req: Request,
  ): Promise<
    ApiResponse<{ status: string; db: string; timestamp: Date; version: string }>
  > {
    // Реальный пинг БД: если базы/коннекта нет — отдаём 503, чтобы Docker
    // healthcheck и мониторинг видели проблему (а не «healthy» при мёртвой БД).
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e: any) {
      throw new ServiceUnavailableException({
        status: 'unhealthy',
        db: 'down',
        error: String(e?.message || e).slice(0, 200),
      });
    }
    return createApiResponse(
      {
        status: 'healthy',
        db: 'up',
        timestamp: new Date(),
        version: '1.0.0',
      },
      req.url,
    );
  }
}
