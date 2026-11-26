import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Card, inputClass } from '../../components/ui';

/**
 * Innlogging med engangskode på e-post. Kode fungerer bedre enn lenke i en installert
 * app på iPhone, fordi en lenke åpnes i Safari og ikke i appen.
 */
export function LoginCard() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError('Feil eller utløpt kode. Prøv igjen.');
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold">Logg inn for å synke</h3>
      <p className="mt-1 mb-3 text-sm text-muted">Øktene dine lagres i skyen og blir tilgjengelige på alle enhetene dine.</p>
      {!sent ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input className={inputClass} type="email" inputMode="email" autoComplete="email" placeholder="din@epost.no" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-green font-semibold text-black disabled:opacity-40">
            {busy ? 'Sender …' : 'Send kode'}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <p className="text-sm">Vi har sendt en kode til <span className="font-semibold">{email}</span>.</p>
          <input
            className={`${inputClass} tabular text-center text-2xl tracking-[0.3em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-green font-semibold text-black disabled:opacity-40">
            {busy ? 'Logger inn …' : 'Logg inn'}
          </button>
          <Button variant="ghost" onClick={() => setSent(false)}>
            Bruk en annen e-post
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </Card>
  );
}
