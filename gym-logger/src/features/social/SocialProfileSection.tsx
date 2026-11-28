import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, SectionTitle, Sheet } from '../../components/ui';
import type { Person, SocialProfile } from '../../social';
import { errorText, setMySuggestable, useMySocial } from '../../social/store';
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
            <SuggestableSetting profile={profile} />
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

/** «Vis meg i forslag»: private kontoer (16+) kan slå av at de foreslås for andre. Åpne vises alltid. */
export function SuggestableSetting({ profile }: { profile: SocialProfile }) {
  const [busy, setBusy] = useState(false);
  const on = profile.suggestable !== false;
  const note =
    !profile.is_16_plus
      ? t('Under 16 år blir du aldri foreslått for andre.', "Under 16 you're never suggested to others.")
      : profile.visibility === 3
        ? t('Åpne kontoer vises alltid i Oppdag og forslag.', 'Open accounts always show up in Discover and suggestions.')
        : on
          ? t('Andre kan se navnet, @brukernavnet og fargen din i forslag og søk. Øktene og nivået ditt er skjult til du godtar dem.', 'Others can see your name, @username and colour in suggestions and search. Your workouts and level stay hidden until you accept them.')
          : t('Du vises ikke i forslag eller navnesøk. Venner finner deg fortsatt på hele @brukernavnet.', "You don't show up in suggestions or name search. Friends can still find you by your full @username.");
  const disabled = busy || !profile.is_16_plus || profile.visibility === 3;
  const toggle = async () => {
    setBusy(true);
    try {
      await setMySuggestable(!on);
      showToast(on ? t('Du vises ikke lenger i forslag', 'You no longer show up in suggestions') : t('Du kan foreslås for andre', 'You can be suggested to others'));
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const shown = profile.is_16_plus && (profile.visibility === 3 || on);
  return (
    <div className="mt-3 border-t border-line pt-2">
      <button type="button" role="switch" aria-checked={shown} disabled={disabled} onClick={() => void toggle()} className="flex min-h-12 w-full items-center justify-between gap-3 text-left disabled:opacity-60">
        <span>{t('Vis meg i forslag', 'Show me in suggestions')}</span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${shown ? 'bg-accent' : 'bg-line'}`}>
          <span className={`absolute top-0.5 size-6 rounded-full bg-ink shadow transition-all ${shown ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>
      <p className="text-xs text-faint">{note}</p>
    </div>
  );
}
