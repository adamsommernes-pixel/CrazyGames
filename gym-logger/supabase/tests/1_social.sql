-- Sikkerhetsregler for Sosialt (012_social.sql). Kjøres av scripts/test-db.sh. Alt rulles tilbake til slutt.
--
-- Testbrukere:
--   A  Privat (1)          B  Ledertavler (2)      C  Åpen (3)
--   D  Privat, fremmed      E  bytter til treningskonto (skjult)
--   K  under 16             X  ingen sosial profil (bare treningskonto)
\set A 'a0000000-0000-0000-0000-00000000000a'
\set B 'b0000000-0000-0000-0000-00000000000b'
\set C 'c0000000-0000-0000-0000-00000000000c'
\set D 'd0000000-0000-0000-0000-00000000000d'
\set E 'e0000000-0000-0000-0000-00000000000e'
\set K 'f0000000-0000-0000-0000-00000000000f'
\set X '10000000-0000-0000-0000-000000000010'

begin;

insert into auth.users (id) select unnest(array[:'A', :'B', :'C', :'D', :'E', :'K', :'X']::uuid[]);
-- Treningsprofilene (synkes fra appen). social = 1 for sosiale kontoer.
insert into public.profiles (id, user_id, updated_at, social)
select u::text, u, now(), case when u = :'X'::uuid then 0 else 1 end
from unnest(array[:'A', :'B', :'C', :'D', :'E', :'K', :'X']::uuid[]) u;

set role authenticated;
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', u::text, false) $$;

-- ===== Sosial profil =====
select pg_temp.as_user(:'A');
insert into public.social_profiles (user_id, handle, display_name, visibility) values (:'A', 'anna', 'Anna', 1);
select test.ok((select active from public.social_profiles where user_id = :'A'), 'ny profil er aktiv for sosial konto');
select test.fails(format($q$insert into public.social_profiles (user_id, handle, display_name) values (%L, 'tyv', 'Tyv')$q$, :'B'), 'kan ikke lage profil for en annen', 'row-level security');
select test.fails($q$update public.social_profiles set handle = 'Ugyldig Navn!' where user_id = auth.uid()$q$, 'brukernavn med ugyldige tegn avvises', 'handle_check');
select test.fails($q$update public.social_profiles set visibility = 2 where user_id = auth.uid()$q$, 'nivå 2 krever bekreftet 16+', 'under_16_private');
select test.fails($q$update public.social_profiles set handle = 'repgrade_team' where user_id = auth.uid()$q$, 'reserverte brukernavn avvises', 'ikke tillatt \(reserved\)');
select test.fails($q$update public.social_profiles set handle = 'admin' where user_id = auth.uid()$q$, 'admin er reservert', 'ikke tillatt');
select test.fails($q$update public.social_profiles set display_name = 'Big Fuck' where user_id = auth.uid()$q$, 'støtende visningsnavn avvises', 'ikke tillatt \(banned\)');
select test.ok(not public.handle_available('admin') and not public.handle_available('repgrade'), 'reserverte navn er ikke ledige');
select test.ok(public.name_problem('anna_b', 'Anna Berg') is null and public.name_problem('nazira', 'Nazira') is null
               and public.name_problem('fittest_ola', 'Pikkolo') is null, 'vanlige navn og ord er ok');

select pg_temp.as_user(:'B');
insert into public.social_profiles (user_id, handle, display_name, visibility, is_16_plus, tier_index, score, lift_scores)
values (:'B', 'bjorn', 'Bjørn', 2, true, 5, 52, '{"ex-benkpress": 55}');
select test.fails($q$update public.social_profiles set handle = 'anna' where user_id = auth.uid()$q$, 'brukernavn må være unikt', 'handle_key');
select pg_temp.as_user(:'C');
insert into public.social_profiles (user_id, handle, display_name, visibility, is_16_plus, tier_index, score, lift_scores)
values (:'C', 'cecilie', 'Cecilie', 3, true, 7, 71, '{"ex-benkpress": 70}');
select pg_temp.as_user(:'D');
insert into public.social_profiles (user_id, handle, display_name) values (:'D', 'david', 'David');
select pg_temp.as_user(:'E');
insert into public.social_profiles (user_id, handle, display_name, visibility, is_16_plus) values (:'E', 'eva', 'Eva', 3, true);
select pg_temp.as_user(:'K');
select test.fails(format($q$insert into public.social_profiles (user_id, handle, display_name, visibility) values (%L, 'kid', 'Kid', 3)$q$, :'K'), 'under 16 kan ikke ha åpen konto', 'under_16_private');
insert into public.social_profiles (user_id, handle, display_name) values (:'K', 'kid', 'Kid');

