use std::path::Path;
use tauri::Manager;

const LEGACY_IDENTIFIER: &str = "com.tauri.dev";
const DATA_FILENAME: &str = "hibique_data.json";

fn migrate_legacy_data_file(legacy_file: &Path, target_file: &Path) -> std::io::Result<bool> {
    if target_file.exists() || !legacy_file.exists() {
        return Ok(false);
    }
    if let Some(parent) = target_file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(legacy_file, target_file)?;
    Ok(true)
}

fn migrate_legacy_data_if_needed(app: &tauri::AppHandle) {
    let Ok(config_dir) = app.path().config_dir() else {
        return;
    };
    let Ok(app_config_dir) = app.path().app_config_dir() else {
        return;
    };
    let legacy_file = config_dir.join(LEGACY_IDENTIFIER).join(DATA_FILENAME);
    let target_file = app_config_dir.join(DATA_FILENAME);
    if legacy_file == target_file {
        return;
    }
    match migrate_legacy_data_file(&legacy_file, &target_file) {
        Ok(true) => log::info!(
            "Migrated legacy data from {} to {}",
            legacy_file.display(),
            target_file.display()
        ),
        Ok(false) => {}
        Err(err) => log::warn!(
            "Failed to migrate legacy data from {} to {}: {}",
            legacy_file.display(),
            target_file.display(),
            err
        ),
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL scheme".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![open_external_url])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            migrate_legacy_data_if_needed(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    struct TempDirGuard(PathBuf);

    impl TempDirGuard {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "hibique_test_{}_{}",
                std::process::id(),
                name
            ));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).expect("create temp test dir");
            Self(dir)
        }
    }

    impl Drop for TempDirGuard {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn migrates_legacy_file_when_target_does_not_exist() {
        let temp = TempDirGuard::new("migrate_success");
        let legacy_file = temp.0.join("com.tauri.dev").join(DATA_FILENAME);
        let target_file = temp.0.join("com.hibique.app").join(DATA_FILENAME);

        std::fs::create_dir_all(legacy_file.parent().unwrap()).unwrap();
        std::fs::write(&legacy_file, "{\"tasks\":[{\"id\":\"1\"}]}").unwrap();

        let migrated = migrate_legacy_data_file(&legacy_file, &target_file).unwrap();
        assert!(migrated);
        assert_eq!(
            std::fs::read_to_string(&target_file).unwrap(),
            "{\"tasks\":[{\"id\":\"1\"}]}"
        );
        assert!(legacy_file.exists(), "legacy file should be preserved");
    }

    #[test]
    fn skips_migration_when_target_already_exists() {
        let temp = TempDirGuard::new("skip_existing");
        let legacy_file = temp.0.join("com.tauri.dev").join(DATA_FILENAME);
        let target_file = temp.0.join("com.hibique.app").join(DATA_FILENAME);

        std::fs::create_dir_all(legacy_file.parent().unwrap()).unwrap();
        std::fs::create_dir_all(target_file.parent().unwrap()).unwrap();
        std::fs::write(&legacy_file, "{\"tasks\":[\"old\"]}").unwrap();
        std::fs::write(&target_file, "{\"tasks\":[\"new\"]}").unwrap();

        let migrated = migrate_legacy_data_file(&legacy_file, &target_file).unwrap();
        assert!(!migrated);
        assert_eq!(
            std::fs::read_to_string(&target_file).unwrap(),
            "{\"tasks\":[\"new\"]}"
        );
    }

    #[test]
    fn skips_migration_when_legacy_file_is_missing() {
        let temp = TempDirGuard::new("missing_legacy");
        let legacy_file = temp.0.join("com.tauri.dev").join(DATA_FILENAME);
        let target_file = temp.0.join("com.hibique.app").join(DATA_FILENAME);

        let migrated = migrate_legacy_data_file(&legacy_file, &target_file).unwrap();
        assert!(!migrated);
        assert!(!target_file.exists());
    }
}

