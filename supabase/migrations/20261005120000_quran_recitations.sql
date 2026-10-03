-- Podsal : récitations du Coran ajoutées à la main par la modération (enregistrements anciens,
-- récitateurs absents de mp3quran.net). Chaque récitation donne l'adresse du fichier audio de
-- chaque sourate disponible ; elles s'affichent dans la page Coran, à côté des récitations de mp3quran.net.

create table public.quran_recitations (
  id bigint generated always as identity primary key,
  reciter text not null check (char_length(reciter) between 1 and 120),
  -- Précision affichée sous le nom : époque, lieu, occasion (ex. « Enregistrements du Caire, 1960 »).
  title text not null default '' check (char_length(title) <= 160),
  riwaya text not null default 'Hafs ʿan ʿĀsim' check (char_length(riwaya) between 1 and 80),
  style text not null default 'Murattal' check (char_length(style) between 1 and 80),
  -- Provenance et crédit (ex. « Archive.org, collection … »).
  source text check (char_length(source) <= 500),
  -- { "1": "https://…/001.mp3", "18": "https://…/018.mp3", … }
  tracks jsonb not null default '{}'::jsonb check (jsonb_typeof(tracks) = 'object'),
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quran_recitations enable row level security;

create policy "Récitations visibles par tous" on public.quran_recitations
  for select using (true);
create policy "Ajout par la modération" on public.quran_recitations
  for insert with check (public.is_moderator());
create policy "Modification par la modération" on public.quran_recitations
  for update using (public.is_moderator()) with check (public.is_moderator());
create policy "Retrait par la modération" on public.quran_recitations
  for delete using (public.is_moderator());
