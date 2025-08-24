import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthTokensDto {
  @ApiProperty({
    description: 'JWT токен доступа',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT токен обновления',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

export class UserInfoDto {
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

  @ApiProperty({
    description: 'Дата создания аккаунта',
    example: '2023-01-01T00:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt: Date;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({
    description: 'Информация о пользователе',
    type: UserInfoDto,
  })
  user: UserInfoDto;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'JWT токен обновления',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
