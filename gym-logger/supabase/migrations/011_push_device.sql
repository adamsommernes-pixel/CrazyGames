-- RepGrade 1.2: pausevarselet sendes bare til enheten som startet pausen (ikke alle brukerens enheter).
alter table public.rest_alarms add column if not exists endpoint text;