-- Hvem ser hvilke profiler (D er fremmed for alle)
select pg_temp.as_user(:'D');
select test.ok(test.n(format('select 1 from public.social_profiles where user_id = %L', :'A')) = 0, 'fremmed ser ikke privat profil');
select test.ok(test.n(format('select 1 from public.social_profiles where user_id = %L', :'B')) = 1, 'fremmed ser profil på ledertavle-nivå');
select test.ok(test.n(format('select 1 from public.social_profiles where user_id = %L', :'C')) = 1, 'fremmed ser åpen profil');
select test.ok(test.n($q$select * from public.find_by_handle('@Anna')$q$) = 1, 'privat konto finnes med eksakt brukernavn (også med @ og store bokstaver)');
select test.ok(test.n($q$select * from public.find_by_handle('ann')$q$) = 0, 'ikke treff på deler av brukernavnet');
select test.ok(not public.handle_available('anna') and public.handle_available('ny_bruker'), 'ledig brukernavn sjekkes');
select pg_temp.as_user(:'X');
select test.ok(test.n('select 1 from public.social_profiles') = 0, 'treningskonto uten sosial profil ser ingen profiler');

-- ===== Aktivitet =====
select pg_temp.as_user(:'A');
insert into public.activities (user_id, id, name, started_at, ended_at, data)
values (:'A', 'w-a1', 'Bein', now() - interval '2 hours', now() - interval '1 hour', '{"volume_kg": 5000, "lifts": {"ex-kneboy": 120}}');
select test.fails(format($q$insert into public.activities (user_id, id, started_at, ended_at, data) values (%L, 'w-x', now(), now(), '{}')$q$, :'B'), 'kan ikke publisere for en annen', 'row-level security');
select pg_temp.as_user(:'X');
select test.fails(format($q$insert into public.activities (user_id, id, started_at, ended_at, data) values (%L, 'w-x', now(), now(), '{}')$q$, :'X'), 'kan ikke publisere uten sosial profil', 'row-level security');
select pg_temp.as_user(:'B');
insert into public.activities (user_id, id, name, started_at, ended_at, data)
values (:'B', 'w-b1', 'Push', now() - interval '3 hours', now() - interval '2 hours', '{"volume_kg": 3000}');
select pg_temp.as_user(:'C');
insert into public.activities (user_id, id, name, started_at, ended_at, data)
values (:'C', 'w-c1', 'Pull', now() - interval '3 hours', now() - interval '2 hours', '{"volume_kg": 4000}');

select pg_temp.as_user(:'D');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'A')) = 0, 'fremmed ser ikke økter fra privat konto');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'B')) = 0, 'fremmed ser ikke økter fra ledertavle-konto');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'C')) = 1, 'fremmed ser økter fra åpen konto');
update public.activities set name = 'hacket' where user_id = :'C';
select test.ok((select name from public.activities where user_id = :'C' and id = 'w-c1') = 'Pull', 'andres økt er uendret');

-- De private treningstabellene er fortsatt bare dine
select test.ok(test.n('select 1 from public.workouts') = 0 and test.n('select 1 from public.sets') = 0, 'private treningstabeller er fortsatt lukket');

-- ===== Følging =====
select pg_temp.as_user(:'B');
select test.ok(public.follow_user(:'A') = 'pending', 'følge privat konto gir forespørsel');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'A')) = 0, 'ventende forespørsel gir ikke tilgang');
select test.ok(public.follow_user(:'C') = 'accepted', 'følge åpen konto godtas med en gang');
select test.fails(format($q$insert into public.follows (follower, followee, status) values (%L, %L, 'accepted')$q$, :'B', :'A'), 'kan ikke skrive direkte i follows', 'permission denied');
select test.fails(format($q$update public.follows set status = 'accepted' where followee = %L$q$, :'A'), 'kan ikke godta sin egen forespørsel', 'permission denied');
select pg_temp.as_user(:'D');
select public.accept_follower(:'B');
select pg_temp.as_user(:'A');
select test.ok((select status from public.follows where follower = :'B' and followee = :'A') = 'pending', 'D kan ikke godta på vegne av A');
select test.ok(test.n('select 1 from public.notifications where kind = ''follow_request''') = 1, 'A får varsel om forespørselen');
select test.ok(test.n(format('select * from public.people(array[%L]::uuid[])', :'B')) = 1, 'A ser hvem som spør (people)');
select public.accept_follower(:'B');
select pg_temp.as_user(:'B');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'A')) = 1, 'godtatt følger ser øktene');
select test.ok(test.n(format('select 1 from public.social_profiles where user_id = %L', :'A')) = 1, 'godtatt følger ser profilen');
select test.ok(test.n('select 1 from public.notifications where kind = ''follow_accepted''') = 1, 'B får varsel om at forespørselen er godtatt');
select test.ok(test.n(format('select 1 from public.notifications where user_id = %L', :'A')) = 0, 'B ser ikke As varsler');

