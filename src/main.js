import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="layout">
    <header class="header">
      <div class="brand">
        <div class="logo-container">
          <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
            <line x1="12" y1="12" x2="12" y2="18"></line>
          </svg>
        </div>
        <h1>Text<span class="brand-accent">Diff</span></h1>
      </div>
      <div class="actions">
        <button class="btn btn-secondary">Clear</button>
        <button id="compare-btn" class="btn btn-primary">Compare</button>
      </div>
    </header>
    
    <main class="workspace">
      <div class="editor-pane">
        <div class="pane-header">
          <h2>Original</h2>
          <div class="pane-tools">
            <span class="badge">Read Only</span>
          </div>
        </div>
        <div class="textarea-wrapper">
          <textarea id="original" placeholder="Paste the original version of the text here..."></textarea>
        </div>
      </div>
      
      <div class="editor-pane">
        <div class="pane-header">
          <h2>Modified</h2>
          <div class="pane-tools">
            <span class="badge">Editable</span>
          </div>
        </div>
        <div class="textarea-wrapper">
          <textarea id="modified" placeholder="Paste the modified version of the text here..."></textarea>
        </div>
      </div>
    </main>
  </div>
`

// Logic placeholders
const compareBtn = document.getElementById('compare-btn');
const originalInput = document.getElementById('original');
const modifiedInput = document.getElementById('modified');

compareBtn.addEventListener('click', () => {
  console.log('Compare requested');
  // Algorithm implementation will go here
});
