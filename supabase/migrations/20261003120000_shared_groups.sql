-- Podsal : groupes de fichiers personnels (« Mes fichiers ») publiés sur le profil.
-- Un groupe publié est visible et écoutable uniquement par les amis mutuels de son propriétaire.
-- Publier est réservé à Podsal+ ; la modération (administrateurs) peut masquer ou supprimer un groupe.

-------------------------------------------------------------------------------
-- 1. Podsal+ inclus pour les administrateurs (comme dans l'appli et la fonction summarize)
-------------------------------------------------------------------------------
create or replace function public.is_premium() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.subscriptions
    where user_id = (select auth.uid())
      and status in ('active', 'trialing', 'past_due')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- Amitié mutuelle entre l'utilisateur connecté et une autre personne.
create function public.is_mutual_friend(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows where follower_id = (select auth.uid()) and followee_id = p_other)
     and exists (select 1 from public.follows where follower_id = p_other and followee_id = (select auth.uid()));
$$;

-------------------------------------------------------------------------------
-- 2. Groupes publiés et leurs fichiers
-------------------------------------------------------------------------------
create table public.shared_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Masqué par la modération : invisible pour les amis, seule la modération peut le rétablir.
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_groups_owner_idx on public.shared_groups (owner_id);

create table public.shared_group_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.shared_groups on delete cascade,
  -- Identifiant du fichier sur l'appareil du propriétaire (sert à mettre la publication à jour).
  local_id text not null,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null check (kind in ('audio', 'video')),
  storage_path text not null,
  size bigint not null default 0,
  duration real not null default 0,
  position integer not null default 0,
  unique (group_id, local_id)
);
create index shared_group_items_group_idx on public.shared_group_items (group_id, position);

alter table public.shared_groups enable row level security;
alter table public.shared_group_items enable row level security;

create policy "Voir les groupes publiés" on public.shared_groups
  for select using (
    owner_id = (select auth.uid())
    or public.is_admin()
    or (not hidden and public.is_mutual_friend(owner_id))
  );
create policy "Publier un groupe (Podsal+)" on public.shared_groups
  for insert with check (owner_id = (select auth.uid()) and public.is_premium());
create policy "Modifier son groupe" on public.shared_groups
  for update using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());
create policy "Supprimer un groupe" on public.shared_groups
  for delete using (owner_id = (select auth.uid()) or public.is_admin());

-- Seule la modération peut masquer ou rétablir un groupe.
create function public.shared_groups_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden is distinct from old.hidden and not public.is_admin() then
    raise exception 'Seule la modération peut masquer ou rétablir un groupe.';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Le propriétaire d''un groupe ne peut pas changer.';
  end if;
  return new;
end;
$$;
create trigger shared_groups_guard before update on public.shared_groups
  for each row execute function public.shared_groups_guard();

-- Les fichiers suivent la visibilité de leur groupe (la politique des groupes s'applique dans la sous-requête).
create policy "Voir les fichiers des groupes visibles" on public.shared_group_items
  for select using (exists (select 1 from public.shared_groups g where g.id = shared_group_items.group_id));
create policy "Ajouter un fichier à son groupe (Podsal+)" on public.shared_group_items
  for insert with check (
    public.is_premium()
    and exists (select 1 from public.shared_groups g where g.id = shared_group_items.group_id and g.owner_id = (select auth.uid()))
  );
create policy "Modifier les fichiers de son groupe" on public.shared_group_items
  for update using (exists (select 1 from public.shared_groups g where g.id = shared_group_items.group_id and g.owner_id = (select auth.uid())));
create policy "Retirer un fichier de son groupe" on public.shared_group_items
  for delete using (exists (select 1 from public.shared_groups g where g.id = shared_group_items.group_id and (g.owner_id = (select auth.uid()) or public.is_admin())));

-------------------------------------------------------------------------------
-- 3. Stockage privé des fichiers publiés (lecture par liens signés, amis uniquement)
--    Chemin : <propriétaire>/<groupe>/<fichier>. 50 Mo par fichier (limite de l'offre gratuite).
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shared-files', 'shared-files', false, 52428800,
  array[
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/flac',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'
  ]
)
on conflict (id) do nothing;

create policy "Publier ses fichiers (Podsal+)" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shared-files' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_premium());
create policy "Remplacer ses fichiers publiés" on storage.objects
  for update to authenticated
  using (bucket_id = 'shared-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Supprimer des fichiers publiés" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shared-files' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "Lire les fichiers publiés (propriétaire, amis, admins)" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shared-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
      or exists (
        select 1
        from public.shared_group_items i
        join public.shared_groups g on g.id = i.group_id
        where i.storage_path = objects.name and not g.hidden and public.is_mutual_friend(g.owner_id)
      )
    )
  );
