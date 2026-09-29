import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { episodeRef, postActivity } from '../api/social';
import { idbGet } from '../lib/idb';
import { findNewEpisodes, notify, onNativeNotificationOpen, permissionGranted, shareStateWithServiceWorker } from '../lib/notifications';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';

const CHECK_EVERY_MS = 30 * 60 * 1000;

/** Vérifie régulièrement les nouveaux épisodes des abonnements et envoie une notification. */
function NewEpisodeNotifier() {
  const library = useLibrary();
  const navigate = useNavigate();
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const enabled = library.settings.notifications;

  // Le service worker lit ces données pour ses vérifications en arrière-plan.
  useEffect(() => {
    void shareStateWithServiceWorker({ enabled, subscriptions: library.subscriptions, seen: library.seen, country: library.country });
  }, [enabled, library.subscriptions, library.seen, library.country]);

  useEffect(() => {
    let cleanup = () => undefined as void;
    void onNativeNotificationOpen(navigate).then((c) => (cleanup = c));
    return () => cleanup();
  }, [navigate]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const check = async () => {
      if (!permissionGranted() || !navigator.onLine) return;
      const lib = libraryRef.current;
      // Épisodes déjà signalés par le service worker : on ne les notifie pas une seconde fois.
      const fromWorker = await idbGet<{ seen?: Record<string, string> }>('kv', 'notify-state').catch(() => undefined);
      const seen = { ...lib.seen };
      for (const [id, date] of Object.entries(fromWorker?.seen ?? {})) if (!seen[id] || date > seen[id]) seen[id] = date;
      const { fresh, seen: nextSeen } = await findNewEpisodes(lib.subscriptions, seen, lib.country);
      if (cancelled) return;
      for (const item of fresh.slice(0, 5)) {
        await notify(item.podcast.title, item.title, `/podcast/${item.podcast.id}`, item.podcast.artwork).catch(() => undefined);
      }
      if (Object.keys(nextSeen).length || Object.keys(fromWorker?.seen ?? {}).length) lib.markSeen({ ...seen, ...nextSeen });
    };
    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return null;
}

/** Publie « a écouté… » pour les personnes qui ont choisi de partager leur activité (une fois par épisode et par jour). */
function ActivityReporter() {
  const auth = useAuth();
  const { current, isPlaying } = usePlayer();
  useEffect(() => {
    if (!auth.userId || !auth.profile?.share_activity || !isPlaying || !current) return;
    const key = `podsnew:shared:${new Date().toDateString()}`;
    let shared: string[] = [];
    try {
      shared = JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      shared = [];
    }
    if (shared.includes(current.id)) return;
    // On attend une minute d'écoute avant de partager.
    const t = setTimeout(() => {
      postActivity(auth.userId!, 'listen', { episode: episodeRef(current) })
        .then(() => localStorage.setItem(key, JSON.stringify([...shared, current.id])))
        .catch(() => undefined);
    }, 60_000);
    return () => clearTimeout(t);
  }, [auth.userId, auth.profile?.share_activity, isPlaying, current]);
  return null;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function BackgroundTasks() {
  return (
    <>
      <NewEpisodeNotifier />
      <ActivityReporter />
    </>
  );
}
