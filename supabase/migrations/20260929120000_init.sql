-- Podsnew : schéma initial (comptes, synchronisation, social, transcriptions, résumés, espace créateurs).
-- Chaque table a la sécurité au niveau des lignes (RLS) activée.

-------------------------------------------------------------------------------
-- Profils publics
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  share_activity boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profils visibles par tous" on public.profiles
  for select using (true);
create policy "Chacun modifie son profil" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Création automatique du profil à l'inscription (le pseudo est passé dans les métadonnées).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Données synchronisées de la bibliothèque (abonnements, progression, statistiques…)
-------------------------------------------------------------------------------
create table public.user_state (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "Lecture de ses données" on public.user_state
  for select using ((select auth.uid()) = user_id);
create policy "Création de ses données" on public.user_state
  for insert with check ((select auth.uid()) = user_id);
create policy "Mise à jour de ses données" on public.user_state
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-------------------------------------------------------------------------------
-- Social : abonnements entre utilisateurs, activité, avis
-------------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles on delete cascade,
  followee_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

create policy "Abonnements visibles par tous" on public.follows
  for select using (true);
create policy "Suivre quelqu'un" on public.follows
  for insert with check ((select auth.uid()) = follower_id);
create policy "Ne plus suivre" on public.follows
  for delete using ((select auth.uid()) = follower_id);

create table public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('listen', 'clip', 'review')),
  payload jsonb not null check (pg_column_size(payload) < 16000),
  created_at timestamptz not null default now()
);

create index activity_user_created_idx on public.activity (user_id, created_at desc);

alter table public.activity enable row level security;

-- Visible par son auteur et par les personnes qui le suivent.
-- Les écoutes ne sont visibles que si l'auteur a choisi de partager son activité.
create policy "Activité visible par les abonnés" on public.activity
  for select using (
    user_id = (select auth.uid())
    or (
      exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid()) and f.followee_id = activity.user_id
      )
      and (
        kind <> 'listen'
        or exists (select 1 from public.profiles p where p.id = activity.user_id and p.share_activity)
      )
    )
  );
create policy "Publier sa propre activité" on public.activity
  for insert with check ((select auth.uid()) = user_id);
create policy "Supprimer sa propre activité" on public.activity
  for delete using ((select auth.uid()) = user_id);

create table public.reviews (
  id bigint generated always as identity primary key,
  podcast_id text not null,
  user_id uuid not null references public.profiles on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (podcast_id, user_id)
);

create index reviews_podcast_idx on public.reviews (podcast_id, created_at desc);

alter table public.reviews enable row level security;

create policy "Avis visibles par tous" on public.reviews
  for select using (true);
create policy "Écrire son avis" on public.reviews
  for insert with check ((select auth.uid()) = user_id);
create policy "Modifier son avis" on public.reviews
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Supprimer son avis" on public.reviews
  for delete using ((select auth.uid()) = user_id);

create view public.podcast_ratings with (security_invoker = on) as
  select podcast_id, round(avg(rating)::numeric, 1) as average, count(*)::int as count
  from public.reviews
  group by podcast_id;

-------------------------------------------------------------------------------
-- Transcriptions (fournies par les éditeurs dans leurs flux RSS) et recherche plein texte
-- Écriture réservée aux fonctions serveur (clé service), lecture publique.
-------------------------------------------------------------------------------
create table public.transcripts (
  episode_id text primary key,
  podcast_id text not null,
  episode jsonb not null,
  source_url text not null,
  segments jsonb not null,
  content text not null,
  fts tsvector generated always as (to_tsvector('french', content)) stored,
  created_at timestamptz not null default now()
);

create index transcripts_fts_idx on public.transcripts using gin (fts);

alter table public.transcripts enable row level security;

create policy "Transcriptions visibles par tous" on public.transcripts
  for select using (true);

-- « Dans quel épisode parle-t-on de… » : épisodes, extrait et moment où c'est dit.
create function public.search_transcripts(q text, max_results int default 20)
returns table (episode_id text, podcast_id text, episode jsonb, snippet text, start_at double precision, rank real)
language sql stable set search_path = '' as $$
  with query as (select websearch_to_tsquery('french', q) as tsq)
  select
    t.episode_id,
    t.podcast_id,
    t.episode,
    ts_headline('french', t.content, query.tsq,
      'MaxFragments=2, MaxWords=20, MinWords=8, StartSel=[[, StopSel=]], FragmentDelimiter=" … "') as snippet,
    (
      select (s ->> 'start')::double precision
      from jsonb_array_elements(t.segments) as s
      where to_tsvector('french', s ->> 'text') @@ query.tsq
      limit 1
    ) as start_at,
    ts_rank(t.fts, query.tsq) as rank
  from public.transcripts t, query
  where t.fts @@ query.tsq
  order by rank desc
  limit least(greatest(max_results, 1), 50);
$$;

