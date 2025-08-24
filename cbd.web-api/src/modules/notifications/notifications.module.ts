import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { PushSenderService } from './push.sender';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, PushSenderService],
  exports: [NotificationsService, NotificationsGateway, PushSenderService],
})
export class NotificationsModule {}
