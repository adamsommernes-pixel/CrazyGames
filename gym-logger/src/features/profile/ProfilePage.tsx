import { ColorPicker } from '../../components/ColorPicker';
import { applyAccent } from '../../lib/theme';
import { Logo } from '../../components/Logo';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { getProfile, saveProfile } from '../../db/repo';
import { ImportButton, ImportHelp } from '../import/ImportButton';
import { disableRestPush, enableRestPush, pushStatus, pushStatusText } from '../../lib/push';
import { backupFileName, downloadBlob, downloadJSON, exportBackup, exportCSV, lastBackupAt, markBackedUp } from '../../db/backup';
import { requestPersist, useStorageStatus } from '../../lib/storage';
import { syncNow, useSyncStatus } from '../../db/sync';
import { GOAL_LABEL } from '../../db/types';
import { useAuth, useUser } from '../../auth/AuthProvider';
import { AuthError } from '../../auth/types';
import { setSetting, useSetting } from '../../lib/settings';
import { lifetime, longestStreak } from '../../lib/stats';
import { usePRMap } from '../../lib/prs';
import { dateShort, duration, num, toDisplay } from '../../lib/format';
import { Button, Card, Chip, NumberStepper, Page, SectionTitle, Sheet, inputClass } from '../../components/ui';
import { Avatar, PasswordField } from '../../components/widgets';
import { Icon, type IconName } from '../../components/Icon';
import { askConfirm } from '../../components/confirm';
import { InstallHint } from './InstallHint';
import { TrainingCard } from './TrainingCard';
import { LanguageToggle } from '../../components/LanguageToggle';
import { locale, t } from '../../i18n';

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

  const since = new Date(profile?.created_at ?? user.created_at).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const tonnes = stats ? toDisplay(stats.volume, unit) / 1000 : 0;

  return (
    <Page title={t('Profil', 'Profile')}>
      <section className="flex flex-col items-center pt-2 pb-6 text-center">
        <Avatar name={profile?.name || user.name} color={profile?.color ?? '#34c66b'} size={88} />
        <h2 className="mt-4 text-2xl font-bold">{profile?.name || user.name}</h2>
        <p className="mt-1 text-muted">
          {profile ? GOAL_LABEL[profile.goal] : ''} · {profile?.weekly_target ?? 3} {t('økter i uka', 'workouts a week')}
        </p>
        <p className="mt-0.5 text-sm text-faint">{t('Medlem siden', 'Member since')} {since}</p>
        <Button variant="secondary" icon="edit" className="mt-4 min-h-10 px-4" onClick={() => navigate('/profile/edit')}>
          {t('Rediger profil', 'Edit profile')}
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <BigStat icon="dumbbell" label={t('Økter totalt', 'Total workouts')} value={num(stats?.workouts ?? 0, 0)} />
        <BigStat icon="scale" label={`${t('Tonn løftet', 'Tonnes lifted')}${unit === 'lbs' ? ' (1000 lbs)' : ''}`} value={num(tonnes, tonnes < 10 ? 1 : 0)} />
        <BigStat icon="trophy" label={t('Rekorder', 'Records')} value={num(prMap.size, 0)} />
        <BigStat icon="flame" label={t('Lengste streak (uker)', 'Longest streak (weeks)')} value={num(stats?.longest ?? 0, 0)} />
      </div>

      <SectionTitle>{t('Treningen din', 'Your training')}</SectionTitle>
      <TrainingCard />

      <InstallHint />

      <SectionTitle>{t('Data og backup', 'Data and backup')}</SectionTitle>
      <DataSection />

      <SectionTitle>{t('Konto', 'Account')}</SectionTitle>
      <AccountSection />

      <SectionTitle>{t('Innstillinger', 'Settings')}</SectionTitle>
      <SettingsSection />

      <div className="mt-10 flex flex-col items-center gap-1.5 text-center text-xs text-faint">
        <Logo size={22} className="text-sm text-muted" />
        <span>
          {t('Versjon', 'Version')} {__APP_VERSION__} ({t('bygg', 'build')} {__APP_BUILD__}) · {new Date(__APP_BUILT_AT__).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <Link to="/privacy" className="underline">
          {t('Personvern', 'Privacy')}
        </Link>
      </div>
    </Page>
  );
}

