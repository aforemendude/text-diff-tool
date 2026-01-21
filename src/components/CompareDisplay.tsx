import { DiffResult, LineDiff, CharDiff } from '../App';

interface CompareDisplayProps {
  diffResult: DiffResult | null;
}

function CompareDisplay({ diffResult }: CompareDisplayProps) {
  if (!diffResult) {
    return (
      <div className="compare-display compare-display--empty">
        <p className="compare-display__placeholder">
          Enter text in both fields and click <strong>Compare</strong> to see
          differences
        </p>
      </div>
    );
  }

  const { originalLines, modifiedLines } = diffResult;

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
        {originalLines.map((line, index) => (
          <div key={index} className="diff-row">
            <DiffLine line={line} side="original" />
            <DiffLine line={modifiedLines[index]} side="modified" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DiffLineProps {
  line: LineDiff;
  side: 'original' | 'modified';
}

function DiffLine({ line, side }: DiffLineProps) {
  const getLineClass = () => {
    const baseClass = 'diff-line';
    if (line.lineNumber === -1) {
      return `${baseClass} diff-line--empty`;
    }
    switch (line.type) {
      case 'delete':
        return `${baseClass} diff-line--delete`;
      case 'insert':
        return `${baseClass} diff-line--insert`;
      case 'modify':
        return side === 'original'
          ? `${baseClass} diff-line--modify-delete`
          : `${baseClass} diff-line--modify-insert`;
      default:
        return baseClass;
    }
  };

  const renderContent = () => {
    if (line.lineNumber === -1) {
      return <span className="diff-line__text">&nbsp;</span>;
    }

    if (line.charDiffs && line.charDiffs.length > 0) {
      return (
        <span className="diff-line__text">
          {line.charDiffs.map((charDiff, index) => (
            <CharDiffSpan key={index} charDiff={charDiff} side={side} />
          ))}
        </span>
      );
    }

    return <span className="diff-line__text">{line.content || '\u00A0'}</span>;
  };

  return (
    <div className={getLineClass()}>
      <span className="diff-line__number">
        {line.lineNumber > 0 ? line.lineNumber : ''}
      </span>
      <span className="diff-line__gutter">
        {line.type === 'delete' ||
        (line.type === 'modify' && side === 'original')
          ? '−'
          : line.type === 'insert' ||
              (line.type === 'modify' && side === 'modified')
            ? '+'
            : ''}
      </span>
      {renderContent()}
    </div>
  );
}

interface CharDiffSpanProps {
  charDiff: CharDiff;
  side: 'original' | 'modified';
}

function CharDiffSpan({ charDiff, side }: CharDiffSpanProps) {
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
