import type { CharDiff, DiffCleanupMode, DiffResult, LineDiff } from '../types/diff';
import { detectJsonIssues, stringifyWithSortedKeys, type JsonIssueCounts } from './jsonUtils';

interface DiffEngine {
  Diff_Timeout: number;
  Diff_EditCost: number;
  diff_linesToChars_(text1: string, text2: string): { chars1: string; chars2: string; lineArray: string[] };
  diff_charsToLines_(diffs: diff_match_patch.Diff[], lineArray: string[]): void;
  diff_main(text1: string, text2: string, checkLines?: boolean): diff_match_patch.Diff[];
  diff_cleanupSemantic(diffs: diff_match_patch.Diff[]): void;
  diff_cleanupEfficiency(diffs: diff_match_patch.Diff[]): void;
}

export interface ComputeDiffOptions {
  isJsonMode: boolean;
  diffCleanupMode: DiffCleanupMode;
  editCost: number;
}

export interface JsonWarning {
  source: 'original' | 'modified';
  type: 'numeric-precision' | 'duplicate-keys';
  count: number;
}

export type ComputeDiffOutcome =
  | { status: 'success'; diffResult: DiffResult; warnings?: JsonWarning[] }
  | { status: 'identical'; warnings?: JsonWarning[] }
  | { status: 'error'; source: 'original' | 'modified'; message: string };

export type DiffEngineFactory = () => DiffEngine;

const createDiffEngine: DiffEngineFactory = () => new diff_match_patch();

interface ParsedJson {
  normalizedText: string;
  issueCounts: JsonIssueCounts;
}

