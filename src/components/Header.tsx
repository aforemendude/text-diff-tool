interface HeaderProps {
  isCompareMode: boolean;
  onToggleMode: () => void;
  isJsonMode: boolean;
  onJsonModeChange: (enabled: boolean) => void;
}

function Header({
  isCompareMode,
  onToggleMode,
  isJsonMode,
  onJsonModeChange,
}: HeaderProps) {
  return (
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
      </div>
      <div className="header-spacer"></div>
    </header>
  );
}

export default Header;
