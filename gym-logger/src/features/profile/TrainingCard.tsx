import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { getProfile, saveProfile } from '../../db/repo';
import { db } from '../../db/dexie';
import { EXPERIENCE, EXPERIENCE_LABEL, GOALS, GOAL_LABEL, SEX_LABEL, type Profile } from '../../db/types';
import { programById } from '../../db/programs';
import { Card, Chip, Sheet } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { useSetting } from '../../lib/settings';
import { num, toDisplay } from '../../lib/format';
import { t } from '../../i18n';
import { GOAL_INFO } from './choices';
import { SexPicker } from './SexPicker';

type Editing = 'goal' | 'days' | 'experience' | 'sex' | null;

/** «Treningen din» i Profil: alle valgene fra oppstarten, og hvert kan endres med ett trykk. */
export function TrainingCard() {
  const user = useUser();
  const unit = useSetting('unit');
  const [editing, setEditing] = useState<Editing>(null);
  const data = useLiveQuery(async () => {
    const profile = await getProfile(user.id);
    const latestBw = (await db.bodyweights.toArray()).filter((b) => !b.deleted).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const sources = new Set((await db.routines.toArray()).filter((r) => !r.deleted && r.source?.startsWith('program:')).map((r) => r.source!.slice(8)));
    return { profile, bw: latestBw?.weight_kg ?? profile?.bodyweight_kg ?? null, programs: [...sources].map((id) => programById(id)?.name).filter(Boolean) };
  }, [user.id]);
  const p = data?.profile;
  if (!p) return null;
  const save = (patch: Partial<Profile>) => void saveProfile(user.id, patch);

  return (
    <>
      <Card className="divide-y divide-line overflow-hidden">
        <Row icon={GOAL_INFO[p.goal].icon} label={t('Mål', 'Goal')} value={GOAL_LABEL[p.goal]} onClick={() => setEditing('goal')} />
        <Row icon="calendar" label={t('Økter per uke', 'Workouts per week')} value={String(p.weekly_target)} onClick={() => setEditing('days')} />
        <Row icon="star" label={t('Erfaring', 'Experience')} value={EXPERIENCE_LABEL[p.experience]} onClick={() => setEditing('experience')} />
        <Row
          icon="user"
          label={t('Kjønn', 'Sex')}
          value={p.sex ? SEX_LABEL[p.sex] : t('Ikke valgt', 'Not set')}
          onClick={() => setEditing('sex')}
        />
        <Row icon="scale" label={t('Kroppsvekt', 'Bodyweight')} value={data.bw ? `${num(toDisplay(data.bw, unit), 1)} ${unit}` : t('Ikke registrert', 'Not logged')} to="/bodyweight" />
        <Row icon="list" label={t('Program', 'Program')} value={data.programs.length ? data.programs.join(', ') : t('Egne rutiner', 'Own routines')} to="/programs" action={t('Bytt', 'Change')} />
      </Card>

      <Sheet open={editing === 'goal'} onClose={() => setEditing(null)} title={t('Mål', 'Goal')}>
        <div className="flex flex-col gap-2">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => { save({ goal: g }); setEditing(null); }}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left ${p.goal === g ? 'border-green bg-green-dim/30' : 'border-line bg-raised'}`}
              aria-pressed={p.goal === g}
            >
              <Icon name={GOAL_INFO[g].icon} className="mt-0.5 text-green" />
              <span>
                <span className="block font-semibold">{GOAL_LABEL[g]}</span>
                <span className="block text-sm text-muted">{GOAL_INFO[g].text}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">{t('Endringen gjelder nye programmer. Rutinene du har beholdes som de er.', 'The change applies to new programs. Your current routines stay as they are.')}</p>
      </Sheet>

      <Sheet open={editing === 'days'} onClose={() => setEditing(null)} title={t('Økter per uke', 'Workouts per week')}>
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={p.weekly_target === n}
              onClick={() => { save({ weekly_target: n }); setEditing(null); }}
              className={`font-num aspect-square rounded-2xl border text-xl font-bold ${p.weekly_target === n ? 'border-green bg-green text-black' : 'border-line bg-raised'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <Link to={`/programs?days=${Math.min(6, Math.max(2, p.weekly_target))}`} className="mt-4 block text-center text-sm font-semibold text-green" onClick={() => setEditing(null)}>
          {t('Finn et program for dette antallet dager →', 'Find a program for this many days →')}
        </Link>
      </Sheet>

      <Sheet open={editing === 'experience'} onClose={() => setEditing(null)} title={t('Erfaring', 'Experience')}>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE.map((e) => (
            <Chip key={e} active={p.experience === e} onClick={() => { save({ experience: e }); setEditing(null); }}>
              {EXPERIENCE_LABEL[e]}
            </Chip>
          ))}
        </div>
      </Sheet>

      <Sheet open={editing === 'sex'} onClose={() => setEditing(null)} title={t('Kjønn', 'Sex')}>
        <SexPicker value={p.sex ?? null} onChange={(sex) => { save({ sex }); setEditing(null); }} />
      </Sheet>
    </>
  );
}

function Row({ icon, label, value, onClick, to, action }: { icon: IconName; label: string; value: string; onClick?: () => void; to?: string; action?: string }) {
  const inner = (
    <>
      <Icon name={icon} size={20} className="shrink-0 text-green" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">{label}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
      {action ? <span className="text-sm font-semibold text-green">{action}</span> : <Icon name="chevron" size={18} className="text-faint" />}
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-raised';
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick} aria-label={`${label}: ${value}. ${t('Endre', 'Change')}`}>
      {inner}
    </button>
  );
}
