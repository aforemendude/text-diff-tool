import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DiffCleanupMode } from '../types/diff';
import { computeDiff, type DiffEngineFactory } from './diffUtils';

function diff(operation: number, text: string): diff_match_patch.Diff {
  return [operation, text] as unknown as diff_match_patch.Diff;
}

function createEngineHarness(
  lineDiffs: diff_match_patch.Diff[],
  charDiffs: diff_match_patch.Diff[] = [],
  cleanup?: Partial<Record<'semantic' | 'efficiency', (diffs: diff_match_patch.Diff[]) => void>>,
) {
  let diffMainCall = 0;
  const engine: ReturnType<DiffEngineFactory> = {
    Diff_Timeout: 1,
    Diff_EditCost: 1,
    diff_linesToChars_: vi.fn(() => ({
      chars1: 'encoded-original',
      chars2: 'encoded-modified',
      lineArray: [''],
    })),
    diff_charsToLines_: vi.fn(),
    diff_main: vi.fn(() => (diffMainCall++ === 0 ? lineDiffs : charDiffs)),
    diff_cleanupSemantic: vi.fn((diffs) => cleanup?.semantic?.(diffs)),
    diff_cleanupEfficiency: vi.fn((diffs) => cleanup?.efficiency?.(diffs)),
  };
  const factory = vi.fn(() => engine);
  return { engine, factory };
}

const options = {
  isJsonMode: false,
  diffCleanupMode: 'semantic' as const,
  editCost: 4,
};

