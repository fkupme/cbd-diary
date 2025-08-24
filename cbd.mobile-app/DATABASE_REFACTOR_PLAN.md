# 🔥 План рефакторинга базы данных CBD Diary v2.0

## 🎯 Цель

Создать полноценную локальную БД с поддержкой офлайн режима, подготовкой к серверной синхронизации и мультиязычностью для CBD Mood Diary приложения на основе модели СМЭР (Ситуация-Мысль-Эмоция-Реакция).

## 📋 Обнаруженные проблемы

### 🤡 Критические косяки:

1. **Дублирование кода** - main.rs и lib.rs делают одно и то же
2. **In-memory база на Android** - данные пропадают при перезагрузке
3. **Несоответствие моделей** - User ≠ UserProfile ≠ SQL таблица
4. **Костыльная авторизация** - хардкод temp_user@test.com
5. **Дублированные команды** - add_mood_entry + create_mood_entry
6. **Неиспользуемые поля** - intensity в Emotion
7. **Плохая обработка ошибок** - unwrap() везде
8. **Отсутствие индексов** - производительность говно
9. **CSP отключен** - security hole
10. **Нет валидации данных** - можно записать любую хуйню
11. **Неконсистентные типы** - String ID вместо UUID
12. **Хардкод эмоций в коде** - 260+ строк говна

## 🚀 План действий

### 📦 ЭТАП 1: Архитектура и очистка (Приоритет: КРИТИЧЕСКИЙ)

#### 1.1 Новая структура проекта

```
src-tauri/
├── src/
│   ├── lib.rs                  ← Единственная точка входа
│   ├── database/
│   │   ├── mod.rs              ← Экспорты
│   │   ├── models.rs           ← Все структуры данных
│   │   ├── migrations.rs       ← Миграции схемы
│   │   ├── queries.rs          ← SQL запросы
│   │   ├── indexes.rs          ← Индексы для производительности
│   │   └── encryption.rs       ← Локальное шифрование
│   ├── auth/
│   │   ├── mod.rs              ← Локальная авторизация
│   │   └── validation.rs       ← Валидация данных
│   ├── sync/
│   │   ├── mod.rs              ← Подготовка к серверной синхронизации
│   │   ├── offline_queue.rs    ← Очередь офлайн операций
│   │   └── conflict_resolution.rs ← Разрешение конфликтов
│   ├── i18n/
│   │   ├── mod.rs              ← Мультиязычность
│   │   ├── emotions_data.rs    ← Эмоции на разных языках
│   │   └── translations.rs     ← Переводы интерфейса
│   ├── utils/
│   │   ├── errors.rs           ← Кастомные ошибки
│   │   ├── validators.rs       ← Валидаторы
│   │   └── crypto.rs           ← Утилиты шифрования
│   └── config/
│       └── mod.rs              ← Конфигурация приложения
└── main.rs                     ← УДАЛИТЬ нахуй
```

#### 1.2 Исправляем базовые проблемы

- [ ] **Удалить main.rs** - оставляем только lib.rs
- [ ] **Единый AppState** для всех платформ
- [ ] **Правильные пути БД** для Android/iOS
- [ ] **Заменить unwrap() на ?** с нормальной обработкой ошибок

### 🗃️ ЭТАП 2: Новые модели данных (Приоритет: ВЫСОКИЙ)

#### 2.1 Структуры для СМЭР модели

