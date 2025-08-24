pub mod models;
pub mod migrations;
pub mod queries;
pub mod indexes;
pub mod encryption;

// Модули доступны для импорта

use sqlx::SqlitePool;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        log::info!("🔧 Инициализируем новую БД: {}", database_url);
        
        // Проверяем и создаем файл БД если нужно для SQLite
        if database_url.starts_with("sqlite:") {
            let file_path = &database_url[7..]; // убираем "sqlite:" префикс
            log::info!("📂 Путь к файлу БД: {}", file_path);
            
            // Проверяем существует ли родительская директория
            if let Some(parent_dir) = std::path::Path::new(file_path).parent() {
                log::info!("📁 Родительская директория: {}", parent_dir.display());
                
                if !parent_dir.exists() {
                    log::warn!("⚠️ Родительская директория не существует, создаем: {}", parent_dir.display());
                    std::fs::create_dir_all(parent_dir)
                        .map_err(|e| sqlx::Error::Io(e))?;
                }
                
                // Проверяем права доступа к директории
                match std::fs::metadata(parent_dir) {
                    Ok(metadata) => {
                        log::info!("✅ Директория доступна, права: {:?}", metadata.permissions());
                    },
                    Err(e) => {
                        log::error!("❌ Ошибка доступа к директории: {}", e);
                        return Err(sqlx::Error::Io(e));
                    }
                }
            }
            
            // Проверяем существует ли файл БД
            if std::path::Path::new(file_path).exists() {
                log::info!("📄 Файл БД уже существует: {}", file_path);
            } else {
                log::info!("📄 Файл БД не существует, пытаемся создать вручную");
                
                // Попробуем создать пустой файл вручную
                match std::fs::File::create(file_path) {
                    Ok(_) => {
                        log::info!("✅ Файл БД успешно создан: {}", file_path);
                    },
                    Err(e) => {
                        log::error!("❌ Не удалось создать файл БД: {}", e);
                        return Err(sqlx::Error::Io(e));
                    }
                }
                
                // Проверяем права доступа к созданному файлу
                match std::fs::metadata(file_path) {
                    Ok(metadata) => {
                        log::info!("📄 Права файла БД: {:?}", metadata.permissions());
                    },
                    Err(e) => {
                        log::warn!("⚠️ Не удалось получить метаданные файла: {}", e);
                    }
                }
            }
        }
        
        let pool = SqlitePool::connect(database_url).await?;
        
        // Запускаем миграции
        migrations::run_migrations(&pool).await?;
        
        // Заполняем начальные данные
        Self::seed_initial_data(&pool).await?;
        
        log::info!("✅ База данных успешно инициализирована!");
        
        Ok(Self { pool })
    }
    
    async fn seed_initial_data(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        log::info!("🌱 Заполняем начальные данные...");
        
        // Проверяем категории эмоций
        let category_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM emotion_categories")
            .fetch_one(pool)
            .await?;

        if category_count == 0 {
            log::info!("📝 Заполняем категории эмоций...");
            queries::seed_emotion_categories(pool).await?;
        } else {
            log::info!("ℹ️ Категории эмоций уже существуют ({} шт.)", category_count);
        }
        
        // Эмоции больше не сидим локально — приходят из сервера и синкаются в SQLite
        let emotion_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM emotions")
            .fetch_one(pool)
            .await?;
        log::info!("ℹ️ Локально найдено эмоций: {} (источник истины — сервер)", emotion_count);
        
        // Проверяем переводы
        let translation_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM translations")
            .fetch_one(pool)
            .await?;
            
        if translation_count < 50 {
            log::info!("📝 Заполняем переводы... (текущее количество: {})", translation_count);
            queries::seed_translations(pool).await?;
        } else {
            log::info!("ℹ️ Переводы уже загружены ({} шт.)", translation_count);
        }

        log::info!("✅ Начальные данные проверены и заполнены!");
        Ok(())
    }
    
    pub fn get_pool(&self) -> &SqlitePool {
        &self.pool
    }
}

// Утилиты для получения правильного пути к БД
pub fn get_database_path() -> Result<String, Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    {
        // На Android используем внутреннее хранилище приложения
        Ok("sqlite:cbd_diary.db".to_string())
    }
    
    #[cfg(target_os = "ios")]
    {
        // На iOS используем Documents директорию
        use tauri::api::path;
        let app_data_dir = path::app_data_dir(&tauri::Config::default())
            .ok_or("Failed to get app data directory")?;
        let db_path = app_data_dir.join("cbd_diary.db");
        
        // Создаём родительскую директорию
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        Ok(format!("sqlite:{}", db_path.to_string_lossy()))
    }
    
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop - используем текущую директорию
        Ok("sqlite:cbd_diary.db".to_string())
    }
} 