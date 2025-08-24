# 🧠 CBD Mood Diary - Дневник настроения с КПТ

**Мобильное приложение с сервером для ведения дневника настроения на основе когнитивно-поведенческой терапии**

## 📁 Структура проекта

### 📱 [CBD Mobile App + Server](./cbd/)

**Кроссплатформенное мобильное приложение с бэкендом**

Современное мобильное приложение для отслеживания эмоционального состояния с использованием принципов когнитивно-поведенческой терапии и ИИ-анализом.

**Архитектура:**

- **Mobile Frontend**: Tauri 2.0 + Vue 3 + TypeScript + Quasar 2
- **Backend Server**:
- **ИИ**: DeepSeek API для анализа эмоций и паттернов

**Основные функции:**

- Структурированные записи по модели СМЭР (Ситуация-Мысль-Эмоция-Реакция)
- ИИ анализ когнитивных искажений и паттернов мышления
- \*Система достижений и геймификация для мотивации
- \*Детальная аналитика и отчеты по настроению
- \*Офлайн/онлайн синхронизация данных

[Подробная документация →](./cbd/README.md)

### 🚀 [CBD Web API Server](./cbd.web-api/)

**REST API сервер на Rust + Rocket для мобильного приложения**

Высокопроизводительный API сервер, построенный на Rocket веб-фреймворке для обслуживания мобильного приложения CBD Mood Diary.

**Технологии:**

- **Backend Server**:
- **Аутентификация**: JWT токены + bcrypt хеширование +oAuth 2.0
- **ИИ Интеграция**: DeepSeek API для анализа эмоций
- **База данных**: PostgreSQL с SQLx ORM

[Подробная документация API →](./cbd.web-api/README.md)

## 🛠️ Быстрый старт

### Запуск CBD мобильного приложения

```bash
cd cbd
npm install
npm run tauri dev
```

### Запуск CBD API сервера

```bash
cd cbd.web-api
cargo run
```

## 🏗️ Архитектура решения

CBD приложение построено по принципу мобильного приложения с отдельным API сервером:

- **Мобильное приложение** (`cbd/`) - Tauri + Vue 3 для UI/UX и локального хранения
- **API Сервер** (`cbd.web-api/`)
- **База данных** (PostgreSQL)

### System Prompt (MVP версия)

```md
**Роль:** Опытный КПТ-терапевт. Работаешь по четкому алгоритму: вникаешь в ситуацию → находишь глубинное убеждение → оспариваешь его.

**Кризисный протокол (приоритет):**

- Ключевые слова: `суицид`, `навредить себе`, `не могу жить` → `"Сейчас вы в безопасности? Назовите контакт доверенного лица для экстренной связи"`
- Ключевые слова: `насилие`, `абьюз`, `опасно` → `"Нужна срочная помощь? Связать вас со службой поддержки? [Да/Нет]"`

**Алгоритм работы:**

**ШАГ 1: Понимание ситуации (2-3 вопроса)**

- `"Что именно произошло в этой ситуации?"`
- `"Какие мысли у вас возникли в тот момент?"`
- `"Что вы почувствовали физически?"`

**ШАГ 2: Поиск глубинного убеждения (ГУ)**
_Внутренний анализ (НЕ ОЗВУЧИВАТЬ):_

- Ищи паттерны: "я должен...", "если не..., то...", "все всегда..."
- Критерии уверенности ≥80%:
  1. Абсолютизация ("всегда/никогда/все")
  2. Долженствование ("должен/обязан")
  3. Катастрофизация ("ужасно/конец")
  4. Эмоциональная интенсивность >7/10

_Проверочные вопросы до достижения 80% уверенности:_

- `"Что самое страшное может случиться, если...?"`
- `"Что это говорит о вас как о человеке?"`
- `"Какое правило вы нарушили?"`

**ШАГ 3: Озвучивание ГУ**
`"Я предполагаю, что у вас есть убеждение: '[формулировка ГУ]'. Это близко к правде?"`

**ШАГ 4: Диспут (с согласия пользователя)**
`"Готовы ли вы исследовать это убеждение? Это может быть не очень комфортно."`

При согласии - выбрать тип диспута:

- **Логический:** `"Какие есть доказательства ЗА и ПРОТИВ этого убеждения?"`
- **Эмпирический:** `"Знаете ли вы людей, для которых это правило не работает?"`
- **Прагматический:** `"Как это убеждение влияет на вашу жизнь - помогает или мешает?"`
- **Поведенческий:** `"Что случилось, когда вы действовали вопреки этому правилу?"`

**Критические правила:**

- Один вопрос за раз
- Не диагностировать, не давать советы без запроса
- При отказе от диспута - завершить поддерживающе
- Максимум 15 минут на сессию
```

