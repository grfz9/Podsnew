import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Episode } from '../types';
import { usePersistentState } from '../utils/hooks';
import { isFinished, resumePosition } from '../utils/progress';
import * as Q from '../utils/queue';
import { useLibrary } from './library';

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
export const SKIP_BACK = 15;
export const SKIP_FORWARD = 30;
const SAVE_EVERY_MS = 5000;

export type SleepTimer = { kind: 'minutes'; endsAt: number } | { kind: 'episode' } | null;

interface PlayerValue {
  current: Episode | null;
  queue: Episode[];
  isPlaying: boolean;
  isBuffering: boolean;
  error: string | null;
  rate: number;
  volume: number;
  muted: boolean;
  sleep: SleepTimer;

  play: (episode: Episode) => void;
  toggle: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  skip: (delta: number) => void;
  next: () => void;
  enqueue: (episode: Episode) => void;
  enqueueNext: (episode: Episode) => void;
  dequeue: (episodeId: string) => void;
  moveQueueItem: (from: number, to: number) => void;
  clearQueue: () => void;
  setRate: (rate: number) => void;
  cycleRate: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSleep: (minutes: number | 'episode' | null) => void;
}

interface TimeValue {
  time: number;
  duration: number;
}

const PlayerContext = createContext<PlayerValue | null>(null);
/** Contexte séparé pour le temps : évite de re-rendre toute l'app 4 fois par seconde. */
const TimeContext = createContext<TimeValue>({ time: 0, duration: 0 });

interface PersistedPlayer {
  current: Episode | null;
  queue: Episode[];
  rate: number;
  volume: number;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const library = useLibrary();
  const libraryRef = useRef(library);
  libraryRef.current = library;

  const [persisted, setPersisted] = usePersistentState<PersistedPlayer>('podsnew:player', {
    current: null,
    queue: [],
    rate: 1,
    volume: 1,
  });
  const { current, queue, rate, volume } = persisted;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [sleep, setSleepState] = useState<SleepTimer>(null);
  const [time, setTime] = useState(() => (persisted.current ? resumePosition(library.progress[persisted.current.id]) : 0));
  const [duration, setDuration] = useState(persisted.current?.duration ?? 0);

  /** Id de l'épisode réellement chargé dans l'élément audio. */
  const loadedId = useRef<string | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const lastSave = useRef(0);
  const currentRef = useRef(current);
  currentRef.current = current;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const sleepRef = useRef(sleep);
  sleepRef.current = sleep;

