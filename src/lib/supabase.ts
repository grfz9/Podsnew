import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Backend optionnel (comptes, synchronisation, social, résumés, espace créateurs).
 * Sans configuration, l'application fonctionne entièrement en local.
 * Voir le README : section « Activer les comptes (Supabase) ».
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// Flux PKCE : au retour de Google ou d'Apple, le code arrive dans « ?code= », avant le « # » du routeur.
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;

export const backendEnabled = supabase !== null;

/** Nom du serveur configuré (ex. « abcd.supabase.co »), pour les messages d'aide. */
export const backendHost: string | null = (() => {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return url ?? null;
  }
})();

/** Erreur réseau du navigateur (serveur introuvable, hors-ligne, requête bloquée). */
export function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const status = (err as { status?: number } | null)?.status;
  return (
    /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_name_not_resolved|err_internet_disconnected/i.test(message) ||
    (status === 0 && /fetch/i.test(message))
  );
}

/** Message compréhensible à la place de « Failed to fetch ». */
export function friendlyError(err: unknown): string {
  if (isNetworkError(err)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Vous êtes hors-ligne. Vérifiez votre connexion internet puis réessayez.';
    }
    return `Impossible de joindre le serveur des comptes${backendHost ? ` (${backendHost})` : ''}. Vérifiez votre connexion ; si elle fonctionne, le serveur est en pause ou son adresse est incorrecte.`;
  }
  return err instanceof Error ? err.message : String(err);
}

export type BackendHealth = 'ok' | 'offline' | 'unreachable' | 'bad-key' | 'error';

/** Vérifie que le serveur des comptes répond (adresse et clé publique). */
export async function checkBackend(timeoutMs = 8000): Promise<BackendHealth> {
  if (!url || !key) return 'error';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { headers: { apikey: key }, signal: controller.signal });
    if (res.ok) return 'ok';
    return res.status === 401 || res.status === 403 ? 'bad-key' : 'error';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}

export function requireBackend(): SupabaseClient {
  if (!supabase) throw new Error("Les comptes ne sont pas activés sur cette installation de Podsal.");
  return supabase;
}

/** Appelle une fonction serveur et renvoie une erreur lisible. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const client = requireBackend();
  const { data, error } = await client.functions.invoke<T>(name, { body });
  if (error) {
    if (isNetworkError(error) || error.name === 'FunctionsFetchError') throw new Error(friendlyError(new Error('Failed to fetch')));
    let message = 'Le service est momentanément indisponible. Réessayez plus tard.';
    try {
      const details = await (error as { context?: Response }).context?.json();
      if (typeof details?.error === 'string') message = details.error;
    } catch {
      /* corps illisible */
    }
    throw new Error(message);
  }
  return data as T;
}

/* ---------- Lignes des tables (voir supabase/migrations) ---------- */

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  /** Faux pour un pseudo provisoire (compte créé avec Google, Apple ou un téléphone). */
  username_set?: boolean;
  created_at: string;
}

export interface CreatorPodcastRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  author: string;
  category_id: number;
  language: string;
  cover_url: string | null;
  explicit: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorEpisodeRow {
  id: string;
  podcast_id: string;
  title: string;
  description: string;
  audio_url: string;
  audio_path: string;
  audio_size: number;
  audio_type: string;
  duration: number;
  published_at: string;
  created_at: string;
}

export interface EpisodeSummary {
  summary: string;
  keyPoints: string[];
  topics: string[];
  chapters: { start: number; title: string }[];
}
