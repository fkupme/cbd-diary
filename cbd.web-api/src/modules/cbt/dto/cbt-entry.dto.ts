import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class EmotionInputDto {
  @ApiProperty({ description: 'ID эмоции' })
  @IsInt({ message: 'ID эмоции должен быть числом' })
  emotion_id: number;

  @ApiProperty({ description: 'Интенсивность эмоции', minimum: 1, maximum: 10 })
  @IsInt({ message: 'Интенсивность должна быть числом' })
  @Min(1, { message: 'Интенсивность не может быть меньше 1' })
  @Max(10, { message: 'Интенсивность не может быть больше 10' })
  intensity: number;
}

export class CognitiveDistortionDto {
  @ApiProperty({ description: 'Тип когнитивного искажения' })
  @IsString({ message: 'Тип искажения должен быть строкой' })
  type: string;

  @ApiProperty({ description: 'Описание или примечание' })
  @IsOptional()
  @IsString({ message: 'Описание должно быть строкой' })
  note?: string;
}

export class ThoughtChainDto {
  @ApiProperty({ description: 'Текст мысли' })
  @IsString({ message: 'Мысль должна быть строкой' })
  thought: string;

  @ApiProperty({ description: 'Является ли мысль автоматической' })
  @IsOptional()
  is_automatic?: boolean = false;

