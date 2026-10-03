-- Podsal : trois rôles — administrateur > modérateur > utilisateur.
-- - administrateur (table admins) : tout, plus la liste des membres, les statistiques et la gestion des rôles ;
-- - modérateur (table moderators) : la modération (podcasts islamiques, propositions, masquages, groupes publiés) ;
-- - utilisateur : tout le monde.

-------------------------------------------------------------------------------
-- 1. Modérateurs
-------------------------------------------------------------------------------
create table public.moderators (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
-- Aucune politique : la table est gérée uniquement par les fonctions réservées aux administrateurs.

-- Modération : administrateur ou modérateur.
create function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (select 1 from public.moderators where user_id = (select auth.uid()));
$$;

-- Rôle de l'utilisateur connecté : « admin », « moderator » ou « user ».
create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when public.is_admin() then 'admin'
    when exists (select 1 from public.moderators where user_id = (select auth.uid())) then 'moderator'
    else 'user'
  end;
$$;

-------------------------------------------------------------------------------
-- 2. La modération passe aux modérateurs (les administrateurs le restent aussi)
-------------------------------------------------------------------------------
alter policy "Validation par les administrateurs" on public.islamic_podcasts with check (public.is_moderator());
alter policy "Modification par les administrateurs" on public.islamic_podcasts using (public.is_moderator()) with check (public.is_moderator());
alter policy "Retrait par les administrateurs" on public.islamic_podcasts using (public.is_moderator());
alter policy "Masquage par les administrateurs" on public.blocked_podcasts with check (public.is_moderator());
alter policy "Rétablissement par les administrateurs" on public.blocked_podcasts using (public.is_moderator());
alter policy "Voir ses propositions (ou toutes pour un administrateur)" on public.podcast_suggestions
  using (suggested_by = (select auth.uid()) or public.is_moderator());
alter policy "Traitement par les administrateurs" on public.podcast_suggestions using (public.is_moderator()) with check (public.is_moderator());
alter policy "Suppression par les administrateurs" on public.podcast_suggestions using (public.is_moderator());

alter policy "Voir les groupes publiés" on public.shared_groups
  using (owner_id = (select auth.uid()) or public.is_moderator() or (not hidden and public.is_mutual_friend(owner_id)));
alter policy "Modifier son groupe" on public.shared_groups
  using (owner_id = (select auth.uid()) or public.is_moderator())
  with check (owner_id = (select auth.uid()) or public.is_moderator());
alter policy "Supprimer un groupe" on public.shared_groups using (owner_id = (select auth.uid()) or public.is_moderator());
alter policy "Retirer un fichier de son groupe" on public.shared_group_items
  using (exists (select 1 from public.shared_groups g where g.id = shared_group_items.group_id and (g.owner_id = (select auth.uid()) or public.is_moderator())));
alter policy "Supprimer des fichiers publiés" on storage.objects
  using (bucket_id = 'shared-files' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_moderator()));
alter policy "Lire les fichiers publiés (propriétaire, amis, admins)" on storage.objects
  using (
    bucket_id = 'shared-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_moderator()
      or exists (
        select 1
        from public.shared_group_items i
        join public.shared_groups g on g.id = i.group_id
        where i.storage_path = objects.name and not g.hidden and public.is_mutual_friend(g.owner_id)
      )
    )
  );

create or replace function public.shared_groups_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden is distinct from old.hidden and not public.is_moderator() then
    raise exception 'Seule la modération peut masquer ou rétablir un groupe.';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Le propriétaire d''un groupe ne peut pas changer.';
  end if;
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- 3. Espace administrateur : statistiques, membres, rôles
-------------------------------------------------------------------------------
create function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return jsonb_build_object(
    'members', (select count(*) from auth.users),
    'members_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'premium', (
      select count(*) from public.subscriptions
      where status in ('active', 'trialing', 'past_due') and (current_period_end is null or current_period_end > now())
    ),
    'admins', (select count(*) from public.admins),
    'moderators', (select count(*) from public.moderators),
    'shared_groups', (select count(*) from public.shared_groups),
    'validated_podcasts', (select count(*) from public.islamic_podcasts),
    'pending_suggestions', (select count(*) from public.podcast_suggestions where status = 'pending')
  );
end;
$$;

create function public.admin_members(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  email text,
  username text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text,
  premium boolean,
  total bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  pattern text := '%' || replace(replace(replace(coalesce(trim(p_search), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
  select
    u.id,
    u.email::text,
    p.username,
    p.display_name,
    u.created_at,
    u.last_sign_in_at,
    case
      when exists (select 1 from public.admins a where a.user_id = u.id) then 'admin'
      when exists (select 1 from public.moderators m where m.user_id = u.id) then 'moderator'
      else 'user'
    end,
    exists (
      select 1 from public.subscriptions s
      where s.user_id = u.id and s.status in ('active', 'trialing', 'past_due') and (s.current_period_end is null or s.current_period_end > now())
    ),
    count(*) over ()
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(trim(p_search), '') = ''
     or u.email ilike pattern
     or p.username ilike pattern
     or p.display_name ilike pattern
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
end;
$$;

create function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if p_role not in ('admin', 'moderator', 'user') then
    raise exception 'Rôle inconnu.';
  end if;
  if p_user = (select auth.uid()) and p_role <> 'admin' then
    raise exception 'Vous ne pouvez pas retirer votre propre rôle d''administrateur.';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'Membre introuvable.';
  end if;
  delete from public.admins where user_id = p_user and p_role <> 'admin';
  delete from public.moderators where user_id = p_user and p_role <> 'moderator';
  if p_role = 'admin' then
    insert into public.admins (user_id) values (p_user) on conflict do nothing;
  elsif p_role = 'moderator' then
    insert into public.moderators (user_id) values (p_user) on conflict do nothing;
  end if;
end;
$$;

-- Fonctions réservées : jamais appelables sans être connecté (et refusées aux non-administrateurs).
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.admin_members(text, integer, integer) from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_members(text, integer, integer) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