-------------------------------------------------------------------------------
-- Résumés automatiques d'épisodes (mis en cache : un seul appel au modèle par épisode)
-------------------------------------------------------------------------------
create table public.episode_summaries (
  episode_id text primary key,
  podcast_id text not null,
  summary jsonb not null,
  source text not null check (source in ('transcript', 'description')),
  model text not null,
  requested_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index episode_summaries_requested_idx on public.episode_summaries (requested_by, created_at desc);

alter table public.episode_summaries enable row level security;

create policy "Résumés visibles par tous" on public.episode_summaries
  for select using (true);

-------------------------------------------------------------------------------
-- Espace créateurs
-------------------------------------------------------------------------------
create table public.creator_podcasts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  author text not null check (char_length(author) between 1 and 120),
  -- Catégorie Apple ; la musique (1310 et sous-catégories) est exclue de Podsnew.
  category_id int not null check (category_id not in (1310, 1523, 1524, 1525)),
  language text not null default 'fr' check (language ~ '^[a-z]{2}$'),
  cover_url text,
  -- Adresse publiée dans le flux RSS (exigée par Apple Podcasts), facultative.
  contact_email text check (char_length(contact_email) <= 254),
  explicit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_podcasts_owner_idx on public.creator_podcasts (owner_id);

alter table public.creator_podcasts enable row level security;

create policy "Podcasts de créateurs visibles par tous" on public.creator_podcasts
  for select using (true);
create policy "Créer son podcast" on public.creator_podcasts
  for insert with check ((select auth.uid()) = owner_id);
create policy "Modifier son podcast" on public.creator_podcasts
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Supprimer son podcast" on public.creator_podcasts
  for delete using ((select auth.uid()) = owner_id);

create table public.creator_episodes (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid not null references public.creator_podcasts on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 8000),
  audio_url text not null,
  audio_path text not null,
  audio_size bigint not null default 0,
  audio_type text not null default 'audio/mpeg',
  duration int not null default 0,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index creator_episodes_podcast_idx on public.creator_episodes (podcast_id, published_at desc);

alter table public.creator_episodes enable row level security;

create function public.owns_podcast(p_podcast uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.creator_podcasts where id = p_podcast and owner_id = (select auth.uid()));
$$;

create policy "Épisodes publiés visibles par tous" on public.creator_episodes
  for select using (published_at <= now() or public.owns_podcast(podcast_id));
create policy "Publier un épisode" on public.creator_episodes
  for insert with check (public.owns_podcast(podcast_id));
create policy "Modifier un épisode" on public.creator_episodes
  for update using (public.owns_podcast(podcast_id)) with check (public.owns_podcast(podcast_id));
create policy "Supprimer un épisode" on public.creator_episodes
  for delete using (public.owns_podcast(podcast_id));

-- Met à jour la date du podcast à chaque nouvel épisode (tri « récemment mis à jour »).
create function public.touch_creator_podcast() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.creator_podcasts set updated_at = now() where id = new.podcast_id;
  return new;
end;
$$;

create trigger creator_episode_touch
  after insert on public.creator_episodes
  for each row execute function public.touch_creator_podcast();

-- Écoutes (une ligne par épisode et par appareil d'écoute).
create table public.creator_plays (
  episode_id uuid not null references public.creator_episodes on delete cascade,
  session_id text not null check (char_length(session_id) <= 64),
  user_id uuid references auth.users on delete set null,
  seconds int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (episode_id, session_id)
);

alter table public.creator_plays enable row level security;
-- Aucune politique : accès uniquement via les fonctions ci-dessous.

create function public.track_play(p_episode uuid, p_session text, p_seconds int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_seconds < 0 or p_seconds > 86400 or char_length(p_session) > 64 then
    raise exception 'Valeurs invalides';
  end if;
  insert into public.creator_plays (episode_id, session_id, user_id, seconds)
  values (p_episode, p_session, (select auth.uid()), p_seconds)
  on conflict (episode_id, session_id) do update
    set seconds = greatest(public.creator_plays.seconds, excluded.seconds),
        user_id = coalesce(public.creator_plays.user_id, excluded.user_id),
        updated_at = now();
end;
$$;

-- Statistiques d'un podcast, réservées à son créateur.
create function public.creator_stats(p_podcast uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.creator_podcasts where id = p_podcast and owner_id = (select auth.uid())) then
    raise exception 'Accès refusé';
  end if;

  select jsonb_build_object(
    'episodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'published_at', e.published_at,
        'duration', e.duration,
        'plays', s.plays,
        'listeners', s.listeners,
        'avg_seconds', s.avg_seconds
      ) order by e.published_at desc)
      from public.creator_episodes e
      cross join lateral (
        select
          count(*) filter (where p.seconds >= 30)::int as plays,
          count(distinct coalesce(p.user_id::text, p.session_id)) filter (where p.seconds >= 30)::int as listeners,
          coalesce(round(avg(p.seconds) filter (where p.seconds >= 30)), 0)::int as avg_seconds
        from public.creator_plays p
        where p.episode_id = e.id
      ) s
      where e.podcast_id = p_podcast
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'plays', d.plays) order by d.day)
      from (
        select (p.created_at at time zone 'Europe/Paris')::date as day, count(*)::int as plays
        from public.creator_plays p
        join public.creator_episodes e on e.id = p.episode_id
        where e.podcast_id = p_podcast and p.seconds >= 30 and p.created_at > now() - interval '30 days'
        group by 1
      ) d
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-------------------------------------------------------------------------------
-- Stockage des fichiers des créateurs (pochettes et épisodes)
-- Chaque utilisateur écrit uniquement dans le dossier portant son identifiant.
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers', 'covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('episodes', 'episodes', true, 209715200, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav'])
on conflict (id) do nothing;

create policy "Envoyer ses fichiers" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('covers', 'episodes') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Remplacer ses fichiers" on storage.objects
  for update to authenticated
  using (bucket_id in ('covers', 'episodes') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Supprimer ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id in ('covers', 'episodes') and (storage.foldername(name))[1] = (select auth.uid())::text);
