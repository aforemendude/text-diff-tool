import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Header, TextAreas, CompareDisplay, Modal, ProcessingModal } from './components';
import type { DiffCleanupMode, DiffResult } from './types/diff';
import type { ComputeDiffOutcome, JsonWarning } from './utils/diffUtils';
import { initializeDiffWorker, startDiffProcess, type DiffProcess } from './workers/diffWorkerClient';

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
  const warningSections = (['original', 'modified'] as const).flatMap((source) => {
    const warningLines = warnings
      .filter((warning) => warning.source === source)
      .map((warning) => {
        if (warning.type === 'numeric-precision') {
          return `• ${warning.count} ${warning.count === 1 ? 'number' : 'numbers'} may change — the parsed value may be rounded or converted to null.`;
        }

        return `• ${warning.count} duplicate ${warning.count === 1 ? 'key' : 'keys'} — only the last value for that key will be kept.`;
      });

    if (warningLines.length === 0) {
      return [];
    }

    return [source === 'original' ? 'Original Text' : 'Modified Text', '', ...warningLines, ''];
  });

  return [
    'Both texts contain valid JSON, but parsing them may change some of their contents.',
    '',
    ...warningSections,
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
  const [isProcessing, setIsProcessing] = useState(false);
  const diffProcessRef = useRef<DiffProcess | null>(null);

  useEffect(() => {
    initializeDiffWorker();

    return () => {
      const activeProcess = diffProcessRef.current;
      diffProcessRef.current = null;
      activeProcess?.terminate();
    };
  }, []);

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

  const handleDiffOutcome = (outcome: ComputeDiffOutcome) => {
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
        title: `JSON Parse Warning - ${issueCount} ${issueCount === 1 ? 'Issue' : 'Issues'}`,
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
    setIsCompareMode(true);
  };

  const showProcessingError = (error: unknown) => {
    setModalState({
      isOpen: true,
      title: 'Diff Processing Error',
      message: `Failed to compare the texts:\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
      variant: 'error',
    });
  };

  const handleToggleMode = () => {
    if (isProcessing) {
      return;
    }

    if (isCompareMode) {
      setDiffResult(null);
      setIsCompareMode(false);
      return;
    }

    let diffProcess: DiffProcess;

    try {
      diffProcess = startDiffProcess(originalText, modifiedText, { isJsonMode, diffCleanupMode, editCost });
    } catch (error) {
      showProcessingError(error);
      return;
    }

    diffProcessRef.current = diffProcess;
    setIsProcessing(true);

    void diffProcess.outcome.then(
      (outcome) => {
        if (diffProcessRef.current !== diffProcess) {
          return;
        }

        diffProcessRef.current = null;
        setIsProcessing(false);
        handleDiffOutcome(outcome);
      },
      (error: unknown) => {
        if (diffProcessRef.current !== diffProcess) {
          return;
        }

        diffProcessRef.current = null;
        setIsProcessing(false);
        showProcessingError(error);
      },
    );
  };

  const terminateDiffProcess = () => {
    const activeProcess = diffProcessRef.current;
    diffProcessRef.current = null;
    activeProcess?.terminate();
    setIsProcessing(false);
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
      {isProcessing ? (
        <ProcessingModal onTerminate={terminateDiffProcess} />
      ) : modalState.isOpen ? (
        <Modal
          title={modalState.title}
          message={modalState.message}
          onClose={closeModal}
          variant={modalState.variant}
          actionLabel={modalState.variant === 'warning' ? 'Continue' : undefined}
        />
      ) : null}
    </div>
  );
}

export default App;
