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
