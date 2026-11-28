-- RepGrade 1.3: Sosialt. Følgere, aktivitet (hele økta), reaksjoner, ledertavler, oppdag,
-- utfordringer, blokkering, rapportering og varsler i appen.
--
-- Prinsipp: venner leser ALDRI de private treningstabellene (sets, workouts, …). Appen legger en
-- kopi av økta i «activities» når brukeren har sosial konto. Alle regler for hvem som ser hva går
-- gjennom én funksjon, can_see(). Følging, blokkering og utfordringer endres bare via funksjonene
-- nederst (security definer), aldri direkte i tabellene, så reglene ikke kan omgås.
--
-- Synlighet (social_profiles.visibility):
--   1 Privat:      bare følgere du har godtatt ser deg. Ikke på ledertavler. Finnes bare med eksakt @brukernavn.
--   2 Ledertavler: som 1, men navnet ditt vises på ledertavler (og du får se dem).
--   3 Åpen:        alle innloggede ser deg, du vises i Oppdag, og følging skjer uten forespørsel.
-- Under 16 år: bare Privat (sjekk-regel på tabellen).
-- Treningskonto (profiles.social = 0): den sosiale profilen er skjult (active = false), ikke slettet.
--
-- Trygt å kjøre flere ganger.

-- ---------- Kontotype på profilen (synkes med resten av profilen) ----------
alter table public.profiles add column if not exists social smallint not null default 0;

-- ---------- Tabeller ----------

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Små bokstaver, tall, _ og punktum. 3–20 tegn. Unik.
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  color text not null default '#34c56a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  visibility smallint not null default 1 check (visibility in (1, 2, 3)),
  -- Brukeren har bekreftet at de er 16 år eller eldre.
  is_16_plus boolean not null default false,
  -- false = treningskonto: skjult for alle andre, men ikke slettet.
  active boolean not null default true,
  -- Styrkenivå regnet ut på telefonen (kroppsvekten forlater aldri telefonen uten samtykke).
  tier_index smallint check (tier_index between 0 and 9),
  score numeric check (score >= 0 and score <= 100),
  -- { "ex-benkpress": 52.3, … } poeng per løft som teller, til ledertavler per løft.
  lift_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(lift_scores) = 'object'),
  -- Økter fra og med dette tidspunktet deles (valgt ved oppstart: siste 7 dager eller fra nå).
  share_from timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint under_16_private check (visibility = 1 or is_16_plus)
);

-- Kolonner lagt til etter første versjon (tabellen finnes kanskje allerede).
alter table public.social_profiles add column if not exists share_from timestamptz;

create table if not exists public.follows (
  follower uuid not null references auth.users(id) on delete cascade,
  followee uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_followee_idx on public.follows (followee, status);

create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  target uuid not null references auth.users(id) on delete cascade,
  activity_id text,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

-- Én rad per publisert økt. id = øktas id i appen, så samme økt kan publiseres på nytt uten duplikat.
create table if not exists public.activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null default '' check (char_length(name) <= 120),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- Hele økta: øvelser med alle sets, rekorder, muskler, volum, beste 1RM per løft og nivå etter økta.
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (ended_at >= started_at)
);
create index if not exists activities_feed_idx on public.activities (user_id, started_at desc);
create index if not exists activities_time_idx on public.activities (started_at desc);

create table if not exists public.reactions (
  activity_owner uuid not null,
  activity_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('💪', '🔥', '👏', '🏆')),
  created_at timestamptz not null default now(),
  primary key (activity_owner, activity_id, user_id),
  foreign key (activity_owner, activity_id) references public.activities(user_id, id) on delete cascade
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator uuid not null references auth.users(id) on delete cascade,
  -- workouts: flest økter · volume: mest volum (kg) · weekly: flest uker med minst `target` økter
  -- lift: størst økning i beregnet 1RM på `exercise_id` fra før start til slutt
  -- goal: først til `target` kg i beregnet 1RM på `exercise_id` (de andre rangeres etter beste)
  -- (gyldige typer og regler for felt: se navngitte regler under tabellen)
  kind text not null,
  exercise_id text,
  target numeric,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- Reglene har faste navn, så de kan endres når nye typer kommer (tabellen kan finnes fra før).
