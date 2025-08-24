use std::sync::{Arc, Mutex};
use tauri::{command, Manager};
use serde_json;

// Модули приложения
mod auth;
mod database;
mod utils;

// Экспорты
use database::{Database, get_database_path};
use utils::errors::{AppError, AppResult};

// Для логирования
#[cfg(target_os = "android")]
use android_logger;
#[cfg(not(target_os = "android"))]
use env_logger;

// Импорты для Tauri команд
use database::models::{
    User,
    CBTEntry,
    Emotion,
    EmotionCategory,
    CreateUserInput,
    UpdateUserProfileInput,
    CreateCBTEntryInput,
    UpdateCBTEntryInput,
};
use uuid::Uuid;
use database::queries;

// Импорты для биометрии
#[cfg(feature = "biometric")]
use robius_authentication::{AndroidText, BiometricStrength, Context, PolicyBuilder, Text, WindowsText};

// === СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===

#[derive(Clone)]
pub struct AppState {
    pub database: Arc<Database>,
    pub current_user: Arc<Mutex<Option<User>>>,
}

impl AppState {
    pub async fn new() -> AppResult<Self> {
        log::info!("🔧 Инициализируем состояние приложения...");
        
        // Получаем правильный путь к БД для платформы
        let db_path = get_database_path()
            .map_err(|e| AppError::Config(format!("Не удалось получить путь к БД: {}", e)))?;
        
        log::info!("📍 Путь к БД: {}", db_path);
        
        // Инициализируем базу данных
        let database = Database::new(&db_path).await
            .map_err(|e| AppError::DatabaseConnection(format!("Не удалось подключиться к БД: {}", e)))?;
        
        Ok(Self {
            database: Arc::new(database),
            current_user: Arc::new(Mutex::new(None)),
        })
    }
    
    pub async fn new_with_path(db_path: &str) -> AppResult<Self> {
        log::info!("🔧 Инициализируем состояние приложения...");
        
        // Инициализируем базу данных с переданным путём
        let database = Database::new(db_path).await
            .map_err(|e| AppError::DatabaseConnection(format!("Не удалось подключиться к БД: {}", e)))?;
        
        let state = Self {
            database: Arc::new(database),
            current_user: Arc::new(Mutex::new(None)),
        };

        // Гарантируем наличие локального пользователя без онлайновой авторизации
        // Это устраняет зависимость локального CRUD от текущей сессии
        if let Err(e) = ensure_device_user(&state).await {
            log::warn!("Не удалось создать локального пользователя: {}", e);
        }

        Ok(state)
    }
}

// Создаёт/находит локального пользователя и устанавливает его в current_user
async fn ensure_device_user(state: &AppState) -> Result<(), String> {
    // Пробуем найти любого пользователя; если нет — создаём device user
    // Берём детерминированный email на основе UUID
    let device_email = format!("device-{}@local", Uuid::new_v4());

    // Если уже есть текущий — ничего не делаем
    if let Ok(guard) = state.current_user.lock() {
        if guard.is_some() {
            return Ok(());
        }
    }

    // Пытаемся найти существующего пользователя с любым email (берём первого попавшегося)
    // У нас нет запроса «get first user», поэтому создаём нового device user
    let input = CreateUserInput {
        email: device_email,
        name: Some("Local Device User".to_string()),
        preferred_language: Some("ru".to_string()),
    };

    match queries::create_user(state.database.get_pool(), &input).await {
        Ok(user) => {
            if let Ok(mut guard) = state.current_user.lock() {
                *guard = Some(user);
            }
            Ok(())
        }
        Err(e) => Err(format!("create_user error: {}", e)),
    }
}

// === TAURI КОМАНДЫ ===

// --- Команды пользователей ---

