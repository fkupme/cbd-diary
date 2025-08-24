-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "MeditationFrequency" AS ENUM ('never', 'rarely', 'sometimes', 'often', 'daily');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "age" SMALLINT,
    "gender" "Gender",
    "preferred_language" TEXT NOT NULL DEFAULT 'ru',
    "goals" JSONB NOT NULL DEFAULT '[]',
    "experience_level" "ExperienceLevel",
    "meditation_frequency" "MeditationFrequency",
    "stressLevel" SMALLINT,
    "sleepQuality" SMALLINT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "is_synced" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_categories" (
    "id" SERIAL NOT NULL,
    "name_key" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotion_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotions" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name_key" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "intensity_default" SMALLINT NOT NULL DEFAULT 5,
    "synonyms" JSONB NOT NULL DEFAULT '[]',
    "opposite_emotion_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "situation" TEXT NOT NULL,
    "thoughts" JSONB NOT NULL DEFAULT '[]',
    "reactions" TEXT NOT NULL,
    "mood_score_before" SMALLINT,
    "mood_score_after" SMALLINT,
    "entry_duration_minutes" INTEGER,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "ai_analysis" JSONB,
    "is_synced" BOOLEAN NOT NULL DEFAULT false,
    "server_id" TEXT,
    "conflict_resolution" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cbt_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" SERIAL NOT NULL,
    "language_code" TEXT NOT NULL,
    "translation_key" TEXT NOT NULL,
    "translation_value" TEXT NOT NULL,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "operation_type" "OperationType" NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "data_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "user_id" TEXT NOT NULL,
    "total_entries" INTEGER NOT NULL DEFAULT 0,
    "current_streak_days" INTEGER NOT NULL DEFAULT 0,
    "longest_streak_days" INTEGER NOT NULL DEFAULT 0,
    "avg_mood_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "most_common_emotion_id" INTEGER,
    "entries_this_week" INTEGER NOT NULL DEFAULT 0,
    "entries_this_month" INTEGER NOT NULL DEFAULT 0,
    "last_calculated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "emotions_name_key_key" ON "emotions"("name_key");

-- CreateIndex
CREATE INDEX "idx_cbt_entries_user_date" ON "cbt_entries"("user_id", "entry_date" DESC);

-- CreateIndex
CREATE INDEX "idx_cbt_entries_entry_date" ON "cbt_entries"("entry_date");

-- CreateIndex
CREATE INDEX "idx_cbt_entries_is_synced" ON "cbt_entries"("is_synced");

-- CreateIndex
CREATE INDEX "idx_cbt_entries_server_id" ON "cbt_entries"("server_id");

-- CreateIndex
CREATE INDEX "idx_translations_language" ON "translations"("language_code");

-- CreateIndex
CREATE INDEX "idx_translations_key" ON "translations"("translation_key");

-- CreateIndex
CREATE UNIQUE INDEX "translations_language_code_translation_key_key" ON "translations"("language_code", "translation_key");

-- CreateIndex
CREATE INDEX "idx_sync_operations_user_id" ON "sync_operations"("user_id");

-- CreateIndex
CREATE INDEX "idx_sync_operations_synced_at" ON "sync_operations"("synced_at");

-- CreateIndex
CREATE INDEX "idx_sync_operations_table_record" ON "sync_operations"("table_name", "record_id");

-- AddForeignKey
ALTER TABLE "emotions" ADD CONSTRAINT "emotions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "emotion_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotions" ADD CONSTRAINT "emotions_opposite_emotion_id_fkey" FOREIGN KEY ("opposite_emotion_id") REFERENCES "emotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_entries" ADD CONSTRAINT "cbt_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
