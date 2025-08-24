import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum AnalyticsTimeRange {
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Временной диапазон для анализа',
    enum: AnalyticsTimeRange,
    example: AnalyticsTimeRange.MONTH,
  })
  @IsOptional()
  @IsEnum(AnalyticsTimeRange, { message: 'Неверный временной диапазон' })
  timeRange?: AnalyticsTimeRange = AnalyticsTimeRange.MONTH;

  @ApiPropertyOptional({
    description: 'Начальная дата (для custom диапазона)',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат начальной даты' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Конечная дата (для custom диапазона)',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Неверный формат конечной даты' })
  endDate?: string;
}

export class UserStatsResponseDto {
  userId: string;
  totalEntries: number;
  currentStreakDays: number;
  longestStreakDays: number;
  avgMoodScore: number;
  mostCommonEmotionId?: number;
  entriesThisWeek: number;
  entriesThisMonth: number;
  lastCalculatedAt: Date;

  // Дополнительные поля
  mostCommonEmotion?: {
    id: number;
    name: string;
    emoji: string;
    count: number;
  };

  moodTrend: {
    direction: 'up' | 'down' | 'stable';
    change: number; // Изменение в процентах
  };

  weeklyActivity: Array<{
    date: string;
    entriesCount: number;
    avgMoodScore: number;
  }>;
}

export class EmotionAnalyticsDto {
  emotionId: number;
  emotionName: string;
  emoji: string;
  count: number;
  percentage: number;
  avgIntensity: number;
  trend: {
    direction: 'up' | 'down' | 'stable';
    change: number;
  };

  // Контекст эмоции
  commonSituations: string[];
  commonReactions: string[];
  timePatterns: Array<{
    hour: number;
    count: number;
  }>;
}

export class MoodTrendsDto {
  timeRange: AnalyticsTimeRange;
  startDate: Date;
  endDate: Date;

  // Общий тренд настроения
  overallTrend: {
    direction: 'up' | 'down' | 'stable';
    change: number;
    avgMoodBefore: number;
    avgMoodAfter: number;
    improvement: number; // Улучшение после КПТ сессий
  };

  // Детализация по дням/неделям/месяцам
  dataPoints: Array<{
    date: string;
    avgMoodBefore: number;
    avgMoodAfter: number | null;
    entriesCount: number;
    improvementRate: number;
  }>;

  // Паттерны по дням недели
  weeklyPatterns: Array<{
    dayOfWeek: number; // 0-6 (Воскресенье-Суббота)
    avgMoodScore: number;
    entriesCount: number;
  }>;

  // Паттерны по времени дня
  hourlyPatterns: Array<{
    hour: number; // 0-23
    avgMoodScore: number;
    entriesCount: number;
  }>;
}

export class CognitiveInsightsDto {
  // Анализ когнитивных искажений
  cognitiveDistortions: Array<{
    type: string;
    count: number;
    percentage: number;
    improvementRate: number; // Насколько часто пользователь работает с этим искажением
    entryIds?: string[]; // Ссылки на записи, где встречалось искажение
  }>;

  // Паттерны мыслей
  thoughtPatterns: Array<{
    pattern: string;
    count: number;
    avgIntensity: number;
    commonEmotions: Array<{
      id: number;
      name: string;
      count: number;
    }>;
  }>;

  // Эффективность КПТ техник
  cbtEffectiveness: {
    avgMoodImprovement: number;
    successRate: number; // % сессий с улучшением настроения
    bestTechniques: Array<{
      technique: string;
      avgImprovement: number;
      usageCount: number;
    }>;
  };
}

export class ProgressReportDto {
  timeRange: AnalyticsTimeRange;
  startDate: Date;
  endDate: Date;

  // Общий прогресс
  overallProgress: {
    score: number; // 0-100
    previousScore?: number;
    change: number;
    interpretation: string;
  };

  // Достижения
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    achieved: boolean;
    achievedAt?: Date;
    progress: number; // 0-100
  }>;

  // Рекомендации
  recommendations: Array<{
    type: 'frequency' | 'technique' | 'emotion' | 'situation';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    actionable: boolean;
  }>;

  // Ключевые метрики
  keyMetrics: {
    consistency: number; // Постоянство ведения дневника (0-100)
    moodStability: number; // Стабильность настроения (0-100)
    emotionalAwareness: number; // Эмоциональная осознанность (0-100)
    copingSkills: number; // Навыки совладания (0-100)
  };
}

export class CategoryDiversityDto {
  uniqueCategories: number;
  shannon: number; // Индекс Шеннона
  simpson: number; // Индекс Симпсона (1 - sum(p_i^2))
  evenness: number; // Равномерность
  distribution: Array<{
    categoryId: number;
    categoryName: string;
    color?: string;
    count: number;
    percentage: number;
  }>;
}

export class EntriesTimelinePointDto {
  date: string; // YYYY-MM-DD
  entriesCount: number;
}

export class AiSessionsMetricsDto {
  totalSessions: number;
  endedSessions: number;
  successRate: number; // % успешных
  averageLengthMinutes: number;
  averageAiMessages: number;
  byDay: Array<{
    date: string;
    sessions: number;
    successes: number;
  }>;
}

export class AnalyticsSummaryDto {
  userStats: UserStatsResponseDto;
  emotionAnalytics: EmotionAnalyticsDto[];
  moodTrends: MoodTrendsDto;
  cognitiveInsights: CognitiveInsightsDto;
  progressReport: ProgressReportDto;

  // Новые блоки сводки
  categoryDiversity: CategoryDiversityDto;
  entriesTimeline: EntriesTimelinePointDto[];
  aiSessions: AiSessionsMetricsDto;

  // Мета информация
  generatedAt: Date;
  dataQuality: {
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
}
