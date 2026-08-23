import Modal from './Modal';
import { APPLICATION_BASE_URL } from '../config';
import './AboutModal.css';

interface AboutModalProps {
  onClose: () => void;
}

const publicAssetBaseUrl = APPLICATION_BASE_URL;
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
      ariaDescribedBy="about-modal-description"
    >
      <div className="about-modal__logo">
        <img src={`${APPLICATION_BASE_URL}logo.svg`} alt="" className="about-modal__logo-img" />
      </div>
      <p id="about-modal-description" className="about-modal__description">
        A modern, browser-based tool for comparing text and visualizing differences with character-level precision.
      </p>
      <div className="about-modal__features">
        <h3>Features</h3>
        <ul role="list">
          <li>
            <span className="about-modal__check" aria-hidden="true">
              ✓
            </span>
            Side-by-side diff comparison
          </li>
          <li>
            <span className="about-modal__check" aria-hidden="true">
              ✓
            </span>
            Character-level change highlighting
          </li>
          <li>
            <span className="about-modal__check" aria-hidden="true">
              ✓
            </span>
            JSON mode with automatic sorting of keys
          </li>
          <li>
            <span className="about-modal__check" aria-hidden="true">
              ✓
            </span>
            Collapsible unchanged sections
          </li>
        </ul>
      </div>
      <div className="about-modal__features">
        <h3>Privacy</h3>
        <ul role="list">
          <li>
            <span className="about-modal__check" aria-hidden="true">
              ✓
            </span>
            All data processed locally
          </li>
          <li>
            <span className="about-modal__check" aria-hidden="true">
              ✓
            </span>
            No ads
          </li>
          <li>
            <span className="about-modal__check" aria-hidden="true">
              ✓
            </span>
            No trackers
          </li>
        </ul>
      </div>
      <div className="about-modal__credits">
        <p>
          <a
            href="https://github.com/aforemendude/text-diff-tool"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on GitHub (opens in a new tab)"
          >
            View on GitHub
          </a>
        </p>
        <p className="about-modal__font-license-links">
          <a
            href={`${fontLicenseBaseUrl}/inter/OFL.txt`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Inter license (opens in a new tab)"
          >
            Inter license
          </a>
          <span aria-hidden="true">·</span>
          <a
            href={`${fontLicenseBaseUrl}/jetbrains-mono/OFL.txt`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="JetBrains Mono license (opens in a new tab)"
          >
            JetBrains Mono license
          </a>
        </p>
        <p className="about-modal__software-license-link">
          <a
            href={`${publicAssetBaseUrl}THIRD_PARTY_NOTICES.txt`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Runtime library licenses and notices (opens in a new tab)"
          >
            Runtime library licenses and notices
          </a>
        </p>
      </div>
    </Modal>
  );
}

export default AboutModal;
