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

# Устанавливаем права доступа
USER nestjs

# Настройки
EXPOSE 3000
ENV NODE_ENV=production

# Проверка здоровья
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Запуск приложения (миграции выполняются через docker-compose командой)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"] 