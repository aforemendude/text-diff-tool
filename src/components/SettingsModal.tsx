import React from 'react';
import type { DiffCleanupMode } from '../types/diff';
import Modal from './Modal';
import './SettingsModal.css';

interface SettingsModalProps {
  onClose: () => void;
  diffCleanupMode: DiffCleanupMode;
  onDiffCleanupModeChange: (mode: DiffCleanupMode) => void;
  editCost: number;
  onEditCostChange: (cost: number) => void;
}

const cleanupModes: {
  value: DiffCleanupMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'semantic',
    label: 'Semantic Cleanup',
    description: 'Optimizes diffs for human readability by merging short edits and aligning to word boundaries.',
  },
  {
    value: 'efficiency',
    label: 'Efficiency Cleanup',
    description: 'Reduces the number of edit operations while preserving correctness. Good for minimal patches.',
  },
  {
    value: 'none',
    label: 'No Cleanup',
    description: 'Raw diff output without any post-processing. Shows the exact character-level differences.',
  },
];

function SettingsModal({
  onClose,
  diffCleanupMode,
  onDiffCleanupModeChange,
  editCost,
  onEditCostChange,
}: SettingsModalProps) {
  const handleEditCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      onEditCostChange(val);
    } else {
      onEditCostChange(editCost);
    }
  };

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      variant="info"
      className="settings-modal"
      bodyClassName="settings-modal__body"
      actionLabel="Done"
    >
      <div className="settings-modal__section">
        <h3 className="settings-modal__section-title">Diff Cleanup Mode</h3>
        <p className="settings-modal__section-description">Choose how the diff algorithm processes the results.</p>
        <div className="settings-modal__options">
          {cleanupModes.map((mode) => (
            <label
              key={mode.value}
              className={
                diffCleanupMode === mode.value
                  ? 'settings-modal__option settings-modal__option--selected'
                  : 'settings-modal__option'
              }
            >
              <input
                type="radio"
                name="diffCleanupMode"
                value={mode.value}
                checked={diffCleanupMode === mode.value}
                onChange={() => onDiffCleanupModeChange(mode.value)}
              />
              <div className="settings-modal__option-content">
                <span className="settings-modal__option-label">{mode.label}</span>
                <span className="settings-modal__option-description">{mode.description}</span>
              </div>
              <span className="settings-modal__option-check">
                {diffCleanupMode === mode.value && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="settings-modal__section">
        <h3 className="settings-modal__section-title">Edit Cost</h3>
        <p className="settings-modal__section-description">
          The cost of an edit operation in terms of characters. Higher values lead to fewer, larger edits. Applies to
          Efficiency Cleanup.
        </p>
        <div className="settings-modal__input-group">
          <input
            type="number"
            id="edit-cost"
            className="settings-modal__input"
            min="0"
            value={editCost}
            onChange={handleEditCostChange}
            disabled={diffCleanupMode !== 'efficiency'}
          />
        </div>
      </div>
    </Modal>
  );
}

export default SettingsModal;