-- Privat → åpen: ventende forespørsler godtas
select pg_temp.as_user(:'D');
select test.ok(public.follow_user(:'A') = 'pending', 'D ber om å følge A');
select pg_temp.as_user(:'A');
update public.social_profiles set is_16_plus = true, visibility = 3 where user_id = auth.uid();
select test.ok((select status from public.follows where follower = :'D' and followee = :'A') = 'accepted', 'bytte til åpen godtar ventende forespørsler');
-- Åpen → privat: følgere du ikke følger tilbake kan fjernes
update public.social_profiles set visibility = 1 where user_id = auth.uid();
select test.ok(test.n('select * from public.followers_not_followed_back()') = 2, 'to følgere A ikke følger tilbake');
select test.ok(public.remove_followers(array[:'D']::uuid[]) = 1, 'fjern én følger');
select test.ok(test.n('select * from public.followers_not_followed_back()') = 1, 'én igjen');
select pg_temp.as_user(:'D');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'A')) = 0, 'fjernet følger ser ikke lenger øktene');

-- ===== Reaksjoner =====
select pg_temp.as_user(:'D');
select test.fails(format($q$insert into public.reactions (activity_owner, activity_id, user_id, emoji) values (%L, 'w-a1', %L, '💪')$q$, :'A', :'D'), 'kan ikke reagere på økter du ikke ser', 'row-level security');
select pg_temp.as_user(:'B');
insert into public.reactions (activity_owner, activity_id, user_id, emoji) values (:'A', 'w-a1', :'B', '🔥');
select test.fails(format($q$insert into public.reactions (activity_owner, activity_id, user_id, emoji) values (%L, 'w-a1', %L, '🔥')$q$, :'A', :'C'), 'kan ikke reagere i en annens navn', 'row-level security');
select test.fails(format($q$insert into public.reactions (activity_owner, activity_id, user_id, emoji) values (%L, 'w-c1', %L, 'lol')$q$, :'C', :'B'), 'bare godkjente emoji', 'emoji_check');
select test.fails($q$select public.notify(auth.uid(), 'reaction', auth.uid())$q$, 'appen kan ikke lage varsler selv', 'permission denied');
select pg_temp.as_user(:'A');
select test.ok(test.n('select 1 from public.notifications where kind = ''reaction''') = 1, 'eieren får varsel om reaksjonen');
select test.ok(test.n('select 1 from public.reactions') = 1, 'eieren ser reaksjonen');

-- ===== Blokkering =====
select pg_temp.as_user(:'A');
select public.block_user(:'B');
select test.ok(test.n(format('select 1 from public.follows where follower = %L or followee = %L', :'B', :'B')) = 0, 'blokkering fjerner følging');
select test.ok(test.n('select 1 from public.reactions') = 0, 'blokkering fjerner reaksjoner');
select pg_temp.as_user(:'B');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'A')) = 0, 'blokkert ser ikke økter');
select test.ok(test.n($q$select * from public.find_by_handle('anna')$q$) = 0, 'blokkert finner ikke brukeren');
select test.fails(format('select public.follow_user(%L)', :'A'), 'blokkert kan ikke følge', 'fant ikke brukeren');
select pg_temp.as_user(:'A');
select public.unblock_user(:'B');
select test.ok(test.n('select 1 from public.blocks') = 0, 'blokkering kan oppheves');

