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
      <div className="diff-panel diff-panel--original">
        <div className="diff-panel__header">
          <h3>Original</h3>
        </div>
        <div className="diff-panel__content">
          {originalLines.map((line, index) => (
            <DiffLine key={index} line={line} side="original" />
          ))}
        </div>
      </div>
      <div className="diff-panel diff-panel--modified">
        <div className="diff-panel__header">
          <h3>Modified</h3>
        </div>
        <div className="diff-panel__content">
          {modifiedLines.map((line, index) => (
            <DiffLine key={index} line={line} side="modified" />
          ))}
        </div>
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
    if (charDiff.type === 'equal') {
      return 'char-diff';
    }
    if (charDiff.type === 'delete' && side === 'original') {
      return 'char-diff char-diff--delete';
    }
    if (charDiff.type === 'insert' && side === 'modified') {
      return 'char-diff char-diff--insert';
    }
    return 'char-diff';
  };

  return <span className={getClass()}>{charDiff.text}</span>;
}

export default CompareDisplay;
