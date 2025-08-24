# Детальный план разработки CBD Web API

## 1. Общая архитектура
- **Фреймворк**: NestJS (TypeScript) для REST API.
- **БД**: PostgreSQL с Prisma ORM для миграций, моделей и запросов.
- **Аутентификация**: JWT для сессий, OAuth 2.0 с провайдерами (Google, Yandex, Apple – как "ещё что-то").
- **Real-time**: Socket.io для сокетов (решение моё: нужно для синхронизации записей в реальном времени, как в мобильном приложении).
- **gRPC**: Опционально добавим позже, если нужно (мобилка на Tauri легко жрёт, но начнём с REST + WS для простоты).
- **Best practices** (на основе поиска: scalable_server_architecture, NestJS-Auth-REST-API-PostgreSQL-Prisma-Template):
  - Модульная структура (модули для users, cbt-entries, emotions и т.д.).
  - DTO для валидации (class-validator).
  - Guards для аутентификации.
  - Interceptors для логирования/трансформаций.
  - Swagger для документации.
  - Тестирование: Jest для unit/e2e.
  - Redis для кэша/сессий (если нужно для масштаба).
  - Error handling: Глобальный exception filter.
  - Rate limiting, helmet для security.

Архитектура (Mermaid диаграмма, которую я уже генерировал ранее):
[Вставь сюда код Mermaid из предыдущего шага, если нужно визуализировать]

## 2. Структура проекта
- src/
  - common/ (фильтры, интерсепторы, декораторы)
  - config/ (конфигурация: env, prisma)
  - modules/
    - auth/ (JWT, OAuth, guards)
    - users/ (CRUD для пользователей)
    - cbt-entries/ (CRUD для записей СМЭР)
    - emotions/ (CRUD для эмоций и категорий)
    - analytics/ (статистика, стрихи)
    - sync/ (синхронизация с мобилькой)
    - ai/ (интеграция с DeepSeek API)
  - prisma/ (клиент, миграции)
- test/ (e2e тесты)
- prisma/schema.prisma (модели БД, адаптированные из SQLite мобильки)

## 3. Миграции и БД
- Адаптировать схему из мобильной SQLite:
  - Таблицы: users, cbt_entries, emotion_categories, emotions, translations, sync_operations, user_stats.
  - Добавить серверные поля: timestamps, soft delete, индексы.
- Prisma: Генерация клиента, миграции (npx prisma migrate dev).
- Подключение: Postgres в Docker или cloud (env: DATABASE_URL).

## 4. Аутентификация и безопасность
- JWT: @nestjs/jwt, стратегия с refresh tokens.
- OAuth: passport-google-oauth20, passport-yandex, passport-apple.
- Guards: JwtAuthGuard, RolesGuard.
- Sessions: Redis для хранения refresh tokens.
- Best practice: Cookie-based auth, CSRF protection.

## 5. Эндпоинты (REST API)
- /auth/
  - POST /login (JWT)
  - POST /register
  - GET /google (OAuth redirect)
  - GET /yandex
  - GET /apple
  - POST /refresh
- /users/
  - GET /:id (protected)
  - PATCH /:id (update profile)
- /cbt-entries/
  - POST / (create entry)
  - GET / (list with filters: date, user_id)
  - GET /:id
  - PATCH /:id
  - DELETE /:id
- /emotions/
  - GET /categories
  - GET / (list emotions with localization)
- /analytics/
  - GET /stats/:user_id
- /sync/
  - POST /operations (batch sync from mobile)

## 6. Real-time (Socket.io)
- Namespace: /sync
- Events: entry_updated, stats_updated
- Авторизация: JWT в handshake.

## 7. Интеграции
- AI: DeepSeek API для анализа (POST /ai/analyze).
- Email: Nodemailer для верификации/уведомлений.

## 8. Тестирование и деплой
- Unit: Jest для сервисов.
- E2E: Supertest для API.
- CI/CD: GitHub Actions (lint, test, deploy).
- Деплой: Docker, Heroku/Vercel.

## 9. Зависимости для установки
- Основные: @nestjs/common, @nestjs/core, @nestjs/platform-express, @nestjs/jwt, @nestjs/passport, passport-jwt, passport-google-oauth20, etc.
- Prisma: @prisma/client, prisma.
- Socket.io: @nestjs/websockets, socket.io.
- Другие: class-validator, class-transformer, helmet, rate-limiter-flexible.

## 10. Шаги реализации
1. Установить зависимости.
2. Настроить Prisma и миграции.
3. Реализовать auth module.
4. Добавить модули по одному (users -> cbt -> etc.).
5. Добавить тесты.
6. Документировать Swagger.

Конец плана. Теперь приступаю.