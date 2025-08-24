use sqlx::SqlitePool;
use chrono::Utc;
use uuid::Uuid;
use crate::database::models::*;

// === ЗАПОЛНЕНИЕ НАЧАЛЬНЫХ ДАННЫХ ===

pub async fn seed_emotion_categories(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    log::info!("🎭 Заполняем категории эмоций...");
    
    let now = Utc::now().to_rfc3339();
    let categories = [
        ("emotion_category.anger", "Гнев", "#FF6B6B", "😠", 1),
        ("emotion_category.shame", "Стыд", "#F59E0B", "😳", 2),
        ("emotion_category.sadness", "Грусть", "#60A5FA", "😢", 3),
        ("emotion_category.fear", "Страх", "#A78BFA", "😰", 4),
        ("emotion_category.joy", "Радость", "#FCD34D", "😊", 5),
    ];

    for (name_key, _name, color, icon, sort_order) in categories {
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO emotion_categories 
            (name_key, color, icon, sort_order, is_active, created_at) 
            VALUES (?, ?, ?, ?, TRUE, ?)
            "#
        )
        .bind(name_key)
        .bind(color)
        .bind(icon)
        .bind(sort_order)
        .bind(&now)
        .execute(pool)
        .await?;
    }

    log::info!("✅ Категории эмоций заполнены!");
    Ok(())
}

pub async fn seed_emotions(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    log::info!("😊 Заполняем эмоции...");
    let now = Utc::now().to_rfc3339();

    let anger = [
        "Холодность","Злость","Бешенство","Сарказм","Раздражение","Ярость","Унижение","Обида","Ненависть",
        "Нетерпение","Отвращение","Надменность","Злорадство","Недовольство","Цинизм","Протест","Неистовость",
        "Враждебность","Равнодушие","Безучастность","Неприязнь","Пренебрежение","Зависть","Мстительность","Высокомерие"
    ];
    let shame = [
        "Вина","Раскаяние","Унижение","Нечестность","Угрызение совести","Стеснение","Неловкость","Похоть",
        "Ущербность","Растерянность","Обман","Потеря лица","Смущение","Позор","Сожаление","Расщепление",
        "Озабоченность","Брошенность","Замкнутость","Угрюмость","Угнетённость","Пассивность","Отвержение"
    ];
    let sadness = [
        "Огорчение","Горе","Боль","Угнетённость","Отвращение","Одиночество","Отчуждение","Разочарование",
        "Поражение","Жалость к себе","Унижение","Тоска","Подавленность","Предательство","Скука","Печаль",
        "Апатия","Равнодушие","Примирение","Раздражение","Обида","Скорбь","Отвержение","Отчаяние","Ущемлённость"
    ];
    let fear = [
        "Волнение","Испуг","Паника","Беспокойство","Неуверенность","Боязливость","Подозрительность","Трусость",
        "Нерешительность","Настороженность","Смятение","Тревога","Ужас","Опасение","Робость","Застенчивость",
        "Безнадёжность","Сдержанность","Скрытность","Скованность","Замешательство","Ошарашенность","Озадаченность"
    ];
    let joy = [
        "Благодарность","Доверие","Воодушевление","Озарение","Сопричастность","Умиротворение","Радушие","Единство",
        "Торжественность","Наслаждение","Общность","Восторг","Благодать","Поддержка","Веселье","Надежда","Уверенность",
        "Лёгкость","Любовь","Удовлетворение","Облегчение","Обожание","Преклонение","Подъём духа","Энтузиазм"
    ];

    let mut insert_list = Vec::new();
    let mut order = 1;
    for ru in anger { insert_list.push((1, format!("emotion.anger.{}", ru.replace(' ', "_")), "😠", order)); order+=1; }
    order = 1; for ru in shame { insert_list.push((2, format!("emotion.shame.{}", ru.replace(' ', "_")), "😳", order)); order+=1; }
    order = 1; for ru in sadness { insert_list.push((3, format!("emotion.sadness.{}", ru.replace(' ', "_")), "😢", order)); order+=1; }
    order = 1; for ru in fear { insert_list.push((4, format!("emotion.fear.{}", ru.replace(' ', "_")), "😰", order)); order+=1; }
    order = 1; for ru in joy { insert_list.push((5, format!("emotion.joy.{}", ru.replace(' ', "_")), "😊", order)); order+=1; }

    for (cat_id, key, emoji, sort_order) in insert_list {
        sqlx::query(
            r#"INSERT OR IGNORE INTO emotions (category_id, name_key, emoji, intensity_default, synonyms, sort_order, is_active, created_at)
               VALUES (?, ?, ?, 5, '[]', ?, TRUE, ?)"#
        )
        .bind(cat_id)
        .bind(key)
        .bind(emoji)
        .bind(sort_order)
        .bind(&now)
        .execute(pool)
        .await?;
    }

    log::info!("✅ Эмоции заполнены (5 категорий)");
    Ok(())
}