-- challenges_check/_check1/_check2 er navnene fra første versjon (uten navn); de fjernes.
alter table public.challenges drop constraint if exists challenges_check;
alter table public.challenges drop constraint if exists challenges_check1;
alter table public.challenges drop constraint if exists challenges_check2;
alter table public.challenges drop constraint if exists challenges_kind_check;
alter table public.challenges drop constraint if exists challenges_period;
alter table public.challenges drop constraint if exists challenges_lift_exercise;
alter table public.challenges drop constraint if exists challenges_weekly_target;
alter table public.challenges drop constraint if exists challenges_goal_target;
alter table public.challenges add constraint challenges_kind_check check (kind in ('workouts', 'volume', 'weekly', 'lift', 'goal'));
alter table public.challenges add constraint challenges_period check (ends_at > starts_at and ends_at <= starts_at + interval '366 days');
alter table public.challenges add constraint challenges_lift_exercise check (kind not in ('lift', 'goal') or exercise_id is not null);
alter table public.challenges add constraint challenges_weekly_target check (kind <> 'weekly' or (target is not null and target between 1 and 14));
alter table public.challenges add constraint challenges_goal_target check (kind <> 'goal' or (target is not null and target > 0 and target <= 1000));

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('invited', 'joined', 'declined')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on public.challenge_members (user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('follow_request', 'follow_accepted', 'new_follower', 'reaction', 'challenge_invite', 'challenge_joined')),
  actor uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- Hjelpefunksjoner ----------

/* Er navnet lov? null = ok, 'reserved' = brukernavnet er reservert, 'banned' = støtende ord.
   Samme lister som i src/social/names.ts (testes i begge). Ordene sjekkes som del av teksten, så listen
   holdes til ord som ikke finnes inni vanlige navn («fittest», «Nazira» og «pikkolo» skal være lov). */
create or replace function public.name_problem(h text, n text)
returns text language sql immutable set search_path = '' as $$
  select case
    when lower(coalesce(h, '')) like 'repgrade%' or lower(coalesce(h, '')) = any (array[
      'admin', 'administrator', 'support', 'moderator', 'mod', 'staff', 'official', 'help', 'system',
      'root', 'null', 'undefined', 'anonymous', 'me', 'settings', 'privacy', 'api'
    ]) then 'reserved'
    when exists (
      select 1 from unnest(array[
        'nigger', 'nigga', 'faggot', 'retard', 'hitler', 'fuck', 'cunt', 'whore', 'neger', 'hestkuk'
      ]) w
      where lower(coalesce(h, '')) like '%' || w || '%' or lower(coalesce(n, '')) like '%' || w || '%'
    ) then 'banned'
  end;
$$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

/* Har brukeren en aktiv sosial profil? (Egen funksjon, så reglene på social_profiles ikke peker på seg selv.) */
create or replace function public.has_social(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.social_profiles where user_id = u and active);
$$;