```rust
// === ПОЛЬЗОВАТЕЛИ ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: Uuid,                           // UUID вместо String
    pub email: String,
    pub name: Option<String>,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub preferred_language: String,         // Язык интерфейса
    pub goals: Vec<String>,                 // JSON массив целей
    pub experience_level: Option<String>,
    pub meditation_frequency: Option<String>,
    pub stress_level: Option<i32>,
    pub sleep_quality: Option<i32>,
    pub timezone: String,                   // Часовой пояс
    pub is_synced: bool,                   // Синхронизирован с сервером
    pub last_sync_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// === ЗАПИСИ ДНЕВНИКА (СМЭР) ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CBTEntry {
    pub id: Uuid,
    pub user_id: Uuid,
    pub entry_date: DateTime<Utc>,         // Когда произошло событие

    // СМЭР модель
    pub situation: String,                  // Ситуация
    pub thoughts: Vec<ThoughtChain>,       // Мысли (массив цепочек)
    pub reactions: String,                  // Реакции

    // Метаданные
    pub mood_score_before: Option<i32>,    // Настроение до (1-10)
    pub mood_score_after: Option<i32>,     // Настроение после (1-10)
    pub entry_duration_minutes: Option<i32>, // Сколько времени заполнял
    pub tags: Vec<String>,                 // Теги для поиска

    // ИИ анализ (будущее)
    pub ai_analysis: Option<AIAnalysis>,

    // Синхронизация
    pub is_synced: bool,
    pub server_id: Option<Uuid>,           // ID на сервере
    pub conflict_resolution: Option<String>, // JSON для разрешения конфликтов

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThoughtChain {
    pub id: Uuid,
    pub thought: String,                   // Текст мысли
    pub is_automatic: bool,               // Автоматическая мысль
    pub intensity: i32,                   // Интенсивность мысли (1-10)
    pub emotions: Vec<EmotionEntry>,      // Связанные эмоции
    pub cognitive_distortions: Vec<String>, // Выявленные искажения
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmotionEntry {
    pub emotion_id: i32,
    pub intensity: i32,                   // 1-10
    pub duration_minutes: Option<i32>,    // Как долго длилась эмоция
}

// === СИСТЕМА ЭМОЦИЙ ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmotionCategory {
    pub id: i32,
    pub name_key: String,                 // Ключ для переводов (emotion_category.anger)
    pub color: String,
    pub icon: Option<String>,             // Emoji или icon name
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Emotion {
    pub id: i32,
    pub category_id: i32,
    pub name_key: String,                 // Ключ для переводов (emotion.anger.rage)
    pub emoji: String,
    pub intensity_default: i32,           // Значение по умолчанию (1-10)
    pub synonyms: Vec<String>,           // Синонимы для поиска
    pub opposite_emotion_id: Option<i32>, // Противоположная эмоция
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

// === ИИ АНАЛИЗ (БУДУЩЕЕ) ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIAnalysis {
    pub cognitive_distortions: Vec<String>,
    pub suggestions: Vec<String>,
    pub mood_trend: String,               // improving/stable/declining
    pub confidence_score: f32,            // 0.0-1.0
    pub analysis_version: String,         // Версия ИИ модели
    pub processed_at: DateTime<Utc>,
}

// === ЛОКАЛИЗАЦИЯ ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Translation {
    pub id: i32,
    pub language_code: String,            // ru, en, es, etc.
    pub translation_key: String,          // emotion.anger.rage
    pub translation_value: String,        // Ярость
    pub context: Option<String>,          // Контекст использования
    pub created_at: DateTime<Utc>,
}

// === СИНХРОНИЗАЦИЯ ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncOperation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub operation_type: String,           // INSERT/UPDATE/DELETE
    pub table_name: String,
    pub record_id: Uuid,
    pub data_snapshot: String,            // JSON снапшот данных
    pub created_at: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
    pub retry_count: i32,
    pub last_error: Option<String>,
}

// === АНАЛИТИКА ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserStats {
    pub user_id: Uuid,
    pub total_entries: i32,
    pub current_streak_days: i32,
    pub longest_streak_days: i32,
    pub avg_mood_score: f32,
    pub most_common_emotion_id: Option<i32>,
    pub entries_this_week: i32,
    pub entries_this_month: i32,
    pub last_calculated_at: DateTime<Utc>,
}
```

#### 2.2 SQL схема с индексами

