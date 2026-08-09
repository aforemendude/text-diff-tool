import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from './test/reactElements';
import type { DiffCleanupMode, DiffResult } from './types/diff';
import App from './App';

const reactMocks = vi.hoisted(() => ({ useState: vi.fn() }));
const diffMocks = vi.hoisted(() => ({ computeDiff: vi.fn() }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: reactMocks.useState,
}));

vi.mock('./utils/diffUtils', () => ({ computeDiff: diffMocks.computeDiff }));

vi.mock('./components', () => ({
  Header: 'mock-header',
  TextAreas: 'mock-text-areas',
  CompareDisplay: 'mock-compare-display',
  Modal: 'mock-modal',
}));

interface AppState {
  originalText: string;
  modifiedText: string;
  diffResult: DiffResult | null;
  isCompareMode: boolean;
  isJsonMode: boolean;
  diffCleanupMode: DiffCleanupMode;
  editCost: number;
  modalState: {
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'error' | 'info';
  };
}

const diffResult: DiffResult = {
  originalLines: [{ lineNumber: 1, type: 'delete', content: 'before' }],
  modifiedLines: [{ lineNumber: 1, type: 'insert', content: 'after' }],
  originalTrailingNewline: false,
  modifiedTrailingNewline: false,
};

function renderApp(overrides: Partial<AppState> = {}) {
  const state: AppState = {
    originalText: '',
    modifiedText: '',
    diffResult: null,
    isCompareMode: false,
    isJsonMode: false,
    diffCleanupMode: 'semantic',
    editCost: 4,
    modalState: { isOpen: false, title: '', message: '', variant: 'error' },
    ...overrides,
  };
  const values = [
    state.originalText,
    state.modifiedText,
    state.diffResult,
    state.isCompareMode,
    state.isJsonMode,
    state.diffCleanupMode,
    state.editCost,
    state.modalState,
  ];
  const setters = values.map(() => vi.fn());
  let index = 0;
  reactMocks.useState.mockImplementation(() => [values[index], setters[index++]]);

  return { tree: App(), setters };
}

describe('App', () => {
  beforeEach(() => {
    reactMocks.useState.mockReset();
    diffMocks.computeDiff.mockReset();
  });

  it('renders the edit view and forwards each state owner to the matching child prop', () => {
    const { tree, setters } = renderApp({ originalText: 'original', modifiedText: 'modified', isJsonMode: true });
    const header = findElement(tree, (element) => element.type === 'mock-header');
    const textAreas = findElement(tree, (element) => element.type === 'mock-text-areas');

    expect(tree.props.className).toBe('app');
    expect(header.props).toMatchObject({
      isCompareMode: false,
      isJsonMode: true,
      onJsonModeChange: setters[4],
      diffCleanupMode: 'semantic',
      onDiffCleanupModeChange: setters[5],
      editCost: 4,
      onEditCostChange: setters[6],
    });
    expect(textAreas.props).toMatchObject({
      originalText: 'original',
      modifiedText: 'modified',
      onOriginalChange: setters[0],
      onModifiedChange: setters[1],
    });
    expect(findElements(tree, (element) => element.type === 'mock-compare-display')).toEqual([]);
    expect(findElements(tree, (element) => element.type === 'mock-modal')).toEqual([]);
  });

  it('stores a successful diff and enters compare mode', () => {
    diffMocks.computeDiff.mockReturnValue({ status: 'success', diffResult });
    const { tree, setters } = renderApp({
      originalText: 'before',
      modifiedText: 'after',
      isJsonMode: true,
      diffCleanupMode: 'efficiency',
      editCost: 8,
    });
    const header = findElement(tree, (element) => element.type === 'mock-header');

    (header.props.onToggleMode as () => void)();

    expect(diffMocks.computeDiff).toHaveBeenCalledExactlyOnceWith('before', 'after', {
      isJsonMode: true,
      diffCleanupMode: 'efficiency',
      editCost: 8,
    });
    expect(setters[2]).toHaveBeenCalledExactlyOnceWith(diffResult);
    expect(setters[3]).toHaveBeenCalledExactlyOnceWith(true);
    expect(setters[7]).not.toHaveBeenCalled();
  });

  it('opens the exact informational modal and stays in edit mode for identical content', () => {
    diffMocks.computeDiff.mockReturnValue({ status: 'identical' });
    const { tree, setters } = renderApp({ originalText: 'same', modifiedText: 'same' });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();

    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: 'Identical Content',
      message: 'The original and modified content are exactly the same. There are no differences to display.',
      variant: 'info',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it.each([
    ['original' as const, 'Original'],
    ['modified' as const, 'Modified'],
  ])('opens an exact parse-error modal for the %s input', (source, sourceLabel) => {
    diffMocks.computeDiff.mockReturnValue({ status: 'error', source, message: 'invalid JSON' });
    const { tree, setters } = renderApp({ isJsonMode: true });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();

    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: `JSON Parse Error - ${sourceLabel} Text`,
      message: `Failed to parse the ${source} text as JSON:\n\ninvalid JSON`,
      variant: 'error',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('renders the current diff and clears it when returning to edit mode', () => {
    const { tree, setters } = renderApp({ diffResult, isCompareMode: true });
    const header = findElement(tree, (element) => element.type === 'mock-header');

    expect(findElement(tree, (element) => element.type === 'mock-compare-display').props.diffResult).toBe(diffResult);
    expect(findElements(tree, (element) => element.type === 'mock-text-areas')).toEqual([]);

    (header.props.onToggleMode as () => void)();
    expect(diffMocks.computeDiff).not.toHaveBeenCalled();
    expect(setters[2]).toHaveBeenCalledExactlyOnceWith(null);
    expect(setters[3]).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('resets every modal field when the rendered modal closes', () => {
    const { tree, setters } = renderApp({
      modalState: { isOpen: true, title: 'Notice', message: 'Details', variant: 'info' },
    });
    const modal = findElement(tree, (element) => element.type === 'mock-modal');

    expect(modal.props).toMatchObject({ title: 'Notice', message: 'Details', variant: 'info' });
    (modal.props.onClose as () => void)();
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: false,
      title: '',
      message: '',
      variant: 'error',
    });
  });
});