/* Kan `viewer` se profilen og øktene til `owner`? Den ene regelen alt annet bygger på. */
create or replace function public.can_see(viewer uuid, owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select viewer = owner or (
    viewer is not null
    and exists (select 1 from public.social_profiles p where p.user_id = viewer and p.active)
    and exists (
      select 1 from public.social_profiles p
      where p.user_id = owner and p.active
        and (p.visibility = 3 or exists (
          select 1 from public.follows f where f.follower = viewer and f.followee = owner and f.status = 'accepted'))
    )
    and not public.is_blocked(viewer, owner)
  );
$$;

/* Følger de hverandre (begge veier, godtatt)? */
create or replace function public.mutual(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows where follower = a and followee = b and status = 'accepted')
     and exists (select 1 from public.follows where follower = b and followee = a and status = 'accepted');
$$;

/* Kan `a` utfordre `b`? Gjensidige følgere, eller `b` har åpen konto. Ingen blokkering, begge aktive. */
create or replace function public.can_challenge(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a <> b
    and exists (select 1 from public.social_profiles where user_id = a and active)
    and exists (select 1 from public.social_profiles where user_id = b and active)
    and not public.is_blocked(a, b)
    and (public.mutual(a, b) or exists (select 1 from public.social_profiles where user_id = b and visibility = 3));
$$;

create or replace function public.notify(target uuid, k text, from_user uuid, extra jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, actor, payload)
  select target, k, from_user, extra where target <> from_user;
$$;

-- ---------- Triggere ----------

-- Kontotypen i profilen styrer om den sosiale profilen er synlig (bytte til trening = skjult).
-- active kan bare endres herfra (social_profile_rules stopper alle andre endringer av den).
create or replace function public.sync_social_active()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('repgrade.allow_active', 'on', true);
  update public.social_profiles set active = (new.social = 1)
  where user_id = new.user_id and active is distinct from (new.social = 1);
  perform set_config('repgrade.allow_active', 'off', true);
  return new;
end $$;
drop trigger if exists profiles_social_active on public.profiles;
create trigger profiles_social_active after insert or update of social on public.profiles
  for each row execute function public.sync_social_active();

-- Sosial profil: ny rad følger kontotypen; bytte til Åpen godtar alle ventende forespørsler.
create or replace function public.social_profile_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.name_problem(new.handle, new.display_name) is not null then
    raise exception 'navnet er ikke tillatt (%)', public.name_problem(new.handle, new.display_name);
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.active := coalesce((select pr.social = 1 from public.profiles pr where pr.user_id = new.user_id order by pr.updated_at desc limit 1), true);
    new.created_at := now();
  else
    -- active styres bare av kontotypen (sync_social_active), ikke av appen direkte.
    if current_setting('repgrade.allow_active', true) is distinct from 'on' and new.active is distinct from old.active then
      new.active := old.active;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists social_profile_rules on public.social_profiles;
create trigger social_profile_rules before insert or update on public.social_profiles
  for each row execute function public.social_profile_rules();

create or replace function public.social_profile_opened()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility = 3 and (tg_op = 'INSERT' or old.visibility <> 3) then
    with accepted as (
      update public.follows set status = 'accepted', accepted_at = now()
      where followee = new.user_id and status = 'pending'
      returning follower
    )
    insert into public.notifications (user_id, kind, actor) select follower, 'follow_accepted', new.user_id from accepted;
  end if;
  return new;
end $$;
drop trigger if exists social_profile_opened on public.social_profiles;
create trigger social_profile_opened after insert or update of visibility on public.social_profiles
  for each row execute function public.social_profile_opened();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists activities_touch on public.activities;
create trigger activities_touch before update on public.activities for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------

alter table public.social_profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.activities enable row level security;
alter table public.reactions enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.notifications enable row level security;

-- Sosial profil: egen alltid; andres bare når du kan se dem, eller de står på ledertavler (nivå 2+).
drop policy if exists "se profiler" on public.social_profiles;
create policy "se profiler" on public.social_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.can_see((select auth.uid()), user_id)
         or (active and visibility >= 2 and not public.is_blocked((select auth.uid()), user_id)
             and public.has_social((select auth.uid()))));
drop policy if exists "lag egen profil" on public.social_profiles;
create policy "lag egen profil" on public.social_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "endre egen profil" on public.social_profiles;
create policy "endre egen profil" on public.social_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "slett egen profil" on public.social_profiles;
create policy "slett egen profil" on public.social_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- Følging: begge parter ser raden. Endringer bare via funksjonene.
drop policy if exists "se egne følgerelasjoner" on public.follows;
create policy "se egne følgerelasjoner" on public.follows for select to authenticated
  using (follower = (select auth.uid()) or followee = (select auth.uid()));

drop policy if exists "se egne blokkeringer" on public.blocks;
create policy "se egne blokkeringer" on public.blocks for select to authenticated
  using (blocker = (select auth.uid()));

drop policy if exists "rapporter" on public.reports;
create policy "rapporter" on public.reports for insert to authenticated
  with check (reporter = (select auth.uid()) and reporter <> target);

-- Aktivitet: eier skriver; andre leser når can_see sier ja. Bare med sosial profil.
drop policy if exists "se aktivitet" on public.activities;
create policy "se aktivitet" on public.activities for select to authenticated
  using (public.can_see((select auth.uid()), user_id));
drop policy if exists "publiser egen aktivitet" on public.activities;
create policy "publiser egen aktivitet" on public.activities for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_social((select auth.uid())));
drop policy if exists "endre egen aktivitet" on public.activities;
create policy "endre egen aktivitet" on public.activities for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "slett egen aktivitet" on public.activities;
create policy "slett egen aktivitet" on public.activities for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reaksjoner: synlige for dem som ser økta; du kan reagere på økter du ser, og fjerne egne.
drop policy if exists "se reaksjoner" on public.reactions;
create policy "se reaksjoner" on public.reactions for select to authenticated
  using (public.can_see((select auth.uid()), activity_owner));
