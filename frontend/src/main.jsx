import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// PWA service worker is auto-registered by vite-plugin-pwa
// The virtual:pwa-register module handles registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      // Clean up any old manually registered SWs
      registrations.forEach(reg => {
        if (reg.active && reg.active.scriptURL.includes('/sw.js') === false) {
          // vite-plugin-pwa registers as /sw.js automatically
        }
      });
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
