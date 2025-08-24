-- Инициализация базы данных CBD Diary
-- Этот файл выполняется при первом запуске PostgreSQL контейнера

-- Создаем базу данных (уже создается через POSTGRES_DB в docker-compose)
-- CREATE DATABASE cbd_diary;

-- Устанавливаем часовой пояс по умолчанию
SET timezone = 'UTC';

-- Включаем расширения если нужно
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Логируем успешную инициализацию
DO $$
BEGIN
    RAISE NOTICE 'CBD Diary database initialized successfully';
END $$; 