```sql
-- Пользователи
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- UUID в виде строки
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    age INTEGER CHECK (age > 0 AND age < 150),
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    preferred_language TEXT NOT NULL DEFAULT 'en',
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

-- Категории эмоций
CREATE TABLE emotion_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_key TEXT NOT NULL,                 -- emotion_category.anger
    color TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL
);

-- Эмоции
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

-- Записи дневника (СМЭР)
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

-- Переводы
CREATE TABLE translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_code TEXT NOT NULL,
    translation_key TEXT NOT NULL,
    translation_value TEXT NOT NULL,
    context TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(language_code, translation_key)
);

-- Операции синхронизации
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

-- Статистика пользователей
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

-- === ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ ===

-- Пользователи
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_synced ON users(is_synced);
CREATE INDEX idx_users_last_sync_at ON users(last_sync_at);

-- Записи дневника
CREATE INDEX idx_cbt_entries_user_id ON cbt_entries(user_id);
CREATE INDEX idx_cbt_entries_entry_date ON cbt_entries(entry_date);
CREATE INDEX idx_cbt_entries_user_date ON cbt_entries(user_id, entry_date DESC);
CREATE INDEX idx_cbt_entries_is_synced ON cbt_entries(is_synced);
CREATE INDEX idx_cbt_entries_server_id ON cbt_entries(server_id);
CREATE INDEX idx_cbt_entries_created_at ON cbt_entries(created_at);

-- Эмоции
CREATE INDEX idx_emotions_category_id ON emotions(category_id);
CREATE INDEX idx_emotions_name_key ON emotions(name_key);
CREATE INDEX idx_emotions_is_active ON emotions(is_active);
CREATE INDEX idx_emotions_sort_order ON emotions(category_id, sort_order);

-- Категории эмоций
CREATE INDEX idx_emotion_categories_name_key ON emotion_categories(name_key);
CREATE INDEX idx_emotion_categories_is_active ON emotion_categories(is_active);
CREATE INDEX idx_emotion_categories_sort_order ON emotion_categories(sort_order);

-- Переводы
CREATE INDEX idx_translations_language ON translations(language_code);
CREATE INDEX idx_translations_key ON translations(translation_key);
CREATE INDEX idx_translations_lang_key ON translations(language_code, translation_key);

-- Синхронизация
CREATE INDEX idx_sync_operations_user_id ON sync_operations(user_id);
CREATE INDEX idx_sync_operations_synced_at ON sync_operations(synced_at);
CREATE INDEX idx_sync_operations_created_at ON sync_operations(created_at);
CREATE INDEX idx_sync_operations_retry_count ON sync_operations(retry_count);

-- Полнотекстовый поиск
CREATE VIRTUAL TABLE cbt_entries_fts USING fts5(
    situation, reactions, thoughts_text,
    content='cbt_entries',
    content_rowid='rowid'
);
```

### 🔧 ЭТАП 3: Функциональность (Приоритет: СРЕДНИЙ)

#### 3.1 Система миграций

```rust
pub struct Migration {
    pub version: i32,
    pub name: String,
    pub up_sql: String,
    pub down_sql: String,
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Создаём таблицу версий
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )
    "#).execute(pool).await?;

    // Получаем текущую версию
    let current_version: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations"
    ).fetch_one(pool).await?;

    // Применяем новые миграции
    for migration in get_migrations() {
        if migration.version > current_version {
            apply_migration(pool, &migration).await?;
        }
    }

    Ok(())
}
```

#### 3.2 Локальное шифрование

```rust
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::Argon2;

pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    pub fn encrypt_sensitive_data(&self, data: &str) -> Result<String, CryptoError> {
        // Шифруем ПД пользователя (заметки, мысли)
    }

    pub fn decrypt_sensitive_data(&self, encrypted: &str) -> Result<String, CryptoError> {
        // Расшифровываем ПД
    }
}
```

#### 3.3 Офлайн синхронизация

```rust
pub struct OfflineQueue {
    db: Arc<Database>,
}

impl OfflineQueue {
    pub async fn queue_operation(
        &self,
        user_id: Uuid,
        operation: SyncOperation,
    ) -> Result<(), DatabaseError> {
        // Добавляем операцию в очередь синхронизации
    }

    pub async fn process_queue(&self) -> Result<Vec<SyncResult>, DatabaseError> {
        // Обрабатываем очередь когда появился интернет
    }

    pub async fn resolve_conflicts(
        &self,
        conflicts: Vec<SyncConflict>
    ) -> Result<(), DatabaseError> {
        // Разрешаем конфликты синхронизации
    }
}
```

#### 3.4 Мультиязычность

