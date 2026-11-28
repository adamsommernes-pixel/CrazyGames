import { useState } from 'react';
import { Button, Sheet } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { showToast } from '../../components/toast';
import { social, type Person, type SocialProfile, type Visibility } from '../../social';
import { errorText } from '../../social/store';
import { t } from '../../i18n';

/** Hentes etter at synligheten er lagret: ble kontoen strengere enn Åpen, og har den følgere du ikke følger tilbake? */
export async function followersToReview(p: SocialProfile, before: Visibility | null): Promise<Person[]> {
  if (before !== 3 || p.visibility === 3) return [];
  return (await social()?.followersNotFollowedBack().catch(() => [])) ?? [];
}

/** «24 personer følger deg som du ikke følger tilbake. Vil du beholde dem?» Behold alle, fjern alle eller velg selv. */
export function KeepFollowersSheet({ people, onClose }: { people: Person[]; onClose: () => void }) {
  const [picking, setPicking] = useState(false);
  const [remove, setRemove] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const n = people.length;

  const removeIds = async (ids: string[]) => {
    if (!ids.length) return onClose();
    setBusy(true);
    try {
      const removed = (await social()?.removeFollowers(ids)) ?? 0;
      showToast(t(`${removed} ${removed === 1 ? 'følger' : 'følgere'} fjernet`, `${removed} ${removed === 1 ? 'follower' : 'followers'} removed`));
      onClose();
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setRemove((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Sheet open={n > 0} onClose={onClose} title={t('Behold følgerne?', 'Keep your followers?')} tall={picking}>
      <p className="mb-4 text-muted">
        {n === 1
          ? t('1 person følger deg som du ikke følger tilbake. Vil du beholde personen som følger?', '1 person follows you that you don’t follow back. Do you want to keep them as a follower?')
          : t(`${n} personer følger deg som du ikke følger tilbake. Vil du beholde dem som følgere?`, `${n} people follow you that you don’t follow back. Do you want to keep them as followers?`)}
      </p>
      {picking ? (
        <>
          <p className="mb-2 text-sm text-faint">{t('Kryss av dem du vil fjerne.', 'Tick the ones you want to remove.')}</p>
          <ul className="mb-4 flex flex-col divide-y divide-line rounded-xl border border-line">
            {people.map((p) => (
              <li key={p.user_id}>
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                  <Avatar name={p.display_name} color={p.color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.display_name}</span>
                    <span className="block truncate text-sm text-faint">@{p.handle}</span>
                  </span>
                  <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={remove.has(p.user_id)} onChange={() => toggle(p.user_id)} aria-label={t(`Fjern ${p.display_name}`, `Remove ${p.display_name}`)} />
                </label>
              </li>
            ))}
          </ul>
          <Button full variant="danger" disabled={busy || remove.size === 0} onClick={() => void removeIds([...remove])}>
            {t(`Fjern ${remove.size} valgte`, `Remove ${remove.size} selected`)}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Button full onClick={onClose}>
            {t('Behold alle', 'Keep all')}
          </Button>
          <Button full variant="secondary" onClick={() => setPicking(true)}>
            {t('Velg selv', 'Choose myself')}
          </Button>
          <Button full variant="danger" disabled={busy} onClick={() => void removeIds(people.map((p) => p.user_id))}>
            {t('Fjern alle', 'Remove all')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
