import { useState } from 'react';
import AboutModal from './AboutModal';
import SettingsModal, { type DiffCleanupMode } from './SettingsModal';

interface HeaderProps {
  isCompareMode: boolean;
  onToggleMode: () => void;
  isJsonMode: boolean;
  onJsonModeChange: (enabled: boolean) => void;
  diffCleanupMode: DiffCleanupMode;
  onDiffCleanupModeChange: (mode: DiffCleanupMode) => void;
  editCost: number;
  onEditCostChange: (cost: number) => void;
}

function Header({
  isCompareMode,
  onToggleMode,
  isJsonMode,
  onJsonModeChange,
  diffCleanupMode,
  onDiffCleanupModeChange,
  editCost,
  onEditCostChange,
}: HeaderProps) {
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="header">
        <div className="brand">
          <div className="logo-container">
            <img
              className="logo-icon"
              src="/text-diff-tool/logo.svg"
              alt="TextDiffTool Logo"
            />
          </div>
          <h1>
            <span className="brand-text">Text</span>
            <span className="brand-diff">Diff</span>
            <span className="brand-tool">Tool</span>
          </h1>
        </div>
        <div className="header-center">
          <button
            id="compare-btn"
            className="btn btn-primary"
            onClick={onToggleMode}
          >
            {isCompareMode ? 'Edit' : 'Compare'}
          </button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={isJsonMode}
              onChange={(e) => onJsonModeChange(e.target.checked)}
              disabled={isCompareMode}
            />
            <span className="toggle__track">
              <span className="toggle__thumb"></span>
            </span>
            <span className="toggle__label">JSON Mode</span>
          </label>
          <button
            id="settings-btn"
            className="btn btn-secondary"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            title="Diff Settings"
            disabled={isCompareMode}
          >
            Settings
          </button>
        </div>
        <div className="header-right">
          <button
            className="about-btn"
            onClick={() => setShowAbout(true)}
            aria-label="About"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </button>
        </div>
      </header>
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          diffCleanupMode={diffCleanupMode}
          onDiffCleanupModeChange={onDiffCleanupModeChange}
          editCost={editCost}
          onEditCostChange={onEditCostChange}
        />
      )}
    </>
  );
}

export default Header;
