import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { db } from '../../db/dexie';
import { getActiveWorkout, getProfile, nextRoutine, routineItems, startWorkout } from '../../db/repo';
import { Button, Card, PRBadge, SectionTitle } from '../../components/ui';
import { Avatar, ProgressRing, WeekStrip } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { useExerciseMap } from '../workout/ExercisePicker';
import { openStartSheet } from '../workout/StartSheet';
import { useNow } from '../workout/restTimer';
import { usePRMap } from '../../lib/prs';
import { useSetting } from '../../lib/settings';
import { thisWeekCount, trainedDaysThisWeek, weekStreak, weeklySeries } from '../../lib/stats';
import { dateShort, duration, num, toDisplay } from '../../lib/format';
import { PR_LABEL } from '../../lib/calc';
import { InstallHint } from '../profile/InstallHint';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'God natt';
  if (h < 10) return 'God morgen';
  if (h < 17) return 'Hei';
  return 'God kveld';
}

export function Home() {
  const user = useUser();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const prMap = usePRMap();
  const profile = useLiveQuery(() => getProfile(user.id), [user.id]);
  const active = useLiveQuery(() => getActiveWorkout(), []);
  const now = useNow(1000, !!active);
  const data = useLiveQuery(async () => {
    const workouts = await db.workouts.toArray();
    const sets = (await db.sets.toArray()).filter((s) => !s.deleted && s.completed_at);
    const next = await nextRoutine();
    return { workouts, sets, next, nextItems: next ? await routineItems(next.id) : [] };
  }, []);

  const target = profile?.weekly_target ?? 3;
  const stats = useMemo(() => {
    if (!data) return null;
    const today = (new Date().getDay() + 6) % 7;
    const week = weeklySeries(data.workouts, data.sets, 1)[0];
    const recentPRs = data.sets
      .filter((s) => prMap.has(s.id))
      .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
      .slice(0, 3);
    return {
      count: thisWeekCount(data.workouts),
      days: trainedDaysThisWeek(data.workouts),
      today,
      streak: weekStreak(data.workouts, target),
      volume: week.volume,
      recentPRs,
    };
  }, [data, prMap, target]);

  const first = (profile?.name || user.name).split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="pt-safe px-5">
        <div className="flex items-center gap-3 pt-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted first-letter:uppercase">
              {new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-num truncate text-3xl font-bold tracking-tight">
              {greeting()}, {first}
            </h1>
          </div>
          <Link to="/profile" aria-label="Profil">
            <Avatar name={profile?.name || user.name} color={profile?.color ?? '#2bd66b'} size={44} />
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4 pt-5 pb-44">
        <InstallHint />

        {active && (
          <button type="button" onClick={() => navigate('/workout')} className="flex items-center gap-3 rounded-3xl bg-green p-4 text-left text-black shadow-glow">
            <span className="grid size-11 place-items-center rounded-2xl bg-black/15">
              <Icon name="play" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium opacity-75">Økt pågår</span>
              <span className="block text-lg font-bold">{active.name}</span>
            </span>
            <span className="font-num text-2xl font-bold">{duration(now - new Date(active.started_at).getTime())}</span>
          </button>
        )}

        <Card className="p-5">
          <div className="flex items-center gap-5">
            <ProgressRing value={stats?.count ?? 0} max={target} label={`${stats?.count ?? 0} av ${target} økter denne uka`}>
              <div>
                <div className="font-num text-4xl leading-none font-bold">
                  {stats?.count ?? 0}
                  <span className="text-xl text-faint">/{target}</span>
                </div>
                <div className="mt-1 text-xs text-muted">denne uka</div>
              </div>
            </ProgressRing>
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-warn">
                  <Icon name="flame" size={18} />
                  <span className="font-num text-2xl font-bold text-ink">{stats?.streak ?? 0}</span>
                </div>
                <div className="text-xs text-muted">{stats?.streak === 1 ? 'uke på rad' : 'uker på rad'}</div>
              </div>
              <div>
                <div className="font-num text-2xl font-bold">{num(toDisplay(stats?.volume ?? 0, unit), 0)}</div>
                <div className="text-xs text-muted">{unit} løftet denne uka</div>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <WeekStrip trained={stats?.days ?? Array(7).fill(false)} today={stats?.today ?? 0} />
          </div>
          {stats && stats.count >= target && (
            <p className="mt-4 rounded-2xl bg-green-dim/40 px-3 py-2 text-center text-sm font-medium text-green-light">Ukemålet er nådd. Sterkt jobba!</p>
          )}
        </Card>

        {!active && data?.next && (
          <Card className="p-5">
            <div className="text-xs font-semibold tracking-wide text-green uppercase">Neste økt</div>
            <h2 className="font-num mt-1 text-2xl font-bold">{data.next.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{data.nextItems.map((i) => exMap.get(i.exercise_id)?.name ?? '?').join(' · ')}</p>
            <Button
              full
              icon="play"
              className="mt-4"
              disabled={!data.nextItems.length}
              onClick={async () => {
                await startWorkout({ routineId: data.next!.id });
                navigate('/workout');
              }}
            >
              Start {data.next.name}
            </Button>
          </Card>
        )}

        {!active && !data?.next && (
          <Button full icon="plus" className="min-h-14 text-lg" onClick={openStartSheet}>
            Start økt
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <QuickLink to="/routines" icon="list" title="Rutiner" />
          <QuickLink to="/bodyweight" icon="scale" title="Kroppsvekt" />
        </div>

        {stats && stats.recentPRs.length > 0 && (
          <section>
            <SectionTitle>Siste rekorder</SectionTitle>
            <Card className="divide-y divide-line">
              {stats.recentPRs.map((s) => (
                <Link key={s.id} to={`/exercise/${s.exercise_id}`} className="flex items-center gap-3 p-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-green-dim/50 text-green">
                    <Icon name="trophy" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{exMap.get(s.exercise_id)?.name ?? 'Øvelse'}</span>
                    <span className="block text-sm text-muted">{dateShort(s.completed_at!)}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-num block font-bold">
                      {num(toDisplay(s.weight, unit))} × {s.reps}
                    </span>
                    <PRBadge label={PR_LABEL[prMap.get(s.id)![0]]} />
                  </span>
                </Link>
              ))}
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}

function QuickLink({ to, icon, title }: { to: string; icon: 'list' | 'scale'; title: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 rounded-3xl p-4 active:bg-raised">
      <Icon name={icon} className="text-green" />
      <span className="flex-1 font-semibold">{title}</span>
      <Icon name="chevron" size={18} className="text-faint" />
    </Link>
  );
}
