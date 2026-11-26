import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { downloadJSON, exportBackup, importBackup } from '../../db/backup';
import { syncNow, useSyncStatus } from '../../db/sync';
import { supabase, useSession } from '../../lib/supabase';
import { setSetting, useSetting } from '../../lib/settings';
import { Button, Card, Chip, NumberStepper, Page, SectionTitle } from '../../components/ui';
import { LoginCard } from '../auth/LoginCard';
import { InstallHint } from './InstallHint';
import { duration } from '../../lib/format';

export function ProfilePage() {
  const unit = useSetting('unit');
  const defaultRest = useSetting('defaultRest');
  const stats = useLiveQuery(async () => {
    const workouts = (await db.workouts.toArray()).filter((w) => !w.deleted && w.ended_at).length;
    const sets = (await db.sets.toArray()).filter((s) => !s.deleted && s.completed_at).length;
    return { workouts, sets };
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Page title="Profil">
      <InstallHint />
      <SectionTitle>Konto og synk</SectionTitle>
      <AccountSection />

      <SectionTitle>Innstillinger</SectionTitle>
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
          <NumberStepper
            label="Standard hviletid"
            value={defaultRest}
            step={15}
            min={0}
            max={600}
            format={(v) => (v ? duration(v * 1000) : 'Av')}
            onChange={(v) => void setSetting('defaultRest', v)}
          />
        </div>
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card className="flex flex-col gap-2 p-4">
        {stats && (
          <p className="tabular mb-2 text-muted">
            {stats.workouts} økter og {stats.sets} sets lagret på denne enheten.
          </p>
        )}
        <Button
          variant="secondary"
          icon="download"
          full
          onClick={async () => downloadJSON(await exportBackup(), `gym-logger-${new Date().toISOString().slice(0, 10)}.json`)}
        >
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
        {msg && <p className="text-sm text-green-light" role="status">{msg}</p>}
      </Card>

      <p className="mt-8 text-center text-xs text-faint">Gym Logger v{__APP_VERSION__}</p>
    </Page>
  );
}

function AccountSection() {
  const session = useSession();
  const sync = useSyncStatus();

  if (!supabase) {
    return (
      <Card className="p-4 text-muted">
        Sky-synk er ikke satt opp i denne versjonen. Alt lagres trygt på denne enheten. Ta gjerne en backup innimellom.
      </Card>
    );
  }
  if (session === undefined) return <Card className="p-4 text-muted">Laster …</Card>;
  if (!session) return <LoginCard />;

  const stateText: Record<typeof sync.state, string> = {
    disabled: '',
    'signed-out': 'Ikke logget inn',
    idle: sync.lastSync ? `Synket ${new Date(sync.lastSync).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : 'Klar',
    syncing: 'Synker …',
    offline: 'Uten nett. Synker når du er på nett igjen.',
    error: `Feil ved synk: ${sync.error ?? ''}`,
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <div className="text-sm text-muted">Logget inn som</div>
        <div className="font-semibold break-all">{session.user.email}</div>
      </div>
      <div className={`text-sm ${sync.state === 'error' ? 'text-danger' : 'text-muted'}`} role="status">
        {stateText[sync.state]}
        {sync.pending > 0 && sync.state !== 'syncing' ? ` · ${sync.pending} endringer venter` : ''}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" icon="cloud" className="flex-1" disabled={sync.state === 'syncing'} onClick={() => void syncNow()}>
          Synk nå
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => void supabase!.auth.signOut()}>
          Logg ut
        </Button>
      </div>
    </Card>
  );
}
