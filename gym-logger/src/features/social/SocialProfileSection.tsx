import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, SectionTitle, Sheet } from '../../components/ui';
import type { Person } from '../../social';
import { useMySocial } from '../../social/store';
import { useSocialMode } from '../../lib/socialMode';
import { showToast } from '../../components/toast';
import { SocialSetup } from './SocialSetup';
import { SocialProfileHeader } from './SocialProfileHeader';
import { KeepFollowersSheet, followersToReview } from './KeepFollowersSheet';
import { t } from '../../i18n';

/** Profil → Sosial profil (bare på sosial konto): se og endre navn, brukernavn og synlighet. */
export function SocialProfileSection() {
  const social = useSocialMode();
  const { profile, status } = useMySocial();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState<Person[]>([]);
  if (!social) return null;
  return (
    <>
      <SectionTitle>{t('Sosial profil', 'Social profile')}</SectionTitle>
      <Card className="p-3.5">
        {profile ? (
          <>
            <SocialProfileHeader profile={profile} />
            <Button variant="secondary" icon="edit" full className="mt-3" onClick={() => setEditing(true)}>
              {t('Endre sosial profil', 'Edit social profile')}
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {status === 'error'
                ? t('Kunne ikke hente den sosiale profilen. Har du nett?', "Couldn't load your social profile. Are you online?")
                : t('Du har ikke laget en sosial profil ennå.', "You haven't created a social profile yet.")}
            </p>
            <Button full onClick={() => navigate('/social')}>
              {t('Lag sosial profil', 'Create social profile')}
            </Button>
          </div>
        )}
      </Card>
      <Sheet open={editing} onClose={() => setEditing(false)} title={t('Sosial profil', 'Social profile')} tall>
        {editing && profile && (
          <SocialSetup
            existing={profile}
            onSaved={async (p, before) => {
              setEditing(false);
              showToast(t('Sosial profil lagret', 'Social profile saved'));
              setReview(await followersToReview(p, before));
            }}
          />
        )}
      </Sheet>
      <KeepFollowersSheet people={review} onClose={() => setReview([])} />
    </>
  );
}
