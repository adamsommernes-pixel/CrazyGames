import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorScreen';
import { Intro } from './components/Intro';
import { showToast } from './components/toast';
import { listenForInstall } from './lib/pwa';
import { flushPendingSaves } from './lib/autosave';
import { watchResume } from './lib/resume';
import { t } from './i18n';
import './index.css';

watchResume();

// Service worker (offline) bare i den vanlige PWA-versjonen.
if (!__ARTIFACT__) {
  listenForInstall();
  const updateSW = registerSW({
    immediate: true,
    // Ny versjon: spør i stedet for å laste på nytt midt i en økt. Alt er lagret før oppdatering.
    onNeedRefresh() {
      showToast(
        t('En ny versjon av Repgrade er klar.', 'A new version of Repgrade is ready.'),
        {
          label: t('Oppdater', 'Update'),
          onClick: () => {
            flushPendingSaves();
            void updateSW(true);
          },
        },
        60_000,
      );
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Intro />
    </ErrorBoundary>
  </StrictMode>,
);
