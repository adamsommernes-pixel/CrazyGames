-- Repgrade v7: samtykke til kroppsdata i skyen (GDPR art. 9).
-- Uten samtykke sender appen ikke kroppsvekt-loggen, og profilens kroppsvekt, høyde,
-- fødselsår og kjønn sendes som tomme. Når samtykket trekkes, sletter appen kroppsvekt-loggen her.
alter table public.profiles add column if not exists health_consent_at timestamptz;
