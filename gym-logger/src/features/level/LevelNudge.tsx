import { Link } from 'react-router-dom';
import { useSetting } from '../../lib/settings';
import { ACTIVE_DAYS, type StrengthProfile } from '../../lib/strength';
import { exerciseName } from '../../lib/exerciseName';
import { useExerciseMap } from '../workout/ExercisePicker';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n';
import { isRetired } from './LevelPage';

const DAY = 86_400_000;

/** Hva Home skal si om løft som har sluttet å telle, eller snart gjør det. Løft brukeren har lagt bort, nevnes ikke. */
export function levelNudge(profile: StrengthProfile, retired: Record<string, string>, now = Date.now()) {
  const live = profile.lifts.filter((l) => !isRetired(l, retired) && l.lastAt);
  const dropped = live.filter((l) => !l.active);
  if (dropped.length) return { kind: 'dropped' as const, ids: dropped.map((l) => l.exerciseId) };
  const soon = live
    .filter((l) => l.active)
    .map((l) => ({ id: l.exerciseId, left: Math.ceil(ACTIVE_DAYS - (now - Date.parse(l.lastAt!)) / DAY) }))
    .filter((x) => x.left <= 7)
    .sort((a, b) => a.left - b.left);
  if (soon.length) return { kind: 'soon' as const, ids: [soon[0].id], days: Math.max(1, soon[0].left) };
  return null;
}

/** Diskret linje under nivået på Hjem. */
export function LevelNudge({ profile }: { profile: StrengthProfile }) {
  const retired = useSetting('retiredLifts');
  const exMap = useExerciseMap();
  const n = levelNudge(profile, retired);
  if (!n) return null;
  const names = n.ids.slice(0, 2).map((id) => exerciseName(exMap.get(id)));
  const list = names.join(t(' og ', ' and ')) + (n.ids.length > 2 ? t(` og ${n.ids.length - 2} til`, ` and ${n.ids.length - 2} more`) : '');
  return (
    <Link to="/level" className="mt-1.5 flex items-center gap-1.5 text-xs text-muted" data-level-nudge={n.kind}>
      <Icon name="info" size={13} className="shrink-0 text-warn" />
      <span>
        {n.kind === 'dropped'
          ? t(`${list} teller ikke lenger i nivået ditt. Tren igjen, eller marker at du ikke trener det →`, `${list} no longer count towards your level. Train again, or mark that you don't train it →`)
          : t(`${list} slutter å telle om ${n.days} ${n.days === 1 ? 'dag' : 'dager'} →`, `${list} stops counting in ${n.days} ${n.days === 1 ? 'day' : 'days'} →`)}
      </span>
    </Link>
  );
}
