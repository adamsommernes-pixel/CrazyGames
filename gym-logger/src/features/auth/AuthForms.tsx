import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthError } from '../../auth/types';
import { Button, IconButton, inputClass } from '../../components/ui';
import { PasswordField } from '../../components/widgets';
import { Icon } from '../../components/Icon';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-xl flex-col px-5">
      <div className="-ml-2 pt-3">
        <IconButton icon="back" label="Tilbake" onClick={() => navigate('/welcome')} />
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
      Kontoen og øktene lagres på denne enheten, med kryptert passord. Sky-synk mellom enheter kan slås på senere.
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
      setError(err instanceof AuthError ? err.message : 'Noe gikk galt. Prøv igjen.');
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
      <Shell title="Sjekk e-posten" subtitle={`Vi har sendt en lenke til ${email}. Trykk på den for å bekrefte kontoen, og logg så inn.`}>
        <Link to="/login" className="font-semibold text-green">
          Gå til innlogging
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title="Lag konto" subtitle="Det tar under ett minutt.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Navn</span>
          <input id="signup-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">E-post</span>
          <input id="signup-email" className={inputClass} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <PasswordField id="signup-password" label="Passord (minst 8 tegn)" value={password} onChange={setPassword} autoComplete="new-password" showStrength />
        <ErrorText error={error} />
        <button type="submit" disabled={busy} className="mt-2 min-h-14 rounded-2xl bg-green text-lg font-semibold text-black shadow-glow disabled:opacity-50">
          {busy ? 'Lager konto …' : 'Lag konto'}
        </button>
      </form>
      <p className="mt-6 text-center text-muted">
        Har du konto?{' '}
        <Link to="/login" className="font-semibold text-green">
          Logg inn
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
  const { busy, error, onSubmit } = useSubmit(() => signIn(email, password));
  const forgot = useSubmit(async () => {
    if (!email.trim()) throw new AuthError('Skriv inn e-posten din først.');
    await backend.resetPassword!(email);
    setReset('sent');
  });

  return (
    <Shell title="Velkommen tilbake" subtitle="Logg inn for å fortsette der du slapp.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">E-post</span>
          <input id="login-email" className={inputClass} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <PasswordField id="login-password" label="Passord" value={password} onChange={setPassword} autoComplete="current-password" />
        <ErrorText error={error ?? forgot.error} />
        {reset === 'sent' && (
          <p role="status" className="rounded-xl bg-green-dim/40 px-3 py-2.5 text-sm text-green-light">
            Sjekk e-posten for en lenke til å lage nytt passord.
          </p>
        )}
        <button type="submit" disabled={busy} className="mt-2 min-h-14 rounded-2xl bg-green text-lg font-semibold text-black shadow-glow disabled:opacity-50">
          {busy ? 'Logger inn …' : 'Logg inn'}
        </button>
        {backend.resetPassword && (
          <Button variant="ghost" onClick={(e) => void forgot.onSubmit(e as unknown as FormEvent)}>
            Glemt passord?
          </Button>
        )}
      </form>
      <p className="mt-6 text-center text-muted">
        Ny her?{' '}
        <Link to="/signup" className="font-semibold text-green">
          Lag konto
        </Link>
      </p>
      {backend.kind === 'local' && (
        <p className="mt-6 text-center text-sm text-faint">Kontoer lagres på enheten de ble laget på. Glemt passord kan ikke tilbakestilles uten sky-synk.</p>
      )}
    </Shell>
  );
}