## 📋 Требования

- **Rust** 1.70+
- **Node.js** 18+
- **PostgreSQL** 14+
- **Git**

## 📄 Лицензия

MIT License

---

_Мобильное приложение в папке `cbd/`, API сервер в папке `cbd.web-api/`._

## 📊 Архитектура CBD Mobile App (Обновлено после рефакторинга)

### 🗄️ **Схема базы данных SQLite**

**Полностью переработанная модульная архитектура с поддержкой СМЭР методологии:**

```sql
-- === ПОЛЬЗОВАТЕЛИ ===
users (
    id TEXT PRIMARY KEY,                    -- UUID
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    age INTEGER,
    gender TEXT,
    preferred_language TEXT DEFAULT 'ru',
    goals TEXT DEFAULT '[]',                -- JSON массив
    experience_level TEXT,
    meditation_frequency TEXT,
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
    timezone TEXT DEFAULT 'UTC',
    is_synced BOOLEAN DEFAULT FALSE,
    last_sync_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- === ЗАПИСИ ДНЕВНИКА (СМЭР) ===
cbt_entries (
    id TEXT PRIMARY KEY,                    -- UUID
    user_id TEXT NOT NULL REFERENCES users(id),
    entry_date TEXT NOT NULL,               -- ISO 8601

    -- СМЭР модель
    situation TEXT NOT NULL,
    thoughts TEXT NOT NULL,                 -- JSON массив ThoughtChain
    reactions TEXT NOT NULL,

    -- Оценка настроения
    mood_score_before INTEGER CHECK (mood_score_before BETWEEN 1 AND 10),
    mood_score_after INTEGER CHECK (mood_score_after BETWEEN 1 AND 10),
    entry_duration_minutes INTEGER,
    tags TEXT DEFAULT '[]',                 -- JSON массив тегов

    -- ИИ анализ
    ai_analysis TEXT,                       -- JSON объект AIAnalysis

    -- Синхронизация
    is_synced BOOLEAN DEFAULT FALSE,
    server_id TEXT,
    conflict_resolution TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- === СИСТЕМА ЭМОЦИЙ ===
emotion_categories (
    id INTEGER PRIMARY KEY,
    name_key TEXT UNIQUE NOT NULL,          -- "emotion.category.anger"
    color TEXT DEFAULT '#FF5722',
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

emotions (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES emotion_categories(id),
    name_key TEXT UNIQUE NOT NULL,          -- "emotion.anger.rage"
    emoji TEXT NOT NULL,                    -- "🤬"
    intensity_default INTEGER DEFAULT 5,
    synonyms TEXT DEFAULT '[]',             -- JSON массив синонимов
    opposite_emotion_id INTEGER REFERENCES emotions(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- === ЛОКАЛИЗАЦИЯ ===
translations (
    id INTEGER PRIMARY KEY,
    language_code TEXT NOT NULL,            -- "ru", "en", "es"
    translation_key TEXT NOT NULL,         -- "emotion.anger.rage"
    translation_value TEXT NOT NULL,       -- "Ярость"
    context TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language_code, translation_key)
);

-- === СИНХРОНИЗАЦИЯ ===
sync_operations (
    id TEXT PRIMARY KEY,                    -- UUID
    user_id TEXT NOT NULL REFERENCES users(id),
    operation_type TEXT NOT NULL,          -- "INSERT", "UPDATE", "DELETE"
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    data_snapshot TEXT NOT NULL,           -- JSON снапшот данных
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- === АНАЛИТИКА ===
user_stats (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    total_entries INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    avg_mood_score REAL DEFAULT 0.0,
    most_common_emotion_id INTEGER REFERENCES emotions(id),
    entries_this_week INTEGER DEFAULT 0,
    entries_this_month INTEGER DEFAULT 0,
    last_calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 🏗️ **Архитектура Rust бэкенда**

**Модульная структура с четким разделением ответственности:**

```
src-tauri/src/
├── auth/              # JWT, OAuth, биометрия
├── config/            # Конфигурация приложения
├── database/          # SQLite + SQLx ORM
│   ├── mod.rs         # Database struct, подключение
│   ├── models.rs      # Rust модели данных
│   ├── queries.rs     # CRUD операции с seed данными
│   ├── migrations.rs  # Версионированные миграции
│   ├── indexes.rs     # Оптимизация производительности
│   └── encryption.rs  # Шифрование чувствительных данных
├── i18n/              # Многоязычность
├── sync/              # Синхронизация с сервером
├── utils/             # Обработка ошибок, валидация
│   └── errors.rs      # AppError с логированием
└── lib.rs             # Tauri команды API
```

### 📱 **Текущие возможности приложения**

**1. Аутентификация и профиль**

- Создание/вход пользователя по email
- Расширенный профиль с целями, опытом, биометрикой
- Поддержка смены языка (русский/английский/испанский)

**2. Записи дневника по модели СМЭР**

- **Ситуация**: Детальное описание события
- **Мысли**: Структурированные цепочки мыслей с эмоциями
- **Эмоции**: 50 эмоций в 5 категориях с интенсивностью 1-10
- **Реакции**: Поведенческие и физиологические реакции

**3. Продвинутая система эмоций**

- 5 категорий: Гнев, Страх, Грусть, Радость, Любовь
- 50+ конкретных эмоций с emoji и синонимами
- Многоязычные названия эмоций из БД
- Колесо эмоций с интуитивным UI

**4. Надёжное хранение данных**

- SQLite с полнотекстовым поиском (FTS5)
- 15+ индексов для быстрых запросов
- Подготовка к серверной синхронизации (UUID ID)
- Конфликт-резолюшн и оффлайн режим

**5. Готовность к ИИ и аналитике**

- Структура для хранения ИИ анализа когнитивных искажений
- Статистика настроения и стриков записей
- Экспорт данных в JSON для анализа
- Поддержка тегов и категоризации

### 🤖 Анализ системного промпта

**Текущий промпт (из README.md)**:

```markdown
**Роль:** Ты опытный психотерапевт, специализирующийся на КПТ и ДБТ.
Работаешь строго по шагам, задавая только по одному вопросу за раз.
Никаких лишних комментариев, пояснений или выводов.

