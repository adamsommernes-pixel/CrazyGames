-- Repgrade: hele databaseoppsettet i én fil.
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