function BigStat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="card rounded-xl p-4" data-icon={icon}>
      <div className="font-num text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-sm text-muted">{label}</div>
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
            <span className="block text-sm text-muted">{user.kind === 'cloud' ? t('Lagret trygt på nett og synket mellom enhetene dine', 'Stored safely online and synced across your devices') : t('Lagret på denne enheten', 'Stored on this device')}</span>
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${user.kind === 'cloud' ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-muted'}`}>
            {user.kind === 'cloud' ? t('På nett', 'Online') : t('Lokal', 'Local')}
          </span>
        </div>
        {user.kind === 'cloud' && (
          <Row
            icon="cloud"
            title={t('Synk nå', 'Sync now')}
            sub={sync.state === 'syncing' ? t('Synker …', 'Syncing …') : sync.state === 'error' ? `${t('Feil', 'Error')}: ${sync.error}` : sync.state === 'offline' ? t('Uten nett', 'Offline') : sync.lastSync ? `${t('Synket', 'Synced')} ${new Date(sync.lastSync).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}` : t('Klar', 'Ready')}
            onClick={() => void syncNow()}
          />
        )}
        <Row icon="lock" title={t('Bytt passord', 'Change password')} onClick={() => setSheet('password')} />
        <Row
          icon="logout"
          title={t('Logg ut', 'Log out')}
          onClick={async () => {
            if (await askConfirm(user.kind === 'local' ? t('Dataene blir liggende trygt på enheten til du logger inn igjen.', 'Your data stays safely on this device until you log in again.') : t('Du kan logge inn igjen når som helst.', 'You can log in again at any time.'), { confirmLabel: t('Logg ut', 'Log out'), danger: false })) {
              await signOut();
            }
          }}
        />
        <Row icon="trash" title={t('Slett konto', 'Delete account')} danger onClick={() => setSheet('delete')} />
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
    <Sheet open={open} onClose={close} title={t('Bytt passord', 'Change password')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(oldPw, newPw);
            setMsg({ ok: true, text: t('Passordet er byttet.', 'Password changed.') });
            setOld('');
            setNew('');
          } catch (err) {
            setMsg({ ok: false, text: err instanceof AuthError ? err.message : t('Noe gikk galt.', 'Something went wrong.') });
          } finally {
            setBusy(false);
          }
        }}
      >
        <PasswordField id="pw-old" label={t('Nåværende passord', 'Current password')} value={oldPw} onChange={setOld} autoComplete="current-password" />
        <PasswordField id="pw-new" label={t('Nytt passord', 'New password')} value={newPw} onChange={setNew} autoComplete="new-password" showStrength />
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`rounded-xl px-3 py-2.5 text-sm ${msg.ok ? 'bg-accent-soft/40 text-accent-strong' : 'bg-danger/10 text-danger'}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" disabled={busy || !oldPw || !newPw} className="min-h-12 rounded-xl bg-accent font-semibold text-on-accent disabled:opacity-40">
          {busy ? t('Bytter …', 'Changing …') : t('Bytt passord', 'Change password')}
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
    <Sheet open={open} onClose={onClose} title={t('Slett konto', 'Delete account')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await onSubmit(pw);
          } catch (x) {
            setErr(x instanceof AuthError ? x.message : t('Noe gikk galt.', 'Something went wrong.'));
            setBusy(false);
          }
        }}
      >
        <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
          {t('Kontoen og alle økter, rutiner og rekorder slettes for godt. Ta gjerne en backup først under Data.', 'Your account and all workouts, routines and records are deleted for good. Consider taking a backup under Data first.')}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('Skriv SLETT for å bekrefte', 'Type DELETE to confirm')}</span>
          <input id="delete-word" className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" />
        </label>
        <PasswordField id="delete-pw" label={t('Passord', 'Password')} value={pw} onChange={setPw} autoComplete="current-password" />
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
        <button type="submit" disabled={busy || word.trim().toUpperCase() !== t('SLETT', 'DELETE') || !pw} className="min-h-12 rounded-xl bg-danger font-semibold text-black disabled:opacity-40">
          {busy ? t('Sletter …', 'Deleting …') : t('Slett konto for godt', 'Delete account for good')}
        </button>
      </form>
    </Sheet>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-12 w-full items-center justify-between gap-3">
      <span>{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-ink shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/** Varsel fra serveren når pausen er over, så det piper og vibrerer også med låst skjerm. */
function RestPushSetting() {
  const user = useUser();
  const on = useSetting('restPush');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const status = pushStatus();
  if (status === 'unconfigured') return null;
  const toggle = async (v: boolean) => {
    setMsg(null);
    setBusy(true);
    try {
      if (v) await enableRestPush();
      else await disableRestPush();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      {user.kind === 'cloud' ? (
        <Toggle label={t('Varsel når pausen er over (også med låst skjerm)', 'Notify when rest is over (even when locked)')} checked={on && !busy} onChange={(v) => void toggle(v)} />
      ) : (
        <div className="min-h-12 py-2">
          <div>{t('Varsel når pausen er over (også med låst skjerm)', 'Notify when rest is over (even when locked)')}</div>
          <div className="text-xs text-muted">{t('Krever konto på nett.', 'Requires an online account.')}</div>
        </div>
      )}
      <p className="text-xs text-muted">
        {msg ??
          (status === 'ready'
            ? t('Telefonen spiller av lyd og vibrerer etter innstillingene for varsler.', 'Your phone plays sound and vibrates according to its notification settings.')
            : pushStatusText(status))}
      </p>
    </div>
  );
}

function SettingsSection() {
  const unit = useSetting('unit');
  const defaultRest = useSetting('defaultRest');
  const barWeight = useSetting('barWeight');
  const plates = useSetting('plates');
  const sound = useSetting('sound');
  const haptics = useSetting('haptics');
  const keepAwake = useSetting('keepAwake');
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <span>Språk / Language</span>
        <LanguageToggle size="md" />
      </div>
      <AccentSetting />
      <div className="flex items-center justify-between gap-3">
        <span>{t('Vektenhet', 'Weight unit')}</span>
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
        <div className="mb-2">{t('Standard hviletid', 'Default rest time')}</div>
        <NumberStepper label={t('Standard hviletid', 'Default rest time')} value={defaultRest} step={15} min={0} max={600} format={(v) => (v ? duration(v * 1000) : t('Av', 'Off'))} onChange={(v) => void setSetting('defaultRest', v)} />
      </div>
      <div>
        <div className="mb-2">{t('Stangvekt (platekalkulator)', 'Bar weight (plate calculator)')}</div>
        <NumberStepper label={t('Stangvekt', 'Bar weight')} value={barWeight} step={2.5} min={0} max={30} format={(v) => `${num(v)} kg`} onChange={(v) => void setSetting('barWeight', v)} />
      </div>
      <div>
        <div className="mb-2">{t('Skiver på gymmen (kg)', 'Plates at your gym (kg)')}</div>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATES.map((p) => (
            <Chip key={p} active={plates.includes(p)} onClick={() => void setSetting('plates', plates.includes(p) ? plates.filter((x) => x !== p) : [...plates, p].sort((a, b) => b - a))}>
              {num(p, 2)}
            </Chip>
          ))}
        </div>
      </div>
      <Toggle label={t('Lyd når hvilen er over', 'Sound when rest is over')} checked={sound} onChange={(v) => void setSetting('sound', v)} />
      <RestPushSetting />
      <Toggle label={t('Vibrasjon (Android)', 'Vibration (Android)')} checked={haptics} onChange={(v) => void setSetting('haptics', v)} />
      <Toggle label={t('Hold skjermen på under økt', 'Keep screen on during workouts')} checked={keepAwake} onChange={(v) => void setSetting('keepAwake', v)} />
    </Card>
  );
}

function DataSection() {
  const cloud = useUser().kind === 'cloud';
  const [msg, setMsg] = useState<string | null>(null);
  const [storage, refreshStorage] = useStorageStatus();
  const last = useLiveQuery(() => lastBackupAt(), [], null);

  const exportJSON = async () => {
    downloadJSON(await exportBackup(), backupFileName('json'));
    await markBackedUp();
    setMsg(t('Backup lastet ned. Ta vare på filen, f.eks. i iCloud eller Google Drive.', 'Backup downloaded. Keep the file somewhere safe, e.g. iCloud or Google Drive.'));
  };
  const exportSheet = async () => {
    downloadBlob(new Blob([await exportCSV()], { type: 'text/csv;charset=utf-8' }), backupFileName('csv'));
    setMsg(t('CSV lastet ned. Åpnes i Excel, Numbers eller Google Sheets.', 'CSV downloaded. Opens in Excel, Numbers or Google Sheets.'));
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      {cloud ? (
        <div className="flex items-start gap-3 rounded-xl bg-raised px-3 py-2.5 text-sm" role="status">
          <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t('Dataene dine ligger trygt på nett', 'Your data is stored safely online')}</div>
            <div className="text-xs text-muted">
              {t(
                'Alt synkes til kontoen din, så du mister ingenting om du bytter eller mister telefonen. Last gjerne ned en kopi innimellom.',
                'Everything syncs to your account, so you lose nothing if you switch or lose your phone. Feel free to download a copy now and then.',
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-raised px-3 py-2.5 text-sm" role="status">
        <Icon name={storage?.persisted ? 'check' : 'info'} size={18} className={`mt-0.5 shrink-0 ${storage?.persisted ? 'text-accent' : 'text-warn'}`} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {storage?.persisted ? t('Lagringen er beskyttet', 'Storage is protected') : t('Lagringen kan slettes av nettleseren', 'Storage can be cleared by the browser')}
          </div>
          <div className="text-xs text-muted">
            {storage?.persisted
              ? t('Nettleseren sletter ikke dataene dine automatisk.', 'The browser will not clear your data automatically.')
              : t('Installer appen på Hjem-skjermen og ta jevnlig backup.', 'Install the app on your home screen and back up regularly.')}{' '}
            {last
              ? t(`Siste backup: ${dateShort(last)}.`, `Last backup: ${dateShort(last)}.`)
              : t('Ingen backup tatt ennå.', 'No backup taken yet.')}
          </div>
        </div>
        {storage && !storage.persisted && storage.supported && (
          <button type="button" className="shrink-0 text-xs font-semibold text-accent" onClick={async () => { await requestPersist(); await refreshStorage(); }}>
            {t('Beskytt', 'Protect')}
          </button>
        )}
      </div>
      )}
      <Button icon="download" full onClick={() => void exportJSON()}>
        {t('Last ned backup (JSON)', 'Download backup (JSON)')}
      </Button>
      <Button variant="secondary" icon="download" full onClick={() => void exportSheet()}>
        {t('Eksporter sets til regneark (CSV)', 'Export sets to spreadsheet (CSV)')}
      </Button>
      <ImportButton label={t('Gjenopprett eller importer', 'Restore or import')} />
      <p className="text-xs text-faint">{t('Godtar backup fra Repgrade og eksport fra Lyfto, Hevy og Strong.', 'Accepts Repgrade backups and exports from Lyfto, Hevy and Strong.')}</p>
      <ImportHelp />
      {msg && (
        <p className="text-sm text-accent-strong" role="status">
          {msg}
        </p>
      )}
    </Card>
  );
}

/** Appfarge: endres med en gang og lagres i profilen (synkes mellom enheter). */
function AccentSetting() {
  const user = useUser();
  const profile = useLiveQuery(() => getProfile(user.id), [user.id]);
  if (!profile) return null;
  return (
    <div>
      <div className="mb-2">{t('Appfarge', 'App colour')}</div>
      <ColorPicker
        value={profile.color}
        label={t('Appfarge', 'App colour')}
        onChange={(c) => {
          applyAccent(c);
          void saveProfile(user.id, { color: c });
        }}
      />
    </div>
  );
}
