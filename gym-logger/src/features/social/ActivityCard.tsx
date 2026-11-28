import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, IconButton, PRBadge, Sheet, ActionList } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { MuscleDot } from '../../components/MuscleTag';
import { TierEmblem } from '../../components/TierBadge';
import { showToast } from '../../components/toast';
import { MUSCLE_GROUPS, SET_TYPE_SHORT, type MuscleGroup } from '../../db/types';
import { BUILTIN_EXERCISES } from '../../db/exercises';
import { exerciseName } from '../../lib/exerciseName';
import { formatSetShort } from '../../lib/kinds';
import { durationShort, num, toDisplay } from '../../lib/format';
import { useSetting } from '../../lib/settings';
import { tierAt } from '../../lib/strength';
import { EMOJIS, type Emoji } from '../../social';
import type { FeedItem } from '../../social/feed';
import { errorText } from '../../social/store';
import { setShared } from '../../social/publish';
import { ReactionsSheet } from './ReactionsSheet';
import { locale, t } from '../../i18n';

const BUILTIN = new Set(BUILTIN_EXERCISES.map((e) => e.id));
/** Innebygde øvelser vises på seerens språk; egne øvelser med navnet eieren ga dem. */
const nameOf = (id: string, name: string) => (BUILTIN.has(id) ? exerciseName({ id, name, custom: 0 }) : name);
const group = (g: string): MuscleGroup => ((MUSCLE_GROUPS as readonly string[]).includes(g) ? (g as MuscleGroup) : 'Annet');

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return t('nå', 'now');
  if (min < 60) return t(`${min} min siden`, `${min} min ago`);
  const h = Math.round(min / 60);
  if (h < 24) return t(`${h} t siden`, `${h} h ago`);
  const d = Math.round(h / 24);
  if (d < 7) return t(`${d} ${d === 1 ? 'dag' : 'dager'} siden`, `${d} ${d === 1 ? 'day' : 'days'} ago`);
  return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

const SHOWN = 3;

/** Én økt i feeden: hvem, når, tall, alle øvelser med sets (som Hevy) og reaksjoner. */
export function ActivityCard({ item, me, onReact, onRemoved }: { item: FeedItem; me: string | null; onReact: (emoji: Emoji) => Promise<void>; onRemoved?: () => void }) {
  const unit = useSetting('unit');
  const { activity: a, author } = item;
  const d = a.data;
  const [all, setAll] = useState(false);
  const [menu, setMenu] = useState(false);
  const [who, setWho] = useState(false);
  const own = me === a.user_id;
  const shown = all ? d.exercises : d.exercises.slice(0, SHOWN);
  const prs = d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.pr).length, 0);
  const counts = new Map<Emoji, number>();
  for (const r of item.reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const mine = item.reactions.find((r) => r.user_id === me)?.emoji;
  const name = author?.display_name ?? t('Ukjent', 'Unknown');

  return (
    <div data-activity={a.id}>
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <Link to={author ? `/u/${author.handle}` : '#'} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={name} color={author?.color ?? '#6c6c72'} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{name}</span>
            <span className="block truncate text-xs text-faint">
              {author ? `@${author.handle} · ` : ''}
              {timeAgo(a.started_at)}
            </span>
          </span>
        </Link>
        {d.tier && <TierEmblem index={d.tier.index} size={26} />}
        {own && <IconButton icon="more" label={t('Valg for økta', 'Workout options')} onClick={() => setMenu(true)} />}
      </div>

      <h3 className="mt-3 text-lg font-bold">{a.name}</h3>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>
          <Icon name="timer" size={14} className="mr-1 inline -translate-y-px" />
          {durationShort(d.duration_s * 1000)}
        </span>
        {d.volume_kg > 0 && (
          <span>
            <span className="font-num font-semibold text-ink">{num(toDisplay(d.volume_kg, unit), 0)}</span> {unit}
          </span>
        )}
        <span>
          <span className="font-num font-semibold text-ink">{d.sets}</span> {d.sets === 1 ? 'set' : 'sets'}
        </span>
        {prs > 0 && (
          <span className="text-accent">
            <Icon name="trophy" size={14} className="mr-1 inline -translate-y-px" />
            {t(`${prs} ${prs === 1 ? 'rekord' : 'rekorder'}`, `${prs} ${prs === 1 ? 'record' : 'records'}`)}
          </span>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {shown.map((e, i) => {
          let n = 0;
          return (
            <li key={`${e.exercise_id}-${i}`}>
              <div className="flex items-center gap-2 font-medium">
                <MuscleDot group={group(e.muscle_group)} />
                <span className="truncate">{nameOf(e.exercise_id, e.name)}</span>
              </div>
              <ol className="mt-1 flex flex-col gap-0.5 pl-4">
                {e.sets.map((s, j) => {
                  const label = SET_TYPE_SHORT[s.set_type] || String(++n);
                  return (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <span className={`font-num w-5 text-center text-xs ${s.set_type === 'normal' ? 'text-faint' : 'text-warn'}`}>{label}</span>
                      <span className="font-num">{formatSetShort(s, e.kind, unit)}</span>
                      {s.pr && <PRBadge />}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
      {d.exercises.length > SHOWN && (
        <button type="button" className="mt-2 text-sm font-medium text-accent" onClick={() => setAll((v) => !v)}>
          {all ? t('Vis færre', 'Show fewer') : t(`Vis ${d.exercises.length - SHOWN} øvelser til`, `Show ${d.exercises.length - SHOWN} more exercises`)}
        </button>
      )}

      <div className="mt-3 flex gap-1.5 border-t border-line pt-3" role="group" aria-label={t('Reaksjoner', 'Reactions')}>
        {EMOJIS.map((emoji) => {
          const c = counts.get(emoji) ?? 0;
          const on = mine === emoji;
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={on}
              disabled={own}
              aria-label={`${emoji} ${c}`}
              onClick={() => void onReact(emoji).catch((e) => showToast(errorText(e)))}
              className={`flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-sm transition-colors disabled:cursor-default ${on ? 'border-accent bg-accent-soft' : 'border-line bg-raised'} ${own && !c ? 'opacity-40' : ''}`}
            >
              <span aria-hidden="true">{emoji}</span>
              {c > 0 && <span className="font-num text-xs text-muted">{c}</span>}
            </button>
          );
        })}
        {d.tier && <span className="ml-auto self-center text-xs text-faint">{tierAt(d.tier.index).name}</span>}
      </div>
      {item.reactions.length > 0 && (
        <button type="button" className="mt-2 min-h-8 text-sm text-muted" onClick={() => setWho(true)}>
          {item.reactions.length === 1
            ? t('1 reaksjon · se hvem', '1 reaction · see who')
            : t(`${item.reactions.length} reaksjoner · se hvem`, `${item.reactions.length} reactions · see who`)}
        </button>
      )}
      <ReactionsSheet open={who} onClose={() => setWho(false)} reactions={item.reactions} />

      {own && (
        <Sheet open={menu} onClose={() => setMenu(false)} title={a.name}>
          <ActionList
            actions={[
              {
                label: t('Fjern fra feeden', 'Remove from the feed'),
                icon: 'trash',
                danger: true,
                onClick: async () => {
                  setMenu(false);
                  await setShared(a.id, false);
                  onRemoved?.();
                  showToast(t('Økta er fjernet fra feeden. Den ligger fortsatt i historikken din.', 'The workout is removed from the feed. It is still in your history.'));
                },
              },
            ]}
          />
        </Sheet>
      )}
    </Card>
    </div>
  );
}
