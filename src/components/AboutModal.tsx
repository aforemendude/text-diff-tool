interface AboutModalProps {
  onClose: () => void;
}

function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title modal__title--info">
            About TextDiffTool
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body about-modal__body">
          <div className="about-modal__logo">
            <img
              src="/text-diff-tool/logo.svg"
              alt="TextDiffTool Logo"
              className="about-modal__logo-img"
            />
          </div>
          <p className="about-modal__description">
            A modern, browser-based tool for comparing text and visualizing
            differences with character-level precision.
          </p>
          <div className="about-modal__features">
            <h3>Features</h3>
            <ul>
              <li>Side-by-side diff comparison</li>
              <li>Character-level change highlighting</li>
              <li>JSON mode with automatic sorting of keys</li>
              <li>Collapsible unchanged sections</li>
            </ul>
          </div>
          <div className="about-modal__features">
            <h3>Privacy</h3>
            <ul>
              <li>All data processed locally</li>
              <li>No ads</li>
              <li>No trackers</li>
            </ul>
          </div>
          <div className="about-modal__credits">
            <p>
              <a
                href="https://github.com/aforemendude/text-diff-tool"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            </p>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AboutModal;
