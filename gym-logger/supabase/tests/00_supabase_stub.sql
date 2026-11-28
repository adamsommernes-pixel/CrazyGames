-- Etterligner det Supabase har som migrasjonene bygger på: rollene, auth.users og auth.uid().
-- Brukes bare i lokale tester (scripts/test-db.sh), aldri i Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Testhjelpere
create schema if not exists test;
grant usage on schema test to anon, authenticated;
create or replace function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FEIL: %', msg; end if;
  raise notice 'ok  %', msg;
end $$;
-- Sjekker at SQL-en feiler, og (med `why`) at feilmeldingen er den riktige, så en krasj ikke teller som bestått.
create or replace function test.fails(q text, msg text, why text default null) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if why is not null and sqlerrm !~* why then
      raise exception 'FEIL: % (feil grunn: %)', msg, sqlerrm;
    end if;
    raise notice 'ok  % (%)', msg, sqlerrm;
    return;
  end;
  raise exception 'FEIL: % (ble ikke stoppet)', msg;
end $$;
create or replace function test.n(q text) returns bigint language plpgsql as $$
declare r bigint;
begin
  execute 'select count(*) from (' || q || ') x' into r;
  return r;
end $$;
grant execute on all functions in schema test to anon, authenticated;
