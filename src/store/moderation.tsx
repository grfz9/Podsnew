import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Episode, Podcast } from '../types';
import { ISLAMIC_SEED } from '../data/islamicSeed';
import { checkIsAdmin, getBlocked, getValidated, rowToPodcast, type BlockedRow } from '../api/moderation';
import { allowsEpisode, allowsPodcast, isReligiousContent, type PolicyState } from '../lib/policy';
import { useAuth } from './auth';
import { registerFeed } from '../api/rss';

interface ModerationValue {
  /** Podcasts islamiques validés (liste de départ + validations de la modération), hors podcasts masqués. */
  validated: Podcast[];
  blocked: BlockedRow[];
  isAdmin: boolean;
  loading: boolean;
  isValidated: (podcastId: string) => boolean;
  isBlocked: (podcastId: string) => boolean;
  allowsPodcast: (p: Pick<Podcast, 'id' | 'genre' | 'genreIds' | 'explicit'>) => boolean;
  allowsEpisode: (e: Pick<Episode, 'podcastId' | 'genre' | 'explicit'>) => boolean;
  filterPodcasts: <T extends Pick<Podcast, 'id' | 'genre' | 'genreIds' | 'explicit'>>(list: T[]) => T[];
  filterEpisodes: <T extends Pick<Episode, 'podcastId' | 'genre' | 'explicit'>>(list: T[]) => T[];
  isReligious: (podcastId: string) => boolean;
  reload: () => void;
}

const ModerationContext = createContext<ModerationValue | null>(null);

const SEED: Podcast[] = ISLAMIC_SEED.map((p) => ({ ...p, artwork: '', genre: 'Islam' }));

/** Podcast de la liste de départ (fichier src/data/islamicSeed.ts) : il se retire en le masquant. */
export const isSeedPodcast = (id: string) => SEED.some((p) => p.id === id);

export function ModerationProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [validated, setValidated] = useState<Podcast[]>(SEED);
  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(auth.enabled);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!auth.enabled) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getValidated().catch(() => []), getBlocked().catch(() => [])])
      .then(([rows, blockedRows]) => {
        if (cancelled) return;
        const fromDb = rows.map(rowToPodcast);
        for (const p of fromDb) registerFeed(p.id, p.feedUrl);
        const known = new Set(fromDb.map((p) => p.id));
        setValidated([...fromDb, ...SEED.filter((p) => !known.has(p.id))].sort((a, b) => a.title.localeCompare(b.title, 'fr')));
        setBlocked(blockedRows);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [auth.enabled, nonce]);

  useEffect(() => {
    if (!auth.userId) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [auth.userId]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // La liste évolue avec la modération : on la relit quand l'appli revient au premier plan.
  useEffect(() => {
    if (!auth.enabled) return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 60_000) return;
      last = Date.now();
      reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [auth.enabled, reload]);

  const value = useMemo<ModerationValue>(() => {
    const blockedIds = new Set(blocked.map((b) => b.podcast_id));
    const visible = validated.filter((p) => !blockedIds.has(p.id));
    const state: PolicyState = {
      validated: new Set(visible.map((p) => p.id)),
      blocked: blockedIds,
    };
    return {
      validated: visible,
      blocked,
      isAdmin,
      loading,
      isValidated: (id) => state.validated.has(id),
      isBlocked: (id) => state.blocked.has(id),
      allowsPodcast: (p) => allowsPodcast(p, state),
      allowsEpisode: (e) => allowsEpisode(e, state),
      filterPodcasts: (list) => list.filter((p) => allowsPodcast(p, state)),
      filterEpisodes: (list) => list.filter((e) => allowsEpisode(e, state)),
      isReligious: (id) => isReligiousContent(id, state),
      reload,
    };
  }, [validated, blocked, isAdmin, loading, reload]);

  return <ModerationContext.Provider value={value}>{children}</ModerationContext.Provider>;
}

export function useModeration(): ModerationValue {
  const ctx = useContext(ModerationContext);
  if (!ctx) throw new Error('useModeration doit être utilisé dans <ModerationProvider>');
  return ctx;
}
