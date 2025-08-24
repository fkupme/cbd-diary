import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CbtModule } from '../cbt/cbt.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [DatabaseModule, CbtModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
