import React, { useState } from "react";
import { VideoMetadata } from "../types";
import {
  X,
  ChevronDown,
  Info,
} from "lucide-react";

interface FormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: VideoMetadata | null;
  isParsing: boolean;
  defaultOutputDir: string;
  onConfirmDownload: (quality: string, format: string, isAudio: boolean, outputDir: string) => void;
}

export const FormatModal: React.FC<FormatModalProps> = ({
  isOpen,
  onClose,
  metadata,
  isParsing,
  defaultOutputDir,
  onConfirmDownload,
}) => {
  if (!isOpen) return null;

  const [downloadType, setDownloadType] = useState<"video" | "audio">("video");
  const [selectedFormat, setSelectedFormat] = useState("mp4");
  const [selectedQuality, setSelectedQuality] = useState("best");

  const isAudio = downloadType === "audio";

  const videoQualities = [
    { label: "1080p", value: "1080p", fps: "60fps", size: "255.9 MB" },
    { label: "720p", value: "720p", fps: "60fps", size: "140.2 MB" },
    { label: "480p", value: "480p", fps: "30fps", size: "85.0 MB" },
    { label: "360p", value: "360p", fps: "30fps", size: "42.1 MB" },
  ];

  const audioQualities = [
    { label: "Original Bitrate", value: "best", fps: "VBR", size: "15.2 MB" },
    { label: "320 kbps", value: "mp3", fps: "CBR", size: "12.8 MB" },
    { label: "128 kbps", value: "128k", fps: "CBR", size: "5.1 MB" },
  ];

  const handleDownload = () => {
    if (isParsing || !metadata) return;
    const finalQuality = isAudio ? selectedFormat : selectedQuality;
    onConfirmDownload(finalQuality, selectedFormat, isAudio, defaultOutputDir);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content clip-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="clip-dialog-header">
          <span className="clip-dialog-title">
            {isParsing ? "Download Video: parsing..." : `Download ${isAudio ? "Audio" : "Video"}`}
          </span>
          <button className="icon-btn-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Top Preview Card (Shimmer while parsing / Metadata when parsed) */}
        <div className="clip-preview-row">
          {isParsing || !metadata ? (
            <>
              <div className="skeleton-thumb" />
              <div className="skeleton-meta">
                <div className="skeleton-line long" />
                <div className="skeleton-line short" />
              </div>
              <div className="parsing-spinner-wrap">
                <div className="green-circle-spinner" />
              </div>
            </>
          ) : (
            <>
              <div className="loaded-thumb-wrap">
                <img
                  src={metadata.thumbnail}
                  alt={metadata.title}
                  className="loaded-thumb-img"
                />
              </div>
              <div className="loaded-meta-info">
                <h3 className="loaded-title" title={metadata.title}>
                  {metadata.title}
                </h3>
                <span className="loaded-sub">
                  {metadata.duration_string} • {metadata.channel}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Controls Grid */}
        <div className="clip-controls-section">
          {/* Row 1: Download & Container dropdowns */}
          <div className="clip-controls-row">
            <div className="control-field">
              <label className="field-label">Download</label>
              <div className="custom-select-box">
                <select
                  value={downloadType}
                  onChange={(e) => {
                    const next = e.target.value as "video" | "audio";
                    setDownloadType(next);
                    setSelectedFormat(next === "video" ? "mp4" : "mp3");
                  }}
                >
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                </select>
                <ChevronDown size={15} className="select-arrow" />
              </div>
            </div>

            <div className="control-field">
              <label className="field-label">Container</label>
              <div className="custom-select-box">
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                >
                  {downloadType === "video" ? (
                    <>
                      <option value="mp4">MP4</option>
                      <option value="mkv">MKV</option>
                      <option value="webm">WebM</option>
                    </>
                  ) : (
                    <>
                      <option value="mp3">MP3</option>
                      <option value="m4a">M4A</option>
                      <option value="ogg">OGG</option>
                    </>
                  )}
                </select>
                <ChevronDown size={15} className="select-arrow" />
              </div>
            </div>
          </div>

          {/* Row 2: Secondary selectors matching screenshot */}
          <div className="clip-secondary-row">
            <div className="secondary-left">
              <div className="sub-select-wrap">
                <span>Codec <strong>Auto</strong></span>
                <ChevronDown size={13} />
              </div>
              <div className="sub-select-wrap">
                <span>Frame Rate <strong>Highest</strong></span>
                <ChevronDown size={13} />
              </div>
            </div>

            <div className="secondary-right">
              <div className="sub-select-wrap disabled">
                <span>Audio tracks</span>
                <ChevronDown size={13} />
              </div>
              <div className="sub-select-wrap disabled">
                <span>Subtitles</span>
                <ChevronDown size={13} />
              </div>
            </div>
          </div>

          {/* Quality Table Header */}
          <div className="quality-table-header">
            <div className="header-col">
              <span>Quality</span>
              <Info size={12} className="info-icon" />
            </div>
            <div className="header-col right">
              <span>Size</span>
              <Info size={12} className="info-icon" />
            </div>
          </div>

          {/* Quality List */}
          <div className="quality-table-body">
            {isParsing || !metadata ? (
              <div className="quality-placeholder-empty" />
            ) : (
              (!isAudio ? videoQualities : audioQualities).map((item) => (
                <label
                  key={item.value}
                  className={`quality-item-row ${
                    selectedQuality === item.value ? "selected" : ""
                  }`}
                >
                  <div className="quality-item-left">
                    <input
                      type="radio"
                      name="qualityPick"
                      checked={selectedQuality === item.value}
                      onChange={() => setSelectedQuality(item.value)}
                    />
                    <span className="quality-label-text">
                      {item.label}
                      {item.fps && <span className="fps-tag">{item.fps}</span>}
                    </span>
                  </div>
                  <span className="quality-size-text">{item.size}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="clip-dialog-footer">
          <button className="btn-clip-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn-clip-download ${isParsing ? "disabled" : ""}`}
            onClick={handleDownload}
            disabled={isParsing || !metadata}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
};