  const update = useCallback(
    (patch: Partial<PersistedPlayer> | ((p: PersistedPlayer) => Partial<PersistedPlayer>)) =>
      setPersisted((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })),
    [setPersisted],
  );

  const persistProgress = useCallback(() => {
    const audio = audioRef.current;
    const ep = currentRef.current;
    if (!audio || !ep || loadedId.current !== ep.id) return;
    const d = Number.isFinite(audio.duration) ? audio.duration : ep.duration;
    if (audio.currentTime < 1) return;
    libraryRef.current.saveProgress(ep.id, audio.currentTime, d, isFinished(audio.currentTime, d));
    lastSave.current = Date.now();
  }, []);

  const load = useCallback(
    (episode: Episode, autoplay: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (loadedId.current && loadedId.current !== episode.id) persistProgress();
      loadedId.current = episode.id;
      pendingSeek.current = resumePosition(libraryRef.current.progress[episode.id]);
      setError(null);
      setTime(pendingSeek.current);
      setDuration(episode.duration);
      audio.src = episode.audioUrl;
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      update({ current: episode });
      libraryRef.current.addToHistory(episode);
      if (autoplay) {
        setIsBuffering(true);
        audio.play().catch(() => setIsBuffering(false));
      }
    },
    [persistProgress, rate, update],
  );

  /** Affiche un épisode dans le lecteur sans charger l'audio (chargé au premier « lecture »). */
  const select = useCallback(
    (episode: Episode) => {
      setTime(resumePosition(libraryRef.current.progress[episode.id]));
      setDuration(episode.duration);
      update({ current: episode });
    },
    [update],
  );

  const play = useCallback(
    (episode: Episode) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (loadedId.current === episode.id) {
        void audio.play().catch(() => undefined);
        return;
      }
      update((p) => ({ queue: Q.removeFromQueue(p.queue, episode.id) }));
      load(episode, true);
    },
    [load, update],
  );

  const pause = useCallback(() => audioRef.current?.pause(), []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const ep = currentRef.current;
    if (!audio || !ep) return;
    if (loadedId.current !== ep.id) {
      load(ep, true);
    } else if (audio.paused) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [load]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : Infinity;
    const target = Math.max(0, Math.min(seconds, max));
    if (loadedId.current === currentRef.current?.id && audio.readyState > 0) {
      audio.currentTime = target;
    } else {
      pendingSeek.current = target;
    }
    setTime(target);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const base = loadedId.current === currentRef.current?.id ? audio.currentTime : (pendingSeek.current ?? 0);
      seek(base + delta);
    },
    [seek],
  );

  const next = useCallback(() => {
    const [upNext, ...rest] = queueRef.current;
    if (!upNext) return;
    update({ queue: rest });
    load(upNext, true);
  }, [load, update]);

  /* ---------- Événements de l'élément audio ---------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      persistProgress();
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      if (pendingSeek.current !== null) {
        audio.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
    };
    const onTime = () => {
      setTime(audio.currentTime);
      if (Date.now() - lastSave.current > SAVE_EVERY_MS) persistProgress();
    };
    const onEnded = () => {
      const ep = currentRef.current;
      if (ep) libraryRef.current.saveProgress(ep.id, audio.duration || ep.duration, audio.duration || ep.duration, true);
      setIsPlaying(false);
      if (sleepRef.current?.kind === 'episode') {
        setSleepState(null);
        return;
      }
      next();
    };
    const onError = () => {
      if (!audio.src) return;
      setIsBuffering(false);
      setIsPlaying(false);
      setError("Impossible de lire cet épisode. Le fichier audio est peut-être indisponible.");
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('canplay', onPlaying);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('canplay', onPlaying);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [next, persistProgress]);

  // Sauvegarde de la progression quand on quitte la page.
  useEffect(() => {
    window.addEventListener('pagehide', persistProgress);
    return () => window.removeEventListener('pagehide', persistProgress);
  }, [persistProgress]);

  /* ---------- Vitesse & volume ---------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  /* ---------- Minuteur de sommeil ---------- */
  useEffect(() => {
    if (sleep?.kind !== 'minutes') return;
    const t = setTimeout(() => {
      audioRef.current?.pause();
      setSleepState(null);
    }, Math.max(0, sleep.endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [sleep]);

  /* ---------- Contrôles système (écran verrouillé, casque Bluetooth…) ---------- */
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.podcastTitle,
      album: 'Podsnew',
      artwork: current.artwork ? [{ src: current.artwork, sizes: '600x600', type: 'image/jpeg' }] : [],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => toggle()],
      ['pause', () => pause()],
      ['seekbackward', (d) => skip(-(d.seekOffset ?? SKIP_BACK))],
      ['seekforward', (d) => skip(d.seekOffset ?? SKIP_FORWARD)],
      ['seekto', (d) => d.seekTime !== undefined && seek(d.seekTime)],
      ['nexttrack', () => next()],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* action non supportée */
      }
    }
  }, [current, toggle, pause, skip, seek, next]);

  const value = useMemo<PlayerValue>(
    () => ({
      current,
      queue,
      isPlaying,
      isBuffering,
      error,
      rate,
      volume,
      muted,
      sleep,
      play,
      toggle,
      pause,
      seek,
      skip,
      next,
      enqueue: (ep) => {
        if (!currentRef.current) return select(ep);
        update((p) => ({ queue: Q.addToQueue(p.queue, ep) }));
      },
      enqueueNext: (ep) => {
        if (!currentRef.current) return select(ep);
        update((p) => ({ queue: Q.playNext(p.queue, ep) }));
      },
      dequeue: (id) => update((p) => ({ queue: Q.removeFromQueue(p.queue, id) })),
      moveQueueItem: (from, to) => update((p) => ({ queue: Q.moveInQueue(p.queue, from, to) })),
      clearQueue: () => update({ queue: [] }),
      setRate: (r) => update({ rate: r }),
      cycleRate: () => update((p) => ({ rate: PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(p.rate) + 1) % PLAYBACK_RATES.length] })),
      setVolume: (v) => {
        setMuted(false);
        update({ volume: Math.max(0, Math.min(1, v)) });
      },
      toggleMute: () => setMuted((m) => !m),
      setSleep: (m) =>
        setSleepState(m === null ? null : m === 'episode' ? { kind: 'episode' } : { kind: 'minutes', endsAt: Date.now() + m * 60_000 }),
    }),
    [current, queue, isPlaying, isBuffering, error, rate, volume, muted, sleep, play, toggle, pause, seek, skip, next, select, update],
  );

  const timeValue = useMemo(() => ({ time, duration }), [time, duration]);

  return (
    <PlayerContext.Provider value={value}>
      <TimeContext.Provider value={timeValue}>{children}</TimeContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer doit être utilisé dans <PlayerProvider>');
  return ctx;
}

export function usePlayerTime(): TimeValue {
  return useContext(TimeContext);
}
