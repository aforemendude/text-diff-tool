import { cleanupEfficiency, cleanupSemantic } from '@aforemendude/diff/cleanup';
import { diffGraphemes, type Diff } from '@aforemendude/diff/grapheme';
import { DELETE, EQUAL, INSERT, diffLines } from '@aforemendude/diff/line';
import { parseJson, serializeJson } from '@aforemendude/json-parse';
import type { CharDiff, DiffAlgorithm, DiffCleanupMode, DiffMode, DiffResult, LineDiff } from '../types/diff';

export interface ComputeDiffOptions {
  isJsonMode: boolean;
  diffMode: DiffMode;
  diffAlgorithm: DiffAlgorithm;
  diffCleanupMode: DiffCleanupMode;
  editCost: number;
}

export type ComputeDiffOutcome =
  | { status: 'success'; diffResult: DiffResult }
  | { status: 'identical' }
  | { status: 'error'; source: 'original' | 'modified'; message: string };

interface GraphemeLineBuilder {
  id: number;
  lineNumber: number;
  contentParts: string[];
  charDiffs: CharDiff[];
  matchWeights: Map<number, number>;
}

interface GraphemeLine extends Omit<GraphemeLineBuilder, 'contentParts'> {
  content: string;
}

type GraphemeLinePair = readonly [original: GraphemeLine | undefined, modified: GraphemeLine | undefined];

const MAX_ALIGNMENT_CELLS = 1_000_000;

function isLineBreak(token: string): boolean {
  return token === '\n' || token === '\r\n';
}

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

function applyCleanup(diffs: readonly Diff[], diffCleanupMode: DiffCleanupMode, editCost: number): readonly Diff[] {
  if (diffCleanupMode === 'semantic') {
    return cleanupSemantic(diffs);
  }
  if (diffCleanupMode === 'efficiency') {
    return cleanupEfficiency(diffs, { editCost });
  }
  return diffs;
}

function splitCharacterDiffs(diffs: readonly Diff[]): { original: CharDiff[]; modified: CharDiff[] } {
  const original: CharDiff[] = [];
  const modified: CharDiff[] = [];

  for (const [operation, tokens] of diffs) {
    const text = tokens.join('');
    if (operation === EQUAL) {
      original.push({ type: 'equal', text });
      modified.push({ type: 'equal', text });
    } else if (operation === DELETE) {
      original.push({ type: 'delete', text });
    } else if (operation === INSERT) {
      modified.push({ type: 'insert', text });
    }
  }

  return { original, modified };
}

function computeLineGraphemeDiff(
  originalText: string,
  modifiedText: string,
  diffAlgorithm: DiffAlgorithm,
  diffCleanupMode: DiffCleanupMode,
  editCost: number,
): Pick<DiffResult, 'originalLines' | 'modifiedLines'> {
  const lineDiffs = diffLines(originalText, modifiedText, { algorithm: diffAlgorithm });
  const originalLines: LineDiff[] = [];
  const modifiedLines: LineDiff[] = [];
  let originalLineNumber = 1;
  let modifiedLineNumber = 1;

  for (const [operation, lines] of lineDiffs) {
    if (operation === EQUAL) {
      for (const content of lines) {
        originalLines.push({ lineNumber: originalLineNumber++, type: 'equal', content });
        modifiedLines.push({ lineNumber: modifiedLineNumber++, type: 'equal', content });
      }
    } else if (operation === DELETE) {
      for (const content of lines) {
        originalLines.push({ lineNumber: originalLineNumber++, type: 'delete', content });
      }
    } else if (operation === INSERT) {
      for (const content of lines) {
        modifiedLines.push({ lineNumber: modifiedLineNumber++, type: 'insert', content });
      }
    }
  }

  const alignedOriginal: LineDiff[] = [];
  const alignedModified: LineDiff[] = [];
  let originalIndex = 0;
  let modifiedIndex = 0;

  while (originalIndex < originalLines.length || modifiedIndex < modifiedLines.length) {
    const originalLine = originalLines[originalIndex];
    const modifiedLine = modifiedLines[modifiedIndex];

    if (originalLine?.type === 'equal' && modifiedLine?.type === 'equal') {
      alignedOriginal.push(originalLine);
      alignedModified.push(modifiedLine);
      originalIndex++;
      modifiedIndex++;
    } else if (originalLine?.type === 'delete' && modifiedLine?.type === 'insert') {
      if (originalLine.content === modifiedLine.content) {
        alignedOriginal.push({ ...originalLine, type: 'equal' });
        alignedModified.push({ ...modifiedLine, type: 'equal' });
      } else {
        const graphemeDiffs = applyCleanup(
          diffGraphemes(originalLine.content, modifiedLine.content, { algorithm: diffAlgorithm }),
          diffCleanupMode,
          editCost,
        );
        const charDiffs = splitCharacterDiffs(graphemeDiffs);
        alignedOriginal.push({ ...originalLine, type: 'modify', charDiffs: charDiffs.original });
        alignedModified.push({ ...modifiedLine, type: 'modify', charDiffs: charDiffs.modified });
      }
      originalIndex++;
      modifiedIndex++;
    } else if (originalLine?.type === 'delete') {
      alignedOriginal.push(originalLine);
      alignedModified.push({ lineNumber: -1, type: 'insert', content: '' });
      originalIndex++;
    } else if (modifiedLine?.type === 'insert') {
      alignedOriginal.push({ lineNumber: -1, type: 'delete', content: '' });
      alignedModified.push(modifiedLine);
      modifiedIndex++;
    } else {
      if (originalLine) {
        alignedOriginal.push(originalLine);
        originalIndex++;
      }
      if (modifiedLine) {
        alignedModified.push(modifiedLine);
        modifiedIndex++;
      }
    }
  }

  return { originalLines: alignedOriginal, modifiedLines: alignedModified };
}

