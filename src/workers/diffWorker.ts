/// <reference lib="webworker" />

import 'virtual:diff-match-patch-runtime';
import { computeDiff } from '../utils/diffUtils';
import type { DiffWorkerRequest, DiffWorkerResponse } from './diffWorkerProtocol';

const workerScope = self as DedicatedWorkerGlobalScope;

// Keep the prototype guard in the realm where JSON parsing and diff processing now happen.
Object.freeze(Object.prototype);

workerScope.addEventListener('message', (event: MessageEvent<DiffWorkerRequest>) => {
  if (event.data.type !== 'compute-diff') {
    return;
  }

  let response: DiffWorkerResponse;

  try {
    response = {
      type: 'diff-complete',
      outcome: computeDiff(event.data.originalText, event.data.modifiedText, event.data.options),
    };
  } catch (error) {
    response = {
      type: 'diff-error',
      message: error instanceof Error ? error.message : 'Unknown worker error',
    };
  }

  workerScope.postMessage(response);
});
