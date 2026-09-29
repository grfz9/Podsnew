import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Backend optionnel (comptes, synchronisation, social, résumés, espace créateurs).
 * Sans configuration, l'application fonctionne entièrement en local.
 * Voir le README : section « Activer les comptes (Supabase) ».
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export const backendEnabled = supabase !== null;

export function requireBackend(): SupabaseClient {
  if (!supabase) throw new Error("Les comptes ne sont pas activés sur cette installation de Podsal.");
  return supabase;
}

/** Appelle une fonction serveur et renvoie une erreur lisible. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const client = requireBackend();
  const { data, error } = await client.functions.invoke<T>(name, { body });
  if (error) {
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
