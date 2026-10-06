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
import { localUrlFor, localVideoUrlFor } from '../lib/downloads';
import { isLocalId } from '../lib/localFiles';
import { isNativeId, trackNativePlay } from '../api/native';
import { useLibrary } from './library';

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
export const SKIP_BACK = 15;
export const SKIP_FORWARD = 30;
const SAVE_EVERY_MS = 5000;
/** Le temps d'écoute est enregistré par paquets pour limiter les écritures. */
const LISTEN_FLUSH_SECONDS = 15;

/** Répétition (mémorisation) : tout l'épisode, ou un passage [start, end], un nombre de fois ou sans fin. */
export interface Repeat {
  episodeId: string;
  /** Lectures restantes, lecture en cours comprise (Infinity = sans fin). */
  remaining: number;
  start: number;
  /** Absent : jusqu'à la fin du fichier. */
  end?: number;
}

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
  /** Extrait en cours de lecture (s'arrête automatiquement à la fin). */
  segment: { start: number; end: number } | null;
  /** Élément audio du lecteur (la vidéo d'un fichier importé se cale dessus). */
  mediaElement: HTMLAudioElement | null;

  play: (episode: Episode, startAt?: number) => void;
  playSegment: (episode: Episode, start: number, end: number) => void;
  repeat: Repeat | null;
  setRepeat: (repeat: Repeat | null) => void;
  playAll: (episodes: Episode[]) => void;
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
  /** Change le titre affiché d'un épisode (fichier importé renommé), en cours de lecture ou dans la file. */
  retitle: (episodeId: string, title: string) => void;
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
  if (!audioRef.current && typeof document !== 'undefined') {
    // Élément attaché à la page et « intégré » : Safari (iPhone) garde mieux le son en arrière-plan
    // qu'avec un élément créé hors du document.
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.hidden = true;
    document.body.appendChild(audio);
    audioRef.current = audio;
  }
  /** L'utilisateur veut que ça joue : une pause qui ne vient pas de lui (système) est reprise au retour dans l'appli. */
  const wantsPlay = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [sleep, setSleepState] = useState<SleepTimer>(null);
  const [segment, setSegment] = useState<{ start: number; end: number } | null>(null);
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
  const segmentRef = useRef(segment);
  segmentRef.current = segment;
  const [repeat, setRepeatState] = useState<Repeat | null>(null);
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const setRepeat = useCallback((r: Repeat | null) => {
    repeatRef.current = r;
    setRepeatState(r);
  }, []);

  /* Temps d'écoute réel (horloge murale, indépendant de la vitesse de lecture). */
  const lastTick = useRef<number | null>(null);
  const pendingListen = useRef(0);
  const listenedByEpisode = useRef(new Map<string, number>());

  const update = useCallback(
    (patch: Partial<PersistedPlayer> | ((p: PersistedPlayer) => Partial<PersistedPlayer>)) =>
      setPersisted((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })),
    [setPersisted],
  );

  const flushListening = useCallback(() => {
    const ep = currentRef.current;
    const seconds = Math.floor(pendingListen.current);
    if (!ep || seconds < 1) return;
    pendingListen.current -= seconds;
    libraryRef.current.recordListening(ep, seconds);
    const total = (listenedByEpisode.current.get(ep.id) ?? 0) + seconds;
    listenedByEpisode.current.set(ep.id, total);
    if (isNativeId(ep.id) && total >= 30) {
      trackNativePlay(ep.id, libraryRef.current.deviceId, total).catch(() => undefined);
    }
  }, []);

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
    (episode: Episode, autoplay: boolean, startAt?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (loadedId.current && loadedId.current !== episode.id) {
        persistProgress();
        flushListening();
      }
      pendingListen.current = 0;
      lastTick.current = null;
      loadedId.current = episode.id;
      if (repeatRef.current && repeatRef.current.episodeId !== episode.id) setRepeat(null);
      pendingSeek.current = startAt ?? resumePosition(libraryRef.current.progress[episode.id]);
      setError(null);
      setTime(pendingSeek.current);
      setDuration(episode.duration);
      // Fichier téléchargé ou importé si disponible, sinon lecture en streaming.
      const local = isLocalId(episode.id);
      const src = localUrlFor(episode.id) ?? episode.audioUrl;
      update({ current: episode });
      if (!src) {
        audio.removeAttribute('src');
        setError(local ? 'Ce fichier n’est plus sur cet appareil.' : 'Impossible de lire cet épisode.');
        return;
      }
      audio.src = src;
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      // Fichiers personnels (importés, ou publiés par un ami avec un lien temporaire) : pas dans l'historique synchronisé.
      if (!episode.mediaKind) libraryRef.current.addToHistory(episode);
      if (autoplay) {
        setIsBuffering(true);
        audio.play().catch(() => setIsBuffering(false));
      }
    },
    [persistProgress, flushListening, rate, update, setRepeat],
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

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : Infinity;
    const target = Math.max(0, Math.min(seconds, max));
    const seg = segmentRef.current;
    if (seg && (target < seg.start - 1 || target > seg.end)) setSegment(null);
    if (loadedId.current === currentRef.current?.id && audio.readyState > 0) {
      audio.currentTime = target;
    } else {
      pendingSeek.current = target;
    }
    setTime(target);
  }, []);

  const play = useCallback(
    (episode: Episode, startAt?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      setSegment(null);
      if (loadedId.current === episode.id) {
        if (startAt !== undefined) seek(startAt);
        void audio.play().catch(() => undefined);
        return;
      }
      update((p) => ({ queue: Q.removeFromQueue(p.queue, episode.id) }));
      load(episode, true, startAt);
    },
    [load, update, seek],
  );

  const playSegment = useCallback(
    (episode: Episode, start: number, end: number) => {
      play(episode, start);
      setSegment({ start, end });
    },
    [play],
  );

  const playAll = useCallback(
    (episodes: Episode[]) => {
      const [first, ...rest] = episodes;
      if (!first) return;
      play(first);
      update({ queue: rest.filter((e) => e.id !== first.id) });
    },
    [play, update],
  );

  const pause = useCallback(() => {
    wantsPlay.current = false;
    audioRef.current?.pause();
  }, []);

  /**
   * Relance la lecture. Si l'élément audio est resté bloqué (iPhone : coupure par le système écran
   * éteint, flux interrompu, erreur réseau), on recharge le fichier à la même position puis on relance.
   */
  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    const reload = () => {
      const at = audio.currentTime || pendingSeek.current || 0;
      pendingSeek.current = at;
      setError(null);
      audio.load();
      void audio.play().catch(() => undefined);
    };
    if (audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) return reload();
    void audio.play().catch((e: DOMException) => {
      // NotAllowedError : le navigateur exige un geste de l'utilisateur, recharger n'y changerait rien.
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') reload();
    });
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const ep = currentRef.current;
    if (!audio || !ep) return;
    if (loadedId.current !== ep.id) {
      load(ep, true);
    } else if (audio.paused || audio.error) {
      wantsPlay.current = true;
      resume();
    } else {
      wantsPlay.current = false;
      audio.pause();
    }
  }, [load, resume]);

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
    setSegment(null);
    update({ queue: rest });
    load(upNext, true);
  }, [load, update]);

  /* ---------- Événements de l'élément audio ---------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      wantsPlay.current = true;
      setIsPlaying(true);
      lastTick.current = performance.now();
    };
    const onPause = () => {
      setIsPlaying(false);
      lastTick.current = null;
      persistProgress();
      flushListening();
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
      if (!audio.paused) {
        const now = performance.now();
        if (lastTick.current !== null && now - lastTick.current < 3000) pendingListen.current += (now - lastTick.current) / 1000;
        lastTick.current = now;
        if (pendingListen.current >= LISTEN_FLUSH_SECONDS) flushListening();
      }
      const seg = segmentRef.current;
      if (seg && audio.currentTime >= seg.end) {
        wantsPlay.current = false;
        audio.pause();
        setSegment(null);
      }
      const rep = repeatRef.current;
      if (rep?.end !== undefined && rep.episodeId === loadedId.current && audio.currentTime >= rep.end) {
        if (rep.remaining > 1) {
          setRepeat({ ...rep, remaining: rep.remaining - 1 });
          audio.currentTime = rep.start;
        } else {
          setRepeat(null);
          wantsPlay.current = false;
          audio.pause();
        }
      }
      if (Date.now() - lastSave.current > SAVE_EVERY_MS) persistProgress();
    };
    const onEnded = () => {
      const rep = repeatRef.current;
      if (rep && rep.end === undefined && rep.episodeId === loadedId.current && rep.remaining > 1) {
        setRepeat({ ...rep, remaining: rep.remaining - 1 });
        audio.currentTime = rep.start;
        void audio.play().catch(() => undefined);
        return;
      }
      if (rep) setRepeat(null);
      wantsPlay.current = false;
      const ep = currentRef.current;
      if (ep) libraryRef.current.saveProgress(ep.id, audio.duration || ep.duration, audio.duration || ep.duration, true);
      setIsPlaying(false);
      flushListening();
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
      if (currentRef.current && isLocalId(currentRef.current.id)) {
        // Piste son seule illisible sur cet appareil : on revient au fichier vidéo complet.
        const full = localVideoUrlFor(currentRef.current.id);
        if (full && audio.src !== full) {
          const at = audio.currentTime;
          pendingSeek.current = at;
          audio.src = full;
          void audio.play().catch(() => undefined);
          return;
        }
        setError('Impossible de lire ce fichier : son format n’est peut-être pas pris en charge par cet appareil.');
        return;
      }
      if (currentRef.current?.mediaKind) {
        setError('Impossible de lire ce fichier : le lien a peut-être expiré. Rouvrez le groupe depuis le profil de votre ami.');
        return;
      }
      setError(navigator.onLine ? 'Impossible de lire cet épisode. Le fichier audio est peut-être indisponible.' : 'Vous êtes hors-ligne et cet épisode n’est pas téléchargé.');
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
  }, [next, persistProgress, flushListening, setRepeat]);

  // Safari (iPhone) peut couper le son quand l'appli passe en arrière-plan : on reprend au retour.
  useEffect(() => {
    const onVisible = () => {
      const audio = audioRef.current;
      if (document.visibilityState !== 'visible' || !audio || !wantsPlay.current || !audio.paused || !audio.src) return;
      resume();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [resume]);

  // État et position de lecture pour l'écran verrouillé et le centre de contrôle.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !('mediaSession' in navigator)) return;
    const sync = () => {
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
      if (Number.isFinite(audio.duration) && audio.duration > 0 && 'setPositionState' in navigator.mediaSession) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: Math.min(audio.currentTime, audio.duration),
          });
        } catch {
          /* valeurs refusées par le navigateur */
        }
      }
    };
    const events = ['play', 'pause', 'loadedmetadata', 'seeked', 'ratechange', 'ended'];
    events.forEach((e) => audio.addEventListener(e, sync));
    return () => events.forEach((e) => audio.removeEventListener(e, sync));
  }, []);

  // Sauvegarde de la progression quand on quitte la page.
  useEffect(() => {
    const onHide = () => {
      persistProgress();
      flushListening();
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [persistProgress, flushListening]);

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
      wantsPlay.current = false;
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
      album: 'Podsal',
      // Pas de pochette : les images de podcasts ne sont pas affichées dans Podsal.
      artwork: [{ src: new URL('icons/maskable-512.png', location.href).href, sizes: '512x512', type: 'image/png' }],
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
      segment,
      mediaElement: audioRef.current,
      play,
      playSegment,
      repeat,
      setRepeat,
      playAll,
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
      retitle: (id, title) =>
        update((p) => ({
          current: p.current?.id === id ? { ...p.current, title } : p.current,
          queue: p.queue.map((e) => (e.id === id ? { ...e, title } : e)),
        })),
      setSleep: (m) =>
        setSleepState(m === null ? null : m === 'episode' ? { kind: 'episode' } : { kind: 'minutes', endsAt: Date.now() + m * 60_000 }),
    }),
    [current, queue, isPlaying, isBuffering, error, rate, volume, muted, sleep, segment, repeat, setRepeat, play, playSegment, playAll, toggle, pause, seek, skip, next, select, update],
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
