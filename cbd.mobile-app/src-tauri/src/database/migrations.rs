use sqlx::SqlitePool;
use chrono::Utc;

pub struct Migration {
    pub version: i32,
    pub name: String,
    pub up_sql: String,
    // down_sql для будущих rollback функций
    #[allow(dead_code)]
    pub down_sql: String,
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    log::info!("🔄 Запускаем миграции...");
    
    // Создаём таблицу версий миграций
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Получаем текущую версию
    let current_version: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations"
    )
    .fetch_one(pool)
    .await?;

    log::info!("📊 Текущая версия схемы: {}", current_version);

    // Применяем новые миграции
    for migration in get_migrations() {
        if migration.version > current_version {
            log::info!("⬆️ Применяем миграцию v{}: {}", migration.version, migration.name);
            apply_migration(pool, &migration).await?;
        }
    }

    log::info!("✅ Миграции завершены!");
    Ok(())
}

async fn apply_migration(pool: &SqlitePool, migration: &Migration) -> Result<(), sqlx::Error> {
    // Начинаем транзакцию
    let mut tx = pool.begin().await?;

    // Выполняем SQL миграции
    sqlx::query(&migration.up_sql).execute(&mut *tx).await?;

    // Записываем в таблицу миграций
    sqlx::query(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
    )
    .bind(migration.version)
    .bind(&migration.name)
    .bind(Utc::now().to_rfc3339())
    .execute(&mut *tx)
    .await?;

    // Коммитим транзакцию
    tx.commit().await?;

    log::info!("✅ Миграция v{} успешно применена", migration.version);
    Ok(())
}

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            name: "Initial schema".to_string(),
            up_sql: get_initial_schema(),
            down_sql: get_initial_schema_down(),
        },
        Migration {
            version: 2,
            name: "Add indexes".to_string(),
            up_sql: get_indexes_schema(),
            down_sql: get_indexes_schema_down(),
        },
        Migration {
            version: 3,
            name: "Add FTS search".to_string(),
            up_sql: get_fts_schema(),
            down_sql: get_fts_schema_down(),
        },
        Migration {
            version: 4,
            name: "Add server_updated_at to emotions and unique index on name_key".to_string(),
            up_sql: get_emotions_server_updated_at_migration(),
            down_sql: get_emotions_server_updated_at_migration_down(),
        },
    ]
}

fn get_initial_schema() -> String {
    r#"
    -- === ПОЛЬЗОВАТЕЛИ ===
    CREATE TABLE users (
        id TEXT PRIMARY KEY,                    -- UUID как строка
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        age INTEGER CHECK (age > 0 AND age < 150),
        gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
        preferred_language TEXT NOT NULL DEFAULT 'ru',
        goals TEXT NOT NULL DEFAULT '[]',       -- JSON массив
        experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
        meditation_frequency TEXT CHECK (meditation_frequency IN ('never', 'rarely', 'sometimes', 'often', 'daily')),
        stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
        sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
        timezone TEXT NOT NULL DEFAULT 'UTC',
        is_synced BOOLEAN NOT NULL DEFAULT FALSE,
        last_sync_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- === КАТЕГОРИИ ЭМОЦИЙ ===
    CREATE TABLE emotion_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_key TEXT NOT NULL,                 -- emotion_category.anger
        color TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL
    );

    -- === ЭМОЦИИ ===
    CREATE TABLE emotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name_key TEXT NOT NULL,                 -- emotion.anger.rage
        emoji TEXT NOT NULL,
        intensity_default INTEGER NOT NULL DEFAULT 5 CHECK (intensity_default >= 1 AND intensity_default <= 10),
        synonyms TEXT NOT NULL DEFAULT '[]',    -- JSON массив
        opposite_emotion_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES emotion_categories(id),
        FOREIGN KEY (opposite_emotion_id) REFERENCES emotions(id)
    );

    -- === ЗАПИСИ ДНЕВНИКА (СМЭР) ===
    CREATE TABLE cbt_entries (
        id TEXT PRIMARY KEY,                    -- UUID
        user_id TEXT NOT NULL,
        entry_date TEXT NOT NULL,               -- ISO 8601
        situation TEXT NOT NULL,
        thoughts TEXT NOT NULL DEFAULT '[]',    -- JSON массив ThoughtChain
        reactions TEXT NOT NULL,
        mood_score_before INTEGER CHECK (mood_score_before >= 1 AND mood_score_before <= 10),
        mood_score_after INTEGER CHECK (mood_score_after >= 1 AND mood_score_after <= 10),
        entry_duration_minutes INTEGER CHECK (entry_duration_minutes > 0),
        tags TEXT NOT NULL DEFAULT '[]',        -- JSON массив
        ai_analysis TEXT,                       -- JSON объект AIAnalysis
        is_synced BOOLEAN NOT NULL DEFAULT FALSE,
        server_id TEXT,                         -- UUID на сервере
        conflict_resolution TEXT,               -- JSON для разрешения конфликтов
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- === ПЕРЕВОДЫ ===
    CREATE TABLE translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language_code TEXT NOT NULL,
        translation_key TEXT NOT NULL,
        translation_value TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(language_code, translation_key)
    );

    -- === ОПЕРАЦИИ СИНХРОНИЗАЦИИ ===
    CREATE TABLE sync_operations (
        id TEXT PRIMARY KEY,                    -- UUID
        user_id TEXT NOT NULL,
        operation_type TEXT NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data_snapshot TEXT NOT NULL,           -- JSON снапшот
        created_at TEXT NOT NULL,
        synced_at TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- === СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ ===
    CREATE TABLE user_stats (
        user_id TEXT PRIMARY KEY,
        total_entries INTEGER NOT NULL DEFAULT 0,
        current_streak_days INTEGER NOT NULL DEFAULT 0,
        longest_streak_days INTEGER NOT NULL DEFAULT 0,
        avg_mood_score REAL NOT NULL DEFAULT 0.0,
        most_common_emotion_id INTEGER,
        entries_this_week INTEGER NOT NULL DEFAULT 0,
        entries_this_month INTEGER NOT NULL DEFAULT 0,
        last_calculated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (most_common_emotion_id) REFERENCES emotions(id)
    );
    "#.to_string()
}

