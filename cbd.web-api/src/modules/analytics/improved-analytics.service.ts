import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AnalyticsQueryDto,
  AnalyticsSummaryDto,
  AnalyticsTimeRange,
  EmotionAnalyticsDto,
  UserStatsResponseDto,
} from './dto/analytics.dto';

/**
 * Improved Analytics Service using Normalized Database Structure
 * 
 * This service leverages the new normalized tables (thought_chains, emotion_entries, cognitive_distortions)
 * for much more efficient and accurate analytics queries.
 */

@Injectable()
export class ImprovedAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(ImprovedAnalyticsService.name);

  /**
   * Get emotion analytics using normalized emotion_entries table
   * This is MUCH more efficient than parsing JSON!
   */
  async getEmotionAnalytics(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<EmotionAnalyticsDto[]> {
    const { startDate, endDate } = this.getDateRange(query);

    // Single efficient query using JOINs instead of JSON parsing
    const emotionStats = await this.prisma.emotionEntry.groupBy({
      by: ['emotionId'],
      where: {
        thoughtChain: {
          cbtEntry: {
            userId,
            entryDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      _count: {
        id: true,
      },
      _avg: {
        intensity: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const totalEmotions = emotionStats.reduce((sum, stat) => sum + stat._count.id, 0);

    // Get emotion details in a single query
    const emotionIds = emotionStats.map(stat => stat.emotionId);
    const emotions = await this.prisma.emotion.findMany({
      where: {
        id: {
          in: emotionIds,
        },
      },
      include: {
        category: true,
      },
    });

    const emotionMap = new Map(emotions.map(e => [e.id, e]));

    return emotionStats.map(stat => {
      const emotion = emotionMap.get(stat.emotionId);
      if (!emotion) return null;

      const percentage = (stat._count.id / totalEmotions) * 100;

      return {
        emotionId: emotion.id,
        emotionName: emotion.nameKey,
        emoji: emotion.emoji,
        count: stat._count.id,
        percentage: Math.round(percentage * 100) / 100,
        avgIntensity: Math.round((stat._avg.intensity || 0) * 100) / 100,
        trend: { direction: 'stable', change: 0 }, // TODO: Implement trend calculation
        commonSituations: [], // TODO: Implement
        commonReactions: [], // TODO: Implement
        timePatterns: [], // TODO: Implement
      };
    }).filter(Boolean) as EmotionAnalyticsDto[];
  }

  /**
   * Get user statistics with improved performance
   */
  async getUserStats(userId: string): Promise<UserStatsResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return this.getEmptyUserStats(userId);
    }

    // Get basic entry statistics
    const [totalEntries, avgMoodScore, mostCommonEmotionStats] = await Promise.all([
      this.prisma.cbtEntry.count({ where: { userId } }),
      this.prisma.cbtEntry.aggregate({
        where: { userId, moodScoreBefore: { not: null } },
        _avg: { moodScoreBefore: true },
      }),
      this.getMostCommonEmotionStats(userId),
    ]);

    // Calculate streaks
    const { currentStreak, longestStreak } = await this.calculateStreaks(userId);

    // Get time-based statistics
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

    const moodTrend = await this.calculateMoodTrend(userId);
    const weeklyActivity = await this.getWeeklyActivity(userId);

    return {
      userId,
      totalEntries,
      currentStreakDays: currentStreak,
      longestStreakDays: longestStreak,
      avgMoodScore: avgMoodScore._avg.moodScoreBefore || 0,
      mostCommonEmotionId: mostCommonEmotionStats?.emotionId,
      entriesThisWeek,
      entriesThisMonth,
      lastCalculatedAt: new Date(),
      mostCommonEmotion: mostCommonEmotionStats
        ? {
            id: mostCommonEmotionStats.emotionId,
            name: mostCommonEmotionStats.nameKey,
            emoji: mostCommonEmotionStats.emoji,
            count: mostCommonEmotionStats.count,
          }
        : undefined,
      moodTrend,
      weeklyActivity,
    };
  }

  /**
   * Get top emotions by category using normalized tables
   */
  async getEmotionsByCategory(userId: string, query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const categoryStats = await this.prisma.emotionEntry.groupBy({
      by: ['emotionId'],
      where: {
        thoughtChain: {
          cbtEntry: {
            userId,
            entryDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      _count: {
        id: true,
      },
      _avg: {
        intensity: true,
      },
    });

    // Group by category
    const emotions = await this.prisma.emotion.findMany({
      where: {
        id: {
          in: categoryStats.map(stat => stat.emotionId),
        },
      },
      include: {
        category: true,
      },
    });

    const categoryMap = new Map<number, {
      category: any;
      emotions: any[];
      totalCount: number;
      avgIntensity: number;
    }>();

    for (const emotion of emotions) {
      const stat = categoryStats.find(s => s.emotionId === emotion.id);
      if (!stat) continue;

      if (!categoryMap.has(emotion.categoryId)) {
        categoryMap.set(emotion.categoryId, {
          category: emotion.category,
          emotions: [],
          totalCount: 0,
          avgIntensity: 0,
        });
      }

      const categoryData = categoryMap.get(emotion.categoryId)!;
      categoryData.emotions.push({
        ...emotion,
        count: stat._count.id,
        avgIntensity: stat._avg.intensity,
      });
      categoryData.totalCount += stat._count.id;
    }

    // Calculate average intensity for each category
    for (const [categoryId, data] of categoryMap) {
      const totalIntensity = data.emotions.reduce(
        (sum, e) => sum + (e.avgIntensity || 0) * e.count,
        0,
      );
      data.avgIntensity = totalIntensity / data.totalCount;
    }

    return Array.from(categoryMap.values()).sort((a, b) => b.totalCount - a.totalCount);
  }

  /**
   * Get cognitive distortion statistics
   */
  async getCognitiveDistortionStats(userId: string, query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const distortionStats = await this.prisma.cognitiveDistortion.groupBy({
      by: ['type'],
      where: {
        thoughtChain: {
          cbtEntry: {
            userId,
            entryDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      _count: {
        id: true,
      },
      _avg: {
        intensity: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const total = distortionStats.reduce((sum, stat) => sum + stat._count.id, 0);

    return distortionStats.map(stat => ({
      type: stat.type,
      count: stat._count.id,
      percentage: Math.round((stat._count.id / total) * 100 * 100) / 100,
      avgIntensity: Math.round((stat._avg.intensity || 0) * 100) / 100,
    }));
  }

  /**
   * Get thought patterns analysis
   */
  async getThoughtPatterns(userId: string, query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Get most common thought patterns
    const thoughts = await this.prisma.thoughtChain.findMany({
      where: {
        cbtEntry: {
          userId,
          entryDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      select: {
        thought: true,
        intensity: true,
        isAutomatic: true,
        emotionEntries: {
          include: {
            emotion: true,
          },
        },
      },
    });

    // Group similar thoughts (simplified - could use ML for better grouping)
    const thoughtMap = new Map<string, {
      count: number;
      avgIntensity: number;
      isAutomatic: boolean;
      commonEmotions: Map<number, number>;
    }>();

    for (const thought of thoughts) {
      const key = thought.thought.toLowerCase().trim();
      
      if (!thoughtMap.has(key)) {
        thoughtMap.set(key, {
          count: 0,
          avgIntensity: 0,
          isAutomatic: thought.isAutomatic,
          commonEmotions: new Map(),
        });
      }

      const data = thoughtMap.get(key)!;
      data.count++;
      data.avgIntensity = ((data.avgIntensity * (data.count - 1)) + thought.intensity) / data.count;

      for (const emotionEntry of thought.emotionEntries) {
        const emotionId = emotionEntry.emotion.id;
        data.commonEmotions.set(emotionId, (data.commonEmotions.get(emotionId) || 0) + 1);
      }
    }

    return Array.from(thoughtMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        avgIntensity: Math.round(data.avgIntensity * 100) / 100,
        isAutomatic: data.isAutomatic,
        commonEmotions: Array.from(data.commonEmotions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([emotionId, count]) => ({ emotionId, count })),
      }));
  }

  // Helper methods (private)
  private async getMostCommonEmotionStats(userId: string) {
    const emotionStats = await this.prisma.emotionEntry.groupBy({
      by: ['emotionId'],
      where: {
        thoughtChain: {
          cbtEntry: {
            userId,
          },
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 1,
    });

    if (emotionStats.length === 0) return null;

    const topEmotion = emotionStats[0];
    const emotion = await this.prisma.emotion.findUnique({
      where: { id: topEmotion.emotionId },
    });

    if (!emotion) return null;

    return {
      emotionId: emotion.id,
      nameKey: emotion.nameKey,
      emoji: emotion.emoji,
      count: topEmotion._count.id,
    };
  }

  private async calculateStreaks(userId: string) {
    const entries = await this.prisma.cbtEntry.findMany({
      where: { userId },
      select: { entryDate: true },
      orderBy: { entryDate: 'desc' },
    });

    if (entries.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const entryDays = new Set(entries.map(e => e.entryDate.toDateString()));

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
        const diffDays = Math.floor((cur.getTime() - prev.getTime()) / 86400000);
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

  private async calculateMoodTrend(userId: string) {
    const rows = await this.prisma.cbtEntry.findMany({
      where: { userId, moodScoreBefore: { not: null } },
      select: { moodScoreBefore: true, entryDate: true },
      orderBy: { entryDate: 'desc' },
      take: 30,
    });

    if (rows.length === 0) return { direction: 'stable' as const, change: 0 };

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

    return rows.map(r => ({
      date: r.d,
      entriesCount: Number(r.c),
      avgMoodScore: Number(r.avg),
    }));
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

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  private getEmptyUserStats(userId: string): UserStatsResponseDto {
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
}