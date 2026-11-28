import { useNavigate } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { Card } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { setSocialMode, useSocialMode } from '../../lib/socialMode';
import { socialAvailable } from '../../social';
import { t } from '../../i18n';

/** Velg kontotype i Profil: bare trening (appen som før) eller sosial. */
export function AccountTypeCard() {
  const user = useUser();
  const social = useSocialMode();
  const navigate = useNavigate();
  const cloud = socialAvailable(user);
  return (
    <Card className="p-1.5">
      <div role="radiogroup" aria-label={t('Kontotype', 'Account type')} className="flex flex-col gap-1">
        <Option
          icon="dumbbell"
          title={t('Trening', 'Training')}
          text={t('Bare din egen trening. Appen er som før.', 'Just your own training. The app stays as it is.')}
          checked={!social}
          onSelect={() => void setSocialMode(user.id, false)}
        />
        <Option
          icon="users"
          title={t('Sosial', 'Social')}
          text={
            cloud
              ? t('Følg venner, se aktivitet og utfordre hverandre. Historikk flyttes inn under Fremgang.', 'Follow friends, see activity and challenge each other. History moves into Progress.')
              : t('Krever en konto på nett.', 'Needs an online account.')
          }
          checked={social}
          disabled={!cloud && !social}
          onSelect={() => void setSocialMode(user.id, true).then(() => !social && navigate('/social'))}
        />
      </div>
    </Card>
  );
}

function Option({ icon, title, text, checked, disabled, onSelect }: { icon: IconName; title: string; text: string; checked: boolean; disabled?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors disabled:opacity-50 ${checked ? 'bg-raised' : 'active:bg-raised'}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${checked ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-muted'}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-faint">{text}</span>
      </span>
      <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-accent bg-accent text-on-accent' : 'border-line'}`} aria-hidden="true">
        {checked && <Icon name="check" size={12} strokeWidth={3} />}
      </span>
    </button>
  );
}
