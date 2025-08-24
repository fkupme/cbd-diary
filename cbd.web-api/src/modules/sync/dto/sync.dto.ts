import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SyncDataDto {
  @ApiProperty({ description: 'Тип операции синхронизации' })
  @IsEnum(OperationType, { message: 'Неверный тип операции' })
  operationType: OperationType;

  @ApiProperty({ description: 'Название таблицы' })
  @IsString({ message: 'Название таблицы должно быть строкой' })
  tableName: string;

  @ApiProperty({ description: 'ID записи' })
  @IsString({ message: 'ID записи должен быть строкой' })
  recordId: string;

  @ApiProperty({ description: 'Снапшот данных' })
  @IsObject({ message: 'Данные должны быть объектом' })
  dataSnapshot: object;

  @ApiPropertyOptional({ description: 'Временная метка создания операции' })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат даты' })
  createdAt?: string;
}

export class SyncRequestDto {
  @ApiProperty({
    description: 'Последняя временная метка синхронизации клиента',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат даты' })
  lastSyncAt?: string;

  @ApiProperty({
    description: 'Операции синхронизации от клиента',
    type: [SyncDataDto],
  })
  @IsArray({ message: 'Операции должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => SyncDataDto)
  operations: SyncDataDto[];

  @ApiPropertyOptional({ description: 'Версия схемы клиента' })
  @IsOptional()
  @IsString({ message: 'Версия схемы должна быть строкой' })
  schemaVersion?: string;
}

export class SyncConflictDto {
  @ApiProperty({ description: 'ID записи с конфликтом' })
  recordId: string;

  @ApiProperty({ description: 'Название таблицы' })
  tableName: string;

  @ApiProperty({ description: 'Версия клиента' })
  clientData: object;

  @ApiProperty({ description: 'Версия сервера' })
  serverData: object;

  @ApiProperty({ description: 'Тип конфликта' })
  conflictType: 'UPDATE_CONFLICT' | 'DELETE_CONFLICT' | 'CREATE_CONFLICT';

  @ApiProperty({ description: 'Временная метка изменения на сервере' })
  serverUpdatedAt: Date;

  @ApiProperty({ description: 'Временная метка изменения на клиенте' })
  clientUpdatedAt: Date;
}

export class SyncResponseDto {
  @ApiProperty({ description: 'Успешность синхронизации' })
  success: boolean;

  @ApiProperty({
    description: 'Операции от сервера для клиента',
    type: [SyncDataDto],
  })
  serverOperations: SyncDataDto[];

  @ApiProperty({
    description: 'Конфликты синхронизации',
    type: [SyncConflictDto],
  })
  conflicts: SyncConflictDto[];

  @ApiProperty({ description: 'Новая временная метка синхронизации' })
  newSyncTimestamp: Date;

  @ApiPropertyOptional({ description: 'Сообщение об ошибке' })
  message?: string;

  @ApiProperty({ description: 'Статистика синхронизации' })
  stats: {
    processedOperations: number;
    appliedOperations: number;
    conflictCount: number;
    errorCount: number;
  };
}

export class ConflictResolutionDto {
  @ApiProperty({ description: 'ID записи' })
  @IsString({ message: 'ID записи должен быть строкой' })
  recordId: string;

  @ApiProperty({ description: 'Название таблицы' })
  @IsString({ message: 'Название таблицы должно быть строкой' })
  tableName: string;

  @ApiProperty({ description: 'Стратегия разрешения конфликта' })
  @IsEnum(['CLIENT_WINS', 'SERVER_WINS', 'MERGE'], {
    message: 'Неверная стратегия разрешения',
  })
  resolution: 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE';

  @ApiPropertyOptional({
    description: 'Объединенные данные (для стратегии MERGE)',
  })
  @IsOptional()
  @IsObject({ message: 'Объединенные данные должны быть объектом' })
  mergedData?: object;
}

export class SyncStatusDto {
  @ApiProperty({ description: 'ID пользователя' })
  userId: string;

  @ApiProperty({ description: 'Временная метка последней синхронизации' })
  lastSyncAt: Date;

  @ApiProperty({ description: 'Количество несинхронизированных операций' })
  pendingOperationsCount: number;

  @ApiProperty({ description: 'Количество конфликтов' })
  conflictsCount: number;

  @ApiProperty({ description: 'Статус синхронизации' })
  syncStatus: 'UP_TO_DATE' | 'PENDING' | 'CONFLICTS' | 'ERROR';

  @ApiProperty({ description: 'Последняя ошибка синхронизации' })
  lastError?: string;
}
