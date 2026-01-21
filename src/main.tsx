import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Prevent prototype pollution attacks
Object.freeze(Object.prototype);

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