```rust
pub struct I18nService {
    db: Arc<Database>,
    current_language: String,
    fallback_language: String,
}

impl I18nService {
    pub async fn translate(&self, key: &str) -> String {
        // Получает перевод по ключу
        // emotion.anger.rage -> "Ярость"
    }

    pub async fn get_emotions_for_language(&self, lang: &str) -> Vec<LocalizedEmotion> {
        // Возвращает эмоции на нужном языке
    }

    pub async fn seed_translations(&self) -> Result<(), DatabaseError> {
        // Заполняет базовые переводы
    }
}
```

### 📱 ЭТАП 4: Мобильная оптимизация (Приоритет: НИЗКИЙ)

#### 4.1 Правильные пути файлов

```rust
use tauri::api::path;

pub fn get_database_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data_dir = path::app_data_dir(&tauri::Config::default())?;
    let db_dir = app_data_dir.join("cbd_diary");

    // Создаём директорию если не существует
    std::fs::create_dir_all(&db_dir)?;

    Ok(db_dir.join("diary.db"))
}
```

#### 4.2 Производительность

- [ ] **Lazy loading** записей дневника
- [ ] **Пагинация** с курсорами
- [ ] **Кеширование** эмоций и категорий
- [ ] **Сжатие** больших JSON полей
- [ ] **Оптимизация запросов** с EXPLAIN QUERY PLAN

### 🛡️ ЭТАП 5: Безопасность и валидация

#### 5.1 Валидация данных

```rust
use validator::{Validate, ValidationError};

#[derive(Validate)]
pub struct CBTEntryInput {
    #[validate(length(min = 5, max = 5000, message = "Ситуация должна быть 5-5000 символов"))]
    pub situation: String,

    #[validate(length(max = 5000, message = "Реакции должны быть до 5000 символов"))]
    pub reactions: String,

    #[validate(range(min = 1, max = 10, message = "Настроение должно быть 1-10"))]
    pub mood_score_before: Option<i32>,

    #[validate(custom = "validate_thoughts")]
    pub thoughts: Vec<ThoughtChainInput>,
}

fn validate_thoughts(thoughts: &[ThoughtChainInput]) -> Result<(), ValidationError> {
    if thoughts.is_empty() {
        return Err(ValidationError::new("Должна быть хотя бы одна мысль"));
    }
    if thoughts.len() > 10 {
        return Err(ValidationError::new("Максимум 10 цепочек мыслей"));
    }
    Ok(())
}
```

#### 5.2 CSP и безопасность

```json
// tauri.conf.json
{
	"app": {
		"security": {
			"csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.deepseek.com;"
		}
	}
}
```

## 📝 Данные для заполнения

### Категории эмоций (5 основных)

```rust
let categories = [
    ("emotion_category.anger", "Гнев", "#FF6B6B", "😠", 1),
    ("emotion_category.fear", "Страх", "#4ECDC4", "😨", 2),
    ("emotion_category.sadness", "Грусть", "#45B7D1", "😢", 3),
    ("emotion_category.joy", "Радость", "#96CEB4", "😊", 4),
    ("emotion_category.love", "Любовь", "#FFEAA7", "❤️", 5),
];
```

### Базовые эмоции (топ-20 по категориям)

```rust
let emotions = [
    // Гнев (уменьшено до 20 вместо 80)
    (1, "emotion.anger.rage", "Ярость", "🤬", 8),
    (1, "emotion.anger.fury", "Бешенство", "😡", 9),
    (1, "emotion.anger.irritation", "Раздражение", "😤", 5),
    (1, "emotion.anger.annoyance", "Досада", "😒", 3),
    (1, "emotion.anger.resentment", "Обида", "😞", 6),

    // Страх (топ-20)
    (2, "emotion.fear.terror", "Ужас", "😱", 9),
    (2, "emotion.fear.panic", "Паника", "😰", 8),
    (2, "emotion.fear.anxiety", "Тревога", "😟", 6),
    (2, "emotion.fear.worry", "Беспокойство", "😮", 5),
    (2, "emotion.fear.nervousness", "Нервозность", "😬", 4),

    // И так далее...
];
```

### Переводы для мультиязычности

```rust
let translations = [
    // Английский
    ("en", "emotion_category.anger", "Anger"),
    ("en", "emotion.anger.rage", "Rage"),
    ("en", "ui.add_entry", "Add Entry"),

    // Испанский
    ("es", "emotion_category.anger", "Ira"),
    ("es", "emotion.anger.rage", "Rabia"),
    ("es", "ui.add_entry", "Añadir Entrada"),

    // Русский (по умолчанию уже есть)
    ("ru", "emotion_category.anger", "Гнев"),
    ("ru", "emotion.anger.rage", "Ярость"),
    ("ru", "ui.add_entry", "Добавить запись"),
];
```

