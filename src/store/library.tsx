import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { Episode, EpisodeProgress, Podcast } from '../types';
import { usePersistentState } from '../utils/hooks';

const HISTORY_LIMIT = 100;

interface LibraryValue {
  country: string;
  setCountry: (code: string) => void;

  subscriptions: Podcast[];
  isSubscribed: (podcastId: string) => boolean;
  toggleSubscription: (podcast: Podcast) => void;

  savedEpisodes: Episode[];
  isSaved: (episodeId: string) => boolean;
  toggleSaved: (episode: Episode) => void;

  progress: Record<string, EpisodeProgress>;
  saveProgress: (episodeId: string, position: number, duration: number, completed: boolean) => void;
  setCompleted: (episode: Episode, completed: boolean) => void;

  /** Épisodes récemment écoutés, du plus récent au plus ancien. */
  history: Episode[];
  addToHistory: (episode: Episode) => void;
  clearHistory: () => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = usePersistentState('podsnew:country', 'fr');
  const [subscriptions, setSubscriptions] = usePersistentState<Podcast[]>('podsnew:subscriptions', []);
  const [savedEpisodes, setSavedEpisodes] = usePersistentState<Episode[]>('podsnew:saved', []);
  const [progress, setProgress] = usePersistentState<Record<string, EpisodeProgress>>('podsnew:progress', {});
  const [history, setHistory] = usePersistentState<Episode[]>('podsnew:history', []);

  const subscribedIds = useMemo(() => new Set(subscriptions.map((p) => p.id)), [subscriptions]);
  const savedIds = useMemo(() => new Set(savedEpisodes.map((e) => e.id)), [savedEpisodes]);

  const toggleSubscription = useCallback(
    (podcast: Podcast) =>
      setSubscriptions((subs) =>
        subs.some((p) => p.id === podcast.id) ? subs.filter((p) => p.id !== podcast.id) : [podcast, ...subs],
      ),
    [setSubscriptions],
  );

  const toggleSaved = useCallback(
    (episode: Episode) =>
      setSavedEpisodes((list) =>
        list.some((e) => e.id === episode.id) ? list.filter((e) => e.id !== episode.id) : [episode, ...list],
      ),
    [setSavedEpisodes],
  );

  const saveProgress = useCallback(
    (episodeId: string, position: number, duration: number, completed: boolean) =>
      setProgress((all) => ({ ...all, [episodeId]: { position, duration, completed, updatedAt: Date.now() } })),
    [setProgress],
  );

  const setCompleted = useCallback(
    (episode: Episode, completed: boolean) =>
      setProgress((all) => ({
        ...all,
        [episode.id]: {
          position: completed ? episode.duration : 0,
          duration: all[episode.id]?.duration || episode.duration,
          completed,
          updatedAt: Date.now(),
        },
      })),
    [setProgress],
  );

  const addToHistory = useCallback(
    (episode: Episode) =>
      setHistory((list) => [episode, ...list.filter((e) => e.id !== episode.id)].slice(0, HISTORY_LIMIT)),
    [setHistory],
  );

  const clearHistory = useCallback(() => setHistory([]), [setHistory]);

  const value = useMemo<LibraryValue>(
    () => ({
      country,
      setCountry,
      subscriptions,
      isSubscribed: (id) => subscribedIds.has(id),
      toggleSubscription,
      savedEpisodes,
      isSaved: (id) => savedIds.has(id),
      toggleSaved,
      progress,
      saveProgress,
      setCompleted,
      history,
      addToHistory,
      clearHistory,
    }),
    [
      country, setCountry, subscriptions, subscribedIds, toggleSubscription, savedEpisodes, savedIds,
      toggleSaved, progress, saveProgress, setCompleted, history, addToHistory, clearHistory,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary doit être utilisé dans <LibraryProvider>');
  return ctx;
}
