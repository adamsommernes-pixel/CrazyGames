import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUser } from '../../auth/AuthProvider';
import { getProfile } from '../../db/repo';
import { Button, Chip, inputClass } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { social, type SocialProfile, type Visibility } from '../../social';
import { cleanHandle, handleCandidates, isValidHandle, suggestHandle } from '../../social/handle';
import { errorText, inputOf, saveMySocial } from '../../social/store';
import { nameProblem } from '../../social/names';
import { VISIBILITIES, VISIBILITY_ICON, visibilityName, visibilityText } from '../../social/visibility';
import { t } from '../../i18n';

type Check = 'idle' | 'checking' | 'free' | 'taken' | 'invalid' | 'reserved' | 'error';

/**
 * Lag eller endre den sosiale profilen: navn, @brukernavn, 16+ og synlighet.
 * `onSaved` får den lagrede profilen og forrige synlighet (til «Behold følgere?»).
 */
export function SocialSetup({ existing, onSaved }: { existing?: SocialProfile | null; onSaved: (p: SocialProfile, before: Visibility | null) => void }) {
  const user = useUser();
  const local = useLiveQuery(() => getProfile(user.id), [user.id]);
  const [name, setName] = useState(existing?.display_name ?? '');
  const [handle, setHandle] = useState(existing?.handle ?? '');
  const [adult, setAdult] = useState<boolean | null>(existing ? existing.is_16_plus : null);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 1);
  // Bare ved ny profil: del økter fra de siste 7 dagene, eller start fra null.
  const [history, setHistory] = useState<'week' | 'none' | null>(existing ? 'none' : null);
  const [check, setCheck] = useState<Check>(existing ? 'free' : 'idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggested = useRef(false);

  // Ny profil: navn fra profilen og et ledig brukernavn basert på det.
  useEffect(() => {
    if (existing || suggested.current || !local) return;
    suggested.current = true;
    const n = local.name || user.name;
    setName(n);
    void (async () => {
      const b = social();
      for (const c of handleCandidates(suggestHandle(n))) {
        if (!b || (await b.handleAvailable(c).catch(() => true))) {
          setHandle((h) => h || c);
          return;
        }
      }
    })();
  }, [existing, local, user.name]);

  // Sjekk om brukernavnet er ledig (kort etter siste tastetrykk).
  useEffect(() => {
    if (!handle) return setCheck('idle');
    if (!isValidHandle(handle)) return setCheck('invalid');
    if (nameProblem(handle, '')) return setCheck('reserved');
    if (existing && handle === existing.handle) return setCheck('free');
    setCheck('checking');
    let live = true;
    const id = setTimeout(() => {
      void social()
        ?.handleAvailable(handle)
        .then((ok) => live && setCheck(ok ? 'free' : 'taken'))
        .catch(() => live && setCheck('error'));
    }, 400);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [handle, existing]);

  const badName = nameProblem('', name) === 'banned';
  const ready = name.trim().length > 0 && !badName && check === 'free' && adult !== null && history !== null && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const base = existing ? inputOf(existing) : { tier_index: null, score: null, lift_scores: {} };
      const p = await saveMySocial({
        ...base,
        display_name: name.trim().slice(0, 40),
        handle,
        color: local?.color ?? existing?.color ?? '#34c56a',
        is_16_plus: !!adult,
        visibility: adult ? visibility : 1,
        ...(existing ? {} : { share_from: new Date(Date.now() - (history === 'week' ? 7 * 86_400_000 : 0)).toISOString() }),
      });
      onSaved(p, existing?.visibility ?? null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const hint: Record<Check, { text: string; tone: string } | null> = {
    idle: null,
    checking: { text: t('Sjekker …', 'Checking …'), tone: 'text-faint' },
    free: { text: t('Ledig', 'Available'), tone: 'text-accent' },
    taken: { text: t('Opptatt. Prøv et annet.', 'Taken. Try another.'), tone: 'text-danger' },
    invalid: { text: t('3–20 tegn: små bokstaver, tall, _ og punktum.', '3–20 characters: lowercase letters, numbers, _ and dots.'), tone: 'text-warn' },
    reserved: { text: t('Det brukernavnet kan ikke brukes. Prøv et annet.', "That username can't be used. Try another."), tone: 'text-danger' },
    error: { text: t('Kunne ikke sjekke. Har du nett?', "Couldn't check. Are you online?"), tone: 'text-warn' },
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{t('Navn som vises', 'Display name')}</span>
        <input className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        {badName && (
          <span role="status" className="text-xs text-danger">
            {t('Navnet inneholder et ord som ikke er tillatt.', 'The name contains a word that is not allowed.')}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="social-handle" className="text-sm text-muted">
          {t('Brukernavn', 'Username')}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint">@</span>
          <input
            id="social-handle"
            className={`${inputClass} pl-8`}
            value={handle}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setHandle(cleanHandle(e.target.value))}
          />
        </div>
        {hint[check] && (
          <span role="status" className={`text-xs ${hint[check]!.tone}`}>
            {hint[check]!.text}
          </span>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm text-muted">{t('Er du 16 år eller eldre?', 'Are you 16 or older?')}</legend>
        <div className="flex gap-2">
          <Chip active={adult === true} onClick={() => setAdult(true)}>
            {t('Ja', 'Yes')}
          </Chip>
          <Chip
            active={adult === false}
            onClick={() => {
              // Under 16: bare privat.
              setAdult(false);
              setVisibility(1);
            }}
          >
            {t('Nei', 'No')}
          </Chip>
        </div>
        {adult === false && <p className="text-xs text-faint">{t('Under 16 år kan du bare ha privat konto.', 'Under 16 you can only have a private account.')}</p>}
      </fieldset>

      <div role="radiogroup" aria-label={t('Hvem kan se deg', 'Who can see you')} className="flex flex-col gap-2">
        <span className="text-sm text-muted">{t('Hvem kan se deg', 'Who can see you')}</span>
        {VISIBILITIES.map((v) => {
          const locked = v > 1 && adult !== true;
          const on = visibility === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked}
              onClick={() => setVisibility(v)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-40 ${on ? 'border-accent bg-accent-soft/40' : 'border-line bg-raised'}`}
            >
              <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${on ? 'bg-accent text-on-accent' : 'bg-surface text-muted'}`}>
                <Icon name={VISIBILITY_ICON[v]} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {v}. {visibilityName(v)}
                </span>
                <span className="block text-sm text-muted">{visibilityText(v)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!existing && (
        <fieldset role="radiogroup" aria-label={t('Økter du allerede har logget', "Workouts you've already logged")} className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm text-muted">{t('Økter du allerede har logget', "Workouts you've already logged")}</legend>
          {([
            ['week', t('Del de siste 7 dagene', 'Share the last 7 days'), t('Øktene fra den siste uka vises i feeden med en gang.', "Your workouts from the past week show up in the feed right away.")],
            ['none', t('Start fra null', 'Start from scratch'), t('Bare økter du fullfører fra nå av deles.', 'Only workouts you finish from now on are shared.')],
          ] as const).map(([id, title, text]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={history === id}
              onClick={() => setHistory(id)}
              className={`rounded-xl border p-3 text-left transition-colors ${history === id ? 'border-accent bg-accent-soft/40' : 'border-line bg-raised'}`}
            >
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted">{text}</span>
            </button>
          ))}
        </fieldset>
      )}

      <p className="text-xs text-faint">
        {t(
          'Kroppsvekten din deles aldri. Andre ser navnet, brukernavnet, appfargen, styrkenivået og øktene dine etter valget over.',
          'Your bodyweight is never shared. Others see your name, username, app colour, strength level and workouts as chosen above.',
        )}
      </p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button full disabled={!ready} onClick={() => void save()}>
        {saving ? t('Lagrer …', 'Saving …') : existing ? t('Lagre', 'Save') : t('Lag sosial profil', 'Create social profile')}
      </Button>
    </div>
  );
}
