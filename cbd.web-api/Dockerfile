# Этап 1: Базовый образ с зависимостями
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
# production-only deps для slim-слоя
RUN npm ci --only=production && npm cache clean --force

# Этап 2: Сборка приложения (dev deps включены, чтобы был prisma CLI)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Генерация Prisma Client на этапе сборки (для компиляции)
RUN npx prisma generate
RUN npm run build

# Этап 3: Финальный образ для продакшена
FROM node:18-alpine AS runner
WORKDIR /app

# Устанавливаем необходимые пакеты
RUN apk add --no-cache dumb-init

# Создаем пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Копируем node_modules с DEV зависимостями из builder (нужно для prisma CLI при старте)
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Копируем собранное приложение и prisma схему
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
# tsconfig нужен ts-node'у для сид-скрипта (prisma/seed.ts) при старте
COPY --from=builder --chown=nestjs:nodejs /app/tsconfig.json ./
# Self-provision entrypoint: db push + seed-if-empty перед стартом приложения
COPY --from=builder --chown=nestjs:nodejs /app/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Устанавливаем права доступа
USER nestjs

# Настройки
EXPOSE 3000
ENV NODE_ENV=production

# Проверка здоровья: реальный пинг API (эндпоинт делает SELECT 1 к БД),
# а не `node --version` — иначе контейнер «healthy» при мёртвой базе.
# start-period 40s даёт время на db push + seed при первом старте.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3002/api/v1/sync/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Запуск: dumb-init → entrypoint (db push + seed-if-empty) → node dist/main
ENTRYPOINT ["dumb-init", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/main"] 