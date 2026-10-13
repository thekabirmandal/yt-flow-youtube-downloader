import React from "react";
import { DownloadItem } from "../types";
import {
  Play,
  Folder,
  Trash2,
  XCircle,
  Download,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

interface DownloadsListProps {
  items: DownloadItem[];
  onCancelDownload: (id: string) => void;
  onClearItem: (id: string) => void;
}

/** Parses a size string like "4.2GiB", "4.2GB", "418.8MiB", "50MB" into MB */
function parseSizeToMB(sizeStr: string): number | null {
  if (!sizeStr || sizeStr === "--") return null;
  const clean = sizeStr.replace("~", "").trim();
  const match = clean.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit.startsWith("G")) return val * 1024;
  if (unit.startsWith("M")) return val;
  if (unit.startsWith("K")) return val / 1024;
  if (unit.startsWith("B")) return val / (1024 * 1024);
  return null;
}

function formatMB(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/** Formats "418.8 MB of 4.2 GB" */
function formatDownloadedOfTotal(percent: number, totalStr: string): string {
  if (!totalStr || totalStr === "--") {
    return "";
  }
  const totalMB = parseSizeToMB(totalStr);
  if (totalMB !== null && totalMB > 0) {
    const downloadedMB = (totalMB * Math.max(0, Math.min(100, percent))) / 100;
    return `${formatMB(downloadedMB)} of ${formatMB(totalMB)}`;
  }
  return totalStr.replace(/GiB/i, " GB").replace(/MiB/i, " MB");
}

/** Formats ETA like "04:00" -> "4 minute(s) left" */
function formatEta(etaStr: string): string {
  if (!etaStr || etaStr === "--") return "";
  const parts = etaStr.split(":").map(Number);
  if (parts.some(isNaN)) {
    return `${etaStr} left`;
  }
  if (parts.length === 3) {
    const [h, m] = parts;
    if (h > 0) {
      return `${h} hour(s)${m > 0 ? ` ${m} min` : ""} left`;
    }
    return `${m} minute(s) left`;
  } else if (parts.length === 2) {
    const [m, s] = parts;
    if (m > 0) {
      return `${m} minute(s) left`;
    }
    return `${s} second(s) left`;
  }
  return `${etaStr} left`;
}

/** Formats speed like "15.75MiB/s" -> "126 Mbps" (multiplies MB/s by 8 for Mbps) */
function formatSpeed(speedStr: string): string {
  if (!speedStr || speedStr === "--") return "";
  if (speedStr.toLowerCase().includes("bps")) {
    return speedStr.replace(/([0-9]+)\.[0-9]+/, "$1").trim();
  }
  const match = speedStr.match(/^([\d.]+)\s*([a-zA-Z/]+)$/);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2];
    if (unit.toLowerCase().includes("mib") || unit.toLowerCase().includes("mb")) {
      const mbps = Math.round(val * 8);
      return `${mbps} Mbps`;
    } else if (unit.toLowerCase().includes("kib") || unit.toLowerCase().includes("kb")) {
      const kbps = Math.round(val * 8);
      return `${kbps} Kbps`;
    }
    return `${val.toFixed(1)} ${unit}`;
  }
  return speedStr;
}

/** Formats quality label: e.g. "2160p" -> "HD 4K", "1080p" -> "HD 1080p" */
function formatQualityLabel(quality: string): string {
  if (!quality || quality === "best") return "HD 4K";
  const q = quality.toLowerCase();
  if (q === "4320p" || q === "8k") return "UHD 8K";
  if (q === "2160p" || q === "4k") return "HD 4K";
  if (q === "1440p" || q === "2k") return "HD 2K";
  if (q === "1080p") return "HD 1080p";
  if (q === "720p") return "HD 720p";
  if (q === "480p") return "480p";
  if (q === "360p") return "360p";
  if (q === "240p") return "240p";
  if (q === "mp3") return "MP3";
  if (q === "m4a") return "M4A";
  return quality.toUpperCase();
}

