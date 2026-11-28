import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Chip, EmptyState } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { TierEmblem } from '../../components/TierBadge';
import { social, type Board, type BoardScope, type LeaderboardRow } from '../../social';
import { errorText, useMySocial } from '../../social/store';
import { num } from '../../lib/format';
import { locale, t } from '../../i18n';

// Tre ledertavler: sterkest (styrkenivå), størst fremgang denne måneden og flest økter denne måneden.
// Bare for kontoer med synlighet Ledertavler eller Åpen, og bare de vises på tavlene.

type Shown = Exclude<Board, 'lift'>;
const BOARDS: Shown[] = ['level', 'gain', 'workouts'];

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

function boardName(b: Shown) {
  return b === 'level' ? t('Sterkest', 'Strongest') : b === 'gain' ? t('Fremgang', 'Most improved') : t('Flest økter', 'Most workouts');
}

function boardText(b: Shown) {
  const month = monthStart().toLocaleDateString(locale(), { month: 'long' });
  if (b === 'level') return t('Styrkenivå i forhold til kroppsvekt. Samme regler for alle.', 'Strength level relative to bodyweight. Same rules for everyone.');
  if (b === 'gain') return t(`Nivåpoeng økt i ${month}.`, `Level points gained in ${month}.`);
  return t(`Delte økter i ${month}.`, `Shared workouts in ${month}.`);
}

function valueText(b: Shown, v: number) {
  if (b === 'level') return `${num(v, 1)} ${t('p', 'pts')}`;
  if (b === 'gain') return `+${num(v, 1)} ${t('p', 'pts')}`;
  return t(`${v} ${v === 1 ? 'økt' : 'økter'}`, `${v} ${v === 1 ? 'workout' : 'workouts'}`);
}

export function LeaderboardTab() {
  const { profile } = useMySocial();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Shown>('level');
  const [scope, setScope] = useState<BoardScope>('all');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = !!profile && profile.visibility >= 2;
  const since = useMemo(() => monthStart().toISOString(), []);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    setRows(null);
    setError(null);
    void social()
      ?.leaderboard(board, scope, undefined, board === 'level' ? undefined : since)
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [allowed, board, scope, since]);

  if (!profile) return null;
  if (!allowed) {
    return (
      <EmptyState
        icon="trophy"
        title={t('Ledertavlene er låst', 'Leaderboards are locked')}
        text={
          profile.is_16_plus
            ? t('Velg synlighet «Ledertavler» eller «Åpen» for å se ledertavlene og være med på dem. Kroppsvekten din vises aldri.', 'Choose the “Leaderboards” or “Open” setting to see the leaderboards and be on them. Your bodyweight is never shown.')
            : t('Ledertavlene er for deg som er 16 år eller eldre.', 'Leaderboards are for people aged 16 or older.')
        }
      >
        {profile.is_16_plus && (
          <Button full variant="secondary" onClick={() => navigate('/profile')}>
            {t('Endre synlighet i Profil', 'Change it in Profile')}
          </Button>
        )}
      </EmptyState>
    );
  }

  const me = profile.user_id;
  const mine = rows?.find((r) => r.user_id === me);
  return (
    <div>
      <div className="mb-2 flex gap-2 overflow-x-auto" role="radiogroup" aria-label={t('Ledertavle', 'Leaderboard')}>
        {BOARDS.map((b) => (
          <Chip key={b} active={board === b} onClick={() => setBoard(b)}>
            {boardName(b)}
          </Chip>
        ))}
      </div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{boardText(board)}</p>
        <div className="flex shrink-0 gap-1.5">
          <Chip active={scope === 'all'} onClick={() => setScope('all')}>
            {t('Alle', 'Everyone')}
          </Chip>
          <Chip active={scope === 'following'} onClick={() => setScope('following')}>
            {t('Følger', 'Following')}
          </Chip>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : rows === null ? (
        <p className="py-8 text-center text-muted" role="status">
          {t('Laster …', 'Loading …')}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {board === 'gain'
            ? t('Ingen har økt nivået sitt denne måneden ennå.', 'Nobody has raised their level this month yet.')
            : t('Ingen på denne tavla ennå.', 'Nobody on this board yet.')}
        </p>
      ) : (
        <>
          <Card>
            <ol aria-label={boardName(board)} className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.user_id} data-rank={r.rank} className={`flex min-h-14 items-center gap-3 px-3 py-2 ${r.user_id === me ? 'bg-accent-soft/30' : ''}`} aria-current={r.user_id === me ? 'true' : undefined}>
                  <span className={`font-num w-7 text-center text-lg font-bold ${r.rank <= 3 ? 'text-accent-strong' : 'text-faint'}`}>{r.rank}</span>
                  <Link to={`/u/${r.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={r.display_name} color={r.color} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {r.display_name}
                        {r.user_id === me && <span className="text-faint"> ({t('deg', 'you')})</span>}
                      </span>
                      <span className="block truncate text-xs text-faint">@{r.handle}</span>
                    </span>
                  </Link>
                  {r.tier_index !== null && <TierEmblem index={r.tier_index} size={24} />}
                  <span className="font-num w-20 text-right font-semibold">{valueText(board, r.value)}</span>
                </li>
              ))}
            </ol>
          </Card>
          {!mine && (
            <p className="mt-3 text-center text-sm text-muted">
              {board === 'level'
                ? t('Du er ikke på tavla ennå. Logg et løft som teller i styrkenivået.', "You're not on the board yet. Log a lift that counts towards your strength level.")
                : t('Du er ikke på tavla ennå denne måneden.', "You're not on the board yet this month.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
