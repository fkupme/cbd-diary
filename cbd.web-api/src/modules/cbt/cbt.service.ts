import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeThoughts } from '../../common/helpers/thoughts.helper';
import { PaginationMetadata } from '../../common/types/api-response.type';
import { PrismaService } from '../../database/prisma.service';
import {
  CbtEntryQueryDto,
  CbtEntryResponseDto,
  CreateCbtEntryDto,
  UpdateCbtEntryDto,
} from './dto/cbt-entry.dto';

interface PaginatedResult<T> {
  data: T[];
  metadata: PaginationMetadata;
}

@Injectable()
export class CbtService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntry(
    userId: string,
    data: CreateCbtEntryDto,
  ): Promise<CbtEntryResponseDto> {
    try {
      // Если дата не передана, используем текущую
      const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();

      const entry = await this.prisma.cbtEntry.create({
        data: {
          userId,
          entryDate,
          situation: data.situation,
          thoughts: normalizeThoughts(data.thoughts) as unknown as Prisma.JsonArray,
          reactions: data.reactions,
          moodScoreBefore: data.mood_score_before,
          moodScoreAfter: data.mood_score_after,
          entryDurationMinutes: data.entry_duration_minutes,
          tags: data.tags || [],
        },
      });

      return this.mapToResponseDto(entry);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException('Неверные данные для создания записи');
      }
      throw error;
    }
  }

  async findAllByUser(
    userId: string,
    query: CbtEntryQueryDto,
  ): Promise<PaginatedResult<CbtEntryResponseDto>> {
    const {
      page = 1,
      limit,
      startDate,
      endDate,
      tags,
      minMoodScore,
      maxMoodScore,
      search,
    } = query as any;

    // Построение условий фильтрации
    const where: Prisma.CbtEntryWhereInput = {
      userId,
    };

    // Фильтр по дате
    if (startDate || endDate) {
      where.entryDate = {} as any;
      if (startDate) {
        (where.entryDate as any).gte = new Date(startDate);
      }
      if (endDate) {
        (where.entryDate as any).lte = new Date(endDate);
      }
    }

    // Фильтр по тегам - используем array_contains для JSON
    if (tags && tags.length > 0) {
      (where as any).tags = {
        path: ['$'],
        array_contains: tags,
      } as any;
    }

    // Фильтр по настроению
    if (minMoodScore !== undefined || maxMoodScore !== undefined) {
      const moodConditions: Prisma.CbtEntryWhereInput[] = [];

      if (minMoodScore !== undefined) {
        moodConditions.push({
          moodScoreBefore: { gte: minMoodScore },
        });
      }

      if (maxMoodScore !== undefined) {
        moodConditions.push({
          moodScoreBefore: { lte: maxMoodScore },
        });
      }

      if (moodConditions.length > 0) {
        (where as any).AND = moodConditions;
      }
    }

    // Безлимитный режим: если limit не указан или <=0
    if (!limit || Number(limit) <= 0) {
      const entries = await this.prisma.cbtEntry.findMany({
        where,
        orderBy: { entryDate: 'desc' },
        include: { chat: { select: { id: true } } } as any,
      });
      const mappedEntries = entries.map((entry) =>
        this.mapToResponseDto(entry),
      );
      const total = mappedEntries.length;
      const metadata: PaginationMetadata = {
        page: 1,
        limit: total,
        total,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
      return { data: mappedEntries, metadata };
    }

    const numericLimit = Number(limit);
    const skip = (page - 1) * numericLimit;

    // Получаем записи и общее количество
    const [entries, total] = await Promise.all([
      this.prisma.cbtEntry.findMany({
        where,
        skip,
        take: numericLimit,
        orderBy: { entryDate: 'desc' },
        include: { chat: { select: { id: true } } } as any,
      }),
      this.prisma.cbtEntry.count({ where }),
    ]);

    const mappedEntries = entries.map((entry) => this.mapToResponseDto(entry));

    const metadata: PaginationMetadata = {
      page,
      limit: numericLimit,
      total,
      totalPages: Math.ceil(total / numericLimit),
      hasNext: page * numericLimit < total,
      hasPrev: page > 1,
    };

    return {
      data: mappedEntries,
      metadata,
    };
  }

  async findOneByUser(
    userId: string,
    entryId: string,
  ): Promise<CbtEntryResponseDto> {
    const entry = await this.prisma.cbtEntry.findFirst({
      where: {
        id: entryId,
        userId,
      },
      include: { chat: { select: { id: true } } } as any,
    });

    if (!entry) {
      throw new NotFoundException('Запись не найдена');
    }

    return this.mapToResponseDto(entry);
  }

  async updateEntry(
    userId: string,
    entryId: string,
    data: UpdateCbtEntryDto,
  ): Promise<CbtEntryResponseDto> {
    // Проверяем, что запись принадлежит пользователю
    const existingEntry = await this.prisma.cbtEntry.findFirst({
      where: {
        id: entryId,
        userId,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException('Запись не найдена');
    }

    try {
      const updateData: Prisma.CbtEntryUpdateInput = {};

      if (data.entryDate) {
        updateData.entryDate = new Date(data.entryDate);
      }
      if (data.situation) {
        updateData.situation = data.situation;
      }
      if (data.thoughts) {
        updateData.thoughts = normalizeThoughts(
          data.thoughts,
        ) as unknown as Prisma.JsonArray;
      }
      if (data.reactions) {
        updateData.reactions = data.reactions;
      }
      if (data.mood_score_before !== undefined) {
        updateData.moodScoreBefore = data.mood_score_before;
      }
      if (data.mood_score_after !== undefined) {
        updateData.moodScoreAfter = data.mood_score_after;
      }
      if (data.entry_duration_minutes !== undefined) {
        updateData.entryDurationMinutes = data.entry_duration_minutes;
      }
      if (data.tags) {
        updateData.tags = data.tags;
      }

      const entry = await this.prisma.cbtEntry.update({
        where: { id: entryId },
        data: updateData,
      });

      return this.mapToResponseDto(entry);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException('Неверные данные для обновления записи');
      }
      throw error;
    }
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    // Проверяем, что запись принадлежит пользователю
    const existingEntry = await this.prisma.cbtEntry.findFirst({
      where: {
        id: entryId,
        userId,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException('Запись не найдена');
    }

    await this.prisma.cbtEntry.delete({
      where: { id: entryId },
    });
  }

  async getEntriesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CbtEntryResponseDto[]> {
    const entries = await this.prisma.cbtEntry.findMany({
      where: {
        userId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { entryDate: 'asc' },
    });

    return entries.map((entry) => this.mapToResponseDto(entry));
  }

  async getEntryTags(userId: string): Promise<string[]> {
    const entries = await this.prisma.cbtEntry.findMany({
      where: { userId },
      select: { tags: true },
    });

    // Собираем все уникальные теги
    const allTags = entries.flatMap((entry) => {
      const tags = entry.tags as string[];
      return Array.isArray(tags) ? tags : [];
    });

    return [...new Set(allTags)].sort();
  }

  async updateMoodAfter(
    userId: string,
    entryId: string,
    moodScoreAfter: number,
  ): Promise<CbtEntryResponseDto> {
    const existingEntry = await this.prisma.cbtEntry.findFirst({
      where: {
        id: entryId,
        userId,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException('Запись не найдена');
    }

    const entry = await this.prisma.cbtEntry.update({
      where: { id: entryId },
      data: { moodScoreAfter },
    });

    return this.mapToResponseDto(entry);
  }

  // Приватный метод для маппинга данных из БД в DTO
  private mapToResponseDto(entry: any): CbtEntryResponseDto {
    return {
      id: entry.id,
      userId: entry.userId,
      entryDate: entry.entryDate,
      situation: entry.situation,
      thoughts: entry.thoughts as any,
      reactions: entry.reactions,
      moodScoreBefore: entry.moodScoreBefore,
      moodScoreAfter: entry.moodScoreAfter,
      entryDurationMinutes: entry.entryDurationMinutes,
      tags: (entry.tags as string[]) || [],
      aiAnalysis: entry.aiAnalysis as any,
      isSynced: entry.isSynced,
      chatId: entry.chat?.id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