describe('computeDiff', () => {
  beforeAll(() => {
    vi.stubGlobal('DIFF_DELETE', -1);
    vi.stubGlobal('DIFF_INSERT', 1);
    vi.stubGlobal('DIFF_EQUAL', 0);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('returns identical without constructing an engine for equal raw text', () => {
    const factory = vi.fn();

    expect(computeDiff('same', 'same', options, factory)).toEqual({ status: 'identical' });
    expect(factory).not.toHaveBeenCalled();
  });

  it('normalizes JSON key order before determining semantic identity', () => {
    const factory = vi.fn();

    expect(
      computeDiff(
        '{"z": 1, "a": {"y": 2, "b": 3}}',
        '{"a":{"b":3,"y":2},"z":1}',
        {
          ...options,
          isJsonMode: true,
        },
        factory,
      ),
    ).toEqual({ status: 'identical' });
    expect(factory).not.toHaveBeenCalled();
  });

  it('warns for both source numbers when distinct unsafe integers normalize as identical', () => {
    const factory = vi.fn();

    expect(
      computeDiff('{"id":9007199254740992}', '{"id":9007199254740993}', { ...options, isJsonMode: true }, factory),
    ).toEqual({
      status: 'identical',
      warnings: [
        { source: 'original', type: 'numeric-precision', count: 1 },
        { source: 'modified', type: 'numeric-precision', count: 1 },
      ],
    });
    expect(factory).not.toHaveBeenCalled();
  });

  it('reports all four source and issue categories while retaining the current diff result', () => {
    const { factory } = createEngineHarness([diff(-1, 'old\n'), diff(1, 'new\n')]);
    const outcome = computeDiff(
      '{"value":9007199254740993,"value":1}',
      '{"value":9007199254740995,"value":2}',
      { ...options, isJsonMode: true },
      factory,
    );

    expect(outcome).toMatchObject({
      status: 'success',
      warnings: [
        { source: 'original', type: 'numeric-precision', count: 1 },
        { source: 'modified', type: 'numeric-precision', count: 1 },
        { source: 'original', type: 'duplicate-keys', count: 1 },
        { source: 'modified', type: 'duplicate-keys', count: 1 },
      ],
    });
    expect(factory).toHaveBeenCalledOnce();
  });

  it('passes exact sorted, formatted JSON to the engine when valid values differ', () => {
    const { engine, factory } = createEngineHarness([diff(-1, 'old\n'), diff(1, 'new\n')]);

    expect(computeDiff('{"b":2,"a":1}', '{"b":3,"a":1}', { ...options, isJsonMode: true }, factory)).toEqual({
      status: 'success',
      diffResult: {
        originalLines: [{ lineNumber: 1, type: 'modify', content: 'old', charDiffs: [] }],
        modifiedLines: [{ lineNumber: 1, type: 'modify', content: 'new', charDiffs: [] }],
        originalTrailingNewline: false,
        modifiedTrailingNewline: false,
      },
    });
    expect(engine.diff_linesToChars_).toHaveBeenCalledExactlyOnceWith(
      `{
  "a": 1,
  "b": 2
}`,
      `{
  "a": 1,
  "b": 3
}`,
    );
  });

  it.each(['original', 'modified'] as const)(
    'returns a source-specific %s JSON parse error before diffing',
    (source) => {
      const original = source === 'original' ? '{invalid' : '{}';
      const modified = source === 'modified' ? '{invalid' : '{}';
      const factory = vi.fn();
      const outcome = computeDiff(original, modified, { ...options, isJsonMode: true }, factory);

      expect(outcome).toMatchObject({ status: 'error', source });
      expect(outcome.status === 'error' ? outcome.message : '').toMatch(/property name|JSON|Unexpected token/i);
      expect(factory).not.toHaveBeenCalled();
    },
  );

  it('returns a parse error instead of valid-input warnings when the other source is invalid', () => {
    const factory = vi.fn();
    const outcome = computeDiff(
      '{"id":9007199254740993,"id":1}',
      '{invalid',
      { ...options, isJsonMode: true },
      factory,
    );

    expect(outcome).toMatchObject({ status: 'error', source: 'modified' });
    expect(outcome).not.toHaveProperty('warnings');
    expect(factory).not.toHaveBeenCalled();
  });

  it('maps line and character operations into aligned results and configures the engine exactly', () => {
    const lineDiffs = [diff(0, 'same\n'), diff(-1, 'old\norphan\n'), diff(1, 'other\n')];
    const charDiffs = [diff(0, 'o'), diff(-1, 'ld'), diff(1, 'ther')];
    const { engine, factory } = createEngineHarness(lineDiffs, charDiffs);

    expect(
      computeDiff(
        'same\nold\norphan\n',
        'same\nother',
        { isJsonMode: false, diffCleanupMode: 'semantic', editCost: 9 },
        factory,
      ),
    ).toEqual({
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

    expect(factory).toHaveBeenCalledOnce();
    expect(engine.Diff_Timeout).toBe(0);
    expect(engine.Diff_EditCost).toBe(9);
    expect(engine.diff_linesToChars_).toHaveBeenCalledExactlyOnceWith('same\nold\norphan\n', 'same\nother');
    expect(vi.mocked(engine.diff_main).mock.calls).toEqual([
      ['encoded-original', 'encoded-modified', false],
      ['old', 'other'],
    ]);
    expect(engine.diff_charsToLines_).toHaveBeenCalledExactlyOnceWith(lineDiffs, ['']);
    expect(engine.diff_cleanupSemantic).toHaveBeenCalledExactlyOnceWith(charDiffs);
    expect(engine.diff_cleanupEfficiency).not.toHaveBeenCalled();
  });

  it('aligns an insertion with an explicit empty original line', () => {
    const { factory } = createEngineHarness([diff(1, 'added\n')]);

    expect(computeDiff('', 'added', { ...options, diffCleanupMode: 'none' }, factory)).toEqual({
      status: 'success',
      diffResult: {
        originalLines: [{ lineNumber: -1, type: 'delete', content: '' }],
        modifiedLines: [{ lineNumber: 1, type: 'insert', content: 'added' }],
        originalTrailingNewline: false,
        modifiedTrailingNewline: false,
      },
    });
  });

  it('preserves and numbers an equal blank line adjacent to a change', () => {
    const { factory } = createEngineHarness(
      [diff(0, '\n'), diff(-1, 'old\n'), diff(1, 'new\n')],
      [diff(-1, 'old'), diff(1, 'new')],
    );

    expect(computeDiff('\nold', '\nnew', { ...options, diffCleanupMode: 'none' }, factory)).toEqual({
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

  it.each<{
    mode: DiffCleanupMode;
    expectedOriginal: { type: 'equal' | 'delete'; text: string }[];
    expectedModified: { type: 'equal' | 'insert'; text: string }[];
  }>([
    {
      mode: 'semantic',
      expectedOriginal: [{ type: 'equal', text: 'semantic' }],
      expectedModified: [{ type: 'equal', text: 'semantic' }],
    },
    {
      mode: 'efficiency',
      expectedOriginal: [{ type: 'equal', text: 'efficient' }],
      expectedModified: [{ type: 'equal', text: 'efficient' }],
    },
    {
      mode: 'none',
      expectedOriginal: [{ type: 'delete', text: 'old' }],
      expectedModified: [{ type: 'insert', text: 'new' }],
    },
  ])(
    'applies the $mode cleanup branch to the observable character result',
    ({ mode, expectedOriginal, expectedModified }) => {
      const charDiffs = [diff(-1, 'old'), diff(1, 'new')];
      const { engine, factory } = createEngineHarness([diff(-1, 'old\n'), diff(1, 'new\n')], charDiffs, {
        semantic: (diffs) => diffs.splice(0, diffs.length, diff(0, 'semantic')),
        efficiency: (diffs) => diffs.splice(0, diffs.length, diff(0, 'efficient')),
      });
      const outcome = computeDiff('old', 'new', { ...options, diffCleanupMode: mode }, factory);

      expect(outcome).toEqual({
        status: 'success',
        diffResult: {
          originalLines: [{ lineNumber: 1, type: 'modify', content: 'old', charDiffs: expectedOriginal }],
          modifiedLines: [{ lineNumber: 1, type: 'modify', content: 'new', charDiffs: expectedModified }],
          originalTrailingNewline: false,
          modifiedTrailingNewline: false,
        },
      });
      expect(engine.diff_cleanupSemantic).toHaveBeenCalledTimes(mode === 'semantic' ? 1 : 0);
      expect(engine.diff_cleanupEfficiency).toHaveBeenCalledTimes(mode === 'efficiency' ? 1 : 0);
    },
  );
});