-- ===== Treningskonto (skjult) =====
select pg_temp.as_user(:'D');
select test.ok(public.follow_user(:'E') = 'accepted', 'D følger E (åpen)');
select pg_temp.as_user(:'E');
insert into public.activities (user_id, id, started_at, ended_at, data) values (:'E', 'w-e1', now() - interval '1 hour', now(), '{"volume_kg": 1000}');
update public.profiles set social = 0, updated_at = now() where user_id = auth.uid();
select test.ok(not (select active from public.social_profiles where user_id = :'E'), 'bytte til treningskonto skjuler den sosiale profilen');
update public.social_profiles set active = true where user_id = auth.uid();
select test.ok(not (select active from public.social_profiles where user_id = :'E'), 'appen kan ikke vise profilen igjen uten å bytte kontotype');
select pg_temp.as_user(:'D');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'E')) = 0, 'skjult konto: følgere ser ikke øktene');
select test.ok(test.n(format('select 1 from public.social_profiles where user_id = %L', :'E')) = 0, 'skjult konto: profilen er borte for andre');
select test.ok(test.n('select * from public.find_by_handle(''eva'')') = 0, 'skjult konto finnes ikke');
select test.ok(test.n(format('select 1 from public.follows where followee = %L', :'E')) = 1, 'følgerne beholdes mens kontoen er skjult');
select pg_temp.as_user(:'E');
update public.profiles set social = 1, updated_at = now() where user_id = auth.uid();
select pg_temp.as_user(:'D');
select test.ok(test.n(format('select 1 from public.activities where user_id = %L', :'E')) = 1, 'tilbake til sosial: alt er synlig igjen');

-- ===== Ledertavler og Oppdag =====
select pg_temp.as_user(:'A');
select test.fails($q$select * from public.leaderboard('level')$q$, 'privat konto får ikke se ledertavler', 'krever nivå 2');
select pg_temp.as_user(:'B');
select test.ok(test.n($q$select * from public.leaderboard('level')$q$) = 2, 'ledertavle: bare nivå 2 og 3 (B og C)');
select test.ok((select handle from public.leaderboard('level') where rank = 1) = 'cecilie', 'høyeste poeng øverst');
select test.ok(test.n($q$select * from public.leaderboard('lift', 'all', 'ex-benkpress')$q$) = 2, 'ledertavle per løft');
select test.ok(test.n($q$select * from public.leaderboard('workouts', 'all', null, now() - interval '1 day')$q$) = 3, 'ledertavle for økter (B, C og E)');
select test.ok(test.n($q$select * from public.leaderboard('level', 'following')$q$) = 2, 'B følger C: begge på følger-tavla');
-- Mitt nivå: B er nivå 5, C er nivå 7 → bare B. Settes C til nivå 5, er begge med.
select test.ok((select array_agg(handle) from public.leaderboard('level', 'tier')) = array['bjorn'], 'mitt nivå: bare de på samme nivå');
reset role;
update public.social_profiles set tier_index = 5 where user_id = :'C';
set role authenticated;
select test.ok(test.n($q$select * from public.leaderboard('level', 'tier')$q$) = 2, 'mitt nivå: C på samme nivå er med');
reset role;
update public.social_profiles set tier_index = 7 where user_id = :'C';
set role authenticated;
-- Fremgang: C hadde 60 poeng etter en økt før måneden, nå 71 → +11. B har ingen økt med nivå → ikke med.
select pg_temp.as_user(:'C');
insert into public.activities (user_id, id, started_at, ended_at, data)
values (:'C', 'w-c0', now() - interval '40 days', now() - interval '40 days' + interval '1 hour', '{"volume_kg": 1, "tier": {"index": 6, "score": 60}}');
select pg_temp.as_user(:'B');
select test.ok((select value from public.leaderboard('gain', 'all', null, now() - interval '30 days') where handle = 'cecilie') = 11, 'fremgang: 71 − 60 = 11 poeng');
select test.ok(test.n($q$select * from public.leaderboard('gain', 'all', null, now() - interval '30 days') where handle = 'bjorn'$q$) = 0, 'fremgang krever en økt med nivå');
select pg_temp.as_user(:'C');
update public.social_profiles set share_from = now() - interval '7 days' where user_id = auth.uid();
select test.ok((select share_from from public.social_profiles where user_id = auth.uid()) is not null, 'deling fra-dato lagres');
select pg_temp.as_user(:'B');
select test.ok(test.n($q$select * from public.discover()$q$) = 2, 'Oppdag viser bare åpne kontoer (C og E)');
select test.ok(test.n($q$select * from public.discover('cec')$q$) = 1, 'søk i Oppdag');
select pg_temp.as_user(:'X');
select test.ok(test.n($q$select * from public.discover()$q$) = 0, 'Oppdag krever sosial profil');