drop policy if exists "reager" on public.reactions;
create policy "reager" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_see((select auth.uid()), activity_owner));
drop policy if exists "bytt reaksjon" on public.reactions;
create policy "bytt reaksjon" on public.reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_see((select auth.uid()), activity_owner));
drop policy if exists "fjern reaksjon" on public.reactions;
create policy "fjern reaksjon" on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Utfordringer: bare deltakerne (og den som laget den) ser dem.
create or replace function public.in_challenge(c uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenges where id = c and creator = u)
      or exists (select 1 from public.challenge_members where challenge_id = c and user_id = u);
$$;
drop policy if exists "se egne utfordringer" on public.challenges;
create policy "se egne utfordringer" on public.challenges for select to authenticated
  using (public.in_challenge(id, (select auth.uid())));
drop policy if exists "se deltakere" on public.challenge_members;
create policy "se deltakere" on public.challenge_members for select to authenticated
  using (public.in_challenge(challenge_id, (select auth.uid())));

-- Varsler: bare egne. Kan merkes som lest og slettes.
drop policy if exists "se egne varsler" on public.notifications;
create policy "se egne varsler" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "merk varsler lest" on public.notifications;
create policy "merk varsler lest" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "slett egne varsler" on public.notifications;
create policy "slett egne varsler" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- Funksjoner appen kaller (rpc) ----------

