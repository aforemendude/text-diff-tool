export type DiffMode = 'line-grapheme' | 'grapheme';
export type DiffAlgorithm = 'myers' | 'adaptive';
export type DiffCleanupMode = 'none' | 'semantic' | 'efficiency';

export interface DiffResult {
  originalLines: LineDiff[];
  modifiedLines: LineDiff[];
  originalTrailingNewline: boolean;
  modifiedTrailingNewline: boolean;
}

export interface LineDiff {
  lineNumber: number;
  type: 'equal' | 'delete' | 'insert' | 'modify';
  content: string;
  charDiffs?: CharDiff[];
}

export interface CharDiff {
  type: 'equal' | 'delete' | 'insert';
  text: string;
}
