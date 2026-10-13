import React, { useState } from "react";
import { Dropdown, DropdownOption } from "./Dropdown";
import {
  Play,
  Settings,
  Search,
  X,
  Loader2,
  Lightbulb,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { EngineStatus } from "../types";

interface TopToolbarProps {
  onPasteLink: (manualUrl?: string) => void;
  isProcessing: boolean;
  downloadType: "video" | "audio";
  setDownloadType: (type: "video" | "audio") => void;
  quality: string;
  setQuality: (quality: string) => void;
  format: string;
  setFormat: (format: string) => void;
  outputDir: string;
  setOutputDir: (dir: string) => void;
  smartMode: boolean;
  setSmartMode: (val: boolean) => void;
  engineStatus: EngineStatus | null;
  onOpenSettings: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  onPasteLink,
  isProcessing,
  downloadType,
  setDownloadType,
  quality,
  setQuality,
  format,
  setFormat,
  outputDir,
  setOutputDir,
  smartMode,
  setSmartMode,
  engineStatus,
  onOpenSettings,
}) => {
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  const downloadTypeOptions: DropdownOption[] = [
    { label: "Video", value: "video" },
    { label: "Audio", value: "audio" },
    {
      label: "Subtitles",
      value: "subtitles_info",
      isDividerBefore: true,
      isSparkle: true,
      extraRight: ">",
      disabled: true,
    },
    {
      label: "Audio tracks",
      value: "audiotracks_info",
      isSparkle: true,
      extraRight: ">",
      disabled: true,
    },
  ];

  const qualityOptions: DropdownOption[] =
    downloadType === "video"
      ? [
          { label: "Best", value: "best" },
          { label: "UHD 8K", value: "4320p" },
          { label: "HD 4K", value: "2160p" },
          { label: "HQ 2K", value: "1440p" },
          { label: "1080p", value: "1080p" },
          { label: "720p", value: "720p" },
          { label: "480p", value: "480p" },
          { label: "360p", value: "360p" },
          { label: "240p", value: "240p" },
          { label: "144p", value: "144p" },
          {
            label: "Frame Rate",
            value: "framerate_info",
            isDividerBefore: true,
            extraRight: "Highest >",
            disabled: true,
          },
          {
            label: "Codec",
            value: "codec_info",
            extraRight: "H264 >",
            disabled: true,
          },
          {
            label: "VR",
            value: "vr_info",
            extraRight: "Any >",
            disabled: true,
          },
        ]
      : [
          { label: "Best (320 kbps)", value: "best" },
          { label: "High (256 kbps)", value: "256k" },
          { label: "Medium (192 kbps)", value: "192k" },
          { label: "Standard (128 kbps)", value: "128k" },
        ];

  const formatOptions: DropdownOption[] =
    downloadType === "video"
      ? [
          { label: "MP4", value: "mp4" },
          { label: "MKV", value: "mkv" },
          { label: "WebM", value: "webm" },
        ]
      : [
          { label: "MP3", value: "mp3" },
          { label: "M4A", value: "m4a" },
          { label: "OGG", value: "ogg" },
        ];

  const getFolderBaseName = (p: string) => {
    if (!p) return "Downloads";
    const parts = p.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || "Downloads";
  };

  const saveToOptions: DropdownOption[] = [
    { label: getFolderBaseName(outputDir), value: outputDir },
    {
      label: "Choose Folder...",
      value: "choose_custom",
      isDividerBefore: true,
      isAction: true,
    },
  ];

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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrl.trim()) {
      onPasteLink(manualUrl.trim());
      setManualUrl("");
      setShowManualInput(false);
    }
  };

  return (
    <div className="top-toolbar-container">
      <div className="top-toolbar">
        {/* Paste Link Button (Green button with Play icon) */}
        <button
          type="button"
          className="btn-paste-link"
          onClick={() => onPasteLink()}
          disabled={isProcessing}
          title="Click to paste URL from clipboard"
        >
          {isProcessing ? (
            <Loader2 className="spin" size={17} />
          ) : (
            <Play className="paste-play-icon" size={16} fill="currentColor" />
          )}
          <span>{isProcessing ? "Processing..." : "Paste Link"}</span>
        </button>

        {/* Smart Mode Toggle Switch with Lightbulb */}
        <div className="smart-mode-wrap">
          <button
            type="button"
            className={`smart-toggle-switch ${smartMode ? "active" : ""}`}
            onClick={() => setSmartMode(!smartMode)}
            title={`Smart Mode: ${smartMode ? "ON" : "OFF"}`}
          >
            <div className="toggle-thumb">
              <Lightbulb size={11} className="thumb-lightbulb" />
            </div>
          </button>
        </div>

        {/* When Smart Mode is OFF: show label like 4K Video Downloader */}
        {!smartMode ? (
          <div
            className="smart-mode-hint"
            onClick={() => setSmartMode(true)}
            title="Click to turn on Smart Mode"
          >
            Enable Smart Mode to download links in one click
          </div>
        ) : (
          /* When Smart Mode is ON: show dropdown selectors in one line */
          <div className="toolbar-dropdowns">
            <Dropdown
              label="Download"
              value={downloadType}
              options={downloadTypeOptions}
              minWidth={210}
              onChange={(val) => {
                const nextType = val as "video" | "audio";
                setDownloadType(nextType);
                if (nextType === "audio" && format !== "mp3" && format !== "m4a") {
                  setFormat("mp3");
                } else if (nextType === "video" && (format === "mp3" || format === "m4a")) {
                  setFormat("mp4");
                }
              }}
            />

            <Dropdown
              label="Quality"
              value={quality}
              options={qualityOptions}
              minWidth={215}
              onChange={(val) => setQuality(val)}
            />

            <Dropdown
              label="Format"
              value={format}
              options={formatOptions}
              minWidth={170}
              onChange={(val) => setFormat(val)}
            />

            <Dropdown
              label="Save to"
              value={outputDir}
              options={saveToOptions}
              minWidth={200}
              onChange={() => {}}
              onAction={handleBrowseFolder}
            />
          </div>
        )}

        {/* Right utility buttons */}
        <div className="toolbar-right-actions">
          <button
            type="button"
            className={`tool-icon-btn ${showManualInput ? "active" : ""}`}
            onClick={() => setShowManualInput(!showManualInput)}
            title="Enter URL manually"
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            className="tool-icon-btn settings-btn"
            onClick={onOpenSettings}
            title={engineStatus?.is_ready ? "Engine ready (Settings)" : "Engine setup needed"}
          >
            <Settings size={18} />
            {!engineStatus?.is_ready && <span className="warning-dot" />}
          </button>
        </div>
      </div>

      {/* Manual URL Input Bar if triggered */}
      {showManualInput && (
        <form className="manual-url-bar" onSubmit={handleManualSubmit}>
          <input
            type="text"
            className="manual-url-input"
            placeholder="Enter or paste YouTube video URL..."
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            autoFocus
          />
          <button type="submit" className="manual-url-submit" disabled={!manualUrl.trim()}>
            Fetch & Download
          </button>
          <button
            type="button"
            className="manual-url-close"
            onClick={() => setShowManualInput(false)}
          >
            <X size={16} />
          </button>
        </form>
      )}
    </div>
  );
};
