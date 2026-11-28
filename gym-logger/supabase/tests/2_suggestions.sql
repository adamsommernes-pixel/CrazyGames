-- Forslag til folk å følge (013_suggestions.sql). Kjøres av scripts/test-db.sh. Alt rulles tilbake til slutt.
--
--   M  meg (privat, 16+)        F, G  jeg følger dem (godtatt)
--   S  privat, F og G følger S  T  privat, følger meg
--   O  åpen                     N  privat, har slått av forslag
--   U  under 16                 Q  jeg har spurt (venter)
--   BL blokkert av meg          W  treningskonto (skjult)
\set M '20000000-0000-0000-0000-000000000001'
\set F '20000000-0000-0000-0000-000000000002'
\set G '20000000-0000-0000-0000-000000000003'
\set S '20000000-0000-0000-0000-000000000004'
\set T '20000000-0000-0000-0000-000000000005'
\set O '20000000-0000-0000-0000-000000000006'
\set N '20000000-0000-0000-0000-000000000007'
\set U '20000000-0000-0000-0000-000000000008'
\set Q '20000000-0000-0000-0000-000000000009'
\set BL '20000000-0000-0000-0000-00000000000a'
\set W '20000000-0000-0000-0000-00000000000b'

begin;
insert into auth.users (id) select unnest(array[:'M', :'F', :'G', :'S', :'T', :'O', :'N', :'U', :'Q', :'BL', :'W']::uuid[]);
insert into public.profiles (id, user_id, updated_at, social)
select u::text, u, now(), 1 from unnest(array[:'M', :'F', :'G', :'S', :'T', :'O', :'N', :'U', :'Q', :'BL', :'W']::uuid[]) u;
-- Profilene lages som eier (RLS testes i 1_social.sql).
insert into public.social_profiles (user_id, handle, display_name, visibility, is_16_plus, tier_index, suggestable) values
  (:'M', 'meg', 'Meg', 1, true, 3, true),
  (:'F', 'frida', 'Frida', 3, true, 4, true),
  (:'G', 'geir', 'Geir', 3, true, 4, true),
  (:'S', 'sara', 'Sara', 1, true, 6, true),
  (:'T', 'tor', 'Tor', 1, true, 2, true),
  (:'O', 'ola', 'Ola', 3, true, 5, true),
  (:'N', 'nina', 'Nina', 1, true, 5, false),
  (:'U', 'ung', 'Ung', 1, false, 1, true),
  (:'Q', 'quinn', 'Quinn', 1, true, 2, true),
  (:'BL', 'blokk', 'Blokk', 3, true, 2, true),
  (:'W', 'walter', 'Walter', 3, true, 2, true);
update public.profiles set social = 0 where user_id = :'W';
insert into public.follows (follower, followee, status) values
  (:'M', :'F', 'accepted'), (:'M', :'G', 'accepted'),
  (:'F', :'S', 'accepted'), (:'G', :'S', 'accepted'), (:'F', :'O', 'accepted'),
  (:'T', :'M', 'accepted'), (:'M', :'Q', 'pending'),
  (:'F', :'U', 'accepted'), (:'F', :'N', 'accepted');
insert into public.blocks (blocker, blocked) values (:'M', :'BL');
insert into public.activities (user_id, id, started_at, ended_at, data) values (:'S', 'w-s1', now() - interval '2 hours', now() - interval '1 hour', '{}');
select test.ok(not (select active from public.social_profiles where user_id = :'W'), 'treningskonto er skjult');

set role authenticated;
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', u::text, false) $$;
select pg_temp.as_user(:'M');

select test.ok((select array_agg(handle order by handle) from public.suggestions()) = array['ola', 'sara', 'tor'],
               'forslag: S, T og O. Ikke dem jeg følger/har spurt, ikke blokkert, under 16, avslått eller skjult');
select test.ok((select array_agg(handle) from public.suggestions()) = array['sara', 'ola', 'tor'],
               'felles venner først (S: 2, O: 1), så de som følger meg (T)');
