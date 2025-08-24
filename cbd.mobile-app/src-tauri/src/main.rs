// Главная функция теперь просто вызывает lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    cbdmobile_app_lib::run()
}
