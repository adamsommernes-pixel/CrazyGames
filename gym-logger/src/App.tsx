import { Logo } from './components/Logo';
import { applyAccent } from './lib/theme';
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { t, useLang } from './i18n';
import type { AuthUser } from './auth/types';
import { openUserDb } from './db/dexie';
import { getProfile } from './db/repo';
import { useAutoSync } from './db/sync';
import { requestPersist } from './lib/storage';
import { ConfirmHost } from './components/confirm';
import { ErrorScreen } from './components/ErrorScreen';
import { supabaseConfigError } from './lib/supabase';
import { ToastHost } from './components/toast';
import { LevelHost } from './components/levelUp';
import { PageTransition } from './components/PageTransition';
import { AfterUpdateNews } from './components/AfterUpdate';
import { PushPrompt } from './components/PushPrompt';
import { BottomNav } from './components/BottomNav';
import { RestTimerBar, unlockAudio } from './features/workout/restTimer';
import { StartSheet } from './features/workout/StartSheet';
import { WorkoutTab } from './features/workout/WorkoutTab';
import { Welcome } from './features/welcome/Welcome';
import { Login, SignUp, isConfirmedLanding } from './features/auth/AuthForms';
import { Onboarding } from './features/onboarding/Onboarding';
import { Home } from './features/home/Home';
import { HistoryList } from './features/history/HistoryList';
import { WorkoutDetail } from './features/history/WorkoutDetail';
import { RoutineList } from './features/routines/RoutineList';
import { RoutineEditor } from './features/routines/RoutineEditor';
import { Summary } from './features/summary/Summary';
import { ProfilePage } from './features/profile/ProfilePage';
import { EditProfile } from './features/profile/EditProfile';
import { BodyweightPage } from './features/bodyweight/BodyweightPage';
import { LevelPage } from './features/level/LevelPage';
import { ProgramsPage } from './features/routines/ProgramsPage';
import { PrivacyPage } from './features/legal/PrivacyPage';
import { SocialPage } from './features/social/SocialPage';
import { bindSocialUser, socialAvailable } from './social';
import { resetMySocial } from './social/store';
import { resetGraph } from './social/graph';
import { rememberInvite, takeInvite } from './social/invite';
import { PersonPage } from './features/social/PersonPage';
import { ChallengePage } from './features/social/ChallengePage';
import { StrengthSync } from './social/StrengthSync';
import { ActivitySync } from './social/ActivitySync';
import { useSocialMode } from './lib/socialMode';

// Grafbiblioteket er stort, så sider med grafer lastes først når de åpnes.
const ProgressList = lazy(() => import('./features/progress/ProgressList').then((m) => ({ default: m.ProgressList })));
const ExerciseDetail = lazy(() => import('./features/exercise/ExerciseDetail').then((m) => ({ default: m.ExerciseDetail })));

// I claude.ai-versjonen styres ikke adressefeltet av appen, så ruting skjer i minnet.
const Router = __ARTIFACT__ ? MemoryRouter : HashRouter;

export default function App() {
  // Lyd for hviletimeren må låses opp av et trykk på iOS.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Ved språkbytte tegnes hele appen på nytt, så all tekst følger med.
  const lang = useLang();
  if (supabaseConfigError) {
    return (
      <ErrorScreen
        title="Oppsettfeil / Setup error"
        message={supabaseConfigError}
        hint="Rett verdien under GitHub → Settings → Secrets and variables → Actions, og kjør workflowen på nytt. / Fix the value in the GitHub repository secrets and run the workflow again."
      />
    );
  }
  return (
    <AuthProvider key={lang}>
      <Router>
        <Gate />
      </Router>
      <ConfirmHost />
    </AuthProvider>
  );
}

function Splash() {
  return (
    <div data-splash className="grid h-full place-items-center" aria-label={t('Laster', 'Loading')}>
      <span className="flex flex-col items-center gap-3">
        <Logo size={64} name={false} />
        <span className="font-num text-lg font-bold tracking-tight text-muted">RepGrade</span>
      </span>
    </div>
  );
}

/** Lenken fra bekreftelses-e-posten skal til innlogging; ellers velkomstsiden. Sjekkes ved hver visning. */
function WelcomeOrConfirmed() {
  return isConfirmedLanding() ? <Navigate to="/login" replace /> : <Welcome />;
}

/** Invitasjonslenke uten innlogging: husk den, og vis velkomstsiden. Profilen åpnes etter innlogging. */
function InviteLanding() {
  const { handle } = useParams();
  useMemo(() => handle && rememberInvite(handle), [handle]);
  return <Welcome />;
}

function Gate() {
  const { status, user } = useAuth();
  if (status === 'loading') return <Splash />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/u/:handle" element={<InviteLanding />} />
        <Route path="*" element={<WelcomeOrConfirmed />} />
      </Routes>
    );
  }
  return <SignedIn key={user.id} user={user} />;
}

function SignedIn({ user }: { user: AuthUser }) {
  // Bytt til brukerens egen database før noe under leser fra den.
  useMemo(() => openUserDb(user.id), [user.id]);
  useMemo(() => {
    bindSocialUser(user);
    resetMySocial();
    resetGraph();
  }, [user]);
  const socialMode = useSocialMode();
  // Invitasjonslenke åpnet før innlogging: åpne profilen nå.
  const navigate = useNavigate();
  useEffect(() => {
    const h = takeInvite();
    if (h) navigate(`/u/${h}`);
  }, [navigate]);
  useAutoSync(user.kind === 'cloud');
  useEffect(() => {
    void requestPersist();
  }, []);
  const profile = useLiveQuery(() => getProfile(user.id), [user.id], null);
  // Brukerens appfarge; tilbake til standard ved utlogging.
  useEffect(() => {
    if (profile?.color) applyAccent(profile.color);
  }, [profile?.color]);
  useEffect(() => () => applyAccent(null), []);
  if (profile === null) return <Splash />;
  if (!profile?.onboarded_at) return <Onboarding user={user} />;

  return (
    <>
      <AfterUpdateNews />
      {socialMode && socialAvailable(user) && (
        <>
          <StrengthSync />
          <ActivitySync />
        </>
      )}
      <PushPrompt />
      <PageTransition>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workout" element={<WorkoutTab />} />
        <Route path="/history" element={<HistoryList />} />
        <Route path="/history/:id" element={<WorkoutDetail />} />
        <Route path="/social" element={<SocialPage />} />
        <Route path="/u/:handle" element={<PersonPage />} />
        <Route path="/challenge/:id" element={<ChallengePage />} />
        <Route path="/summary/:id" element={<Summary />} />
        <Route path="/routines" element={<RoutineList />} />
        <Route path="/routines/new" element={<RoutineEditor />} />
        <Route path="/routines/:id" element={<RoutineEditor />} />
        <Route
          path="/progress"
          element={
            <Suspense fallback={null}>
              <ProgressList />
            </Suspense>
          }
        />
        <Route
          path="/exercise/:exerciseId"
          element={
            <Suspense fallback={null}>
              <ExerciseDetail />
            </Suspense>
          }
        />
        <Route path="/bodyweight" element={<BodyweightPage />} />
        <Route path="/level" element={<LevelPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </PageTransition>
      <div className="fixed inset-x-0 bottom-0 z-30">
        <ToastHost />
        <LevelHost />
        <RestTimerBar />
        <BottomNav />
      </div>
      <StartSheet />
    </>
  );
}
