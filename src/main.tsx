import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Extra protection against prototype pollution attacks
// Should not be needed, but added just in case
Object.freeze(Object.prototype);

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
