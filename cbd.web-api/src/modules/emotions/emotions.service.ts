import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationMetadata } from '../../common/types/api-response.type';
import { PrismaService } from '../../database/prisma.service';
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

interface PaginatedResult<T> {
  data: T[];
  metadata: PaginationMetadata;
}

@Injectable()
export class EmotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Переводы name_key -> локализованное имя; при отсутствии перевода
  // клиент получает сам ключ (мобильный словарь умеет переводить ключи сам).
  private async getTranslationsMap(
    keys: string[],
    language: string,
  ): Promise<Map<string, string>> {
    if (!keys.length) return new Map();
    const rows = await this.prisma.translation.findMany({
      where: {
        translationKey: { in: Array.from(new Set(keys)) },
        languageCode: language,
      },
      select: { translationKey: true, translationValue: true },
    });
    return new Map(rows.map((r) => [r.translationKey, r.translationValue]));
  }

  // === EMOTION CATEGORIES ===

  async findAllCategories(
    language = 'ru',
  ): Promise<EmotionCategoryResponseDto[]> {
    const categories = await this.prisma.emotionCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const names = await this.getTranslationsMap(
      categories.map((c) => c.nameKey),
      language,
    );

    return categories.map((category) =>
      this.mapCategoryToResponseDto(category, names),
    );
  }

  async findCategoryById(
    id: number,
    language = 'ru',
  ): Promise<EmotionCategoryResponseDto> {
    const category = await this.prisma.emotionCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Категория эмоций с ID ${id} не найдена`);
    }

    const names = await this.getTranslationsMap([category.nameKey], language);
    return this.mapCategoryToResponseDto(category, names);
  }

  async createCategory(
    createCategoryDto: CreateEmotionCategoryDto,
  ): Promise<EmotionCategoryResponseDto> {
    // Проверяем уникальность nameKey
    const existingCategory = await this.prisma.emotionCategory.findFirst({
      where: { nameKey: createCategoryDto.nameKey },
    });

    if (existingCategory) {
      throw new ConflictException('Категория с таким ключом уже существует');
    }

    const category = await this.prisma.emotionCategory.create({
      data: createCategoryDto,
    });

    return this.mapCategoryToResponseDto(category);
  }

  async updateCategory(
    id: number,
    updateCategoryDto: UpdateEmotionCategoryDto,
  ): Promise<EmotionCategoryResponseDto> {
    const existingCategory = await this.prisma.emotionCategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Категория эмоций с ID ${id} не найдена`);
    }

    // Проверяем уникальность nameKey, если он изменяется
    if (
      updateCategoryDto.nameKey &&
      updateCategoryDto.nameKey !== existingCategory.nameKey
    ) {
      const categoryWithSameName = await this.prisma.emotionCategory.findFirst({
        where: {
          nameKey: updateCategoryDto.nameKey,
          id: { not: id },
        },
      });

      if (categoryWithSameName) {
        throw new ConflictException('Категория с таким ключом уже существует');
      }
    }

    const category = await this.prisma.emotionCategory.update({
      where: { id },
      data: updateCategoryDto,
    });

    return this.mapCategoryToResponseDto(category);
  }

  async deleteCategory(id: number): Promise<void> {
    const category = await this.prisma.emotionCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Категория эмоций с ID ${id} не найдена`);
    }

    // Проверяем, есть ли связанные эмоции
    const emotionsCount = await this.prisma.emotion.count({
      where: { categoryId: id },
    });

    if (emotionsCount > 0) {
      throw new ConflictException(
        'Нельзя удалить категорию, содержащую эмоции',
      );
    }

    await this.prisma.emotionCategory.delete({
      where: { id },
    });
  }

  // === EMOTIONS ===

  async findAllEmotions(
    query: EmotionQueryDto,
  ): Promise<PaginatedResult<EmotionResponseDto>> {
    const {
      page = 1,
      // если limit не передан или <=0 — возвращаем все без пагинации
      limit,
      categoryId,
      isActive = true,
      language = 'ru',
    } = query as any;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Безлимитный режим
    if (!limit || Number(limit) <= 0) {
      const emotions = await this.prisma.emotion.findMany({
        where,
        include: { category: true },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      });
      const names = await this.getTranslationsMap(
        emotions.flatMap((e) => [e.nameKey, e.category?.nameKey ?? '']),
        language,
      );
      const mappedEmotions = emotions.map((emotion) =>
        this.mapEmotionToResponseDto(emotion, names),
      );
      const total = mappedEmotions.length;
      const metadata: PaginationMetadata = {
        page: 1,
        limit: total,
        total,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
      return { data: mappedEmotions, metadata };
    }

    // Пагинация, если явно указан limit
    const numericLimit = Number(limit);
    const skip = (page - 1) * numericLimit;

    const [emotions, total] = await Promise.all([
      this.prisma.emotion.findMany({
        where,
        include: {
          category: true,
        },
        skip,
        take: numericLimit,
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.emotion.count({ where }),
    ]);

    const names = await this.getTranslationsMap(
      emotions.flatMap((e) => [e.nameKey, e.category?.nameKey ?? '']),
      language,
    );
    const mappedEmotions = emotions.map((emotion) =>
      this.mapEmotionToResponseDto(emotion, names),
    );

    const metadata: PaginationMetadata = {
      page,
      limit: numericLimit,
      total,
      totalPages: Math.ceil(total / numericLimit),
      hasNext: page * numericLimit < total,
      hasPrev: page > 1,
    };

    return {
      data: mappedEmotions,
      metadata,
    };
  }

  async findEmotionById(id: number, language = 'ru'): Promise<EmotionResponseDto> {
    const emotion = await this.prisma.emotion.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!emotion) {
      throw new NotFoundException(`Эмоция с ID ${id} не найдена`);
    }

    const names = await this.getTranslationsMap(
      [emotion.nameKey, emotion.category?.nameKey ?? ''],
      language,
    );
    return this.mapEmotionToResponseDto(emotion, names);
  }

  async createEmotion(
    createEmotionDto: CreateEmotionDto,
  ): Promise<EmotionResponseDto> {
    // Проверяем, существует ли категория
    const category = await this.prisma.emotionCategory.findUnique({
      where: { id: createEmotionDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Категория с ID ${createEmotionDto.categoryId} не найдена`,
      );
    }

    // Проверяем уникальность nameKey
    const existingEmotion = await this.prisma.emotion.findFirst({
      where: { nameKey: createEmotionDto.nameKey },
    });

    if (existingEmotion) {
      throw new ConflictException('Эмоция с таким ключом уже существует');
    }

    const emotion = await this.prisma.emotion.create({
      data: createEmotionDto,
      include: {
        category: true,
      },
    });

    return this.mapEmotionToResponseDto(emotion);
  }

  async updateEmotion(
    id: number,
    updateEmotionDto: UpdateEmotionDto,
  ): Promise<EmotionResponseDto> {
    const existingEmotion = await this.prisma.emotion.findUnique({
      where: { id },
    });

    if (!existingEmotion) {
      throw new NotFoundException(`Эмоция с ID ${id} не найдена`);
    }

    // Проверяем категорию, если она изменяется
    if (updateEmotionDto.categoryId) {
      const category = await this.prisma.emotionCategory.findUnique({
        where: { id: updateEmotionDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException(
          `Категория с ID ${updateEmotionDto.categoryId} не найдена`,
        );
      }
    }

    const emotion = await this.prisma.emotion.update({
      where: { id },
      data: updateEmotionDto,
      include: { category: true },
    });

    return this.mapEmotionToResponseDto(emotion);
  }

  async deleteEmotion(id: number): Promise<void> {
    const existing = await this.prisma.emotion.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Эмоция с ID ${id} не найдена`);
    }

    await this.prisma.emotion.delete({ where: { id } });
  }

  // === HELPERS FOR CATEGORY LOOKUP ===
  async getCategoryByEmotionId(emotionId: number): Promise<number | null> {
    const emotion = await this.prisma.emotion.findUnique({
      where: { id: emotionId },
      select: { id: true, categoryId: true },
    });
    return emotion ? emotion.categoryId : null;
  }

  async getCategoryIdsByEmotionIds(
    emotionIds: number[],
  ): Promise<Map<number, number>> {
    if (!emotionIds.length) return new Map();
    const uniqueIds = Array.from(new Set(emotionIds));
    const rows = await this.prisma.emotion.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, categoryId: true },
    });
    return new Map(rows.map((r) => [r.id, r.categoryId]));
  }

  // === MAPPERS ===
  private mapCategoryToResponseDto(
    category: any,
    names?: Map<string, string>,
  ): EmotionCategoryResponseDto {
    return {
      id: category.id,
      nameKey: category.nameKey,
      name: names?.get(category.nameKey) ?? category.nameKey,
      color: category.color,
      icon: category.icon || undefined,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }

  private mapEmotionToResponseDto(
    emotion: any,
    names?: Map<string, string>,
  ): EmotionResponseDto {
    return {
      id: emotion.id,
      categoryId: emotion.categoryId,
      nameKey: emotion.nameKey,
      name: names?.get(emotion.nameKey) ?? emotion.nameKey,
      emoji: emotion.emoji,
      intensityDefault: emotion.intensityDefault,
      synonyms: Array.isArray(emotion.synonyms) ? emotion.synonyms : [],
      oppositeEmotionId: emotion.oppositeEmotionId || null,
      sortOrder: emotion.sortOrder,
      isActive: emotion.isActive,
      createdAt: emotion.createdAt,
      category: emotion.category
        ? {
            id: emotion.category.id,
            nameKey: emotion.category.nameKey,
            name: names?.get(emotion.category.nameKey) ?? emotion.category.nameKey,
            color: emotion.category.color,
            icon: emotion.category.icon || undefined,
          }
        : undefined,
    };
  }
}