function appendCharacterDiff(builder: GraphemeLineBuilder, type: CharDiff['type'], text: string): void {
  builder.contentParts.push(text);
  const previous = builder.charDiffs.at(-1);
  if (previous?.type === type) {
    previous.text += text;
  } else {
    builder.charDiffs.push({ type, text });
  }
}

function finishGraphemeLine(builder: GraphemeLineBuilder): GraphemeLine {
  return {
    id: builder.id,
    lineNumber: builder.lineNumber,
    content: builder.contentParts.join(''),
    charDiffs: builder.charDiffs,
    matchWeights: builder.matchWeights,
  };
}

function alignLargeGraphemeHunk(originalLines: GraphemeLine[], modifiedLines: GraphemeLine[]): GraphemeLinePair[] {
  const pairs: GraphemeLinePair[] = [];
  const rowCount = Math.max(originalLines.length, modifiedLines.length);
  const originalOffset = rowCount - originalLines.length;
  const modifiedOffset = rowCount - modifiedLines.length;

  for (let row = 0; row < rowCount; row++) {
    pairs.push([originalLines[row - originalOffset], modifiedLines[row - modifiedOffset]]);
  }

  return pairs;
}

function alignGraphemeHunk(originalLines: GraphemeLine[], modifiedLines: GraphemeLine[]): GraphemeLinePair[] {
  if (originalLines.length === 0) {
    return modifiedLines.map((line) => [undefined, line]);
  }
  if (modifiedLines.length === 0) {
    return originalLines.map((line) => [line, undefined]);
  }

  const rowCount = originalLines.length + 1;
  const columnCount = modifiedLines.length + 1;
  if (rowCount * columnCount > MAX_ALIGNMENT_CELLS) {
    return alignLargeGraphemeHunk(originalLines, modifiedLines);
  }

  const directions = new Uint8Array(rowCount * columnCount);
  let previousScores = new Float64Array(columnCount);
  let currentScores = new Float64Array(columnCount);

  for (let column = 1; column < columnCount; column++) {
    directions[column] = 2;
  }

  for (let row = 1; row < rowCount; row++) {
    directions[row * columnCount] = 1;
    currentScores[0] = 0;

    for (let column = 1; column < columnCount; column++) {
      const originalLine = originalLines[row - 1];
      const modifiedLine = modifiedLines[column - 1];
      const sharedMatchWeight = originalLine.matchWeights.get(modifiedLine.id) ?? 0;
      const exactContentBonus = originalLine.content === modifiedLine.content ? 2 : 0;
      const diagonalScore = previousScores[column - 1] + 1 + sharedMatchWeight * 4 + exactContentBonus;
      const upScore = previousScores[column];
      const leftScore = currentScores[column - 1];
      const directionIndex = row * columnCount + column;

      if (diagonalScore >= upScore && diagonalScore >= leftScore) {
        currentScores[column] = diagonalScore;
        directions[directionIndex] = 3;
      } else if (upScore >= leftScore) {
        currentScores[column] = upScore;
        directions[directionIndex] = 1;
      } else {
        currentScores[column] = leftScore;
        directions[directionIndex] = 2;
      }
    }

    [previousScores, currentScores] = [currentScores, previousScores];
  }

  const reversedPairs: GraphemeLinePair[] = [];
  let row = originalLines.length;
  let column = modifiedLines.length;

  while (row > 0 || column > 0) {
    const direction = directions[row * columnCount + column];
    if (direction === 3) {
      reversedPairs.push([originalLines[--row], modifiedLines[--column]]);
    } else if (direction === 1) {
      reversedPairs.push([originalLines[--row], undefined]);
    } else {
      reversedPairs.push([undefined, modifiedLines[--column]]);
    }
  }

  return reversedPairs.reverse();
}

