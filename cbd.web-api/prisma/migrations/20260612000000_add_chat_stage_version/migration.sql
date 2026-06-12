-- Оптимистичная блокировка стейта стадии чата (защита от гонки конкурентных
-- супервизоров). Аддитивно и безопасно: NOT NULL с дефолтом 0.
ALTER TABLE "chats" ADD COLUMN "stage_version" INTEGER NOT NULL DEFAULT 0;