pub async fn seed_translations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    log::info!("🌍 Заполняем переводы...");
    
    let now = Utc::now().to_rfc3339();
    
    let translations = [
        // Русский (базовый)
        ("ru", "emotion_category.anger", "Гнев"),
        ("ru", "emotion_category.fear", "Страх"),
        ("ru", "emotion_category.sadness", "Грусть"),
        ("ru", "emotion_category.joy", "Радость"),
        ("ru", "emotion_category.love", "Любовь"),
        
        // Английский
        ("en", "emotion_category.anger", "Anger"),
        ("en", "emotion_category.fear", "Fear"),
        ("en", "emotion_category.sadness", "Sadness"),
        ("en", "emotion_category.joy", "Joy"),
        ("en", "emotion_category.love", "Love"),
        
        // Испанский
        ("es", "emotion_category.anger", "Ira"),
        ("es", "emotion_category.fear", "Miedo"),
        ("es", "emotion_category.sadness", "Tristeza"),
        ("es", "emotion_category.joy", "Alegría"),
        ("es", "emotion_category.love", "Amor"),
        
        // Переводы некоторых эмоций
        ("ru", "emotion.anger.rage", "Ярость"),
        ("en", "emotion.anger.rage", "Rage"),
        ("es", "emotion.anger.rage", "Rabia"),
        
        ("ru", "emotion.fear.anxiety", "Тревога"),
        ("en", "emotion.fear.anxiety", "Anxiety"),
        ("es", "emotion.fear.anxiety", "Ansiedad"),
        
        ("ru", "emotion.joy.happiness", "Счастье"),
        ("en", "emotion.joy.happiness", "Happiness"),
        ("es", "emotion.joy.happiness", "Felicidad"),
        
        // Интерфейс
        ("ru", "ui.add_entry", "Добавить запись"),
        ("en", "ui.add_entry", "Add Entry"),
        ("es", "ui.add_entry", "Añadir Entrada"),
        
        ("ru", "ui.situation", "Ситуация"),
        ("en", "ui.situation", "Situation"),
        ("es", "ui.situation", "Situación"),
        
        ("ru", "ui.thoughts", "Мысли"),
        ("en", "ui.thoughts", "Thoughts"),
        ("es", "ui.thoughts", "Pensamientos"),
        
        ("ru", "ui.emotions", "Эмоции"),
        ("en", "ui.emotions", "Emotions"),
        ("es", "ui.emotions", "Emociones"),
        
        ("ru", "ui.reactions", "Реакции"),
        ("en", "ui.reactions", "Reactions"),
        ("es", "ui.reactions", "Reacciones"),
    ];

    for (language_code, translation_key, translation_value) in translations {
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO translations 
            (language_code, translation_key, translation_value, created_at) 
            VALUES (?, ?, ?, ?)
            "#
        )
        .bind(language_code)
        .bind(translation_key)
        .bind(translation_value)
        .bind(&now)
        .execute(pool)
        .await?;
    }

    log::info!("✅ Переводы заполнены!");
    Ok(())
}

// === CRUD ОПЕРАЦИИ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ===