fn get_initial_schema_down() -> String {
    r#"
    DROP TABLE IF EXISTS user_stats;
    DROP TABLE IF EXISTS sync_operations;
    DROP TABLE IF EXISTS translations;
    DROP TABLE IF EXISTS cbt_entries;
    DROP TABLE IF EXISTS emotions;
    DROP TABLE IF EXISTS emotion_categories;
    DROP TABLE IF EXISTS users;
    "#.to_string()
}

fn get_indexes_schema() -> String {
    r#"
    -- === ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ ===

    -- Пользователи
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_is_synced ON users(is_synced);
    CREATE INDEX IF NOT EXISTS idx_users_last_sync_at ON users(last_sync_at);
    CREATE INDEX IF NOT EXISTS idx_users_preferred_language ON users(preferred_language);

    -- Записи дневника
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_user_id ON cbt_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_entry_date ON cbt_entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_user_date ON cbt_entries(user_id, entry_date DESC);
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_is_synced ON cbt_entries(is_synced);
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_server_id ON cbt_entries(server_id);
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_created_at ON cbt_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_mood_before ON cbt_entries(mood_score_before);
    CREATE INDEX IF NOT EXISTS idx_cbt_entries_mood_after ON cbt_entries(mood_score_after);

    -- Эмоции
    CREATE INDEX IF NOT EXISTS idx_emotions_category_id ON emotions(category_id);
    CREATE INDEX IF NOT EXISTS idx_emotions_name_key ON emotions(name_key);
    CREATE INDEX IF NOT EXISTS idx_emotions_is_active ON emotions(is_active);
    CREATE INDEX IF NOT EXISTS idx_emotions_sort_order ON emotions(category_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_emotions_opposite ON emotions(opposite_emotion_id);

    -- Категории эмоций
    CREATE INDEX IF NOT EXISTS idx_emotion_categories_name_key ON emotion_categories(name_key);
    CREATE INDEX IF NOT EXISTS idx_emotion_categories_is_active ON emotion_categories(is_active);
    CREATE INDEX IF NOT EXISTS idx_emotion_categories_sort_order ON emotion_categories(sort_order);

    -- Переводы
    CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language_code);
    CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(translation_key);
    CREATE INDEX IF NOT EXISTS idx_translations_lang_key ON translations(language_code, translation_key);

    -- Синхронизация
    CREATE INDEX IF NOT EXISTS idx_sync_operations_user_id ON sync_operations(user_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_synced_at ON sync_operations(synced_at);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_created_at ON sync_operations(created_at);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_retry_count ON sync_operations(retry_count);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_table_record ON sync_operations(table_name, record_id);

    -- Статистика
    CREATE INDEX IF NOT EXISTS idx_user_stats_most_common_emotion ON user_stats(most_common_emotion_id);
    CREATE INDEX IF NOT EXISTS idx_user_stats_last_calculated ON user_stats(last_calculated_at);
    "#.to_string()
}

fn get_indexes_schema_down() -> String {
    r#"
    -- Удаление индексов при откате миграции
    DROP INDEX IF EXISTS idx_user_stats_last_calculated;
    DROP INDEX IF EXISTS idx_user_stats_most_common_emotion;
    DROP INDEX IF EXISTS idx_sync_operations_table_record;
    DROP INDEX IF EXISTS idx_sync_operations_retry_count;
    DROP INDEX IF EXISTS idx_sync_operations_created_at;
    DROP INDEX IF EXISTS idx_sync_operations_synced_at;
    DROP INDEX IF EXISTS idx_sync_operations_user_id;
    DROP INDEX IF EXISTS idx_translations_lang_key;
    DROP INDEX IF EXISTS idx_translations_key;
    DROP INDEX IF EXISTS idx_translations_language;
    DROP INDEX IF EXISTS idx_emotion_categories_sort_order;
    DROP INDEX IF EXISTS idx_emotion_categories_is_active;
    DROP INDEX IF EXISTS idx_emotion_categories_name_key;
    DROP INDEX IF EXISTS idx_emotions_opposite;
    DROP INDEX IF EXISTS idx_emotions_sort_order;
    DROP INDEX IF EXISTS idx_emotions_is_active;
    DROP INDEX IF EXISTS idx_emotions_name_key;
    DROP INDEX IF EXISTS idx_emotions_category_id;
    DROP INDEX IF EXISTS idx_cbt_entries_mood_after;
    DROP INDEX IF EXISTS idx_cbt_entries_mood_before;
    DROP INDEX IF EXISTS idx_cbt_entries_created_at;
    DROP INDEX IF EXISTS idx_cbt_entries_server_id;
    DROP INDEX IF EXISTS idx_cbt_entries_is_synced;
    DROP INDEX IF EXISTS idx_cbt_entries_user_date;
    DROP INDEX IF EXISTS idx_cbt_entries_entry_date;
    DROP INDEX IF EXISTS idx_cbt_entries_user_id;
    DROP INDEX IF EXISTS idx_users_preferred_language;
    DROP INDEX IF EXISTS idx_users_last_sync_at;
    DROP INDEX IF EXISTS idx_users_is_synced;
    DROP INDEX IF EXISTS idx_users_email;
    "#.to_string()
}

fn get_fts_schema() -> String {
    r#"
    -- === ПОЛНОТЕКСТОВЫЙ ПОИСК ===
    CREATE VIRTUAL TABLE IF NOT EXISTS cbt_entries_fts USING fts5(
        situation, 
        reactions, 
        thoughts_text,
        content='cbt_entries',
        content_rowid='rowid'
    );

    -- Триггеры для автоматического обновления FTS
    CREATE TRIGGER IF NOT EXISTS cbt_entries_fts_insert AFTER INSERT ON cbt_entries BEGIN
        INSERT INTO cbt_entries_fts(rowid, situation, reactions, thoughts_text) 
        VALUES (new.rowid, new.situation, new.reactions, new.thoughts);
    END;

    CREATE TRIGGER IF NOT EXISTS cbt_entries_fts_delete AFTER DELETE ON cbt_entries BEGIN
        INSERT INTO cbt_entries_fts(cbt_entries_fts, rowid, situation, reactions, thoughts_text) 
        VALUES('delete', old.rowid, old.situation, old.reactions, old.thoughts);
    END;

    CREATE TRIGGER IF NOT EXISTS cbt_entries_fts_update AFTER UPDATE ON cbt_entries BEGIN
        INSERT INTO cbt_entries_fts(cbt_entries_fts, rowid, situation, reactions, thoughts_text) 
        VALUES('delete', old.rowid, old.situation, old.reactions, old.thoughts);
        INSERT INTO cbt_entries_fts(rowid, situation, reactions, thoughts_text) 
        VALUES (new.rowid, new.situation, new.reactions, new.thoughts);
    END;
    "#.to_string()
}

fn get_fts_schema_down() -> String {
    r#"
    DROP TRIGGER IF EXISTS cbt_entries_fts_update;
    DROP TRIGGER IF EXISTS cbt_entries_fts_delete;
    DROP TRIGGER IF EXISTS cbt_entries_fts_insert;
    DROP TABLE IF EXISTS cbt_entries_fts;
    "#.to_string()
} 

fn get_emotions_server_updated_at_migration() -> String {
    r#"
    -- Добавляем колонку server_updated_at в таблицу emotions (если ещё нет)
    ALTER TABLE emotions ADD COLUMN server_updated_at TEXT;

    -- Уникальный индекс по ключу эмоции, чтобы UPSERT работал по name_key
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_emotions_name_key ON emotions(name_key);

    -- Уникальный индекс по ключу категории эмоций
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_emotion_categories_name_key ON emotion_categories(name_key);
    "#.to_string()
}

fn get_emotions_server_updated_at_migration_down() -> String {
    r#"
    -- В SQLite нельзя просто удалить колонку; откат не реализуем.
    DROP INDEX IF EXISTS uniq_emotions_name_key;
    "#.to_string()
}