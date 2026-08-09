import { useState } from 'react';
import './App.css';
import { Header, TextAreas, CompareDisplay, Modal } from './components';
import type { DiffCleanupMode, DiffResult } from './types/diff';
import { computeDiff } from './utils/diffUtils';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'error' | 'info';
}

function App() {
  const [originalText, setOriginalText] = useState('');
  const [modifiedText, setModifiedText] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [diffCleanupMode, setDiffCleanupMode] = useState<DiffCleanupMode>('semantic');
  const [editCost, setEditCost] = useState(4);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'error',
  });

  const closeModal = () => {
    setModalState({ isOpen: false, title: '', message: '', variant: 'error' });
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
        />
      )}
    </div>
  );
}

export default App;
