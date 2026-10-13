mod downloader;
mod engine;

use std::sync::Arc;
use tauri::{AppHandle, State};
use engine::{get_engine_status, install_engine, EngineStatus};
use downloader::{
    fetch_video_info, execute_download, DownloadManager, DownloadRequest, VideoMetadata,
};

#[tauri::command]
fn check_engine(app: AppHandle) -> EngineStatus {
    get_engine_status(&app)
}

#[tauri::command]
async fn setup_engine(app: AppHandle) -> Result<EngineStatus, String> {
    install_engine(app).await
}

#[tauri::command]
async fn get_video_info(url: String, app: AppHandle) -> Result<VideoMetadata, String> {
    fetch_video_info(&url, &app).await
}

#[tauri::command]
async fn start_download(
    req: DownloadRequest,
    app: AppHandle,
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<(), String> {
    let mgr = manager.inner().clone();
    execute_download(req, app, mgr).await
}

#[tauri::command]
async fn cancel_download(
    download_id: String,
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<bool, String> {
    Ok(manager.abort(&download_id).await)
}

#[tauri::command]
fn get_default_download_dir() -> String {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            dirs::home_dir()
                .map(|p| p.join("Downloads").to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        })
}

#[tauri::command]
fn read_clipboard() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("pbpaste").output() {
            return String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
    }
    String::new()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let download_manager = Arc::new(DownloadManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(download_manager)
        .invoke_handler(tauri::generate_handler![
            check_engine,
            setup_engine,
            get_video_info,
            start_download,
            cancel_download,
            get_default_download_dir,
            read_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