function appendGraphemeRows(pairs: GraphemeLinePair[], originalLines: LineDiff[], modifiedLines: LineDiff[]): void {
  for (const [originalLine, modifiedLine] of pairs) {
    if (!originalLine && modifiedLine) {
      originalLines.push({ lineNumber: -1, type: 'delete', content: '' });
      modifiedLines.push({ lineNumber: modifiedLine.lineNumber, type: 'insert', content: modifiedLine.content });
      continue;
    }
    if (originalLine && !modifiedLine) {
      originalLines.push({ lineNumber: originalLine.lineNumber, type: 'delete', content: originalLine.content });
      modifiedLines.push({ lineNumber: -1, type: 'insert', content: '' });
      continue;
    }
    if (!originalLine || !modifiedLine) {
      continue;
    }

    const isChanged =
      originalLine.content !== modifiedLine.content ||
      originalLine.charDiffs.some(({ type }) => type !== 'equal') ||
      modifiedLine.charDiffs.some(({ type }) => type !== 'equal');

    if (isChanged) {
      originalLines.push({
        lineNumber: originalLine.lineNumber,
        type: 'modify',
        content: originalLine.content,
        charDiffs: originalLine.charDiffs,
      });
      modifiedLines.push({
        lineNumber: modifiedLine.lineNumber,
        type: 'modify',
        content: modifiedLine.content,
        charDiffs: modifiedLine.charDiffs,
      });
    } else {
      originalLines.push({ lineNumber: originalLine.lineNumber, type: 'equal', content: originalLine.content });
      modifiedLines.push({ lineNumber: modifiedLine.lineNumber, type: 'equal', content: modifiedLine.content });
    }
  }
}

function computeGraphemeDiff(
  originalText: string,
  modifiedText: string,
  diffAlgorithm: DiffAlgorithm,
  diffCleanupMode: DiffCleanupMode,
  editCost: number,
): Pick<DiffResult, 'originalLines' | 'modifiedLines'> {
  const diffs = applyCleanup(
    diffGraphemes(originalText, modifiedText, { algorithm: diffAlgorithm }),
    diffCleanupMode,
    editCost,
  );
  const originalLines: LineDiff[] = [];
  const modifiedLines: LineDiff[] = [];
  let pendingOriginalLines: GraphemeLine[] = [];
  let pendingModifiedLines: GraphemeLine[] = [];
  let nextBuilderId = 1;
  let nextOriginalLineNumber = 1;
  let nextModifiedLineNumber = 1;

  const createBuilder = (lineNumber: number): GraphemeLineBuilder => ({
    id: nextBuilderId++,
    lineNumber,
    contentParts: [],
    charDiffs: [],
    matchWeights: new Map(),
  });
  let originalBuilder = createBuilder(nextOriginalLineNumber);
  let modifiedBuilder = createBuilder(nextModifiedLineNumber);

  const recordMatch = (weight = 1) => {
    originalBuilder.matchWeights.set(
      modifiedBuilder.id,
      (originalBuilder.matchWeights.get(modifiedBuilder.id) ?? 0) + weight,
    );
  };
  const finishOriginalLine = () => {
    pendingOriginalLines.push(finishGraphemeLine(originalBuilder));
    originalBuilder = createBuilder(++nextOriginalLineNumber);
  };
  const finishModifiedLine = () => {
    pendingModifiedLines.push(finishGraphemeLine(modifiedBuilder));
    modifiedBuilder = createBuilder(++nextModifiedLineNumber);
  };
  const flushHunk = () => {
    appendGraphemeRows(alignGraphemeHunk(pendingOriginalLines, pendingModifiedLines), originalLines, modifiedLines);
    pendingOriginalLines = [];
    pendingModifiedLines = [];
  };

  for (const [operation, tokens] of diffs) {
    for (const token of tokens) {
      if (operation === EQUAL) {
        if (isLineBreak(token)) {
          recordMatch(2);
          finishOriginalLine();
          finishModifiedLine();
          flushHunk();
        } else {
          recordMatch();
          appendCharacterDiff(originalBuilder, 'equal', token);
          appendCharacterDiff(modifiedBuilder, 'equal', token);
        }
      } else if (operation === DELETE) {
        if (isLineBreak(token)) {
          finishOriginalLine();
        } else {
          appendCharacterDiff(originalBuilder, 'delete', token);
        }
      } else if (operation === INSERT) {
        if (isLineBreak(token)) {
          finishModifiedLine();
        } else {
          appendCharacterDiff(modifiedBuilder, 'insert', token);
        }
      }
    }
  }

  if (originalText.length > 0 && !originalText.endsWith('\n')) {
    pendingOriginalLines.push(finishGraphemeLine(originalBuilder));
  }
  if (modifiedText.length > 0 && !modifiedText.endsWith('\n')) {
    pendingModifiedLines.push(finishGraphemeLine(modifiedBuilder));
  }
  flushHunk();

  return { originalLines, modifiedLines };
}

export function computeDiff(
  originalText: string,
  modifiedText: string,
  { isJsonMode, diffMode, diffAlgorithm, diffCleanupMode, editCost }: ComputeDiffOptions,
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

  const diff =
    diffMode === 'grapheme'
      ? computeGraphemeDiff(textToCompareOriginal, textToCompareModified, diffAlgorithm, diffCleanupMode, editCost)
      : computeLineGraphemeDiff(textToCompareOriginal, textToCompareModified, diffAlgorithm, diffCleanupMode, editCost);

  return {
    status: 'success',
    diffResult: {
      ...diff,
      originalTrailingNewline: textToCompareOriginal.endsWith('\n'),
      modifiedTrailingNewline: textToCompareModified.endsWith('\n'),
    },
  };
}
