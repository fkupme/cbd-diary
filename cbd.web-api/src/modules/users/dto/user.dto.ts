import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email адрес пользователя',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Введите корректный email' })
  email: string;

  @ApiProperty({
    description: 'Пароль пользователя',
    example: 'password123',
    minLength: 6,
    maxLength: 50,
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  @MaxLength(50, { message: 'Пароль не может быть длиннее 50 символов' })
  password: string;

  @ApiProperty({
    description: 'Имя пользователя',
    example: 'Иван Иванов',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Имя должно быть строкой' })
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  name?: string;

  @ApiProperty({
    description: 'Предпочитаемый язык интерфейса',
    example: 'ru',
    enum: ['ru', 'en'],
    default: 'ru',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Язык должен быть строкой' })
  preferredLanguage?: string;

  @ApiProperty({
    required: false,
    description: 'Дата рождения (ISO 8601)',
    example: '1990-05-12',
  })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Email адрес пользователя',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Введите корректный email' })
  email?: string;

  @ApiProperty({
    description: 'Имя пользователя',
    example: 'Иван Петров',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Имя должно быть строкой' })
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  name?: string;

  @ApiProperty({
    description: 'Предпочитаемый язык интерфейса',
    example: 'en',
    enum: ['ru', 'en'],
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Язык должен быть строкой' })
  preferredLanguage?: string;

  @ApiProperty({
    required: false,
    description: 'Дата рождения (ISO 8601)',
    example: '1990-05-12',
  })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Статус активности пользователя',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Статус активности должен быть булевым' })
  isActive?: boolean;

  @ApiProperty({
    required: false,
    description: 'Получать push-уведомления',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Значение должно быть булевым' })
  pushEnabled?: boolean;

  // Дополнительные поля профиля
  @ApiProperty({ required: false, description: 'Возраст пользователя' })
  @IsOptional()
  @IsInt({ message: 'Возраст должен быть числом' })
  @Min(1)
  @Max(120)
  age?: number;

  @ApiProperty({
    required: false,
    description: 'Пол пользователя',
    example: 'male',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({
    required: false,
    description: 'Цели использования',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Цели должны быть массивом строк' })
  goals?: string[];

  @ApiProperty({
    required: false,
    description: 'Уровень опыта',
    example: 'beginner',
  })
  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @ApiProperty({
    required: false,
    description: 'Частота медитации',
    example: 'daily',
  })
  @IsOptional()
  @IsString()
  meditationFrequency?: string;

  @ApiProperty({ required: false, description: 'Уровень стресса (1-10)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  stressLevel?: number;

  @ApiProperty({ required: false, description: 'Качество сна (1-10)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  sleepQuality?: number;

  @ApiProperty({ required: false, description: 'Часовой пояс' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор пользователя',
    example: '1',
  })
  id: string;

  @ApiProperty({
    description: 'Email адрес пользователя',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Имя пользователя',
    example: 'Иван Иванов',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Предпочитаемый язык интерфейса',
    example: 'ru',
    enum: ['ru', 'en'],
  })
  preferredLanguage: string;

  @ApiProperty({ description: 'Статус активности пользователя', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Флаг приёма push-уведомлений', example: true })
  pushEnabled: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ required: false, type: 'string', format: 'date' })
  dateOfBirth?: Date;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Текущий пароль пользователя' })
  @IsString({ message: 'Текущий пароль должен быть строкой' })
  currentPassword: string;

  @ApiProperty({
    description: 'Новый пароль пользователя',
    minLength: 6,
    maxLength: 50,
  })
  @IsString({ message: 'Новый пароль должен быть строкой' })
  @MinLength(6, { message: 'Новый пароль должен содержать минимум 6 символов' })
  @MaxLength(50, { message: 'Новый пароль не может быть длиннее 50 символов' })
  newPassword: string;
}
