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
