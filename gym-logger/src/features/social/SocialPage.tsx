import { useUser } from '../../auth/AuthProvider';
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
  return (
    <Page title={t('Sosialt', 'Social')}>
      <Card className="p-3.5">
        <SocialProfileHeader profile={profile} />
      </Card>
      <EmptyState
        icon="users"
        title={t('Feeden kommer snart', 'The feed is coming soon')}
        text={t('Her kommer øktene til dem du følger, ledertavler og utfordringer.', 'Workouts from people you follow, leaderboards and challenges are coming here.')}
      />
    </Page>
  );
}
