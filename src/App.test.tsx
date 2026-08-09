import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from './test/reactElements';
import type { DiffCleanupMode, DiffResult } from './types/diff';
import type { ComputeDiffOutcome, JsonWarning } from './utils/diffUtils';
import type { DiffProcess } from './workers/diffWorkerClient';
import App from './App';

const reactMocks = vi.hoisted(() => ({ useEffect: vi.fn(), useRef: vi.fn(), useState: vi.fn() }));
const workerMocks = vi.hoisted(() => ({ startDiffProcess: vi.fn() }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: reactMocks.useEffect,
  useRef: reactMocks.useRef,
  useState: reactMocks.useState,
}));

vi.mock('./workers/diffWorkerClient', () => ({ startDiffProcess: workerMocks.startDiffProcess }));

vi.mock('./components', () => ({
  Header: 'mock-header',
  TextAreas: 'mock-text-areas',
  CompareDisplay: 'mock-compare-display',
  Modal: 'mock-modal',
  ProcessingModal: 'mock-processing-modal',
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
    variant: 'error' | 'info' | 'warning';
  };
  pendingOutcome: Exclude<ComputeDiffOutcome, { status: 'error' }> | null;
  isProcessing: boolean;
  activeProcess: DiffProcess | null;
}

const diffResult: DiffResult = {
  originalLines: [{ lineNumber: 1, type: 'delete', content: 'before' }],
  modifiedLines: [{ lineNumber: 1, type: 'insert', content: 'after' }],
  originalTrailingNewline: false,
  modifiedTrailingNewline: false,
};

interface DeferredProcess {
  process: DiffProcess;
  resolve: (outcome: ComputeDiffOutcome) => void;
  reject: (error: unknown) => void;
}

function createDeferredProcess(): DeferredProcess {
  let resolve: (outcome: ComputeDiffOutcome) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const outcome = new Promise<ComputeDiffOutcome>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    process: { outcome, terminate: vi.fn() },
    resolve,
    reject,
  };
}

function renderApp(overrides: Partial<AppState> = {}, existingProcessRef?: { current: DiffProcess | null }) {
  const state: AppState = {
    originalText: '',
    modifiedText: '',
    diffResult: null,
    isCompareMode: false,
    isJsonMode: false,
    diffCleanupMode: 'semantic',
    editCost: 4,
    modalState: { isOpen: false, title: '', message: '', variant: 'error' },
    pendingOutcome: null,
    isProcessing: false,
    activeProcess: null,
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
    state.pendingOutcome,
    state.isProcessing,
  ];
  const setters = values.map(() => vi.fn());
  let index = 0;
  reactMocks.useState.mockImplementation(() => [values[index], setters[index++]]);
  const processRef = existingProcessRef ?? { current: state.activeProcess };
  reactMocks.useRef.mockReturnValue(processRef);
  let effectCleanup: (() => void) | undefined;
  reactMocks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
    effectCleanup = effect() ?? undefined;
  });

  return { tree: App(), setters, processRef, getEffectCleanup: () => effectCleanup };
}

