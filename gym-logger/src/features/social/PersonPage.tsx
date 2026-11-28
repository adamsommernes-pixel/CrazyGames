import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { ActionList, Button, Card, EmptyState, IconButton, Page, Sheet } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { TierEmblem } from '../../components/TierBadge';
import { Icon } from '../../components/Icon';
import { askConfirm } from '../../components/confirm';
import { showToast } from '../../components/toast';
import { social, socialAvailable, type Person } from '../../social';
import { block, rememberPerson, relationTo, removeFollower, useGraph } from '../../social/graph';
import { errorText, useMySocial } from '../../social/store';
import { VISIBILITY_ICON, visibilityName } from '../../social/visibility';
import { tierAt } from '../../lib/strength';
import { setSocialMode, useSocialMode } from '../../lib/socialMode';
import { FollowButton } from './FollowButton';
import { ReportSheet } from './ReportSheet';
import { t } from '../../i18n';

/** Profilen til en annen bruker (/u/brukernavn), også målet for invitasjonslenker. */
export function PersonPage() {
  const { handle = '' } = useParams();
  const user = useUser();
  const socialMode = useSocialMode();
  const navigate = useNavigate();
  const { profile: mine, status: myStatus } = useMySocial();
  const g = useGraph();
  const [person, setPerson] = useState<Person | null | 'none'>(null);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);

  useEffect(() => {
    if (!socialMode || !mine) return;
    let live = true;
    void social()
      ?.findByHandle(handle)
      .then((p) => {
        if (!live) return;
        if (p) rememberPerson(p);
        setPerson(p ?? 'none');
      })
      .catch((e) => live && (showToast(errorText(e)), setPerson('none')));
    return () => {
      live = false;
    };
  }, [handle, socialMode, mine]);

  // Invitasjon før sosial konto er satt opp: forklar og hjelp videre.
  if (!socialAvailable(user)) {
    return (
      <Page title={`@${handle}`} back>
        <EmptyState icon="cloud" title={t('Krever konto på nett', 'Needs an online account')} text={t('For å følge andre trenger du en konto som er lagret på nett.', 'To follow others you need an account that is stored online.')} />
      </Page>
    );
  }
  if (!socialMode || (myStatus === 'ready' && !mine)) {
    return (
      <Page title={`@${handle}`} back>
        <EmptyState icon="users" title={t(`Følg @${handle}`, `Follow @${handle}`)} text={t('Bytt til sosial konto og lag en sosial profil for å følge andre.', 'Switch to a social account and create a social profile to follow others.')}>
          <Button
            full
            onClick={() =>
              void (async () => {
                if (!socialMode) await setSocialMode(user.id, true);
                navigate('/social', { state: { then: `/u/${handle}` } });
              })()
            }
          >
            {t('Kom i gang med Sosialt', 'Get started with Social')}
          </Button>
        </EmptyState>
      </Page>
    );
  }
  if (person === null) return <Page title={`@${handle}`} back>{null}</Page>;
  if (person === 'none') {
    return (
      <Page title={`@${handle}`} back>
        <EmptyState icon="search" title={t('Fant ikke brukeren', 'User not found')} text={t(`Ingen bruker heter @${handle}.`, `No user is called @${handle}.`)} />
      </Page>
    );
  }

  const me = g.me;
  const rel = me ? relationTo(g.rel, me, person.user_id) : 'none';
  const followsMe = g.rel.followers.includes(person.user_id);
  const self = rel === 'self';

  return (
    <Page title={person.display_name} back actions={!self && <IconButton icon="more" label={t('Valg', 'Options')} onClick={() => setMenu(true)} />}>
      <div className="flex flex-col items-center pt-2 pb-4 text-center">
        <Avatar name={person.display_name} color={person.color} size={80} />
        <h2 className="mt-3 text-2xl font-bold">{person.display_name}</h2>
        <p className="text-muted">@{person.handle}</p>
        {person.visibility && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
            <Icon name={VISIBILITY_ICON[person.visibility]} size={12} />
            {visibilityName(person.visibility)}
          </span>
        )}
        {followsMe && <span className="mt-2 text-xs text-faint">{t('Følger deg', 'Follows you')}</span>}
        <div className="mt-4">
          <FollowButton person={person} />
        </div>
      </div>

      <PersonLevel personId={person.user_id} />

      {!self && rel !== 'following' && person.visibility !== 3 && (
        <EmptyState icon="lock" title={t('Privat profil', 'Private profile')} text={t('Følg for å se øktene og nivået.', 'Follow to see their workouts and level.')} />
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={person.display_name}>
        <ActionList
          actions={[
            ...(followsMe
              ? [{ label: t('Fjern som følger', 'Remove follower'), icon: 'x' as const, onClick: async () => {
                  setMenu(false);
                  if (await askConfirm(t(`Fjerne ${person.display_name} som følger? Personen får ikke beskjed.`, `Remove ${person.display_name} as a follower? They won't be notified.`), { confirmLabel: t('Fjern', 'Remove') })) {
                    await removeFollower(person.user_id).catch((e) => showToast(errorText(e)));
                  }
                } }]
              : []),
            { label: t('Rapporter', 'Report'), icon: 'info' as const, onClick: () => {
                setMenu(false);
                setReport(true);
              } },
            { label: t('Blokker', 'Block'), icon: 'lock' as const, danger: true, onClick: async () => {
                setMenu(false);
                const ok = await askConfirm(
                  t(`${person.display_name} kan ikke se profilen din, finne deg eller følge deg, og dere slutter å følge hverandre. Personen får ikke beskjed.`, `${person.display_name} won't be able to see your profile, find you or follow you, and you'll stop following each other. They won't be notified.`),
                  { title: t(`Blokkere ${person.display_name}?`, `Block ${person.display_name}?`), confirmLabel: t('Blokker', 'Block') },
                );
                if (!ok) return;
                try {
                  await block(person.user_id);
                  showToast(t(`${person.display_name} er blokkert`, `${person.display_name} is blocked`));
                  navigate('/social', { replace: true });
                } catch (e) {
                  showToast(errorText(e));
                }
              } },
          ]}
        />
      </Sheet>
      <ReportSheet person={person} open={report} onClose={() => setReport(false)} />
    </Page>
  );
}

/** Nivået, når du har lov til å se den sosiale profilen (følger, åpen eller ledertavle). */
function PersonLevel({ personId }: { personId: string }) {
  const [tier, setTier] = useState<{ index: number; score: number | null } | null>(null);
  const g = useGraph();
  useEffect(() => {
    let live = true;
    void social()
      ?.profiles([personId])
      .then((ps) => live && setTier(ps[0]?.tier_index != null ? { index: ps[0].tier_index, score: ps[0].score } : null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [personId, g.rel]);
  if (!tier) return null;
  return (
    <Card className="mb-4 flex items-center gap-3 p-3.5">
      <TierEmblem index={tier.index} size={44} />
      <div>
        <div className="text-xs text-muted">{t('Styrkenivå', 'Strength level')}</div>
        <div className="text-lg font-bold">{tierAt(tier.index).name}</div>
      </div>
    </Card>
  );
}
