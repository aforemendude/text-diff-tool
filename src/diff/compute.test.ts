import { describe, expect, it } from 'vitest';
import { computeDiff, type ComputeDiffOutcome } from './compute';
import type { DiffCleanupMode, DiffResult, LineDiff } from './types';

const options = {
  isJsonMode: false,
  diffMode: 'line-grapheme' as const,
  diffAlgorithm: 'myers' as const,
  diffCleanupMode: 'semantic' as const,
  editCost: 4,
};

function getDiffResult(outcome: ComputeDiffOutcome): DiffResult {
  expect(outcome.status).toBe('success');
  if (outcome.status !== 'success') {
    throw new Error(`Expected a successful diff, received ${outcome.status}.`);
  }
  return outcome.diffResult;
}

function getLine(lines: readonly LineDiff[], index: number): LineDiff {
  const line = lines[index];
  if (line === undefined) {
    throw new Error(`Missing diff line at index ${index}`);
  }
  return line;
}

describe('computeDiff', () => {
  it('returns identical for equal raw text', () => {
    expect(computeDiff('same', 'same', options)).toEqual({ status: 'identical' });
  });

  it('normalizes JSON key order before determining semantic identity', () => {
    expect(
      computeDiff('{"z": 1, "a": {"y": 2, "b": 3}}', '{"a":{"b":3,"y":2},"z":1}', { ...options, isJsonMode: true }),
    ).toEqual({ status: 'identical' });
  });

  it('preserves exact number spellings instead of rounding unsafe integers', () => {
    const result = getDiffResult(
      computeDiff('{"id":9007199254740992}', '{"id":9007199254740993}', {
        ...options,
        isJsonMode: true,
        diffCleanupMode: 'none',
      }),
    );

    expect(result.originalLines.map(({ content }) => content)).toEqual(['{', '  "id": 9007199254740992', '}']);
    expect(result.modifiedLines.map(({ content }) => content)).toEqual(['{', '  "id": 9007199254740993', '}']);
    expect(getLine(result.originalLines, 1).type).toBe('modify');
    expect(getLine(result.modifiedLines, 1).type).toBe('modify');
  });

  it('preserves duplicate JSON members and their relative order', () => {
    const result = getDiffResult(
      computeDiff('{"value":9007199254740993,"value":1}', '{"value":9007199254740995,"value":2}', {
        ...options,
        isJsonMode: true,
        diffCleanupMode: 'none',
      }),
    );

    expect(result.originalLines.map(({ content }) => content)).toEqual([
      '{',
      '  "value": 9007199254740993,',
      '  "value": 1',
      '}',
    ]);
    expect(result.modifiedLines.map(({ content }) => content)).toEqual([
      '{',
      '  "value": 9007199254740995,',
      '  "value": 2',
      '}',
    ]);
  });

  it('preserves JSON array element order while sorting object keys', () => {
    const result = getDiffResult(
      computeDiff(
        '[{"name":"first","id":1},{"name":"second","id":2}]',
        '[{"id":2,"name":"second"},{"id":1,"name":"first"}]',
        {
          ...options,
          isJsonMode: true,
          diffCleanupMode: 'none',
        },
      ),
    );

    const orderedValues = (lines: typeof result.originalLines) =>
      lines
        .filter(({ lineNumber }) => lineNumber > 0)
        .map(({ content }) => content)
        .filter((content) => content.includes('"id"') || content.includes('"name"'));

    expect(orderedValues(result.originalLines)).toEqual([
      '    "id": 1,',
      '    "name": "first"',
      '    "id": 2,',
      '    "name": "second"',
    ]);
    expect(orderedValues(result.modifiedLines)).toEqual([
      '    "id": 2,',
      '    "name": "second"',
      '    "id": 1,',
      '    "name": "first"',
    ]);
  });

  it('retains primitive token spelling during JSON comparison', () => {
    const result = getDiffResult(
      computeDiff('{"n":1}', '{"n":1.0}', { ...options, isJsonMode: true, diffCleanupMode: 'none' }),
    );

    expect(result.originalLines[1]).toMatchObject({ type: 'modify', content: '  "n": 1' });
    expect(result.modifiedLines[1]).toMatchObject({ type: 'modify', content: '  "n": 1.0' });
  });

  it('diffs sorted, formatted JSON lines when valid values differ', () => {
    const result = getDiffResult(computeDiff('{"b":2,"a":1}', '{"b":3,"a":1}', { ...options, isJsonMode: true }));

    expect(result.originalLines).toEqual([
      { lineNumber: 1, type: 'equal', content: '{' },
      { lineNumber: 2, type: 'equal', content: '  "a": 1,' },
      {
        lineNumber: 3,
        type: 'modify',
        content: '  "b": 2',
        charDiffs: [
          { type: 'equal', text: '  "b": ' },
          { type: 'delete', text: '2' },
        ],
      },
      { lineNumber: 4, type: 'equal', content: '}' },
    ]);
    expect(result.modifiedLines).toEqual([
      { lineNumber: 1, type: 'equal', content: '{' },
      { lineNumber: 2, type: 'equal', content: '  "a": 1,' },
      {
        lineNumber: 3,
        type: 'modify',
        content: '  "b": 3',
        charDiffs: [
          { type: 'equal', text: '  "b": ' },
          { type: 'insert', text: '3' },
        ],
      },
      { lineNumber: 4, type: 'equal', content: '}' },
    ]);
  });

  it.each(['original', 'modified'] as const)(
    'returns a source-specific %s JSON parse error before diffing',
    (source) => {
      const original = source === 'original' ? '{invalid' : '{}';
      const modified = source === 'modified' ? '{invalid' : '{}';
      const outcome = computeDiff(original, modified, { ...options, isJsonMode: true });

      expect(outcome).toMatchObject({ status: 'error', source });
      expect(outcome.status === 'error' ? outcome.message : '').toMatch(/position/i);
    },
  );

  it('maps line and grapheme operations into aligned results', () => {
    expect(computeDiff('same\nold\norphan\n', 'same\nother', { ...options, editCost: 9 })).toEqual({
      status: 'success',
      diffResult: {
        originalLines: [
          { lineNumber: 1, type: 'equal', content: 'same' },
          {
            lineNumber: 2,
            type: 'modify',
            content: 'old',
            charDiffs: [
              { type: 'equal', text: 'o' },
              { type: 'delete', text: 'ld' },
            ],
          },
          { lineNumber: 3, type: 'delete', content: 'orphan' },
        ],
        modifiedLines: [
          { lineNumber: 1, type: 'equal', content: 'same' },
          {
            lineNumber: 2,
            type: 'modify',
            content: 'other',
            charDiffs: [
              { type: 'equal', text: 'o' },
              { type: 'insert', text: 'ther' },
            ],
          },
          { lineNumber: -1, type: 'insert', content: '' },
        ],
        originalTrailingNewline: true,
        modifiedTrailingNewline: false,
      },
    });
  });

  it.each([
    {
      original: '',
      modified: 'Some text',
      expectedOriginal: [{ lineNumber: -1, type: 'delete', content: '' }],
      expectedModified: [{ lineNumber: 1, type: 'insert', content: 'Some text' }],
    },
    {
      original: 'Some text',
      modified: '',
      expectedOriginal: [{ lineNumber: 1, type: 'delete', content: 'Some text' }],
      expectedModified: [{ lineNumber: -1, type: 'insert', content: '' }],
    },
  ])(
    'aligns one-sided empty input for $original versus $modified',
    ({ original, modified, expectedOriginal, expectedModified }) => {
      const result = getDiffResult(computeDiff(original, modified, { ...options, diffCleanupMode: 'none' }));

      expect(result.originalLines).toEqual(expectedOriginal);
      expect(result.modifiedLines).toEqual(expectedModified);
    },
  );

  it.each([
    ['e\u0301', 'e\u0300'],
    ['👍🏻', '👍🏽'],
    ['🇬🇧', '🇺🇸'],
    ['👨‍👩‍👧‍👦', '👨‍👩‍👧'],
  ])('never splits the changed grapheme in %s versus %s', (originalGrapheme, modifiedGrapheme) => {
    const result = getDiffResult(
      computeDiff(`A${originalGrapheme}B`, `A${modifiedGrapheme}B`, {
        ...options,
        diffCleanupMode: 'none',
      }),
    );

    expect(getLine(result.originalLines, 0).charDiffs).toEqual([
      { type: 'equal', text: 'A' },
      { type: 'delete', text: originalGrapheme },
      { type: 'equal', text: 'B' },
    ]);
    expect(getLine(result.modifiedLines, 0).charDiffs).toEqual([
      { type: 'equal', text: 'A' },
      { type: 'insert', text: modifiedGrapheme },
      { type: 'equal', text: 'B' },
    ]);
  });

  it.each<{
    mode: DiffCleanupMode;
    editCost: number;
    expectedOriginal: { type: 'equal' | 'delete'; text: string }[];
    expectedModified: { type: 'equal' | 'insert'; text: string }[];
  }>([
    {
      mode: 'none',
      editCost: 4,
      expectedOriginal: [
        { type: 'equal', text: 'ab' },
        { type: 'delete', text: '12' },
        { type: 'equal', text: 'cd' },
        { type: 'delete', text: '34' },
        { type: 'equal', text: 'ef' },
      ],
      expectedModified: [
        { type: 'equal', text: 'ab' },
        { type: 'insert', text: 'XY' },
        { type: 'equal', text: 'cd' },
        { type: 'insert', text: 'ZZ' },
        { type: 'equal', text: 'ef' },
      ],
    },
    {
      mode: 'semantic',
      editCost: 4,
      expectedOriginal: [
        { type: 'equal', text: 'ab' },
        { type: 'delete', text: '12cd34' },
        { type: 'equal', text: 'ef' },
      ],
      expectedModified: [
        { type: 'equal', text: 'ab' },
        { type: 'insert', text: 'XYcdZZ' },
        { type: 'equal', text: 'ef' },
      ],
    },
    {
      mode: 'efficiency',
      editCost: 2,
      expectedOriginal: [
        { type: 'equal', text: 'ab' },
        { type: 'delete', text: '12' },
        { type: 'equal', text: 'cd' },
        { type: 'delete', text: '34' },
        { type: 'equal', text: 'ef' },
      ],
      expectedModified: [
        { type: 'equal', text: 'ab' },
        { type: 'insert', text: 'XY' },
        { type: 'equal', text: 'cd' },
        { type: 'insert', text: 'ZZ' },
        { type: 'equal', text: 'ef' },
      ],
    },
    {
      mode: 'efficiency',
      editCost: 4,
      expectedOriginal: [
        { type: 'equal', text: 'ab' },
        { type: 'delete', text: '12cd34' },
        { type: 'equal', text: 'ef' },
      ],
      expectedModified: [
        { type: 'equal', text: 'ab' },
        { type: 'insert', text: 'XYcdZZ' },
        { type: 'equal', text: 'ef' },
      ],
    },
  ])('applies $mode cleanup with edit cost $editCost', ({ mode, editCost, expectedOriginal, expectedModified }) => {
    const result = getDiffResult(
      computeDiff('ab12cd34ef', 'abXYcdZZef', { ...options, diffCleanupMode: mode, editCost }),
    );

    expect(getLine(result.originalLines, 0).charDiffs).toEqual(expectedOriginal);
    expect(getLine(result.modifiedLines, 0).charDiffs).toEqual(expectedModified);
  });

  it('keeps a former final line equal when another line is appended', () => {
    expect(computeDiff('a', 'a\nb', { ...options, diffCleanupMode: 'none' })).toEqual({
      status: 'success',
      diffResult: {
        originalLines: [
          { lineNumber: 1, type: 'equal', content: 'a' },
          { lineNumber: -1, type: 'delete', content: '' },
        ],
        modifiedLines: [
          { lineNumber: 1, type: 'equal', content: 'a' },
          { lineNumber: 2, type: 'insert', content: 'b' },
        ],
        originalTrailingNewline: false,
        modifiedTrailingNewline: false,
      },
    });
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'keeps the inherited prototype name %s equal on an unchanged final line',
    (inheritedName) => {
      const result = getDiffResult(
        computeDiff(`old\n${inheritedName}`, `new\n${inheritedName}`, { ...options, diffCleanupMode: 'none' }),
      );

      expect(result.originalLines[1]).toEqual({ lineNumber: 2, type: 'equal', content: inheritedName });
      expect(result.modifiedLines[1]).toEqual({ lineNumber: 2, type: 'equal', content: inheritedName });
    },
  );

  it.each(['line-grapheme', 'grapheme'] as const)(
    'represents a trailing-newline-only change only in the trailing-newline metadata in %s mode',
    (diffMode) => {
      expect(computeDiff('a', 'a\n', { ...options, diffMode, diffCleanupMode: 'none' })).toEqual({
        status: 'success',
        diffResult: {
          originalLines: [{ lineNumber: 1, type: 'equal', content: 'a' }],
          modifiedLines: [{ lineNumber: 1, type: 'equal', content: 'a' }],
          originalTrailingNewline: false,
          modifiedTrailingNewline: true,
        },
      });
    },
  );

  it('preserves and numbers an equal blank line adjacent to a change', () => {
    expect(computeDiff('\nold', '\nnew', { ...options, diffCleanupMode: 'none' })).toEqual({
      status: 'success',
      diffResult: {
        originalLines: [
          { lineNumber: 1, type: 'equal', content: '' },
          {
            lineNumber: 2,
            type: 'modify',
            content: 'old',
            charDiffs: [{ type: 'delete', text: 'old' }],
          },
        ],
        modifiedLines: [
          { lineNumber: 1, type: 'equal', content: '' },
          {
            lineNumber: 2,
            type: 'modify',
            content: 'new',
            charDiffs: [{ type: 'insert', text: 'new' }],
          },
        ],
        originalTrailingNewline: false,
        modifiedTrailingNewline: false,
      },
    });
  });

  it('diffs the entire content by grapheme while preserving numbered display lines', () => {
    const original = 'The quick brown fox\njumps over the lazy dog';
    const modified = 'The quick brown\nfox jumps over the lazy dog';
    const lineResult = getDiffResult(
      computeDiff(original, modified, { ...options, diffCleanupMode: 'none', diffMode: 'line-grapheme' }),
    );
    const graphemeResult = getDiffResult(
      computeDiff(original, modified, { ...options, diffCleanupMode: 'none', diffMode: 'grapheme' }),
    );

    expect(getLine(lineResult.originalLines, 0).charDiffs).toContainEqual({ type: 'delete', text: ' fox' });
    expect(graphemeResult.originalLines.map(({ lineNumber }) => lineNumber)).toEqual([1, 2]);
    expect(graphemeResult.modifiedLines.map(({ lineNumber }) => lineNumber)).toEqual([1, 2]);
    expect(getLine(graphemeResult.originalLines, 0).charDiffs).toEqual([
      { type: 'equal', text: 'The quick brown' },
      { type: 'delete', text: ' ' },
      { type: 'equal', text: 'fox' },
    ]);
    expect(getLine(graphemeResult.modifiedLines, 0).charDiffs).toEqual([{ type: 'equal', text: 'The quick brown' }]);
    expect(getLine(graphemeResult.originalLines, 1).charDiffs).toEqual([
      { type: 'equal', text: 'jumps over the lazy dog' },
    ]);
    expect(getLine(graphemeResult.modifiedLines, 1).charDiffs).toEqual([
      { type: 'equal', text: 'fox' },
      { type: 'insert', text: ' ' },
      { type: 'equal', text: 'jumps over the lazy dog' },
    ]);
  });

  it('preserves the modified-side equality boundary for deletion markers in grapheme mode', () => {
    const result = getDiffResult(
      computeDiff('abXcd', 'abcd', {
        ...options,
        diffMode: 'grapheme',
        diffCleanupMode: 'none',
      }),
    );

    expect(getLine(result.originalLines, 0).charDiffs).toEqual([
      { type: 'equal', text: 'ab' },
      { type: 'delete', text: 'X' },
      { type: 'equal', text: 'cd' },
    ]);
    expect(getLine(result.modifiedLines, 0).charDiffs).toEqual([
      { type: 'equal', text: 'ab' },
      { type: 'equal', text: 'cd' },
    ]);
  });

  it.each(['myers', 'adaptive'] as const)('supports the selectable %s algorithm in both diff modes', (algorithm) => {
    for (const diffMode of ['line-grapheme', 'grapheme'] as const) {
      const result = getDiffResult(
        computeDiff('before\nshared', 'after\nshared', {
          ...options,
          diffMode,
          diffAlgorithm: algorithm,
          diffCleanupMode: 'none',
        }),
      );

      expect(result.originalLines.map(({ lineNumber, type, content }) => ({ lineNumber, type, content }))).toEqual([
        { lineNumber: 1, type: 'modify', content: 'before' },
        { lineNumber: 2, type: 'equal', content: 'shared' },
      ]);
      expect(result.modifiedLines.map(({ lineNumber, type, content }) => ({ lineNumber, type, content }))).toEqual([
        { lineNumber: 1, type: 'modify', content: 'after' },
        { lineNumber: 2, type: 'equal', content: 'shared' },
      ]);
      expect(
        getLine(result.originalLines, 0)
          .charDiffs?.map(({ text }) => text)
          .join(''),
      ).toBe('before');
      expect(
        getLine(result.modifiedLines, 0)
          .charDiffs?.map(({ text }) => text)
          .join(''),
      ).toBe('after');
    }
  });

  it('aligns whole-content grapheme rows around shared text when a final line is removed', () => {
    const result = getDiffResult(
      computeDiff('shared\nremoved', 'shared', {
        ...options,
        diffMode: 'grapheme',
        diffCleanupMode: 'none',
      }),
    );

    expect(result.originalLines.map(({ lineNumber, type, content }) => ({ lineNumber, type, content }))).toEqual([
      { lineNumber: 1, type: 'equal', content: 'shared' },
      { lineNumber: 2, type: 'delete', content: 'removed' },
    ]);
    expect(result.modifiedLines.map(({ lineNumber, type, content }) => ({ lineNumber, type, content }))).toEqual([
      { lineNumber: 1, type: 'equal', content: 'shared' },
      { lineNumber: -1, type: 'insert', content: '' },
    ]);
  });

  it.each([
    ['', 'added'],
    ['removed', ''],
    ['one\ntwo', 'zero\none\ntwo\nthree'],
    ['one\n\nthree\n', 'one\ntwo\nthree'],
    ['a\r\nb', 'a\r\nc'],
  ])('keeps every source line and line number in grapheme mode for %j versus %j', (original, modified) => {
    const result = getDiffResult(
      computeDiff(original, modified, {
        ...options,
        diffMode: 'grapheme',
        diffCleanupMode: 'none',
      }),
    );
    const expectedLines = (text: string) => {
      if (text.length === 0) return [];
      const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
      return withoutTrailingNewline.split(/\r?\n/);
    };

    expect(
      result.originalLines
        .filter(({ lineNumber }) => lineNumber > 0)
        .map(({ lineNumber, content }) => ({ lineNumber, content })),
    ).toEqual(expectedLines(original).map((content, index) => ({ lineNumber: index + 1, content })));
    expect(
      result.modifiedLines
        .filter(({ lineNumber }) => lineNumber > 0)
        .map(({ lineNumber, content }) => ({ lineNumber, content })),
    ).toEqual(expectedLines(modified).map((content, index) => ({ lineNumber: index + 1, content })));
  });

  it('uses the prior deterministic line alignment when repeated lines have multiple shortest diffs', () => {
    const result = getDiffResult(computeDiff('a\nb\na\n', 'a\na\nb\n', { ...options, diffCleanupMode: 'none' }));

    expect(result.originalLines.map(({ type, content }) => ({ type, content }))).toEqual([
      { type: 'equal', content: 'a' },
      { type: 'delete', content: 'b' },
      { type: 'equal', content: 'a' },
      { type: 'delete', content: '' },
    ]);
    expect(result.modifiedLines.map(({ type, content }) => ({ type, content }))).toEqual([
      { type: 'equal', content: 'a' },
      { type: 'insert', content: '' },
      { type: 'equal', content: 'a' },
      { type: 'insert', content: 'b' },
    ]);
  });

  it('right-aligns an oversized whole-content grapheme hunk without dropping either side', () => {
    const original = Array.from({ length: 1_000 }, () => 'a').join('\n');
    const modified = Array.from({ length: 999 }, () => 'b').join('\r\n');
    const result = getDiffResult(
      computeDiff(original, modified, {
        ...options,
        diffMode: 'grapheme',
        diffCleanupMode: 'none',
      }),
    );

    expect(result.originalLines).toHaveLength(1_000);
    expect(result.modifiedLines).toHaveLength(1_000);
    expect(result.originalLines[0]).toEqual({ lineNumber: 1, type: 'delete', content: 'a' });
    expect(result.modifiedLines[0]).toEqual({ lineNumber: -1, type: 'insert', content: '' });
    expect(result.originalLines[1]).toEqual({
      lineNumber: 2,
      type: 'modify',
      content: 'a',
      charDiffs: [{ type: 'delete', text: 'a' }],
    });
    expect(result.modifiedLines[1]).toEqual({
      lineNumber: 1,
      type: 'modify',
      content: 'b',
      charDiffs: [{ type: 'insert', text: 'b' }],
    });
    expect(result.originalLines.at(-1)).toMatchObject({ lineNumber: 1_000, type: 'modify', content: 'a' });
    expect(result.modifiedLines.at(-1)).toMatchObject({ lineNumber: 999, type: 'modify', content: 'b' });
  });

  it('finds a changed line beyond 40,000 unique lines', () => {
    const lineCount = 40_010;
    const changedIndex = 40_005;
    const originalLines = Array.from({ length: lineCount }, (_, index) => `original line ${index}`);
    const modifiedLines = [...originalLines];
    modifiedLines[changedIndex] = `modified line ${changedIndex}`;

    const result = getDiffResult(
      computeDiff(originalLines.join('\n'), `${modifiedLines.join('\n')}\n`, {
        ...options,
        diffCleanupMode: 'none',
      }),
    );

    expect(result.originalLines).toHaveLength(lineCount);
    expect(result.modifiedLines).toHaveLength(lineCount);
    const changedOriginalLines = result.originalLines.filter((line) => line.type !== 'equal');
    const changedModifiedLines = result.modifiedLines.filter((line) => line.type !== 'equal');
    expect(changedOriginalLines).toHaveLength(1);
    expect(changedModifiedLines).toHaveLength(1);
    expect(changedOriginalLines[0]).toMatchObject({
      lineNumber: changedIndex + 1,
      type: 'modify',
      content: originalLines[changedIndex],
    });
    expect(changedModifiedLines[0]).toMatchObject({
      lineNumber: changedIndex + 1,
      type: 'modify',
      content: modifiedLines[changedIndex],
    });
    expect(
      getLine(changedOriginalLines, 0)
        .charDiffs?.map(({ text }) => text)
        .join(''),
    ).toBe(originalLines[changedIndex]);
    expect(
      getLine(changedModifiedLines, 0)
        .charDiffs?.map(({ text }) => text)
        .join(''),
    ).toBe(modifiedLines[changedIndex]);
    expect(result.originalTrailingNewline).toBe(false);
    expect(result.modifiedTrailingNewline).toBe(true);
  });
});
