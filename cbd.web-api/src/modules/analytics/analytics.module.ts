import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CbtModule } from '../cbt/cbt.module';
import { EmotionsModule } from '../emotions/emotions.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [DatabaseModule, CbtModule, EmotionsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
