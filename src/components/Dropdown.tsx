import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Check, ChevronRight, Sparkles } from "lucide-react";

export interface DropdownOption {
  label: string;
  value: string;
  isAction?: boolean;
  isDividerBefore?: boolean;
  extraRight?: string;
  isSparkle?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  onAction?: () => void;
  minWidth?: number;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options,
  onChange,
  onAction,
  minWidth = 190,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    // Attach listener on next tick so the opening click does not immediately trigger it
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      className={`dropdown-container ${isOpen ? "is-open" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className={`dropdown-trigger ${isOpen ? "open" : ""}`}
        onClick={handleToggle}
      >
        <span className="dropdown-label">{label}</span>
        <span className="dropdown-value">{displayLabel}</span>
        {isOpen ? (
          <ChevronUp size={14} className="dropdown-chevron" />
        ) : (
          <ChevronDown size={14} className="dropdown-chevron" />
        )}
      </button>

      {isOpen && (
        <div
          className="dropdown-menu"
          style={{ minWidth: `${minWidth}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt, idx) => (
            <React.Fragment key={opt.value + idx}>
              {opt.isDividerBefore && <div className="dropdown-divider" />}
              <div
                className={`dropdown-item ${opt.value === value ? "selected" : ""} ${
                  opt.disabled ? "disabled-item" : ""
                } ${opt.isAction ? "action-item" : ""}`}
                onClick={() => {
                  if (opt.disabled) return;
                  setIsOpen(false);
                  if (opt.isAction && onAction) {
                    onAction();
                  } else {
                    onChange(opt.value);
                  }
                }}
              >
                <div className="item-label-wrap">
                  <span>{opt.label}</span>
                  {opt.isSparkle && (
                    <Sparkles size={12} className="item-sparkle-icon" />
                  )}
                </div>

                <div className="item-right-wrap">
                  {opt.value === value && !opt.isAction && (
                    <Check size={14} strokeWidth={2.5} className="item-check" />
                  )}
                  {opt.extraRight && (
                    <span className="item-extra-right">{opt.extraRight}</span>
                  )}
                  {opt.disabled && !opt.extraRight && (
                    <ChevronRight size={14} className="item-arrow-right" />
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