/* Følg en bruker. Åpen konto: godtatt med en gang. Ellers: forespørsel. Gir ny status. */
create or replace function public.follow_user(target uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vis smallint; st text;
begin
  if me is null or target is null or me = target then raise exception 'ugyldig'; end if;
  if not exists (select 1 from public.social_profiles where user_id = me and active) then raise exception 'mangler sosial profil'; end if;
  select visibility into vis from public.social_profiles where user_id = target and active;
  if vis is null or public.is_blocked(me, target) then raise exception 'fant ikke brukeren'; end if;
  st := case when vis = 3 then 'accepted' else 'pending' end;
  insert into public.follows (follower, followee, status, accepted_at)
  values (me, target, st, case when st = 'accepted' then now() end)
  on conflict (follower, followee) do nothing;
  select status into st from public.follows where follower = me and followee = target;
  if found then
    perform public.notify(target, case when st = 'accepted' then 'new_follower' else 'follow_request' end, me)
    where not exists (select 1 from public.notifications n where n.user_id = target and n.actor = me
                      and n.kind in ('new_follower', 'follow_request') and n.created_at > now() - interval '1 day');
  end if;
  return st;
end $$;

/* Slutt å følge (eller trekk tilbake en forespørsel). */
create or replace function public.unfollow_user(target uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.follows where follower = auth.uid() and followee = target;
$$;

/* Godta en følgeforespørsel. */
create or replace function public.accept_follower(requester uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  update public.follows set status = 'accepted', accepted_at = now()
  where follower = requester and followee = me and status = 'pending';
  if found then perform public.notify(requester, 'follow_accepted', me); end if;
end $$;

/* Avslå en forespørsel, eller fjern en følger. */
create or replace function public.remove_follower(requester uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.follows where follower = requester and followee = auth.uid();
$$;

/* Følgere du ikke følger tilbake (til «Behold dem som følgere?» når du går fra Åpen til strengere). */
create or replace function public.followers_not_followed_back()
returns table (user_id uuid, handle text, display_name text, color text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.display_name, p.color
  from public.follows f join public.social_profiles p on p.user_id = f.follower
  where f.followee = auth.uid() and f.status = 'accepted'
    and not exists (select 1 from public.follows b where b.follower = auth.uid() and b.followee = f.follower and b.status = 'accepted')
  order by p.display_name;
$$;

/* Fjern mange følgere på én gang (fra samme dialog). */
create or replace function public.remove_followers(requesters uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.follows where followee = auth.uid() and follower = any(requesters);
  get diagnostics n = row_count;
  return n;
end $$;

/* Blokker: fjerner følging begge veier og utfordringsinvitasjoner mellom dere. */
create or replace function public.block_user(target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or target is null or me = target then raise exception 'ugyldig'; end if;
  insert into public.blocks (blocker, blocked) values (me, target) on conflict do nothing;
  delete from public.follows where (follower = me and followee = target) or (follower = target and followee = me);
  delete from public.reactions where (user_id = target and activity_owner = me) or (user_id = me and activity_owner = target);
  delete from public.notifications where (user_id = me and actor = target) or (user_id = target and actor = me);
end $$;

create or replace function public.unblock_user(target uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker = auth.uid() and blocked = target;
$$;

/* Minste offentlige info om personer du har noe med å gjøre: følgerelasjon (alle statuser), kan se,
   eller på ledertavle. Brukes til lister over forespørsler, følgere og deltakere. */
create or replace function public.people(ids uuid[])
returns table (user_id uuid, handle text, display_name text, color text, visibility smallint, tier_index smallint)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.display_name, p.color, p.visibility,
         case when public.can_see(auth.uid(), p.user_id) or p.visibility >= 2 then p.tier_index end
  from public.social_profiles p
  where p.user_id = any(ids) and p.active and not public.is_blocked(auth.uid(), p.user_id)
    and (p.user_id = auth.uid()
         or public.can_see(auth.uid(), p.user_id)
         or p.visibility >= 2
         or exists (select 1 from public.follows f where (f.follower = auth.uid() and f.followee = p.user_id) or (f.follower = p.user_id and f.followee = auth.uid()))
         or exists (select 1 from public.challenge_members a join public.challenge_members b on a.challenge_id = b.challenge_id
                    where a.user_id = auth.uid() and b.user_id = p.user_id));
$$;

/* Finn en bruker på eksakt @brukernavn (alle nivåer, så private kontoer kan få forespørsler). */
create or replace function public.find_by_handle(h text)
returns table (user_id uuid, handle text, display_name text, color text, visibility smallint)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.display_name, p.color, p.visibility
  from public.social_profiles p
  where p.handle = lower(btrim(ltrim(btrim(h), '@'))) and p.active and auth.uid() is not null
    and not public.is_blocked(auth.uid(), p.user_id);
$$;

/* Er brukernavnet ledig? */
create or replace function public.handle_available(h text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(h) ~ '^[a-z0-9_.]{3,20}$'
     and public.name_problem(lower(h), '') is null
     and not exists (select 1 from public.social_profiles where handle = lower(h) and user_id <> auth.uid());
$$;

/* Oppdag: åpne kontoer, søk på navn eller brukernavn. Krever egen aktiv sosial profil. */
create or replace function public.discover(q text default '', lim integer default 30)
returns table (user_id uuid, handle text, display_name text, color text, tier_index smallint, following boolean)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.display_name, p.color, p.tier_index,
         exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = p.user_id)
  from public.social_profiles p
  where p.visibility = 3 and p.active and p.user_id <> auth.uid()
    and exists (select 1 from public.social_profiles me where me.user_id = auth.uid() and me.active)
    and not public.is_blocked(auth.uid(), p.user_id)
    and (coalesce(btrim(q), '') = '' or p.handle ilike '%' || btrim(q) || '%' or p.display_name ilike '%' || btrim(q) || '%')
  order by (select max(a.started_at) from public.activities a where a.user_id = p.user_id) desc nulls last, p.display_name
  limit least(greatest(lim, 1), 100);
$$;

/* Ledertavler. Bare for brukere på nivå 2 eller 3, og viser bare brukere på nivå 2 eller 3.
   board: 'level' (styrkenivå), 'gain' (nivåpoeng økt siden `since`), 'workouts' (økter siden `since`),
          'lift' (poeng på ett løft).
   'gain': nåværende poeng minus poengene etter siste økt før `since` (eller første økt etter, om ingen før).
   scope: 'all', 'tier' (bare de på ditt styrkenivå) eller 'following' (de du følger, og deg selv). */
create or replace function public.leaderboard(board text, scope text default 'all', exercise text default null,
                                              since timestamptz default date_trunc('month', now()), lim integer default 50)
returns table (rank bigint, user_id uuid, handle text, display_name text, color text, tier_index smallint, value numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.social_profiles where user_id = me and active and visibility >= 2) then
    raise exception 'ledertavler krever nivå 2 eller 3';
  end if;
  return query
  with pool as (
    select p.* from public.social_profiles p
    where p.active and p.visibility >= 2 and not public.is_blocked(me, p.user_id)
      and (scope = 'all' or p.user_id = me
           or (scope = 'tier' and p.tier_index = (select mine.tier_index from public.social_profiles mine where mine.user_id = me))
           or (scope = 'following' and exists (select 1 from public.follows f where f.follower = me and f.followee = p.user_id and f.status = 'accepted')))
  ), scored as (
    select p.user_id, p.handle, p.display_name, p.color, p.tier_index,
      case board
        when 'level' then p.score
        when 'lift' then (p.lift_scores ->> exercise)::numeric
        when 'workouts' then (select count(*)::numeric from public.activities a where a.user_id = p.user_id and a.started_at >= since)
        when 'gain' then p.score - coalesce(
          (select (a.data -> 'tier' ->> 'score')::numeric from public.activities a
           where a.user_id = p.user_id and a.started_at < since and a.data -> 'tier' ->> 'score' is not null
           order by a.started_at desc limit 1),
          (select (a.data -> 'tier' ->> 'score')::numeric from public.activities a
           where a.user_id = p.user_id and a.started_at >= since and a.data -> 'tier' ->> 'score' is not null
           order by a.started_at asc limit 1))
      end as v
    from pool p
  )
  select rank() over (order by s.v desc), s.user_id, s.handle, s.display_name, s.color, s.tier_index, round(s.v, 1)
  from scored s where s.v is not null and s.v > 0
  order by s.v desc, s.display_name
  limit least(greatest(lim, 1), 200);
end $$;

/* Lag en utfordring og inviter folk. Bare de du kan utfordre blir invitert. Gir utfordringens id. */
create or replace function public.create_challenge(kind text, title text, starts_at timestamptz, ends_at timestamptz,
                                                   invitees uuid[], exercise_id text default null, target numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid; u uuid;
begin
  if not exists (select 1 from public.social_profiles where user_id = me and active) then raise exception 'mangler sosial profil'; end if;
  if coalesce(array_length(invitees, 1), 0) = 0 or array_length(invitees, 1) > 50 then raise exception 'inviter 1–50 personer'; end if;
  insert into public.challenges (creator, kind, title, starts_at, ends_at, exercise_id, target)
  values (me, kind, btrim(title), starts_at, ends_at, exercise_id, target) returning id into cid;
  insert into public.challenge_members (challenge_id, user_id, status, joined_at) values (cid, me, 'joined', now());
  foreach u in array invitees loop
    if public.can_challenge(me, u) then
      insert into public.challenge_members (challenge_id, user_id, status) values (cid, u, 'invited') on conflict do nothing;
      if found then perform public.notify(u, 'challenge_invite', me, jsonb_build_object('challenge_id', cid, 'title', btrim(title))); end if;
    end if;
  end loop;
  if (select count(*) from public.challenge_members where challenge_id = cid) < 2 then
    raise exception 'ingen av dem kan utfordres';
  end if;
  return cid;
end $$;

/* Svar på en invitasjon (bli med eller avslå). */
create or replace function public.respond_challenge(challenge uuid, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.challenges;
begin
  update public.challenge_members set status = case when accept then 'joined' else 'declined' end,
         joined_at = case when accept then now() end
  where challenge_id = challenge and user_id = me and status = 'invited';
  if found and accept then
    select * into c from public.challenges where id = challenge;
    perform public.notify(c.creator, 'challenge_joined', me, jsonb_build_object('challenge_id', challenge, 'title', c.title));
  end if;
end $$;

/* Forlat en utfordring. Forlater den som laget den, slettes utfordringen. */
create or replace function public.leave_challenge(challenge uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if exists (select 1 from public.challenges where id = challenge and creator = me) then
    delete from public.challenges where id = challenge;
  else
    delete from public.challenge_members where challenge_id = challenge and user_id = me;
  end if;
end $$;

/* Stillingen i en utfordring, regnet ut fra publiserte økter (ikke tall appen sender inn). */
drop function if exists public.challenge_standings(uuid);
create or replace function public.challenge_standings(challenge uuid)
returns table (rank bigint, user_id uuid, value numeric, reached_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.challenges;
begin
  if not public.in_challenge(challenge, auth.uid()) then raise exception 'ikke med i utfordringen'; end if;
  select * into c from public.challenges where id = challenge;
  return query
  with m as (
    select cm.user_id from public.challenge_members cm where cm.challenge_id = challenge and cm.status = 'joined'
  ), inside as (
    select a.* from public.activities a join m on m.user_id = a.user_id
    where a.started_at >= c.starts_at and a.started_at < c.ends_at
  ), v as (
    select m.user_id,
      case c.kind
        when 'workouts' then (select count(*)::numeric from inside i where i.user_id = m.user_id)
        when 'volume' then (select coalesce(sum((i.data ->> 'volume_kg')::numeric), 0) from inside i where i.user_id = m.user_id)
        when 'weekly' then (select count(*)::numeric from (
            select date_trunc('week', i.started_at) w from inside i where i.user_id = m.user_id
            group by 1 having count(*) >= c.target) weeks)
        when 'lift' then greatest(0,
            coalesce((select max((i.data -> 'lifts' ->> c.exercise_id)::numeric) from inside i where i.user_id = m.user_id), 0)
          - coalesce((select max((a.data -> 'lifts' ->> c.exercise_id)::numeric) from public.activities a
                      where a.user_id = m.user_id and a.started_at < c.starts_at),
                     (select max((i.data -> 'lifts' ->> c.exercise_id)::numeric) from inside i where i.user_id = m.user_id
                      and i.started_at = (select min(j.started_at) from inside j where j.user_id = m.user_id
                                          and j.data -> 'lifts' ? c.exercise_id)), 0))
        when 'goal' then coalesce((select max((i.data -> 'lifts' ->> c.exercise_id)::numeric) from inside i where i.user_id = m.user_id), 0)
      end as val,
      -- Første økt der målet ble nådd (bare «goal»).
      case when c.kind = 'goal' then (select min(i.started_at) from inside i where i.user_id = m.user_id
                                      and (i.data -> 'lifts' ->> c.exercise_id)::numeric >= c.target) end as reached
    from m
  )
  select rank() over (order by v.reached asc nulls last, v.val desc), v.user_id, round(v.val, 1), v.reached
  from v order by v.reached asc nulls last, v.val desc;
end $$;

/* Reaksjon gir varsel til eieren (høyst ett per person og økt). */
create or replace function public.reaction_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.notifications n where n.user_id = new.activity_owner and n.actor = new.user_id
                 and n.kind = 'reaction' and n.payload ->> 'activity_id' = new.activity_id) then
    perform public.notify(new.activity_owner, 'reaction', new.user_id, jsonb_build_object('activity_id', new.activity_id, 'emoji', new.emoji));
  end if;
  return new;
end $$;
drop trigger if exists reaction_notify on public.reactions;
create trigger reaction_notify after insert on public.reactions for each row execute function public.reaction_notify();

-- ---------- Tilganger ----------

grant select, insert, update, delete on public.social_profiles, public.activities, public.reactions, public.notifications to authenticated;
grant select on public.follows, public.blocks, public.challenges, public.challenge_members to authenticated;
grant insert on public.reports to authenticated;
revoke all on public.social_profiles, public.follows, public.blocks, public.reports, public.activities, public.reactions,
  public.challenges, public.challenge_members, public.notifications from anon;
grant select, insert, update, delete on public.social_profiles, public.follows, public.blocks, public.reports, public.activities,
  public.reactions, public.challenges, public.challenge_members, public.notifications to service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'name_problem(text, text)', 'has_social(uuid)', 'is_blocked(uuid, uuid)', 'can_see(uuid, uuid)', 'mutual(uuid, uuid)', 'can_challenge(uuid, uuid)',
    'notify(uuid, text, uuid, jsonb)', 'in_challenge(uuid, uuid)',
    'follow_user(uuid)', 'unfollow_user(uuid)', 'accept_follower(uuid)', 'remove_follower(uuid)',
    'followers_not_followed_back()', 'remove_followers(uuid[])', 'block_user(uuid)', 'unblock_user(uuid)',
    'people(uuid[])', 'find_by_handle(text)', 'handle_available(text)', 'discover(text, integer)',
    'leaderboard(text, text, text, timestamptz, integer)',
    'create_challenge(text, text, timestamptz, timestamptz, uuid[], text, numeric)',
    'respond_challenge(uuid, boolean)', 'leave_challenge(uuid)', 'challenge_standings(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- notify() skal bare kalles av databasen selv, ikke av appen.
  execute 'revoke execute on function public.notify(uuid, text, uuid, jsonb) from authenticated';
end $$;
