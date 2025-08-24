import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEmotionCategoryDto {
  @IsString({ message: 'Ключ названия должен быть строкой' })
  nameKey: string;

  @IsHexColor({ message: 'Цвет должен быть в HEX формате' })
  color: string;

  @IsOptional()
  @IsString({ message: 'Иконка должна быть строкой' })
  icon?: string;

  @IsOptional()
  @IsInt({ message: 'Порядок сортировки должен быть числом' })
  sortOrder?: number = 0;
}

export class UpdateEmotionCategoryDto {
  @IsOptional()
  @IsString({ message: 'Ключ названия должен быть строкой' })
  nameKey?: string;

  @IsOptional()
  @IsHexColor({ message: 'Цвет должен быть в HEX формате' })
  color?: string;

  @IsOptional()
  @IsString({ message: 'Иконка должна быть строкой' })
  icon?: string;

  @IsOptional()
  @IsInt({ message: 'Порядок сортировки должен быть числом' })
  sortOrder?: number;

  @IsOptional()
  @IsBoolean({ message: 'Статус активности должен быть булевым' })
  isActive?: boolean;
}

export class EmotionCategoryResponseDto {
  id: number;
  nameKey: string;
  name: string; // Переведенное название
  color: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}
