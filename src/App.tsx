import { useState } from 'react';
import './App.css';
import { Header, TextAreas, CompareDisplay, Modal } from './components';

export interface DiffResult {
  originalLines: LineDiff[];
  modifiedLines: LineDiff[];
}

export interface LineDiff {
  lineNumber: number;
  type: 'equal' | 'delete' | 'insert' | 'modify';
  content: string;
  charDiffs?: CharDiff[];
}

export interface CharDiff {
  type: 'equal' | 'delete' | 'insert';
  text: string;
}

interface ErrorModalState {
  isOpen: boolean;
  title: string;
  message: string;
}

// Recursively sort all keys in a JSON value
function sortJsonKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const key of keys) {
    sortedObj[key] = sortJsonKeys((value as Record<string, unknown>)[key]);
  }
  return sortedObj;
}

function App() {
  const [originalText, setOriginalText] = useState('');
  const [modifiedText, setModifiedText] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    isOpen: false,
    title: '',
    message: '',
  });

  const closeErrorModal = () => {
    setErrorModal({ isOpen: false, title: '', message: '' });
  };

  const handleToggleMode = () => {
    if (!isCompareMode) {
      // Switching to compare mode - compute diff
      const success = computeDiff();
      if (!success) {
        return; // Don't switch to compare mode if JSON parsing failed
      }
    } else {
      // Switching back to edit mode
      setDiffResult(null);
    }
    setIsCompareMode(!isCompareMode);
  };

  // Returns true if diff was computed successfully, false if there was an error
  const computeDiff = (): boolean => {
    let textToCompareOriginal = originalText;
    let textToCompareModified = modifiedText;

    // If JSON mode is enabled, parse, sort keys, and re-stringify
    if (isJsonMode) {
      try {
        const parsedOriginal = JSON.parse(originalText);
        textToCompareOriginal = JSON.stringify(
          sortJsonKeys(parsedOriginal),
          null,
          2,
        );
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setErrorModal({
          isOpen: true,
          title: 'JSON Parse Error - Original Text',
          message: `Failed to parse the original text as JSON:\n\n${errorMessage}`,
        });
        return false;
      }

      try {
        const parsedModified = JSON.parse(modifiedText);
        textToCompareModified = JSON.stringify(
          sortJsonKeys(parsedModified),
          null,
          2,
        );
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setErrorModal({
          isOpen: true,
          title: 'JSON Parse Error - Modified Text',
          message: `Failed to parse the modified text as JSON:\n\n${errorMessage}`,
        });
        return false;
      }
    }

    const dmp = new diff_match_patch();

    const originalLines = textToCompareOriginal.split('\n');
    const modifiedLines = textToCompareModified.split('\n');

    // Compute line-by-line diff
    const lineText1 = originalLines.join('\n');
    const lineText2 = modifiedLines.join('\n');

    const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(
      lineText1,
      lineText2,
    );
    const lineDiffs = dmp.diff_main(chars1, chars2, false);
    dmp.diff_charsToLines_(lineDiffs, lineArray);

    // Process diffs into structured format
    const resultOriginal: LineDiff[] = [];
    const resultModified: LineDiff[] = [];

    let origLineNum = 1;
    let modLineNum = 1;

    for (const diff of lineDiffs) {
      const op = diff[0];
      const text = diff[1];
      const lines = text
        .split('\n')
        .filter((_, i, arr) => i < arr.length - 1 || _ !== '');

      if (op === DIFF_EQUAL) {
        for (const line of lines) {
          if (line !== '' || text.includes('\n')) {
            resultOriginal.push({
              lineNumber: origLineNum++,
              type: 'equal',
              content: line,
            });
            resultModified.push({
              lineNumber: modLineNum++,
              type: 'equal',
              content: line,
            });
          }
        }
      } else if (op === DIFF_DELETE) {
        for (const line of lines) {
          resultOriginal.push({
            lineNumber: origLineNum++,
            type: 'delete',
            content: line,
          });
        }
      } else if (op === DIFF_INSERT) {
        for (const line of lines) {
          resultModified.push({
            lineNumber: modLineNum++,
            type: 'insert',
            content: line,
          });
        }
      }
    }

    // Find modified lines (deletions followed by insertions) and compute char diffs
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
        // Compute character-level diff
        const charDiffs = dmp.diff_main(origLine.content, modLine.content);
        dmp.diff_cleanupSemantic(charDiffs);

        const origCharDiffs: CharDiff[] = [];
        const modCharDiffs: CharDiff[] = [];

        for (const cd of charDiffs) {
          const cdOp = cd[0];
          const cdText = cd[1];
          if (cdOp === DIFF_EQUAL) {
            origCharDiffs.push({ type: 'equal', text: cdText });
            modCharDiffs.push({ type: 'equal', text: cdText });
          } else if (cdOp === DIFF_DELETE) {
            origCharDiffs.push({ type: 'delete', text: cdText });
          } else if (cdOp === DIFF_INSERT) {
            modCharDiffs.push({ type: 'insert', text: cdText });
          }
        }

        processedOriginal.push({
          ...origLine,
          type: 'modify',
          charDiffs: origCharDiffs,
        });
        processedModified.push({
          ...modLine,
          type: 'modify',
          charDiffs: modCharDiffs,
        });
        origIdx++;
        modIdx++;
      } else if (origLine?.type === 'delete') {
        processedOriginal.push(origLine);
        processedModified.push({
          lineNumber: -1,
          type: 'insert',
          content: '',
        });
        origIdx++;
      } else if (modLine?.type === 'insert') {
        processedOriginal.push({
          lineNumber: -1,
          type: 'delete',
          content: '',
        });
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

    setDiffResult({
      originalLines: processedOriginal,
      modifiedLines: processedModified,
    });

    return true;
  };

  return (
    <div className="layout">
      <Header
        isCompareMode={isCompareMode}
        onToggleMode={handleToggleMode}
        isJsonMode={isJsonMode}
        onJsonModeChange={setIsJsonMode}
      />
      {!isCompareMode && (
        <TextAreas
          originalText={originalText}
          modifiedText={modifiedText}
          onOriginalChange={setOriginalText}
          onModifiedChange={setModifiedText}
        />
      )}
      {isCompareMode && <CompareDisplay diffResult={diffResult} />}
      {errorModal.isOpen && (
        <Modal
          title={errorModal.title}
          message={errorModal.message}
          onClose={closeErrorModal}
        />
      )}
    </div>
  );
}

export default App;
