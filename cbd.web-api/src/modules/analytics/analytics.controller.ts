import { Controller, Get, Put, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { createApiResponse } from '../../common/helpers/response.helper';
import { ApiResponse } from '../../common/types/api-response.type';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsQueryDto,
  AnalyticsSummaryDto,
  AnalyticsTimeRange,
  CognitiveInsightsDto,
  EmotionAnalyticsDto,
  MoodTrendsDto,
  ProgressReportDto,
  UserStatsResponseDto,
} from './dto/analytics.dto';

@ApiTags('analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
      } catch {}
    }
    return 'temp-user-id';
  }

  @Get('user-stats')
  @ApiOperation({
    summary: 'Получить статистику пользователя',
    description:
      'Возвращает основную статистику активности пользователя в дневнике КПТ.',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Статистика пользователя',
    schema: {
      example: {
        success: true,
        data: {
          userId: 'user-uuid',
          totalEntries: 45,
          currentStreakDays: 7,
          longestStreakDays: 14,
          avgMoodScore: 6.2,
          entriesThisWeek: 5,
          entriesThisMonth: 18,
          moodTrend: {
            direction: 'up',
            change: 0.8,
          },
          weeklyActivity: [
            {
              date: '2024-01-01',
              entriesCount: 2,
              avgMoodScore: 6.5,
            },
          ],
        },
      },
    },
  })
  async getUserStats(
    @Req() req: Request,
  ): Promise<ApiResponse<UserStatsResponseDto>> {
    const userId = this.extractUserId(req);
    const stats = await this.analyticsService.getUserStats(userId);
    return createApiResponse(stats, req.url);
  }

  @Get('emotions')
  @ApiOperation({
    summary: 'Получить аналитику эмоций',
    description: 'Анализирует эмоции пользователя за указанный период.',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: AnalyticsTimeRange,
    description: 'Временной диапазон для анализа',
    example: AnalyticsTimeRange.MONTH,
  })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @SwaggerResponse({ status: 200, description: 'Аналитика эмоций' })
  async getEmotionAnalytics(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ApiResponse<EmotionAnalyticsDto[]>> {
    const userId = this.extractUserId(req);
    const analytics = await this.analyticsService.getEmotionAnalytics(
      userId,
      query,
    );
    return createApiResponse(analytics, req.url);
  }

  @Get('mood-trends')
  @ApiOperation({ summary: 'Получить тренды настроения' })
  async getMoodTrends(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ApiResponse<MoodTrendsDto>> {
    const userId = this.extractUserId(req);
    const trends = await this.analyticsService.getMoodTrends(userId, query);
    return createApiResponse(trends, req.url);
  }

  @Get('cognitive-insights')
  @ApiOperation({ summary: 'Получить когнитивные инсайты' })
  async getCognitiveInsights(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ApiResponse<CognitiveInsightsDto>> {
    const userId = this.extractUserId(req);
    const insights = await this.analyticsService.getCognitiveInsights(
      userId,
      query,
    );
    return createApiResponse(insights, req.url);
  }

  @Get('progress-report')
  @ApiOperation({ summary: 'Получить отчет о прогрессе' })
  async getProgressReport(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ApiResponse<ProgressReportDto>> {
    const userId = this.extractUserId(req);
    const report = await this.analyticsService.getProgressReport(userId, query);
    return createApiResponse(report, req.url);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Получить сводку аналитики',
    description: 'Полная сводка всех аналитических данных пользователя.',
  })
  async getAnalyticsSummary(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ApiResponse<AnalyticsSummaryDto>> {
    const userId = this.extractUserId(req);

    try {
      const summary = await this.analyticsService.getAnalyticsSummary(
        userId,
        query,
      );
      return createApiResponse(summary, req.url);
    } catch (e) {
      const empty: AnalyticsSummaryDto = {
        userStats: await this.analyticsService.getUserStats(userId),
        emotionAnalytics: [],
        moodTrends: {
          timeRange: query.timeRange || AnalyticsTimeRange.MONTH,
          startDate: new Date(),
          endDate: new Date(),
          overallTrend: {
            direction: 'stable',
            change: 0,
            avgMoodBefore: 0,
            avgMoodAfter: 0,
            improvement: 0,
          },
          dataPoints: [],
          weeklyPatterns: [],
          hourlyPatterns: [],
        },
        cognitiveInsights: {
          cognitiveDistortions: [],
          thoughtPatterns: [],
          cbtEffectiveness: {
            avgMoodImprovement: 0,
            successRate: 0,
            bestTechniques: [],
          },
        },
        progressReport: {
          timeRange: query.timeRange || AnalyticsTimeRange.MONTH,
          startDate: new Date(),
          endDate: new Date(),
          overallProgress: { score: 0, change: 0, interpretation: '' },
          achievements: [],
          recommendations: [],
          keyMetrics: {
            consistency: 0,
            moodStability: 0,
            emotionalAwareness: 0,
            copingSkills: 0,
          },
        },
        categoryDiversity: {
          uniqueCategories: 0,
          shannon: 0,
          simpson: 0,
          evenness: 0,
          distribution: [],
        },
        entriesTimeline: [],
        aiSessions: {
          totalSessions: 0,
          endedSessions: 0,
          successRate: 0,
          averageLengthMinutes: 0,
          averageAiMessages: 0,
          byDay: [],
        },
        generatedAt: new Date(),
        dataQuality: { score: 0, issues: [], recommendations: [] },
      };
      return createApiResponse(empty, req.url);
    }
  }

  @Put('refresh-stats')
  @ApiOperation({ summary: 'Обновить статистику пользователя' })
  async refreshUserStats(
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string; updatedAt: Date }>> {
    const userId = this.extractUserId(req);
    await this.analyticsService.updateUserStats(userId);
    return createApiResponse(
      { message: 'Статистика успешно обновлена', updatedAt: new Date() },
      req.url,
    );
  }
}
