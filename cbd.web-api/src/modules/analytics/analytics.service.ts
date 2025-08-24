import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmotionsService } from '../emotions/emotions.service';
import {
  AiSessionsMetricsDto,
  AnalyticsQueryDto,
  AnalyticsSummaryDto,
  AnalyticsTimeRange,
  CategoryDiversityDto,
  CognitiveInsightsDto,
  EmotionAnalyticsDto,
  EntriesTimelinePointDto,
  MoodTrendsDto,
  ProgressReportDto,
  UserStatsResponseDto,
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emotionsService: EmotionsService,
  ) {}
  private readonly logger = new Logger(AnalyticsService.name);

  // Возвращает числовой ID эмоции из произвольной JSON-структуры эмоции
  private getEmotionIdFromJson(em: any): number | null {
    if (typeof em === 'number') return Number.isFinite(em) ? em : null;
    if (typeof em === 'string') {
      const asNum = Number(em);
      return Number.isFinite(asNum) ? asNum : null;
    }
    const raw = em?.emotionId ?? em?.emotion_id ?? em?.id;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }

  // Возвращает nameKey эмоции, если он есть в JSON
  private getEmotionNameKeyFromJson(em: any): string | null {
    if (typeof em === 'string') {
      const key = em.trim();
      return key.length ? key : null;
    }
    const key =
      em?.nameKey ??
      em?.name_key ??
      em?.key ??
      em?.name ??
      em?.emotionName ??
      em?.emotion_name;
    if (typeof key === 'string' && key.trim().length > 0) return key.trim();
    return null;
  }

  // Возвращает числовой ID категории эмоции из JSON, если он есть
  private getCategoryIdFromJson(em: any): number | null {
    if (typeof em === 'number' || typeof em === 'string') return null;
    const raw = em?.categoryId ?? em?.category_id ?? em?.category?.id;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }

  private getLabelFromJson(em: any): string | null {
    const label = (em?.label ??
      em?.title ??
      em?.name ??
      em?.emotionLabel ??
      em?.emotion_label) as any;
    if (typeof label === 'string' && label.trim()) return label.trim();
    return null;
  }

  private guessCategoryKeyByLabel(label: string): string | null {
    const l = label.trim().toLowerCase();
    const anger = [
      'недовольство',
      'раздражение',
      'обида',
      'надменность',
      'отвращение',
      'протест',
      'нетерпение',
      'пренебрежение',
      'зависть',
      'мстительность',
      'враждебность',
      'ярость',
      'злость',
      'бешенство',
      'равнодушие',
      'безучастность',
      'неистовость',
      'цинизм',
      'высокомерие',
      'сарказм',
      'злорадство',
      'неприязнь',
    ];
    const fear = [
      'опасение',
      'неуверенность',
      'беспокойство',
      'тревога',
      'ужас',
      'паника',
      'испуг',
      'настороженность',
      'робость',
      'застенчивость',
    ];
    const sadness = [
      'подавленность',
      'огорчение',
      'печаль',
      'скука',
      'тоска',
      'унижение',
      'отвержение',
      'жалость к себе',
      'скорбь',
      'отчаяние',
      'боль',
      'одиночество',
      'отчуждение',
      'разочарование',
      'поражение',
      'апатия',
      'примирение',
    ];
    const joy = [
      'любовь',
      'обожание',
      'умиротворение',
      'веселье',
      'воодушевление',
      'лёгкость',
      'легкость',
      'восторг',
      'радость',
      'благодарность',
      'надежда',
      'уверенность',
      'облегчение',
      'удовлетворение',
      'доверие',
    ];
    const shame = [
      'стыд',
      'вина',
      'раскаяние',
      'смущение',
      'позор',
      'нечестность',
      'угрызение совести',
      'стеснение',
      'неловкость',
      'похоть',
      'ущербность',
      'растерянность',
      'обман',
      'потеря лица',
      'сожаление',
      'расщепление',
      'озабоченность',
      'брошенность',
      'замкнутость',
      'угрюмость',
      'угнетённость',
      'угнетенность',
      'пассивность',
      'отвержение',
    ];

    if (anger.includes(l)) return 'emotion_category.anger';
    if (fear.includes(l)) return 'emotion_category.fear';
    if (sadness.includes(l)) return 'emotion_category.sadness';
    if (joy.includes(l)) return 'emotion_category.joy';
    if (shame.includes(l)) return 'emotion_category.shame';
    return null;
  }

  private extractCategoryKeyFromNameKey(nameKey: string): string | null {
    if (!nameKey) return null;
    const k = nameKey.trim();
    if (k.startsWith('emotion_category.')) return k;
    if (k.startsWith('emotion.')) {
      const parts = k.split('.');
      if (parts.length >= 2) {
        const cat = parts[1];
        const allowed = new Set(['anger', 'fear', 'sadness', 'joy', 'shame']);
        if (allowed.has(cat)) return `emotion_category.${cat}`;
      }
    }
    const bare = k.toLowerCase();
    const allowed = new Set(['anger', 'fear', 'sadness', 'joy', 'shame']);
    if (allowed.has(bare)) return `emotion_category.${bare}`;
    return null;
  }

  async getUserStats(userId: string): Promise<UserStatsResponseDto> {
    // Если пользователя нет — возвращаем пустую статистику, без upsert
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return {
        userId,
        totalEntries: 0,
        currentStreakDays: 0,
        longestStreakDays: 0,
        avgMoodScore: 0,
        mostCommonEmotionId: undefined,
        entriesThisWeek: 0,
        entriesThisMonth: 0,
        lastCalculatedAt: new Date(),
        mostCommonEmotion: undefined,
        moodTrend: { direction: 'stable', change: 0 },
        weeklyActivity: [],
      };
    }

    // Получаем базовую статистику пользователя
    let userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) {
      // Если статистика не существует, пытаемся создать, но не роняем при ошибке
      try {
        userStats = await this.calculateAndSaveUserStats(userId);
      } catch {
        userStats = {
          userId,
          totalEntries: 0,
          currentStreakDays: 0,
          longestStreakDays: 0,
          avgMoodScore: 0,
          mostCommonEmotionId: null,
          entriesThisWeek: 0,
          entriesThisMonth: 0,
          lastCalculatedAt: new Date(),
        } as any;
      }
    }

    // Получаем дополнительную информацию
    const [mostCommonEmotion, moodTrend, weeklyActivity] = await Promise.all([
      this.getMostCommonEmotion(userId),
      this.calculateMoodTrend(userId),
      this.getWeeklyActivity(userId),
    ]);

    return {
      userId: userStats.userId,
      totalEntries: userStats.totalEntries,
      currentStreakDays: userStats.currentStreakDays,
      longestStreakDays: userStats.longestStreakDays,
      avgMoodScore: userStats.avgMoodScore,
      mostCommonEmotionId: userStats.mostCommonEmotionId ?? undefined,
      entriesThisWeek: userStats.entriesThisWeek,
      entriesThisMonth: userStats.entriesThisMonth,
      lastCalculatedAt: userStats.lastCalculatedAt,
      mostCommonEmotion: mostCommonEmotion ?? undefined,
      moodTrend,
      weeklyActivity,
    };
  }

  async getEmotionAnalytics(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<EmotionAnalyticsDto[]> {
    const { startDate, endDate } = this.getDateRange(query);

    const entries = await this.prisma.cbtEntry.findMany({
      where: { userId, entryDate: { gte: startDate, lte: endDate } },
      select: {
        thoughts: true,
        entryDate: true,
        situation: true,
        reactions: true,
      },
    });

    // Подтянем весь справочник эмоций (MVP) и построим резолвер
    const allEmotions = await this.prisma.emotion.findMany({
      include: { category: true },
    });
    const resolveEmotion = this.resolveEmotionFromJsonFactory(allEmotions);

    // Агрегируем данные по эмоциям
    const emotionData = new Map<
      number,
      {
        count: number;
        intensities: number[];
        situations: string[];
        reactions: string[];
        times: Date[];
      }
    >();

    for (const entry of entries) {
      const thoughts = (entry.thoughts as any[]) || [];
      for (const thought of thoughts) {
        if (!Array.isArray(thought?.emotions)) continue;
        for (const em of thought.emotions) {
          const resolved = resolveEmotion(em);
          if (!resolved) continue;
          const emotionId = resolved.id as number;
          if (!emotionData.has(emotionId)) {
            emotionData.set(emotionId, {
              count: 0,
              intensities: [],
              situations: [],
              reactions: [],
              times: [],
            });
          }
          const data = emotionData.get(emotionId)!;
          data.count++;
          const intensity = Number(em.intensity ?? 0);
          if (Number.isFinite(intensity)) data.intensities.push(intensity);
          if (entry.situation) data.situations.push(entry.situation);
          if (entry.reactions) data.reactions.push(entry.reactions);
          data.times.push(entry.entryDate);
        }
      }
    }

    if (emotionData.size === 0) return [];

    const emotionById = new Map<number, any>(allEmotions.map((e) => [e.id, e]));
    const totalEmotionCount = Array.from(emotionData.values()).reduce(
      (sum, d) => sum + d.count,
      0,
    );

    const result: EmotionAnalyticsDto[] = Array.from(emotionData.keys())
      .map((id) => emotionById.get(id))
      .filter(Boolean)
      .map((emotion: any) => {
        const data = emotionData.get(emotion.id)!;
        const avgIntensity = data.intensities.length
          ? data.intensities.reduce((s, v) => s + v, 0) /
            data.intensities.length
          : 0;
        const percentage = (data.count / Math.max(1, totalEmotionCount)) * 100;
        const trend = this.calculateEmotionTrend(userId, emotion.id, query);
        const timePatterns = this.analyzeTimePatterns(data.times);
        const commonSituations = this.findCommonPatterns(data.situations, 3);
        const commonReactions = this.findCommonPatterns(data.reactions, 3);
        return {
          emotionId: emotion.id,
          emotionName: emotion.nameKey,
          emoji: emotion.emoji || '',
          count: data.count,
          percentage: Math.round(percentage * 100) / 100,
          avgIntensity: Math.round(avgIntensity * 100) / 100,
          trend: trend || { direction: 'stable', change: 0 },
          commonSituations,
          commonReactions,
          timePatterns,
        };
      })
      .sort((a, b) => b.count - a.count);

    return result;
  }

  async getMoodTrends(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<MoodTrendsDto> {
    const { startDate, endDate } = this.getDateRange(query);

    // Получаем записи с данными о настроении
    const entries = await this.prisma.cbtEntry.findMany({
      where: {
        userId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
        moodScoreBefore: { not: null },
      },
      select: {
        entryDate: true,
        moodScoreBefore: true,
        moodScoreAfter: true,
      },
      orderBy: { entryDate: 'asc' },
    });

    // Вычисляем общий тренд
    const avgMoodBefore = this.calculateAverage(
      entries.map((e) => e.moodScoreBefore!).filter((n) => n !== null),
    );
    const afterValues = entries
      .map((e) => e.moodScoreAfter)
      .filter((n) => typeof n === 'number') as number[];
    const avgMoodAfter = this.calculateAverage(afterValues);
    const improvement = avgMoodAfter - avgMoodBefore;

    // Сравниваем с предыдущим периодом
    const previousPeriodData = await this.getPreviousPeriodMoodData(
      userId,
      startDate,
      endDate,
    );
    const change =
      avgMoodBefore - (previousPeriodData?.avgMoodBefore ?? avgMoodBefore);
    const direction =
      Math.abs(change) < 0.1 ? 'stable' : change > 0 ? 'up' : 'down';

    // Группируем данные по дням/неделям/месяцам
    const dataPoints = this.groupDataByTimeRange(entries, query.timeRange!);

    // Анализируем паттерны по дням недели/часам
    const weeklyPatterns = this.analyzeWeeklyPatterns(entries);
    const hourlyPatterns = this.analyzeHourlyPatterns(entries);

    return {
      timeRange: query.timeRange!,
      startDate,
      endDate,
      overallTrend: {
        direction,
        change: Math.round(change * 100) / 100,
        avgMoodBefore: Math.round(avgMoodBefore * 100) / 100,
        avgMoodAfter: Math.round(avgMoodAfter * 100) / 100,
        improvement: Math.round(improvement * 100) / 100,
      },
      dataPoints,
      weeklyPatterns,
      hourlyPatterns,
    };
  }

  async getCognitiveInsights(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<CognitiveInsightsDto> {
    const { startDate, endDate } = this.getDateRange(query);

    const entries = await this.prisma.cbtEntry.findMany({
      where: {
        userId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        thoughts: true,
        moodScoreBefore: true,
        moodScoreAfter: true,
      },
      orderBy: { entryDate: 'asc' },
    });

    // Анализируем когнитивные искажения
    const cognitiveDistortions = this.analyzeCognitiveDistortions(entries);

    // Паттерны мыслей
    const thoughtPatterns = this.analyzeThoughtPatterns(entries);

    // Эффективность КПТ
    const cbtEffectiveness = this.calculateCBTEffectiveness(entries);

    return {
      cognitiveDistortions,
      thoughtPatterns,
      cbtEffectiveness,
    };
  }

  async getProgressReport(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<ProgressReportDto> {
    const { startDate, endDate } = this.getDateRange(query);

    const overallProgress = await this.calculateOverallProgress(
      userId,
      startDate,
      endDate,
    );

    const achievements = await this.getUserAchievements(userId);

    const recommendations = await this.generateRecommendations(userId, query);

    const keyMetrics = await this.calculateKeyMetrics(
      userId,
      startDate,
      endDate,
    );

    return {
      timeRange: query.timeRange!,
      startDate,
      endDate,
      overallProgress,
      achievements,
      recommendations,
      keyMetrics,
    };
  }

  async getAnalyticsSummary(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsSummaryDto> {
    const [
      userStats,
      emotionAnalytics,
      moodTrends,
      cognitiveInsights,
      progressReport,
      categoryDiversity,
      entriesTimeline,
      aiSessions,
    ] = await Promise.all([
      this.getUserStats(userId),
      this.getEmotionAnalytics(userId, query),
      this.getMoodTrends(userId, query),
      this.getCognitiveInsights(userId, query),
      this.getProgressReport(userId, query),
      this.getCategoryDiversity(userId, query),
      this.getEntriesTimeline(userId, query),
      this.getAiSessionsMetrics(userId, query),
    ]);

    const dataQuality = this.assessDataQuality(userStats, emotionAnalytics);

    return {
      userStats,
      emotionAnalytics,
      moodTrends,
      cognitiveInsights,
      progressReport,
      categoryDiversity,
      entriesTimeline,
      aiSessions,
      generatedAt: new Date(),
      dataQuality,
    };
  }

  async updateUserStats(userId: string): Promise<UserStatsResponseDto> {
    await this.calculateAndSaveUserStats(userId);
    return this.getUserStats(userId);
  }

  // ==== Дополнительные агрегаты для сводки ====
  private async getCategoryDiversity(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<CategoryDiversityDto> {
    const { startDate, endDate } = this.getDateRange(query);

    const entries = await this.prisma.cbtEntry.findMany({
      where: { userId, entryDate: { gte: startDate, lte: endDate } },
      select: { thoughts: true },
    });

    const categoryCounts = new Map<number, number>();
    let unknownCount = 0;

    // Категории для финального имени
    const categories = await this.prisma.emotionCategory.findMany({
      select: { id: true, nameKey: true },
    });
    const categoryIdByKeyAll = new Map<string, number>(
      categories.map((c) => [c.nameKey, c.id]) as [string, number][],
    );

    // Справочник эмоций (для резолвинга по nameKey/синонимам)
    const allEmotions = await this.prisma.emotion.findMany({
      include: { category: true },
    });
    const resolveEmotion = this.resolveEmotionFromJsonFactory(allEmotions);

    let viaId = 0;
    let viaCategoryId = 0;
    let viaNameKeyCat = 0;
    let viaLabel = 0;
    let totalEmotions = 0;

    // Сначала соберём все emotionId из записей
    const collectedIds: number[] = [];
    for (const e of entries) {
      const thoughts = (e.thoughts as any[]) || [];
      for (const t of thoughts) {
        if (!Array.isArray(t?.emotions)) continue;
        for (const em of t.emotions) {
          totalEmotions += 1;
          const eid = this.getEmotionIdFromJson(em);
          if (eid !== null) collectedIds.push(eid);
        }
      }
    }

    // Разрешим найденные id => categoryId одним запросом
    const idToCat =
      await this.emotionsService.getCategoryIdsByEmotionIds(collectedIds);

    for (const e of entries) {
      const thoughts = (e.thoughts as any[]) || [];
      for (const t of thoughts) {
        if (!Array.isArray(t?.emotions)) continue;
        for (const em of t.emotions) {
          const eid = this.getEmotionIdFromJson(em);
          if (eid !== null && idToCat.has(eid)) {
            const catId = idToCat.get(eid)!;
            categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);
            viaId += 1;
            continue;
          }

          // Попробуем резолв по справочнику (nameKey/synonyms)
          const resolved = resolveEmotion(em);
          if (resolved) {
            const catId = resolved.categoryId as number;
            categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);
            viaId += 1;
            continue;
          }

          const fallbackCat = this.getCategoryIdFromJson(em);
          if (fallbackCat !== null) {
            categoryCounts.set(
              fallbackCat,
              (categoryCounts.get(fallbackCat) ?? 0) + 1,
            );
            viaCategoryId += 1;
            continue;
          }
          const eNameKey = this.getEmotionNameKeyFromJson(em);
          if (eNameKey) {
            const catKeyFromName = this.extractCategoryKeyFromNameKey(eNameKey);
            if (catKeyFromName && categoryIdByKeyAll.has(catKeyFromName)) {
              const catId = categoryIdByKeyAll.get(catKeyFromName)!;
              categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);
              viaNameKeyCat += 1;
              continue;
            }
          }
          const label = this.getLabelFromJson(em);
          if (label) {
            const catKey = this.guessCategoryKeyByLabel(label);
            if (catKey && categoryIdByKeyAll.has(catKey)) {
              const catId = categoryIdByKeyAll.get(catKey)!;
              categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);
              viaLabel += 1;
              continue;
            }
          }
          unknownCount += 1;
        }
      }
    }

    this.logger.log(
      `CategoryDiversity: emotions=${totalEmotions}, viaId=${viaId}, viaCategoryId=${viaCategoryId}, viaNameKeyCat=${viaNameKeyCat}, viaLabel=${viaLabel}, unknown=${unknownCount}`,
    );

    const total =
      Array.from(categoryCounts.values()).reduce((a, b) => a + b, 0) +
      unknownCount;
    if (total === 0) {
      return {
        uniqueCategories: 0,
        shannon: 0,
        simpson: 0,
        evenness: 0,
        distribution: [],
      };
    }

    const distribution = Array.from(categoryCounts.entries()).map(
      ([catId, count]) => {
        const category = categories.find((c) => c.id === catId);
        const categoryName = category?.nameKey ?? String(catId);
        const percentage = (count / total) * 100;
        return {
          categoryId: catId,
          categoryName,
          color: undefined,
          count,
          percentage: Math.round(percentage * 100) / 100,
        };
      },
    );

    if (unknownCount > 0) {
      distribution.push({
        categoryId: 0,
        categoryName: 'emotion_category.unknown',
        color: undefined,
        count: unknownCount,
        percentage: Math.round((unknownCount / total) * 100 * 100) / 100,
      });
    }

    distribution.sort((a, b) => b.count - a.count);

    this.logger.debug(
      `CategoryDiversity distribution: ${JSON.stringify(distribution)}`,
    );

    const p = distribution.map((d) => d.count / total);
    const shannon = -p.reduce(
      (sum, pi) => (pi > 0 ? sum + pi * Math.log(pi) : sum),
      0,
    );
    const simpson = 1 - p.reduce((sum, pi) => sum + pi * pi, 0);
    const uniqueCategories = distribution.length;
    const evenness =
      uniqueCategories > 1 ? shannon / Math.log(uniqueCategories) : 0;

    return {
      uniqueCategories,
      shannon: Math.round(shannon * 1000) / 1000,
      simpson: Math.round(simpson * 1000) / 1000,
      evenness: Math.round(evenness * 1000) / 1000,
      distribution,
    };
  }

  private async getEntriesTimeline(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<EntriesTimelinePointDto[]> {
    const { startDate, endDate } = this.getDateRange(query);

    const rows = await this.prisma.$queryRawUnsafe<
      {
        d: string;
        c: number;
      }[]
    >(
      `SELECT to_char(entry_date::date, 'YYYY-MM-DD') as d, COUNT(*) as c
       FROM cbt_entries
       WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
       GROUP BY 1
       ORDER BY 1 ASC`,
      userId,
      startDate,
      endDate,
    );

    return rows.map((r) => ({ date: r.d, entriesCount: Number(r.c) }));
  }

  private async getAiSessionsMetrics(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AiSessionsMetricsDto> {
    const { startDate, endDate } = this.getDateRange(query);

    const chats = await (this.prisma as any).chat.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        createdAt: true,
        messages: {
          select: { id: true, role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        finalization: {
          select: { outcome: true, endedAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const dayMap = new Map<string, { sessions: number; successes: number }>();
    let totalLengthMinutes = 0;
    let totalAiMessages = 0;
    let endedSessions = 0;
    let successSessions = 0;

    for (const chat of chats as any[]) {
      const d = chat.createdAt.toISOString().slice(0, 10);
      const byDay = dayMap.get(d) ?? { sessions: 0, successes: 0 };
      byDay.sessions += 1;

      const aiMsgs = (chat.messages as any[]).filter((m) => m.role === 'AI');
      totalAiMessages += aiMsgs.length;

      const hasFinal = Boolean(chat.finalization);
      if (hasFinal) endedSessions += 1;
      const isSuccess =
        hasFinal &&
        ['agreed', 'partially_agreed'].includes(
          (chat.finalization as any)?.outcome || '',
        );
      if (isSuccess) {
        successSessions += 1;
        byDay.successes += 1;
      }

      const endTs: Date =
        (chat.finalization as any)?.endedAt ||
        (chat.messages as any[])[(chat.messages as any[]).length - 1]
          ?.createdAt ||
        chat.createdAt;
      const lengthMin = Math.max(
        0,
        (endTs.getTime() - chat.createdAt.getTime()) / 60000,
      );
      totalLengthMinutes += lengthMin;

      dayMap.set(d, byDay);
    }

    const totalSessions = chats.length;
    const successRate = totalSessions
      ? (successSessions / totalSessions) * 100
      : 0;
    const byDay = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        sessions: v.sessions,
        successes: v.successes,
      }));

    return {
      totalSessions,
      endedSessions,
      successRate: Math.round(successRate * 10) / 10,
      averageLengthMinutes: totalSessions
        ? Math.round((totalLengthMinutes / totalSessions) * 10) / 10
        : 0,
      averageAiMessages: totalSessions
        ? Math.round((totalAiMessages / totalSessions) * 10) / 10
        : 0,
      byDay,
    };
  }

  // ==== Базовые расчёты/утилиты ====
  private async calculateAndSaveUserStats(userId: string) {
    // проверим наличие пользователя
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // если нет пользователя, не пишем в user_stats
      return {
        userId,
        totalEntries: 0,
        currentStreakDays: 0,
        longestStreakDays: 0,
        avgMoodScore: 0,
        mostCommonEmotionId: null,
        entriesThisWeek: 0,
        entriesThisMonth: 0,
        lastCalculatedAt: new Date(),
      } as any;
    }

    const totalEntries = await this.prisma.cbtEntry.count({
      where: { userId },
    });

    const { currentStreak, longestStreak } =
      await this.calculateStreaks(userId);

    const avgMoodResult = await this.prisma.cbtEntry.aggregate({
      where: { userId, moodScoreBefore: { not: null } },
      _avg: { moodScoreBefore: true },
    });

    const mostCommonEmotionId = await this.findMostCommonEmotionId(userId);

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [entriesThisWeek, entriesThisMonth] = await Promise.all([
      this.prisma.cbtEntry.count({
        where: { userId, entryDate: { gte: startOfWeek } },
      }),
      this.prisma.cbtEntry.count({
        where: { userId, entryDate: { gte: startOfMonth } },
      }),
    ]);

    const statsData = {
      totalEntries,
      currentStreakDays: currentStreak,
      longestStreakDays: longestStreak,
      avgMoodScore: avgMoodResult._avg.moodScoreBefore || 0,
      mostCommonEmotionId,
      entriesThisWeek,
      entriesThisMonth,
      lastCalculatedAt: new Date(),
    };

    return this.prisma.userStats.upsert({
      where: { userId },
      update: statsData,
      create: { userId, ...statsData },
    });
  }

  private getDateRange(query: AnalyticsQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date();

    switch (query.timeRange) {
      case AnalyticsTimeRange.WEEK:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case AnalyticsTimeRange.MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case AnalyticsTimeRange.QUARTER: {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      }
      case AnalyticsTimeRange.YEAR:
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case AnalyticsTimeRange.CUSTOM:
        startDate = query.startDate ? new Date(query.startDate) : new Date(0);
        endDate = query.endDate ? new Date(query.endDate) : new Date();
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // нормализуем границы
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  private calculateAverage(numbers: number[]): number {
    if (!numbers.length) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private async calculateStreaks(
    userId: string,
  ): Promise<{ currentStreak: number; longestStreak: number }> {
    const entries = await this.prisma.cbtEntry.findMany({
      where: { userId },
      select: { entryDate: true },
      orderBy: { entryDate: 'desc' },
    });

    if (entries.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const entryDays = new Set(entries.map((e) => e.entryDate.toDateString()));

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date();
    let checkDate = new Date(today);

    while (entryDays.has(checkDate.toDateString())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const sorted = Array.from(entryDays).sort();
    let prev: Date | null = null;
    for (const dayStr of sorted) {
      const cur = new Date(dayStr);
      if (prev) {
        const diffDays = Math.floor(
          (cur.getTime() - prev.getTime()) / 86400000,
        );
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      prev = cur;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { currentStreak, longestStreak };
  }

  private async getMostCommonEmotion(userId: string) {
    const id = await this.findMostCommonEmotionId(userId);
    if (!id) return null;
    const [count, emotion] = await Promise.all([
      this.prisma.cbtEntry
        .findMany({
          where: { userId },
          select: { thoughts: true },
        })
        .then((rows) => {
          let c = 0;
          for (const r of rows) {
            const thoughts = (r.thoughts as any[]) || [];
            for (const t of thoughts) {
              if (Array.isArray(t?.emotions)) {
                for (const e of t.emotions) {
                  const eid = this.getEmotionIdFromJson(e);
                  if (eid === id) c++;
                }
              }
            }
          }
          return c;
        }),
      this.prisma.emotion.findUnique({
        where: { id },
        select: { id: true, nameKey: true, emoji: true },
      }),
    ]);
    return emotion
      ? {
          id: emotion.id,
          name: emotion.nameKey,
          emoji: emotion.emoji ?? '',
          count,
        }
      : null;
  }

  private async calculateMoodTrend(userId: string) {
    // Берём последние 30 записей и считаем линейное изменение среднего
    const rows = await this.prisma.cbtEntry.findMany({
      where: { userId, moodScoreBefore: { not: null } },
      select: { moodScoreBefore: true, entryDate: true },
      orderBy: { entryDate: 'desc' },
      take: 30,
    });
    if (!rows.length) return { direction: 'stable' as const, change: 0 };
    const first = rows[rows.length - 1].moodScoreBefore || 0;
    const last = rows[0].moodScoreBefore || 0;
    const change = last - first;
    const direction =
      Math.abs(change) < 0.1
        ? ('stable' as const)
        : change > 0
          ? ('up' as const)
          : ('down' as const);
    return { direction, change: Math.round(change * 100) / 100 };
  }

  private async getWeeklyActivity(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      {
        d: string;
        c: number;
        avg: number;
      }[]
    >(
      `SELECT to_char(entry_date::date, 'YYYY-MM-DD') as d,
              COUNT(*) as c,
              COALESCE(AVG(mood_score_before), 0) as avg
       FROM cbt_entries
       WHERE user_id = $1 AND entry_date >= (now() - interval '7 days')
       GROUP BY 1
       ORDER BY 1 ASC`,
      userId,
    );
    return rows.map((r) => ({
      date: r.d,
      entriesCount: Number(r.c),
      avgMoodScore: Number(r.avg),
    }));
  }

  private calculateEmotionTrend(
    userId: string,
    emotionId: number,
    query: AnalyticsQueryDto,
  ) {
    // Пока заглушка: для MVP считаем стабильным
    return { direction: 'stable' as const, change: 0 };
  }

  private analyzeTimePatterns(times: Date[]) {
    const buckets = new Map<number, number>();
    for (const t of times) {
      const h = new Date(t).getHours();
      buckets.set(h, (buckets.get(h) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, count]) => ({ hour, count }));
  }

  private findCommonPatterns(texts: string[], limit: number) {
    const map = new Map<string, number>();
    for (const t of texts) {
      if (!t) continue;
      const key = t.trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([text]) => text);
  }

  private async getPreviousPeriodMoodData(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const diff = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - diff);
    const prevEnd = new Date(endDate.getTime() - diff);
    const rows = await this.prisma.cbtEntry.findMany({
      where: {
        userId,
        entryDate: { gte: prevStart, lte: prevEnd },
        moodScoreBefore: { not: null },
      },
      select: { moodScoreBefore: true },
    });
    const avgMoodBefore = this.calculateAverage(
      rows.map((r) => r.moodScoreBefore!).filter((n) => n !== null),
    );
    return { avgMoodBefore };
  }

  private groupDataByTimeRange(entries: any[], timeRange: AnalyticsTimeRange) {
    const byKey = new Map<string, { before: number[]; after: number[] }>();
    const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

    for (const e of entries) {
      const dt = new Date(e.entryDate);
      let key = '';
      if (
        timeRange === AnalyticsTimeRange.WEEK ||
        timeRange === AnalyticsTimeRange.MONTH ||
        timeRange === AnalyticsTimeRange.CUSTOM
      ) {
        key = fmtDay(dt);
      } else if (timeRange === AnalyticsTimeRange.QUARTER) {
        const ym = `${dt.getFullYear()}-${String(Math.floor(dt.getMonth() / 3) + 1).padStart(2, '0')}`;
        key = ym;
      } else if (timeRange === AnalyticsTimeRange.YEAR) {
        const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        key = ym;
      } else {
        key = fmtDay(dt);
      }
      const bucket = byKey.get(key) ?? { before: [], after: [] };
      if (typeof e.moodScoreBefore === 'number')
        bucket.before.push(e.moodScoreBefore);
      if (typeof e.moodScoreAfter === 'number')
        bucket.after.push(e.moodScoreAfter);
      byKey.set(key, bucket);
    }

    const toAvg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return Array.from(byKey.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => {
        const avgBefore = toAvg(v.before);
        const avgAfter = toAvg(v.after);
        const improvementRate =
          avgBefore > 0 ? ((avgAfter - avgBefore) / avgBefore) * 100 : 0;
        return {
          date,
          avgMoodBefore: Math.round(avgBefore * 100) / 100,
          avgMoodAfter: v.after.length
            ? Math.round(avgAfter * 100) / 100
            : null,
          entriesCount: v.before.length,
          improvementRate: Math.round(improvementRate * 10) / 10,
        };
      });
  }

  private analyzeWeeklyPatterns(entries: any[]) {
    const buckets = new Map<number, { mood: number[]; count: number }>();
    for (const e of entries) {
      const d = new Date(e.entryDate);
      const dow = d.getDay();
      const b = buckets.get(dow) ?? { mood: [], count: 0 };
      if (typeof e.moodScoreBefore === 'number') b.mood.push(e.moodScoreBefore);
      b.count += 1;
      buckets.set(dow, b);
    }
    const toAvg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayOfWeek, v]) => ({
        dayOfWeek,
        avgMoodScore: Math.round(toAvg(v.mood) * 100) / 100,
        entriesCount: v.count,
      }));
  }

  private analyzeHourlyPatterns(entries: any[]) {
    const buckets = new Map<number, { mood: number[]; count: number }>();
    for (const e of entries) {
      const d = new Date(e.entryDate);
      const h = d.getHours();
      const b = buckets.get(h) ?? { mood: [], count: 0 };
      if (typeof e.moodScoreBefore === 'number') b.mood.push(e.moodScoreBefore);
      b.count += 1;
      buckets.set(h, b);
    }
    const toAvg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, v]) => ({
        hour,
        avgMoodScore: Math.round(toAvg(v.mood) * 100) / 100,
        entriesCount: v.count,
      }));
  }

  private analyzeCognitiveDistortions(entries: any[]) {
    const counts = new Map<string, { count: number; entryIds: string[] }>();
    let total = 0;
    for (const e of entries) {
      const thoughts = (e.thoughts as any[]) || [];
      const entryId = (e as any).id as string;
      for (const t of thoughts) {
        if (Array.isArray(t?.cognitiveDistortions)) {
          for (const d of t.cognitiveDistortions) {
            const type = String(d.type || '').toLowerCase();
            if (!type) continue;
            total++;
            const v = counts.get(type) ?? { count: 0, entryIds: [] };
            v.count += 1;
            if (entryId) v.entryIds.push(entryId);
            counts.set(type, v);
          }
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([type, v]) => ({
        type,
        count: v.count,
        percentage: total ? Math.round((v.count / total) * 100 * 10) / 10 : 0,
        improvementRate: 0,
        entryIds: v.entryIds.slice(0, 30),
      }));
  }

  private analyzeThoughtPatterns(entries: any[]) {
    const map = new Map<
      string,
      { count: number; intensity: number[]; emotions: Map<number, number> }
    >();
    for (const e of entries) {
      const thoughts = (e.thoughts as any[]) || [];
      for (const t of thoughts) {
        const text = String(t?.thought || '')
          .trim()
          .toLowerCase();
        if (!text) continue;
        const rec = map.get(text) ?? {
          count: 0,
          intensity: [],
          emotions: new Map(),
        };
        rec.count += 1;
        if (typeof t?.intensity === 'number') rec.intensity.push(t.intensity);
        if (Array.isArray(t?.emotions)) {
          for (const em of t.emotions) {
            // попытаемся сопоставить эмоцию по id или nameKey
            const id = this.getEmotionIdFromJson(em);
            if (id !== null) {
              rec.emotions.set(id, (rec.emotions.get(id) ?? 0) + 1);
              continue;
            }
            const key = this.getEmotionNameKeyFromJson(em);
            if (key) {
              // отложенное сопоставление по ключу — просто хэшируем сам ключ
              // (в UI эти поля не критичны, поэтому оставим id как NaN)
              // Но чтобы не плодить NaN, пропустим — это вспомогательная метрика
            }
          }
        }
        map.set(text, rec);
      }
    }

    const patterns = Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([pattern, v]) => ({
        pattern,
        count: v.count,
        avgIntensity: v.intensity.length
          ? Math.round(
              (v.intensity.reduce((a, b) => a + b, 0) / v.intensity.length) *
                10,
            ) / 10
          : 0,
        commonEmotions: Array.from(v.emotions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, count]) => ({ id, name: String(id), count })),
      }));
    return patterns;
  }

  private calculateCBTEffectiveness(entries: any[]) {
    const withAfter = entries.filter(
      (e) => typeof e.moodScoreAfter === 'number',
    );
    const avgImprovement = withAfter.length
      ? withAfter.reduce(
          (sum, e) =>
            sum + ((e.moodScoreAfter as number) - (e.moodScoreBefore || 0)),
          0,
        ) / withAfter.length
      : 0;
    const successRate = entries.length
      ? (withAfter.filter(
          (e) => (e.moodScoreAfter as number) > (e.moodScoreBefore || 0),
        ).length /
          entries.length) *
        100
      : 0;
    return {
      avgMoodImprovement: Math.round(avgImprovement * 100) / 100,
      successRate: Math.round(successRate * 10) / 10,
      bestTechniques: [],
    };
  }

  private async calculateOverallProgress(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const count = await this.prisma.cbtEntry.count({
      where: { userId, entryDate: { gte: startDate, lte: endDate } },
    });
    const consistency = Math.min(100, Math.round((count / 30) * 100));
    return {
      score: consistency,
      change: 0,
      interpretation:
        consistency >= 70 ? 'Хорошая динамика' : 'Нужна стабильность',
    };
  }

  private async getUserAchievements(userId: string) {
    // MVP: простые достижения
    return [];
  }

  private async generateRecommendations(
    userId: string,
    query: AnalyticsQueryDto,
  ) {
    // MVP: без рекомендаций
    return [];
  }

  private async calculateKeyMetrics(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const entries = await this.prisma.cbtEntry.findMany({
      where: { userId, entryDate: { gte: startDate, lte: endDate } },
      select: { moodScoreBefore: true },
      orderBy: { entryDate: 'asc' },
    });
    const consistency = Math.min(100, Math.round((entries.length / 30) * 100));
    const moodStability =
      entries.length > 1
        ? Math.max(
            0,
            100 -
              Math.round(
                this.stdDev(entries.map((e) => e.moodScoreBefore || 0)) * 10,
              ),
          )
        : 0;
    return {
      consistency,
      moodStability,
      emotionalAwareness: 0,
      copingSkills: 0,
    };
  }

  private assessDataQuality(userStats: any, emotionAnalytics: any[]) {
    const score = Math.min(
      100,
      Math.round((userStats.totalEntries / 50) * 100),
    );
    const issues: string[] = [];
    const recommendations: string[] = [];
    if (userStats.totalEntries < 10) {
      recommendations.push('Добавьте больше записей для точной аналитики');
    }
    return { score, issues, recommendations };
  }

  // Универсальный резолвер эмоции из произвольного JSON
  private resolveEmotionFromJsonFactory(allEmotions: any[]) {
    const byId = new Map<number, any>();
    const byKey = new Map<string, any>();
    const bySyn = new Map<string, any>();
    for (const e of allEmotions) {
      byId.set(e.id, e);
      if (e.nameKey) byKey.set(String(e.nameKey), e);
      try {
        const syns: string[] = Array.isArray(e.synonyms)
          ? e.synonyms
          : typeof e.synonyms === 'string'
            ? JSON.parse(e.synonyms)
            : [];
        for (const s of syns) {
          if (typeof s === 'string' && s.trim())
            bySyn.set(s.trim().toLowerCase(), e);
        }
      } catch {}
    }

    return (em: any): any | null => {
      const id = this.getEmotionIdFromJson(em);
      if (id !== null && byId.has(id)) return byId.get(id);
      const key = this.getEmotionNameKeyFromJson(em);
      if (key && byKey.has(key)) return byKey.get(key);
      const label = (em?.label ?? em?.title ?? em?.name) as any;
      if (typeof label === 'string' && label.trim()) {
        const low = label.trim().toLowerCase();
        if (bySyn.has(low)) return bySyn.get(low);
      }
      return null;
    };
  }

  private async findMostCommonEmotionId(userId: string) {
    const rows = await this.prisma.cbtEntry.findMany({
      where: { userId },
      select: { thoughts: true },
    });
    const allEmotions = await this.prisma.emotion.findMany();
    const resolveEmotion = this.resolveEmotionFromJsonFactory(allEmotions);

    const counts = new Map<number, number>();
    for (const r of rows) {
      const thoughts = (r.thoughts as any[]) || [];
      for (const t of thoughts) {
        if (!Array.isArray(t?.emotions)) continue;
        for (const e of t.emotions) {
          const resolved = resolveEmotion(e);
          if (!resolved) continue;
          const id = resolved.id as number;
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }

    let best: number | null = null;
    let bestC = 0;
    for (const [id, c] of counts) {
      if (c > bestC) {
        best = id;
        bestC = c;
      }
    }
    return best;
  }

  private stdDev(values: number[]) {
    if (!values.length) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const varSum =
      values.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / values.length;
    return Math.sqrt(varSum);
  }
}
