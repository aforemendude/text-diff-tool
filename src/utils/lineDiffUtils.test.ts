import { describe, expect, it } from 'vitest';
import { diffLines } from './lineDiffUtils';

describe('diffLines', () => {
  it('returns no edits for empty or identical input', () => {
    expect(diffLines('', '')).toEqual([]);
    expect(diffLines('alpha\nbeta', 'alpha\nbeta')).toEqual([{ operation: 0, lines: ['alpha\n', 'beta'] }]);
  });

  it('returns the complete non-empty input as a single insertion or deletion', () => {
    expect(diffLines('', 'added')).toEqual([{ operation: 1, lines: ['added'] }]);
    expect(diffLines('removed\n', '')).toEqual([{ operation: -1, lines: ['removed\n'] }]);
  });

  it('splits only after LF while preserving CRLF and unterminated final lines', () => {
    expect(diffLines('same\r\nbefore', 'same\r\nafter\n')).toEqual([
      { operation: 0, lines: ['same\r\n'] },
      { operation: -1, lines: ['before'] },
      { operation: 1, lines: ['after\n'] },
    ]);
  });

  it('retains a contained sequence between the surrounding deletions', () => {
    expect(diffLines('first\nkept\nlast\n', 'kept\n')).toEqual([
      { operation: -1, lines: ['first\n'] },
      { operation: 0, lines: ['kept\n'] },
      { operation: -1, lines: ['last\n'] },
    ]);
  });

  it('uses deterministic alignment when repeated lines admit multiple shortest diffs', () => {
    expect(diffLines('a\nb\na\n', 'a\na\nb\n')).toEqual([
      { operation: 0, lines: ['a\n'] },
      { operation: -1, lines: ['b\n'] },
      { operation: 0, lines: ['a\n'] },
      { operation: 1, lines: ['b\n'] },
    ]);
  });

  it('treats object-prototype property names as ordinary line values', () => {
    expect(diffLines('__proto__\ntoString\n', 'toString\n__proto__\n')).toEqual([
      { operation: -1, lines: ['__proto__\n'] },
      { operation: 0, lines: ['toString\n'] },
      { operation: 1, lines: ['__proto__\n'] },
    ]);
  });

  it('diffs unique lines beyond the former UTF-16 encoding limit', () => {
    const lineCount = 65_540;
    const changedIndex = 65_537;
    const originalLines = Array.from({ length: lineCount }, (_, index) => `line ${index}`);
    const modifiedLines = [...originalLines];
    modifiedLines[changedIndex] = `changed line ${changedIndex}`;

    const result = diffLines(`${originalLines.join('\n')}\n`, `${modifiedLines.join('\n')}\n`);

    expect(result.map(({ operation }) => operation)).toEqual([0, -1, 1, 0]);
    expect(result[0].lines).toHaveLength(changedIndex);
    expect(result[0].lines[0]).toBe('line 0\n');
    expect(result[0].lines.at(-1)).toBe(`line ${changedIndex - 1}\n`);
    expect(result[1]).toEqual({ operation: -1, lines: [`line ${changedIndex}\n`] });
    expect(result[2]).toEqual({ operation: 1, lines: [`changed line ${changedIndex}\n`] });
    expect(result[3]).toEqual({
      operation: 0,
      lines: [`line ${changedIndex + 1}\n`, `line ${changedIndex + 2}\n`],
    });
  });
});
