import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfirmHost } from './components/confirm';
import { BottomNav } from './components/BottomNav';
import { RestTimerBar, unlockAudio } from './features/workout/restTimer';
import { WorkoutTab } from './features/workout/WorkoutTab';
import { HistoryList } from './features/history/HistoryList';
import { WorkoutDetail } from './features/history/WorkoutDetail';
import { RoutineList } from './features/routines/RoutineList';
import { RoutineEditor } from './features/routines/RoutineEditor';
import { ProgressList } from './features/progress/ProgressList';
import { ProfilePage } from './features/profile/ProfilePage';
import { useAutoSync } from './db/sync';

// Grafbiblioteket er stort, så grafsiden lastes først når den åpnes.
const ExerciseProgress = lazy(() => import('./features/progress/ExerciseProgress').then((m) => ({ default: m.ExerciseProgress })));

// I claude.ai-versjonen styres ikke adressefeltet av appen, så ruting skjer i minnet.
const Router = __ARTIFACT__ ? MemoryRouter : HashRouter;

export default function App() {
  useAutoSync();
  // Lyd for hviletimeren må låses opp av et trykk på iOS.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<WorkoutTab />} />
        <Route path="/history" element={<HistoryList />} />
        <Route path="/history/:id" element={<WorkoutDetail />} />
        <Route path="/routines" element={<RoutineList />} />
        <Route path="/routines/new" element={<RoutineEditor />} />
        <Route path="/routines/:id" element={<RoutineEditor />} />
        <Route path="/progress" element={<ProgressList />} />
        <Route
          path="/progress/:exerciseId"
          element={
            <Suspense fallback={null}>
              <ExerciseProgress />
            </Suspense>
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<WorkoutTab />} />
      </Routes>
      <div className="fixed inset-x-0 bottom-0 z-30">
        <RestTimerBar />
        <BottomNav />
      </div>
      <ConfirmHost />
    </Router>
  );
}
