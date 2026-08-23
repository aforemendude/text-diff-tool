import { useState, ReactElement } from 'react';
import type { CharDiff as CharDiffValue, DiffResult, LineDiff } from '../diff/types';
import './CompareDisplay.css';

interface CompareDisplayProps {
  diffResult: DiffResult | null;
}

const CONTEXT_LINES = 3; // Number of unchanged lines to show around changes

const getCharDiffDescriptionId = (side: 'original' | 'modified', lineNumber: number, index: number) =>
  `char-diff-${side}-${lineNumber}-${index}`;

// Types for grouped display
type DisplaySection =
  | { type: 'lines'; startIndex: number; endIndex: number }
  | {
      type: 'collapsed';
      startIndex: number;
      endIndex: number;
      lineCount: number;
    };

function CompareDisplay({ diffResult }: CompareDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  if (!diffResult) {
    return (
      <main className="compare-display compare-display--empty" aria-label="Comparison results">
        <p className="compare-display__placeholder">
          Enter text in both fields and click <strong>Compare</strong> to see differences
        </p>
      </main>
    );
  }

  const { originalLines, modifiedLines, originalTrailingNewline, modifiedTrailingNewline } = diffResult;
  const trailingNewlineDiffers = originalTrailingNewline !== modifiedTrailingNewline;

  // Find which lines have changes
  const isChangedLine = (index: number): boolean => {
    const origLine = originalLines[index];
    const modLine = modifiedLines[index];
    return (
      origLine?.type !== 'equal' ||
      modLine?.type !== 'equal' ||
      origLine?.lineNumber === -1 ||
      modLine?.lineNumber === -1
    );
  };

  // Build sections for display
  const buildSections = (): DisplaySection[] => {
    const sections: DisplaySection[] = [];
    const totalLines = originalLines.length;

    // Mark lines that should be visible (changed or within context)
    const visibleLines = new Set<number>();
    for (let i = 0; i < totalLines; i++) {
      if (isChangedLine(i)) {
        // Add this line and context around it
        for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(totalLines - 1, i + CONTEXT_LINES); j++) {
          visibleLines.add(j);
        }
      }
    }

    // Treat the trailing-newline indicator as a change immediately after the last content line so it receives the same
    // preceding context as an ordinary changed line.
    if (trailingNewlineDiffers) {
      for (let i = Math.max(0, totalLines - CONTEXT_LINES); i < totalLines; i++) {
        visibleLines.add(i);
      }
    }

    let i = 0;
    while (i < totalLines) {
      if (visibleLines.has(i)) {
        // Start of visible section
        const startIndex = i;
        while (i < totalLines && visibleLines.has(i)) {
          i++;
        }
        sections.push({ type: 'lines', startIndex, endIndex: i - 1 });
      } else {
        // Start of collapsed section
        const startIndex = i;
        while (i < totalLines && !visibleLines.has(i)) {
          i++;
        }
        const endIndex = i - 1;
        const lineCount = endIndex - startIndex + 1;
        sections.push({ type: 'collapsed', startIndex, endIndex, lineCount });
      }
    }

    return sections;
  };

  const sections = buildSections();

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  return (
    <main className="compare-display" aria-label="Comparison results">
      <div className="compare-display__table" role="table" aria-label="Original and modified text comparison">
        <div className="compare-display__header" role="row">
          <div className="compare-display__header-cell" role="columnheader" aria-colindex={1}>
            <h2>Original</h2>
          </div>
          <div className="compare-display__header-cell" role="columnheader" aria-colindex={2}>
            <h2>Modified</h2>
          </div>
        </div>
        <div className="compare-display__content" role="rowgroup" tabIndex={0}>
          {sections.map((section) => {
            const sectionKey = `${section.startIndex}-${section.endIndex}`;
            const sectionContentId = `unchanged-lines-${sectionKey}`;
            const isExpanded = expandedSections.has(sectionKey);

            if (section.type === 'collapsed') {
              const lines: ReactElement[] = [];
              if (isExpanded) {
                for (let idx = section.startIndex; idx <= section.endIndex; idx++) {
                  lines.push(
                    <div key={idx} className="compare-display__row" role="row">
                      <DiffLine line={originalLines[idx]} side="original" />
                      <DiffLine line={modifiedLines[idx]} side="modified" />
                    </div>,
                  );
                }
              }

              return (
                <div
                  key={sectionKey}
                  className={isExpanded ? 'compare-display__expanded-section' : undefined}
                  role="presentation"
                >
                  <div className="compare-display__collapsed-row" role="row">
                    <div className="compare-display__collapsed-cell" role="cell" aria-colspan={2}>
                      <button
                        type="button"
                        className={
                          isExpanded
                            ? 'compare-display__collapsed compare-display__collapsed--expanded'
                            : 'compare-display__collapsed'
                        }
                        aria-expanded={isExpanded}
                        aria-controls={sectionContentId}
                        onClick={() => toggleSection(sectionKey)}
                      >
                        <span className="compare-display__collapsed-icon" aria-hidden="true">
                          {isExpanded ? '⊖' : '⊕'}
                        </span>
                        <span className="compare-display__collapsed-text">
                          {isExpanded ? 'Collapse ' : ''}
                          {section.lineCount} unchanged {section.lineCount === 1 ? 'line' : 'lines'}
                          {isExpanded ? '' : ' hidden'}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div id={sectionContentId} role="presentation" hidden={!isExpanded}>
                    {lines}
                  </div>
                </div>
              );
            }

            const lines: ReactElement[] = [];
            for (let idx = section.startIndex; idx <= section.endIndex; idx++) {
              lines.push(
                <div key={idx} className="compare-display__row" role="row">
                  <DiffLine line={originalLines[idx]} side="original" />
                  <DiffLine line={modifiedLines[idx]} side="modified" />
                </div>,
              );
            }

            return (
              <div key={sectionKey} role="presentation">
                {lines}
              </div>
            );
          })}
          {trailingNewlineDiffers && (
            <div className="compare-display__row compare-display__row--trailing-newline" role="row">
              <div
                className={`compare-display__trailing-newline ${
                  originalTrailingNewline
                    ? 'compare-display__trailing-newline--present'
                    : 'compare-display__trailing-newline--absent'
                }`}
                role="cell"
                aria-colindex={1}
              >
                <span className="compare-display__trailing-newline-number" aria-hidden="true"></span>
                <span className="compare-display__trailing-newline-text">
                  {originalTrailingNewline ? <>New line at end of text</> : <>No new line at end of text</>}
                </span>
              </div>
              <div
                className={`compare-display__trailing-newline ${
                  modifiedTrailingNewline
                    ? 'compare-display__trailing-newline--present'
                    : 'compare-display__trailing-newline--absent'
                }`}
                role="cell"
                aria-colindex={2}
              >
                <span className="compare-display__trailing-newline-number" aria-hidden="true"></span>
                <span className="compare-display__trailing-newline-text">
                  {modifiedTrailingNewline ? <>New line at end of text</> : <>No new line at end of text</>}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div hidden>
        {originalLines.flatMap((line) =>
          line.charDiffs?.map((charDiff, index) =>
            charDiff.type === 'delete' ? (
              <span
                key={getCharDiffDescriptionId('original', line.lineNumber, index)}
                id={getCharDiffDescriptionId('original', line.lineNumber, index)}
              >
                Deleted text
              </span>
            ) : null,
          ),
        )}
        {modifiedLines.flatMap((line) =>
          line.charDiffs?.map((charDiff, index) =>
            charDiff.type === 'insert' ? (
              <span
                key={getCharDiffDescriptionId('modified', line.lineNumber, index)}
                id={getCharDiffDescriptionId('modified', line.lineNumber, index)}
              >
                Inserted text
              </span>
            ) : null,
          ),
        )}
      </div>
    </main>
  );
}

interface DiffLineProps {
  line: LineDiff;
  side: 'original' | 'modified';
}

function DiffLine({ line, side }: DiffLineProps) {
  const isDelete = line.type === 'delete' || (line.type === 'modify' && side === 'original');
  const isInsert = line.type === 'insert' || (line.type === 'modify' && side === 'modified');
  const isEmpty = line.lineNumber <= 0;

  const getLineClass = () => {
    const baseClass = 'diff-line';

    if (isEmpty) return `${baseClass} diff-line--empty`;
    if (isDelete) return `${baseClass} diff-line--delete`;
    if (isInsert) return `${baseClass} diff-line--insert`;

    return baseClass;
  };

  const getGutterContent = () => {
    if (isEmpty) return '';
    if (isDelete) return '−';
    if (isInsert) return '+';
    return '';
  };

  const getStatusText = () => {
    if (line.type === 'delete') return 'Deleted line. ';
    if (line.type === 'insert') return 'Inserted line. ';
    if (line.type === 'modify') return 'Changed line. ';
    return '';
  };

  const renderContent = () => {
    if (line.lineNumber <= 0) {
      return (
        <span className="diff-line__text">
          <span aria-hidden="true">&nbsp;</span>
          <span className="visually-hidden">No corresponding line.</span>
        </span>
      );
    }

    if (line.charDiffs && line.charDiffs.length > 0) {
      return (
        <span className="diff-line__text">
          {line.charDiffs.map((charDiff, index) => (
            <CharDiff
              key={index}
              charDiff={charDiff}
              side={side}
              descriptionId={getCharDiffDescriptionId(side, line.lineNumber, index)}
            />
          ))}
        </span>
      );
    }

    return <span className="diff-line__text">{line.content || '\u00A0'}</span>;
  };

  return (
    <div className={getLineClass()} role="cell" aria-colindex={side === 'original' ? 1 : 2}>
      <span className="diff-line__number" aria-hidden="true">
        {line.lineNumber > 0 ? line.lineNumber : ''}
      </span>
      {line.lineNumber > 0 && <span className="visually-hidden">Line {line.lineNumber}. </span>}
      <span className="diff-line__gutter" aria-hidden="true">
        {getGutterContent()}
      </span>
      {!isEmpty && getStatusText() && <span className="visually-hidden">{getStatusText()}</span>}
      {renderContent()}
    </div>
  );
}

interface CharDiffProps {
  charDiff: CharDiffValue;
  side: 'original' | 'modified';
  descriptionId: string;
}

function CharDiff({ charDiff, side, descriptionId }: CharDiffProps) {
  if (charDiff.type === 'delete' && side === 'original') {
    return (
      <del className="char-diff char-diff--delete" aria-describedby={descriptionId}>
        {charDiff.text}
      </del>
    );
  }

  if (charDiff.type === 'insert' && side === 'modified') {
    return (
      <ins className="char-diff char-diff--insert" aria-describedby={descriptionId}>
        {charDiff.text}
      </ins>
    );
  }

  if (charDiff.type === 'equal' && side === 'original') {
    return <span className="char-diff char-diff--equal char-diff--insert-marker">{charDiff.text}</span>;
  }

  if (charDiff.type === 'equal' && side === 'modified') {
    return <span className="char-diff char-diff--equal char-diff--delete-marker">{charDiff.text}</span>;
  }

  throw new Error('Invalid charDiff type');
}

export default CompareDisplay;
