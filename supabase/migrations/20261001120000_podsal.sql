-- Podsal : application conforme aux valeurs islamiques.
-- - Plus d'avis ni de fil d'activité : les amis peuvent seulement consulter les playlists l'un de l'autre.
-- - Les podcasts islamiques sont validés un par un par les administrateurs ; les utilisateurs peuvent en proposer.
-- - Les administrateurs peuvent masquer n'importe quel podcast du catalogue.

-------------------------------------------------------------------------------
-- 1. Suppression des échanges publics (avis, activité, partage d'écoute)
-------------------------------------------------------------------------------
drop view if exists public.podcast_ratings;
drop table if exists public.reviews;
drop table if exists public.activity;
alter table public.profiles drop column if exists share_activity;

-------------------------------------------------------------------------------
-- 2. Amis (ajout mutuel) : liens visibles seulement par les personnes concernées
-------------------------------------------------------------------------------
drop policy if exists "Abonnements visibles par tous" on public.follows;
create policy "Liens visibles par les personnes concernées" on public.follows
  for select using ((select auth.uid()) in (follower_id, followee_id));
create policy "Refuser une demande ou retirer un ami" on public.follows
  for delete using ((select auth.uid()) = followee_id);

-- Playlists d'un ami : lues dans ses données synchronisées, uniquement si l'amitié est mutuelle.
create function public.friend_playlists(p_friend uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (
    exists (select 1 from public.follows where follower_id = (select auth.uid()) and followee_id = p_friend)
    and exists (select 1 from public.follows where follower_id = p_friend and followee_id = (select auth.uid()))
  ) then
    raise exception 'Vous n''êtes pas ami avec cette personne.';
  end if;
  return coalesce((select data -> 'playlists' from public.user_state where user_id = p_friend), '[]'::jsonb);
end;
$$;

-------------------------------------------------------------------------------
-- 3. Administrateurs (ajoutés depuis l'éditeur SQL du tableau de bord Supabase)
-------------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Aucune politique : la table n'est ni lisible ni modifiable depuis l'application.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-------------------------------------------------------------------------------
-- 4. Podcasts islamiques validés
-------------------------------------------------------------------------------
create table public.islamic_podcasts (
  podcast_id text primary key check (char_length(podcast_id) between 1 and 64),
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '' check (char_length(author) <= 300),
  feed_url text check (char_length(feed_url) <= 2000),
  note text check (char_length(note) <= 1000),
  added_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.islamic_podcasts enable row level security;

create policy "Liste des podcasts validés visible par tous" on public.islamic_podcasts
  for select using (true);
create policy "Validation par les administrateurs" on public.islamic_podcasts
  for insert with check (public.is_admin());
create policy "Modification par les administrateurs" on public.islamic_podcasts
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Retrait par les administrateurs" on public.islamic_podcasts
  for delete using (public.is_admin());

-------------------------------------------------------------------------------
-- 5. Podcasts masqués du catalogue
-------------------------------------------------------------------------------
create table public.blocked_podcasts (
  podcast_id text primary key check (char_length(podcast_id) between 1 and 64),
  title text not null default '' check (char_length(title) <= 300),
  blocked_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.blocked_podcasts enable row level security;

create policy "Liste des podcasts masqués visible par tous" on public.blocked_podcasts
  for select using (true);
create policy "Masquage par les administrateurs" on public.blocked_podcasts
  for insert with check (public.is_admin());
create policy "Rétablissement par les administrateurs" on public.blocked_podcasts
  for delete using (public.is_admin());

-------------------------------------------------------------------------------
-- 6. Propositions de podcasts islamiques par les utilisateurs
-------------------------------------------------------------------------------
create table public.podcast_suggestions (
  id bigint generated always as identity primary key,
  podcast_id text not null check (char_length(podcast_id) between 1 and 64),
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '' check (char_length(author) <= 300),
  reason text check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  suggested_by uuid not null references public.profiles on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  unique (podcast_id, suggested_by)
);

create index podcast_suggestions_status_idx on public.podcast_suggestions (status, created_at);

alter table public.podcast_suggestions enable row level security;

create policy "Voir ses propositions (ou toutes pour un administrateur)" on public.podcast_suggestions
  for select using (suggested_by = (select auth.uid()) or public.is_admin());
-- Compté hors RLS : une sous-requête sur la table dans sa propre politique provoquerait une récursion.
create function public.my_pending_suggestions() returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.podcast_suggestions where suggested_by = (select auth.uid()) and status = 'pending';
$$;

-- Au plus 20 propositions en attente par personne.
create policy "Proposer un podcast" on public.podcast_suggestions
  for insert with check (
    suggested_by = (select auth.uid())
    and status = 'pending'
    and public.my_pending_suggestions() < 20
  );
create policy "Traitement par les administrateurs" on public.podcast_suggestions
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Suppression par les administrateurs" on public.podcast_suggestions
  for delete using (public.is_admin());

-------------------------------------------------------------------------------
-- 7. Studio : pas de catégorie religieuse à la publication
--    (un podcast de science religieuse est proposé puis validé comme les autres)
-------------------------------------------------------------------------------
alter table public.creator_podcasts drop constraint if exists creator_podcasts_category_id_check;
alter table public.creator_podcasts add constraint creator_podcasts_category_id_check
  check (category_id not in (1310, 1523, 1524, 1525, 1314, 1438, 1439, 1440, 1441, 1443, 1444, 1463));