select test.ok((select mutual_count = 2 and mutual_names = array['Frida', 'Geir'] and not follows_you from public.suggestions() where handle = 'sara'),
               'antall og navn på felles venner');
select test.ok((select follows_you and mutual_count = 0 from public.suggestions() where handle = 'tor'), 'markerer dem som følger meg');
select test.ok((select tier_index is null and visibility = 1 from public.suggestions() where handle = 'sara'), 'privat konto: nivå er skjult i forslag');
select test.ok((select tier_index = 5 from public.suggestions() where handle = 'ola'), 'åpen konto: nivå vises');
select test.ok(test.n('select * from public.suggestions(1)') = 1, 'grense på antall');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'S')) = 0, 'forslag gir ikke tilgang til øktene');

-- Navnesøk (discover) finner nå også private som kan foreslås
select test.ok(test.n($q$select * from public.discover('sara')$q$) = 1, 'søk finner privat konto');
select test.ok((select tier_index is null from public.discover('sara')), 'søk skjuler nivå for privat konto');
select test.ok(test.n($q$select * from public.discover('nina')$q$) = 0 and test.n($q$select * from public.discover('ung')$q$) = 0
               and test.n($q$select * from public.discover('blokk')$q$) = 0, 'søk finner ikke avslått, under 16 eller blokkert');
select test.ok((select following from public.discover('frida')), 'søk viser at jeg følger');

-- Den foreslåtte ser meg ikke om jeg er blokkert; under 16 får ingen andre foreslått seg selv, men kan selv se forslag
select pg_temp.as_user(:'BL');
select test.ok(test.n($q$select * from public.suggestions() where handle = 'meg'$q$) = 0, 'blokkering gjelder begge veier');
select pg_temp.as_user(:'U');
select test.ok(test.n('select * from public.suggestions()') > 0, 'under 16 kan se forslag');

-- Slå av forslag
select pg_temp.as_user(:'S');
update public.social_profiles set suggestable = false where user_id = auth.uid();
select pg_temp.as_user(:'M');
select test.ok(test.n($q$select * from public.suggestions() where handle = 'sara'$q$) = 0, 'privat konto som slår av forslag forsvinner');
select pg_temp.as_user(:'O');
update public.social_profiles set suggestable = false where user_id = auth.uid();
select pg_temp.as_user(:'M');
select test.ok(test.n($q$select * from public.suggestions() where handle = 'ola'$q$) = 1, 'åpen konto vises uansett (den er åpen)');

-- Antall følgere
select test.ok((select followers = 2 and following = 0 from public.follow_counts(:'S'::uuid)), 'følgere av S: F og G');
select test.ok((select followers = 1 and following = 2 from public.follow_counts(:'M'::uuid)), 'mine tall: T følger meg, jeg følger F og G (Q venter)');
select test.ok((select following = 4 from public.follow_counts(:'F'::uuid)), 'F følger S, O, U og N');
select test.ok(test.n(format('select * from public.follow_counts(%L)', :'BL')) = 0, 'ingen tall for blokkert');
select test.ok(test.n(format('select * from public.follow_counts(%L)', :'W')) = 0, 'ingen tall for skjult konto');

-- Kudos-lista: navn på dem som reagerte, også fremmede private
reset role;
insert into public.activities (user_id, id, started_at, ended_at, data) values (:'F', 'w-f1', now() - interval '2 hours', now() - interval '1 hour', '{}');
insert into public.reactions (activity_owner, activity_id, user_id, emoji) values (:'F', 'w-f1', :'N', '🔥');
set role authenticated;
select pg_temp.as_user(:'M');
select test.ok(test.n(format('select * from public.people(array[%L]::uuid[])', :'N')) = 1, 'ser navnet på den som ga kudos');
select test.ok((select tier_index is null from public.people(array[:'N'::uuid])), '… men ikke nivået');

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test.fails('select * from public.suggestions()', 'uinnlogget får ikke forslag', 'permission denied');
select test.fails(format('select * from public.follow_counts(%L)', :'M'), 'uinnlogget får ikke tall', 'permission denied');

rollback;
