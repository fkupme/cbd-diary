import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { AiConnectionModule } from '../ai-connection/ai-connection.module';
import { AuthModule } from '../auth/auth.module';
import { CbtModule } from '../cbt/cbt.module';
import { EmotionsModule } from '../emotions/emotions.module';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AiConnectionModule,
    EmotionsModule,
    CbtModule,
    JwtModule.register({}),
  ],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
