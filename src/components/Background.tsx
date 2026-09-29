import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { idbGet } from '../lib/idb';
import { findNewEpisodes, notify, onNativeNotificationOpen, permissionGranted, shareStateWithServiceWorker } from '../lib/notifications';
import { formatClock, nextPrayer, PRAYER_NAMES } from '../lib/prayer';
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
        await notify(item.podcast.title, item.title, `/podcast/${item.podcast.id}`).catch(() => undefined);
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

/** Heure de la prière : met la lecture en pause et affiche un rappel (selon les réglages). */
function PrayerWatcher() {
  const library = useLibrary();
  const player = usePlayer();
  const playerRef = useRef(player);
  playerRef.current = player;
  const [banner, setBanner] = useState<string | null>(null);
  const fired = useRef<string | null>(null);
  const p = library.settings.prayer;

  useEffect(() => {
    if (!p.enabled || p.latitude === null || (!p.pauseAtAdhan && !p.notify)) return;
    // La prochaine prière est calculée à l'avance ; on vérifie toutes les 15 s si son heure est passée.
    let target = nextPrayer(p);
    const check = () => {
      if (!target) return;
      const now = new Date();
      if (now < target.time) return;
      const key = `${target.key}-${target.time.toISOString()}`;
      // Heure dépassée de plus de 10 min (appareil en veille) : pas de rappel tardif.
      if (fired.current !== key && now.getTime() - target.time.getTime() < 10 * 60 * 1000) {
        fired.current = key;
        const message = `C'est l'heure de la prière : ${PRAYER_NAMES[target.key]} (${formatClock(target.time)}).`;
        if (p.pauseAtAdhan && playerRef.current.isPlaying) {
          playerRef.current.pause();
          setBanner(`${message} La lecture a été mise en pause.`);
        } else {
          setBanner(message);
        }
        if (p.notify) void notify(PRAYER_NAMES[target.key], message, '/priere').catch(() => undefined);
      }
      target = nextPrayer(p, new Date(now.getTime() + 1000));
    };
    const timer = setInterval(check, 15_000);
    return () => clearInterval(timer);
  }, [p]);

  if (!banner) return null;
  return (
    <div className="prayer-banner" role="alert">
      <span>{banner}</span>
      <button className="btn btn--outline btn--small" onClick={() => setBanner(null)}>
        Fermer
      </button>
    </div>
  );
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
      <PrayerWatcher />
    </>
  );
}
