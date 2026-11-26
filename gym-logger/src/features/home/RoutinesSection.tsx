import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { getActiveWorkout, nextRoutine, routineItems, startWorkout } from '../../db/repo';
import { showInfo } from '../../components/confirm';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n';

/** «Dine rutiner» på Hjem: hver rutine med Start, eller en vei til programbiblioteket. */
export function RoutinesSection() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const list = (await db.routines.toArray()).filter((r) => !r.deleted);
    const next = await nextRoutine();
    const withItems = await Promise.all(list.map(async (r) => ({ r, count: (await routineItems(r.id)).length })));
    // Den som står for tur først, så resten alfabetisk.
    withItems.sort((a, b) => Number(b.r.id === next?.id) - Number(a.r.id === next?.id) || a.r.name.localeCompare(b.r.name, 'nb'));
    return { routines: withItems, nextId: next?.id };
  }, []);
  if (!data) return null;

  const start = async (routineId: string) => {
    if (await getActiveWorkout()) {
      await showInfo(t('Du har allerede en økt i gang. Avslutt den før du starter en ny.', 'You already have a workout in progress. Finish it before starting a new one.'));
      navigate('/workout');
      return;
    }
    await startWorkout({ routineId });
    navigate('/workout');
  };

  return (
    <section aria-labelledby="routines-title">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 id="routines-title" className="text-sm font-semibold tracking-wide text-muted uppercase">
          {t('Dine rutiner', 'Your routines')}
        </h2>
        <div className="flex gap-4 text-sm font-medium text-green">
          <Link to="/programs">{t('Finn et program', 'Find a program')}</Link>
          {data.routines.length > 0 && <Link to="/routines">{t('Se alle', 'See all')}</Link>}
        </div>
      </div>

      {data.routines.length === 0 ? (
        <Link to="/programs" className="card flex items-center gap-3 rounded-3xl p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-green text-black">
            <Icon name="list" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t('Velg et program som passer uka di', 'Pick a program that fits your week')}</span>
            <span className="block text-sm text-muted">{t('PPL, overkropp/underkropp, fullkropp og flere', 'PPL, upper/lower, full body and more')}</span>
          </span>
          <Icon name="chevron" size={18} className="text-faint" />
        </Link>
      ) : (
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1" aria-label={t('Rutiner', 'Routines')}>
          {data.routines.map(({ r, count }) => (
            <li key={r.id} className="w-44 shrink-0 snap-start">
              <div className={`card flex h-full flex-col rounded-3xl p-4 ${r.id === data.nextId ? 'border-green/60' : ''}`}>
                {r.id === data.nextId && <span className="mb-1 text-[11px] font-semibold tracking-wide text-green uppercase">{t('Står for tur', 'Up next')}</span>}
                <Link to={`/routines/${r.id}`} className="font-num line-clamp-2 text-lg leading-tight font-bold">
                  {r.name}
                </Link>
                <span className="mt-1 text-sm text-muted">{t(`${count} øvelser`, `${count} exercises`)}</span>
                <button
                  type="button"
                  disabled={!count}
                  onClick={() => void start(r.id)}
                  aria-label={`${t('Start rutinen', 'Start the routine')} ${r.name}`}
                  className="mt-auto flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-raised pt-0 text-sm font-semibold text-green disabled:opacity-40"
                  style={{ marginTop: 12 }}
                >
                  <Icon name="play" size={16} /> {t('Start', 'Start')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
