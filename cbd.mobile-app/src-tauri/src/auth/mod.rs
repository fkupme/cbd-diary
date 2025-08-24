// Модуль аутентификации
// TODO: Реализовать JWT, OAuth и другие методы аутентификации

use tauri::State;
use crate::database::Database;
use crate::utils::errors::AppError;

#[allow(dead_code)]
pub struct AuthService {
    // TODO: Поля для JWT токенов, ключей шифрования и т.д.
}

impl AuthService {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {}
    }
}

// Простая проверка пароля для демо
// В реальном приложении должен быть хеш и соль
#[tauri::command]
pub async fn verify_password(
    password: String,
    _db: State<'_, Database>,
) -> Result<bool, AppError> {
    // Временная заглушка - пароль "12345"
    Ok(password == "12345")
}

// Биометрическая аутентификация перенесена в lib.rs
