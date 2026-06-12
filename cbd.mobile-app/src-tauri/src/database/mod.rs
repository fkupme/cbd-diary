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
                if parent_dir.as_os_str().is_empty() {
                    log::info!("📁 Файл БД находится в текущей директории");
                } else {
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
        
        // Конфигурируем подключение: WAL + busy_timeout, иначе при конкурентном
        // доступе (логин параллельно дёргает синк эмоций, записей, профиля)
        // запись падает с "database is locked" (SQLITE_BUSY) — каталог эмоций
        // тогда не наполняется и эмоции пропадают в дневнике/колесе.
        use sqlx::sqlite::{
            SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous,
        };
        use std::str::FromStr;
        use std::time::Duration;

        let connect_options = SqliteConnectOptions::from_str(database_url)?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal) // конкурентные читатели + 1 писатель
            .busy_timeout(Duration::from_secs(5)) // ждать блокировку, а не падать
            .synchronous(SqliteSynchronous::Normal);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_options)
            .await?;

        // Запускаем миграции
        migrations::run_migrations(&pool).await?;
        
        // Заполняем начальные данные
        Self::seed_initial_data(&pool).await?;
        
        log::info!("✅ База данных успешно инициализирована!");
        
        Ok(Self { pool })
    }
    
    async fn seed_initial_data(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        log::info!("🌱 Заполняем начальные данные...");

        // Каталог эмоций и категорий локально НЕ сидится: источник истины — сервер.
        // Каталог приезжает командой sync_emotions_from_server после логина
        // (с серверными id) и дальше живёт в SQLite для офлайна.
        let emotion_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM emotions")
            .fetch_one(pool)
            .await?;
        log::info!("ℹ️ Локально найдено эмоций: {} (источник истины — сервер)", emotion_count);
        
        // Проверяем переводы
        let translation_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM translations")
            .fetch_one(pool)
            .await?;
            
        if translation_count == 0 {
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

// Путь к БД резолвится через get_database_path_for_app (lib.rs, Tauri 2 path API).