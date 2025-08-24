use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use sqlx::FromRow;

// === ПОЛЬЗОВАТЕЛИ ===
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct User {
    pub id: String,                        // UUID как строка для SQLite
    pub email: String,
    pub name: Option<String>,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub preferred_language: String,
    pub goals: String,                     // JSON массив как строка
    pub experience_level: Option<String>,
    pub meditation_frequency: Option<String>,
    pub stress_level: Option<i32>,
    pub sleep_quality: Option<i32>,
    pub timezone: String,
    pub is_synced: bool,
    pub last_sync_at: Option<String>,      // DateTime как строка в SQLite
    pub created_at: String,
    pub updated_at: String,
}

// Структура для создания пользователя
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserInput {
    pub email: String,
    pub name: Option<String>,
    pub preferred_language: Option<String>,
}

// Структура для обновления профиля
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserProfileInput {
    pub name: Option<String>,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub goals: Option<Vec<String>>,
    pub experience_level: Option<String>,
    pub meditation_frequency: Option<String>,
    pub stress_level: Option<i32>,
    pub sleep_quality: Option<i32>,
}

// === ЗАПИСИ ДНЕВНИКА (СМЭР) ===
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct CBTEntry {
    pub id: String,                        // UUID как строка
    pub user_id: String,
    pub entry_date: String,                // DateTime как строка
    
    // СМЭР модель
    pub situation: String,
    pub thoughts: String,                  // JSON массив ThoughtChain
    pub reactions: String,
    
    // Метаданные
    pub mood_score_before: Option<i32>,
    pub mood_score_after: Option<i32>,
    pub entry_duration_minutes: Option<i32>,
    pub tags: String,                      // JSON массив строк
    
    // ИИ анализ
    pub ai_analysis: Option<String>,       // JSON объект AIAnalysis
    
    // Синхронизация
    pub is_synced: bool,
    pub server_id: Option<String>,
    pub conflict_resolution: Option<String>,
    
    pub created_at: String,
    pub updated_at: String,
}

// Структура для создания записи
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCBTEntryInput {
    pub entry_date: Option<DateTime<Utc>>, // Если None - используем текущее время
    pub situation: String,
    pub thoughts: Vec<ThoughtChainInput>,
    pub reactions: String,
    pub mood_score_before: Option<i32>,
    pub mood_score_after: Option<i32>,
    pub tags: Option<Vec<String>>,
}

// Структура для обновления записи
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCBTEntryInput {
    pub situation: Option<String>,
    pub thoughts: Option<Vec<ThoughtChainInput>>, // будет сериализовано в JSON
    pub reactions: Option<String>,
    pub mood_score_before: Option<i32>,
    pub mood_score_after: Option<i32>,
    pub tags: Option<Vec<String>>, // будет сериализовано в JSON
}

// === ЦЕПОЧКИ МЫСЛЕЙ ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThoughtChain {
    pub id: String,                        // UUID как строка
    pub thought: String,
    pub is_automatic: bool,
    pub intensity: i32,                    // 1-10
    pub emotions: Vec<EmotionEntry>,
    pub cognitive_distortions: Vec<String>,
}

// Структура для ввода цепочки мыслей
#[derive(Debug, Serialize, Deserialize)]
pub struct ThoughtChainInput {
    pub thought: String,
    pub is_automatic: Option<bool>,        // По умолчанию false
    pub intensity: Option<i32>,            // По умолчанию 5
    pub emotions: Vec<EmotionEntryInput>,
    pub cognitive_distortions: Option<Vec<String>>,
}

// === ЗАПИСИ ЭМОЦИЙ ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmotionEntry {
    pub emotion_id: i32,
    pub intensity: i32,                    // 1-10
    pub duration_minutes: Option<i32>,
}

// Структура для ввода эмоции
#[derive(Debug, Serialize, Deserialize)]
pub struct EmotionEntryInput {
    pub emotion_id: i32,
    pub intensity: i32,                    // 1-10
    pub duration_minutes: Option<i32>,
}

// === СИСТЕМА ЭМОЦИЙ ===
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct EmotionCategory {
    pub id: i32,
    pub name_key: String,
    pub color: String,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Emotion {
    pub id: i32,
    pub category_id: i32,
    pub name_key: String,
    pub emoji: String,
    pub intensity_default: i32,
    pub synonyms: String,                  // JSON массив
    pub opposite_emotion_id: Option<i32>,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: String,
    pub server_updated_at: Option<String>,
}

// Локализованная эмоция для фронтенда
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalizedEmotion {
    pub id: i32,
    pub category_id: i32,
    pub name: String,                      // Переведённое название
    pub emoji: String,
    pub intensity_default: i32,
    pub synonyms: Vec<String>,
    pub opposite_emotion_id: Option<i32>,
    pub sort_order: i32,
}

// === ИИ АНАЛИЗ ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIAnalysis {
    pub cognitive_distortions: Vec<String>,
    pub suggestions: Vec<String>,
    pub mood_trend: String,                // improving/stable/declining
    pub confidence_score: f32,             // 0.0-1.0
    pub analysis_version: String,
    pub processed_at: DateTime<Utc>,
}

// === ЛОКАЛИЗАЦИЯ ===
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Translation {
    pub id: i32,
    pub language_code: String,
    pub translation_key: String,
    pub translation_value: String,
    pub context: Option<String>,
    pub created_at: String,
}

// === СИНХРОНИЗАЦИЯ ===
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct SyncOperation {
    pub id: String,                        // UUID как строка
    pub user_id: String,
    pub operation_type: String,            // INSERT/UPDATE/DELETE
    pub table_name: String,
    pub record_id: String,
    pub data_snapshot: String,             // JSON снапшот данных
    pub created_at: String,
    pub synced_at: Option<String>,
    pub retry_count: i32,
    pub last_error: Option<String>,
}

// === АНАЛИТИКА ===
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct UserStats {
    pub user_id: String,
    pub total_entries: i32,
    pub current_streak_days: i32,
    pub longest_streak_days: i32,
    pub avg_mood_score: f32,
    pub most_common_emotion_id: Option<i32>,
    pub entries_this_week: i32,
    pub entries_this_month: i32,
    pub last_calculated_at: String,
}

// === УТИЛИТЫ ===

// Преобразование UUID в строку для SQLite
#[allow(dead_code)]
pub fn uuid_to_string(uuid: Uuid) -> String {
    uuid.to_string()
}

// Преобразование строки в UUID
#[allow(dead_code)]
pub fn string_to_uuid(s: &str) -> Result<Uuid, uuid::Error> {
    Uuid::parse_str(s)
}

// Преобразование DateTime в строку для SQLite
#[allow(dead_code)]
pub fn datetime_to_string(dt: DateTime<Utc>) -> String {
    dt.to_rfc3339()
}

// Преобразование строки в DateTime
#[allow(dead_code)]
pub fn string_to_datetime(s: &str) -> Result<DateTime<Utc>, chrono::ParseError> {
    DateTime::parse_from_rfc3339(s).map(|dt| dt.with_timezone(&Utc))
}

// Преобразование Vec в JSON строку
#[allow(dead_code)]
pub fn vec_to_json_string<T: Serialize>(vec: &Vec<T>) -> Result<String, serde_json::Error> {
    serde_json::to_string(vec)
}

// Преобразование JSON строки в Vec
#[allow(dead_code)]
pub fn json_string_to_vec<T: for<'de> Deserialize<'de>>(s: &str) -> Result<Vec<T>, serde_json::Error> {
    serde_json::from_str(s)
} 