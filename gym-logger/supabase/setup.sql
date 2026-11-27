-- RepGrade: hele databaseoppsettet i én fil.
-- Lim inn i Supabase → SQL Editor → New query → Run. Trygt å kjøre flere ganger.
-- Generert fra supabase/migrations/ med `node scripts/make-setup-sql.mjs`. Ikke rediger for hånd.

-- ============================================================
-- 001_init.sql
-- ============================================================

-- Gym Logger: tabeller for synk. Kjør i Supabase → SQL Editor.
-- Hver bruker ser og endrer bare egne rader (Row Level Security).
-- Ingen fremmednøkler: appen er offline-først, og rader kan komme i vilkårlig rekkefølge.

create table if not exists public.exercises (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text not null,
  custom smallint not null default 1,
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.routines (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  notes text not null default '',
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.routine_exercises (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_id text not null,
  exercise_id text not null,
  position integer not null,
  target_sets integer not null,
  target_reps integer not null,
  rest_seconds integer not null,
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.workouts (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  routine_id text,
  name text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text not null default '',
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.workout_exercises (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  workout_id text not null,
  exercise_id text not null,
  position integer not null,
  rest_seconds integer not null,
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.sets (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  workout_exercise_id text not null,
  workout_id text not null,
  exercise_id text not null,
  position integer not null,
  weight numeric not null,
  reps integer not null,
  is_warmup smallint not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Serveren stempler hver endring, så andre enheter kan hente «alt siden sist».
create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['exercises','routines','routine_exercises','workouts','workout_exercises','sets'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format('create trigger touch_%1$s before insert or update on public.%1$I
                    for each row execute function public.touch_server_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create index if not exists %1$s_pull_idx on public.%1$I (user_id, server_updated_at, id)', t);
  end loop;
end $$;

-- ============================================================
-- 002_profiles.sql
-- ============================================================

-- Gym Logger v2: profiler, kroppsvekt, set-typer, notater og sletting av konto.
-- Kjør i Supabase → SQL Editor etter 001_init.sql.

create table if not exists public.profiles (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null default '',
  color text not null default '#2bd66b',
  goal text not null default 'hypertrophy',
  weekly_target integer not null default 3,
  experience text not null default 'beginner',
  bodyweight_kg numeric,
  height_cm numeric,
  birth_year integer,
  created_at timestamptz not null default now(),
  onboarded_at timestamptz,
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.bodyweights (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  date timestamptz not null,
  weight_kg numeric not null,
  updated_at timestamptz not null,
  deleted smallint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Set-type erstatter is_warmup.
alter table public.sets add column if not exists set_type text not null default 'normal';
-- Bare hvis den gamle kolonnen fortsatt finnes, så filen kan kjøres flere ganger.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sets' and column_name = 'is_warmup') then
    update public.sets set set_type = 'warmup' where is_warmup = 1 and set_type = 'normal';
    alter table public.sets drop column is_warmup;
  end if;
end $$;

alter table public.workout_exercises add column if not exists notes text not null default '';

do $$
declare t text;
begin
  foreach t in array array['profiles','bodyweights'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format('create trigger touch_%1$s before insert or update on public.%1$I
                    for each row execute function public.touch_server_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create index if not exists %1$s_pull_idx on public.%1$I (user_id, server_updated_at, id)', t);
  end loop;
end $$;

-- Lar en innlogget bruker slette sin egen konto. Alle rader slettes via «on delete cascade».
create or replace function public.delete_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- ============================================================
-- 003_qol.sql
-- ============================================================

-- Gym Logger v3: mål-reps fra rutinen lagres på øvelsen i økta (brukes til progresjonsforslag).
-- Kjør i Supabase → SQL Editor etter 002_profiles.sql.

alter table public.workout_exercises add column if not exists target_reps integer;

-- ============================================================
-- 004_kinds.sql
-- ============================================================

-- Gym Logger v4: øvelsestyper (vekt, kroppsvekt, tid, kondisjon) og distanse for kondisjon.
-- Kjør i Supabase → SQL Editor etter 003_qol.sql.

alter table public.exercises add column if not exists kind text not null default 'weight';
alter table public.sets add column if not exists distance_km numeric;

-- ============================================================
-- 005_sex.sql
-- ============================================================

-- Gym Logger v6: valgfritt kjønn i profilen, brukt til standardene for styrkenivå.
alter table public.profiles add column if not exists sex text check (sex in ('male', 'female'));

-- ============================================================
-- 006_consent.sql
-- ============================================================

-- Repgrade v7: samtykke til kroppsdata i skyen (GDPR art. 9).
-- Uten samtykke sender appen ikke kroppsvekt-loggen, og profilens kroppsvekt, høyde,
-- fødselsår og kjønn sendes som tomme. Når samtykket trekkes, sletter appen kroppsvekt-loggen her.
alter table public.profiles add column if not exists health_consent_at timestamptz;

-- ============================================================
-- 007_grants.sql
-- ============================================================

-- Repgrade: gi innloggede brukere tilgang til tabellene (nyere Supabase-prosjekter gjør ikke dette automatisk).
-- Row Level Security sørger fortsatt for at hver bruker bare ser og endrer egne rader.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.exercises, public.routines, public.routine_exercises, public.workouts,
  public.workout_exercises, public.sets, public.profiles, public.bodyweights
  to authenticated;
revoke all on
  public.exercises, public.routines, public.routine_exercises, public.workouts,
  public.workout_exercises, public.sets, public.profiles, public.bodyweights
  from anon;

-- ============================================================
-- 008_routine_source.sql
-- ============================================================

-- Repgrade: hvilket program en rutine kom fra («program:<id>»). null = brukerens egen rutine.
-- Brukes for å erstatte gamle startrutiner trygt når man bytter program.
alter table public.routines add column if not exists source text;

-- ============================================================
-- 009_routine_position.sql
-- ============================================================

-- Repgrade: rekkefølgen på rutinene. Den neste i rekkefølgen etter forrige økt står for tur.
alter table public.routines add column if not exists position integer;

-- ============================================================
-- 010_push.sql
-- ============================================================

-- Repgrade v1.1: varsel når pausen er over, også med låst telefon (web push).
-- Appen lagrer telefonens push-abonnement og når pausen slutter. En jobb i databasen (pg_cron)
-- sjekker hvert 5. sekund og kaller Edge-funksjonen «rest-alarms», som sender varselet.
-- Før denne kjøres: lag hemmeligheten «rest_alarm_secret» og sett prosjekt-adressen (se README).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "egne push-abonnement" on public.push_subscriptions;
create policy "egne push-abonnement" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Én alarm per bruker: en ny pause erstatter den forrige.
create table if not exists public.rest_alarms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  send_at timestamptz not null,
  title text not null,
  body text not null default ''
);
alter table public.rest_alarms enable row level security;
drop policy if exists "egne pausealarmer" on public.rest_alarms;
create policy "egne pausealarmer" on public.rest_alarms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists rest_alarms_send_at on public.rest_alarms (send_at);

grant select, insert, update, delete on public.push_subscriptions, public.rest_alarms to authenticated;
-- Edge-funksjonen bruker service_role og må kunne lese og slette alarmer og abonnement.
grant select, insert, update, delete on public.push_subscriptions, public.rest_alarms to service_role;

-- Jobben: kall funksjonen bare når en alarm er forfalt (billig når ingen trener).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('rest-alarms') where exists (select 1 from cron.job where jobname = 'rest-alarms');
select cron.schedule(
  'rest-alarms',
  '5 seconds',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'rest_alarm_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rest_alarm_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from public.rest_alarms where send_at <= now());
  $$
);
