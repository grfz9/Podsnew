import { Capacitor } from '@capacitor/core';
import type { Podcast } from '../types';
import { getPodcast } from '../api/itunes';
import { getRssPodcast, isRssId } from '../api/rss';
import { idbPut } from './idb';

/**
 * Notifications de nouveaux épisodes.
 * - Application native (Capacitor) : notifications locales.
 * - Navigateur : API Notification via le service worker ; si l'application est installée
 *   (Chrome/Android), une vérification périodique a aussi lieu en arrière-plan (public/sw.js).
 */
const isNative = () => Capacitor.isNativePlatform();

export function notificationsSupported(): boolean {
  return isNative() || (typeof window !== 'undefined' && 'Notification' in window);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  }
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function permissionGranted(): boolean {
  if (isNative()) return true; // vérifié par le système au moment d'afficher
  return 'Notification' in window && Notification.permission === 'granted';
}

let nativeId = 1;

const APP_ICON = 'icons/icon-192.png';

export async function notify(title: string, body: string, path: string, icon: string = new URL(APP_ICON, location.href).href): Promise<void> {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({ notifications: [{ id: nativeId++, title, body, extra: { path } }] });
    return;
  }
  const url = `${location.origin}${location.pathname}#${path}`;
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    await registration.showNotification(title, { body, icon, data: { url }, tag: path });
  } else {
    const n = new Notification(title, { body, icon });
    n.onclick = () => {
      window.focus();
      location.hash = path;
    };
  }
}

/** Ouvre la bonne page quand on touche une notification native. */
export async function onNativeNotificationOpen(navigate: (path: string) => void): Promise<() => void> {
  if (!isNative()) return () => undefined;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const path = (e.notification.extra as { path?: string } | undefined)?.path;
    if (path) navigate(path);
  });
  return () => void handle.remove();
}

/** Données lues par le service worker pour ses vérifications en arrière-plan. */
export async function shareStateWithServiceWorker(state: {
  enabled: boolean;
  subscriptions: Podcast[];
  seen: Record<string, string>;
  country: string;
}): Promise<void> {
  try {
    await idbPut(
      'kv',
      { ...state, subscriptions: state.subscriptions.map(({ id, title, artwork }) => ({ id, title, artwork })) },
      'notify-state',
    );
  } catch {
    /* IndexedDB indisponible */
  }
}

export async function registerBackgroundCheck(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.ready;
    const periodicSync = (registration as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
    })?.periodicSync;
    await periodicSync?.register('new-episodes', { minInterval: 6 * 60 * 60 * 1000 });
  } catch {
    /* non pris en charge (Safari, Firefox) ou application non installée */
  }
}

export interface FreshEpisode {
  podcast: Podcast;
  title: string;
  releaseDate: string;
}

/**
 * Cherche les épisodes parus depuis la dernière vérification.
 * Pour un podcast jamais vérifié, on mémorise simplement son dernier épisode.
 */
export async function findNewEpisodes(
  subscriptions: Podcast[],
  seen: Record<string, string>,
  country: string,
): Promise<{ fresh: FreshEpisode[]; seen: Record<string, string> }> {
  const nextSeen: Record<string, string> = {};
  const fresh: FreshEpisode[] = [];
  const results = await Promise.allSettled(
    subscriptions.filter((p) => !p.native).slice(0, 50).map((p) => (isRssId(p.id) ? getRssPodcast(p.id, 3, p.feedUrl) : getPodcast(p.id, country, 3))),
  );
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled' || r.value.episodes.length === 0) return;
    const podcast = subscriptions.filter((p) => !p.native)[i];
    const latest = r.value.episodes[0];
    const last = seen[podcast.id];
    if (last) {
      for (const e of r.value.episodes) if (e.releaseDate > last) fresh.push({ podcast, title: e.title, releaseDate: e.releaseDate });
    }
    if (!last || latest.releaseDate > last) nextSeen[podcast.id] = latest.releaseDate;
  });
  return { fresh, seen: nextSeen };
}