describe('App', () => {
  beforeEach(() => {
    reactMocks.useEffect.mockReset();
    reactMocks.useRef.mockReset();
    reactMocks.useState.mockReset();
    workerMocks.startDiffProcess.mockReset();
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
    expect(findElements(tree, (element) => element.type === 'mock-processing-modal')).toEqual([]);
  });

  it('runs the diff in a worker, then stores a successful result and enters compare mode', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({
      originalText: 'before',
      modifiedText: 'after',
      isJsonMode: true,
      diffCleanupMode: 'efficiency',
      editCost: 8,
    });
    const header = findElement(tree, (element) => element.type === 'mock-header');

    (header.props.onToggleMode as () => void)();

    expect(workerMocks.startDiffProcess).toHaveBeenCalledExactlyOnceWith('before', 'after', {
      isJsonMode: true,
      diffCleanupMode: 'efficiency',
      editCost: 8,
    });
    expect(setters[9]).toHaveBeenCalledExactlyOnceWith(true);
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();

    deferred.resolve({ status: 'success', diffResult });
    await deferred.process.outcome;

    expect(setters[9]).toHaveBeenLastCalledWith(false);
    expect(setters[2]).toHaveBeenCalledExactlyOnceWith(diffResult);
    expect(setters[3]).toHaveBeenCalledExactlyOnceWith(true);
    expect(setters[7]).not.toHaveBeenCalled();
  });

  it('opens the exact informational modal and stays in edit mode for identical content', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({ originalText: 'same', modifiedText: 'same' });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    deferred.resolve({ status: 'identical' });
    await deferred.process.outcome;

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
  ])('opens an exact parse-error modal for the %s input', async (source, sourceLabel) => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({ isJsonMode: true });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    deferred.resolve({ status: 'error', source, message: 'invalid JSON' });
    await deferred.process.outcome;

    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: `JSON Parse Error - ${sourceLabel} Text`,
      message: `Failed to parse the ${source} text as JSON:\n\ninvalid JSON`,
      variant: 'error',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('opens one counted warning containing all detected categories and defers a successful diff', async () => {
    const warnings: JsonWarning[] = [
      { source: 'original', type: 'numeric-precision', count: 2 },
      { source: 'modified', type: 'numeric-precision', count: 3 },
      { source: 'original', type: 'duplicate-keys', count: 1 },
      { source: 'modified', type: 'duplicate-keys', count: 4 },
    ];
    const outcome = { status: 'success' as const, diffResult, warnings };
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({ isJsonMode: true });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    deferred.resolve(outcome);
    await deferred.process.outcome;

    expect(setters[8]).toHaveBeenCalledExactlyOnceWith(outcome);
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: 'JSON Parse Warning - 10 Issues',
      message: [
        'Both texts contain valid JSON, but parsing them may change some of their contents.',
        '',
        'Original Text',
        '',
        '• 2 numbers may change — the parsed value may be rounded or converted to null.',
        '• 1 duplicate key — only the last value for that key will be kept.',
        '',
        'Modified Text',
        '',
        '• 3 numbers may change — the parsed value may be rounded or converted to null.',
        '• 4 duplicate keys — only the last value for that key will be kept.',
        '',
        'Close this warning to continue the comparison with the parsed values.',
      ].join('\n'),
      variant: 'warning',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('continues a pending successful diff when the warning modal closes', () => {
    const pendingOutcome = { status: 'success' as const, diffResult };
    const { tree, setters } = renderApp({
      modalState: { isOpen: true, title: 'JSON Parse Warning - 1 Issue', message: 'Warning', variant: 'warning' },
      pendingOutcome,
    });
    const modal = findElement(tree, (element) => element.type === 'mock-modal');

    expect(modal.props.actionLabel).toBe('Continue');
    (modal.props.onClose as () => void)();

    expect(setters[8]).toHaveBeenCalledExactlyOnceWith(null);
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: false,
      title: '',
      message: '',
      variant: 'error',
    });
    expect(setters[2]).toHaveBeenCalledExactlyOnceWith(diffResult);
    expect(setters[3]).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('continues a pending identical result into the existing informational modal', () => {
    const { tree, setters } = renderApp({
      modalState: { isOpen: true, title: 'JSON Parse Warning - 1 Issue', message: 'Warning', variant: 'warning' },
      pendingOutcome: { status: 'identical' },
    });

    (findElement(tree, (element) => element.type === 'mock-modal').props.onClose as () => void)();

    expect(setters[8]).toHaveBeenCalledExactlyOnceWith(null);
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: 'Identical Content',
      message: 'The original and modified content are exactly the same. There are no differences to display.',
      variant: 'info',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('renders only the processing modal while a diff is running and terminates from its sole action', () => {
    const deferred = createDeferredProcess();
    const { tree, setters, processRef } = renderApp({
      isProcessing: true,
      activeProcess: deferred.process,
      modalState: { isOpen: true, title: 'Old modal', message: 'Hidden', variant: 'info' },
    });

    const processingModal = findElement(tree, (element) => element.type === 'mock-processing-modal');
    expect(findElements(tree, (element) => element.type === 'mock-modal')).toEqual([]);

    (processingModal.props.onTerminate as () => void)();

    expect(deferred.process.terminate).toHaveBeenCalledOnce();
    expect(processRef.current).toBeNull();
    expect(setters[9]).toHaveBeenCalledExactlyOnceWith(false);
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('ignores a terminated process if it later resolves', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const initialRender = renderApp({ originalText: 'before', modifiedText: 'after' });

    (findElement(initialRender.tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();

    const processingRender = renderApp({ isProcessing: true }, initialRender.processRef);
    (
      findElement(processingRender.tree, (element) => element.type === 'mock-processing-modal').props
        .onTerminate as () => void
    )();
    initialRender.setters.forEach((setter) => setter.mockClear());

    deferred.resolve({ status: 'success', diffResult });
    await deferred.process.outcome;

    expect(initialRender.setters.every((setter) => setter.mock.calls.length === 0)).toBe(true);
  });

  it('terminates an active process on unmount and ignores its eventual outcome', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const rendered = renderApp({ originalText: 'before', modifiedText: 'after' });

    (findElement(rendered.tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    rendered.getEffectCleanup()?.();

    expect(deferred.process.terminate).toHaveBeenCalledOnce();
    expect(rendered.processRef.current).toBeNull();
    rendered.setters.forEach((setter) => setter.mockClear());

    deferred.resolve({ status: 'success', diffResult });
    await deferred.process.outcome;

    expect(rendered.setters.every((setter) => setter.mock.calls.length === 0)).toBe(true);
  });

  it('returns to editing with an error modal when the worker fails', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({ originalText: 'before', modifiedText: 'after' });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    deferred.reject(new Error('worker crashed'));
    await deferred.process.outcome.catch(() => undefined);

    expect(setters[9]).toHaveBeenLastCalledWith(false);
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: 'Diff Processing Error',
      message: 'Failed to compare the texts:\n\nworker crashed',
      variant: 'error',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('does not start another process while one is already running', () => {
    const { tree, setters } = renderApp({ isProcessing: true });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();

    expect(workerMocks.startDiffProcess).not.toHaveBeenCalled();
    expect(setters.every((setter) => setter.mock.calls.length === 0)).toBe(true);
  });

  it('renders the current diff and clears it when returning to edit mode', () => {
    const { tree, setters } = renderApp({ diffResult, isCompareMode: true });
    const header = findElement(tree, (element) => element.type === 'mock-header');

    expect(findElement(tree, (element) => element.type === 'mock-compare-display').props.diffResult).toBe(diffResult);
    expect(findElements(tree, (element) => element.type === 'mock-text-areas')).toEqual([]);

    (header.props.onToggleMode as () => void)();
    expect(workerMocks.startDiffProcess).not.toHaveBeenCalled();
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
