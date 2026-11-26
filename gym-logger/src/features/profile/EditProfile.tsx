import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { PROFILE_COLORS, getProfile, saveProfile } from '../../db/repo';
import { EXPERIENCE, EXPERIENCE_LABEL, GOALS, GOAL_LABEL, type Profile } from '../../db/types';
import { Button, Chip, NumberStepper, Page, SectionTitle, inputClass } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { parseNum } from '../../lib/format';
import { t } from '../../i18n';

export function EditProfile() {
  const user = useUser();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [height, setHeight] = useState('');
  const [born, setBorn] = useState('');

  useEffect(() => {
    void getProfile(user.id).then((prof) => {
      if (!prof) return;
      setP(prof);
      setHeight(prof.height_cm ? String(prof.height_cm) : '');
      setBorn(prof.birth_year ? String(prof.birth_year) : '');
    });
  }, [user.id]);

  if (!p) return <Page title={t('Rediger profil', 'Edit profile')} back>{null}</Page>;
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });

  const save = async () => {
    const h = parseNum(height);
    const b = Math.round(parseNum(born));
    await saveProfile(user.id, {
      name: p.name.trim() || user.name,
      color: p.color,
      goal: p.goal,
      weekly_target: p.weekly_target,
      experience: p.experience,
      height_cm: h > 0 ? h : null,
      birth_year: b > 1900 && b <= new Date().getFullYear() ? b : null,
    });
    navigate(-1);
  };

  return (
    <Page
      title={t('Rediger profil', 'Edit profile')}
      back
      actions={
        <Button className="min-h-10 px-4" onClick={() => void save()}>
          {t('Lagre', 'Save')}
        </Button>
      }
    >
      <div className="flex items-center gap-4">
        <Avatar name={p.name || '?'} color={p.color} size={64} />
        <label className="flex-1">
          <span className="sr-only">{t('Navn', 'Name')}</span>
          <input id="edit-name" className={inputClass} value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
      </div>
      <div className="mt-4 flex gap-3" role="radiogroup" aria-label={t('Profilfarge', 'Profile colour')}>
        {PROFILE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === p.color}
            aria-label={`${t('Farge', 'Colour')} ${c}`}
            className={`size-10 rounded-full ${c === p.color ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg' : ''}`}
            style={{ background: c }}
            onClick={() => set({ color: c })}
          />
        ))}
      </div>

      <SectionTitle>{t('Mål', 'Goal')}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {GOALS.map((g) => (
          <Chip key={g} active={p.goal === g} onClick={() => set({ goal: g })}>
            {GOAL_LABEL[g]}
          </Chip>
        ))}
      </div>

      <SectionTitle>{t('Økter per uke', 'Workouts per week')}</SectionTitle>
      <NumberStepper label={t('Økter per uke', 'Workouts per week')} value={p.weekly_target} min={1} max={7} onChange={(v) => set({ weekly_target: v })} />

      <SectionTitle>{t('Erfaring', 'Experience')}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {EXPERIENCE.map((e) => (
          <Chip key={e} active={p.experience === e} onClick={() => set({ experience: e })}>
            {EXPERIENCE_LABEL[e]}
          </Chip>
        ))}
      </div>

      <SectionTitle>{t('Om deg (valgfritt)', 'About you (optional)')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('Høyde (cm)', 'Height (cm)')}</span>
          <input id="edit-height" className={inputClass} inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('Fødselsår', 'Year of birth')}</span>
          <input id="edit-born" className={inputClass} inputMode="numeric" value={born} onChange={(e) => setBorn(e.target.value)} />
        </label>
      </div>
      <p className="mt-3 text-sm text-muted">{t('Kroppsvekt logges under Fremgang → Kroppsvekt.', 'Bodyweight is logged under Progress → Bodyweight.')}</p>
    </Page>
  );
}