## ⚡ Приоритизация задач

### 🔴 Критические (делать ПЕРВЫМИ):

1. Удалить main.rs, объединить в lib.rs
2. Исправить пути БД для Android/iOS
3. Создать новые модели данных с UUID
4. Миграции и индексы
5. Заменить unwrap() на нормальную обработку ошибок

### 🟡 Важные (делать ВТОРЫМИ):

1. Система валидации данных
2. Мультиязычность (базовая)
3. Офлайн очередь синхронизации
4. Локальное шифрование ПД
5. Оптимизация производительности

### 🟢 Желательные (делать ПОСЛЕДНИМИ):

1. Полнотекстовый поиск
2. Аналитика и статистика
3. Экспорт/импорт данных
4. Расширенная мультиязычность
5. ИИ анализ (после появления бэка)

## 🧪 Тестирование

### Тестовые сценарии для каждого этапа:

- [ ] **Unit тесты** для всех моделей данных
- [ ] **Интеграционные тесты** для БД операций
- [ ] **Тесты миграций** на пустой и заполненной БД
- [ ] **Тесты синхронизации** с имитацией конфликтов
- [ ] **Тесты производительности** с 10k+ записей
- [ ] **Тесты на реальных устройствах** Android/iOS
- [ ] **Тесты мультиязычности** для всех языков
- [ ] **Тесты шифрования** чувствительных данных

## 📊 Метрики успеха

- ✅ Единая архитектура без дублирования кода
- ✅ Данные сохраняются между сессиями на всех платформах
- ✅ UUID везде для консистентности
- ✅ Все ошибки обрабатываются gracefully
- ✅ Время отклика < 50ms для базовых операций
- ✅ Время отклика < 200ms для сложных запросов
- ✅ Поддержка 3+ языков интерфейса
- ✅ Локальное шифрование чувствительных данных
- ✅ Покрытие тестами > 85%
- ✅ Готовность к серверной синхронизации
- ✅ Поддержка 50k+ записей без тормозов

## 🚨 Риски и митигация

### Риск: Потеря данных при миграции

**Митигация**: Полный бэкап БД + тесты миграций + откат

### Риск: Проблемы с производительностью

**Митигация**: Профилирование + индексы + тесты нагрузки

### Риск: Конфликты при будущей синхронизации

**Митигация**: Продуманная архитектура конфликтов + тесты

### Риск: Проблемы с мультиязычностью

**Митигация**: Единая система ключей + fallback на английский

### Риск: Сложность отладки шифрования

**Митигация**: Опциональное шифрование + подробное логирование

---

## 📅 Временные рамки

- **Этап 1**: 3-4 дня (критическая архитектура)
- **Этап 2**: 3-4 дня (новые модели + миграции)
- **Этап 3**: 4-5 дней (функциональность)
- **Этап 4**: 2-3 дня (мобильная оптимизация)
- **Этап 5**: 2-3 дня (безопасность)
- **Тестирование**: 3-4 дня (комплексное тестирование)

**Общий срок**: 2.5-3 недели

---

> **Помни**: Это фундамент на который будет опираться вся архитектура с сервером. Лучше потратить время сейчас, чем переделывать потом! 🏗️

## 🎯 Дополнительные фичи для будущего

### После подключения сервера:

- [ ] Синхронизация данных между устройствами
- [ ] Совместный анализ с ИИ (DeepSeek API)
- [ ] Облачный бэкап и восстановление
- [ ] Социальные функции (поделиться прогрессом)
- [ ] Интеграция с носимыми устройствами
- [ ] Напоминания и уведомления
- [ ] Экспорт для психотерапевтов

### Продвинутая аналитика:

- [ ] Графики трендов настроения
- [ ] Корреляции эмоций с событиями
- [ ] Паттерны когнитивных искажений
- [ ] Рекомендации по упражнениям КПТ
- [ ] Прогнозирование настроения
- [ ] Персональные инсайты от ИИ
