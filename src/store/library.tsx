import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { Clip, Episode, EpisodeProgress, Playlist, Podcast } from '../types';
import { moveInQueue } from '../utils/queue';
import { usePersistentState } from '../utils/hooks';
import { addCompletion, addListening, emptyDeviceStats } from '../lib/stats';
import { LIST_KEYS, type ListKey, type SyncedData } from '../lib/sync';

const HISTORY_LIMIT = 100;
const HISTORY_DESCRIPTION_MAX = 600;

export type TranslationSetting = 'rashid' | 'hamidullah' | 'none';

export type PrayerMethod = 'mwl' | 'ummalqura' | 'egypt' | 'karachi' | 'isna' | 'moonsighting' | 'uoif' | 'fifteen';

export interface PrayerSettings {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  place: string;
  method: PrayerMethod;
  madhab: 'shafi' | 'hanafi';
  /** Met la lecture en pause à l'heure de chaque prière. */
  pauseAtAdhan: boolean;
  /** Notification à l'heure de chaque prière. */
  notify: boolean;
}

export interface Settings {
  notifications: boolean;
  quran: {
    translation: TranslationSetting;
    showArabic: boolean;
    favorites: number[];
  };
  prayer: PrayerSettings;
  /** Fond d'écran de l'application (voir src/data/wallpapers.ts ; « custom » = image importée). */
  wallpaper: string;
  /** Fond du menu de gauche (« uni » = couleur d'origine). */
  sidebarWallpaper: string;
  /** Ordre des épisodes sur la page d'un podcast : « oldest » = ordre de lecture (épisode 1 en premier). */
  episodeOrder: 'oldest' | 'newest';
}

export const DEFAULT_SETTINGS: Settings = {
  notifications: false,
  wallpaper: 'halo',
  sidebarWallpaper: 'uni',
  episodeOrder: 'oldest',
  quran: { translation: 'rashid', showArabic: true, favorites: [] },
  prayer: {
    enabled: false,
    latitude: null,
    longitude: null,
    place: '',
    method: 'mwl',
    madhab: 'shafi',
    pauseAtAdhan: true,
    notify: false,
  },
};

export interface LibraryState extends SyncedData {
  version: 2;
  deviceId: string;
  country: string;
  settings: Settings;
  /** Date du dernier épisode connu par podcast (sert aux notifications). */
  seen: Record<string, string>;
  sync: { userId: string | null; lastSyncedAt: number | null };
}

