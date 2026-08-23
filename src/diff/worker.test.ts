import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComputeDiffOptions, ComputeDiffOutcome } from './compute';
import type { DiffWorkerRequest } from './workerProtocol';

const computeMocks = vi.hoisted(() => ({ computeDiff: vi.fn() }));

vi.mock('./compute', () => ({ computeDiff: computeMocks.computeDiff }));

const postMessage = vi.fn();
let messageListener: ((event: MessageEvent<DiffWorkerRequest>) => void) | undefined;
const addEventListener = vi.fn((type: string, listener: (event: MessageEvent<DiffWorkerRequest>) => void) => {
  if (type === 'message') {
    messageListener = listener;
  }
});
const workerScope = { addEventListener, postMessage };
let freezeObjectPrototype: ReturnType<typeof vi.spyOn>;

function dispatchRequest(request: DiffWorkerRequest): void {
  expect(messageListener).toBeTypeOf('function');
  messageListener?.({ data: request } as MessageEvent<DiffWorkerRequest>);
}

describe('worker', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', workerScope);
    const preserveValue = (<Value>(value: Value) => value) as typeof Object.freeze;
    freezeObjectPrototype = vi.spyOn(Object, 'freeze').mockImplementation(preserveValue);

    await import('./worker');
  });

  beforeEach(() => {
    computeMocks.computeDiff.mockReset();
    postMessage.mockReset();
  });

  afterAll(() => {
    freezeObjectPrototype.mockRestore();
    vi.unstubAllGlobals();
  });

  it('hardens the worker realm and registers one message listener', () => {
    expect(freezeObjectPrototype).toHaveBeenCalledExactlyOnceWith(Object.prototype);
    expect(addEventListener).toHaveBeenCalledExactlyOnceWith('message', messageListener);
    expect(messageListener).toBeTypeOf('function');
  });

  it('ignores messages that are not diff requests', () => {
    dispatchRequest({ type: 'unexpected-request' } as unknown as DiffWorkerRequest);

    expect(computeMocks.computeDiff).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('computes a requested diff and posts the successful outcome', () => {
    const options: ComputeDiffOptions = {
      isJsonMode: false,
      diffMode: 'line-grapheme',
      diffAlgorithm: 'myers',
      diffCleanupMode: 'semantic',
      editCost: 4,
    };
    const outcome: ComputeDiffOutcome = { status: 'identical' };
    computeMocks.computeDiff.mockReturnValue(outcome);

    dispatchRequest({
      type: 'compute-diff',
      originalText: 'before',
      modifiedText: 'after',
      options,
    });

    expect(computeMocks.computeDiff).toHaveBeenCalledExactlyOnceWith('before', 'after', options);
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'diff-complete', outcome });
  });

  it('posts the message from an Error thrown during diff computation', () => {
    computeMocks.computeDiff.mockImplementation(() => {
      throw new Error('Unable to compute diff');
    });

    dispatchRequest({
      type: 'compute-diff',
      originalText: 'before',
      modifiedText: 'after',
      options: {
        isJsonMode: true,
        diffMode: 'grapheme',
        diffAlgorithm: 'adaptive',
        diffCleanupMode: 'none',
        editCost: 2,
      },
    });

    expect(postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'diff-error',
      message: 'Unable to compute diff',
    });
  });

  it('posts a stable fallback when diff computation throws a non-Error value', () => {
    computeMocks.computeDiff.mockImplementation(() => {
      throw 'unexpected failure';
    });

    dispatchRequest({
      type: 'compute-diff',
      originalText: 'before',
      modifiedText: 'after',
      options: {
        isJsonMode: true,
        diffMode: 'grapheme',
        diffAlgorithm: 'adaptive',
        diffCleanupMode: 'none',
        editCost: 2,
      },
    });

    expect(postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'diff-error',
      message: 'Unknown worker error',
    });
  });
});