-- ===== Utfordringer =====
select pg_temp.as_user(:'A');
select test.fails(format($q$select public.create_challenge('workouts', 'Mest trening', now() - interval '1 day', now() + interval '7 days', array[%L]::uuid[])$q$, :'D'), 'kan ikke utfordre en privat konto du ikke følger gjensidig', 'ingen av dem kan utfordres');
select public.create_challenge('workouts', 'Mest trening', now() - interval '1 day', now() + interval '7 days', array[:'C', :'D']::uuid[]) as cid \gset
select test.ok(test.n(format('select 1 from public.challenge_members where challenge_id = %L', :'cid')) = 2, 'bare C (åpen) ble invitert, ikke D');
select pg_temp.as_user(:'D');
select test.ok(test.n(format('select 1 from public.challenges where id = %L', :'cid')) = 0, 'utenforstående ser ikke utfordringen');
select test.fails(format('select * from public.challenge_standings(%L)', :'cid'), 'utenforstående ser ikke stillingen', 'ikke med i utfordringen');
select pg_temp.as_user(:'C');
select test.ok(test.n('select 1 from public.notifications where kind = ''challenge_invite''') = 1, 'C får invitasjon');
select public.respond_challenge(:'cid', true);
select pg_temp.as_user(:'A');
select test.ok((select value from public.challenge_standings(:'cid') where user_id = :'A') = 1
               and (select value from public.challenge_standings(:'cid') where user_id = :'C') = 1, 'stillingen regnes fra publiserte økter');
-- Gjensidige følgere kan utfordre hverandre, også privat
select pg_temp.as_user(:'D');
select public.follow_user(:'A');
select pg_temp.as_user(:'A');
select public.accept_follower(:'D');
select public.follow_user(:'D');
select pg_temp.as_user(:'D');
select public.accept_follower(:'A');
select pg_temp.as_user(:'A');
select public.create_challenge('volume', 'Volum', now() - interval '1 day', now() + interval '7 days', array[:'D']::uuid[]) as cid2 \gset
select test.ok(test.n(format('select 1 from public.challenge_members where challenge_id = %L', :'cid2')) = 2, 'gjensidige følgere kan utfordres');
-- Løftutfordring: økning i beregnet 1RM fra før start (100) til beste i perioden (120) = 20
insert into public.activities (user_id, id, started_at, ended_at, data)
values (:'A', 'w-a0', now() - interval '10 days', now() - interval '10 days' + interval '1 hour', '{"volume_kg": 4000, "lifts": {"ex-kneboy": 100}}');
select public.create_challenge('lift', 'Knebøy', now() - interval '1 day', now() + interval '7 days', array[:'D']::uuid[], 'ex-kneboy') as cid3 \gset
select pg_temp.as_user(:'D');
select public.respond_challenge(:'cid3', true);
select pg_temp.as_user(:'A');
select test.ok((select value from public.challenge_standings(:'cid3') where user_id = :'A') = 20, 'løftutfordring: økningen fra før start (100 → 120 = 20)');
select test.ok((select value from public.challenge_standings(:'cid3') where user_id = :'D') = 0, 'løftutfordring: uten økter gir 0');
-- Ukeutfordring: uker med minst `target` økter
select public.create_challenge('weekly', 'Hver uke', now() - interval '20 days', now() + interval '7 days', array[:'D']::uuid[], null, 1) as cid4 \gset
select test.ok((select value from public.challenge_standings(:'cid4') where user_id = :'A') = 2, 'ukeutfordring: to uker med minst én økt');
select test.fails($q$select public.create_challenge('weekly', 'Feil', now(), now() + interval '7 days', array[auth.uid()]::uuid[])$q$, 'ukeutfordring krever mål', 'challenges_weekly_target');
-- Først til 110 kg i knebøy: A har 120 i perioden (w-a1), D har ingen økter
select public.create_challenge('goal', '110 kg', now() - interval '1 day', now() + interval '7 days', array[:'D']::uuid[], 'ex-kneboy', 110) as cid5 \gset
select pg_temp.as_user(:'D');
select public.respond_challenge(:'cid5', true);
select pg_temp.as_user(:'A');
select test.ok((select reached_at from public.challenge_standings(:'cid5') where user_id = :'A') is not null
               and (select rank from public.challenge_standings(:'cid5') where user_id = :'A') = 1, 'mål: A nådde 110 kg og leder');
