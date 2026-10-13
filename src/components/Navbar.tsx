import React from "react";
import { EngineStatus } from "../types";
import { CheckCircle2, AlertTriangle, RefreshCw, Settings2 } from "lucide-react";

interface NavbarProps {
  engineStatus: EngineStatus | null;
  isEngineSettingUp: boolean;
  onOpenEngineModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  engineStatus,
  isEngineSettingUp,
  onOpenEngineModal,
}) => {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-icon">
          <svg
            className="yt-icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="currentColor"
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <div>
          <h1 className="brand-title">YT Flow</h1>
          <span className="brand-subtitle">High-Speed Video & Audio Downloader</span>
        </div>
      </div>

      <div className="navbar-actions">
        <button
          className={`engine-badge ${
            isEngineSettingUp
              ? "setting-up"
              : engineStatus?.is_ready
              ? "ready"
              : "warning"
          }`}
          onClick={onOpenEngineModal}
          title="Click to check engine status & settings"
        >
          {isEngineSettingUp ? (
            <>
              <RefreshCw className="spin" size={15} />
              <span>Setting up Engine...</span>
            </>
          ) : engineStatus?.is_ready ? (
            <>
              <CheckCircle2 size={15} />
              <span>Engine Ready</span>
              {engineStatus.yt_dlp_version && (
                <span className="version-tag">{engineStatus.yt_dlp_version}</span>
              )}
            </>
          ) : (
            <>
              <AlertTriangle size={15} />
              <span>Setup Required</span>
            </>
          )}
          <Settings2 size={14} className="engine-settings-icon" />
        </button>
      </div>
    </header>
  );
};
