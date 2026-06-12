-- Добавляем платформу WEB для web push (PWA) в enum PushPlatform.
-- IF NOT EXISTS делает миграцию идемпотентной (Postgres 12+).
ALTER TYPE "PushPlatform" ADD VALUE IF NOT EXISTS 'WEB';
