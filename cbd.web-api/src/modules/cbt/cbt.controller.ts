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
  Req,
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
import { Request } from 'express';
import {
  createApiResponse,
  createPaginatedResponse,
} from '../../common/helpers/response.helper';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../common/types/api-response.type';
import { CbtService } from './cbt.service';
import {
  CbtEntryQueryDto,
  CbtEntryResponseDto,
  CreateCbtEntryDto,
  UpdateCbtEntryDto,
} from './dto/cbt-entry.dto';

@ApiTags('cbt')
@ApiBearerAuth('JWT-auth')
@Controller('cbt')
export class CbtController {
  constructor(private readonly cbtService: CbtService) {}

  private extractUserId(req: Request): string {
    const user: any = (req as any).user;
    if (user?.id) return user.id;
    if (user?.sub) return user.sub;
    const auth = (req.headers['authorization'] ||
      req.headers['Authorization']) as string | undefined;
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length);
      try {
        const payloadPart = token.split('.')[1];
        const json = Buffer.from(payloadPart, 'base64').toString('utf8');
        const payload = JSON.parse(json);
        if (payload?.sub) return payload.sub;
        if (payload?.id) return payload.id;
      } catch {
        // ignore
      }
    }
    throw new Error('Unauthorized: unable to determine user id');
  }

  @Post('entries')
  @ApiOperation({
    summary: 'Создать новую запись КПТ',
    description:
      'Создает новую запись дневника КПТ с ситуацией, мыслями, эмоциями и реакциями.',
  })
  @ApiBody({
    type: CreateCbtEntryDto,
    description: 'Данные для создания записи КПТ',
    examples: {
      example1: {
        summary: 'Пример записи КПТ',
        value: {
          situation: 'Опоздал на важную встречу из-за пробок',
          thoughts: [
            {
              thought: 'Я полный неудачник, всегда все порчу',
              is_automatic: true,
              intensity: 8,
              emotions: [
                {
                  emotion_id: 1,
                  intensity: 7,
                },
              ],
              cognitive_distortions: [
                {
                  type: 'catastrophizing',
                  note: 'Преувеличение негативных последствий',
                },
              ],
            },
          ],
          reactions:
            'Извинился перед коллегами, объяснил ситуацию, перенес встречу',
          mood_score_before: 3,
          tags: ['работа', 'стресс'],
        },
      },
    },
  })
  @SwaggerResponse({
    status: 201,
    description: 'Запись КПТ успешно создана',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          userId: 'user-uuid',
          entryDate: '2024-01-01T10:00:00Z',
          situation: 'Опоздал на важную встречу из-за пробок',
          thoughts: [],
          reactions: 'Извинился перед коллегами...',
          moodScoreBefore: 3,
          tags: ['работа', 'стресс'],
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z',
        },
      },
    },
  })
  @SwaggerResponse({
    status: 400,
    description: 'Неверные данные',
  })
  async createEntry(
    @Req() req: Request,
    @Body() createCbtEntryDto: CreateCbtEntryDto,
  ): Promise<ApiResponse<CbtEntryResponseDto>> {
    const userId = this.extractUserId(req);

    const entry = await this.cbtService.createEntry(userId, createCbtEntryDto);

    return createApiResponse(entry, req.url);
  }

  @Get('entries')
  @ApiOperation({
    summary: 'Получить записи КПТ пользователя',
    description:
      'Возвращает список записей КПТ с поддержкой фильтрации и пагинации.',
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
    description: 'Количество записей на странице',
    example: 20,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Дата начала периода (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Дата окончания периода (YYYY-MM-DD)',
    example: '2024-01-31',
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    description: 'Фильтр по тегам',
    type: [String],
    example: ['работа', 'стресс'],
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Поиск по тексту',
    example: 'встреча',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Список записей КПТ',
    schema: {
      example: {
        success: true,
        data: [],
        metadata: {
          page: 1,
          limit: 20,
          total: 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
    },
  })
  async findAllEntries(
    @Req() req: Request,
    @Query() query: CbtEntryQueryDto,
  ): Promise<PaginatedResponse<CbtEntryResponseDto>> {
    const userId = this.extractUserId(req);

    const result = await this.cbtService.findAllByUser(userId, query);

    return createPaginatedResponse(result.data, result.metadata, req.url);
  }

  @Get('entries/:id')
  @ApiOperation({
    summary: 'Получить запись КПТ по ID',
    description: 'Возвращает детальную информацию о записи КПТ.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID записи КПТ',
    example: 'uuid',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Запись КПТ найдена',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Запись не найдена',
  })
  async findOneEntry(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ApiResponse<CbtEntryResponseDto>> {
    const userId = this.extractUserId(req);

    const entry = await this.cbtService.findOneByUser(userId, id);

    return createApiResponse(entry, req.url);
  }

  @Patch('entries/:id')
  @ApiOperation({
    summary: 'Обновить запись КПТ',
    description: 'Обновляет существующую запись КПТ.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID записи КПТ',
    example: 'uuid',
  })
  @ApiBody({
    type: UpdateCbtEntryDto,
    description: 'Данные для обновления записи КПТ',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Запись КПТ успешно обновлена',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Запись не найдена',
  })
  async updateEntry(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateCbtEntryDto: UpdateCbtEntryDto,
  ): Promise<ApiResponse<CbtEntryResponseDto>> {
    const userId = this.extractUserId(req);

    const entry = await this.cbtService.updateEntry(
      userId,
      id,
      updateCbtEntryDto,
    );

    return createApiResponse(entry, req.url);
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить запись КПТ',
    description: 'Удаляет запись КПТ по ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID записи КПТ',
    example: 'uuid',
  })
  @SwaggerResponse({
    status: 204,
    description: 'Запись КПТ успешно удалена',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Запись не найдена',
  })
  async deleteEntry(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<void> {
    const userId = this.extractUserId(req);

    await this.cbtService.deleteEntry(userId, id);
  }

  @Get('entries/tags/all')
  @ApiOperation({
    summary: 'Получить все теги пользователя',
    description:
      'Возвращает список всех уникальных тегов, используемых пользователем в записях.',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Список тегов',
    schema: {
      example: {
        success: true,
        data: ['работа', 'стресс', 'отношения', 'здоровье'],
      },
    },
  })
  async getUserTags(@Req() req: Request): Promise<ApiResponse<string[]>> {
    const userId = this.extractUserId(req);

    const tags = await this.cbtService.getEntryTags(userId);

    return createApiResponse(tags, req.url);
  }

  @Patch('entries/:id/mood-after')
  @ApiOperation({
    summary: 'Обновить настроение после записи',
    description: 'Обновляет оценку настроения после работы с записью КПТ.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID записи КПТ',
    example: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        moodScoreAfter: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Оценка настроения после (1-10)',
          example: 7,
        },
      },
      required: ['moodScoreAfter'],
    },
  })
  @SwaggerResponse({
    status: 200,
    description: 'Настроение успешно обновлено',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Запись не найдена',
  })
  async updateMoodAfter(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('moodScoreAfter') moodScoreAfter: number,
  ): Promise<ApiResponse<CbtEntryResponseDto>> {
    const userId = this.extractUserId(req);

    const entry = await this.cbtService.updateMoodAfter(
      userId,
      id,
      moodScoreAfter,
    );

    return createApiResponse(entry, req.url);
  }
}
