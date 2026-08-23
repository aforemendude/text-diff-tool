import { cleanupEfficiency, cleanupSemantic } from '@aforemendude/diff/cleanup';
import { diffGraphemes } from '@aforemendude/diff/grapheme';
import { DELETE, EQUAL, INSERT, diffLines } from '@aforemendude/diff/line';
import { parseJson, serializeJson } from '@aforemendude/json-parse';
import type { CharDiff, DiffCleanupMode, DiffResult, LineDiff } from '../types/diff';

export interface ComputeDiffOptions {
  isJsonMode: boolean;
  diffCleanupMode: DiffCleanupMode;
  editCost: number;
}

export type ComputeDiffOutcome =
  | { status: 'success'; diffResult: DiffResult }
  | { status: 'identical' }
  | { status: 'error'; source: 'original' | 'modified'; message: string };

function normalizeJson(text: string, source: 'original' | 'modified'): string | ComputeDiffOutcome {
  try {
    return serializeJson(parseJson(text), { sortKeys: true });
  } catch (error) {
    return {
      status: 'error',
      source,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function computeDiff(
  originalText: string,
  modifiedText: string,
  { isJsonMode, diffCleanupMode, editCost }: ComputeDiffOptions,
): ComputeDiffOutcome {
  let textToCompareOriginal = originalText;
  let textToCompareModified = modifiedText;

  if (isJsonMode) {
    const normalizedOriginal = normalizeJson(originalText, 'original');
    if (typeof normalizedOriginal !== 'string') {
      return normalizedOriginal;
    }

    const normalizedModified = normalizeJson(modifiedText, 'modified');
    if (typeof normalizedModified !== 'string') {
      return normalizedModified;
    }

    textToCompareOriginal = normalizedOriginal;
    textToCompareModified = normalizedModified;
  }

  if (textToCompareOriginal === textToCompareModified) {
    return { status: 'identical' };
  }

  const originalHasTrailingNewline = textToCompareOriginal.endsWith('\n');
  const modifiedHasTrailingNewline = textToCompareModified.endsWith('\n');
  const lineDiffs = diffLines(textToCompareOriginal, textToCompareModified, { algorithm: 'myers' });

  const resultOriginal: LineDiff[] = [];
  const resultModified: LineDiff[] = [];
  let origLineNum = 1;
  let modLineNum = 1;

  for (const [operation, lines] of lineDiffs) {
    if (operation === EQUAL) {
      for (const content of lines) {
        resultOriginal.push({ lineNumber: origLineNum++, type: 'equal', content });
        resultModified.push({ lineNumber: modLineNum++, type: 'equal', content });
      }
    } else if (operation === DELETE) {
      for (const content of lines) {
        resultOriginal.push({ lineNumber: origLineNum++, type: 'delete', content });
      }
    } else if (operation === INSERT) {
      for (const content of lines) {
        resultModified.push({ lineNumber: modLineNum++, type: 'insert', content });
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

      let characterDiffs = diffGraphemes(origLine.content, modLine.content, { algorithm: 'myers' });
      if (diffCleanupMode === 'semantic') {
        characterDiffs = cleanupSemantic(characterDiffs);
      } else if (diffCleanupMode === 'efficiency') {
        characterDiffs = cleanupEfficiency(characterDiffs, { editCost });
      }

      const origCharDiffs: CharDiff[] = [];
      const modCharDiffs: CharDiff[] = [];

      for (const [operation, tokens] of characterDiffs) {
        const text = tokens.join('');
        if (operation === EQUAL) {
          origCharDiffs.push({ type: 'equal', text });
          modCharDiffs.push({ type: 'equal', text });
        } else if (operation === DELETE) {
          origCharDiffs.push({ type: 'delete', text });
        } else if (operation === INSERT) {
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

  return {
    status: 'success',
    diffResult: {
      originalLines: processedOriginal,
      modifiedLines: processedModified,
      originalTrailingNewline: originalHasTrailingNewline,
      modifiedTrailingNewline: modifiedHasTrailingNewline,
    },
  };
}