**Основные шаги:**

1. Уточняющие вопросы (2-4) - Ситуация, Мысли, Эмоции, Реакции + новые типы
2. Проверка понимания - резюме с подтверждением
3. Скрытая гипотеза и проверка - внутренний анализ
4. Интервенция - КПТ диспут или ДБТ упражнения
5. Закрепление прогресса - формулировка противоположного факта
```

**❌ Проблемы текущего промпта:**

1. **Слишком сложная структура** - 5 шагов с подшагами перегружают ИИ
2. **Противоречивые инструкции** - "никаких пояснений" vs детальные техники
3. **Недостаточная персонализация** - не учитывает профиль пользователя
4. **Отсутствие контекста** - не использует данные из предыдущих записей
5. **Неясные критерии** - субъективные оценки "уверенности"
6. **Слишком жесткий формат** - не адаптируется к ситуации пользователя

### 💡 Рекомендации по улучшению

**1. Упрощение архитектуры данных**

```typescript
// Новая структура записи
interface CBTEntry {
	id: string;
	userId: string;
	timestamp: string;

	// СМЭР модель
	situation: string;
	thoughts: ThoughtChain[];
	reactions: string;

	// ИИ анализ
	aiAnalysis?: {
		cognitiveDistortions: string[];
		suggestions: string[];
		mood_trend: 'improving' | 'stable' | 'declining';
	};
}

interface ThoughtChain {
	thought: string;
	emotions: {
		emotionId: number;
		intensity: number;
	}[];
	automaticThought?: boolean; // ИИ детектит автоматические мысли
}
```

**2. Улучшенный системный промпт**

```markdown
РОЛЬ: КПТ-терапевт для мобильного приложения

КОНТЕКСТ: Пользователь заполнил запись СМЭР:

- Ситуация: {situation}
- Мысли: {thoughts}
- Эмоции: {emotions}
- Реакции: {reactions}
- История: {previous_entries_summary}

ЗАДАЧА: Дать 1 короткий инсайт + 1 практический совет (макс 150 слов)

ФОКУС:

- Выявить 1 главное когнитивное искажение
- Предложить 1 конкретную технику КПТ
- Учесть прогресс пользователя

ФОРМАТ:
💡 Инсайт: [искажение мышления]
🛠️ Совет: [техника КПТ]
```

**3. Постепенная реализация**

- Этап 1: Исправить дублирование данных
- Этап 2: Упростить UI создания записей
- Этап 3: Интегрировать улучшенный ИИ-анализ
- Этап 4: Добавить редактирование и экспорт данных
