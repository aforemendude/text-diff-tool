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

export class DiffWorkerClient {
  private worker: Worker | null;
  private isProcessing = false;

  constructor(private readonly workerFactory: DiffWorkerFactory = createDiffWorker) {
    this.worker = this.createWorker();
  }

  startDiffProcess(originalText: string, modifiedText: string, options: ComputeDiffOptions): DiffProcess {
    if (this.isProcessing) {
      throw new Error('A diff process is already running.');
    }

    const worker = this.getWorker();
    this.isProcessing = true;
    let isSettled = false;
    let rejectOutcome: (reason: unknown) => void = () => undefined;

    const outcome = new Promise<ComputeDiffOutcome>((resolve, reject) => {
      rejectOutcome = reject;

      const settle = (action: () => void, replaceWorker = false) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        this.isProcessing = false;

        if (replaceWorker) {
          this.replaceWorker(worker);
        } else if (this.worker === worker) {
          this.setIdleHandlers(worker);
        }

        action();
      };

      worker.onmessage = (event: MessageEvent<DiffWorkerResponse>) => {
        const response = event.data;

        if (response?.type === 'diff-complete') {
          settle(() => resolve(response.outcome));
        } else if (response?.type === 'diff-error') {
          settle(() => reject(new Error(response.message)));
        } else {
          settle(() => reject(new Error('The diff worker returned an invalid response.')), true);
        }
      };

      worker.onerror = (event: ErrorEvent) => {
        event.preventDefault();
        settle(() => reject(new Error(event.message || 'The diff worker failed to load.')), true);
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

        const cancellationError = new DiffProcessTerminatedError();
        isSettled = true;
        this.isProcessing = false;
        this.replaceWorker(worker);
        rejectOutcome(cancellationError);
      },
    };
  }

  private createWorker(): Worker {
    const worker = this.workerFactory();
    this.setIdleHandlers(worker);
    return worker;
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker();
    }

    return this.worker;
  }

  private setIdleHandlers(worker: Worker): void {
    worker.onmessage = null;
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();

      if (this.worker !== worker || this.isProcessing) {
        return;
      }

      this.stopWorker(worker);
      this.worker = null;
    };
  }

  private replaceWorker(worker: Worker): void {
    this.stopWorker(worker);

    if (this.worker === worker) {
      this.worker = null;
    }

    try {
      this.worker = this.createWorker();
    } catch {
      // A later request will retry worker creation and surface that failure to the caller.
    }
  }

  private stopWorker(worker: Worker): void {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }
}

let sharedDiffWorkerClient: DiffWorkerClient | null = null;

export function initializeDiffWorker(): DiffWorkerClient {
  sharedDiffWorkerClient ??= new DiffWorkerClient();
  return sharedDiffWorkerClient;
}

export function startDiffProcess(originalText: string, modifiedText: string, options: ComputeDiffOptions): DiffProcess {
  return initializeDiffWorker().startDiffProcess(originalText, modifiedText, options);
}
