import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EmotionsController } from './emotions.controller';
import { EmotionsService } from './emotions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [EmotionsController],
  providers: [EmotionsService],
  exports: [EmotionsService],
})
export class EmotionsModule {}
