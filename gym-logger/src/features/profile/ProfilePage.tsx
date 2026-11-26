import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { getProfile } from '../../db/repo';
import { downloadJSON, exportBackup, importBackup } from '../../db/backup';
import { syncNow, useSyncStatus } from '../../db/sync';
import { GOAL_LABEL } from '../../db/types';
import { useAuth, useUser } from '../../auth/AuthProvider';
import { AuthError } from '../../auth/types';
import { setSetting, useSetting } from '../../lib/settings';
import { lifetime, longestStreak } from '../../lib/stats';
import { usePRMap } from '../../lib/prs';
import { duration, num, toDisplay } from '../../lib/format';
import { Button, Card, Chip, NumberStepper, Page, SectionTitle, Sheet, inputClass } from '../../components/ui';
import { Avatar, PasswordField } from '../../components/widgets';
import { Icon, type IconName } from '../../components/Icon';
import { askConfirm } from '../../components/confirm';
import { InstallHint } from './InstallHint';

const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function ProfilePage() {
  const user = useUser();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const profile = useLiveQuery(() => getProfile(user.id), [user.id]);
  const prMap = usePRMap();
  const data = useLiveQuery(async () => ({ workouts: await db.workouts.toArray(), sets: await db.sets.toArray() }), []);
  const stats = useMemo(() => {
    if (!data) return null;
    return { ...lifetime(data.workouts, data.sets), longest: longestStreak(data.workouts, profile?.weekly_target ?? 3) };
  }, [data, profile?.weekly_target]);

  const since = new Date(profile?.created_at ?? user.created_at).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
  const tonnes = stats ? toDisplay(stats.volume, unit) / 1000 : 0;

  return (
    <Page title="Profil">
      <section className="flex flex-col items-center pt-2 pb-6 text-center">
        <Avatar name={profile?.name || user.name} color={profile?.color ?? '#2bd66b'} size={88} />
        <h2 className="font-num mt-4 text-3xl font-bold">{profile?.name || user.name}</h2>
        <p className="mt-1 text-muted">
          {profile ? GOAL_LABEL[profile.goal] : ''} · {profile?.weekly_target ?? 3} økter i uka
        </p>
        <p className="mt-0.5 text-sm text-faint">Medlem siden {since}</p>
        <Button variant="secondary" icon="edit" className="mt-4 min-h-10 px-4" onClick={() => navigate('/profile/edit')}>
          Rediger profil
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <BigStat icon="dumbbell" label="Økter totalt" value={num(stats?.workouts ?? 0, 0)} />
        <BigStat icon="scale" label={`Tonn løftet${unit === 'lbs' ? ' (1000 lbs)' : ''}`} value={num(tonnes, tonnes < 10 ? 1 : 0)} />
        <BigStat icon="trophy" label="Rekorder" value={num(prMap.size, 0)} />
        <BigStat icon="flame" label="Lengste streak (uker)" value={num(stats?.longest ?? 0, 0)} />
      </div>

      <InstallHint />

      <SectionTitle>Konto</SectionTitle>
      <AccountSection />

      <SectionTitle>Innstillinger</SectionTitle>
      <SettingsSection />

      <SectionTitle>Data</SectionTitle>
      <DataSection />

      <p className="mt-8 text-center text-xs text-faint">Gym Logger v{__APP_VERSION__}</p>
    </Page>
  );
}

function BigStat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="card rounded-3xl p-4">
      <Icon name={icon} size={20} className="text-green" />
      <div className="font-num mt-2 text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Row({ icon, title, sub, onClick, danger }: { icon: IconName; title: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-raised">
      <Icon name={icon} size={20} className={danger ? 'text-danger' : 'text-muted'} />
      <span className="flex-1">
        <span className={`block font-medium ${danger ? 'text-danger' : ''}`}>{title}</span>
        {sub && <span className="block text-sm text-muted">{sub}</span>}
      </span>
      <Icon name="chevron" size={18} className="text-faint" />
    </button>
  );
}

function AccountSection() {
  const { user, signOut, changePassword, deleteAccount } = useAuth();
  const sync = useSyncStatus();
  const [sheet, setSheet] = useState<'password' | 'delete' | null>(null);
  if (!user) return null;

  return (
    <>
      <Card className="divide-y divide-line overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Icon name="mail" size={20} className="text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{user.email}</span>
            <span className="block text-sm text-muted">{user.kind === 'cloud' ? 'Sky-konto, synkes mellom enheter' : 'Lagret på denne enheten'}</span>
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${user.kind === 'cloud' ? 'bg-green-dim text-green-light' : 'bg-raised text-muted'}`}>
            {user.kind === 'cloud' ? 'Sky' : 'Lokal'}
          </span>
        </div>
        {user.kind === 'cloud' && (
          <Row
            icon="cloud"
            title="Synk nå"
            sub={sync.state === 'syncing' ? 'Synker …' : sync.state === 'error' ? `Feil: ${sync.error}` : sync.state === 'offline' ? 'Uten nett' : sync.lastSync ? `Synket ${new Date(sync.lastSync).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : 'Klar'}
            onClick={() => void syncNow()}
          />
        )}
        <Row icon="lock" title="Bytt passord" onClick={() => setSheet('password')} />
        <Row
          icon="logout"
          title="Logg ut"
          onClick={async () => {
            if (await askConfirm(user.kind === 'local' ? 'Dataene blir liggende trygt på enheten til du logger inn igjen.' : 'Du kan logge inn igjen når som helst.', { confirmLabel: 'Logg ut', danger: false })) {
              await signOut();
            }
          }}
        />
        <Row icon="trash" title="Slett konto" danger onClick={() => setSheet('delete')} />
      </Card>

      <PasswordSheet open={sheet === 'password'} onClose={() => setSheet(null)} onSubmit={changePassword} />
      <DeleteSheet open={sheet === 'delete'} onClose={() => setSheet(null)} onSubmit={deleteAccount} />
    </>
  );
}

function PasswordSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (o: string, n: string) => Promise<void> }) {
  const [oldPw, setOld] = useState('');
  const [newPw, setNew] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOld('');
    setNew('');
    setMsg(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="Bytt passord">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(oldPw, newPw);
            setMsg({ ok: true, text: 'Passordet er byttet.' });
            setOld('');
            setNew('');
          } catch (err) {
            setMsg({ ok: false, text: err instanceof AuthError ? err.message : 'Noe gikk galt.' });
          } finally {
            setBusy(false);
          }
        }}
      >
        <PasswordField id="pw-old" label="Nåværende passord" value={oldPw} onChange={setOld} autoComplete="current-password" />
        <PasswordField id="pw-new" label="Nytt passord" value={newPw} onChange={setNew} autoComplete="new-password" showStrength />
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`rounded-xl px-3 py-2.5 text-sm ${msg.ok ? 'bg-green-dim/40 text-green-light' : 'bg-danger/10 text-danger'}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" disabled={busy || !oldPw || !newPw} className="min-h-12 rounded-2xl bg-green font-semibold text-black disabled:opacity-40">
          {busy ? 'Bytter …' : 'Bytt passord'}
        </button>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (pw: string) => Promise<void> }) {
  const [word, setWord] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Slett konto">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await onSubmit(pw);
          } catch (x) {
            setErr(x instanceof AuthError ? x.message : 'Noe gikk galt.');
            setBusy(false);
          }
        }}
      >
        <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">
          Kontoen og alle økter, rutiner og rekorder slettes for godt. Ta gjerne en backup først under Data.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Skriv SLETT for å bekrefte</span>
          <input id="delete-word" className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" />
        </label>
        <PasswordField id="delete-pw" label="Passord" value={pw} onChange={setPw} autoComplete="current-password" />
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
        <button type="submit" disabled={busy || word.trim().toUpperCase() !== 'SLETT' || !pw} className="min-h-12 rounded-2xl bg-danger font-semibold text-black disabled:opacity-40">
          {busy ? 'Sletter …' : 'Slett konto for godt'}
        </button>
      </form>
    </Sheet>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-12 w-full items-center justify-between gap-3">
      <span>{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition-colors ${checked ? 'bg-green' : 'bg-line'}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-ink shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function SettingsSection() {
  const unit = useSetting('unit');
  const defaultRest = useSetting('defaultRest');
  const barWeight = useSetting('barWeight');
  const plates = useSetting('plates');
  const sound = useSetting('sound');
  const haptics = useSetting('haptics');
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <span>Vektenhet</span>
        <div className="flex gap-2">
          <Chip active={unit === 'kg'} onClick={() => void setSetting('unit', 'kg')}>
            kg
          </Chip>
          <Chip active={unit === 'lbs'} onClick={() => void setSetting('unit', 'lbs')}>
            lbs
          </Chip>
        </div>
      </div>
      <div>
        <div className="mb-2">Standard hviletid</div>
        <NumberStepper label="Standard hviletid" value={defaultRest} step={15} min={0} max={600} format={(v) => (v ? duration(v * 1000) : 'Av')} onChange={(v) => void setSetting('defaultRest', v)} />
      </div>
      <div>
        <div className="mb-2">Stangvekt (platekalkulator)</div>
        <NumberStepper label="Stangvekt" value={barWeight} step={2.5} min={0} max={30} format={(v) => `${num(v)} kg`} onChange={(v) => void setSetting('barWeight', v)} />
      </div>
      <div>
        <div className="mb-2">Skiver på gymmen (kg)</div>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATES.map((p) => (
            <Chip key={p} active={plates.includes(p)} onClick={() => void setSetting('plates', plates.includes(p) ? plates.filter((x) => x !== p) : [...plates, p].sort((a, b) => b - a))}>
              {num(p, 2)}
            </Chip>
          ))}
        </div>
      </div>
      <Toggle label="Lyd når hvilen er over" checked={sound} onChange={(v) => void setSetting('sound', v)} />
      <Toggle label="Vibrasjon (Android)" checked={haptics} onChange={(v) => void setSetting('haptics', v)} />
    </Card>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <Button variant="secondary" icon="download" full onClick={async () => downloadJSON(await exportBackup(), `gym-logger-${new Date().toISOString().slice(0, 10)}.json`)}>
        Eksporter backup (JSON)
      </Button>
      <Button variant="secondary" icon="upload" full onClick={() => fileRef.current?.click()}>
        Importer backup
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const n = await importBackup(JSON.parse(await file.text()));
            setMsg(`Importerte ${n} rader.`);
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Kunne ikke lese filen.');
          }
        }}
      />
      {msg && (
        <p className="text-sm text-green-light" role="status">
          {msg}
        </p>
      )}
    </Card>
  );
}
