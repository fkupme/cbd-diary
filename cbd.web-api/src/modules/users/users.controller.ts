import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { PaginationMetadata } from '../../common/types/api-response.type';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

export interface PaginatedResult<T> {
  data: T[];
  metadata: PaginationMetadata;
}

interface UserQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить список пользователей',
    description:
      'Возвращает пагинированный список пользователей с возможностью поиска и фильтрации.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Номер страницы',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Количество пользователей на странице',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Поиск по email или имени',
    example: 'john@example.com',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Фильтр по активности',
    type: 'boolean',
    example: true,
  })
  @SwaggerResponse({
    status: 200,
    description: 'Список пользователей получен успешно',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/UserResponseDto' },
        },
        metadata: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  async findAll(
    @Query() query: UserQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить пользователя по ID',
    description: 'Возвращает информацию о конкретном пользователе.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID пользователя',
    example: 'uuid',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Пользователь найден',
    type: UserResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'Пользователь не найден',
  })
  async findById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать нового пользователя',
    description: 'Создает нового пользователя в системе.',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'Данные для создания пользователя',
  })
  @SwaggerResponse({
    status: 201,
    description: 'Пользователь успешно создан',
    type: UserResponseDto,
  })
  @SwaggerResponse({
    status: 409,
    description: 'Пользователь с таким email уже существует',
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить пользователя',
    description: 'Обновляет информацию о пользователе.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID пользователя',
    example: 'uuid',
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Данные для обновления пользователя',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Пользователь успешно обновлен',
    type: UserResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'Пользователь не найден',
  })
  @SwaggerResponse({
    status: 409,
    description: 'Пользователь с таким email уже существует',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить пользователя',
    description: 'Удаляет пользователя из системы.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID пользователя',
    example: 'uuid',
  })
  @SwaggerResponse({
    status: 204,
    description: 'Пользователь успешно удален',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Пользователь не найден',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.usersService.delete(id);
  }

  @Post(':id/change-password')
  @ApiOperation({
    summary: 'Изменить пароль пользователя',
    description: 'Позволяет пользователю изменить свой пароль.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID пользователя',
    example: 'uuid',
  })
  @ApiBody({
    type: ChangePasswordDto,
    description: 'Данные для изменения пароля',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Пароль успешно изменен',
  })
  @SwaggerResponse({
    status: 400,
    description: 'Неверный текущий пароль',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Пользователь не найден',
  })
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.changePassword(id, changePasswordDto);
    return { message: 'Пароль успешно изменен' };
  }
}
