import React from "react";
import { VideoMetadata } from "../types";
import {
  Folder,
  Download,
  Film,
  Music,
  Clock,
  Eye,
  Check,
  FolderOpen,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface VideoPreviewCardProps {
  metadata: VideoMetadata;
  selectedQuality: string;
  setSelectedQuality: (q: string) => void;
  outputDir: string;
  setOutputDir: (dir: string) => void;
  onStartDownload: () => void;
  isStarting: boolean;
}

export const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({
  metadata,
  selectedQuality,
  setSelectedQuality,
  outputDir,
  setOutputDir,
  onStartDownload,
  isStarting,
}) => {
  const handleBrowseFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: outputDir,
        title: "Select Download Destination Folder",
      });
      if (selected && typeof selected === "string") {
        setOutputDir(selected);
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  };

  const isAudioOnly = selectedQuality === "mp3" || selectedQuality === "m4a";

  const videoQualities = metadata.available_qualities.filter(
    (q) => q !== "mp3" && q !== "m4a"
  );
  const audioQualities = metadata.available_qualities.filter(
    (q) => q === "mp3" || q === "m4a"
  );

  return (
    <div className="preview-card">
      <div className="preview-layout">
        {/* Thumbnail with duration badge */}
        <div className="thumbnail-wrapper">
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="video-thumbnail"
          />
          <div className="duration-badge">
            <Clock size={12} />
            <span>{metadata.duration_string}</span>
          </div>
        </div>

        {/* Video details */}
        <div className="video-details">
          <h2 className="video-title" title={metadata.title}>
            {metadata.title}
          </h2>
          <div className="channel-row">
            <span className="channel-name">{metadata.channel}</span>
            {metadata.view_count !== undefined && metadata.view_count !== null && (
              <span className="views-pill">
                <Eye size={12} />
                <span>{metadata.view_count.toLocaleString()} views</span>
              </span>
            )}
          </div>

          {/* Quality Selector */}
          <div className="options-section">
            <div className="section-label">
              <Film size={14} />
              <span>Video Formats (MP4)</span>
            </div>
            <div className="quality-pills">
              {videoQualities.map((q) => (
                <button
                  key={q}
                  className={`pill-btn ${selectedQuality === q ? "active" : ""}`}
                  onClick={() => setSelectedQuality(q)}
                >
                  {selectedQuality === q && <Check size={12} className="check-icon" />}
                  <span>{q === "best" ? "Best Quality" : q}</span>
                </button>
              ))}
            </div>

            <div className="section-label mt-3">
              <Music size={14} />
              <span>Audio Only</span>
            </div>
            <div className="quality-pills">
              {audioQualities.map((q) => (
                <button
                  key={q}
                  className={`pill-btn audio-pill ${selectedQuality === q ? "active" : ""}`}
                  onClick={() => setSelectedQuality(q)}
                >
                  {selectedQuality === q && <Check size={12} className="check-icon" />}
                  <span>{q.toUpperCase()} Audio</span>
                </button>
              ))}
            </div>
          </div>

          {/* Destination Folder */}
          <div className="destination-row">
            <div className="folder-display" title={outputDir}>
              <Folder size={16} className="folder-icon" />
              <span className="folder-path">{outputDir}</span>
            </div>
            <button className="btn-browse" onClick={handleBrowseFolder}>
              <FolderOpen size={14} />
              <span>Browse</span>
            </button>
          </div>

          {/* Download Action */}
          <div className="action-row">
            <button
              className="btn btn-download-now"
              onClick={onStartDownload}
              disabled={isStarting}
            >
              <Download size={18} />
              <span>
                {isStarting
                  ? "Starting..."
                  : isAudioOnly
                  ? `Download ${selectedQuality.toUpperCase()} Audio`
                  : `Download ${selectedQuality === "best" ? "Best Video" : selectedQuality}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
