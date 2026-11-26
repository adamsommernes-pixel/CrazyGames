-- Gym Logger v3: mål-reps fra rutinen lagres på øvelsen i økta (brukes til progresjonsforslag).
-- Kjør i Supabase → SQL Editor etter 002_profiles.sql.

alter table public.workout_exercises add column if not exists target_reps integer;
