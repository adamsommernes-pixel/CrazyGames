import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Service worker (offline) bare i den vanlige PWA-versjonen.
if (!__ARTIFACT__) registerSW({ immediate: true });

// Ber nettleseren om å ikke slette lokale data ved lite lagringsplass.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
