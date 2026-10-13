import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  EngineStatus,
  EngineProgressPayload,
  VideoMetadata,
  DownloadItem,
  DownloadProgressPayload,
} from "./types";
import { TopToolbar } from "./components/TopToolbar";
import { FilterBar } from "./components/FilterBar";
import { DownloadsList } from "./components/DownloadsList";
import { EngineModal } from "./components/EngineModal";
import { FormatModal } from "./components/FormatModal";
import { AlertTriangle } from "lucide-react";
import "./App.css";

const STORAGE_KEY = "ytflow_downloads_history_v2";

function App() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [isEngineSettingUp, setIsEngineSettingUp] = useState(false);
  const [engineProgress, setEngineProgress] = useState<EngineProgressPayload | null>(null);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);

  // Format selection modal (when Smart Mode is OFF)
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [isParsingModal, setIsParsingModal] = useState(false);
  const [pendingMetadata, setPendingMetadata] = useState<VideoMetadata | null>(null);
  const [pendingDownloadId, setPendingDownloadId] = useState<string | null>(null);

  // Toolbar state
  const [downloadType, setDownloadType] = useState<"video" | "audio">("video");
  const [quality, setQuality] = useState("best");
  const [format, setFormat] = useState("mp4");
  const [outputDir, setOutputDir] = useState("");
  const [smartMode, setSmartMode] = useState(false);
  // Filter & Search
  const [currentTab, setCurrentTab] = useState<"all" | "video" | "audio">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Downloads history
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isProcessing = downloads.some((d) => d.status === "retrieving");

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
    } catch {
      // Ignore
    }
  }, [downloads]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        const status = await invoke<EngineStatus>("check_engine");
        setEngineStatus(status);
      } catch (err) {
        console.error("Failed to check engine:", err);
      }

      try {
        const defDir = await invoke<string>("get_default_download_dir");
        setOutputDir(defDir);
      } catch (err) {
        console.error("Failed to get default dir:", err);
      }
    };

    init();

    const unlistenEngine = listen<EngineProgressPayload>(
      "engine-setup-progress",
      (event) => {
        setEngineProgress(event.payload);
        if (event.payload.percent >= 100) {
          setIsEngineSettingUp(false);
        }
      }
    );

    const unlistenDownload = listen<DownloadProgressPayload>(
      "download-progress",
      (event) => {
        const p = event.payload;
        setDownloads((prev) =>
          prev.map((item) => {
            if (item.download_id === p.download_id) {
              return {
                ...item,
                percent: p.percent,
                speed: p.speed !== "--" ? p.speed : item.speed,
                eta: p.eta !== "--" ? p.eta : item.eta,
                total_size: p.total_size !== "--" ? p.total_size : item.total_size,
                status: p.status,
                message: p.message,
                file_path: p.file_path || item.file_path,
              };
            }
            return item;
          })
        );
      }
    );

    return () => {
      unlistenEngine.then((f) => f());
      unlistenDownload.then((f) => f());
    };
  }, []);

  const handleInstallEngine = async () => {
    setIsEngineSettingUp(true);
    try {
      const newStatus = await invoke<EngineStatus>("setup_engine");
      setEngineStatus(newStatus);
    } catch (err: unknown) {
      console.error("Setup engine error:", err);
      alert(`Setup error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsEngineSettingUp(false);
    }
  };

  const handlePasteLink = async (manualUrl?: string) => {
    if (!engineStatus?.is_ready) {
      setIsEngineModalOpen(true);
      return;
    }

    let urlToUse = manualUrl?.trim();
    if (!urlToUse) {
      try {
        const nativeClipboard = await invoke<string>("read_clipboard");
        if (nativeClipboard && (nativeClipboard.includes("youtube.com") || nativeClipboard.includes("youtu.be"))) {
          urlToUse = nativeClipboard.trim();
        }
      } catch (e) {
        console.warn("Native clipboard read failed:", e);
      }
    }

    if (!urlToUse) {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && (clipboardText.includes("youtube.com") || clipboardText.includes("youtu.be"))) {
          urlToUse = clipboardText.trim();
        }
      } catch {
        // Fallback
      }
    }

    if (!urlToUse) {
      alert("Please copy a YouTube link to your clipboard first, or click the search icon to type a URL.");
      return;
    }

    const downloadId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isAudio = downloadType === "audio";
    const initialTargetQuality = isAudio ? format : quality;

    if (smartMode) {
      // 1. Smart Mode ON: Immediately create & add item with status "retrieving"
      const initialItem: DownloadItem = {
        download_id: downloadId,
        url: urlToUse,
        title: urlToUse,
        channel: "",
        thumbnail: "",
        quality: initialTargetQuality,
        format: format,
        is_audio: isAudio,
        duration_string: "",
        percent: 0,
        speed: "--",
        eta: "--",
        total_size: "--",
        status: "retrieving",
        message: "Retrieving information...",
        timestamp: Date.now(),
      };

      setDownloads((prev) => [initialItem, ...prev]);

      try {
        const meta = await invoke<VideoMetadata>("get_video_info", { url: urlToUse });

        // Update item with fetched metadata & switch to downloading
        setDownloads((prev) =>
          prev.map((item) =>
            item.download_id === downloadId
              ? {
                  ...item,
                  title: meta.title,
                  channel: meta.channel,
                  thumbnail: meta.thumbnail,
                  duration_string: meta.duration_string,
                  fps: meta.fps ? `${meta.fps}fps` : "30fps",
                  status: "downloading",
                  message: "Starting download...",
                }
              : item
          )
        );

        await invoke("start_download", {
          req: {
            download_id: downloadId,
            url: `https://www.youtube.com/watch?v=${meta.id}`,
            quality: initialTargetQuality,
            output_dir: outputDir,
          },
        });
      } catch (err: unknown) {
        console.error("Fetch metadata error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setDownloads((prev) =>
          prev.map((item) =>
            item.download_id === downloadId
              ? {
                  ...item,
                  status: "error",
                  message: `Failed to retrieve: ${errMsg}`,
                }
              : item
          )
        );
      }
    } else {
      // 2. Smart Mode OFF: Do NOT add to the list yet!
      // Open FormatModal immediately in parsing state and wait for user selection.
      setPendingDownloadId(downloadId);
      setPendingMetadata(null);
      setIsParsingModal(true);
      setIsFormatModalOpen(true);

      try {
        const meta = await invoke<VideoMetadata>("get_video_info", { url: urlToUse });
        setPendingMetadata(meta);
        setIsParsingModal(false);
      } catch (err: unknown) {
        console.error("Fetch metadata error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setIsParsingModal(false);
        setIsFormatModalOpen(false);
        setPendingDownloadId(null);
        alert(`Failed to parse video: ${errMsg}`);
      }
    }
  };

  const handleConfirmModalDownload = async (
    chosenQuality: string,
    chosenFormat: string,
    isAudio: boolean,
    chosenDir: string
  ) => {
    if (!pendingMetadata) return;
    const downloadId = pendingDownloadId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const meta = pendingMetadata;
    setPendingDownloadId(null);
    setPendingMetadata(null);

    // Create and add the new item to downloads list upon user confirmation
    const newItem: DownloadItem = {
      download_id: downloadId,
      url: `https://www.youtube.com/watch?v=${meta.id}`,
      title: meta.title,
      channel: meta.channel,
      thumbnail: meta.thumbnail,
      quality: chosenQuality,
      format: chosenFormat,
      is_audio: isAudio,
      duration_string: meta.duration_string,
      fps: meta.fps ? `${meta.fps}fps` : "30fps",
      percent: 0,
      speed: "--",
      eta: "--",
      total_size: "--",
      status: "downloading",
      message: "Starting download...",
      timestamp: Date.now(),
    };

    setDownloads((prev) => [newItem, ...prev]);

    try {
      await invoke("start_download", {
        req: {
          download_id: downloadId,
          url: `https://www.youtube.com/watch?v=${meta.id}`,
          quality: chosenQuality,
          output_dir: chosenDir,
        },
      });
    } catch (err: unknown) {
      console.error("Download start error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setDownloads((prev) =>
        prev.map((item) =>
          item.download_id === downloadId
            ? {
                ...item,
                status: "error",
                message: errMsg,
              }
            : item
        )
      );
    }
  };

  const handleCancelDownload = async (downloadId: string) => {
    try {
      await invoke("cancel_download", { downloadId });
      setDownloads((prev) =>
        prev.map((item) =>
          item.download_id === downloadId
            ? { ...item, status: "cancelled", message: "Cancelled by user" }
            : item
        )
      );
    } catch (err) {
      console.error("Cancel error:", err);
    }
  };

  const handleClearItem = (downloadId: string) => {
    setDownloads((prev) => prev.filter((item) => item.download_id !== downloadId));
  };

  // Filter and sort items for display
  const filteredItems = downloads
    .filter((item) => {
      if (currentTab === "video" && item.is_audio) return false;
      if (currentTab === "audio" && !item.is_audio) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.channel.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      return sortOrder === "desc"
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp;
    });

  return (
    <div className="app-wrapper">
      {/* 1. Single-line Top Toolbar */}
      <TopToolbar
        onPasteLink={handlePasteLink}
        isProcessing={isProcessing}
        downloadType={downloadType}
        setDownloadType={setDownloadType}
        quality={quality}
        setQuality={setQuality}
        format={format}
        setFormat={setFormat}
        outputDir={outputDir}
        setOutputDir={setOutputDir}
        smartMode={smartMode}
        setSmartMode={setSmartMode}
        engineStatus={engineStatus}
        onOpenSettings={() => setIsEngineModalOpen(true)}
      />

      {/* Setup Warning Banner if engine components are missing */}
      {engineStatus && !engineStatus.is_ready && !isEngineSettingUp && (
        <div className="setup-alert-banner">
          <div className="setup-alert-left">
            <AlertTriangle size={17} />
            <span>Downloader engine setup is needed to extract and download videos.</span>
          </div>
          <button
            className="btn-setup-inline"
            onClick={() => setIsEngineModalOpen(true)}
          >
            Setup Engine
          </button>
        </div>
      )}

      {/* 2. Category & Filter Navigation Bar */}
      <FilterBar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        itemCount={filteredItems.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOrder={sortOrder}
        onToggleSort={() =>
          setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
        }
      />

      {/* 3. Compact Downloads List */}
      <DownloadsList
        items={filteredItems}
        onCancelDownload={handleCancelDownload}
        onClearItem={handleClearItem}
      />

      {/* 4. Format Selection Modal (shown when Smart Mode is OFF) */}
      <FormatModal
        isOpen={isFormatModalOpen}
        onClose={() => {
          setIsFormatModalOpen(false);
          setIsParsingModal(false);
          setPendingDownloadId(null);
          setPendingMetadata(null);
        }}
        metadata={pendingMetadata}
        isParsing={isParsingModal}
        defaultOutputDir={outputDir}
        onConfirmDownload={handleConfirmModalDownload}
      />

      {/* 5. Engine & Settings Modal */}
      <EngineModal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        status={engineStatus}
        isSettingUp={isEngineSettingUp}
        progress={engineProgress}
        onInstallEngine={handleInstallEngine}
      />
    </div>
  );
}

export default App;
