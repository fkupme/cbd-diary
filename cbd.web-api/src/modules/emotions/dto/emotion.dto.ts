import { IsString, IsOptional, IsInt, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateEmotionDto {
  @IsInt({ message: 'ID категории должен быть числом' })
  categoryId: number;

  @IsString({ message: 'Ключ названия должен быть строкой' })
  nameKey: string;

  @IsString({ message: 'Эмодзи должен быть строкой' })
  emoji: string;

  @IsOptional()
  @IsInt({ message: 'Интенсивность по умолчанию должна быть числом' })
  @Min(1, { message: 'Интенсивность не может быть меньше 1' })
  @Max(10, { message: 'Интенсивность не может быть больше 10' })
  intensityDefault?: number = 5;

  @IsOptional()
  @IsArray({ message: 'Синонимы должны быть массивом' })
  @IsString({ each: true, message: 'Каждый синоним должен быть строкой' })
  synonyms?: string[] = [];

  @IsOptional()
  @IsInt({ message: 'ID противоположной эмоции должен быть числом' })
  oppositeEmotionId?: number;

  @IsOptional()
  @IsInt({ message: 'Порядок сортировки должен быть числом' })
  sortOrder?: number = 0;
}

export class UpdateEmotionDto {
  @IsOptional()
  @IsInt({ message: 'ID категории должен быть числом' })
  categoryId?: number;

  @IsOptional()
  @IsString({ message: 'Ключ названия должен быть строкой' })
  nameKey?: string;

  @IsOptional()
  @IsString({ message: 'Эмодзи должен быть строкой' })
  emoji?: string;

  @IsOptional()
  @IsInt({ message: 'Интенсивность по умолчанию должна быть числом' })
  @Min(1, { message: 'Интенсивность не может быть меньше 1' })
  @Max(10, { message: 'Интенсивность не может быть больше 10' })
  intensityDefault?: number;

  @IsOptional()
  @IsArray({ message: 'Синонимы должны быть массивом' })
  @IsString({ each: true, message: 'Каждый синоним должен быть строкой' })
  synonyms?: string[];

  @IsOptional()
  @IsInt({ message: 'ID противоположной эмоции должен быть числом' })
  oppositeEmotionId?: number;

  @IsOptional()
  @IsInt({ message: 'Порядок сортировки должен быть числом' })
  sortOrder?: number;

  @IsOptional()
  @IsBoolean({ message: 'Статус активности должен быть булевым' })
  isActive?: boolean;
}

export class EmotionResponseDto {
  id: number;
  categoryId: number;
  nameKey: string;
  name: string; // Переведенное название
  emoji: string;
  intensityDefault: number;
  synonyms: string[];
  oppositeEmotionId?: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  
  // Связанные данные
  category?: {
    id: number;
    name: string;
    color: string;
    icon?: string;
  };
}

export class EmotionQueryDto extends PaginationDto {
  @IsOptional()
  @IsInt({ message: 'ID категории должен быть числом' })
  categoryId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsString()
  language?: string = 'ru';
} 