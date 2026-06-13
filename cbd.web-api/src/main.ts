import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/logging/all-exceptions.filter';
import { HttpLoggingInterceptor } from './common/logging/http-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  // Свой JSON-парсер с поднятым лимитом: голосовой intake шлёт аудио base64,
  // дефолтные 100kb express рубят его как 413. Штатный bodyParser отключён выше.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get('app.port');
  const apiPrefix = configService.get('app.apiPrefix');
  const apiVersion = configService.get('app.apiVersion');
  const corsOrigin = configService.get('app.corsOrigin');

  // Включаем CORS
  if (configService.get('app.nodeEnv') === 'development') {
    app.enableCors({
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'User-Agent'],
      credentials: true,
    });
    app
      .get(Logger)
      .log('🌐 CORS настроен для development (все origins разрешены)');
  } else {
    // Origin'ы вебвью мобильного приложения (Tauri) — константны и должны быть
    // разрешены всегда, иначе fetch из приложения рубится CORS-preflight'ом
    // (origin 'http://tauri.localhost' на Android, 'tauri://localhost' на iOS).
    const mobileWebviewOrigins = [
      'http://tauri.localhost',
      'https://tauri.localhost',
      'tauri://localhost',
    ];
    const configuredOrigins = String(corsOrigin || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const allowedOrigins = Array.from(
      new Set([...configuredOrigins, ...mobileWebviewOrigins]),
    );

    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'User-Agent'],
      credentials: true,
    });
    app
      .get(Logger)
      .log(
        `🌐 CORS настроен для production (origins: ${allowedOrigins.join(', ')})`,
      );
  }

  // Глобальные пайпы для валидации
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
    }),
  );

  // Логирование HTTP + глобальный фильтр ошибок
  const logger = app.get(Logger);
  app.useGlobalInterceptors(new HttpLoggingInterceptor(logger));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Префикс API
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  // Настройка Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CBD Diary API')
    .setDescription(
      'API для мобильного приложения CBD Diary - дневник когнитивно-поведенческой терапии',
    )
    .setVersion('1.0')
    .addTag('auth', 'Аутентификация и авторизация')
    .addTag('emotions', 'Управление эмоциями и категориями')
    .addTag('users', 'Управление пользователями')
    .addTag('cbt-entries', 'КПТ записи дневника')
    .addTag('analytics', 'Аналитика и статистика')
    .addTag('sync', 'Синхронизация данных')
    .addTag('notifications', 'Уведомления и серверные пуши')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Введите JWT токен для авторизации',
      },
      'JWT-auth',
    )
    .addServer(`http://localhost:${port}`, 'Development сервер')
    .addServer('https://api.cbd-diary.com', 'Production сервер')
    .setContact(
      'CBD Diary Team',
      'https://github.com/cbd-diary',
      'support@cbd-diary.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'CBD Diary API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  logger.log(`🚀 CBD Diary API запущено на порту ${port}`);
  logger.log(
    `📚 Swagger документация: http://localhost:${port}/${apiPrefix}/docs`,
  );
  logger.log(
    `🌐 API endpoint: http://localhost:${port}/${apiPrefix}/${apiVersion}`,
  );

  await app.listen(port);
}

bootstrap();