/** Version légère d'un épisode pour les playlists (description raccourcie). */
function lightEpisode(e: Episode): Episode {
  return { ...e, description: e.description.slice(0, 300) };
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Données de la première version de l'application (une clé localStorage par collection). */
function readV1<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`podsnew:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function initialState(): LibraryState {
  return {
    version: 2,
    deviceId: newId(),
    country: readV1('country', 'fr'),
    subscriptions: readV1('subscriptions', []),
    savedEpisodes: readV1('saved', []),
    history: readV1('history', []),
    clips: [],
    progress: readV1('progress', {}),
    stats: {},
    playlists: [],
    modified: { subscriptions: 0, savedEpisodes: 0, history: 0, clips: 0, playlists: 0 },
    settings: DEFAULT_SETTINGS,
    seen: {},
    sync: { userId: null, lastSyncedAt: null },
  };
}

/** Complète un état chargé depuis le stockage avec les champs ajoutés depuis. */
function normalize(stored: Partial<LibraryState> | null): LibraryState {
  const base = initialState();
  if (!stored || stored.version !== 2) return base;
  return {
    ...base,
    ...stored,
    modified: { ...base.modified, ...stored.modified },
    settings: {
      ...base.settings,
      ...stored.settings,
      quran: { ...base.settings.quran, ...stored.settings?.quran },
      prayer: { ...base.settings.prayer, ...stored.settings?.prayer },
    },
    playlists: stored.playlists ?? [],
    sync: { ...base.sync, ...stored.sync },
  };
}

export interface LibraryValue {
  state: LibraryState;
  deviceId: string;
  country: string;
  setCountry: (code: string) => void;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;

  subscriptions: Podcast[];
  isSubscribed: (podcastId: string) => boolean;
  toggleSubscription: (podcast: Podcast) => void;
  subscribeMany: (podcasts: Podcast[]) => void;

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

  /** Temps d'écoute réel, pour les statistiques. */
  recordListening: (episode: Episode, seconds: number) => void;

  clips: Clip[];
  addClip: (clip: Omit<Clip, 'id' | 'createdAt'>) => Clip;
  removeClip: (id: string) => void;

  playlists: Playlist[];
  createPlaylist: (name: string, items?: Episode[]) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, episode: Episode) => void;
  removeFromPlaylist: (id: string, episodeId: string) => void;
  movePlaylistItem: (id: string, from: number, to: number) => void;

  seen: Record<string, string>;
  markSeen: (entries: Record<string, string>) => void;

  /** Remplace les données synchronisées (après fusion avec le cloud). */
  applySynced: (data: SyncedData, userId: string) => void;
  resetSync: () => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistentState<LibraryState>('podsnew:library', initialState);
  const state = useMemo(() => normalize(stored), [stored]);

  const update = useCallback(
    (fn: (s: LibraryState) => Partial<LibraryState>) => setStored((prev) => {
      const s = normalize(prev);
      return { ...s, ...fn(s) };
    }),
    [setStored],
  );

  /** Met à jour une liste synchronisée en notant l'heure de modification. */
  const updateList = useCallback(
    <K extends ListKey>(key: K, fn: (list: LibraryState[K]) => LibraryState[K]) =>
      update((s) => ({ [key]: fn(s[key]), modified: { ...s.modified, [key]: Date.now() } }) as Partial<LibraryState>),
    [update],
  );

  const subscribedIds = useMemo(() => new Set(state.subscriptions.map((p) => p.id)), [state.subscriptions]);
  const savedIds = useMemo(() => new Set(state.savedEpisodes.map((e) => e.id)), [state.savedEpisodes]);

  const value = useMemo<LibraryValue>(() => {
    const podcastMeta = (episode: Episode) => {
      const sub = state.subscriptions.find((p) => p.id === episode.podcastId);
      return { title: episode.podcastTitle, artwork: episode.artwork || sub?.artwork || '', genre: episode.genre ?? sub?.genre };
    };

    return {
      state,
      deviceId: state.deviceId,
      country: state.country,
      setCountry: (country) => update(() => ({ country })),
      settings: state.settings,
      setSettings: (patch) => update((s) => ({ settings: { ...s.settings, ...patch } })),

      subscriptions: state.subscriptions,
      isSubscribed: (id) => subscribedIds.has(id),
      toggleSubscription: (podcast) =>
        updateList('subscriptions', (subs) =>
          subs.some((p) => p.id === podcast.id) ? subs.filter((p) => p.id !== podcast.id) : [podcast, ...subs],
        ),
      subscribeMany: (podcasts) =>
        updateList('subscriptions', (subs) => {
          const known = new Set(subs.map((p) => p.id));
          return [...podcasts.filter((p) => !known.has(p.id)), ...subs];
        }),

      savedEpisodes: state.savedEpisodes,
      isSaved: (id) => savedIds.has(id),
      toggleSaved: (episode) =>
        updateList('savedEpisodes', (list) =>
          list.some((e) => e.id === episode.id) ? list.filter((e) => e.id !== episode.id) : [episode, ...list],
        ),

      progress: state.progress,
      saveProgress: (episodeId, position, duration, completed) =>
        update((s) => {
          const wasCompleted = s.progress[episodeId]?.completed;
          const out: Partial<LibraryState> = {
            progress: { ...s.progress, [episodeId]: { position, duration, completed, updatedAt: Date.now() } },
          };
          if (completed && !wasCompleted) {
            out.stats = { ...s.stats, [s.deviceId]: addCompletion(s.stats[s.deviceId] ?? emptyDeviceStats()) };
          }
          return out;
        }),
      setCompleted: (episode, completed) =>
        update((s) => ({
          progress: {
            ...s.progress,
            [episode.id]: {
              position: completed ? episode.duration : 0,
              duration: s.progress[episode.id]?.duration || episode.duration,
              completed,
              updatedAt: Date.now(),
            },
          },
        })),

      history: state.history,
      addToHistory: (episode) =>
        updateList('history', (list) =>
          [
            { ...episode, description: episode.description.slice(0, HISTORY_DESCRIPTION_MAX) },
            ...list.filter((e) => e.id !== episode.id),
          ].slice(0, HISTORY_LIMIT),
        ),
      clearHistory: () => updateList('history', () => []),

      recordListening: (episode, seconds) =>
        update((s) => ({
          stats: {
            ...s.stats,
            [s.deviceId]: addListening(s.stats[s.deviceId] ?? emptyDeviceStats(), episode.podcastId, podcastMeta(episode), seconds),
          },
        })),

      clips: state.clips,
      addClip: (data) => {
        const clip: Clip = { ...data, id: newId(), createdAt: Date.now() };
        updateList('clips', (list) => [clip, ...list]);
        return clip;
      },
      removeClip: (id) => updateList('clips', (list) => list.filter((c) => c.id !== id)),

      playlists: state.playlists,
      createPlaylist: (name, items = []) => {
        const now = Date.now();
        const playlist: Playlist = { id: newId(), name: name.trim().slice(0, 80) || 'Nouvelle playlist', items: items.map(lightEpisode), createdAt: now, updatedAt: now };
        updateList('playlists', (list) => [playlist, ...list]);
        return playlist;
      },
      renamePlaylist: (id, name) =>
        updateList('playlists', (list) => list.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, 80) || p.name, updatedAt: Date.now() } : p))),
      deletePlaylist: (id) => updateList('playlists', (list) => list.filter((p) => p.id !== id)),
      addToPlaylist: (id, episode) =>
        updateList('playlists', (list) =>
          list.map((p) =>
            p.id === id && !p.items.some((e) => e.id === episode.id)
              ? { ...p, items: [...p.items, lightEpisode(episode)], updatedAt: Date.now() }
              : p,
          ),
        ),
      removeFromPlaylist: (id, episodeId) =>
        updateList('playlists', (list) =>
          list.map((p) => (p.id === id ? { ...p, items: p.items.filter((e) => e.id !== episodeId), updatedAt: Date.now() } : p)),
        ),
      movePlaylistItem: (id, from, to) =>
        updateList('playlists', (list) =>
          list.map((p) => (p.id === id ? { ...p, items: moveInQueue(p.items, from, to), updatedAt: Date.now() } : p)),
        ),

      seen: state.seen,
      markSeen: (entries) => update((s) => ({ seen: { ...s.seen, ...entries } })),

      applySynced: (data, userId) =>
        update(() => {
          const out: Partial<LibraryState> = { progress: data.progress, stats: data.stats, modified: data.modified };
          for (const key of LIST_KEYS) (out as Record<string, unknown>)[key] = data[key];
          return { ...out, sync: { userId, lastSyncedAt: Date.now() } };
        }),
      resetSync: () => update(() => ({ sync: { userId: null, lastSyncedAt: null } })),
    };
  }, [state, subscribedIds, savedIds, update, updateList]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary doit être utilisé dans <LibraryProvider>');
  return ctx;
}
