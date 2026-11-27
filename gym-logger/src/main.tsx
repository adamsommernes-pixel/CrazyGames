import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorScreen';
import { Intro } from './components/Intro';
import { showToast } from './components/toast';
import { WhatsNewHost, fetchWhatsNew, showWhatsNew } from './components/whatsNew';
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
      const update = () => {
        flushPendingSaves();
        void updateSW(true);
      };
      const toast = () =>
        showToast(t('En ny versjon av RepGrade er klar.', 'A new version of RepGrade is ready.'), { label: t('Oppdater', 'Update'), onClick: update }, 60_000);
      // Vis hva som er nytt før oppdatering. Uten nyhetsfil (eller uten nett): bare varselet som før.
      void fetchWhatsNew().then((news) => (news ? showWhatsNew(news, update, toast, 'update', __APP_VERSION__) : toast()));
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Intro />
      <WhatsNewHost />
    </ErrorBoundary>
  </StrictMode>,
);
