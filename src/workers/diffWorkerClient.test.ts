import { describe, expect, it, vi } from 'vitest';
import type { ComputeDiffOptions, ComputeDiffOutcome } from '../utils/diffUtils';
import type { DiffWorkerResponse } from './diffWorkerProtocol';
import { DiffProcessTerminatedError, DiffWorkerClient } from './diffWorkerClient';

const options: ComputeDiffOptions = {
  isJsonMode: true,
  diffCleanupMode: 'efficiency',
  editCost: 7,
};

interface WorkerHarness {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  worker: Worker;
}

function createWorkerFactoryHarness() {
  const workers: WorkerHarness[] = [];
  const factory = vi.fn(() => {
    const postMessage = vi.fn();
    const terminate = vi.fn();
    const worker = {
      onmessage: null,
      onerror: null,
      postMessage,
      terminate,
    } as unknown as Worker;
    workers.push({ postMessage, terminate, worker });
    return worker;
  });

  return { factory, workers };
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

function expectWorkerIdle({ worker, terminate }: WorkerHarness): void {
  expect(worker.onmessage).toBeNull();
  expect(worker.onerror).not.toBeNull();
  expect(terminate).not.toHaveBeenCalled();
}

function expectWorkerStopped({ worker, terminate }: WorkerHarness): void {
  expect(worker.onmessage).toBeNull();
  expect(worker.onerror).toBeNull();
  expect(terminate).toHaveBeenCalledOnce();
}

describe('DiffWorkerClient', () => {
  it('constructs the worker immediately and sends the complete diff request', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);

    expect(factory).toHaveBeenCalledOnce();
    expectWorkerIdle(workers[0]);

    const process = client.startDiffProcess('before text', 'after text', options);

    expect(workers[0].postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'compute-diff',
      originalText: 'before text',
      modifiedText: 'after text',
      options,
    });

    sendResponse(workers[0].worker, { type: 'diff-complete', outcome: { status: 'identical' } });
    await expect(process.outcome).resolves.toEqual({ status: 'identical' });
    expectWorkerIdle(workers[0]);
  });

  it('reuses the same worker for consecutive diff requests', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const firstProcess = client.startDiffProcess('first before', 'first after', options);

    sendResponse(workers[0].worker, { type: 'diff-complete', outcome: { status: 'identical' } });
    await firstProcess.outcome;

    const secondProcess = client.startDiffProcess('second before', 'second after', options);
    sendResponse(workers[0].worker, { type: 'diff-complete', outcome: { status: 'identical' } });
    await secondProcess.outcome;

    expect(factory).toHaveBeenCalledOnce();
    expect(workers[0].postMessage.mock.calls).toEqual([
      [
        {
          type: 'compute-diff',
          originalText: 'first before',
          modifiedText: 'first after',
          options,
        },
      ],
      [
        {
          type: 'compute-diff',
          originalText: 'second before',
          modifiedText: 'second after',
          options,
        },
      ],
    ]);
    expectWorkerIdle(workers[0]);
  });

  it('resolves a successful result and ignores termination and late messages after settling', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const process = client.startDiffProcess('old', 'new', options);
    const staleOnMessage = workers[0].worker.onmessage;
    const outcome: ComputeDiffOutcome = {
      status: 'success',
      diffResult: {
        originalLines: [{ lineNumber: 1, type: 'delete', content: 'old' }],
        modifiedLines: [{ lineNumber: 1, type: 'insert', content: 'new' }],
        originalTrailingNewline: false,
        modifiedTrailingNewline: false,
      },
    };

    sendResponse(workers[0].worker, { type: 'diff-complete', outcome });

    await expect(process.outcome).resolves.toBe(outcome);
    process.terminate();
    staleOnMessage?.call(workers[0].worker, {
      data: { type: 'diff-error', message: 'too late' },
    } as MessageEvent<DiffWorkerResponse>);
    expect(factory).toHaveBeenCalledOnce();
    expectWorkerIdle(workers[0]);
  });

  it('keeps the worker after a protocol-reported diff error', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const process = client.startDiffProcess('old', 'new', options);

    sendResponse(workers[0].worker, { type: 'diff-error', message: 'Diff computation failed' });

    await expect(process.outcome).rejects.toThrow('Diff computation failed');
    expect(factory).toHaveBeenCalledOnce();
    expectWorkerIdle(workers[0]);
  });

  it('rejects an invalid response and replaces the worker', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const process = client.startDiffProcess('old', 'new', options);

    sendResponse(workers[0].worker, { type: 'unexpected-response' } as unknown as DiffWorkerResponse);

    await expect(process.outcome).rejects.toThrow('The diff worker returned an invalid response.');
    expect(factory).toHaveBeenCalledTimes(2);
    expectWorkerStopped(workers[0]);
    expectWorkerIdle(workers[1]);
  });

  it.each([
    ['uses the runtime error message', 'Worker script crashed', 'Worker script crashed'],
    ['uses a fallback when the runtime error has no message', '', 'The diff worker failed to load.'],
  ])('%s and replaces the failed worker', async (_description, workerMessage, expectedMessage) => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const process = client.startDiffProcess('old', 'new', options);

    const { preventDefault } = sendWorkerError(workers[0].worker, workerMessage);

    await expect(process.outcome).rejects.toThrow(expectedMessage);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledTimes(2);
    expectWorkerStopped(workers[0]);
    expectWorkerIdle(workers[1]);
  });

  it('discards a worker that fails while idle and creates one for the next request', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);

    const { preventDefault } = sendWorkerError(workers[0].worker, 'Worker script failed to load');
    const process = client.startDiffProcess('old', 'new', options);

    expect(preventDefault).toHaveBeenCalledOnce();
    expectWorkerStopped(workers[0]);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(workers[1].postMessage).toHaveBeenCalledOnce();

    sendResponse(workers[1].worker, { type: 'diff-complete', outcome: { status: 'identical' } });
    await expect(process.outcome).resolves.toEqual({ status: 'identical' });
  });

  it('rejects with the original posting error and keeps the worker', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const postError = new DOMException('The value could not be cloned.', 'DataCloneError');
    workers[0].postMessage.mockImplementationOnce(() => {
      throw postError;
    });

    const process = client.startDiffProcess('old', 'new', options);

    await expect(process.outcome).rejects.toBe(postError);
    expect(factory).toHaveBeenCalledOnce();
    expectWorkerIdle(workers[0]);
  });

  it('terminates an active worker once, rejects with the cancellation error, and immediately starts a replacement', async () => {
    const { factory, workers } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const process = client.startDiffProcess('old', 'new', options);
    const staleOnMessage = workers[0].worker.onmessage;
    const staleOnError = workers[0].worker.onerror;
    const outcome = expect(process.outcome).rejects.toMatchObject({
      name: 'DiffProcessTerminatedError',
      message: 'The diff process was terminated.',
    });

    process.terminate();
    process.terminate();

    await outcome;
    await expect(process.outcome).rejects.toBeInstanceOf(DiffProcessTerminatedError);
    expect(factory).toHaveBeenCalledTimes(2);
    expectWorkerStopped(workers[0]);
    expectWorkerIdle(workers[1]);

    staleOnMessage?.call(workers[0].worker, {
      data: { type: 'diff-complete', outcome: { status: 'identical' } },
    } as MessageEvent<DiffWorkerResponse>);
    staleOnError?.call(workers[0].worker, {
      message: 'late worker error',
      preventDefault: vi.fn(),
    } as unknown as ErrorEvent);
    process.terminate();
    expect(workers[0].terminate).toHaveBeenCalledOnce();

    const nextProcess = client.startDiffProcess('next old', 'next new', options);
    expect(workers[1].postMessage).toHaveBeenCalledOnce();
    const nextOutcome: ComputeDiffOutcome = { status: 'identical' };
    sendResponse(workers[1].worker, { type: 'diff-complete', outcome: nextOutcome });
    await expect(nextProcess.outcome).resolves.toBe(nextOutcome);
  });

  it('does not allow overlapping requests on the shared worker', async () => {
    const { factory } = createWorkerFactoryHarness();
    const client = new DiffWorkerClient(factory);
    const process = client.startDiffProcess('old', 'new', options);

    expect(() => client.startDiffProcess('other old', 'other new', options)).toThrow(
      'A diff process is already running.',
    );

    const rejection = expect(process.outcome).rejects.toBeInstanceOf(DiffProcessTerminatedError);
    process.terminate();
    await rejection;
  });
});
