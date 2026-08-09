import type { ComputeDiffOptions, ComputeDiffOutcome } from '../utils/diffUtils';
import type { DiffWorkerRequest, DiffWorkerResponse } from './diffWorkerProtocol';

export interface DiffProcess {
  outcome: Promise<ComputeDiffOutcome>;
  terminate: () => void;
}

export type DiffWorkerFactory = () => Worker;

export class DiffProcessTerminatedError extends Error {
  constructor() {
    super('The diff process was terminated.');
    this.name = 'DiffProcessTerminatedError';
  }
}

const createDiffWorker: DiffWorkerFactory = () =>
  new Worker(new URL('./diffWorker.ts', import.meta.url), { type: 'module' });

export function startDiffProcess(
  originalText: string,
  modifiedText: string,
  options: ComputeDiffOptions,
  workerFactory: DiffWorkerFactory = createDiffWorker,
): DiffProcess {
  const worker = workerFactory();
  let isSettled = false;
  let rejectOutcome: (reason: unknown) => void = () => undefined;

  const stopWorker = () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };

  const outcome = new Promise<ComputeDiffOutcome>((resolve, reject) => {
    rejectOutcome = reject;

    const settle = (action: () => void) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      stopWorker();
      action();
    };

    worker.onmessage = (event: MessageEvent<DiffWorkerResponse>) => {
      const response = event.data;

      if (response.type === 'diff-complete') {
        settle(() => resolve(response.outcome));
      } else if (response.type === 'diff-error') {
        settle(() => reject(new Error(response.message)));
      } else {
        settle(() => reject(new Error('The diff worker returned an invalid response.')));
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      settle(() => reject(new Error(event.message || 'The diff worker failed to load.')));
    };

    const request: DiffWorkerRequest = {
      type: 'compute-diff',
      originalText,
      modifiedText,
      options,
    };

    try {
      worker.postMessage(request);
    } catch (error) {
      settle(() => reject(error));
    }
  });

  return {
    outcome,
    terminate: () => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      stopWorker();
      rejectOutcome(new DiffProcessTerminatedError());
    },
  };
}
