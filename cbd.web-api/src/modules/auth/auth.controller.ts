import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/types/api-response.type';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Регистрация нового пользователя',
    description:
      'Создает нового пользователя с email и паролем. Возвращает JWT токены для авторизации.',
  })
  @ApiBody({
    type: RegisterDto,
    description: 'Данные для регистрации пользователя',
    examples: {
      example1: {
        summary: 'Пример регистрации',
        value: {
          email: 'user@example.com',
          password: 'password123',
          name: 'Иван Иванов',
          preferredLanguage: 'ru',
        },
      },
    },
  })
  @SwaggerResponse({
    status: 201,
    description: 'Пользователь успешно зарегистрирован',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: '1',
            email: 'user@example.com',
            name: 'Иван Иванов',
            preferredLanguage: 'ru',
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        },
        message: 'Пользователь успешно зарегистрирован',
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/auth/register',
      },
    },
  })
  @SwaggerResponse({
    status: 409,
    description: 'Пользователь с таким email уже существует',
  })
  @SwaggerResponse({
    status: 400,
    description: 'Некорректные данные валидации',
  })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Пользователь успешно зарегистрирован',
      timestamp: new Date().toISOString(),
      path: '/auth/register',
    };

    return response;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Вход в систему',
    description:
      'Аутентификация пользователя по email и паролю. Возвращает JWT токены.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Данные для входа в систему',
    examples: {
      example1: {
        summary: 'Пример входа',
        value: {
          email: 'user@example.com',
          password: 'password123',
        },
      },
    },
  })
  @SwaggerResponse({
    status: 200,
    description: 'Успешная аутентификация',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: '1',
            email: 'user@example.com',
            name: 'Иван Иванов',
            preferredLanguage: 'ru',
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        },
        message: 'Успешная аутентификация',
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/auth/login',
      },
    },
  })
  @SwaggerResponse({
    status: 401,
    description: 'Неверный email или пароль',
  })
  @SwaggerResponse({
    status: 400,
    description: 'Некорректные данные валидации',
  })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Успешная аутентификация',
      timestamp: new Date().toISOString(),
      path: '/auth/login',
    };

    return response;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Обновление токена доступа',
    description: 'Обновляет истекший access token используя refresh token.',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token для обновления',
    examples: {
      example1: {
        summary: 'Пример обновления токена',
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @SwaggerResponse({
    status: 200,
    description: 'Токен успешно обновлен',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        message: 'Токен успешно обновлен',
        timestamp: '2023-01-01T00:00:00.000Z',
        path: '/auth/refresh',
      },
    },
  })
  @SwaggerResponse({
    status: 401,
    description: 'Недействительный refresh token',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
    );

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Токен успешно обновлен',
      timestamp: new Date().toISOString(),
      path: '/auth/refresh',
    };

    return response;
  }
}
