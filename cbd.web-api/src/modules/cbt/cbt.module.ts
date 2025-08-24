import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ChatModule } from '../chat/chat.module';
import { CbtController } from './cbt.controller';
import { CbtService } from './cbt.service';

@Module({
  imports: [DatabaseModule, ChatModule],
  controllers: [CbtController],
  providers: [CbtService],
  exports: [CbtService],
})
export class CbtModule {}
