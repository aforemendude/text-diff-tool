import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findElement } from '../test/reactElements';
import AboutModal from './AboutModal';
import Header from './Header';
import SettingsModal from './SettingsModal';

const reactMocks = vi.hoisted(() => ({ useState: vi.fn() }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: reactMocks.useState,
}));

function configureLocalState(showAbout = false, showSettings = false) {
  const setters = [vi.fn(), vi.fn()];
  const values = [showAbout, showSettings];
  let index = 0;
  reactMocks.useState.mockImplementation(() => [values[index], setters[index++]]);
  return setters;
}

function defaultProps() {
  return {
    isCompareMode: false,
    onToggleMode: vi.fn(),
    isJsonMode: false,
    onJsonModeChange: vi.fn(),
    diffCleanupMode: 'semantic' as const,
    onDiffCleanupModeChange: vi.fn(),
    editCost: 4,
    onEditCostChange: vi.fn(),
  };
}

describe('Header', () => {
  beforeEach(() => {
    reactMocks.useState.mockReset();
  });

  it('renders and wires the editable controls with exact values', () => {
    const [setShowAbout, setShowSettings] = configureLocalState();
    const props = { ...defaultProps(), isJsonMode: true };
    const tree = Header(props);
    const compare = findElement(tree, (element) => element.props.id === 'compare-btn');
    const settings = findElement(tree, (element) => element.props.id === 'settings-btn');
    const about = findElement(tree, (element) => element.props['aria-label'] === 'About');
    const checkbox = findElement(tree, (element) => element.type === 'input' && element.props.type === 'checkbox');

    expect(compare.props).toMatchObject({ className: 'btn btn-primary', children: 'Compare' });
    expect(settings.props).toMatchObject({ className: 'btn btn-secondary', disabled: false });
    expect(about.props.className).toBe('header__about-button');
    expect(checkbox.props).toMatchObject({ checked: true, disabled: false });

    (compare.props.onClick as () => void)();
    (settings.props.onClick as () => void)();
    (about.props.onClick as () => void)();
    (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });

    expect(props.onToggleMode).toHaveBeenCalledOnce();
    expect(setShowSettings).toHaveBeenCalledExactlyOnceWith(true);
    expect(setShowAbout).toHaveBeenCalledExactlyOnceWith(true);
    expect(props.onJsonModeChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('switches labels and disables mode-specific controls while comparing', () => {
    configureLocalState();
    const tree = Header({ ...defaultProps(), isCompareMode: true });

    expect(findElement(tree, (element) => element.props.id === 'compare-btn').props.children).toBe('Edit');
    expect(findElement(tree, (element) => element.props.id === 'settings-btn').props.disabled).toBe(true);
    expect(
      findElement(tree, (element) => element.type === 'input' && element.props.type === 'checkbox').props.disabled,
    ).toBe(true);
  });

  it('renders both owned modal variants and wires their close contracts', () => {
    const [setShowAbout, setShowSettings] = configureLocalState(true, true);
    const props = defaultProps();
    const tree = Header(props);
    const about = findElement(tree, (element) => element.type === AboutModal);
    const settings = findElement(tree, (element) => element.type === SettingsModal);

    expect(settings.props).toMatchObject({
      diffCleanupMode: 'semantic',
      onDiffCleanupModeChange: props.onDiffCleanupModeChange,
      editCost: 4,
      onEditCostChange: props.onEditCostChange,
    });

    (about.props.onClose as () => void)();
    (settings.props.onClose as () => void)();
    expect(setShowAbout).toHaveBeenCalledExactlyOnceWith(false);
    expect(setShowSettings).toHaveBeenCalledExactlyOnceWith(false);
  });
});
