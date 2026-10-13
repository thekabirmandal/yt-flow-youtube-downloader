use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;

use crate::engine::find_executable;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoMetadata {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub thumbnail: String,
    pub duration: u64,
    pub duration_string: String,
    pub view_count: Option<u64>,
    pub fps: Option<u64>,
    pub available_qualities: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadRequest {
    pub download_id: String,
    pub url: String,
    pub quality: String, // "1080p", "720p", "480p", "360p", "best", "mp3", "m4a"
    pub output_dir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgressPayload {
    pub download_id: String,
    pub percent: f32,
    pub speed: String,
    pub eta: String,
    pub total_size: String,
    pub status: String, // "downloading" | "merging" | "completed" | "error" | "cancelled"
    pub message: String,
    pub file_path: Option<String>,
}

pub struct DownloadManager {
    processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn abort(&self, download_id: &str) -> bool {
        let mut map = self.processes.lock().await;
        if let Some(mut child) = map.remove(download_id) {
            let _ = child.kill().await;
            true
        } else {
            false
        }
    }
}

pub fn format_duration(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;
    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}

pub async fn fetch_video_info(url: &str, app: &AppHandle) -> Result<VideoMetadata, String> {
    let yt_dlp = find_executable("yt-dlp", app)
        .ok_or_else(|| "yt-dlp engine is not installed or ready.".to_string())?;

    let output = tokio::process::Command::new(yt_dlp)
        .args([
            "--dump-single-json",
            "--no-playlist",
            "--no-download",
            "--skip-download",
            url,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", err.trim()));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse metadata JSON: {}", e))?;

    let id = json["id"].as_str().unwrap_or("").to_string();
    let title = json["title"].as_str().unwrap_or("Unknown Title").to_string();
    let channel = json["uploader"]
        .as_str()
        .or_else(|| json["channel"].as_str())
        .unwrap_or("Unknown Channel")
        .to_string();
    let thumbnail = json["thumbnail"].as_str().unwrap_or("").to_string();
    let duration = json["duration"].as_u64().unwrap_or(0);
    let view_count = json["view_count"].as_u64();

    // Check available video heights and framerates
    let mut heights: Vec<u64> = Vec::new();
    let mut detected_fps: u64 = 30;
    if let Some(formats) = json["formats"].as_array() {
        for f in formats {
            if let Some(h) = f["height"].as_u64() {
                if !heights.contains(&h) && h >= 240 {
                    heights.push(h);
                }
            }
            if let Some(f_fps) = f["fps"].as_u64() {
                if f_fps > detected_fps {
                    detected_fps = f_fps;
                }
            }
        }
    }
    heights.sort_by(|a, b| b.cmp(a)); // Descending order

    let mut available_qualities = Vec::new();
    available_qualities.push("best".to_string());
    for h in [2160, 1440, 1080, 720, 480, 360] {
        if heights.iter().any(|&avail| avail >= h) {
            available_qualities.push(format!("{}p", h));
        }
    }
    available_qualities.push("mp3".to_string());
    available_qualities.push("m4a".to_string());

    Ok(VideoMetadata {
        id,
        title,
        channel,
        thumbnail,
        duration,
        duration_string: format_duration(duration),
        view_count,
        fps: Some(detected_fps),
        available_qualities,
    })
}

pub async fn execute_download(
    req: DownloadRequest,
    app: AppHandle,
    manager: Arc<DownloadManager>,
) -> Result<(), String> {
    let yt_dlp = find_executable("yt-dlp", &app)
        .ok_or_else(|| "yt-dlp engine not found".to_string())?;
    let ffmpeg = find_executable("ffmpeg", &app);

    let output_template = format!("{}/%(title)s.%(ext)s", req.output_dir.trim_end_matches('/'));

    let mut args: Vec<String> = vec![
        "--newline".to_string(),
        "--no-playlist".to_string(),
        "-o".to_string(),
        output_template,
    ];

    if let Some(ref ff) = ffmpeg {
        if let Some(parent) = ff.parent() {
            args.push("--ffmpeg-location".to_string());
            args.push(parent.to_string_lossy().to_string());
        }
    }

    match req.quality.as_str() {
        "mp3" => {
            args.push("-x".to_string());
            args.push("--audio-format".to_string());
            args.push("mp3".to_string());
            args.push("--audio-quality".to_string());
            args.push("0".to_string());
        }
        "m4a" => {
            args.push("-x".to_string());
            args.push("--audio-format".to_string());
            args.push("m4a".to_string());
        }
        "best" => {
            args.push("-f".to_string());
            args.push("bestvideo+bestaudio/best".to_string());
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        }
        q if q.ends_with('p') => {
            let height = q.trim_end_matches('p');
            args.push("-f".to_string());
            args.push(format!(
                "bestvideo[height<={}]+bestaudio/best[height<={}]/best",
                height, height
            ));
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        }
        _ => {
            args.push("-f".to_string());
            args.push("bestvideo+bestaudio/best".to_string());
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        }
    }

    args.push(req.url.clone());

    let mut cmd = tokio::process::Command::new(yt_dlp);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp download: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to open child stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open child stderr")?;

    {
        let mut map = manager.processes.lock().await;
        map.insert(req.download_id.clone(), child);
    }

    let download_id = req.download_id.clone();
    let app_clone = app.clone();
    let manager_clone = manager.clone();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut err_reader = BufReader::new(stderr).lines();

        let progress_re = Regex::new(
            r"\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?(\S+)(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?",
        )
        .unwrap();
        let dest_re = Regex::new(r#"\[(?:download|Merger|ExtractAudio)\]\s+(?:Destination:\s+|Merging formats into\s+"?|Destination:\s+"?)([^"\n]+)"#).unwrap();

        let mut final_file_path: Option<String> = None;

        loop {
            tokio::select! {
                line_res = reader.next_line() => {
                    match line_res {
                        Ok(Some(line)) => {
                            if let Some(caps) = dest_re.captures(&line) {
                                if let Some(m) = caps.get(1) {
                                    let p = m.as_str().trim().trim_matches('"');
                                    final_file_path = Some(p.to_string());
                                }
                            }

                            if let Some(caps) = progress_re.captures(&line) {
                                let pct: f32 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
                                let total = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_else(|| "--".to_string());
                                let speed = caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_else(|| "--".to_string());
                                let eta = caps.get(4).map(|m| m.as_str().to_string()).unwrap_or_else(|| "--".to_string());

                                let _ = app_clone.emit(
                                    "download-progress",
                                    DownloadProgressPayload {
                                        download_id: download_id.clone(),
                                        percent: pct,
                                        speed,
                                        eta,
                                        total_size: total,
                                        status: "downloading".to_string(),
                                        message: "Downloading...".to_string(),
                                        file_path: final_file_path.clone(),
                                    },
                                );
                            } else if line.contains("[Merger]") || line.contains("[ExtractAudio]") {
                                let _ = app_clone.emit(
                                    "download-progress",
                                    DownloadProgressPayload {
                                        download_id: download_id.clone(),
                                        percent: 99.0,
                                        speed: "--".to_string(),
                                        eta: "--".to_string(),
                                        total_size: "--".to_string(),
                                        status: "merging".to_string(),
                                        message: "Processing audio/video...".to_string(),
                                        file_path: final_file_path.clone(),
                                    },
                                );
                            }
                        }
                        Ok(None) => break,
                        Err(_) => break,
                    }
                }
                err_line_res = err_reader.next_line() => {
                    if let Ok(Some(_line)) = err_line_res {
                        // Keep reading stderr to avoid deadlocks
                    }
                }
            }
        }

        // Check process exit status
        let mut map = manager_clone.processes.lock().await;
        if let Some(mut child) = map.remove(&download_id) {
            let status = child.wait().await;
            match status {
                Ok(s) if s.success() => {
                    let _ = app_clone.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            download_id: download_id.clone(),
                            percent: 100.0,
                            speed: "--".to_string(),
                            eta: "00:00".to_string(),
                            total_size: "--".to_string(),
                            status: "completed".to_string(),
                            message: "Download complete!".to_string(),
                            file_path: final_file_path,
                        },
                    );
                }
                Ok(s) => {
                    let _ = app_clone.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            download_id: download_id.clone(),
                            percent: 0.0,
                            speed: "--".to_string(),
                            eta: "--".to_string(),
                            total_size: "--".to_string(),
                            status: "error".to_string(),
                            message: format!("Process exited with status {:?}", s.code()),
                            file_path: None,
                        },
                    );
                }
                Err(e) => {
                    let _ = app_clone.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            download_id: download_id.clone(),
                            percent: 0.0,
                            speed: "--".to_string(),
                            eta: "--".to_string(),
                            total_size: "--".to_string(),
                            status: "error".to_string(),
                            message: format!("Failed to wait on child process: {}", e),
                            file_path: None,
                        },
                    );
                }
            }
        }
    });

    Ok(())
}
