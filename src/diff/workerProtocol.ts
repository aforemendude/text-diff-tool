import type { ComputeDiffOptions, ComputeDiffOutcome } from './compute';

export interface DiffWorkerRequest {
  type: 'compute-diff';
  originalText: string;
  modifiedText: string;
  options: ComputeDiffOptions;
}

export type DiffWorkerResponse =
  { type: 'diff-complete'; outcome: ComputeDiffOutcome } | { type: 'diff-error'; message: string };
