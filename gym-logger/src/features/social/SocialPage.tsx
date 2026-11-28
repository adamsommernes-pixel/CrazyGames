import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { useGraph } from '../../social/graph';
import { PeopleTab } from './PeopleTab';
import { FeedList } from './FeedList';
import { LeaderboardTab } from './LeaderboardTab';
import { ChallengesTab } from './ChallengesTab';
import { useInbox } from '../../social/inbox';
import { Icon } from '../../components/Icon';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { socialAvailable } from '../../social';
import { useMySocial } from '../../social/store';
import { SocialSetup } from './SocialSetup';
import { SocialProfileHeader } from './SocialProfileHeader';
import { t } from '../../i18n';

/** Sosialt-fanen. Første gang: lag sosial profil. Feed, følgere, ledertavler og utfordringer kommer i neste steg. */
export function SocialPage() {
  const user = useUser();
  if (!socialAvailable(user)) {
    return (
      <Page title={t('Sosialt', 'Social')}>
        <EmptyState
          icon="cloud"
          title={t('Krever konto på nett', 'Needs an online account')}
          text={t(
            'Sosialt virker bare med en konto som er lagret på nett. Denne kontoen er bare lagret på enheten.',
            'Social only works with an account that is stored online. This account is only stored on this device.',
          )}
        />
      </Page>
    );
  }
  return <SocialHome />;
}

function SocialHome() {
  const { status, profile, error, refresh } = useMySocial();
  if (status === 'idle' || status === 'loading') {
    return (
      <Page title={t('Sosialt', 'Social')}>
        <p className="py-12 text-center text-muted" role="status">
          {t('Laster …', 'Loading …')}
        </p>
      </Page>
    );
  }
  if (status === 'error' && !profile) {
    return (
      <Page title={t('Sosialt', 'Social')}>
        <EmptyState icon="cloud" title={t('Kunne ikke laste Sosialt', "Couldn't load Social")} text={error ?? undefined}>
          <Button full onClick={() => void refresh()}>
            {t('Prøv igjen', 'Try again')}
          </Button>
        </EmptyState>
      </Page>
    );
  }
  if (!profile) {
    return (
      <Page title={t('Lag sosial profil', 'Create social profile')}>
        <p className="mb-5 text-muted">
          {t(
            'Velg hvordan andre finner deg og hva de får se. Du kan endre alt senere under Profil.',
            'Choose how others find you and what they get to see. You can change everything later under Profile.',
          )}
        </p>
        <SocialSetup onSaved={() => {}} />
      </Page>
    );
  }
  return <SocialTabs />;
}

type Tab = 'feed' | 'people' | 'boards' | 'challenges';
const TAB_KEY = 'repgrade-social-tab';

/** Åpne en bestemt fane neste gang Sosialt vises (f.eks. fra et varsel). */
export function openSocialTab(tab: Tab) {
  try {
    sessionStorage.setItem(TAB_KEY, tab);
  } catch {
    /* ignorer */
  }
}

function SocialTabs() {
  const { profile } = useMySocial();
  const g = useGraph();
  const inbox = useInbox();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = sessionStorage.getItem(TAB_KEY);
      return saved === 'people' || saved === 'boards' || saved === 'challenges' ? saved : 'feed';
    } catch {
      return 'feed';
    }
  });
  const choose = (next: Tab) => {
    setTab(next);
    try {
      sessionStorage.setItem(TAB_KEY, next);
    } catch {
      /* ignorer */
    }
  };
  // Kom vi hit fra en invitasjon før profilen fantes? Gå videre dit nå.
  const then = (location.state as { then?: string } | null)?.then;
  useEffect(() => {
    if (then) navigate(then, { replace: true });
  }, [then, navigate]);
  if (!profile) return null;
  const requests = g.rel.requests.length;
  const tabClass = (on: boolean) => `relative flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1 text-[13px] font-semibold transition-colors ${on ? 'bg-raised text-ink' : 'text-muted'}`;
  const bell = (
    <button type="button" onClick={() => navigate('/inbox')} aria-label={inbox.unread ? t(`Varsler, ${inbox.unread} nye`, `Notifications, ${inbox.unread} new`) : t('Varsler', 'Notifications')} className="relative grid size-11 place-items-center rounded-lg text-muted active:bg-raised">
      <Icon name="bell" />
      {inbox.unread > 0 && (
        <span className="absolute top-1.5 right-1.5 grid min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10px] leading-4.5 font-bold text-on-accent" aria-hidden="true">
          {inbox.unread > 9 ? '9+' : inbox.unread}
        </span>
      )}
    </button>
  );
  return (
    <Page title={t('Sosialt', 'Social')} actions={bell}>
      <Card className="mb-3 p-3.5">
        <SocialProfileHeader profile={profile} />
      </Card>
      <div role="tablist" aria-label={t('Sosialt', 'Social')} className="mb-4 flex gap-1 rounded-xl border border-line bg-surface p-1">
        <button type="button" role="tab" aria-selected={tab === 'feed'} className={tabClass(tab === 'feed')} onClick={() => choose('feed')}>
          {t('Feed', 'Feed')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'people'} className={tabClass(tab === 'people')} onClick={() => choose('people')}>
          {t('Folk', 'People')}
          {requests > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent" aria-label={t(`${requests} forespørsler`, `${requests} requests`)}>
              {requests}
            </span>
          )}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'boards'} className={tabClass(tab === 'boards')} onClick={() => choose('boards')}>
          {t('Topp', 'Top')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'challenges'} className={tabClass(tab === 'challenges')} onClick={() => choose('challenges')}>
          {t('Utfordringer', 'Challenges')}
        </button>
      </div>
      {tab === 'people' ? (
        <PeopleTab />
      ) : tab === 'boards' ? (
        <LeaderboardTab />
      ) : tab === 'challenges' ? (
        <ChallengesTab />
      ) : (
        <FeedList onFindPeople={() => choose('people')} />
      )}
    </Page>
  );
}
