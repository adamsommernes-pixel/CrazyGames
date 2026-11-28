-- RepGrade 1.4: forslag til folk å følge («Oppdag» i feeden), også private kontoer.
--
-- Private kontoer kan nå vises i forslag og i navnesøk, men bare med navn, @brukernavn og farge.
-- Økter og nivå er fortsatt skjult til forespørselen er godtatt (can_see er uendret).
-- Brukere under 16 år vises aldri for andre. Hver bruker kan slå det av: «Vis meg i forslag» (suggestable).
-- Trygt å kjøre flere ganger.

alter table public.social_profiles add column if not exists suggestable boolean not null default true;

/* Kan `owner` foreslås for `viewer`? Aktiv, 16+, ikke blokkert, og enten åpen eller har sagt ja til forslag. */
create or replace function public.suggestable_for(viewer uuid, owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select viewer <> owner
    and public.has_social(viewer)
    and exists (select 1 from public.social_profiles p where p.user_id = owner and p.active and p.is_16_plus
                and (p.visibility = 3 or p.suggestable))
    and not public.is_blocked(viewer, owner);
$$;

/* Forslag til folk å følge: felles venner først (folk du følger som følger dem), så de som følger deg,
   så de sist aktive. Viser ikke dem du allerede følger eller har spurt. Nivå bare når du har lov å se det. */
create or replace function public.suggestions(lim integer default 20)
returns table (user_id uuid, handle text, display_name text, color text, visibility smallint, tier_index smallint,
               mutual_count integer, mutual_names text[], follows_you boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  my_following as (
    select f.followee from public.follows f, me where f.follower = me.id and f.status = 'accepted'
  ),
  cand as (
    select p.* from public.social_profiles p, me
    where public.suggestable_for(me.id, p.user_id)
      and not exists (select 1 from public.follows f where f.follower = me.id and f.followee = p.user_id)
  ),
  scored as (
    select c.*,
      (select count(*)::int from public.follows f join my_following m on m.followee = f.follower
       where f.followee = c.user_id and f.status = 'accepted') as mutual,
      exists (select 1 from public.follows f, me where f.follower = c.user_id and f.followee = me.id) as fy,
      (select max(a.started_at) from public.activities a where a.user_id = c.user_id) as last_active
    from cand c
  )
  select s.user_id, s.handle, s.display_name, s.color, s.visibility,
    case when s.visibility >= 2 or public.can_see((select id from me), s.user_id) then s.tier_index end,
    s.mutual,
    array(select mp.display_name from public.follows f
          join my_following m on m.followee = f.follower
          join public.social_profiles mp on mp.user_id = f.follower
          where f.followee = s.user_id and f.status = 'accepted' and mp.active
          order by mp.display_name limit 2),
    s.fy
  from scored s
  order by s.mutual desc, s.fy desc, s.last_active desc nulls last, s.display_name
  limit least(greatest(lim, 1), 100);
$$;

/* Navnesøk og Oppdag: nå også private kontoer som kan foreslås (16+, ikke slått av). */
create or replace function public.discover(q text default '', lim integer default 30)
returns table (user_id uuid, handle text, display_name text, color text, tier_index smallint, following boolean)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.display_name, p.color,
         case when p.visibility >= 2 or public.can_see(auth.uid(), p.user_id) then p.tier_index end,
         exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = p.user_id)
  from public.social_profiles p
  where public.suggestable_for(auth.uid(), p.user_id)
    and (coalesce(btrim(q), '') = '' or p.handle ilike '%' || btrim(q) || '%' or p.display_name ilike '%' || btrim(q) || '%')
  order by (p.visibility = 3) desc, (select max(a.started_at) from public.activities a where a.user_id = p.user_id) desc nulls last, p.display_name
  limit least(greatest(lim, 1), 100);
$$;

/* Antall følgere og hvor mange de følger (godtatte). Vises for alle aktive profiler du ikke er blokkert fra. */
create or replace function public.follow_counts(target uuid)
returns table (followers integer, following integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::int from public.follows f join public.social_profiles p on p.user_id = f.follower and p.active
          where f.followee = target and f.status = 'accepted'),
         (select count(*)::int from public.follows f join public.social_profiles p on p.user_id = f.followee and p.active
          where f.follower = target and f.status = 'accepted')
  where public.has_social(auth.uid()) and not public.is_blocked(auth.uid(), target)
    and exists (select 1 from public.social_profiles p where p.user_id = target and (p.active or p.user_id = auth.uid()));
$$;

/* «people» (navn til lister): også de som har reagert på økter du kan se, så kudos-lista viser navn. */
create or replace function public.people(ids uuid[])
returns table (user_id uuid, handle text, display_name text, color text, visibility smallint, tier_index smallint)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.display_name, p.color, p.visibility,
         case when public.can_see(auth.uid(), p.user_id) or p.visibility >= 2 then p.tier_index end
  from public.social_profiles p
  where p.user_id = any(ids) and p.active and not public.is_blocked(auth.uid(), p.user_id)
    and (p.user_id = auth.uid()
         or public.can_see(auth.uid(), p.user_id)
         or p.visibility >= 2
         or public.suggestable_for(auth.uid(), p.user_id)
         or exists (select 1 from public.follows f where (f.follower = auth.uid() and f.followee = p.user_id) or (f.follower = p.user_id and f.followee = auth.uid()))
         or exists (select 1 from public.challenge_members a join public.challenge_members b on a.challenge_id = b.challenge_id
                    where a.user_id = auth.uid() and b.user_id = p.user_id)
         or exists (select 1 from public.reactions r where r.user_id = p.user_id and public.can_see(auth.uid(), r.activity_owner)));
$$;

do $$
declare f text;
begin
  foreach f in array array['suggestable_for(uuid, uuid)', 'suggestions(integer)', 'discover(text, integer)', 'follow_counts(uuid)', 'people(uuid[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
