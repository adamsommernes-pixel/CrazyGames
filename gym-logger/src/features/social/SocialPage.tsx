import { useUser } from '../../auth/AuthProvider';
import { EmptyState, Page } from '../../components/ui';
import { t } from '../../i18n';

/** Sosialt-fanen. Bygges ut steg for steg (følgere, aktivitet, ledertavler, utfordringer). */
export function SocialPage() {
  const user = useUser();
  return (
    <Page title={t('Sosialt', 'Social')}>
      {user.kind === 'cloud' ? (
        <EmptyState
          icon="users"
          title={t('Sosialt kommer snart', 'Social is coming soon')}
          text={t('Her kommer følgere, aktivitet, ledertavler og utfordringer.', 'Followers, activity, leaderboards and challenges are coming here.')}
        />
      ) : (
        <EmptyState
          icon="cloud"
          title={t('Krever konto på nett', 'Needs an online account')}
          text={t(
            'Sosialt virker bare med en konto som er lagret på nett. Denne kontoen er bare lagret på enheten.',
            'Social only works with an account that is stored online. This account is only stored on this device.',
          )}
        />
      )}
    </Page>
  );
}
