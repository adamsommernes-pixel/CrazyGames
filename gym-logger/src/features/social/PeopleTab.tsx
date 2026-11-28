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

  const [q, setQ] = useState('');
  const query = q.trim().replace(/^@/, '');

  return (
    <div className="flex flex-col">
      <SearchField value={q} onChange={setQ} />
      {query ? (
        <PeopleResults query={query} />
      ) : (
        <>
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

      {profile && (
        <Button variant="secondary" icon="share" full className="mt-4" onClick={() => void shareInvite(profile.handle)}>
          {t('Inviter venner', 'Invite friends')}
        </Button>
      )}

      <PeopleResults query="" />

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

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
      <input
        type="search"
        className={`${inputClass} pl-10`}
        aria-label={t('Søk etter folk', 'Search for people')}
        placeholder={t('Navn eller @brukernavn', 'Name or @username')}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const DISCOVER_SHOWN = 5;

/**
 * Tom `query`: Oppdag (åpne kontoer, sist aktive først). Ellers: åpne kontoer som matcher navn eller
 * brukernavn, og den som har akkurat det brukernavnet (private kontoer finnes bare slik).
 */
function PeopleResults({ query }: { query: string }) {
  const [results, setResults] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    const b = social();
    if (!b) return;
    let live = true;
    setError(null);
    const id = setTimeout(async () => {
      try {
        const h = cleanHandle(query);
        const [found, exact] = await Promise.all([b.discover(query), h.length >= 3 ? b.findByHandle(h) : Promise.resolve(null)]);
        if (!live) return;
        const list = exact ? [exact, ...found.filter((p) => p.user_id !== exact.user_id)] : found;
        for (const p of list) rememberPerson(p);
        setResults(list);
      } catch (e) {
        if (live) setError(errorText(e));
      }
    }, query ? 350 : 0);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [query]);

  const discover = !query;
  const shown = discover && !all ? (results ?? []).slice(0, DISCOVER_SHOWN) : (results ?? []);
  return (
    <div>
      <SectionTitle>{discover ? t('Oppdag', 'Discover') : t('Treff', 'Results')}</SectionTitle>
      {discover && <p className="-mt-1 mb-2 text-sm text-faint">{t('Åpne kontoer, sist aktive først.', 'Open accounts, most recently active first.')}</p>}
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : results === null ? (
        <p className="text-sm text-muted" role="status">
          {t('Søker …', 'Searching …')}
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted">
          {discover
            ? t('Ingen åpne kontoer å vise ennå.', 'No open accounts to show yet.')
            : t(`Fant ingen som heter «${query}». Private kontoer finnes bare på hele brukernavnet.`, `No one found for “${query}”. Private accounts can only be found by their full username.`)}
        </p>
      ) : (
        <>
          <Card>
            <ul aria-label={discover ? t('Oppdag', 'Discover') : t('Treff', 'Results')} className="divide-y divide-line">
              {shown.map((p) => (
                <PersonRow key={p.user_id} person={p}>
                  <FollowButton person={p} compact />
                </PersonRow>
              ))}
            </ul>
          </Card>
          {discover && results.length > DISCOVER_SHOWN && (
            <button type="button" className="mt-2 text-sm font-medium text-accent" onClick={() => setAll((v) => !v)}>
              {all ? t('Vis færre', 'Show fewer') : t(`Vis ${results.length - DISCOVER_SHOWN} til`, `Show ${results.length - DISCOVER_SHOWN} more`)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