#[tauri::command]
async fn create_user(
    email: String,
    name: Option<String>,
    preferred_language: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<User, String> {
    log::info!("👤 Создаём пользователя: {}", email);
    
    let input = CreateUserInput {
        email,
        name,
        preferred_language,
    };
    
    let user = queries::create_user(state.database.get_pool(), &input)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    
    // Устанавливаем как текущего пользователя
    {
        let mut current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        *current_user = Some(user.clone());
    }
    
    log::info!("✅ Пользователь создан: {}", user.id);
    Ok(user)
}

#[tauri::command]
async fn login_user(
    email: String,
    state: tauri::State<'_, AppState>,
) -> Result<User, String> {
    log::info!("🔑 Логин пользователя: {}", email);
    
    let user = queries::get_user_by_email(state.database.get_pool(), &email)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?
        .ok_or_else(|| AppError::user_not_found(&email).to_tauri_error())?;
    
    // Устанавливаем как текущего пользователя
    {
        let mut current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        *current_user = Some(user.clone());
    }
    
    log::info!("✅ Пользователь авторизован: {}", user.id);
    Ok(user)
}

#[tauri::command]
async fn login_or_create_user(
    email: String,
    name: Option<String>,
    preferred_language: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<User, String> {
    // Пытаемся найти пользователя
    if let Some(user) = queries::get_user_by_email(state.database.get_pool(), &email)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })? {
        let mut current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        *current_user = Some(user.clone());
        log::info!("✅ Локальный логин: {}", user.id);
        return Ok(user);
    }

    // Создаём нового
    let input = CreateUserInput { email: email.clone(), name, preferred_language };
    let user = queries::create_user(state.database.get_pool(), &input)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;

    // Устанавливаем как текущего пользователя
    {
        let mut current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        *current_user = Some(user.clone());
    }

    log::info!("✅ Пользователь создан и залогинен: {}", user.id);
    Ok(user)
}

#[tauri::command]
async fn get_current_user(
    state: tauri::State<'_, AppState>,
) -> Result<Option<User>, String> {
    let current_user = state.current_user.lock()
        .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
    Ok(current_user.clone())
}

#[tauri::command]
async fn logout_user(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    log::info!("👋 Выход пользователя");
    
    let mut current_user = state.current_user.lock()
        .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
    *current_user = None;
    
    Ok(())
}

#[tauri::command]
async fn update_user_profile(
    input: UpdateUserProfileInput,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    log::info!("📝 Обновляем профиль пользователя");
    
    // Получаем ID текущего пользователя
    let user_id = {
        let current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        current_user.as_ref()
            .ok_or_else(|| AppError::Authentication("Пользователь не авторизован".to_string()).to_tauri_error())?
            .id.clone()
    };
    
    queries::update_user_profile(state.database.get_pool(), &user_id, &input)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    
    log::info!("✅ Профиль обновлён");
    Ok(())
}

#[tauri::command]
async fn create_test_user(
    state: tauri::State<'_, AppState>,
) -> Result<User, String> {
    log::info!("🧪 Создаём тестового пользователя test@test.ru");
    
    let input = CreateUserInput {
        email: "test@test.ru".to_string(),
        name: Some("Тестовый Пользователь".to_string()),
        preferred_language: Some("ru".to_string()),
    };
    
    // Пытаемся создать пользователя, если уже существует - просто логинимся
    let user = match queries::create_user(state.database.get_pool(), &input).await {
        Ok(user) => {
            log::info!("✅ Новый тестовый пользователь создан");
            user
        },
        Err(sqlx::Error::Database(db_err)) if db_err.message().contains("UNIQUE constraint failed") => {
            log::info!("👤 Тестовый пользователь уже существует, используем его");
            queries::get_user_by_email(state.database.get_pool(), &input.email)
                .await
                .map_err(|e| {
                    let app_error = AppError::from(e);
                    app_error.log_error();
                    app_error.to_tauri_error()
                })?
                .ok_or_else(|| AppError::user_not_found(&input.email).to_tauri_error())?
        },
        Err(e) => {
            let app_error = AppError::from(e);
            app_error.log_error();
            return Err(app_error.to_tauri_error());
        }
    };
    
    // Устанавливаем как текущего пользователя
    {
        let mut current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        *current_user = Some(user.clone());
    }
    
    log::info!("✅ Тестовый пользователь создан и авторизован: {}", user.id);
    Ok(user)
}

// --- Команды записей дневника ---

