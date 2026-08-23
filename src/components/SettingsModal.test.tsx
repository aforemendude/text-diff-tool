import { describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from '../test/reactElements';
import type { DiffAlgorithm, DiffCleanupMode, DiffMode } from '../diff/types';
import Modal from './Modal';
import SettingsModal from './SettingsModal';

interface SettingsSelection {
  diffMode: DiffMode;
  diffAlgorithm: DiffAlgorithm;
  diffCleanupMode: DiffCleanupMode;
}

const defaultSelection: SettingsSelection = {
  diffMode: 'line-grapheme',
  diffAlgorithm: 'myers',
  diffCleanupMode: 'none',
};

function renderSettings(selection: Partial<SettingsSelection> = {}, editCost = 4) {
  const onClose = vi.fn();
  const onDiffModeChange = vi.fn();
  const onDiffAlgorithmChange = vi.fn();
  const onDiffCleanupModeChange = vi.fn();
  const onEditCostChange = vi.fn();
  const selected = { ...defaultSelection, ...selection };
  const tree = SettingsModal({
    onClose,
    ...selected,
    onDiffModeChange,
    onDiffAlgorithmChange,
    onDiffCleanupModeChange,
    editCost,
    onEditCostChange,
  });
  return {
    tree,
    onClose,
    onDiffModeChange,
    onDiffAlgorithmChange,
    onDiffCleanupModeChange,
    onEditCostChange,
  };
}

describe('SettingsModal', () => {
  it('renders compact setting groups with clearly labeled defaults and no Sparse choice', () => {
    const { tree, onClose } = renderSettings();
    const radios = findElements(tree, (element) => element.type === 'input' && element.props.type === 'radio');
    const defaultBadges = findElements(tree, (element) => element.props.className === 'settings-modal__default-badge');

    expect(tree.type).toBe(Modal);
    expect(tree.props).toMatchObject({
      title: 'Diff settings',
      variant: 'info',
      className: 'settings-modal',
      bodyClassName: 'settings-modal__body',
      actionLabel: 'Done',
      ariaDescribedBy: 'settings-modal-intro',
      onClose,
    });
    expect(findElement(tree, (element) => element.props.className === 'settings-modal__intro').props.id).toBe(
      'settings-modal-intro',
    );
    expect(
      findElements(tree, (element) => element.type === 'fieldset').map(
        (fieldset) => fieldset.props['aria-describedby'],
      ),
    ).toEqual(['diff-mode-description', 'algorithm-description', 'cleanup-description']);
    expect(
      findElements(tree, (element) => element.props.className === 'settings-modal__section-description').map(
        (description) => description.props.id,
      ),
    ).toEqual(['diff-mode-description', 'algorithm-description', 'cleanup-description']);
    expect(
      radios.map((radio) => ({
        value: radio.props.value,
        name: radio.props.name,
        checked: radio.props.checked,
      })),
    ).toEqual([
      { value: 'line-grapheme', name: 'diffMode', checked: true },
      { value: 'grapheme', name: 'diffMode', checked: false },
      { value: 'myers', name: 'diffAlgorithm', checked: true },
      { value: 'adaptive', name: 'diffAlgorithm', checked: false },
      { value: 'none', name: 'diffCleanupMode', checked: true },
      { value: 'semantic', name: 'diffCleanupMode', checked: false },
      { value: 'efficiency', name: 'diffCleanupMode', checked: false },
    ]);
    expect(defaultBadges.map((badge) => badge.props.children)).toEqual(['Default', 'Default', 'Default']);
    expect(
      findElements(tree, (element) => element.props.className === 'settings-modal__option-indicator').map(
        (indicator) => indicator.props['aria-hidden'],
      ),
    ).toEqual(['true', 'true', 'true', 'true', 'true', 'true', 'true']);
  });

  it('marks only the current option in each group as selected', () => {
    const { tree } = renderSettings({
      diffMode: 'grapheme',
      diffAlgorithm: 'adaptive',
      diffCleanupMode: 'semantic',
    });
    const radios = findElements(tree, (element) => element.type === 'input' && element.props.type === 'radio');
    const selectedValues = radios.filter((radio) => radio.props.checked).map((radio) => radio.props.value);
    const optionLabels = findElements(
      tree,
      (element) => element.type === 'label' && String(element.props.className).startsWith('settings-modal__option'),
    );

    expect(selectedValues).toEqual(['grapheme', 'adaptive', 'semantic']);
    expect(optionLabels.filter((label) => String(label.props.className).includes('--selected'))).toHaveLength(3);
    expect(findElement(tree, (element) => element.props.id === 'edit-cost').props.disabled).toBe(true);
  });

  it('reports every diff mode, algorithm, and cleanup selection through its matching callback', () => {
    const rendered = renderSettings();
    const radios = findElements(rendered.tree, (element) => element.type === 'input' && element.props.type === 'radio');

    for (const radio of radios) {
      (radio.props.onChange as () => void)();
    }

    expect(rendered.onDiffModeChange.mock.calls).toEqual([['line-grapheme'], ['grapheme']]);
    expect(rendered.onDiffAlgorithmChange.mock.calls).toEqual([['myers'], ['adaptive']]);
    expect(rendered.onDiffCleanupModeChange.mock.calls).toEqual([['none'], ['semantic'], ['efficiency']]);
  });

  it('enables edit cost only for efficiency cleanup and validates non-negative values', () => {
    const { tree, onEditCostChange } = renderSettings({ diffCleanupMode: 'efficiency' }, 4);
    const input = findElement(tree, (element) => element.props.id === 'edit-cost');
    const label = findElement(tree, (element) => element.type === 'label' && element.props.htmlFor === 'edit-cost');
    const description = findElement(tree, (element) => element.props.id === 'edit-cost-description');
    const change = input.props.onChange as (event: { target: { value: string } }) => void;

    expect(label.props).toMatchObject({
      className: 'settings-modal__edit-cost-label',
      children: 'Edit cost',
    });
    expect(description.props.children).toBe('Merge equalities shorter than this cost.');
    expect(input.props).toMatchObject({
      type: 'number',
      className: 'settings-modal__input',
      min: '0',
      step: 'any',
      value: 4,
      'aria-describedby': 'edit-cost-description',
      disabled: false,
    });

    for (const value of ['0', '2.5', '', '-1', 'invalid']) {
      change({ target: { value } });
    }

    expect(onEditCostChange.mock.calls).toEqual([[0], [2.5], [4], [4], [4]]);
  });
});
