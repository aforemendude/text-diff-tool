interface HeaderProps {
  isCompareMode: boolean;
  onToggleMode: () => void;
}

function Header({ isCompareMode, onToggleMode }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <div className="logo-container">
          <img className="logo-icon" src="logo.svg" alt="TextDiffTool Logo" />
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
      </div>
      <div className="header-spacer"></div>
    </header>
  );
}

export default Header;
