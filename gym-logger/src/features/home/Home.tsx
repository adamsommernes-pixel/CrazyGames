import { Logo } from '../../components/Logo';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { db } from '../../db/dexie';
import { getActiveWorkout, getProfile, nextRoutine, routineItems, startWorkout } from '../../db/repo';
import { Button, Card, IconButton, PRBadge, SectionTitle } from '../../components/ui';
import { BodyMap } from '../../components/BodyMap';
import { shareApp } from '../../lib/shareApp';
import { RangePicker, useRange } from '../../components/RangePicker';
import { inRange, rangeBounds, rangeLabel, yearsWithData } from '../../lib/range';
import { guideFor } from '../../db/library';
import { Avatar, ProgressRing, WeekStrip } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { useExerciseMap } from '../workout/ExercisePicker';
import { openStartSheet } from '../workout/StartSheet';
import { useNow } from '../workout/restTimer';
import { usePRMap } from '../../lib/prs';
import { useSetting } from '../../lib/settings';
import { muscleLoad, thisWeekCount, trainedDaysThisWeek, weekStreak, weeklySeries } from '../../lib/stats';
import { dateShort, duration, isLongAgo, num, toDisplay } from '../../lib/format';
import { PR_LABEL } from '../../lib/calc';
import { InstallHint } from '../profile/InstallHint';
import { BackupReminder } from './BackupReminder';
import { NewsCard } from './NewsCard';
import { ProgramsBanner } from './ProgramsBanner';
import { ImportBanner } from './ImportBanner';
import { RoutinesSection } from './RoutinesSection';
import { exerciseName } from '../../lib/exerciseName';
import { formatSetShort, kindOf } from '../../lib/kinds';
import { locale, t } from '../../i18n';
import { useStrength } from '../../lib/strengthLive';
import { LevelBadge } from '../level/LevelBadge';
import { LevelNudge } from '../level/LevelNudge';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return t('God natt', 'Good night');
  if (h < 10) return t('God morgen', 'Good morning');
  if (h < 17) return t('Hei', 'Hi');
  return t('God kveld', 'Good evening');
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
  const [keepGoing, setKeepGoing] = useState(false);
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

  const [range, setRange] = useRange();
  const body = useMemo(() => {
    if (!data) return null;
    const b = rangeBounds(range);
    const load = muscleLoad(data.sets, exMap, (id) => guideFor(id)?.secondary ?? [], b);
    const cardio = new Set(
      data.sets.filter((s) => inRange(s.completed_at, b) && exMap.get(s.exercise_id)?.muscle_group === 'Kondisjon').map((s) => s.workout_id),
    ).size;
    return { load, cardio, days: b.days, years: yearsWithData(data.workouts.map((w) => w.started_at)) };
  }, [data, exMap, range]);

  const strength = useStrength();
  const first = (profile?.name || user.name).split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="pt-safe px-5">
        <div className="flex items-center gap-3 pt-5">
          <div className="min-w-0 flex-1">
            <Logo size={16} anchor className="mb-1 text-xs text-faint" />
            <p className="text-sm text-muted first-letter:uppercase">
              {new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {greeting()}, {first}
            </h1>
            {strength && <LevelBadge strength={strength.profile} />}
            {strength && <LevelNudge profile={strength.profile} />}
          </div>
          <IconButton icon="share" label={t('Del RepGrade med en venn', 'Share RepGrade with a friend')} className="-mr-1 text-muted" onClick={() => void shareApp()} />
          <Link to="/profile" aria-label={t('Profil', 'Profile')}>
            <Avatar name={profile?.name || user.name} color={profile?.color ?? '#34c56a'} size={44} />
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4 pt-5 pb-44">
        <InstallHint />
        <ProgramsBanner days={target} />
        <ImportBanner />
        <BackupReminder />

        {active && isLongAgo(active.started_at, now) && !keepGoing && (
          <Card className="border-warn/40 p-3.5">
            <div className="flex items-start gap-3">
              <Icon name="timer" className="mt-0.5 shrink-0 text-warn" />
              <div className="flex-1">
                <h2 className="font-semibold">{t('Glemte du å avslutte?', 'Forgot to finish?')}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  «{active.name}» {t('startet', 'started')}{' '}
                  {new Date(active.started_at).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={() => navigate('/workout', { state: { finish: true } })}>
                {t('Avslutt økta', 'Finish workout')}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setKeepGoing(true)}>
                {t('Fortsett', 'Keep going')}
              </Button>
            </div>
          </Card>
        )}

        {active && (
          <button type="button" onClick={() => navigate('/workout')} className="flex items-center gap-3 rounded-xl bg-accent p-4 text-left text-on-accent">
            <span className="grid size-11 place-items-center rounded-xl bg-black/15">
              <Icon name="play" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium opacity-75">{t('Økt pågår', 'Workout in progress')}</span>
              <span className="block text-lg font-bold">{active.name}</span>
            </span>
            <span className="font-num text-2xl font-bold">
              {isLongAgo(active.started_at, now) ? dateShort(active.started_at) : duration(now - new Date(active.started_at).getTime())}
            </span>
          </button>
        )}

        <Card className="p-5">
          <div className="flex items-center gap-5">
            <ProgressRing value={stats?.count ?? 0} max={target} label={t(`${stats?.count ?? 0} av ${target} økter denne uka`, `${stats?.count ?? 0} of ${target} workouts this week`)}>
              <div>
                <div className="font-num text-4xl leading-none font-bold">
                  {stats?.count ?? 0}
                  <span className="text-xl text-faint">/{target}</span>
                </div>
                <div className="mt-1 text-xs text-muted">{t('denne uka', 'this week')}</div>
              </div>
            </ProgressRing>
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-warn">
                  <Icon name="flame" size={18} />
                  <span className="font-num text-2xl font-bold text-ink">{stats?.streak ?? 0}</span>
                </div>
                <div className="text-xs text-muted">{stats?.streak === 1 ? t('uke på rad', 'week in a row') : t('uker på rad', 'weeks in a row')}</div>
              </div>
              <div>
                <div className="font-num text-2xl font-bold">{num(toDisplay(stats?.volume ?? 0, unit), 0)}</div>
                <div className="text-xs text-muted">{unit} {t('løftet denne uka', 'lifted this week')}</div>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <WeekStrip trained={stats?.days ?? Array(7).fill(false)} today={stats?.today ?? 0} />
          </div>
          {stats && stats.count >= target && (
            <p className="mt-4 rounded-xl bg-accent-soft/40 px-3 py-2 text-center text-sm font-medium text-accent-strong">{t('Ukemålet er nådd.', 'Weekly goal reached.')}</p>
          )}
        </Card>

        {!active && data?.next && (
          <Card className="p-5">
            <div className="text-sm font-semibold text-muted">{t('Neste økt', 'Next workout')}</div>
            <h2 className="mt-1 text-xl font-bold">{data.next.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{data.nextItems.map((i) => exerciseName(exMap.get(i.exercise_id))).join(' · ')}</p>
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
              {t('Start', 'Start')} {data.next.name}
            </Button>
          </Card>
        )}

        {!active && !data?.next && (
          <Button full icon="plus" className="min-h-14 text-lg" onClick={openStartSheet}>
            {t('Start økt', 'Start workout')}
          </Button>
        )}

        <RoutinesSection />

        {body && (
          <section aria-labelledby="body-map-title">
            <Card className="p-5">
              <h2 id="body-map-title" className="mb-2 text-[15px] font-semibold text-ink">
                {t('Trent kropp', 'Muscles trained')}
              </h2>
              <div className="mb-3">
                <RangePicker value={range} onChange={setRange} years={body.years} />
              </div>
              <BodyMap load={body.load} days={body.days} cardioSessions={body.cardio} period={rangeLabel(range)} />
            </Card>
          </section>
        )}

        <QuickLink to="/bodyweight" icon="scale" title={t('Kroppsvekt', 'Bodyweight')} />

        {stats && stats.recentPRs.length > 0 && (
          <section>
            <SectionTitle>{t('Siste rekorder', 'Latest records')}</SectionTitle>
            <Card className="divide-y divide-line">
              {stats.recentPRs.map((s) => (
                <Link key={s.id} to={`/exercise/${s.exercise_id}`} className="flex items-center gap-3 p-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent-soft/50 text-accent">
                    <Icon name="trophy" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{exerciseName(exMap.get(s.exercise_id))}</span>
                    <span className="block text-sm text-muted">{dateShort(s.completed_at!)}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-num block font-bold">{formatSetShort(s, kindOf(s.exercise_id), unit)}</span>
                    <PRBadge label={PR_LABEL[prMap.get(s.id)![0]]} />
                  </span>
                </Link>
              ))}
            </Card>
          </section>
        )}

        <NewsCard />
      </main>
    </div>
  );
}

function QuickLink({ to, icon, title }: { to: string; icon: 'scale'; title: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 rounded-xl p-4 active:bg-raised">
      <Icon name={icon} className="text-accent" />
      <span className="flex-1 font-semibold">{title}</span>
      <Icon name="chevron" size={18} className="text-faint" />
    </Link>
  );
}
