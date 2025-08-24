-- Add normalized tables for thoughts and emotions
-- This improves analytics performance and data integrity

-- === ЦЕПОЧКИ МЫСЛЕЙ (НОРМАЛИЗОВАННЫЕ) ===
CREATE TABLE "thought_chains" (
    "id" TEXT NOT NULL,
    "cbt_entry_id" TEXT NOT NULL,
    "thought" TEXT NOT NULL,
    "is_automatic" BOOLEAN NOT NULL DEFAULT false,
    "intensity" SMALLINT NOT NULL DEFAULT 5,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thought_chains_pkey" PRIMARY KEY ("id")
);

-- === ЗАПИСИ ЭМОЦИЙ (НОРМАЛИЗОВАННЫЕ) ===
CREATE TABLE "emotion_entries" (
    "id" TEXT NOT NULL,
    "thought_chain_id" TEXT NOT NULL,
    "emotion_id" INTEGER NOT NULL,
    "intensity" SMALLINT NOT NULL DEFAULT 5,
    "duration_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emotion_entries_pkey" PRIMARY KEY ("id")
);

-- === КОГНИТИВНЫЕ ИСКАЖЕНИЯ (НОРМАЛИЗОВАННЫЕ) ===
CREATE TABLE "cognitive_distortions" (
    "id" TEXT NOT NULL,
    "thought_chain_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "intensity" SMALLINT NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cognitive_distortions_pkey" PRIMARY KEY ("id")
);

-- Foreign Key Constraints
ALTER TABLE "thought_chains" ADD CONSTRAINT "thought_chains_cbt_entry_id_fkey" FOREIGN KEY ("cbt_entry_id") REFERENCES "cbt_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "emotion_entries" ADD CONSTRAINT "emotion_entries_thought_chain_id_fkey" FOREIGN KEY ("thought_chain_id") REFERENCES "thought_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "emotion_entries" ADD CONSTRAINT "emotion_entries_emotion_id_fkey" FOREIGN KEY ("emotion_id") REFERENCES "emotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cognitive_distortions" ADD CONSTRAINT "cognitive_distortions_thought_chain_id_fkey" FOREIGN KEY ("thought_chain_id") REFERENCES "thought_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for performance
CREATE INDEX "idx_thought_chains_cbt_entry" ON "thought_chains"("cbt_entry_id");
CREATE INDEX "idx_thought_chains_order" ON "thought_chains"("cbt_entry_id", "order_index");

CREATE INDEX "idx_emotion_entries_thought_chain" ON "emotion_entries"("thought_chain_id");
CREATE INDEX "idx_emotion_entries_emotion" ON "emotion_entries"("emotion_id");
CREATE INDEX "idx_emotion_entries_emotion_intensity" ON "emotion_entries"("emotion_id", "intensity");
CREATE INDEX "idx_emotion_entries_created" ON "emotion_entries"("created_at");

CREATE INDEX "idx_cognitive_distortions_thought_chain" ON "cognitive_distortions"("thought_chain_id");
CREATE INDEX "idx_cognitive_distortions_type" ON "cognitive_distortions"("type");