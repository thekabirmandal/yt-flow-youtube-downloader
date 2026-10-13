import React from "react";
import { EngineStatus, EngineProgressPayload } from "../types";
import { X, HardDrive, Download, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface EngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: EngineStatus | null;
  isSettingUp: boolean;
  progress: EngineProgressPayload | null;
  onInstallEngine: () => void;
}

export const EngineModal: React.FC<EngineModalProps> = ({
  isOpen,
  onClose,
  status,
  isSettingUp,
  progress,
  onInstallEngine,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="YT FLOW" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover" }} />
            <h2>YT FLOW Download Engine</h2>
          </div>
          <button className="icon-btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Download and set up the media engine to enable high-quality video downloads (up to 4K / 8K) and fast MP3 audio extraction.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-hover)",
              border: "1px solid var(--border-light)",
              marginBottom: isSettingUp ? 14 : 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {status?.is_ready ? (
                <CheckCircle className="status-icon green" size={20} />
              ) : (
                <AlertCircle className="status-icon orange" size={20} />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)" }}>
                  {status?.is_ready ? "Download Engine Installed" : "Engine Installation Required"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {status?.is_ready
                    ? "Engine is ready for full-speed downloads and conversion."
                    : "Click the button below to install automatically."}
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: status?.is_ready ? "var(--green-light)" : "rgba(245, 158, 11, 0.15)",
                color: status?.is_ready ? "var(--green-primary)" : "#d97706",
              }}
            >
              {status?.is_ready ? "Ready" : "Not Installed"}
            </span>
          </div>

          {/* Progress bar if installing */}
          {isSettingUp && (
            <div className="setup-progress-box">
              <div className="progress-info">
                <span className="progress-msg">
                  <RefreshCw className="spin" size={14} />
                  {progress?.message || "Downloading engine components..."}
                </span>
                <span className="progress-pct">{Math.round(progress?.percent || 0)}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress?.percent || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div
            className="footer-left"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginRight: "auto",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
            }}
          >
            <HardDrive size={15} />
            <span>Installed locally into Application Support</span>
          </div>
          <button
            className="btn btn-primary"
            onClick={onInstallEngine}
            disabled={isSettingUp}
          >
            {isSettingUp ? (
              <>
                <RefreshCw className="spin" size={16} />
                <span>Downloading Engine...</span>
              </>
            ) : status?.is_ready ? (
              <>
                <RefreshCw size={16} />
                <span>Reinstall / Update Engine</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>One-Click Install Engine</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
