import { useEffect, useRef, useState } from 'react';
import { Header, TextAreas, CompareDisplay, Modal, ProcessingModal } from './components';
import type { ComputeDiffOutcome } from './diff/compute';
import type { DiffResult } from './diff/types';
import { initializeDiffWorker, startDiffProcess, type DiffProcess } from './diff/workerClient';
import { loadDiffSettings, saveDiffSettings, type DiffSettings } from './settings';
import './App.css';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'error' | 'info';
}

const closedModalState: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  variant: 'error',
};

function App() {
  const [originalText, setOriginalText] = useState('');
  const [modifiedText, setModifiedText] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [diffSettings, setDiffSettings] = useState<DiffSettings>(loadDiffSettings);
  const [modalState, setModalState] = useState<ModalState>(closedModalState);
  const [isProcessing, setIsProcessing] = useState(false);
  const diffProcessRef = useRef<DiffProcess | null>(null);
  const { diffMode, diffAlgorithm, diffCleanupMode, editCost, showTextDecorations } = diffSettings;

  useEffect(() => {
    initializeDiffWorker();

    return () => {
      const activeProcess = diffProcessRef.current;
      diffProcessRef.current = null;
      activeProcess?.terminate();
    };
  }, []);

  useEffect(() => {
    saveDiffSettings(diffSettings);
  }, [diffSettings]);

  function updateDiffSetting<Key extends keyof DiffSettings>(key: Key, value: DiffSettings[Key]) {
    setDiffSettings((currentSettings) =>
      currentSettings[key] === value ? currentSettings : { ...currentSettings, [key]: value },
    );
  }

  const closeModal = () => {
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
      diffProcess = startDiffProcess(originalText, modifiedText, {
        isJsonMode,
        diffMode,
        diffAlgorithm,
        diffCleanupMode,
        editCost,
      });
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
        diffMode={diffMode}
        onDiffModeChange={(mode) => updateDiffSetting('diffMode', mode)}
        diffAlgorithm={diffAlgorithm}
        onDiffAlgorithmChange={(algorithm) => updateDiffSetting('diffAlgorithm', algorithm)}
        diffCleanupMode={diffCleanupMode}
        onDiffCleanupModeChange={(mode) => updateDiffSetting('diffCleanupMode', mode)}
        editCost={editCost}
        onEditCostChange={(cost) => updateDiffSetting('editCost', cost)}
        showTextDecorations={showTextDecorations}
        onShowTextDecorationsChange={(enabled) => updateDiffSetting('showTextDecorations', enabled)}
      />
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {isProcessing ? 'Comparison in progress.' : isCompareMode ? 'Comparison complete. Results are ready.' : ''}
      </p>
      {!isCompareMode && (
        <TextAreas
          originalText={originalText}
          modifiedText={modifiedText}
          onOriginalChange={setOriginalText}
          onModifiedChange={setModifiedText}
        />
      )}
      {isCompareMode && <CompareDisplay diffResult={diffResult} showTextDecorations={showTextDecorations} />}
      {isProcessing ? (
        <ProcessingModal onTerminate={terminateDiffProcess} />
      ) : modalState.isOpen ? (
        <Modal
          title={modalState.title}
          message={modalState.message}
          onClose={closeModal}
          variant={modalState.variant}
        />
      ) : null}
    </div>
  );
}

export default App;