#[tauri::command]
async fn create_cbt_entry(
    input: CreateCBTEntryInput,
    state: tauri::State<'_, AppState>,
) -> Result<CBTEntry, String> {
    log::info!("📔 Создаём запись дневника");
    
    // Получаем ID текущего пользователя
    let user_id = {
        let current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        current_user.as_ref()
            .ok_or_else(|| AppError::Authentication("Пользователь не авторизован".to_string()).to_tauri_error())?
            .id.clone()
    };
    
    let entry = queries::create_cbt_entry(state.database.get_pool(), &user_id, &input)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    
    log::info!("✅ Запись создана: {}", entry.id);
    Ok(entry)
}

#[tauri::command]
async fn get_cbt_entries(
    limit: Option<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<CBTEntry>, String> {
    log::info!("📖 Получаем записи дневника");
    
    // Получаем ID текущего пользователя
    let user_id = {
        let current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        current_user.as_ref()
            .ok_or_else(|| AppError::Authentication("Пользователь не авторизован".to_string()).to_tauri_error())?
            .id.clone()
    };
    
    let entries = queries::get_user_cbt_entries(state.database.get_pool(), &user_id, limit)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    
    log::info!("✅ Получено {} записей", entries.len());
    Ok(entries)
}

#[tauri::command]
async fn get_cbt_entry_by_id(
    entry_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<CBTEntry>, String> {
    log::info!("�� Получаем запись по ID: {}", entry_id);
    
    let entry = queries::get_cbt_entry_by_id(state.database.get_pool(), &entry_id)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    
    Ok(entry)
}

#[tauri::command]
async fn update_cbt_entry(
    entry_id: String,
    input: UpdateCBTEntryInput,
    state: tauri::State<'_, AppState>,
) -> Result<CBTEntry, String> {
    log::info!("✏️ Обновляем запись дневника: {}", entry_id);

    let updated = queries::update_cbt_entry(state.database.get_pool(), &entry_id, &input)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;

    Ok(updated)
}

#[tauri::command]
async fn delete_cbt_entry(
    entry_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    log::info!("🗑️ Удаляем запись дневника: {}", entry_id);

    queries::delete_cbt_entry(state.database.get_pool(), &entry_id)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;

    Ok(())
}

#[tauri::command]
async fn upsert_cbt_entry_from_server(
    server_id: String,
    input: CreateCBTEntryInput,
    state: tauri::State<'_, AppState>,
) -> Result<CBTEntry, String> {
    // Получаем текущего пользователя
    let user_id = {
        let current_user = state.current_user.lock()
            .map_err(|e| AppError::internal_error(format!("Ошибка блокировки: {}", e)).to_tauri_error())?;
        current_user.as_ref()
            .ok_or_else(|| AppError::Authentication("Пользователь не авторизован".to_string()).to_tauri_error())?
            .id.clone()
    };

    let entry = queries::upsert_cbt_entry_from_server(state.database.get_pool(), &user_id, &server_id, &input)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;

    Ok(entry)
}

#[tauri::command]
async fn update_cbt_entry_by_server_id(
    server_id: String,
    input: UpdateCBTEntryInput,
    state: tauri::State<'_, AppState>,
) -> Result<CBTEntry, String> {
    let updated = queries::update_cbt_entry_by_server_id(state.database.get_pool(), &server_id, &input)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    Ok(updated)
}

#[tauri::command]
async fn delete_cbt_entry_by_server_id(
    server_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    queries::delete_cbt_entry_by_server_id(state.database.get_pool(), &server_id)
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    Ok(())
}

// --- Команды эмоций ---

#[tauri::command]
async fn get_emotions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Emotion>, String> {
    log::info!("😊 Получаем эмоции");
    
    let emotions = queries::get_emotions(state.database.get_pool())
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    
    log::info!("✅ Получено {} эмоций", emotions.len());
    Ok(emotions)
}

#[derive(serde::Deserialize)]
struct UpsertEmotionPayload {
    id: Option<i32>,
    category_external_key: Option<String>, // e.g. emotion_category.anger (если нет category_id)
    category_id: Option<i32>,
    name_key: String,
    emoji: Option<String>,
    intensity_default: Option<i32>,
    synonyms: Option<Vec<String>>,
    opposite_emotion_id: Option<i32>,
    sort_order: Option<i32>,
    is_active: Option<bool>,
    server_updated_at: Option<String>,
}

#[tauri::command]
async fn sync_emotions_from_server(
    emotions: Vec<UpsertEmotionPayload>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, String> {
    let pool = state.database.get_pool();

    // Подготовим кэш name_key -> category_id для быстрого резолва
    let mut cat_by_key: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    {
        let rows: Vec<(i32, String)> = sqlx::query_as(
            "SELECT id, name_key FROM emotion_categories"
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        for (id, key) in rows { cat_by_key.insert(key, id); }
    }

    async fn resolve_category_id(
        pool: &sqlx::SqlitePool,
        cat_by_key: &mut std::collections::HashMap<String, i32>,
        key: &str,
    ) -> Result<i32, String> {
        if let Some(cid) = cat_by_key.get(key) { return Ok(*cid); }
        let cid_opt: Option<i32> = sqlx::query_scalar(
            "SELECT id FROM emotion_categories WHERE name_key = ?"
        )
        .bind(key)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        if let Some(cid) = cid_opt {
            cat_by_key.insert(key.to_string(), cid);
            return Ok(cid);
        }
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO emotion_categories (name_key, color, icon, sort_order, is_active, created_at) VALUES (?, '#999999', NULL, 0, TRUE, ?)"
        )
        .bind(key)
        .bind(&now)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        let cid: i32 = sqlx::query_scalar(
            "SELECT id FROM emotion_categories WHERE name_key = ?"
        )
        .bind(key)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        cat_by_key.insert(key.to_string(), cid);
        Ok(cid)
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut upserted = 0usize;
    let mut provided_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

    for e in emotions {
        let key_for_cat = e.category_external_key.clone().ok_or_else(|| "Missing category key".to_string())?;
        let category_id = resolve_category_id(pool, &mut cat_by_key, &key_for_cat).await?;

        let synonyms_json = serde_json::to_string(&(e.synonyms.unwrap_or_default()))
            .map_err(|err| err.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO emotions (category_id, name_key, emoji, intensity_default, synonyms, opposite_emotion_id, sort_order, is_active, created_at, server_updated_at)
            VALUES (?, ?, COALESCE(?, '😐'), COALESCE(?, 5), ?, ?, COALESCE(?, 0), COALESCE(?, TRUE), ?, COALESCE(?, ?))
            ON CONFLICT(name_key) DO UPDATE SET
                category_id = excluded.category_id,
                emoji = excluded.emoji,
                intensity_default = excluded.intensity_default,
                synonyms = excluded.synonyms,
                opposite_emotion_id = excluded.opposite_emotion_id,
                sort_order = excluded.sort_order,
                is_active = excluded.is_active,
                server_updated_at = excluded.server_updated_at
            "#
        )
        .bind(category_id)
        .bind(&e.name_key)
        .bind(e.emoji.unwrap_or("😐".to_string()))
        .bind(e.intensity_default.unwrap_or(5))
        .bind(synonyms_json)
        .bind(e.opposite_emotion_id)
        .bind(e.sort_order.unwrap_or(0))
        .bind(e.is_active.unwrap_or(true))
        .bind(&now)
        .bind(e.server_updated_at.clone().unwrap_or(now.clone()))
        .bind(&now)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

        upserted += 1;
        provided_keys.insert(e.name_key);
    }

    if provided_keys.is_empty() {
        sqlx::query("UPDATE emotions SET opposite_emotion_id = NULL WHERE opposite_emotion_id IS NOT NULL")
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query("UPDATE user_stats SET most_common_emotion_id = NULL WHERE most_common_emotion_id IS NOT NULL")
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query("DELETE FROM emotions")
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        let placeholders = std::iter::repeat("?")
            .take(provided_keys.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql_nullify_opposite = format!(
            "UPDATE emotions SET opposite_emotion_id = NULL WHERE opposite_emotion_id IN (SELECT id FROM emotions WHERE name_key NOT IN ({}))",
            placeholders
        );
        let sql_nullify_userstats = format!(
            "UPDATE user_stats SET most_common_emotion_id = NULL WHERE most_common_emotion_id IN (SELECT id FROM emotions WHERE name_key NOT IN ({}))",
            placeholders
        );
        let mut q1 = sqlx::query(&sql_nullify_opposite);
        for key in provided_keys.iter() { q1 = q1.bind(key); }
        q1.execute(&*pool).await.map_err(|e| e.to_string())?;

        let mut q2 = sqlx::query(&sql_nullify_userstats);
        for key in provided_keys.iter() { q2 = q2.bind(key); }
        q2.execute(&*pool).await.map_err(|e| e.to_string())?;

        let sql_delete = format!(
            "DELETE FROM emotions WHERE name_key NOT IN ({})",
            placeholders
        );
        let mut q3 = sqlx::query(&sql_delete);
        for key in provided_keys.iter() { q3 = q3.bind(key); }
        q3.execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(upserted)
}

#[tauri::command]
async fn get_emotion_categories(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<EmotionCategory>, String> {
    log::info!("🎭 Получаем категории эмоций");
    
    let categories = queries::get_emotion_categories(state.database.get_pool())
        .await
        .map_err(|e| {
            let app_error = AppError::from(e);
            app_error.log_error();
            app_error.to_tauri_error()
        })?;
    
    log::info!("✅ Получено {} категорий", categories.len());
    Ok(categories)
}

// --- Команды переводов ---

#[tauri::command]
async fn get_translation(
    language_code: String,
    translation_key: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let translation = queries::get_translation(
        state.database.get_pool(),
        &language_code,
        &translation_key
    )
    .await
    .map_err(|e| {
        let app_error = AppError::from(e);
        app_error.log_error();
        app_error.to_tauri_error()
    })?;
    
    Ok(translation)
}

#[tauri::command]
async fn upsert_translations_bulk(
    language_code: String,
    translations: Vec<(String, String)>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, String> {
    queries::upsert_translations(state.database.get_pool(), &language_code, &translations)
        .await
        .map_err(|e| AppError::from(e).to_tauri_error())
}

#[tauri::command]
async fn get_translations_for_language(
    language_code: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<(String, String)>, String> {
    queries::get_translations_for_language(state.database.get_pool(), &language_code)
        .await
        .map_err(|e| AppError::from(e).to_tauri_error())
}

// Биометрические команды
#[cfg(feature = "biometric")]
#[command]
async fn check_biometric_availability() -> Result<serde_json::Value, String> {
    let policy = PolicyBuilder::new()
        .biometrics(Some(BiometricStrength::Strong))
        .build()
        .ok_or("Failed to build policy")?;
    
    // Проверяем доступность биометрии
    let context = Context::new(());
    
    // Тут должна быть проверка доступности, но пока вернем мок
    Ok(serde_json::json!({
        "isAvailable": true,
        "biometryType": "fingerprint",
        "deviceIsSecure": true
    }))
}

#[cfg(feature = "biometric")]
#[command]
async fn authenticate_biometric(reason: String) -> Result<bool, String> {
    let policy = PolicyBuilder::new()
        .biometrics(Some(BiometricStrength::Strong))
        .password(true)
        .build()
        .ok_or("Failed to build policy")?;

    let text = Text {
        android: AndroidText {
            title: &reason,
            subtitle: None,
            description: None,
        },
        apple: &reason,
        windows: WindowsText::new(&reason, "Please authenticate to continue")
            .ok_or("Failed to create Windows text")?,
    };

    let (tx, rx) = std::sync::mpsc::channel();
    
    let callback = move |auth_result| {
        let result = match auth_result {
            Ok(_) => true,
            Err(_) => false,
        };
        let _ = tx.send(result);
    };

    Context::new(())
        .authenticate(text, &policy, callback)
        .map_err(|e| format!("Authentication failed: {:?}", e))?;
    
    rx.recv().map_err(|e| format!("Failed to receive result: {:?}", e))
}

// Fallback для платформ без биометрии
#[cfg(not(feature = "biometric"))]
#[command]
async fn check_biometric_availability() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "isAvailable": false,
        "biometryType": "none",
        "deviceIsSecure": false,
        "reason": "Biometric authentication is not supported on this platform"
    }))
}

#[cfg(not(feature = "biometric"))]
#[command]
async fn authenticate_biometric(_reason: String) -> Result<bool, String> {
    Err("Biometric authentication is not supported on this platform".to_string())
}

// --- Тестовая команда ---

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Привет, {}! Добро пожаловать в CBD Diary!", name)
}

// === ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===

fn get_database_path_for_app(app: &tauri::App) -> AppResult<String> {
    #[cfg(target_os = "android")]
    {
        // На Android используем директорию данных приложения
        let mut path = app.path().app_data_dir()
            .map_err(|e| AppError::Config(format!("Не удалось получить директорию данных приложения: {}", e)))?;
        
        // Создаём директорию если её нет
        std::fs::create_dir_all(&path)
            .map_err(|e| AppError::FileSystem(format!("Не удалось создать директорию: {}", e)))?;
        
        // Добавляем имя файла БД
        path.push("cbd_diary.db");
        
        Ok(format!("sqlite:{}", path.to_string_lossy()))
    }
    
    #[cfg(target_os = "ios")]
    {
        // На iOS используем документы приложения
        let mut path = app.path().app_data_dir()
            .map_err(|e| AppError::Config(format!("Не удалось получить директорию данных приложения: {}", e)))?;
        
        // Создаём директорию если её нет
        std::fs::create_dir_all(&path)
            .map_err(|e| AppError::FileSystem(format!("Не удалось создать директорию: {}", e)))?;
        
        // Добавляем имя файла БД
        path.push("cbd_diary.db");
        
        Ok(format!("sqlite:{}", path.to_string_lossy()))
    }
    
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop - используем локальную директорию
        let _ = app; // Заглушаем предупреждение о неиспользуемой переменной
        Ok("sqlite:cbd_diary.db".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Инициализация логгера
    #[cfg(target_os = "android")]
    {
        android_logger::init_once(
            android_logger::Config::default()
                .with_tag("CbdDiaryRust")
                .with_max_level(log::LevelFilter::Debug)
        );
        log::info!("🚀 Android логгер инициализирован!");
    }
    
    #[cfg(not(target_os = "android"))]
    {
        env_logger::init();
        log::info!("🚀 Desktop логгер инициализирован!");
    }
    
    log::info!("🚀 Запуск CBD Diary приложения!");
    
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Инициализируем состояние приложения синхронно при старте
            tauri::async_runtime::block_on(async {
                // Получаем правильный путь к БД для платформы
                let db_path = get_database_path_for_app(app)
                    .map_err(|e| format!("Ошибка получения пути к БД: {}", e))?;
                log::info!("📍 Путь к БД: {}", db_path);
                
                match AppState::new_with_path(&db_path).await {
                    Ok(app_state) => {
                        log::info!("✅ Состояние приложения инициализировано!");
                        app.manage(app_state);
                        Ok(())
                    },
                    Err(e) => {
                        e.log_error();
                        log::error!("❌ Критическая ошибка инициализации: {}", e);
                        Err(format!("Ошибка инициализации: {}", e))
                    }
                }
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // Пользователи
            create_user,
            login_user,
            login_or_create_user,
            get_current_user,
            logout_user,
            update_user_profile,
            create_test_user, // Добавляем команду для создания тестового пользователя
            // Записи дневника
            create_cbt_entry,
            get_cbt_entries,
            get_cbt_entry_by_id,
            update_cbt_entry,
            delete_cbt_entry,
            upsert_cbt_entry_from_server,
            update_cbt_entry_by_server_id,
            delete_cbt_entry_by_server_id,
            // Эмоции
            get_emotions,
            get_emotion_categories,
            sync_emotions_from_server,
            // Переводы
            get_translation,
            upsert_translations_bulk,
            get_translations_for_language,
            // Биометрия и безопасность
            auth::verify_password,
            // Биометрические команды
            check_biometric_availability,
            authenticate_biometric,
        ]);

    // Биометрия реализована через robius-authentication, плагины не нужны
    log::info!("🔐 Биометрическая поддержка: {}", cfg!(feature = "biometric"));

    log::info!("🚀 Запускаем Tauri приложение!");

    builder
        .run(tauri::generate_context!())
        .expect("Ошибка запуска Tauri приложения");
}
