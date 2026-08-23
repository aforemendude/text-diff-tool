import { useState } from 'react';
import AboutModal from './AboutModal';
import SettingsModal from './SettingsModal';
import type { DiffAlgorithm, DiffCleanupMode, DiffMode } from '../diff/types';
import './Header.css';

interface HeaderProps {
  isCompareMode: boolean;
  onToggleMode: () => void;
  isJsonMode: boolean;
  onJsonModeChange: (enabled: boolean) => void;
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
  diffAlgorithm: DiffAlgorithm;
  onDiffAlgorithmChange: (algorithm: DiffAlgorithm) => void;
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
  diffMode,
  onDiffModeChange,
  diffAlgorithm,
  onDiffAlgorithmChange,
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
        <div className="header__brand">
          <div className="header__logo">
            <img className="header__logo-image" src="/text-diff-tool/logo.svg" alt="" />
          </div>
          <h1 className="header__title">
            <span className="header__brand-text">Text</span>
            <span className="header__brand-diff">Diff</span>
            <span className="header__brand-tool">Tool</span>
          </h1>
        </div>
        <div className="header__controls">
          <button type="button" id="compare-btn" className="btn btn-primary" onClick={onToggleMode}>
            {isCompareMode ? 'Edit' : 'Compare'}
          </button>
          <label className="header__toggle">
            <input
              type="checkbox"
              checked={isJsonMode}
              onChange={(e) => onJsonModeChange(e.target.checked)}
              disabled={isCompareMode}
            />
            <span className="header__toggle-track">
              <span className="header__toggle-thumb"></span>
            </span>
            <span className="header__toggle-label">JSON Mode</span>
          </label>
          <button
            type="button"
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
        <div className="header__actions">
          <button type="button" className="header__about-button" onClick={() => setShowAbout(true)} aria-label="About">
            <svg
              aria-hidden="true"
              focusable="false"
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
          diffMode={diffMode}
          onDiffModeChange={onDiffModeChange}
          diffAlgorithm={diffAlgorithm}
          onDiffAlgorithmChange={onDiffAlgorithmChange}
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
