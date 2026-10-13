use std::fs::{self, File};
use std::io::{copy, Cursor};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EngineStatus {
    pub is_ready: bool,
    pub yt_dlp_ready: bool,
    pub ffmpeg_ready: bool,
    pub yt_dlp_path: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub yt_dlp_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EngineProgressPayload {
    pub stage: String,
    pub percent: f32,
    pub message: String,
}

pub fn get_app_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let bin_dir = app_dir.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir)
            .map_err(|e| format!("Failed to create bin dir: {}", e))?;
    }
    Ok(bin_dir)
}

pub fn find_executable(name: &str, app: &AppHandle) -> Option<PathBuf> {
    // 1. Check App Data Dir bin/
    if let Ok(bin_dir) = get_app_bin_dir(app) {
        let p = bin_dir.join(name);
        if p.exists() && is_executable(&p) {
            return Some(p);
        }
    }

    // 2. Check common Mac locations
    let common_paths = [
        format!("/opt/homebrew/bin/{}", name),
        format!("/usr/local/bin/{}", name),
        format!("/usr/bin/{}", name),
    ];
    for cp in &common_paths {
        let p = PathBuf::from(cp);
        if p.exists() && is_executable(&p) {
            // Verify it actually runs without errors (e.g. Python version errors)
            if verify_binary(&p, name) {
                return Some(p);
            }
        }
    }

    // 3. Check PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let p = dir.join(name);
            if p.exists() && is_executable(&p) && verify_binary(&p, name) {
                return Some(p);
            }
        }
    }

    None
}

fn is_executable(path: &Path) -> bool {
    if let Ok(metadata) = fs::metadata(path) {
        let permissions = metadata.permissions();
        return permissions.mode() & 0o111 != 0;
    }
    false
}

fn verify_binary(path: &Path, name: &str) -> bool {
    let mut cmd = Command::new(path);
    if name == "yt-dlp" {
        cmd.arg("--version");
    } else {
        cmd.arg("-version");
    }

    if let Ok(output) = cmd.output() {
        output.status.success()
    } else {
        false
    }
}

pub fn get_engine_status(app: &AppHandle) -> EngineStatus {
    let yt_dlp_path = find_executable("yt-dlp", app);
    let ffmpeg_path = find_executable("ffmpeg", app);

    let yt_dlp_version = yt_dlp_path.as_ref().and_then(|p| {
        let out = Command::new(p).arg("--version").output().ok()?;
        if out.status.success() {
            Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
        } else {
            None
        }
    });

    let yt_ready = yt_dlp_path.is_some() && yt_dlp_version.is_some();
    let ff_ready = ffmpeg_path.is_some();

    EngineStatus {
        is_ready: yt_ready && ff_ready,
        yt_dlp_ready: yt_ready,
        ffmpeg_ready: ff_ready,
        yt_dlp_path: yt_dlp_path.map(|p| p.to_string_lossy().to_string()),
        ffmpeg_path: ffmpeg_path.map(|p| p.to_string_lossy().to_string()),
        yt_dlp_version,
    }
}

