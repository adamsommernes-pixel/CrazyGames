import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, Page, SectionTitle } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { askConfirm } from '../../components/confirm';
import { showToast } from '../../components/toast';
import { social, type Standing } from '../../social';
import { kindName, kindText, phaseOf, timeLeft, valueText } from '../../social/challenges';
import { useChallenges } from '../../social/useChallenges';
import { errorText } from '../../social/store';
import { useSetting } from '../../lib/settings';
import { dateShort } from '../../lib/format';
import { t } from '../../i18n';

/** Én utfordring: hva det gjelder, stillingen (regnet av serveren), hvem som er invitert, forlat/avlys. */
export function ChallengePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const { data, error, reload, person, me } = useChallenges();
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [standError, setStandError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void social()
      ?.standings(id)
      .then((s) => live && setStandings(s))
      .catch((e) => live && setStandError(errorText(e)));
    return () => {
      live = false;
    };
  }, [id, data]);

  const c = data?.challenges.find((x) => x.id === id);
  if (error && !data) return <Page title={t('Utfordring', 'Challenge')} back><p className="text-danger">{error}</p></Page>;
  if (!data) return <Page title={t('Utfordring', 'Challenge')} back>{null}</Page>;
  if (!c) {
    return (
      <Page title={t('Utfordring', 'Challenge')} back>
        <EmptyState icon="trophy" title={t('Fant ikke utfordringen', "Couldn't find the challenge")} text={t('Den kan være avlyst, eller du er ikke med.', 'It may have been cancelled, or you are not in it.')} />
      </Page>
    );
  }
  const phase = phaseOf(c);
  const mine = data.members.find((m) => m.challenge_id === c.id && m.user_id === me);
  const invited = data.members.filter((m) => m.challenge_id === c.id && m.status === 'invited');
  const creator = c.creator === me;
  const winner = phase === 'ended' && standings?.[0] && standings[0].value > 0 ? standings.filter((s) => s.rank === 1) : [];

  const leave = async () => {
    const ok = await askConfirm(
      creator ? t('Avlyse utfordringen for alle?', 'Cancel the challenge for everyone?') : t('Forlate utfordringen?', 'Leave the challenge?'),
      { confirmLabel: creator ? t('Avlys', 'Cancel challenge') : t('Forlat', 'Leave') },
    );
    if (!ok) return;
    try {
      await social()!.leaveChallenge(c.id);
      navigate('/social', { replace: true });
    } catch (e) {
      showToast(errorText(e));
    }
  };

  return (
    <Page title={c.title} back>
      <Card className="p-3.5">
        <div className="text-sm font-semibold text-accent">{kindName(c.kind)}</div>
        <p className="mt-1 text-sm text-muted">{kindText(c.kind, c.target, c.exercise_id)}</p>
        <p className="mt-2 text-xs text-faint">
          {dateShort(c.starts_at)} – {dateShort(c.ends_at)} · {phase === 'ended' ? t('Ferdig', 'Finished') : timeLeft(c)}
        </p>
      </Card>

      {winner.length > 0 && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent-soft/40 px-4 py-3 text-center font-semibold text-accent-strong">
          🏆 {winner.map((w) => (w.user_id === me ? t('Du', 'You') : (person(w.user_id)?.display_name ?? '…'))).join(' & ')} {t('vant', 'won')}
        </div>
      )}

      {mine?.status === 'invited' && phase !== 'ended' && (
        <div className="mt-3 flex gap-2">
          <Button full onClick={() => void social()!.respondChallenge(c.id, true).then(reload).catch((e) => showToast(errorText(e)))}>
            {t('Bli med', 'Join')}
          </Button>
          <Button full variant="secondary" onClick={() => void social()!.respondChallenge(c.id, false).then(() => navigate('/social', { replace: true })).catch((e) => showToast(errorText(e)))}>
            {t('Avslå', 'Decline')}
          </Button>
        </div>
      )}

      <SectionTitle>{t('Stilling', 'Standings')}</SectionTitle>
      {standError ? (
        <p className="text-sm text-danger">{standError}</p>
      ) : !standings ? (
        <p className="text-sm text-muted" role="status">
          {t('Laster …', 'Loading …')}
        </p>
      ) : (
        <Card>
          <ol aria-label={t('Stilling', 'Standings')} className="divide-y divide-line">
            {standings.map((s) => {
              const p = person(s.user_id);
              const you = s.user_id === me;
              return (
                <li key={s.user_id} data-standing={p?.handle} className={`flex min-h-14 items-center gap-3 px-3 py-2 ${you ? 'bg-accent-soft/30' : ''}`}>
                  <span className={`font-num w-6 text-center text-lg font-bold ${s.rank === 1 && s.value > 0 ? 'text-accent-strong' : 'text-faint'}`}>{s.rank}</span>
                  <Avatar name={p?.display_name ?? '?'} color={p?.color ?? '#6c6c72'} size={34} />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {p?.display_name ?? '…'}
                    {you && <span className="text-faint"> ({t('deg', 'you')})</span>}
                  </span>
                  <span className="font-num font-semibold">{valueText(c, s.value, unit)}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
      {c.kind !== 'workouts' && <p className="mt-2 text-xs text-faint">{t('Regnes ut fra øktene som er delt i feeden.', 'Calculated from the workouts shared in the feed.')}</p>}

      {invited.length > 0 && (
        <>
          <SectionTitle>{t('Venter på svar', 'Waiting for an answer')}</SectionTitle>
          <p className="text-sm text-muted">{invited.map((m) => person(m.user_id)?.display_name ?? '…').join(', ')}</p>
        </>
      )}

      {mine?.status === 'joined' && (
        <Button full variant="danger" className="mt-8" onClick={() => void leave()}>
          {creator ? t('Avlys utfordringen', 'Cancel the challenge') : t('Forlat utfordringen', 'Leave the challenge')}
        </Button>
      )}
    </Page>
  );
}
