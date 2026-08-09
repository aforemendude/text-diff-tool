import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findElement } from '../test/reactElements';
import type { DiffResult, LineDiff } from '../types/diff';
import CompareDisplay from './CompareDisplay';

const reactMocks = vi.hoisted(() => ({ useState: vi.fn() }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: reactMocks.useState,
}));

function result(
  originalLines: LineDiff[],
  modifiedLines: LineDiff[],
  originalTrailingNewline = false,
  modifiedTrailingNewline = false,
): DiffResult {
  return { originalLines, modifiedLines, originalTrailingNewline, modifiedTrailingNewline };
}

function equalLines(count: number): LineDiff[] {
  return Array.from({ length: count }, (_, index) => ({
    lineNumber: index + 1,
    type: 'equal' as const,
    content: `line ${index + 1}`,
  }));
}

function configureExpandedSections(expandedSections = new Set<string>()) {
  const setter = vi.fn();
  reactMocks.useState.mockReturnValue([expandedSections, setter]);
  return setter;
}

function classes(markup: string, baseClass: string): string[] {
  const expression = new RegExp(`class="(${baseClass}(?: [^"]+)?)"`, 'g');
  return [...markup.matchAll(expression)].map((match) => match[1]);
}

describe('CompareDisplay', () => {
  beforeEach(() => {
    reactMocks.useState.mockReset();
    configureExpandedSections();
  });

  it('renders the exact empty-state contract for a null result', () => {
    expect(renderToStaticMarkup(<CompareDisplay diffResult={null} />)).toBe(
      '<div class="compare-display compare-display--empty"><p class="compare-display__placeholder">Enter text in both fields and click <strong>Compare</strong> to see differences</p></div>',
    );
  });

  it('renders delete, insert, empty, and equal line contracts with exact gutters and numbers', () => {
    const markup = renderToStaticMarkup(
      <CompareDisplay
        diffResult={result(
          [
            { lineNumber: 1, type: 'delete', content: 'removed' },
            { lineNumber: -1, type: 'delete', content: '' },
            { lineNumber: 2, type: 'equal', content: 'shared' },
          ],
          [
            { lineNumber: -1, type: 'insert', content: '' },
            { lineNumber: 1, type: 'insert', content: 'added' },
            { lineNumber: 2, type: 'equal', content: 'shared' },
          ],
        )}
      />,
    );

    expect(classes(markup, 'diff-line')).toEqual([
      'diff-line diff-line--delete',
      'diff-line diff-line--empty',
      'diff-line diff-line--empty',
      'diff-line diff-line--insert',
      'diff-line',
      'diff-line',
    ]);
    expect([...markup.matchAll(/class="diff-line__number">([^<]*)/g)].map((match) => match[1])).toEqual([
      '1',
      '',
      '',
      '1',
      '2',
      '2',
    ]);
    expect([...markup.matchAll(/class="diff-line__gutter">([^<]*)/g)].map((match) => match[1])).toEqual([
      '−',
      '',
      '',
      '+',
      '',
      '',
    ]);
    expect([...markup.matchAll(/class="diff-line__text">([^<]*)/g)].map((match) => match[1])).toEqual([
      'removed',
      '\u00A0',
      '\u00A0',
      'added',
      'shared',
      'shared',
    ]);
  });

  it('renders paired modifications with exact character-diff classes on each side', () => {
    const markup = renderToStaticMarkup(
      <CompareDisplay
        diffResult={result(
          [
            {
              lineNumber: 1,
              type: 'modify',
              content: 'old',
              charDiffs: [
                { type: 'equal', text: 'o' },
                { type: 'delete', text: 'ld' },
              ],
            },
          ],
          [
            {
              lineNumber: 1,
              type: 'modify',
              content: 'other',
              charDiffs: [
                { type: 'equal', text: 'o' },
                { type: 'insert', text: 'ther' },
              ],
            },
          ],
        )}
      />,
    );

    expect(classes(markup, 'diff-line')).toEqual(['diff-line diff-line--delete', 'diff-line diff-line--insert']);
    expect(classes(markup, 'char-diff')).toEqual([
      'char-diff char-diff--equal char-diff--insert-marker',
      'char-diff char-diff--delete',
      'char-diff char-diff--equal char-diff--delete-marker',
      'char-diff char-diff--insert',
    ]);
    expect([...markup.matchAll(/class="char-diff[^"]*">([^<]*)/g)].map((match) => match[1])).toEqual([
      'o',
      'ld',
      'o',
      'ther',
    ]);
  });

  it.each([
    [1, '1 unchanged line hidden'],
    [8, '8 unchanged lines hidden'],
  ])('collapses %i unchanged lines with the exact singular/plural label', (lineCount, label) => {
    const lines = equalLines(lineCount);
    const markup = renderToStaticMarkup(<CompareDisplay diffResult={result(lines, lines)} />);

    expect(classes(markup, 'compare-display__collapsed')).toEqual(['compare-display__collapsed']);
    expect([...markup.matchAll(/class="compare-display__collapsed-text">([^<]*)/g)].map((match) => match[1])).toEqual([
      label,
    ]);
  });

  it('renders exactly three context lines around a middle change and collapses both remainders', () => {
    const originalLines = equalLines(11);
    const modifiedLines = equalLines(11);
    originalLines[5] = { lineNumber: 6, type: 'delete', content: 'old line 6' };
    modifiedLines[5] = { lineNumber: 6, type: 'insert', content: 'new line 6' };

    const markup = renderToStaticMarkup(<CompareDisplay diffResult={result(originalLines, modifiedLines)} />);

    expect([...markup.matchAll(/class="compare-display__collapsed-text">([^<]*)/g)].map((match) => match[1])).toEqual([
      '2 unchanged lines hidden',
      '2 unchanged lines hidden',
    ]);
    expect(classes(markup, 'compare-display__row')).toHaveLength(7);
    expect([...markup.matchAll(/class="diff-line__number">([^<]*)/g)].map((match) => match[1])).toEqual([
      '3',
      '3',
      '4',
      '4',
      '5',
      '5',
      '6',
      '6',
      '7',
      '7',
      '8',
      '8',
      '9',
      '9',
    ]);
    expect([...markup.matchAll(/class="diff-line__text">([^<]*)/g)].map((match) => match[1])).toEqual([
      'line 3',
      'line 3',
      'line 4',
      'line 4',
      'line 5',
      'line 5',
      'old line 6',
      'new line 6',
      'line 7',
      'line 7',
      'line 8',
      'line 8',
      'line 9',
      'line 9',
    ]);
  });

  it('adds and removes only the clicked collapsed-section key without mutating prior state', () => {
    const lines = equalLines(8);
    const diffResult = result(lines, lines);
    const addSection = configureExpandedSections();
    const collapsedTree = CompareDisplay({ diffResult });
    const collapsed = findElement(collapsedTree, (element) => element.props.className === 'compare-display__collapsed');

    (collapsed.props.onClick as () => void)();
    const addUpdater = addSection.mock.calls[0][0] as (previous: Set<string>) => Set<string>;
    const empty = new Set<string>();
    expect(addUpdater(empty)).toEqual(new Set(['0-7']));
    expect(empty).toEqual(new Set());

    const removeSection = configureExpandedSections(new Set(['0-7']));
    const expandedTree = CompareDisplay({ diffResult });
    const expanded = findElement(
      expandedTree,
      (element) => element.props.className === 'compare-display__collapsed compare-display__collapsed--expanded',
    );
    const expandedMarkup = renderToStaticMarkup(<CompareDisplay diffResult={diffResult} />);
    expect(classes(expandedMarkup, 'compare-display__collapsed')).toEqual([
      'compare-display__collapsed compare-display__collapsed--expanded',
    ]);
    expect(
      [...expandedMarkup.matchAll(/class="compare-display__collapsed-text">([^<]*)/g)].map((match) => match[1]),
    ).toEqual(['Collapse 8 unchanged lines']);
    expect(classes(expandedMarkup, 'compare-display__row')).toHaveLength(8);
    expect([...expandedMarkup.matchAll(/class="diff-line__text">([^<]*)/g)].map((match) => match[1])).toEqual([
      'line 1',
      'line 1',
      'line 2',
      'line 2',
      'line 3',
      'line 3',
      'line 4',
      'line 4',
      'line 5',
      'line 5',
      'line 6',
      'line 6',
      'line 7',
      'line 7',
      'line 8',
      'line 8',
    ]);
    (expanded.props.onClick as () => void)();
    const removeUpdater = removeSection.mock.calls[0][0] as (previous: Set<string>) => Set<string>;
    const current = new Set(['0-7']);
    expect(removeUpdater(current)).toEqual(new Set());
    expect(current).toEqual(new Set(['0-7']));
  });

  it('renders exact trailing-newline outcomes only when the sides differ', () => {
    const lines = equalLines(1);
    const presentOriginal = renderToStaticMarkup(<CompareDisplay diffResult={result(lines, lines, true, false)} />);
    expect(classes(presentOriginal, 'compare-display__trailing-newline')).toEqual([
      'compare-display__trailing-newline compare-display__trailing-newline--present',
      'compare-display__trailing-newline compare-display__trailing-newline--absent',
    ]);
    expect(
      [...presentOriginal.matchAll(/class="compare-display__trailing-newline-text">([^<]*)/g)].map((match) => match[1]),
    ).toEqual(['New line at end of text', 'No new line at end of text']);

    const presentModified = renderToStaticMarkup(<CompareDisplay diffResult={result(lines, lines, false, true)} />);
    expect(classes(presentModified, 'compare-display__trailing-newline')).toEqual([
      'compare-display__trailing-newline compare-display__trailing-newline--absent',
      'compare-display__trailing-newline compare-display__trailing-newline--present',
    ]);
    expect(
      [...presentModified.matchAll(/class="compare-display__trailing-newline-text">([^<]*)/g)].map((match) => match[1]),
    ).toEqual(['No new line at end of text', 'New line at end of text']);

    const equalTrailingState = renderToStaticMarkup(<CompareDisplay diffResult={result(lines, lines, true, true)} />);
    expect(classes(equalTrailingState, 'compare-display__trailing-newline')).toEqual([]);
  });

  it('shows three preceding context lines for a trailing-newline-only change', () => {
    const lines = equalLines(5);
    const markup = renderToStaticMarkup(<CompareDisplay diffResult={result(lines, lines, false, true)} />);

    expect([...markup.matchAll(/class="compare-display__collapsed-text">([^<]*)/g)].map((match) => match[1])).toEqual([
      '2 unchanged lines hidden',
    ]);
    expect([...markup.matchAll(/class="diff-line__number">([^<]*)/g)].map((match) => match[1])).toEqual([
      '3',
      '3',
      '4',
      '4',
      '5',
      '5',
    ]);
    expect(classes(markup, 'compare-display__row')).toHaveLength(4);
  });

  it('rejects an impossible character-diff side combination', () => {
    const invalid: LineDiff = {
      lineNumber: 1,
      type: 'modify',
      content: 'invalid',
      charDiffs: [{ type: 'insert', text: 'invalid' }],
    };

    expect(() =>
      renderToStaticMarkup(
        <CompareDisplay diffResult={result([invalid], [{ lineNumber: 1, type: 'equal', content: 'valid' }])} />,
      ),
    ).toThrow('Invalid charDiff type');
  });
});
