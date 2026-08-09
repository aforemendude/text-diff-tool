import { useState, ReactElement } from 'react';
import './CompareDisplay.css';
import type { CharDiff as CharDiffValue, DiffResult, LineDiff } from '../types/diff';

interface CompareDisplayProps {
  diffResult: DiffResult | null;
}

const CONTEXT_LINES = 3; // Number of unchanged lines to show around changes

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
      <div className="compare-display compare-display--empty">
        <p className="compare-display__placeholder">
          Enter text in both fields and click <strong>Compare</strong> to see differences
        </p>
      </div>
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
    <div className="compare-display">
      <div className="compare-display__header">
        <div className="compare-display__header-cell">
          <h3>Original</h3>
        </div>
        <div className="compare-display__header-cell">
          <h3>Modified</h3>
        </div>
      </div>
      <div className="compare-display__content">
        {sections.map((section) => {
          const sectionKey = `${section.startIndex}-${section.endIndex}`;

          if (section.type === 'collapsed' && !expandedSections.has(sectionKey)) {
            return (
              <div key={sectionKey} className="compare-display__collapsed" onClick={() => toggleSection(sectionKey)}>
                <span className="compare-display__collapsed-icon">⊕</span>
                <span className="compare-display__collapsed-text">
                  {section.lineCount} unchanged {section.lineCount === 1 ? 'line' : 'lines'} hidden
                </span>
              </div>
            );
          }

          // Render lines (either regular section or expanded collapsed section)
          const lines: ReactElement[] = [];
          for (let idx = section.startIndex; idx <= section.endIndex; idx++) {
            lines.push(
              <div key={idx} className="compare-display__row">
                <DiffLine line={originalLines[idx]} side="original" />
                <DiffLine line={modifiedLines[idx]} side="modified" />
              </div>,
            );
          }

          // If this was a collapsed section that's now expanded, wrap with collapse button
          if (section.type === 'collapsed') {
            return (
              <div key={sectionKey} className="compare-display__expanded-section">
                <div
                  className="compare-display__collapsed compare-display__collapsed--expanded"
                  onClick={() => toggleSection(sectionKey)}
                >
                  <span className="compare-display__collapsed-icon">⊖</span>
                  <span className="compare-display__collapsed-text">
                    Collapse {section.lineCount} unchanged {section.lineCount === 1 ? 'line' : 'lines'}
                  </span>
                </div>
                {lines}
              </div>
            );
          }

          return <div key={sectionKey}>{lines}</div>;
        })}
        {trailingNewlineDiffers && (
          <div className="compare-display__row compare-display__row--trailing-newline">
            <div
              className={`compare-display__trailing-newline ${
                originalTrailingNewline
                  ? 'compare-display__trailing-newline--present'
                  : 'compare-display__trailing-newline--absent'
              }`}
            >
              <span className="compare-display__trailing-newline-number"></span>
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
            >
              <span className="compare-display__trailing-newline-number"></span>
              <span className="compare-display__trailing-newline-text">
                {modifiedTrailingNewline ? <>New line at end of text</> : <>No new line at end of text</>}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
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

  const renderContent = () => {
    if (line.lineNumber <= 0) {
      return <span className="diff-line__text">&nbsp;</span>;
    }

    if (line.charDiffs && line.charDiffs.length > 0) {
      return (
        <span className="diff-line__text">
          {line.charDiffs.map((charDiff, index) => (
            <CharDiff key={index} charDiff={charDiff} side={side} />
          ))}
        </span>
      );
    }

    return <span className="diff-line__text">{line.content || '\u00A0'}</span>;
  };

  return (
    <div className={getLineClass()}>
      <span className="diff-line__number">{line.lineNumber > 0 ? line.lineNumber : ''}</span>
      <span className="diff-line__gutter">{getGutterContent()}</span>
      {renderContent()}
    </div>
  );
}

interface CharDiffProps {
  charDiff: CharDiffValue;
  side: 'original' | 'modified';
}

function CharDiff({ charDiff, side }: CharDiffProps) {
  const getClass = () => {
    if (charDiff.type === 'delete' && side === 'original') {
      return 'char-diff char-diff--delete';
    }
    if (charDiff.type === 'insert' && side === 'modified') {
      return 'char-diff char-diff--insert';
    }
    // Markers on opposite side
    if (charDiff.type === 'equal' && side === 'original') {
      return 'char-diff char-diff--equal char-diff--insert-marker';
    }
    if (charDiff.type === 'equal' && side === 'modified') {
      return 'char-diff char-diff--equal char-diff--delete-marker';
    }
    throw new Error('Invalid charDiff type');
  };

  return <span className={getClass()}>{charDiff.text}</span>;
}

export default CompareDisplay;
