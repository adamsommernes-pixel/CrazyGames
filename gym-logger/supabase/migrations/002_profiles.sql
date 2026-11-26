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
update public.sets set set_type = 'warmup' where is_warmup = 1 and set_type = 'normal';
alter table public.sets drop column if exists is_warmup;

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
