import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findElement, findElements } from './test/reactElements';
import type { ComputeDiffOutcome } from './diff/compute';
import type { DiffAlgorithm, DiffCleanupMode, DiffMode, DiffResult } from './diff/types';
import type { DiffProcess } from './diff/workerClient';
import type { DiffSettings } from './settings';
import App from './App';

const reactMocks = vi.hoisted(() => ({ useEffect: vi.fn(), useRef: vi.fn(), useState: vi.fn() }));
const workerMocks = vi.hoisted(() => ({ initializeDiffWorker: vi.fn(), startDiffProcess: vi.fn() }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: reactMocks.useEffect,
  useRef: reactMocks.useRef,
  useState: reactMocks.useState,
}));

vi.mock('./diff/workerClient', () => ({
  initializeDiffWorker: workerMocks.initializeDiffWorker,
  startDiffProcess: workerMocks.startDiffProcess,
}));

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
  diffMode: DiffMode;
  diffAlgorithm: DiffAlgorithm;
  diffCleanupMode: DiffCleanupMode;
  editCost: number;
  showTextDecorations: boolean;
  modalState: {
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'error' | 'info';
  };
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

function expectNoStateUpdates(setters: ReturnType<typeof vi.fn>[]): void {
  for (const setter of setters) {
    expect(setter).not.toHaveBeenCalled();
  }
}

function renderApp(overrides: Partial<AppState> = {}, existingProcessRef?: { current: DiffProcess | null }) {
  const state: AppState = {
    originalText: '',
    modifiedText: '',
    diffResult: null,
    isCompareMode: false,
    isJsonMode: false,
    diffMode: 'line-grapheme',
    diffAlgorithm: 'myers',
    diffCleanupMode: 'none',
    editCost: 4,
    showTextDecorations: true,
    modalState: { isOpen: false, title: '', message: '', variant: 'error' },
    isProcessing: false,
    activeProcess: null,
    ...overrides,
  };
  const diffSettings: DiffSettings = {
    diffMode: state.diffMode,
    diffAlgorithm: state.diffAlgorithm,
    diffCleanupMode: state.diffCleanupMode,
    editCost: state.editCost,
    showTextDecorations: state.showTextDecorations,
  };
  const values = [
    state.originalText,
    state.modifiedText,
    state.diffResult,
    state.isCompareMode,
    state.isJsonMode,
    diffSettings,
    state.modalState,
    state.isProcessing,
  ];
  const setters = values.map(() => vi.fn());
  let index = 0;
  reactMocks.useState.mockImplementation(() => [values[index], setters[index++]]);
  const processRef = existingProcessRef ?? { current: state.activeProcess };
  reactMocks.useRef.mockReturnValue(processRef);
  let effectCleanup: (() => void) | undefined;
  reactMocks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
    const cleanup = effect() ?? undefined;
    if (cleanup !== undefined) {
      effectCleanup = cleanup;
    }
  });

  return { tree: App(), setters, processRef, getEffectCleanup: () => effectCleanup };
}

