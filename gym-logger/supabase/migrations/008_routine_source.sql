-- Repgrade: hvilket program en rutine kom fra («program:<id>»). null = brukerens egen rutine.
-- Brukes for å erstatte gamle startrutiner trygt når man bytter program.
alter table public.routines add column if not exists source text;
