import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
  CreateEmotionCategoryDto,
  EmotionCategoryResponseDto,
  UpdateEmotionCategoryDto,
} from './dto/emotion-category.dto';
import {
  CreateEmotionDto,
  EmotionQueryDto,
  EmotionResponseDto,
  UpdateEmotionDto,
} from './dto/emotion.dto';
import { EmotionsService } from './emotions.service';

export interface PaginatedResult<T> {
  data: T[];
  metadata: PaginationMetadata;
}

@ApiTags('emotions')
@ApiBearerAuth('JWT-auth')
@Controller('emotions')
export class EmotionsController {
  constructor(private readonly emotionsService: EmotionsService) {}

  // === КАТЕГОРИИ ЭМОЦИЙ ===

  @Get('categories')
  @ApiOperation({
    summary: 'Получить все категории эмоций',
    description:
      'Возвращает список всех активных категорий эмоций с локализацией.',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Код языка для локализации',
    example: 'ru',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Список категорий эмоций',
    type: [EmotionCategoryResponseDto],
  })
  async findAllCategories(): Promise<EmotionCategoryResponseDto[]> {
    return this.emotionsService.findAllCategories();
  }

  @Get('categories/:id')
  @ApiOperation({
    summary: 'Получить категорию эмоций по ID',
    description: 'Возвращает детальную информацию о категории эмоций.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID категории эмоций',
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Код языка для локализации',
    example: 'ru',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Категория эмоций найдена',
    type: EmotionCategoryResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'Категория не найдена',
  })
  async findCategoryById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EmotionCategoryResponseDto> {
    return this.emotionsService.findCategoryById(id);
  }

  @Post('categories')
  @ApiOperation({
    summary: 'Создать новую категорию эмоций',
    description: 'Создает новую категорию эмоций с указанными параметрами.',
  })
  @ApiBody({
    type: CreateEmotionCategoryDto,
    description: 'Данные для создания категории эмоций',
  })
  @SwaggerResponse({
    status: 201,
    description: 'Категория эмоций успешно создана',
    type: EmotionCategoryResponseDto,
  })
  @SwaggerResponse({
    status: 409,
    description: 'Категория с таким ключом уже существует',
  })
  async createCategory(
    @Body() createCategoryDto: CreateEmotionCategoryDto,
  ): Promise<EmotionCategoryResponseDto> {
    return this.emotionsService.createCategory(createCategoryDto);
  }

  @Patch('categories/:id')
  @ApiOperation({
    summary: 'Обновить категорию эмоций',
    description: 'Обновляет существующую категорию эмоций.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID категории эмоций',
    type: 'number',
    example: 1,
  })
  @ApiBody({
    type: UpdateEmotionCategoryDto,
    description: 'Данные для обновления категории эмоций',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Категория эмоций успешно обновлена',
    type: EmotionCategoryResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'Категория не найдена',
  })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateEmotionCategoryDto,
  ): Promise<EmotionCategoryResponseDto> {
    return this.emotionsService.updateCategory(id, updateCategoryDto);
  }

  @Delete('categories/:id')
  @ApiOperation({
    summary: 'Удалить категорию эмоций',
    description: 'Удаляет категорию эмоций по ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID категории эмоций',
    type: 'number',
    example: 1,
  })
  @SwaggerResponse({
    status: 204,
    description: 'Категория эмоций успешно удалена',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Категория не найдена',
  })
  @SwaggerResponse({
    status: 409,
    description: 'Нельзя удалить категорию, содержащую эмоции',
  })
  async deleteCategory(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.emotionsService.deleteCategory(id);
  }

  // === ЭМОЦИИ ===

  @Get()
  @ApiOperation({
    summary: 'Получить список эмоций',
    description:
      'Возвращает список эмоций с поддержкой фильтрации и пагинации.',
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
    description: 'Количество элементов на странице',
    example: 10,
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'ID категории для фильтрации',
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Фильтр по активности',
    type: 'boolean',
    example: true,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Поиск по названию или синонимам',
    example: 'счастье',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Код языка для локализации',
    example: 'ru',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Список эмоций',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/EmotionResponseDto' },
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
  async findAllEmotions(
    @Query() query: EmotionQueryDto,
  ): Promise<PaginatedResult<EmotionResponseDto>> {
    return this.emotionsService.findAllEmotions(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить эмоцию по ID',
    description: 'Возвращает детальную информацию об эмоции.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID эмоции',
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Код языка для локализации',
    example: 'ru',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Эмоция найдена',
    type: EmotionResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'Эмоция не найдена',
  })
  async findEmotionById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EmotionResponseDto> {
    return this.emotionsService.findEmotionById(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать новую эмоцию',
    description: 'Создает новую эмоцию с указанными параметрами.',
  })
  @ApiBody({
    type: CreateEmotionDto,
    description: 'Данные для создания эмоции',
  })
  @SwaggerResponse({
    status: 201,
    description: 'Эмоция успешно создана',
    type: EmotionResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'Категория не найдена',
  })
  @SwaggerResponse({
    status: 409,
    description: 'Эмоция с таким ключом уже существует',
  })
  async createEmotion(
    @Body() createEmotionDto: CreateEmotionDto,
  ): Promise<EmotionResponseDto> {
    return this.emotionsService.createEmotion(createEmotionDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить эмоцию',
    description: 'Обновляет существующую эмоцию.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID эмоции',
    type: 'number',
    example: 1,
  })
  @ApiBody({
    type: UpdateEmotionDto,
    description: 'Данные для обновления эмоции',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Эмоция успешно обновлена',
    type: EmotionResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'Эмоция не найдена',
  })
  async updateEmotion(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmotionDto: UpdateEmotionDto,
  ): Promise<EmotionResponseDto> {
    return this.emotionsService.updateEmotion(id, updateEmotionDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить эмоцию',
    description: 'Удаляет эмоцию по ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID эмоции',
    type: 'number',
    example: 1,
  })
  @SwaggerResponse({
    status: 204,
    description: 'Эмоция успешно удалена',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Эмоция не найдена',
  })
  async deleteEmotion(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.emotionsService.deleteEmotion(id);
  }
}
