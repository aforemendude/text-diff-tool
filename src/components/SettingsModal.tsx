import React from 'react';

export type DiffCleanupMode = 'semantic' | 'efficiency' | 'none';

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
    description:
      'Optimizes diffs for human readability by merging short edits and aligning to word boundaries.',
  },
  {
    value: 'efficiency',
    label: 'Efficiency Cleanup',
    description:
      'Reduces the number of edit operations while preserving correctness. Good for minimal patches.',
  },
  {
    value: 'none',
    label: 'No Cleanup',
    description:
      'Raw diff output without any post-processing. Shows the exact character-level differences.',
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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title modal__title--info">Settings</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body settings-modal__body">
          <div className="settings-section">
            <h3 className="settings-section__title">Diff Cleanup Mode</h3>
            <p className="settings-section__description">
              Choose how the diff algorithm processes the results.
            </p>
            <div className="settings-options">
              {cleanupModes.map((mode) => (
                <label
                  key={mode.value}
                  className={`settings-option ${
                    diffCleanupMode === mode.value
                      ? 'settings-option--selected'
                      : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="diffCleanupMode"
                    value={mode.value}
                    checked={diffCleanupMode === mode.value}
                    onChange={() => onDiffCleanupModeChange(mode.value)}
                  />
                  <div className="settings-option__content">
                    <span className="settings-option__label">{mode.label}</span>
                    <span className="settings-option__description">
                      {mode.description}
                    </span>
                  </div>
                  <span className="settings-option__check">
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
          <div className="settings-section">
            <h3 className="settings-section__title">Edit Cost</h3>
            <p className="settings-section__description">
              The cost of an edit operation in terms of characters. Higher
              values lead to fewer, larger edits. Applies to Efficiency Cleanup.
            </p>
            <div className="settings-input-group">
              <input
                type="number"
                id="edit-cost"
                className="settings-input"
                min="0"
                value={editCost}
                onChange={handleEditCostChange}
                disabled={diffCleanupMode !== 'efficiency'}
              />
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
