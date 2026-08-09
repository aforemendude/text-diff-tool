import { describe, expect, it, vi } from 'vitest';
import type { ComputeDiffOptions, ComputeDiffOutcome } from '../utils/diffUtils';
import type { DiffWorkerResponse } from './diffWorkerProtocol';
import { DiffProcessTerminatedError, startDiffProcess } from './diffWorkerClient';

const options: ComputeDiffOptions = {
  isJsonMode: true,
  diffCleanupMode: 'efficiency',
  editCost: 7,
};

function createWorkerHarness() {
  const postMessage = vi.fn();
  const terminate = vi.fn();
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage,
    terminate,
  } as unknown as Worker;
  const factory = vi.fn(() => worker);

  return { factory, postMessage, terminate, worker };
}

function sendResponse(worker: Worker, response: DiffWorkerResponse): void {
  const onmessage = worker.onmessage;
  expect(onmessage).not.toBeNull();
  onmessage?.call(worker, { data: response } as MessageEvent<DiffWorkerResponse>);
}

function sendWorkerError(worker: Worker, message: string) {
  const onerror = worker.onerror;
  const preventDefault = vi.fn();
  expect(onerror).not.toBeNull();
  onerror?.call(worker, { message, preventDefault } as unknown as ErrorEvent);

  return { preventDefault };
}

function expectWorkerStopped(worker: Worker, terminate: ReturnType<typeof vi.fn>): void {
  expect(worker.onmessage).toBeNull();
  expect(worker.onerror).toBeNull();
  expect(terminate).toHaveBeenCalledOnce();
}

describe('startDiffProcess', () => {
  it('constructs one worker and sends the complete diff request', async () => {
    const { factory, postMessage, terminate, worker } = createWorkerHarness();
    const process = startDiffProcess('before text', 'after text', options, factory);

    expect(factory).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'compute-diff',
      originalText: 'before text',
      modifiedText: 'after text',
      options,
    });

    sendResponse(worker, { type: 'diff-complete', outcome: { status: 'identical' } });
    await expect(process.outcome).resolves.toEqual({ status: 'identical' });
    expectWorkerStopped(worker, terminate);
  });

  it('resolves a successful result and ignores termination and late messages after settling', async () => {
    const { factory, terminate, worker } = createWorkerHarness();
    const process = startDiffProcess('old', 'new', options, factory);
    const staleOnMessage = worker.onmessage;
    const outcome: ComputeDiffOutcome = {
      status: 'success',
      diffResult: {
        originalLines: [{ lineNumber: 1, type: 'delete', content: 'old' }],
        modifiedLines: [{ lineNumber: 1, type: 'insert', content: 'new' }],
        originalTrailingNewline: false,
        modifiedTrailingNewline: false,
      },
    };

    sendResponse(worker, { type: 'diff-complete', outcome });

    await expect(process.outcome).resolves.toBe(outcome);
    expectWorkerStopped(worker, terminate);

    process.terminate();
    staleOnMessage?.call(worker, {
      data: { type: 'diff-error', message: 'too late' },
    } as MessageEvent<DiffWorkerResponse>);
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('rejects a protocol-reported diff error and cleans up the worker', async () => {
    const { factory, terminate, worker } = createWorkerHarness();
    const process = startDiffProcess('old', 'new', options, factory);

    sendResponse(worker, { type: 'diff-error', message: 'Diff computation failed' });

    await expect(process.outcome).rejects.toThrow('Diff computation failed');
    expectWorkerStopped(worker, terminate);
  });

  it('rejects an invalid worker response and cleans up the worker', async () => {
    const { factory, terminate, worker } = createWorkerHarness();
    const process = startDiffProcess('old', 'new', options, factory);

    sendResponse(worker, { type: 'unexpected-response' } as unknown as DiffWorkerResponse);

    await expect(process.outcome).rejects.toThrow('The diff worker returned an invalid response.');
    expectWorkerStopped(worker, terminate);
  });

  it.each([
    ['uses the runtime error message', 'Worker script crashed', 'Worker script crashed'],
    ['uses a fallback when the runtime error has no message', '', 'The diff worker failed to load.'],
  ])('%s', async (_description, workerMessage, expectedMessage) => {
    const { factory, terminate, worker } = createWorkerHarness();
    const process = startDiffProcess('old', 'new', options, factory);

    const { preventDefault } = sendWorkerError(worker, workerMessage);

    await expect(process.outcome).rejects.toThrow(expectedMessage);
    expect(preventDefault).toHaveBeenCalledOnce();
    expectWorkerStopped(worker, terminate);
  });

  it('rejects with the original error when posting the request throws', async () => {
    const { factory, postMessage, terminate, worker } = createWorkerHarness();
    const postError = new DOMException('The value could not be cloned.', 'DataCloneError');
    postMessage.mockImplementationOnce(() => {
      throw postError;
    });

    const process = startDiffProcess('old', 'new', options, factory);

    await expect(process.outcome).rejects.toBe(postError);
    expectWorkerStopped(worker, terminate);
  });

  it('terminates an active process exactly once, rejects with the cancellation error, and ignores late events', async () => {
    const { factory, terminate, worker } = createWorkerHarness();
    const process = startDiffProcess('old', 'new', options, factory);
    const staleOnMessage = worker.onmessage;
    const staleOnError = worker.onerror;
    const outcome = expect(process.outcome).rejects.toMatchObject({
      name: 'DiffProcessTerminatedError',
      message: 'The diff process was terminated.',
    });

    process.terminate();
    process.terminate();

    await outcome;
    await expect(process.outcome).rejects.toBeInstanceOf(DiffProcessTerminatedError);
    expectWorkerStopped(worker, terminate);

    staleOnMessage?.call(worker, {
      data: { type: 'diff-complete', outcome: { status: 'identical' } },
    } as MessageEvent<DiffWorkerResponse>);
    staleOnError?.call(worker, {
      message: 'late worker error',
      preventDefault: vi.fn(),
    } as unknown as ErrorEvent);
    process.terminate();
    expect(terminate).toHaveBeenCalledOnce();
  });
});