export const DownloadsList: React.FC<DownloadsListProps> = ({
  items,
  onCancelDownload,
  onClearItem,
}) => {
  const handleOpenFile = async (path?: string) => {
    if (!path) return;
    try {
      await openPath(path);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  };

  const handleRevealInFinder = async (path?: string) => {
    if (!path) return;
    try {
      await revealItemInDir(path);
    } catch (e) {
      console.error("Failed to reveal item:", e);
    }
  };

  if (items.length === 0) {
    return (
      <div className="list-empty-state">
        <div className="empty-circle-icon">
          <Download size={32} />
        </div>
        <h3>No downloads yet</h3>
        <p>
          Copy a YouTube video link and click <strong>Paste Link</strong> above to start downloading.
        </p>
      </div>
    );
  }

  return (
    <div className="compact-downloads-list">
      {items.map((item) => {
        const isDownloading = item.status === "downloading";
        const isMerging = item.status === "merging";
        const isRetrieving = item.status === "retrieving";
        const isCompleted = item.status === "completed";

        // Completed metadata line
        const completedMetaParts = [];
        if (item.duration_string) completedMetaParts.push(item.duration_string);
        if (item.total_size && item.total_size !== "--") completedMetaParts.push(item.total_size);
        if (item.format) completedMetaParts.push(item.format.toUpperCase());
        if (item.quality) completedMetaParts.push(formatQualityLabel(item.quality));
        if (item.channel) completedMetaParts.push(item.channel);
        const completedMetaString = completedMetaParts.join(" · ");

        // Active downloading metadata parts matching screenshot
        const downloadedOfTotalStr = formatDownloadedOfTotal(item.percent, item.total_size);
        const etaStr = formatEta(item.eta);
        const speedStr = formatSpeed(item.speed);
        const formatStr = (item.format || (item.is_audio ? "MP3" : "MP4")).toUpperCase();
        const qualityStr = formatQualityLabel(item.quality);
        const fpsStr = item.fps || "30fps";

        // Circular progress values for 38x38 SVG
        // Radius = 14, Circumference = 2 * PI * 14 ≈ 87.96
        const radius = 14;
        const circumference = 2 * Math.PI * radius;
        const currentPct = isMerging ? 99 : Math.max(0, Math.min(100, item.percent));
        const strokeDashoffset = circumference - (circumference * currentPct) / 100;

        return (
          <div
            key={item.download_id}
            className={`list-row-item status-${item.status}`}
          >
            {/* Thumbnail with Circular Progress Overlay or Play Overlay */}
            <div
              className={`row-thumb-box ${isRetrieving || !item.thumbnail ? "loading" : ""}`}
              onClick={() => {
                if (isCompleted && item.file_path) {
                  handleOpenFile(item.file_path);
                }
              }}
              title={isCompleted ? "Click to play" : undefined}
            >
              {item.thumbnail ? (
                <>
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="row-thumb-img"
                  />

                  {/* Downloading / Merging: Circular Progress Ring with Center Stop Square */}
                  {(isDownloading || isMerging) && (
                    <div
                      className="thumb-circular-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelDownload(item.download_id);
                      }}
                      title="Stop download"
                    >
                      <svg
                        className="circular-progress-svg"
                        width="38"
                        height="38"
                        viewBox="0 0 38 38"
                      >
                        {/* Dark circular disc underlay */}
                        <circle
                          cx="19"
                          cy="19"
                          r="17"
                          fill="rgba(0, 0, 0, 0.45)"
                        />
                        {/* Background track circle */}
                        <circle
                          cx="19"
                          cy="19"
                          r={radius}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.35)"
                          strokeWidth="2.8"
                        />
                        {/* Progress stroke */}
                        <circle
                          cx="19"
                          cy="19"
                          r={radius}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2.8"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform="rotate(-90 19 19)"
                          className={isMerging ? "merging-spin" : ""}
                        />
                        {/* Centered Stop square button */}
                        <rect
                          x="15"
                          y="15"
                          width="8"
                          height="8"
                          rx="1.5"
                          fill="#ffffff"
                          className="stop-rect"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Completed: Play button icon overlay */}
                  {isCompleted && (
                    <div className="thumb-play-overlay">
                      <Play size={13} fill="currentColor" />
                    </div>
                  )}
                </>
              ) : (
                <div className="thumb-loading-placeholder">
                  <Loader2 className="spin" size={18} />
                </div>
              )}
            </div>

            {/* Info and Metadata Line */}
            <div className="row-content">
              <h4
                className="row-title"
                title={item.title}
                onClick={() => {
                  if (isCompleted && item.file_path) {
                    handleOpenFile(item.file_path);
                  }
                }}
              >
                {item.title}
              </h4>

              {isRetrieving ? (
                /* Instant Feedback: Retrieving Information */
                <div className="row-retrieving-line">
                  <Loader2 className="spin" size={13} />
                  <span>Retrieving information...</span>
                </div>
              ) : isDownloading ? (
                /* Active Download Single-Line Info matching reference image */
                <div className="row-active-download-info">
                  <span className="download-pct-highlight">
                    {Math.round(item.percent)}% downloaded
                  </span>
                  {downloadedOfTotalStr && (
                    <>
                      <span className="meta-dot">·</span>
                      <span>{downloadedOfTotalStr}</span>
                    </>
                  )}
                  {etaStr && (
                    <>
                      <span className="meta-dot">·</span>
                      <span>{etaStr}</span>
                    </>
                  )}
                  {speedStr && (
                    <>
                      <span className="meta-dot">·</span>
                      <span>{speedStr}</span>
                    </>
                  )}
                  {formatStr && (
                    <>
                      <span className="meta-dot">·</span>
                      <span>{formatStr}</span>
                    </>
                  )}
                  {qualityStr && (
                    <>
                      <span className="meta-dot">·</span>
                      <span>{qualityStr}</span>
                    </>
                  )}
                  {fpsStr && !item.is_audio && (
                    <>
                      <span className="meta-dot">·</span>
                      <span>{fpsStr}</span>
                    </>
                  )}
                </div>
              ) : isMerging ? (
                /* Merging / Converting State */
                <div className="row-active-download-info">
                  <span className="download-pct-highlight">
                    Converting & Merging...
                  </span>
                  <span className="meta-dot">·</span>
                  <span>{formatStr}</span>
                  <span className="meta-dot">·</span>
                  <span>{qualityStr}</span>
                </div>
              ) : (
                /* Completed / Idle / Error metadata */
                <div className="row-meta-line">
                  {completedMetaString && <span>{completedMetaString}</span>}
                  {item.status === "error" && (
                    <span className="error-pill">
                      <AlertCircle size={12} />
                      {item.message || "Download failed"}
                    </span>
                  )}
                  {item.status === "cancelled" && (
                    <span className="cancelled-pill">Cancelled</span>
                  )}
                </div>
              )}
            </div>

            {/* Row Right Actions */}
            <div className="row-actions">
              {isDownloading || isMerging || isRetrieving ? (
                <button
                  type="button"
                  className="row-action-btn cancel"
                  onClick={() => {
                    if (isRetrieving) {
                      onClearItem(item.download_id);
                    } else {
                      onCancelDownload(item.download_id);
                    }
                  }}
                  title="Cancel download"
                >
                  <XCircle size={16} />
                  <span>Cancel</span>
                </button>
              ) : (
                <div className="row-completed-actions">
                  {isCompleted && item.file_path && (
                    <>
                      <button
                        type="button"
                        className="row-action-btn play"
                        onClick={() => handleOpenFile(item.file_path)}
                        title="Play in default player"
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Play</span>
                      </button>
                      <button
                        type="button"
                        className="row-action-btn finder"
                        onClick={() => handleRevealInFinder(item.file_path)}
                        title="Show in Finder"
                      >
                        <Folder size={14} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="row-action-btn delete"
                    onClick={() => onClearItem(item.download_id)}
                    title="Remove from list"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
