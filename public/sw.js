/* Service worker de Podsal : fonctionnement hors-ligne, épisodes téléchargés, notifications. */
const SHELL_CACHE = 'podsnew-shell-v1';
const API_CACHE = 'podsnew-api-v1';
const AUDIO_CACHE = 'podsnew-audio-v1'; // même nom que src/lib/downloads.ts
const KEEP = [SHELL_CACHE, API_CACHE, AUDIO_CACHE];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('podsnew-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Audio : servi depuis le cache des téléchargements s'il y est.
  if (request.destination === 'audio' || request.headers.has('range')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE);
        const hit = await cache.match(request.url);
        return hit || fetch(request);
      })(),
    );
    return;
  }

  // Catalogue Apple (fiches et classements, pas les recherches) : réseau d'abord, cache si hors-ligne.
  if (url.hostname === 'itunes.apple.com' && (url.pathname.startsWith('/lookup') || url.pathname.includes('/rss/'))) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Pages : réseau d'abord, puis la dernière version connue de l'application.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(request, SHELL_CACHE);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(new URL('./', self.registration.scope).href)) || (await cache.match(new URL('./index.html', self.registration.scope).href)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Fichiers de l'application (noms versionnés par Vite) : cache d'abord.
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

/* ---------- Nouveaux épisodes (synchronisation périodique en arrière-plan) ---------- */

function idbKv(mode, fn) {
  return new Promise((resolve, reject) => {
    // Sans numéro de version : on ouvre la base telle que l'appli l'a créée (elle peut être plus récente).
    const open = indexedDB.open('podsnew');
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('downloads')) db.createObjectStore('downloads', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('transcripts')) db.createObjectStore('transcripts', { keyPath: 'episodeId' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      // Connexion fermée dès la lecture finie : une connexion laissée ouverte bloque les mises à niveau
      // de la base par l'appli (nouvelle version avec un magasin en plus).
      db.onversionchange = () => db.close();
      const tx = db.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => {
        db.close();
        resolve(req && req.result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

async function checkNewEpisodes() {
  const state = await idbKv('readonly', (store) => store.get('notify-state'));
  if (!state || !state.enabled || !state.subscriptions || state.subscriptions.length === 0) return;
  const seen = { ...(state.seen || {}) };
  const fresh = [];
  for (const podcast of state.subscriptions.slice(0, 50)) {
    // Seuls les podcasts du catalogue Apple sont vérifiés ici ; les autres le sont quand l'application est ouverte.
    if (!/^\d+$/.test(podcast.id)) continue;
    try {
      const params = new URLSearchParams({ id: podcast.id, entity: 'podcastEpisode', limit: '1', country: state.country || 'fr' });
      const res = await fetch(`https://itunes.apple.com/lookup?${params}`);
      const data = await res.json();
      const episode = data.results.find((r) => r.wrapperType === 'podcastEpisode');
      if (!episode) continue;
      if (seen[podcast.id] && episode.releaseDate > seen[podcast.id]) fresh.push({ podcast, episode });
      if (!seen[podcast.id] || episode.releaseDate > seen[podcast.id]) seen[podcast.id] = episode.releaseDate;
    } catch {
      /* hors-ligne ou podcast indisponible */
    }
  }
  await idbKv('readwrite', (store) => store.put({ ...state, seen }, 'notify-state'));
  for (const { podcast, episode } of fresh.slice(0, 5)) {
    await self.registration.showNotification(podcast.title, {
      body: episode.trackName,
      icon: new URL('icons/icon-192.png', self.registration.scope).href,
      tag: `episode-${episode.trackId}`,
      data: { url: `${self.registration.scope}#/podcast/${podcast.id}` },
    });
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'new-episodes') event.waitUntil(checkNewEpisodes());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
