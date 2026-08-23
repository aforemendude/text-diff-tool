import './AboutModal.css';
import Modal from './Modal';

interface AboutModalProps {
  onClose: () => void;
}

const publicAssetBaseUrl = import.meta.env.BASE_URL;
const fontLicenseBaseUrl = `${publicAssetBaseUrl}fonts`;

function AboutModal({ onClose }: AboutModalProps) {
  return (
    <Modal
      title="About TextDiffTool"
      onClose={onClose}
      variant="info"
      className="about-modal"
      bodyClassName="about-modal__body"
      actionLabel="Close"
    >
      <div className="about-modal__logo">
        <img src="/text-diff-tool/logo.svg" alt="TextDiffTool Logo" className="about-modal__logo-img" />
      </div>
      <p className="about-modal__description">
        A modern, browser-based tool for comparing text and visualizing differences with character-level precision.
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
          <a href="https://github.com/aforemendude/text-diff-tool" target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </p>
        <p className="about-modal__font-license-links">
          <a href={`${fontLicenseBaseUrl}/inter/OFL.txt`} target="_blank" rel="noopener noreferrer">
            Inter license
          </a>
          <span aria-hidden="true">·</span>
          <a href={`${fontLicenseBaseUrl}/jetbrains-mono/OFL.txt`} target="_blank" rel="noopener noreferrer">
            JetBrains Mono license
          </a>
        </p>
        <p className="about-modal__software-license-link">
          <a href={`${publicAssetBaseUrl}THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noopener noreferrer">
            Runtime library licenses and notices
          </a>
        </p>
      </div>
    </Modal>
  );
}

export default AboutModal;
