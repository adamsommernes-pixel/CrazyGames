import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { showToast } from '../../components/toast';
import { social, type Challenge } from '../../social';
import { groupChallenges, kindName, timeLeft } from '../../social/challenges';
import { useChallenges } from '../../social/useChallenges';
import { errorText } from '../../social/store';
import { CreateChallengeSheet } from './CreateChallengeSheet';
import { dateShort } from '../../lib/format';
import { t } from '../../i18n';

/** Utfordringer: invitasjoner, pågående og ferdige, og knapp for ny. */
export function ChallengesTab() {
  const { data, error, reload, person, me } = useChallenges();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  if (error && !data) return <p className="text-sm text-danger">{error}</p>;
  if (!data || !me) {
    return (
      <p className="py-8 text-center text-muted" role="status">
        {t('Laster …', 'Loading …')}
      </p>
    );
  }
  const { invites, active, ended } = groupChallenges(data.challenges, data.members, me);
  const count = (c: Challenge) => data.members.filter((m) => m.challenge_id === c.id && m.status === 'joined').length;

  const respond = async (c: Challenge, accept: boolean) => {
    try {
      await social()!.respondChallenge(c.id, accept);
      showToast(accept ? t('Du er med!', "You're in!") : t('Invitasjonen er avslått', 'Invitation declined'));
      await reload();
    } catch (e) {
      showToast(errorText(e));
    }
  };

  // Invitasjoner (stacked): tittel og info over hele bredden, knappene under, så ingenting kuttes.
  const row = (c: Challenge, right: React.ReactNode, stacked = false) => (
    <li key={c.id} className={`flex gap-3 px-3 py-2 ${stacked ? 'flex-col py-3' : 'min-h-16 items-center'}`} data-challenge={c.title}>
      <Link to={`/challenge/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-accent">
          <Icon name="trophy" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${stacked ? 'line-clamp-2' : 'truncate'}`}>{c.title}</span>
          <span className={`block text-xs text-faint ${stacked ? '' : 'truncate'}`}>
            {invites.includes(c) ? t(`Fra ${person(c.creator)?.display_name ?? '…'}`, `From ${person(c.creator)?.display_name ?? '…'}`) : kindName(c.kind)} · {t(`${count(c)} med`, `${count(c)} in`)} ·{' '}
            {right === null ? t(`ferdig ${dateShort(c.ends_at)}`, `ended ${dateShort(c.ends_at)}`) : timeLeft(c)}
          </span>
        </span>
      </Link>
      {right}
    </li>
  );

  return (
    <div className="flex flex-col">
      <Button full icon="plus" onClick={() => setCreating(true)}>
        {t('Ny utfordring', 'New challenge')}
      </Button>

      {invites.length > 0 && (
        <>
          <SectionTitle>{t(`Invitasjoner (${invites.length})`, `Invitations (${invites.length})`)}</SectionTitle>
          <Card>
            <ul className="divide-y divide-line">
              {invites.map((c) =>
                row(
                  c,
                  <span className="flex gap-2 pl-13">
                    <Button className="min-h-10 flex-1 px-3 text-sm" onClick={() => void respond(c, true)}>
                      {t('Bli med', 'Join')}
                    </Button>
                    <Button variant="secondary" aria-label={t(`Avslå ${c.title}`, `Decline ${c.title}`)} className="min-h-10 flex-1 px-3 text-sm" onClick={() => void respond(c, false)}>
                      {t('Avslå', 'Decline')}
                    </Button>
                  </span>,
                  true,
                ),
              )}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>{t('Pågår', 'Active')}</SectionTitle>
      {active.length ? (
        <Card>
          <ul className="divide-y divide-line">{active.map((c) => row(c, <Icon name="chevron" size={18} className="shrink-0 text-faint" />))}</ul>
        </Card>
      ) : (
        <EmptyState icon="trophy" title={t('Ingen utfordringer ennå', 'No challenges yet')} text={t('Utfordre en venn: flest økter, mest volum, ukemål eller et løft.', 'Challenge a friend: most workouts, most volume, a weekly goal or a lift.')} />
      )}

      {ended.length > 0 && (
        <>
          <SectionTitle>{t('Ferdige', 'Finished')}</SectionTitle>
          <Card>
            <ul className="divide-y divide-line">{ended.map((c) => row(c, null))}</ul>
          </Card>
        </>
      )}

      <CreateChallengeSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          navigate(`/challenge/${id}`);
        }}
      />
    </div>
  );
}