pub async fn create_user(
    pool: &SqlitePool,
    input: &CreateUserInput,
) -> Result<User, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let preferred_language = input.preferred_language.as_deref().unwrap_or("ru");

    sqlx::query(
        r#"
        INSERT INTO users 
        (id, email, name, preferred_language, goals, timezone, is_synced, created_at, updated_at) 
        VALUES (?, ?, ?, ?, '[]', 'UTC', FALSE, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&input.email)
    .bind(&input.name)
    .bind(preferred_language)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    get_user_by_id(pool, &id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn get_user_by_email(
    pool: &SqlitePool,
    email: &str,
) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = ?")
        .bind(email)
        .fetch_optional(pool)
        .await
}

pub async fn get_user_by_id(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(pool)
        .await
}

pub async fn update_user_profile(
    pool: &SqlitePool,
    user_id: &str,
    input: &UpdateUserProfileInput,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    let goals_json = if let Some(goals) = &input.goals {
        vec_to_json_string(goals).unwrap_or_default()
    } else {
        "[]".to_string()
    };

    sqlx::query(
        r#"
        UPDATE users SET 
            name = COALESCE(?, name),
            age = COALESCE(?, age),
            gender = COALESCE(?, gender),
            goals = ?,
            experience_level = COALESCE(?, experience_level),
            meditation_frequency = COALESCE(?, meditation_frequency),
            stress_level = COALESCE(?, stress_level),
            sleep_quality = COALESCE(?, sleep_quality),
            updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(&input.name)
    .bind(input.age)
    .bind(&input.gender)
    .bind(goals_json)
    .bind(&input.experience_level)
    .bind(&input.meditation_frequency)
    .bind(input.stress_level)
    .bind(input.sleep_quality)
    .bind(&now)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

// === CRUD ОПЕРАЦИИ ДЛЯ ЗАПИСЕЙ ДНЕВНИКА ===

pub async fn create_cbt_entry(
    pool: &SqlitePool,
    user_id: &str,
    input: &CreateCBTEntryInput,
) -> Result<CBTEntry, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let entry_date = input.entry_date.unwrap_or(now);
    let thoughts_json = vec_to_json_string(&input.thoughts).unwrap_or_default();
    let tags_json = vec_to_json_string(&input.tags.as_ref().unwrap_or(&vec![])).unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO cbt_entries 
        (id, user_id, entry_date, situation, thoughts, reactions, 
         mood_score_before, mood_score_after, tags, is_synced, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)
        "#
    )
    .bind(&id)
    .bind(user_id)
    .bind(entry_date.to_rfc3339())
    .bind(&input.situation)
    .bind(thoughts_json)
    .bind(&input.reactions)
    .bind(input.mood_score_before)
    .bind(input.mood_score_after)
    .bind(tags_json)
    .bind(now.to_rfc3339())
    .bind(now.to_rfc3339())
    .execute(pool)
    .await?;

    get_cbt_entry_by_id(pool, &id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn get_cbt_entry_by_id(
    pool: &SqlitePool,
    entry_id: &str,
) -> Result<Option<CBTEntry>, sqlx::Error> {
    sqlx::query_as::<_, CBTEntry>("SELECT * FROM cbt_entries WHERE id = ?")
        .bind(entry_id)
        .fetch_optional(pool)
        .await
}

pub async fn get_user_cbt_entries(
    pool: &SqlitePool,
    user_id: &str,
    limit: Option<i32>,
) -> Result<Vec<CBTEntry>, sqlx::Error> {
    let limit = limit.unwrap_or(50);
    
    sqlx::query_as::<_, CBTEntry>(
        "SELECT * FROM cbt_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT ?"
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn update_cbt_entry(
    pool: &SqlitePool,
    entry_id: &str,
    input: &UpdateCBTEntryInput,
) -> Result<CBTEntry, sqlx::Error> {
    let now = Utc::now().to_rfc3339();

    // Преобразуем опциональные поля в JSON где нужно
    let thoughts_json = input
        .thoughts
        .as_ref()
        .map(|v| vec_to_json_string(v).unwrap_or_default());
    let tags_json = input
        .tags
        .as_ref()
        .map(|v| vec_to_json_string(v).unwrap_or_default());

    sqlx::query(
        r#"
        UPDATE cbt_entries SET
            situation = COALESCE(?, situation),
            thoughts = COALESCE(?, thoughts),
            reactions = COALESCE(?, reactions),
            mood_score_before = COALESCE(?, mood_score_before),
            mood_score_after = COALESCE(?, mood_score_after),
            tags = COALESCE(?, tags),
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&input.situation)
    .bind(&thoughts_json)
    .bind(&input.reactions)
    .bind(input.mood_score_before)
    .bind(input.mood_score_after)
    .bind(&tags_json)
    .bind(&now)
    .bind(entry_id)
    .execute(pool)
    .await?;

    get_cbt_entry_by_id(pool, entry_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn delete_cbt_entry(
    pool: &SqlitePool,
    entry_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM cbt_entries WHERE id = ?")
        .bind(entry_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn upsert_cbt_entry_from_server(
    pool: &SqlitePool,
    user_id: &str,
    server_id: &str,
    input: &CreateCBTEntryInput,
) -> Result<CBTEntry, sqlx::Error> {
    let now = Utc::now();
    let entry_date = input.entry_date.unwrap_or(now);
    let thoughts_json = vec_to_json_string(&input.thoughts).unwrap_or_default();
    let tags_json = vec_to_json_string(&input.tags.as_ref().unwrap_or(&vec![])).unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO cbt_entries 
        (id, user_id, entry_date, situation, thoughts, reactions, mood_score_before, mood_score_after, tags, is_synced, server_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            user_id = excluded.user_id,
            entry_date = excluded.entry_date,
            situation = excluded.situation,
            thoughts = excluded.thoughts,
            reactions = excluded.reactions,
            mood_score_before = excluded.mood_score_before,
            mood_score_after = excluded.mood_score_after,
            tags = excluded.tags,
            is_synced = TRUE,
            server_id = excluded.server_id,
            updated_at = excluded.updated_at
        "#
    )
    .bind(server_id)
    .bind(user_id)
    .bind(entry_date.to_rfc3339())
    .bind(&input.situation)
    .bind(thoughts_json)
    .bind(&input.reactions)
    .bind(input.mood_score_before)
    .bind(input.mood_score_after)
    .bind(tags_json)
    .bind(server_id)
    .bind(now.to_rfc3339())
    .bind(now.to_rfc3339())
    .execute(pool)
    .await?;

    get_cbt_entry_by_id(pool, server_id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_cbt_entry_by_server_id(
    pool: &SqlitePool,
    server_id: &str,
    input: &UpdateCBTEntryInput,
) -> Result<CBTEntry, sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    let thoughts_json = input
        .thoughts
        .as_ref()
        .map(|v| vec_to_json_string(v).unwrap_or_default());
    let tags_json = input
        .tags
        .as_ref()
        .map(|v| vec_to_json_string(v).unwrap_or_default());

    sqlx::query(
        r#"
        UPDATE cbt_entries SET
            situation = COALESCE(?, situation),
            thoughts = COALESCE(?, thoughts),
            reactions = COALESCE(?, reactions),
            mood_score_before = COALESCE(?, mood_score_before),
            mood_score_after = COALESCE(?, mood_score_after),
            tags = COALESCE(?, tags),
            updated_at = ?
        WHERE id = ? OR server_id = ?
        "#
    )
    .bind(&input.situation)
    .bind(&thoughts_json)
    .bind(&input.reactions)
    .bind(input.mood_score_before)
    .bind(input.mood_score_after)
    .bind(&tags_json)
    .bind(&now)
    .bind(server_id)
    .bind(server_id)
    .execute(pool)
    .await?;

    // Возвращаем по id, если есть, иначе по server_id
    let row = get_cbt_entry_by_id(pool, server_id).await?;
    if row.is_some() { return Ok(row.unwrap()); }
    // если id != server_id
    sqlx::query_as::<_, CBTEntry>("SELECT * FROM cbt_entries WHERE server_id = ?")
        .bind(server_id)
        .fetch_one(pool)
        .await
}

pub async fn delete_cbt_entry_by_server_id(
    pool: &SqlitePool,
    server_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM cbt_entries WHERE id = ? OR server_id = ?")
        .bind(server_id)
        .bind(server_id)
        .execute(pool)
        .await?;
    Ok(())
}

// === ОПЕРАЦИИ С ЭМОЦИЯМИ ===

pub async fn get_emotions(pool: &SqlitePool) -> Result<Vec<Emotion>, sqlx::Error> {
    sqlx::query_as::<_, Emotion>(
        "SELECT * FROM emotions WHERE is_active = TRUE ORDER BY category_id, sort_order"
    )
    .fetch_all(pool)
    .await
}

pub async fn get_emotion_categories(pool: &SqlitePool) -> Result<Vec<EmotionCategory>, sqlx::Error> {
    sqlx::query_as::<_, EmotionCategory>(
        "SELECT * FROM emotion_categories WHERE is_active = TRUE ORDER BY sort_order"
    )
    .fetch_all(pool)
    .await
}

// === ПЕРЕВОДЫ ===

pub async fn get_translation(
    pool: &SqlitePool,
    language_code: &str,
    translation_key: &str,
) -> Result<Option<String>, sqlx::Error> {
    let result: Option<String> = sqlx::query_scalar(
        "SELECT translation_value FROM translations WHERE language_code = ? AND translation_key = ?"
    )
    .bind(language_code)
    .bind(translation_key)
    .fetch_optional(pool)
    .await?;

    // Если перевод не найден, пробуем английский как fallback (без рекурсии)
    if result.is_none() && language_code != "en" {
        let fallback_result: Option<String> = sqlx::query_scalar(
            "SELECT translation_value FROM translations WHERE language_code = 'en' AND translation_key = ?"
        )
        .bind(translation_key)
        .fetch_optional(pool)
        .await?;
        return Ok(fallback_result);
    }

    Ok(result)
}

// === ПЕРЕВОДЫ: bulk helpers ===
pub async fn upsert_translations(
    pool: &SqlitePool,
    language_code: &str,
    entries: &[(String, String)],
) -> Result<usize, sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    let mut affected: usize = 0;
    for (key, value) in entries.iter() {
        sqlx::query(
            r#"INSERT INTO translations (language_code, translation_key, translation_value, created_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(language_code, translation_key) DO UPDATE SET translation_value = excluded.translation_value"#
        )
        .bind(language_code)
        .bind(key)
        .bind(value)
        .bind(&now)
        .execute(pool)
        .await?;
        affected += 1;
    }
    Ok(affected)
}

pub async fn get_translations_for_language(
    pool: &SqlitePool,
    language_code: &str,
) -> Result<Vec<(String, String)>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT translation_key, translation_value FROM translations WHERE language_code = ?"
    )
    .bind(language_code)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
