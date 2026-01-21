import { useState } from 'react';
import './style.css';

function App() {
  const handleCompare = () => {
    console.log('Compare requested');
    // Algorithm implementation will go here
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="brand">
          <div className="logo-container">
            <svg
              className="logo-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="9" y1="15" x2="15" y2="15"></line>
              <line x1="12" y1="12" x2="12" y2="18"></line>
            </svg>
          </div>
          <h1>
            Text<span className="brand-accent">Diff</span>
          </h1>
        </div>
        <div className="actions">
          <button className="btn btn-secondary">Clear</button>
          <button
            id="compare-btn"
            className="btn btn-primary"
            onClick={handleCompare}
          >
            Compare
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="editor-pane">
          <div className="pane-header">
            <h2>Original</h2>
            <div className="pane-tools">
              <span className="badge">Read Only</span>
            </div>
          </div>
          <div className="textarea-wrapper">
            <textarea
              id="original"
              placeholder="Paste the original version of the text here..."
            ></textarea>
          </div>
        </div>

        <div className="editor-pane">
          <div className="pane-header">
            <h2>Modified</h2>
            <div className="pane-tools">
              <span className="badge">Editable</span>
            </div>
          </div>
          <div className="textarea-wrapper">
            <textarea
              id="modified"
              placeholder="Paste the modified version of the text here..."
            ></textarea>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
