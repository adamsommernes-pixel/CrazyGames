import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthError } from '../../auth/types';
import { Button, IconButton, inputClass } from '../../components/ui';
import { PasswordField } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { LanguageToggle } from '../../components/LanguageToggle';
import { t } from '../../i18n';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-xl flex-col px-5">
      <div className="-ml-2 flex items-center justify-between pt-3">
        <IconButton icon="back" label={t('Tilbake', 'Back')} onClick={() => navigate('/welcome')} />
        <LanguageToggle />
      </div>
      <h1 className="font-num mt-4 text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function LocalNote() {
  const { backend } = useAuth();
  if (backend.kind !== 'local') return null;
  return (
    <p className="mt-6 flex gap-2 rounded-2xl border border-line bg-surface p-3 text-sm text-muted">
      <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-green" />
      {t('Kontoen og øktene lagres på denne enheten, med kryptert passord. Sky-synk mellom enheter kan slås på senere.', 'Your account and workouts are stored on this device, with an encrypted password. Cloud sync between devices can be turned on later.')}
    </p>
  );
}

function useSubmit(fn: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : t('Noe gikk galt. Prøv igjen.', 'Something went wrong. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, onSubmit };
}

const ErrorText = ({ error }: { error: string | null }) =>
  error ? (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {error}
    </p>
  ) : null;

export function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    if ((await signUp(name, email, password)) === 'confirm-email') setConfirm(true);
  });

  if (confirm) {
    return (
      <Shell title={t('Sjekk e-posten', 'Check your email')} subtitle={t(`Vi har sendt en lenke til ${email}. Trykk på den for å bekrefte kontoen, og logg så inn.`, `We sent a link to ${email}. Tap it to confirm your account, then log in.`)}>
        <Link to="/login" className="font-semibold text-green">
          {t('Gå til innlogging', 'Go to login')}
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title={t('Lag konto', 'Create account')} subtitle={t('Det tar under ett minutt.', 'It takes less than a minute.')}>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('Navn', 'Name')}</span>
          <input id="signup-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('E-post', 'Email')}</span>
          <input id="signup-email" className={inputClass} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <PasswordField id="signup-password" label={t('Passord (minst 8 tegn)', 'Password (at least 8 characters)')} value={password} onChange={setPassword} autoComplete="new-password" showStrength />
        <ErrorText error={error} />
        <button type="submit" disabled={busy} className="mt-2 min-h-14 rounded-2xl bg-green text-lg font-semibold text-black shadow-glow disabled:opacity-50">
          {busy ? t('Lager konto …', 'Creating account …') : t('Lag konto', 'Create account')}
        </button>
        <p className="text-center text-xs text-faint">
          {t('Ved å lage konto godtar du', 'By creating an account you accept the')}{' '}
          <Link to="/privacy" className="underline">
            {t('personvernerklæringen', 'privacy policy')}
          </Link>
          .
        </p>
      </form>
      <p className="mt-6 text-center text-muted">
        {t('Har du konto?', 'Already have an account?')}{' '}
        <Link to="/login" className="font-semibold text-green">
          {t('Logg inn', 'Log in')}
        </Link>
      </p>
      <LocalNote />
    </Shell>
  );
}

export function Login() {
  const { signIn, backend } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reset, setReset] = useState<'idle' | 'sent'>('idle');
  const confirmed = isConfirmedLanding();
  const { busy, error, onSubmit } = useSubmit(() => signIn(email, password));
  const forgot = useSubmit(async () => {
    if (!email.trim()) throw new AuthError(t('Skriv inn e-posten din først.', 'Enter your email first.'));
    await backend.resetPassword!(email);
    setReset('sent');
  });

  return (
    <Shell title={t('Velkommen tilbake', 'Welcome back')} subtitle={t('Logg inn for å fortsette der du slapp.', 'Log in to pick up where you left off.')}>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('E-post', 'Email')}</span>
          <input id="login-email" className={inputClass} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <PasswordField id="login-password" label={t('Passord', 'Password')} value={password} onChange={setPassword} autoComplete="current-password" />
        <ErrorText error={error ?? forgot.error} />
        {confirmed && (
          <p role="status" className="rounded-xl bg-green-dim/40 px-3 py-2.5 text-sm text-green-light">
            {t('E-posten er bekreftet. Logg inn for å starte.', 'Your email is confirmed. Log in to get started.')}
          </p>
        )}
        {reset === 'sent' && (
          <p role="status" className="rounded-xl bg-green-dim/40 px-3 py-2.5 text-sm text-green-light">
            {t('Sjekk e-posten for en lenke til å lage nytt passord.', 'Check your email for a link to set a new password.')}
          </p>
        )}
        <button type="submit" disabled={busy} className="mt-2 min-h-14 rounded-2xl bg-green text-lg font-semibold text-black shadow-glow disabled:opacity-50">
          {busy ? t('Logger inn …', 'Logging in …') : t('Logg inn', 'Log in')}
        </button>
        {backend.resetPassword && (
          <Button variant="ghost" onClick={(e) => void forgot.onSubmit(e as unknown as FormEvent)}>
            {t('Glemt passord?', 'Forgot password?')}
          </Button>
        )}
      </form>
      <p className="mt-6 text-center text-muted">
        {t('Ny her?', 'New here?')}{' '}
        <Link to="/signup" className="font-semibold text-green">
          {t('Lag konto', 'Create account')}
        </Link>
      </p>
      {backend.kind === 'local' && (
        <p className="mt-6 text-center text-sm text-faint">{t('Kontoer lagres på enheten de ble laget på. Glemt passord kan ikke tilbakestilles uten sky-synk.', 'Accounts are stored on the device they were created on. A forgotten password cannot be reset without cloud sync.')}</p>
      )}
    </Shell>
  );
}

/** True når brukeren kommer fra lenken i bekreftelses-e-posten. */
export function isConfirmedLanding() {
  return new URLSearchParams(location.search).get('confirmed') === '1';
}
