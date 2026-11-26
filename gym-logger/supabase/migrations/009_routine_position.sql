-- Repgrade: rekkefølgen på rutinene. Den neste i rekkefølgen etter forrige økt står for tur.
alter table public.routines add column if not exists position integer;
