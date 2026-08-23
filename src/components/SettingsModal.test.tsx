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
      onClose,
    });
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
    expect(radios.some((radio) => radio.props.value === 'sparse')).toBe(false);
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
    const change = input.props.onChange as (event: { target: { value: string } }) => void;

    expect(input.props).toMatchObject({
      type: 'number',
      className: 'settings-modal__input',
      min: '0',
      step: 'any',
      value: 4,
      disabled: false,
    });

    for (const value of ['0', '2.5', '', '-1', 'invalid']) {
      change({ target: { value } });
    }

    expect(onEditCostChange.mock.calls).toEqual([[0], [2.5], [4], [4], [4]]);
  });
});
