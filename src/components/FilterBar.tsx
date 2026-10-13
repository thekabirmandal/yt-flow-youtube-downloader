import React, { useState } from "react";
import { Search, ArrowUpDown, X } from "lucide-react";

interface FilterBarProps {
  currentTab: "all" | "video" | "audio";
  onTabChange: (tab: "all" | "video" | "audio") => void;
  itemCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortOrder: "desc" | "asc";
  onToggleSort: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  currentTab,
  onTabChange,
  itemCount,
  searchQuery,
  onSearchChange,
  sortOrder,
  onToggleSort,
}) => {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="filter-bar">
      <div className="filter-tabs">
        <button
          className={`tab-item ${currentTab === "all" ? "active" : ""}`}
          onClick={() => onTabChange("all")}
        >
          All
        </button>
        <button
          className={`tab-item ${currentTab === "video" ? "active" : ""}`}
          onClick={() => onTabChange("video")}
        >
          Video
        </button>
        <button
          className={`tab-item ${currentTab === "audio" ? "active" : ""}`}
          onClick={() => onTabChange("audio")}
        >
          Audio
        </button>
      </div>

      <div className="filter-actions">
        {showSearch ? (
          <div className="filter-search-box">
            <Search size={14} className="search-icon-inline" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
            <button
              className="search-close-btn"
              onClick={() => {
                setShowSearch(false);
                onSearchChange("");
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            className="filter-icon-btn"
            onClick={() => setShowSearch(true)}
            title="Search list"
          >
            <Search size={16} />
          </button>
        )}

        <span className="items-count-text">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>

        <button
          className="filter-icon-btn"
          onClick={onToggleSort}
          title={`Sort: ${sortOrder === "desc" ? "Newest First" : "Oldest First"}`}
        >
          <ArrowUpDown size={16} />
        </button>
      </div>
    </div>
  );
};
