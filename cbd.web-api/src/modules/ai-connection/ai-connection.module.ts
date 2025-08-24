import { Module } from '@nestjs/common';
import { AiConnectionService } from './ai-connection.service';

@Module({
  imports: [],
  providers: [AiConnectionService],
  exports: [AiConnectionService],
})
export class AiConnectionModule {}
