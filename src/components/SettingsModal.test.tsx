import { describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from '../test/reactElements';
import type { DiffCleanupMode } from '../types/diff';
import Modal from './Modal';
import SettingsModal from './SettingsModal';

function renderSettings(diffCleanupMode: DiffCleanupMode, editCost = 4) {
  const onClose = vi.fn();
  const onDiffCleanupModeChange = vi.fn();
  const onEditCostChange = vi.fn();
  const tree = SettingsModal({ onClose, diffCleanupMode, onDiffCleanupModeChange, editCost, onEditCostChange });
  return { tree, onClose, onDiffCleanupModeChange, onEditCostChange };
}

describe('SettingsModal', () => {
  it.each<DiffCleanupMode>(['semantic', 'efficiency', 'none'])(
    'marks only %s as selected and applies the edit-cost availability contract',
    (selectedMode) => {
      const { tree, onClose } = renderSettings(selectedMode, 7.5);
      const radios = findElements(tree, (element) => element.type === 'input' && element.props.type === 'radio');
      const optionLabels = findElements(tree, (element) => element.type === 'label');
      const editCost = findElement(tree, (element) => element.props.id === 'edit-cost');

      expect(tree.type).toBe(Modal);
      expect(tree.props).toMatchObject({
        title: 'Settings',
        variant: 'info',
        className: 'settings-modal',
        bodyClassName: 'settings-modal__body',
        actionLabel: 'Done',
        onClose,
      });
      expect(
        radios.map((radio) => ({ value: radio.props.value, checked: radio.props.checked, name: radio.props.name })),
      ).toEqual([
        { value: 'semantic', checked: selectedMode === 'semantic', name: 'diffCleanupMode' },
        { value: 'efficiency', checked: selectedMode === 'efficiency', name: 'diffCleanupMode' },
        { value: 'none', checked: selectedMode === 'none', name: 'diffCleanupMode' },
      ]);
      expect(optionLabels.map((label) => label.props.className)).toEqual(
        ['semantic', 'efficiency', 'none'].map((mode) =>
          mode === selectedMode ? 'settings-modal__option settings-modal__option--selected' : 'settings-modal__option',
        ),
      );
      expect(
        optionLabels.map((label) =>
          findElements(label.props.children, (element) => element.type === 'polyline').map(
            (element) => element.props.points,
          ),
        ),
      ).toEqual(['semantic', 'efficiency', 'none'].map((mode) => (mode === selectedMode ? ['20 6 9 17 4 12'] : [])));
      expect(editCost.props).toMatchObject({
        type: 'number',
        className: 'settings-modal__input',
        min: '0',
        value: 7.5,
        disabled: selectedMode !== 'efficiency',
      });
    },
  );

  it('reports the exact cleanup mode chosen by each radio', () => {
    const { tree, onDiffCleanupModeChange } = renderSettings('semantic');
    const radios = findElements(tree, (element) => element.type === 'input' && element.props.type === 'radio');

    for (const radio of radios) {
      (radio.props.onChange as () => void)();
    }

    expect(onDiffCleanupModeChange.mock.calls).toEqual([['semantic'], ['efficiency'], ['none']]);
  });

  it('accepts non-negative edit costs and restores the current cost for invalid input', () => {
    const { tree, onEditCostChange } = renderSettings('efficiency', 4);
    const input = findElement(tree, (element) => element.props.id === 'edit-cost');
    const change = input.props.onChange as (event: { target: { value: string } }) => void;

    for (const value of ['0', '2.5', '', '-1', 'invalid']) {
      change({ target: { value } });
    }

    expect(onEditCostChange.mock.calls).toEqual([[0], [2.5], [4], [4], [4]]);
  });
});