select test.ok((select reached_at from public.challenge_standings(:'cid5') where user_id = :'D') is null, 'mål: D har ikke nådd det');
select test.fails($q$select public.create_challenge('goal', 'Uten mål', now(), now() + interval '7 days', array[auth.uid()]::uuid[], 'ex-kneboy')$q$, 'målutfordring krever målvekt', 'challenges_goal_target');
select test.fails($q$select public.create_challenge('goal', 'Uten løft', now(), now() + interval '7 days', array[auth.uid()]::uuid[], null, 100)$q$, 'målutfordring krever løft', 'challenges_lift_exercise');
select test.fails($q$select public.create_challenge('workouts', 'For lang', now(), now() + interval '400 days', array[auth.uid()]::uuid[])$q$, 'utfordringer varer høyst ett år', 'challenges_period');
select public.leave_challenge(:'cid2');
select test.ok(test.n(format('select 1 from public.challenges where id = %L', :'cid2')) = 0, 'den som laget utfordringen kan avlyse den');
select test.fails($q$insert into public.challenges (creator, kind, title, starts_at, ends_at) values (auth.uid(), 'workouts', 'x', now(), now() + interval '1 day')$q$, 'kan ikke skrive direkte i challenges', 'permission denied');

-- ===== Merker =====
select pg_temp.as_user(:'A');
select test.fails('select public.award_challenge_badges()', 'appen kan ikke dele ut merker', 'permission denied');
select test.fails($q$insert into public.badges (user_id, kind, ref) values (auth.uid(), 'challenge', 'falsk')$q$, 'kan ikke gi seg selv merker', 'permission denied');
reset role;
-- En avsluttet utfordring (A og C, begge med én økt i perioden → delt seier) og «Først til målet» (A nådde 110 kg)
insert into public.challenges (id, creator, kind, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-0000000000e1', :'A', 'workouts', 'Ferdig', now() - interval '1 day', now() - interval '1 minute');
insert into public.challenge_members (challenge_id, user_id, status) values
  ('00000000-0000-0000-0000-0000000000e1', :'A', 'joined'), ('00000000-0000-0000-0000-0000000000e1', :'C', 'joined');
select test.ok(public.award_challenge_badges() = 3, 'merker: delt seier (A og C) og først til målet (A)');
select test.ok(public.award_challenge_badges() = 0, 'merker gis aldri to ganger');
select test.ok((select count(*) from public.notifications where kind = 'badge' and user_id = :'A') = 2, 'varsel om merke');
-- Månedens tavler: C (71) og B (52) på samme nivå → C vinner «Sterkest» på nivå 5
update public.social_profiles set tier_index = 5 where user_id = :'C';
select test.ok(public.award_monthly_badges(current_date) > 0, 'månedsmerker deles ut');
select test.ok(exists (select 1 from public.badges where user_id = :'C' and ref = 'board:level:5:' || to_char(now(), 'YYYY-MM')), 'C vant Sterkest på nivå 5');
select test.ok(not exists (select 1 from public.badges where user_id = :'B' and board = 'level'), 'B vant ikke Sterkest');
select test.ok(public.award_monthly_badges(current_date) = 0, 'månedsmerker gis bare én gang');
update public.social_profiles set tier_index = 7 where user_id = :'C';
-- Hvem ser merkene
set role authenticated;
select pg_temp.as_user(:'A');
select test.ok(test.n('select 1 from public.badges where user_id = auth.uid()') = 2, 'egne merker');
select pg_temp.as_user(:'X');
select test.ok(test.n('select 1 from public.badges') = 0, 'uten sosial profil ser du ingen merker');
select pg_temp.as_user(:'D');
select test.ok(test.n(format('select 1 from public.badges where user_id = %L', :'C')) > 0, 'åpen kontos merker er synlige');

-- ===== Rapportering =====
select pg_temp.as_user(:'D');
insert into public.reports (reporter, target, reason) values (:'D', :'C', 'Spam');
select test.fails('select * from public.reports', 'rapporter kan ikke leses av brukere', 'permission denied');

-- ===== Uinnlogget =====
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test.fails('select * from public.activities', 'uinnlogget har ingen tilgang til aktivitet', 'permission denied');
select test.fails('select * from public.find_by_handle(''anna'')', 'uinnlogget kan ikke søke', 'permission denied');

-- ===== Sletting av konto =====
reset role;
delete from auth.users where id = :'C';
select test.ok((select count(*) from public.social_profiles where user_id = :'C') = 0
           and (select count(*) from public.activities where user_id = :'C') = 0
           and (select count(*) from public.follows where follower = :'C' or followee = :'C') = 0
           and (select count(*) from public.challenge_members where user_id = :'C') = 0, 'slettet konto tar med seg alt sosialt');

rollback;
