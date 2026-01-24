import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Disable console.log in production for performance and security
if (import.meta.env.PROD) {
  console.log = () => { };
  console.debug = () => { };
  // Keep console.warn and console.error for critical issues
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);