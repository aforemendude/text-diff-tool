import { useState } from 'react';
import './App.css';
import { Header, TextAreas, CompareDisplay, Modal } from './components';
import type { DiffCleanupMode, DiffResult } from './types/diff';
import { computeDiff, type ComputeDiffOutcome, type JsonWarning } from './utils/diffUtils';

type ContinuableDiffOutcome = Exclude<ComputeDiffOutcome, { status: 'error' }>;

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'error' | 'info' | 'warning';
}

const closedModalState: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  variant: 'error',
};

function createWarningMessage(warnings: JsonWarning[]): string {
  const warningLines = warnings.map((warning) => {
    const sourceLabel = warning.source === 'original' ? 'Original' : 'Modified';
    const issueLabel = warning.type === 'numeric-precision' ? 'numeric precision' : 'duplicate key';
    return `• ${sourceLabel} ${issueLabel} issues: ${warning.count}`;
  });

  return [
    'The JSON is valid, but the following issues were detected:',
    '',
    ...warningLines,
    '',
    'JSON.parse may round numeric values and keeps only the last value for a duplicate object key.',
    'Close this warning to continue the comparison with the parsed values.',
  ].join('\n');
}

function App() {
  const [originalText, setOriginalText] = useState('');
  const [modifiedText, setModifiedText] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [diffCleanupMode, setDiffCleanupMode] = useState<DiffCleanupMode>('semantic');
  const [editCost, setEditCost] = useState(4);
  const [modalState, setModalState] = useState<ModalState>(closedModalState);
  const [pendingOutcome, setPendingOutcome] = useState<ContinuableDiffOutcome | null>(null);

  const closeModal = () => {
    if (pendingOutcome) {
      setPendingOutcome(null);

      if (pendingOutcome.status === 'identical') {
        setModalState({
          isOpen: true,
          title: 'Identical Content',
          message: 'The original and modified content are exactly the same. There are no differences to display.',
          variant: 'info',
        });
      } else {
        setModalState(closedModalState);
        setDiffResult(pendingOutcome.diffResult);
        setIsCompareMode(true);
      }
      return;
    }

    setModalState(closedModalState);
  };

  const handleToggleMode = () => {
    if (!isCompareMode) {
      const outcome = computeDiff(originalText, modifiedText, { isJsonMode, diffCleanupMode, editCost });
      if (outcome.status === 'error') {
        const sourceLabel = outcome.source === 'original' ? 'Original' : 'Modified';
        setModalState({
          isOpen: true,
          title: `JSON Parse Error - ${sourceLabel} Text`,
          message: `Failed to parse the ${outcome.source} text as JSON:\n\n${outcome.message}`,
          variant: 'error',
        });
        return;
      }
      if (outcome.warnings && outcome.warnings.length > 0) {
        const issueCount = outcome.warnings.reduce((total, warning) => total + warning.count, 0);
        setPendingOutcome(outcome);
        setModalState({
          isOpen: true,
          title: `JSON Warning (${issueCount} ${issueCount === 1 ? 'Issue' : 'Issues'})`,
          message: createWarningMessage(outcome.warnings),
          variant: 'warning',
        });
        return;
      }
      if (outcome.status === 'identical') {
        setModalState({
          isOpen: true,
          title: 'Identical Content',
          message: 'The original and modified content are exactly the same. There are no differences to display.',
          variant: 'info',
        });
        return;
      }

      setDiffResult(outcome.diffResult);
    } else {
      setDiffResult(null);
    }
    setIsCompareMode(!isCompareMode);
  };

  return (
    <div className="app">
      <Header
        isCompareMode={isCompareMode}
        onToggleMode={handleToggleMode}
        isJsonMode={isJsonMode}
        onJsonModeChange={setIsJsonMode}
        diffCleanupMode={diffCleanupMode}
        onDiffCleanupModeChange={setDiffCleanupMode}
        editCost={editCost}
        onEditCostChange={setEditCost}
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
      {modalState.isOpen && (
        <Modal
          title={modalState.title}
          message={modalState.message}
          onClose={closeModal}
          variant={modalState.variant}
          actionLabel={modalState.variant === 'warning' ? 'Continue' : undefined}
        />
      )}
    </div>
  );
}

export default App;
