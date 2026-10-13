export interface EngineStatus {
  is_ready: boolean;
  yt_dlp_ready: boolean;
  ffmpeg_ready: boolean;
  yt_dlp_path?: string;
  ffmpeg_path?: string;
  yt_dlp_version?: string;
}

export interface EngineProgressPayload {
  stage: string;
  percent: number;
  message: string;
}

export interface VideoMetadata {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
  duration_string: string;
  view_count?: number;
  fps?: number;
  available_qualities: string[];
}

export interface DownloadProgressPayload {
  download_id: string;
  percent: number;
  speed: string;
  eta: string;
  total_size: string;
  status: "downloading" | "merging" | "completed" | "error" | "cancelled";
  message: string;
  file_path?: string;
}

export interface DownloadItem {
  download_id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  quality: string;
  format?: string;
  is_audio?: boolean;
  duration_string?: string;
  fps?: string;
  downloaded_bytes_str?: string;
  percent: number;
  speed: string;
  eta: string;
  total_size: string;
  status: "retrieving" | "downloading" | "merging" | "completed" | "error" | "cancelled";
  message: string;
  file_path?: string;
  timestamp: number;
}
