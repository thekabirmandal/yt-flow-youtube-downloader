import React from "react";
import { Search, Clipboard, X, Loader2, ArrowRight } from "lucide-react";

interface UrlBarProps {
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  onFetch: () => void;
}

export const UrlBar: React.FC<UrlBarProps> = ({
  url,
  setUrl,
  isLoading,
  onFetch,
}) => {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && url.trim() && !isLoading) {
      onFetch();
    }
  };

  return (
    <div className="url-bar-container">
      <div className="url-input-wrapper">
        <Search className="input-search-icon" size={20} />
        <input
          type="text"
          className="url-input"
          placeholder="Paste YouTube link here (e.g. https://www.youtube.com/watch?v=...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        {url && (
          <button
            className="icon-btn-clear"
            onClick={() => setUrl("")}
            title="Clear input"
            disabled={isLoading}
          >
            <X size={16} />
          </button>
        )}
        <button
          className="btn-paste"
          onClick={handlePaste}
          title="Paste from clipboard"
          disabled={isLoading}
        >
          <Clipboard size={15} />
          <span>Paste</span>
        </button>
      </div>

      <button
        className="btn btn-fetch"
        onClick={onFetch}
        disabled={isLoading || !url.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 className="spin" size={18} />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <span>Fetch Details</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </div>
  );
};
