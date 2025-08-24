import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OperationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CbtService } from '../cbt/cbt.service';
import {
  ConflictResolutionDto,
  SyncConflictDto,
  SyncDataDto,
  SyncRequestDto,
  SyncResponseDto,
  SyncStatusDto,
} from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cbtService: CbtService,
  ) {}

  async syncUserData(
    userId: string,
    syncRequest: SyncRequestDto,
  ): Promise<SyncResponseDto> {
    const startTime = Date.now();
    const stats = {
      processedOperations: 0,
      appliedOperations: 0,
      conflictCount: 0,
      errorCount: 0,
    };

    try {
      // 1. Получаем последнюю синхронизацию пользователя
      const lastSyncDate = syncRequest.lastSyncAt
        ? new Date(syncRequest.lastSyncAt)
        : new Date(0); // Если первая синхронизация

      // 2. Получаем операции сервера, которые произошли после последней синхронизации клиента
      const serverOperations = await this.getServerOperationsSince(
        userId,
        lastSyncDate,
      );

      // 3. Обрабатываем операции от клиента
      const conflicts: SyncConflictDto[] = [];

      for (const operation of syncRequest.operations) {
        stats.processedOperations++;

        try {
          const conflict = await this.processClientOperation(userId, operation);
          if (conflict) {
            conflicts.push(conflict);
            stats.conflictCount++;
          } else {
            stats.appliedOperations++;
          }
        } catch (error) {
          console.error('Ошибка обработки операции:', error);
          stats.errorCount++;
        }
      }

      // 4. Обновляем временную метку синхронизации пользователя
      const newSyncTimestamp = new Date();
      await this.updateUserSyncTimestamp(userId, newSyncTimestamp);

      return {
        success: true,
        serverOperations: serverOperations.map((op) =>
          this.mapToSyncDataDto(op),
        ),
        conflicts,
        newSyncTimestamp,
        stats,
      };
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
      return {
        success: false,
        serverOperations: [],
        conflicts: [],
        newSyncTimestamp: new Date(),
        message: 'Ошибка синхронизации данных',
        stats,
      };
    }
  }

  async resolveConflicts(
    userId: string,
    resolutions: ConflictResolutionDto[],
  ): Promise<{ success: boolean; resolvedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let resolvedCount = 0;

    for (const resolution of resolutions) {
      try {
        await this.resolveConflict(userId, resolution);
        resolvedCount++;
      } catch (error) {
        errors.push(
          `Ошибка разрешения конфликта для ${resolution.recordId}: ${error.message}`,
        );
      }
    }

    return {
      success: errors.length === 0,
      resolvedCount,
      errors,
    };
  }

  async getSyncStatus(userId: string): Promise<SyncStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastSyncAt: true,
        isSynced: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Подсчитываем несинхронизированные операции
    const pendingOperationsCount = await this.prisma.syncOperation.count({
      where: {
        userId,
        syncedAt: null,
      },
    });

    // Подсчитываем конфликты (операции с ошибками)
    const conflictsCount = await this.prisma.syncOperation.count({
      where: {
        userId,
        lastError: { not: null },
      },
    });

    // Определяем статус синхронизации
    let syncStatus: 'UP_TO_DATE' | 'PENDING' | 'CONFLICTS' | 'ERROR' =
      'UP_TO_DATE';

    if (conflictsCount > 0) {
      syncStatus = 'CONFLICTS';
    } else if (pendingOperationsCount > 0) {
      syncStatus = 'PENDING';
    }

    // Получаем последнюю ошибку
    const lastErrorOperation = await this.prisma.syncOperation.findFirst({
      where: {
        userId,
        lastError: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { lastError: true },
    });

    return {
      userId,
      lastSyncAt: user.lastSyncAt || new Date(0),
      pendingOperationsCount,
      conflictsCount,
      syncStatus,
      lastError: lastErrorOperation?.lastError,
    };
  }

  async forceSyncUser(userId: string): Promise<void> {
    // Сбрасываем все ошибки синхронизации для пользователя
    await this.prisma.syncOperation.updateMany({
      where: {
        userId,
        lastError: { not: null },
      },
      data: {
        lastError: null,
        retryCount: 0,
      },
    });

    // Обновляем статус синхронизации пользователя
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isSynced: false,
        lastSyncAt: null,
      },
    });
  }

  // Приватные методы

  private async getServerOperationsSince(
    userId: string,
    since: Date,
  ): Promise<any[]> {
    return this.prisma.syncOperation.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        syncedAt: { not: null }, // Только синхронизированные операции
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async processClientOperation(
    userId: string,
    operation: SyncDataDto,
  ): Promise<SyncConflictDto | null> {
    const { operationType, tableName, recordId, dataSnapshot } = operation;

    try {
      // Проверяем, есть ли уже операция с таким recordId
      const existingOperation = await this.prisma.syncOperation.findFirst({
        where: {
          userId,
          tableName,
          recordId,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingOperation && existingOperation.syncedAt) {
        // Проверяем конфликт по времени
        const clientTime = operation.createdAt
          ? new Date(operation.createdAt)
          : new Date();
        const serverTime = existingOperation.createdAt;

        if (serverTime > clientTime) {
          // Серверная версия новее - конфликт
          return {
            recordId,
            tableName,
            clientData: dataSnapshot,
            serverData: existingOperation.dataSnapshot as object,
            conflictType: 'UPDATE_CONFLICT',
            serverUpdatedAt: serverTime,
            clientUpdatedAt: clientTime,
          };
        }
      }

      // Применяем операцию
      await this.applyOperation(userId, operation);

      // После успешного применения — удаляем предыдущие ошибки по этой записи
      await this.prisma.syncOperation.deleteMany({
        where: {
          userId,
          tableName,
          recordId,
          lastError: { not: null },
        },
      });

      // Создаем запись об операции синхронизации
      await this.prisma.syncOperation.create({
        data: {
          userId,
          operationType,
          tableName,
          recordId,
          dataSnapshot,
          syncedAt: new Date(),
        },
      });

      // Чистим успешные операции для пользователя, чтобы очередь не разрасталась
      await this.prisma.syncOperation.deleteMany({
        where: { userId, syncedAt: { not: null }, lastError: null },
      });

      return null; // Нет конфликта
    } catch (error) {
      // Логируем ошибку операции
      await this.prisma.syncOperation.create({
        data: {
          userId,
          operationType,
          tableName,
          recordId,
          dataSnapshot,
          lastError: error.message,
          retryCount: 1,
        },
      });

      throw error;
    }
  }

  private async applyOperation(
    userId: string,
    operation: SyncDataDto,
  ): Promise<void> {
    const { operationType, tableName, recordId, dataSnapshot } = operation;

    switch (tableName) {
      case 'cbt_entries':
        await this.applyCbtEntryOperation(
          userId,
          operationType,
          recordId,
          dataSnapshot,
        );
        break;

      // Добавить другие таблицы по мере необходимости
      default:
        throw new BadRequestException(`Неподдерживаемая таблица: ${tableName}`);
    }
  }

  private async applyCbtEntryOperation(
    userId: string,
    operationType: OperationType,
    recordId: string,
    dataSnapshot: any,
  ): Promise<void> {
    const normalizeEntrySnapshot = (snap: any) => {
      // Приводим снапшот к полям Prisma-модели CbtEntry
      const entryDate = snap?.entryDate ? new Date(snap.entryDate) : new Date();
      const thoughtsJson = Array.isArray(snap?.thoughts) ? snap.thoughts : [];
      const tagsJson = Array.isArray(snap?.tags)
        ? snap.tags
        : typeof snap?.tags === 'string'
          ? (() => {
              try {
                return JSON.parse(snap.tags);
              } catch {
                return [];
              }
            })()
          : [];

      return {
        situation: String(snap?.situation ?? ''),
        reactions: String(snap?.reactions ?? ''),
        entryDate,
        thoughts: thoughtsJson,
        moodScoreBefore:
          typeof snap?.moodScoreBefore === 'number'
            ? snap.moodScoreBefore
            : null,
        moodScoreAfter:
          typeof snap?.moodScoreAfter === 'number' ? snap.moodScoreAfter : null,
        entryDurationMinutes:
          typeof snap?.entryDurationMinutes === 'number'
            ? snap.entryDurationMinutes
            : null,
        tags: tagsJson,
        // Флаги синка
        isSynced: true,
      } as const;
    };

    switch (operationType) {
      case OperationType.INSERT:
        try {
          await this.prisma.cbtEntry.create({
            data: {
              id: recordId,
              userId,
              ...normalizeEntrySnapshot(dataSnapshot),
            },
          });
        } catch (e: any) {
          // При конфликте по id делаем UPDATE (идемпотентность синка)
          if (String(e?.message || '').includes('Unique constraint failed')) {
            await this.prisma.cbtEntry.update({
              where: { id: recordId },
              data: normalizeEntrySnapshot(dataSnapshot),
            });
          } else {
            throw e;
          }
        }
        break;

      case OperationType.UPDATE:
        await this.prisma.cbtEntry.update({
          where: { id: recordId },
          data: normalizeEntrySnapshot(dataSnapshot),
        });
        break;

      case OperationType.DELETE:
        await this.prisma.cbtEntry.delete({
          where: { id: recordId },
        });
        break;

      default:
        throw new BadRequestException(
          `Неподдерживаемый тип операции: ${operationType}`,
        );
    }
  }

  private async resolveConflict(
    userId: string,
    resolution: ConflictResolutionDto,
  ): Promise<void> {
    const {
      recordId,
      tableName,
      resolution: strategy,
      mergedData,
    } = resolution;

    switch (strategy) {
      case 'CLIENT_WINS':
        // Клиент побеждает - применяем данные клиента
        await this.applyOperation(userId, {
          operationType: OperationType.UPDATE,
          tableName,
          recordId,
          dataSnapshot: mergedData || {},
        });
        break;

      case 'SERVER_WINS':
        // Сервер побеждает - ничего не делаем, клиент получит серверную версию
        break;

      case 'MERGE':
        if (!mergedData) {
          throw new BadRequestException(
            'Для стратегии MERGE требуются объединенные данные',
          );
        }
        // Применяем объединенные данные
        await this.applyOperation(userId, {
          operationType: OperationType.UPDATE,
          tableName,
          recordId,
          dataSnapshot: mergedData,
        });
        break;

      default:
        throw new BadRequestException(
          `Неподдерживаемая стратегия разрешения: ${strategy}`,
        );
    }

    // Удаляем ошибку конфликта
    await this.prisma.syncOperation.deleteMany({
      where: {
        userId,
        tableName,
        recordId,
        lastError: { not: null },
      },
    });
  }

  private async updateUserSyncTimestamp(
    userId: string,
    timestamp: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastSyncAt: timestamp,
        isSynced: true,
      },
    });
  }

  private mapToSyncDataDto(operation: any): SyncDataDto {
    return {
      operationType: operation.operationType,
      tableName: operation.tableName,
      recordId: operation.recordId,
      dataSnapshot: operation.dataSnapshot,
      createdAt: operation.createdAt.toISOString(),
    };
  }
}
