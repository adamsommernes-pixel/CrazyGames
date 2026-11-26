-- Gym Logger v6: valgfritt kjønn i profilen, brukt til standardene for styrkenivå.
alter table public.profiles add column if not exists sex text check (sex in ('male', 'female'));