function parseJson(text: string, source: 'original' | 'modified'): ParsedJson | ComputeDiffOutcome {
  try {
    const parsedValue: unknown = JSON.parse(text);
    return {
      normalizedText: stringifyWithSortedKeys(parsedValue),
      issueCounts: detectJsonIssues(text),
    };
  } catch (error) {
    return {
      status: 'error',
      source,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function collectJsonWarnings(original: JsonIssueCounts, modified: JsonIssueCounts): JsonWarning[] {
  const warnings: JsonWarning[] = [];

  if (original.numericPrecision > 0) {
    warnings.push({ source: 'original', type: 'numeric-precision', count: original.numericPrecision });
  }
  if (modified.numericPrecision > 0) {
    warnings.push({ source: 'modified', type: 'numeric-precision', count: modified.numericPrecision });
  }
  if (original.duplicateKeys > 0) {
    warnings.push({ source: 'original', type: 'duplicate-keys', count: original.duplicateKeys });
  }
  if (modified.duplicateKeys > 0) {
    warnings.push({ source: 'modified', type: 'duplicate-keys', count: modified.duplicateKeys });
  }

  return warnings;
}

function addWarnings<T extends { status: 'success' | 'identical' }>(outcome: T, warnings: JsonWarning[]): T {
  return warnings.length === 0 ? outcome : { ...outcome, warnings };
}

function normalizeLineDiffInput(text: string): string {
  // The line encoder includes a terminating newline in each token. Add one to a non-empty final line so the same
  // logical line receives the same token whether or not another line follows it. The separately captured trailing
  // newline flags retain the original line-ending difference for display.
  return text === '' || text.endsWith('\n') ? text : `${text}\n`;
}

export function computeDiff(
  originalText: string,
  modifiedText: string,
  { isJsonMode, diffCleanupMode, editCost }: ComputeDiffOptions,
  engineFactory: DiffEngineFactory = createDiffEngine,
): ComputeDiffOutcome {
  let textToCompareOriginal = originalText;
  let textToCompareModified = modifiedText;
  let jsonWarnings: JsonWarning[] = [];

  if (isJsonMode) {
    const parsedOriginal = parseJson(originalText, 'original');
    if ('status' in parsedOriginal) {
      return parsedOriginal;
    }

    const parsedModified = parseJson(modifiedText, 'modified');
    if ('status' in parsedModified) {
      return parsedModified;
    }

    textToCompareOriginal = parsedOriginal.normalizedText;
    textToCompareModified = parsedModified.normalizedText;
    jsonWarnings = collectJsonWarnings(parsedOriginal.issueCounts, parsedModified.issueCounts);
  }

  if (textToCompareOriginal === textToCompareModified) {
    return addWarnings({ status: 'identical' }, jsonWarnings);
  }

  const originalHasTrailingNewline = textToCompareOriginal.endsWith('\n');
  const modifiedHasTrailingNewline = textToCompareModified.endsWith('\n');

  const dmp = engineFactory();
  dmp.Diff_Timeout = 0;
  dmp.Diff_EditCost = editCost;

  const lineText1 = normalizeLineDiffInput(textToCompareOriginal);
  const lineText2 = normalizeLineDiffInput(textToCompareModified);

  const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(lineText1, lineText2);
  const lineDiffs = dmp.diff_main(chars1, chars2, false);
  dmp.diff_charsToLines_(lineDiffs, lineArray);

  const resultOriginal: LineDiff[] = [];
  const resultModified: LineDiff[] = [];
  let origLineNum = 1;
  let modLineNum = 1;

  for (const diff of lineDiffs) {
    const op = diff[0];
    const text = diff[1];
    const lines = text.split('\n').filter((value, index, values) => index < values.length - 1 || value !== '');

    if (op === DIFF_EQUAL) {
      for (const line of lines) {
        if (line !== '' || text.includes('\n')) {
          resultOriginal.push({ lineNumber: origLineNum++, type: 'equal', content: line });
          resultModified.push({ lineNumber: modLineNum++, type: 'equal', content: line });
        }
      }
    } else if (op === DIFF_DELETE) {
      for (const line of lines) {
        resultOriginal.push({ lineNumber: origLineNum++, type: 'delete', content: line });
      }
    } else if (op === DIFF_INSERT) {
      for (const line of lines) {
        resultModified.push({ lineNumber: modLineNum++, type: 'insert', content: line });
      }
    }
  }

  const processedOriginal: LineDiff[] = [];
  const processedModified: LineDiff[] = [];
  let origIdx = 0;
  let modIdx = 0;

  while (origIdx < resultOriginal.length || modIdx < resultModified.length) {
    const origLine = resultOriginal[origIdx];
    const modLine = resultModified[modIdx];

    if (origLine?.type === 'equal' && modLine?.type === 'equal') {
      processedOriginal.push(origLine);
      processedModified.push(modLine);
      origIdx++;
      modIdx++;
    } else if (origLine?.type === 'delete' && modLine?.type === 'insert') {
      if (origLine.content === modLine.content) {
        processedOriginal.push({ ...origLine, type: 'equal' });
        processedModified.push({ ...modLine, type: 'equal' });
        origIdx++;
        modIdx++;
        continue;
      }

      const charDiffs = dmp.diff_main(origLine.content, modLine.content);
      if (diffCleanupMode === 'semantic') {
        dmp.diff_cleanupSemantic(charDiffs);
      } else if (diffCleanupMode === 'efficiency') {
        dmp.diff_cleanupEfficiency(charDiffs);
      }

      const origCharDiffs: CharDiff[] = [];
      const modCharDiffs: CharDiff[] = [];

      for (const charDiff of charDiffs) {
        const operation = charDiff[0];
        const text = charDiff[1];
        if (operation === DIFF_EQUAL) {
          origCharDiffs.push({ type: 'equal', text });
          modCharDiffs.push({ type: 'equal', text });
        } else if (operation === DIFF_DELETE) {
          origCharDiffs.push({ type: 'delete', text });
        } else if (operation === DIFF_INSERT) {
          modCharDiffs.push({ type: 'insert', text });
        }
      }

      processedOriginal.push({ ...origLine, type: 'modify', charDiffs: origCharDiffs });
      processedModified.push({ ...modLine, type: 'modify', charDiffs: modCharDiffs });
      origIdx++;
      modIdx++;
    } else if (origLine?.type === 'delete') {
      processedOriginal.push(origLine);
      processedModified.push({ lineNumber: -1, type: 'insert', content: '' });
      origIdx++;
    } else if (modLine?.type === 'insert') {
      processedOriginal.push({ lineNumber: -1, type: 'delete', content: '' });
      processedModified.push(modLine);
      modIdx++;
    } else {
      if (origLine) {
        processedOriginal.push(origLine);
        origIdx++;
      }
      if (modLine) {
        processedModified.push(modLine);
        modIdx++;
      }
    }
  }

  return addWarnings(
    {
      status: 'success',
      diffResult: {
        originalLines: processedOriginal,
        modifiedLines: processedModified,
        originalTrailingNewline: originalHasTrailingNewline,
        modifiedTrailingNewline: modifiedHasTrailingNewline,
      },
    },
    jsonWarnings,
  );
}
