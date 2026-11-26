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
