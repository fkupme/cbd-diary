use serde::{Deserialize, Serialize};

use thiserror::Error;

// === ОСНОВНЫЕ ТИПЫ ОШИБОК ===

#[derive(Debug, Error, Serialize, Deserialize)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("Database connection error: {0}")]
    DatabaseConnection(String),
    
    #[error("Migration error: {0}")]
    Migration(String),
    
    #[error("IO error: {0}")]
    Io(String),
    
    #[error("Tauri error: {0}")]
    Tauri(String),
    
    #[error("JSON error: {0}")]
    Json(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    
    #[error("Bad request: {0}")]
    BadRequest(String),
    
    #[error("Internal server error: {0}")]
    Internal(String),
    
    #[error("Not supported: {0}")]
    NotSupported(String),
    
    #[error("User not found: {0}")]
    UserNotFound(String),
    
    #[error("User already exists: {0}")]
    UserAlreadyExists(String),
    
    #[error("Invalid user data: {0}")]
    InvalidUserData(String),
    
    #[error("Entry not found: {0}")]
    EntryNotFound(String),
    
    #[error("Invalid entry data: {0}")]
    InvalidEntryData(String),
    
    #[error("Authentication error: {0}")]
    Authentication(String),
    
    #[error("Authorization error: {0}")]
    Authorization(String),
    
    #[error("Sync error: {0}")]
    Sync(String),
    
    #[error("Conflict resolution error: {0}")]
    ConflictResolution(String),
    
    #[error("Encryption error: {0}")]
    Encryption(String),
    
    #[error("Decryption error: {0}")]
    Decryption(String),
    
    #[error("Translation error: {0}")]
    Translation(String),
    
    #[error("Language not supported: {0}")]
    LanguageNotSupported(String),
    
    #[error("Config error: {0}")]
    Config(String),
    
    #[error("File system error: {0}")]
    FileSystem(String),
    
    #[error("External service error: {0}")]
    ExternalService(String),
}

// === ПРЕОБРАЗОВАНИЯ ИЗ ВНЕШНИХ ОШИБОК ===

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound("Database record not found".to_string()),
            sqlx::Error::Database(db_err) => AppError::Database(db_err.to_string()),
            sqlx::Error::Io(io_err) => AppError::Io(io_err.to_string()),
            sqlx::Error::Migrate(migrate_err) => AppError::Migration(migrate_err.to_string()),
            _ => AppError::Database(err.to_string()),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Json(err.to_string())
    }
}

impl From<uuid::Error> for AppError {
    fn from(err: uuid::Error) -> Self {
        AppError::Validation(format!("Invalid UUID: {}", err))
    }
}

impl From<chrono::ParseError> for AppError {
    fn from(err: chrono::ParseError) -> Self {
        AppError::Validation(format!("Invalid date: {}", err))
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::Tauri(err.to_string())
    }
}

// === РЕЗУЛЬТАТ С КАСТОМНОЙ ОШИБКОЙ ===

pub type AppResult<T> = Result<T, AppError>;

// === ПОМОЩНИКИ ДЛЯ СОЗДАНИЯ ОШИБОК ===

impl AppError {
    pub fn database_error<S: Into<String>>(msg: S) -> Self {
        AppError::Database(msg.into())
    }
    
    pub fn user_not_found<S: Into<String>>(msg: S) -> Self {
        AppError::UserNotFound(msg.into())
    }
    
    pub fn validation_error<S: Into<String>>(msg: S) -> Self {
        AppError::Validation(msg.into())
    }
    
    pub fn internal_error<S: Into<String>>(msg: S) -> Self {
        AppError::Internal(msg.into())
    }
    
    pub fn sync_error<S: Into<String>>(msg: S) -> Self {
        AppError::Sync(msg.into())
    }
    
    // Логирование ошибки
    pub fn log_error(&self) {
        log::error!("❌ {}", self);
        
        // Дополнительный контекст для критических ошибок
        match self {
            AppError::DatabaseConnection(_) => {
                log::error!("🔴 Критическая ошибка БД - приложение может работать некорректно");
            },
            AppError::Migration(_) => {
                log::error!("🔴 Ошибка миграции - может потребоваться пересоздание БД");
            },
            AppError::Encryption(_) | AppError::Decryption(_) => {
                log::error!("🔐 Ошибка шифрования - данные могут быть скомпрометированы");
            },
            _ => {}
        }
    }
    
    // Конвертация в строку для Tauri команд
    pub fn to_tauri_error(&self) -> String {
        self.to_string()
    }
    
    // Проверка является ли ошибка критической
    pub fn is_critical(&self) -> bool {
        matches!(self, 
            AppError::DatabaseConnection(_) |
            AppError::Migration(_) |
            AppError::Encryption(_) |
            AppError::Decryption(_) |
            AppError::FileSystem(_)
        )
    }
}

// === МАКРОСЫ ДЛЯ УДОБСТВА ===

#[macro_export]
macro_rules! db_error {
    ($msg:expr) => {
        crate::utils::errors::AppError::database_error($msg)
    };
    ($fmt:expr, $($args:tt)*) => {
        crate::utils::errors::AppError::database_error(format!($fmt, $($args)*))
    };
}

#[macro_export]
macro_rules! validation_error {
    ($msg:expr) => {
        crate::utils::errors::AppError::validation_error($msg)
    };
    ($fmt:expr, $($args:tt)*) => {
        crate::utils::errors::AppError::validation_error(format!($fmt, $($args)*))
    };
}

#[macro_export]
macro_rules! internal_error {
    ($msg:expr) => {
        crate::utils::errors::AppError::internal_error($msg)
    };
    ($fmt:expr, $($args:tt)*) => {
        crate::utils::errors::AppError::internal_error(format!($fmt, $($args)*))
    };
}

// === ФУНКЦИИ-ПОМОЩНИКИ ===

#[allow(dead_code)]
pub fn handle_error_with_context<T>(
    result: Result<T, AppError>,
    context: &str,
) -> Result<T, AppError> {
    result.map_err(|err| {
        log::error!("🔍 Контекст: {} | Ошибка: {}", context, err);
        err
    })
}

#[allow(dead_code)]
pub fn log_and_convert_error<E: std::error::Error>(
    err: E,
    error_type: AppError,
) -> AppError {
    log::error!("🔄 Конвертация ошибки: {} -> {}", err, error_type);
    error_type
}
