import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { DatabaseModule } from './database/database.module';
import { AiConnectionModule } from './modules/ai-connection/ai-connection.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { CbtModule } from './modules/cbt/cbt.module';
import { ChatModule } from './modules/chat/chat.module';
import { EmotionsModule } from './modules/emotions/emotions.module';
import { I18nModule } from './modules/i18n/i18n.module';
import { IntakeModule } from './modules/intake/intake.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, databaseConfig],
      envFilePath: '.env',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.LOG_LEVEL ||
          (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: false,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        autoLogging: false, // we use custom interceptor
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["set-cookie"]',
            'res.headers["set-cookie"]',
            'response.*.password',
            'response.*.token',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    DatabaseModule,
    AnalyticsModule,
    AuthModule,
    CbtModule,
    EmotionsModule,
    SyncModule,
    UsersModule,
    I18nModule,
    ChatModule,
    AiConnectionModule,
    NotificationsModule,
    IntakeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
