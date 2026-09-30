-- Podsal : connexion Google / Apple / téléphone, et abonnement Podsal+.

-------------------------------------------------------------------------------
-- 1. Profils créés sans pseudo (Google, Apple, téléphone)
--    Un pseudo provisoire est généré ; l'utilisateur est invité à le choisir.
-------------------------------------------------------------------------------
alter table public.profiles add column if not exists username_set boolean not null default true;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := lower(meta ->> 'username');
  display text := nullif(left(coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name', ''), 60), '');
  base text;
  candidate text;
  chosen boolean := true;
begin
  if wanted is null or wanted !~ '^[a-z0-9_]{3,24}$' or exists (select 1 from public.profiles where username = wanted) then
    chosen := false;
    -- Base : nom affiché ou début de l'adresse e-mail, réduits aux caractères autorisés.
    base := lower(regexp_replace(
      translate(coalesce(display, split_part(coalesce(new.email, ''), '@', 1), ''),
        'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
        'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'),
      '[^a-zA-Z0-9_]+', '_', 'g'));
    base := trim(both '_' from base);
    if char_length(base) < 3 then base := 'auditeur'; end if;
    base := left(base, 18);
    loop
      candidate := base || '_' || substr(md5(random()::text), 1, 4);
      exit when not exists (select 1 from public.profiles where username = candidate);
    end loop;
    wanted := candidate;
  end if;

  insert into public.profiles (id, username, display_name, username_set)
  values (new.id, wanted, coalesce(display, wanted), chosen);
  return new;
end;
$$;

-- Choisir son pseudo (une seule fois pour un pseudo provisoire, ou à tout moment ensuite).
create function public.set_username(p_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  name text := lower(trim(p_username));
begin
  if (select auth.uid()) is null then raise exception 'Connexion requise.'; end if;
  if name !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Le pseudo doit contenir 3 à 24 caractères : lettres minuscules, chiffres ou _.';
  end if;
  if exists (select 1 from public.profiles where username = name and id <> (select auth.uid())) then
    raise exception 'Ce pseudo est déjà pris.';
  end if;
  update public.profiles set username = name, username_set = true where id = (select auth.uid());
end;
$$;

-------------------------------------------------------------------------------
-- 2. Abonnement Podsal+ (Stripe)
--    Écrit uniquement par la fonction « stripe-webhook » (clé de service) ; lisible par son titulaire.
-------------------------------------------------------------------------------
create table public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'none'
    check (status in ('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  plan text check (plan in ('monthly', 'yearly')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Voir son abonnement" on public.subscriptions
  for select using ((select auth.uid()) = user_id);
-- Aucune politique d'écriture : seule la clé de service (webhook Stripe) modifie cette table.

-- Abonnement en cours pour l'utilisateur connecté (les fonctions serveur lisent directement la table).
create function public.is_premium() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = (select auth.uid())
      and status in ('active', 'trialing', 'past_due')
      and (current_period_end is null or current_period_end > now())
  );
$$;
