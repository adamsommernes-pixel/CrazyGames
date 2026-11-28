import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card, SectionTitle, inputClass } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { showToast } from '../../components/toast';
import { social, type Person } from '../../social';
import { cleanHandle } from '../../social/handle';
import { errorText, useMySocial } from '../../social/store';
import { acceptFollower, rememberPerson, removeFollower, unblock, useGraph } from '../../social/graph';
import { shareInvite } from '../../social/invite';
import { FollowButton } from './FollowButton';
import { PersonRow } from './PersonRow';
import { t } from '../../i18n';

/** Folk: finn noen, inviter venner, forespørsler, følgere, følger og blokkerte. */
export function PeopleTab() {
  const { profile } = useMySocial();
  const g = useGraph();
  const person = (id: string): Person => g.people.get(id) ?? { user_id: id, handle: '…', display_name: t('Ukjent', 'Unknown'), color: '#6c6c72' };
  const [showBlocked, setShowBlocked] = useState(false);

  // Hent på nytt når fanen åpnes (andre kan ha sendt forespørsler).
  useEffect(() => {
    void g.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) showToast(done);
    } catch (e) {
      showToast(errorText(e));
    }
  };

  return (
    <div className="flex flex-col">
      <FindPerson />
      {profile && (
        <Button variant="secondary" icon="share" full className="mt-3" onClick={() => void shareInvite(profile.handle)}>
          {t('Inviter venner', 'Invite friends')}
        </Button>
      )}

      {g.error && g.status !== 'ready' && <p className="mt-4 text-sm text-danger">{g.error}</p>}

      {g.rel.requests.length > 0 && (
        <List title={t(`Forespørsler (${g.rel.requests.length})`, `Requests (${g.rel.requests.length})`)}>
          {g.rel.requests.map((id) => (
            <PersonRow key={id} person={person(id)}>
              <Button className="min-h-9 px-3 text-sm" onClick={() => void run(() => acceptFollower(id), t('Godtatt', 'Accepted'))}>
                {t('Godta', 'Accept')}
              </Button>
              <button type="button" aria-label={t(`Avslå ${person(id).display_name}`, `Decline ${person(id).display_name}`)} className="grid size-9 place-items-center rounded-lg text-muted active:bg-raised" onClick={() => void run(() => removeFollower(id))}>
                <Icon name="x" size={18} />
              </button>
            </PersonRow>
          ))}
        </List>
      )}

      <List title={t(`Du følger (${g.rel.following.length + g.rel.requested.length})`, `Following (${g.rel.following.length + g.rel.requested.length})`)} empty={t('Du følger ingen ennå. Finn venner på brukernavnet deres, eller send dem en invitasjon.', "You don't follow anyone yet. Find friends by their username, or send them an invite.")}>
        {[...g.rel.requested, ...g.rel.following].map((id) => (
          <PersonRow key={id} person={person(id)}>
            <FollowButton person={person(id)} compact />
          </PersonRow>
        ))}
      </List>

      <List title={t(`Følgere (${g.rel.followers.length})`, `Followers (${g.rel.followers.length})`)} empty={t('Ingen følger deg ennå.', 'Nobody follows you yet.')}>
        {g.rel.followers.map((id) => (
          <PersonRow key={id} person={person(id)}>
            <FollowButton person={person(id)} compact />
          </PersonRow>
        ))}
      </List>

      {g.blocked.length > 0 && (
        <>
          <button type="button" className="mt-6 flex items-center gap-1 text-sm text-muted" aria-expanded={showBlocked} onClick={() => setShowBlocked((v) => !v)}>
            {t(`Blokkerte (${g.blocked.length})`, `Blocked (${g.blocked.length})`)}
            <Icon name="down" size={16} className={showBlocked ? 'rotate-180' : ''} />
          </button>
          {showBlocked && (
            <Card className="mt-2">
              <ul className="divide-y divide-line">
                {g.blocked.map((id) => (
                  <li key={id} className="flex min-h-14 items-center gap-3 px-3">
                    <span className="min-w-0 flex-1 truncate">{g.people.get(id)?.display_name ?? t('Blokkert bruker', 'Blocked user')}</span>
                    <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={() => void run(() => unblock(id), t('Blokkering opphevet', 'Unblocked'))}>
                      {t('Opphev', 'Unblock')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function List({ title, empty, children }: { title: string; empty?: string; children: ReactNode[] | ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      {has ? (
        <Card>
          <ul className="divide-y divide-line">{children}</ul>
        </Card>
      ) : (
        empty && <p className="text-sm text-muted">{empty}</p>
      )}
    </>
  );
}

/** Finn en person på eksakt @brukernavn (private kontoer finnes bare slik). */
function FindPerson() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<Person | null | 'none'>(null);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    const h = cleanHandle(q);
    if (h.length < 3) return;
    setBusy(true);
    try {
      const p = (await social()?.findByHandle(h)) ?? null;
      if (p) rememberPerson(p);
      setResult(p ?? 'none');
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint">@</span>
          <input
            className={`${inputClass} pl-8`}
            aria-label={t('Finn på brukernavn', 'Find by username')}
            placeholder={t('brukernavn', 'username')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            value={q}
            onChange={(e) => {
              setQ(cleanHandle(e.target.value));
              setResult(null);
            }}
          />
        </div>
        <Button type="submit" disabled={busy || cleanHandle(q).length < 3}>
          {t('Finn', 'Find')}
        </Button>
      </form>
      {result === 'none' && <p className="mt-2 text-sm text-muted">{t(`Fant ingen med brukernavnet @${cleanHandle(q)}.`, `No one found with the username @${cleanHandle(q)}.`)}</p>}
      {result && result !== 'none' && (
        <Card className="mt-2">
          <ul>
            <PersonRow person={result}>
              <FollowButton person={result} compact />
            </PersonRow>
          </ul>
        </Card>
      )}
    </div>
  );
}
