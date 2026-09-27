#[cfg(unix)]
struct TerminalResetGuard;

#[cfg(unix)]
impl Drop for TerminalResetGuard {
    fn drop(&mut self) {
        let _ = std::process::Command::new("stty")
            .arg("sane")
            .status();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(unix)]
    let _guard = TerminalResetGuard;

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

