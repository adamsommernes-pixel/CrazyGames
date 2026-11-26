-- Gym Logger v4: øvelsestyper (vekt, kroppsvekt, tid, kondisjon) og distanse for kondisjon.
-- Kjør i Supabase → SQL Editor etter 003_qol.sql.

alter table public.exercises add column if not exists kind text not null default 'weight';
alter table public.sets add column if not exists distance_km numeric;