pub async fn install_engine(app: AppHandle) -> Result<EngineStatus, String> {
    let bin_dir = get_app_bin_dir(&app)?;
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // --- Step 1: Download yt-dlp_macos ---
    let emit_progress = |stage: &str, percent: f32, msg: &str| {
        let _ = app.emit(
            "engine-setup-progress",
            EngineProgressPayload {
                stage: stage.to_string(),
                percent,
                message: msg.to_string(),
            },
        );
    };

    emit_progress("engine-1", 5.0, "Downloading engine core (Part 1/2)...");

    let yt_dlp_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
    let yt_resp = client
        .get(yt_dlp_url)
        .send()
        .await
        .map_err(|e| format!("Failed to request download engine: {}", e))?;

    if !yt_resp.status().is_success() {
        return Err(format!("Engine download failed with HTTP {}", yt_resp.status()));
    }

    let total_yt_bytes = yt_resp.content_length().unwrap_or(37_000_000);
    let mut downloaded_yt: u64 = 0;
    let mut yt_bytes = Vec::with_capacity(total_yt_bytes as usize);
    let mut stream = yt_resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Error downloading chunk: {}", e))?;
        downloaded_yt += chunk.len() as u64;
        yt_bytes.extend_from_slice(&chunk);

        let pct = 5.0 + (downloaded_yt as f32 / total_yt_bytes as f32) * 45.0;
        emit_progress(
            "engine-1",
            pct.min(50.0),
            &format!("Downloading engine components (Part 1/2): {:.1} MB / {:.1} MB",
                downloaded_yt as f64 / 1_048_576.0,
                total_yt_bytes as f64 / 1_048_576.0
            ),
        );
    }

    let yt_dlp_dest = bin_dir.join("yt-dlp");
    fs::write(&yt_dlp_dest, yt_bytes)
        .map_err(|e| format!("Failed to write engine binary: {}", e))?;

    // Make executable
    let mut perms = fs::metadata(&yt_dlp_dest)
        .map_err(|e| format!("Metadata error: {}", e))?
        .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(&yt_dlp_dest, perms)
        .map_err(|e| format!("Permissions error: {}", e))?;

    // --- Step 2: Download ffmpeg ---
    emit_progress("engine-2", 55.0, "Downloading engine media components (Part 2/2)...");

    let ffmpeg_url = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-macos-64.zip";
    let ff_resp = client
        .get(ffmpeg_url)
        .send()
        .await
        .map_err(|e| format!("Failed to request engine media component: {}", e))?;

    if !ff_resp.status().is_success() {
        return Err(format!("Engine media component download failed with HTTP {}", ff_resp.status()));
    }

    let total_ff_bytes = ff_resp.content_length().unwrap_or(25_000_000);
    let mut downloaded_ff: u64 = 0;
    let mut ff_bytes = Vec::with_capacity(total_ff_bytes as usize);
    let mut ff_stream = ff_resp.bytes_stream();

    while let Some(chunk) = ff_stream.next().await {
        let chunk = chunk.map_err(|e| format!("Error downloading component: {}", e))?;
        downloaded_ff += chunk.len() as u64;
        ff_bytes.extend_from_slice(&chunk);

        let pct = 55.0 + (downloaded_ff as f32 / total_ff_bytes as f32) * 40.0;
        emit_progress(
            "engine-2",
            pct.min(95.0),
            &format!("Downloading engine components (Part 2/2): {:.1} MB / {:.1} MB",
                downloaded_ff as f64 / 1_048_576.0,
                total_ff_bytes as f64 / 1_048_576.0
            ),
        );
    }

    emit_progress("extracting", 95.0, "Configuring engine...");
    let cursor = Cursor::new(ff_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to open ffmpeg zip: {}", e))?;

    let ffmpeg_dest = bin_dir.join("ffmpeg");
    let mut found = false;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Zip error: {}", e))?;
        if file.name() == "ffmpeg" {
            let mut outfile = File::create(&ffmpeg_dest)
                .map_err(|e| format!("Failed to create ffmpeg dest file: {}", e))?;
            copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract ffmpeg: {}", e))?;
            found = true;
            break;
        }
    }

    if !found {
        return Err("ffmpeg binary not found in downloaded zip archive".to_string());
    }

    let mut ff_perms = fs::metadata(&ffmpeg_dest)
        .map_err(|e| format!("Metadata error: {}", e))?
        .permissions();
    ff_perms.set_mode(0o755);
    fs::set_permissions(&ffmpeg_dest, ff_perms)
        .map_err(|e| format!("Permissions error: {}", e))?;

    emit_progress("complete", 100.0, "Engine setup complete!");

    Ok(get_engine_status(&app))
}
