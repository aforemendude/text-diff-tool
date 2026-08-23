import React from 'react';
import type { DiffAlgorithm, DiffCleanupMode, DiffMode } from '../types/diff';
import Modal from './Modal';
import './SettingsModal.css';

interface SettingsModalProps {
  onClose: () => void;
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
  diffAlgorithm: DiffAlgorithm;
  onDiffAlgorithmChange: (algorithm: DiffAlgorithm) => void;
  diffCleanupMode: DiffCleanupMode;
  onDiffCleanupModeChange: (mode: DiffCleanupMode) => void;
  editCost: number;
  onEditCostChange: (cost: number) => void;
}

interface SettingOption<Value extends string> {
  value: Value;
  label: string;
  description: string;
  isDefault?: boolean;
}

const diffModes: SettingOption<DiffMode>[] = [
  {
    value: 'line-grapheme',
    label: 'Line then grapheme',
    description: 'Align lines first, then compare graphemes inside each changed line.',
    isDefault: true,
  },
  {
    value: 'grapheme',
    label: 'Just grapheme',
    description: 'Compare the entire content at once while keeping line numbers visible.',
  },
];

const algorithms: SettingOption<DiffAlgorithm>[] = [
  {
    value: 'myers',
    label: 'Myers',
    description: 'A predictable shortest-edit diff for general use.',
    isDefault: true,
  },
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Automatically chooses the best exact strategy for the input.',
  },
];

const cleanupModes: SettingOption<DiffCleanupMode>[] = [
  {
    value: 'none',
    label: 'No Cleanup',
    description: 'Keep the algorithm’s raw result without post-processing.',
    isDefault: true,
  },
  {
    value: 'semantic',
    label: 'Semantic Cleanup',
    description: 'Shift and merge edits into boundaries that are easier to read.',
  },
  {
    value: 'efficiency',
    label: 'Efficiency Cleanup',
    description: 'Merge small equalities to produce fewer, larger edits.',
  },
];

function renderOption<Value extends string>(
  option: SettingOption<Value>,
  groupName: string,
  selectedValue: Value,
  onChange: (value: Value) => void,
) {
  const isSelected = selectedValue === option.value;

  return (
    <label
      key={option.value}
      className={isSelected ? 'settings-modal__option settings-modal__option--selected' : 'settings-modal__option'}
    >
      <input
        type="radio"
        name={groupName}
        value={option.value}
        checked={isSelected}
        onChange={() => onChange(option.value)}
      />
      <span className="settings-modal__option-content">
        <span className="settings-modal__option-heading">
          <span className="settings-modal__option-label">{option.label}</span>
          {option.isDefault && <span className="settings-modal__default-badge">Default</span>}
        </span>
        <span className="settings-modal__option-description">{option.description}</span>
      </span>
      <span className="settings-modal__option-indicator" aria-hidden="true">
        <span className="settings-modal__option-indicator-dot" />
      </span>
    </label>
  );
}

function SettingsModal({
  onClose,
  diffMode,
  onDiffModeChange,
  diffAlgorithm,
  onDiffAlgorithmChange,
  diffCleanupMode,
  onDiffCleanupModeChange,
  editCost,
  onEditCostChange,
}: SettingsModalProps) {
  const handleEditCostChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(event.target.value);
    if (Number.isFinite(value) && value >= 0) {
      onEditCostChange(value);
    } else {
      onEditCostChange(editCost);
    }
  };

  return (
    <Modal
      title="Diff settings"
      onClose={onClose}
      variant="info"
      className="settings-modal"
      bodyClassName="settings-modal__body"
      actionLabel="Done"
    >
      <p className="settings-modal__intro">Choose how the next comparison is calculated.</p>

      <fieldset className="settings-modal__section">
        <legend className="settings-modal__section-title">Diff mode</legend>
        <p className="settings-modal__section-description">Set the level used to find matching content.</p>
        <div className="settings-modal__options settings-modal__options--two-column">
          {diffModes.map((mode) => renderOption(mode, 'diffMode', diffMode, onDiffModeChange))}
        </div>
      </fieldset>

      <fieldset className="settings-modal__section">
        <legend className="settings-modal__section-title">Algorithm</legend>
        <p className="settings-modal__section-description">Choose the exact diff strategy.</p>
        <div className="settings-modal__options settings-modal__options--two-column">
          {algorithms.map((algorithm) =>
            renderOption(algorithm, 'diffAlgorithm', diffAlgorithm, onDiffAlgorithmChange),
          )}
        </div>
      </fieldset>

      <fieldset className="settings-modal__section">
        <legend className="settings-modal__section-title">Cleanup</legend>
        <p className="settings-modal__section-description">Optionally refine the raw grapheme changes.</p>
        <div className="settings-modal__options settings-modal__options--cleanup">
          {cleanupModes.map((mode) => renderOption(mode, 'diffCleanupMode', diffCleanupMode, onDiffCleanupModeChange))}
        </div>

        <label
          className={
            diffCleanupMode === 'efficiency'
              ? 'settings-modal__edit-cost'
              : 'settings-modal__edit-cost settings-modal__edit-cost--disabled'
          }
        >
          <span className="settings-modal__edit-cost-copy">
            <span className="settings-modal__edit-cost-label">Edit cost</span>
            <span className="settings-modal__edit-cost-description">Merge equalities shorter than this cost.</span>
          </span>
          <input
            type="number"
            id="edit-cost"
            className="settings-modal__input"
            min="0"
            step="any"
            value={editCost}
            onChange={handleEditCostChange}
            disabled={diffCleanupMode !== 'efficiency'}
          />
        </label>
      </fieldset>
    </Modal>
  );
}

export default SettingsModal;
