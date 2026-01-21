import { useState } from 'react';
import './App.css';
import { Header, TextAreas, CompareDisplay } from './components';

function App() {
  const [originalText, setOriginalText] = useState('');
  const [modifiedText, setModifiedText] = useState('');

  const handleClear = () => {
    setOriginalText('');
    setModifiedText('');
  };

  const handleCompare = () => {
    console.log('Compare requested');
    // Algorithm implementation will go here
  };

  return (
    <div className="layout">
      <Header onClear={handleClear} onCompare={handleCompare} />
      <TextAreas
        originalText={originalText}
        modifiedText={modifiedText}
        onOriginalChange={setOriginalText}
        onModifiedChange={setModifiedText}
      />
      <CompareDisplay />
    </div>
  );
}

export default App;