describe('App', () => {
  beforeEach(() => {
    reactMocks.useEffect.mockReset();
    reactMocks.useRef.mockReset();
    reactMocks.useState.mockReset();
    workerMocks.initializeDiffWorker.mockReset();
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
      diffMode: 'line-grapheme',
      onDiffModeChange: expect.any(Function),
      diffAlgorithm: 'myers',
      onDiffAlgorithmChange: expect.any(Function),
      diffCleanupMode: 'none',
      onDiffCleanupModeChange: expect.any(Function),
      editCost: 4,
      onEditCostChange: expect.any(Function),
      showTextDecorations: true,
      onShowTextDecorationsChange: expect.any(Function),
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
    expect(workerMocks.initializeDiffWorker).toHaveBeenCalledOnce();

    (header.props['onDiffModeChange'] as (mode: DiffMode) => void)('grapheme');
    (header.props['onDiffAlgorithmChange'] as (algorithm: DiffAlgorithm) => void)('adaptive');
    (header.props['onDiffCleanupModeChange'] as (mode: DiffCleanupMode) => void)('efficiency');
    (header.props['onEditCostChange'] as (cost: number) => void)(7.5);
    (header.props['onShowTextDecorationsChange'] as (enabled: boolean) => void)(false);

    let updatedSettings: DiffSettings = {
      diffMode: 'line-grapheme',
      diffAlgorithm: 'myers',
      diffCleanupMode: 'none',
      editCost: 4,
      showTextDecorations: true,
    };
    const settingsSetter = setters[5];
    if (settingsSetter === undefined) {
      throw new Error('Expected the diff settings state setter');
    }
    for (const call of settingsSetter.mock.calls) {
      const updater = call[0] as ((current: DiffSettings) => DiffSettings) | undefined;
      if (updater === undefined) {
        throw new Error('Expected a diff settings updater');
      }
      updatedSettings = updater(updatedSettings);
    }
    expect(updatedSettings).toEqual({
      diffMode: 'grapheme',
      diffAlgorithm: 'adaptive',
      diffCleanupMode: 'efficiency',
      editCost: 7.5,
      showTextDecorations: false,
    });
  });

  it('keeps the edit view available and retries on comparison when eager worker initialization fails', async () => {
    const deferred = createDeferredProcess();
    workerMocks.initializeDiffWorker.mockImplementationOnce(() => {
      throw new DOMException('Workers are blocked.', 'SecurityError');
    });
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);

    const { tree, setters } = renderApp({ originalText: 'before', modifiedText: 'after' });
    const header = findElement(tree, (element) => element.type === 'mock-header');
    const textAreas = findElement(tree, (element) => element.type === 'mock-text-areas');

    expect(textAreas.props).toMatchObject({ originalText: 'before', modifiedText: 'after' });
    expect(workerMocks.initializeDiffWorker).toHaveBeenCalledOnce();

    (header.props.onToggleMode as () => void)();

    expect(workerMocks.startDiffProcess).toHaveBeenCalledOnce();
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith(true);

    deferred.resolve({ status: 'identical' });
    await deferred.process.outcome;
  });

  it.each<{ stateLabel: string; overrides: Partial<AppState>; expectedStatus: string }>([
    { stateLabel: 'editing', overrides: {}, expectedStatus: '' },
    { stateLabel: 'processing', overrides: { isProcessing: true }, expectedStatus: 'Comparison in progress.' },
    {
      stateLabel: 'comparison',
      overrides: { isCompareMode: true },
      expectedStatus: 'Comparison complete. Results are ready.',
    },
  ])('announces the exact application status while $stateLabel', ({ overrides, expectedStatus }) => {
    const { tree } = renderApp(overrides);
    const status = findElement(tree, (element) => element.props.role === 'status');

    expect(status.props).toMatchObject({
      className: 'visually-hidden',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      children: expectedStatus,
    });
  });

  it('runs the diff in a worker, then stores a successful result and enters compare mode', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({
      originalText: 'before',
      modifiedText: 'after',
      isJsonMode: true,
      diffMode: 'grapheme',
      diffAlgorithm: 'adaptive',
      diffCleanupMode: 'efficiency',
      editCost: 8,
    });
    const header = findElement(tree, (element) => element.type === 'mock-header');

    (header.props.onToggleMode as () => void)();

    expect(workerMocks.startDiffProcess).toHaveBeenCalledExactlyOnceWith('before', 'after', {
      isJsonMode: true,
      diffMode: 'grapheme',
      diffAlgorithm: 'adaptive',
      diffCleanupMode: 'efficiency',
      editCost: 8,
    });
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith(true);
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();

    deferred.resolve({ status: 'success', diffResult });
    await deferred.process.outcome;

    expect(setters[7]).toHaveBeenLastCalledWith(false);
    expect(setters[2]).toHaveBeenCalledExactlyOnceWith(diffResult);
    expect(setters[3]).toHaveBeenCalledExactlyOnceWith(true);
    expect(setters[6]).not.toHaveBeenCalled();
  });

  it('opens the exact informational modal and stays in edit mode for identical content', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({ originalText: 'same', modifiedText: 'same' });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    deferred.resolve({ status: 'identical' });
    await deferred.process.outcome;

    expect(setters[6]).toHaveBeenCalledExactlyOnceWith({
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

    expect(setters[6]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: `JSON Parse Error - ${sourceLabel} Text`,
      message: `Failed to parse the ${source} text as JSON:\n\ninvalid JSON`,
      variant: 'error',
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
    expect(setters[7]).toHaveBeenCalledExactlyOnceWith(false);
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

    expectNoStateUpdates(initialRender.setters);
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

    expectNoStateUpdates(rendered.setters);
  });

  it('returns to editing with an error modal when the worker fails', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({ originalText: 'before', modifiedText: 'after' });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    deferred.reject(new Error('worker crashed'));
    await deferred.process.outcome.catch(() => undefined);

    expect(setters[7]).toHaveBeenLastCalledWith(false);
    expect(setters[6]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: 'Diff Processing Error',
      message: 'Failed to compare the texts:\n\nworker crashed',
      variant: 'error',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('opens the exact processing error without entering the processing state when worker startup throws', () => {
    workerMocks.startDiffProcess.mockImplementation(() => {
      throw new Error('worker unavailable');
    });
    const { tree, setters } = renderApp({ originalText: 'before', modifiedText: 'after' });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();

    expect(setters[6]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: 'Diff Processing Error',
      message: 'Failed to compare the texts:\n\nworker unavailable',
      variant: 'error',
    });
    expect(setters[7]).not.toHaveBeenCalled();
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('uses the stable processing-error fallback when the worker rejects with a non-Error value', async () => {
    const deferred = createDeferredProcess();
    workerMocks.startDiffProcess.mockReturnValue(deferred.process);
    const { tree, setters } = renderApp({ originalText: 'before', modifiedText: 'after' });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();
    deferred.reject('unexpected failure');
    await deferred.process.outcome.catch(() => undefined);

    expect(setters[7]).toHaveBeenLastCalledWith(false);
    expect(setters[6]).toHaveBeenCalledExactlyOnceWith({
      isOpen: true,
      title: 'Diff Processing Error',
      message: 'Failed to compare the texts:\n\nUnknown error',
      variant: 'error',
    });
    expect(setters[2]).not.toHaveBeenCalled();
    expect(setters[3]).not.toHaveBeenCalled();
  });

  it('does not start another process while one is already running', () => {
    const { tree, setters } = renderApp({ isProcessing: true });

    (findElement(tree, (element) => element.type === 'mock-header').props.onToggleMode as () => void)();

    expect(workerMocks.startDiffProcess).not.toHaveBeenCalled();
    expectNoStateUpdates(setters);
  });

  it('renders the current diff and clears it when returning to edit mode', () => {
    const { tree, setters } = renderApp({ diffResult, isCompareMode: true, showTextDecorations: false });
    const header = findElement(tree, (element) => element.type === 'mock-header');
    const compareDisplay = findElement(tree, (element) => element.type === 'mock-compare-display');

    expect(compareDisplay.props).toMatchObject({ diffResult, showTextDecorations: false });
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
    expect(setters[6]).toHaveBeenCalledExactlyOnceWith({
      isOpen: false,
      title: '',
      message: '',
      variant: 'error',
    });
  });
});
