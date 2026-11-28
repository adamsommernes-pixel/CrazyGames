import { useMemo, useState } from 'react';
import { Button, Chip, NumberStepper, Sheet, inputClass } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { showToast } from '../../components/toast';
import { social, type ChallengeKind } from '../../social';
import { CHALLENGE_LIFTS, KINDS, LENGTHS, defaultTitle, eligible, kindName, kindText, lengthName, liftName, type Length } from '../../social/challenges';
import { useGraph } from '../../social/graph';
import { errorText } from '../../social/store';
import { t } from '../../i18n';
import { useSetting } from '../../lib/settings';
import { fromDisplay, num, toDisplay } from '../../lib/format';

/** Ny utfordring: type, (løft eller ukemål), varighet, navn og hvem som inviteres. */
export function CreateChallengeSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const g = useGraph();
  const unit = useSetting('unit');
  const [kind, setKind] = useState<ChallengeKind>('goal');
  /** Målvekt for «Først til målet», i kg. */
  const [goalKg, setGoalKg] = useState(100);
  const [lift, setLift] = useState(CHALLENGE_LIFTS[0]);
  const [target, setTarget] = useState(3);
  const [days, setDays] = useState<Length>(7);
  const [title, setTitle] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const candidates = useMemo(() => eligible(g.rel, g.people), [g.rel, g.people]);
  const usesLift = kind === 'lift' || kind === 'goal';
  const shownTitle = title ?? defaultTitle(kind, days, usesLift ? lift : null, kind === 'goal' ? goalKg : null);

  const toggle = (id: string) =>
    setInvited((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const create = async () => {
    setBusy(true);
    try {
      const start = new Date();
      const id = await social()!.createChallenge({
        kind,
        title: shownTitle.trim() || defaultTitle(kind, days, lift),
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + days * 86_400_000).toISOString(),
        invitees: [...invited],
        exercise_id: usesLift ? lift : null,
        target: kind === 'weekly' ? target : kind === 'goal' ? goalKg : null,
      });
      showToast(t('Utfordringen er sendt', 'Challenge sent'));
      setInvited(new Set());
      setTitle(null);
      onCreated(id);
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('Ny utfordring', 'New challenge')} tall>
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 text-sm text-muted">{t('Hva konkurrerer dere i?', 'What are you competing in?')}</div>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {kindName(k)}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-sm text-faint">{kindText(kind, kind === 'goal' ? goalKg : target, usesLift ? lift : null)}</p>
        </div>

        {usesLift && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">{t('Løft', 'Lift')}</span>
            <select className={inputClass} value={lift} onChange={(e) => setLift(e.target.value)}>
              {CHALLENGE_LIFTS.map((id) => (
                <option key={id} value={id}>
                  {liftName(id)}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === 'goal' && (
          <div>
            <div className="mb-2 text-sm text-muted">{t('Målvekt (beregnet 1RM)', 'Target (estimated 1RM)')}</div>
            <NumberStepper
              label={t('Målvekt', 'Target weight')}
              value={toDisplay(goalKg, unit)}
              step={unit === 'kg' ? 2.5 : 5}
              min={unit === 'kg' ? 2.5 : 5}
              max={unit === 'kg' ? 500 : 1100}
              format={(v) => `${num(v, 1)} ${unit}`}
              onChange={(v) => setGoalKg(Math.round(fromDisplay(v, unit) * 100) / 100)}
            />
          </div>
        )}

        {kind === 'weekly' && (
          <div>
            <div className="mb-2 text-sm text-muted">{t('Økter per uke', 'Workouts per week')}</div>
            <NumberStepper label={t('Økter per uke', 'Workouts per week')} value={target} step={1} min={1} max={7} onChange={setTarget} />
          </div>
        )}

        <div>
          <div className="mb-2 text-sm text-muted">{t('Varighet (starter nå)', 'Length (starts now)')}</div>
          <div className="flex gap-2">
            {LENGTHS.map((d) => (
              <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                {lengthName(d)}
              </Chip>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('Navn', 'Name')}</span>
          <input className={inputClass} value={shownTitle} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div>
          <div className="mb-2 text-sm text-muted">{t(`Inviter (${invited.size} valgt)`, `Invite (${invited.size} selected)`)}</div>
          {candidates.length === 0 ? (
            <p className="text-sm text-faint">
              {t('Du kan utfordre folk som følger deg tilbake, og åpne kontoer du følger. Finn folk under Folk.', 'You can challenge people who follow you back, and open accounts you follow. Find people under People.')}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {candidates.map((p) => (
                <li key={p.user_id}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                    <Avatar name={p.display_name} color={p.color} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.display_name}</span>
                      <span className="block truncate text-xs text-faint">@{p.handle}</span>
                    </span>
                    <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={invited.has(p.user_id)} onChange={() => toggle(p.user_id)} aria-label={t(`Inviter ${p.display_name}`, `Invite ${p.display_name}`)} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button full disabled={busy || invited.size === 0 || !shownTitle.trim()} onClick={() => void create()}>
          {t('Send utfordring', 'Send challenge')}
        </Button>
      </div>
    </Sheet>
  );
}