  @ApiProperty({ description: 'Интенсивность мысли', minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt({ message: 'Интенсивность должна быть числом' })
  @Min(1, { message: 'Интенсивность не может быть меньше 1' })
  @Max(10, { message: 'Интенсивность не может быть больше 10' })
  intensity?: number = 5;

  @ApiProperty({
    description: 'Эмоции связанные с мыслью',
    type: [EmotionInputDto],
  })
  @IsArray({ message: 'Эмоции должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => EmotionInputDto)
  emotions: EmotionInputDto[];

  @ApiPropertyOptional({
    description: 'Когнитивные искажения',
    type: [CognitiveDistortionDto],
  })
  @IsOptional()
  @IsArray({ message: 'Когнитивные искажения должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => CognitiveDistortionDto)
  cognitive_distortions?: CognitiveDistortionDto[] = [];
}

export class CreateCbtEntryDto {
  @ApiPropertyOptional({
    description: 'Дата записи',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат даты' })
  entryDate?: string;

  @ApiProperty({ description: 'Описание ситуации' })
  @IsString({ message: 'Ситуация должна быть строкой' })
  situation: string;

  @ApiProperty({
    description: 'Цепочки мыслей и эмоций',
    type: [ThoughtChainDto],
  })
  @IsArray({ message: 'Мысли должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => ThoughtChainDto)
  thoughts: ThoughtChainDto[];

  @ApiProperty({ description: 'Реакции и поведение' })
  @IsString({ message: 'Реакции должны быть строкой' })
  reactions: string;

  @ApiPropertyOptional({
    description: 'Настроение до записи',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Настроение должно быть числом' })
  @Min(1, { message: 'Настроение не может быть меньше 1' })
  @Max(10, { message: 'Настроение не может быть больше 10' })
  mood_score_before?: number;

  @ApiPropertyOptional({
    description: 'Настроение после записи',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Настроение должно быть числом' })
  @Min(1, { message: 'Настроение не может быть меньше 1' })
  @Max(10, { message: 'Настроение не может быть больше 10' })
  mood_score_after?: number;

  @ApiPropertyOptional({ description: 'Длительность записи в минутах' })
  @IsOptional()
  @IsInt({ message: 'Длительность должна быть числом' })
  @Min(0, { message: 'Длительность не может быть отрицательной' })
  entry_duration_minutes?: number;

  @ApiPropertyOptional({ description: 'Теги', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Теги должны быть массивом' })
  @IsString({ each: true, message: 'Каждый тег должен быть строкой' })
  tags?: string[] = [];
}

export class UpdateCbtEntryDto {
  @ApiPropertyOptional({
    description: 'Дата записи',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат даты' })
  entryDate?: string;

  @ApiPropertyOptional({ description: 'Описание ситуации' })
  @IsOptional()
  @IsString({ message: 'Ситуация должна быть строкой' })
  situation?: string;

  @ApiPropertyOptional({
    description: 'Цепочки мыслей и эмоций',
    type: [ThoughtChainDto],
  })
  @IsOptional()
  @IsArray({ message: 'Мысли должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => ThoughtChainDto)
  thoughts?: ThoughtChainDto[];

  @ApiPropertyOptional({ description: 'Реакции и поведение' })
  @IsOptional()
  @IsString({ message: 'Реакции должны быть строкой' })
  reactions?: string;

  @ApiPropertyOptional({
    description: 'Настроение до записи',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Настроение должно быть числом' })
  @Min(1, { message: 'Настроение не может быть меньше 1' })
  @Max(10, { message: 'Настроение не может быть больше 10' })
  mood_score_before?: number;

  @ApiPropertyOptional({
    description: 'Настроение после записи',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Настроение должно быть числом' })
  @Min(1, { message: 'Настроение не может быть меньше 1' })
  @Max(10, { message: 'Настроение не может быть больше 10' })
  mood_score_after?: number;

  @ApiPropertyOptional({ description: 'Длительность записи в минутах' })
  @IsOptional()
  @IsInt({ message: 'Длительность должна быть числом' })
  @Min(0, { message: 'Длительность не может быть отрицательной' })
  entry_duration_minutes?: number;

  @ApiPropertyOptional({ description: 'Теги', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Теги должны быть массивом' })
  @IsString({ each: true, message: 'Каждый тег должен быть строкой' })
  tags?: string[];
}

export class CbtEntryResponseDto {
  @ApiProperty({ description: 'ID записи' })
  id: string;

  @ApiProperty({ description: 'ID пользователя' })
  userId: string;

  @ApiProperty({ description: 'Дата записи' })
  entryDate: Date;

  @ApiProperty({ description: 'Описание ситуации' })
  situation: string;

  @ApiProperty({ description: 'Цепочки мыслей и эмоций' })
  thoughts: ThoughtChainDto[];

  @ApiProperty({ description: 'Реакции и поведение' })
  reactions: string;

  @ApiPropertyOptional({ description: 'Настроение до записи' })
  moodScoreBefore?: number;

  @ApiPropertyOptional({ description: 'Настроение после записи' })
  moodScoreAfter?: number;

  @ApiPropertyOptional({ description: 'Длительность записи в минутах' })
  entryDurationMinutes?: number;

  @ApiProperty({ description: 'Теги' })
  tags: string[];

  @ApiPropertyOptional({ description: 'ИИ анализ записи' })
  aiAnalysis?: object;

  @ApiProperty({ description: 'Синхронизировано ли с сервером' })
  isSynced: boolean;

  @ApiPropertyOptional({ description: 'ID чата, связанного с этой записью' })
  chatId?: string;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}

export class CbtEntryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Дата начала периода',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат даты начала' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Дата окончания периода',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат даты окончания' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Поиск по тегам', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Теги должны быть массивом' })
  @IsString({ each: true, message: 'Каждый тег должен быть строкой' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Минимальная оценка настроения',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Минимальная оценка должна быть числом' })
  @Min(1, { message: 'Минимальная оценка не может быть меньше 1' })
  @Max(10, { message: 'Минимальная оценка не может быть больше 10' })
  minMoodScore?: number;

  @ApiPropertyOptional({
    description: 'Максимальная оценка настроения',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Максимальная оценка должна быть числом' })
  @Min(1, { message: 'Максимальная оценка не может быть меньше 1' })
  @Max(10, { message: 'Максимальная оценка не может быть больше 10' })
  maxMoodScore?: number;

  @ApiPropertyOptional({
    description: 'Поиск по тексту (ситуация, мысли, реакции)',
  })
  @IsOptional()
  @IsString({ message: 'Поисковый запрос должен быть строкой' })
  search?: string;
}
