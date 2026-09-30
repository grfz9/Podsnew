import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { idbGet, idbPut } from '../lib/idb';
import { resizeImage } from '../lib/images';
import { usePremium } from './premium';

/**
 * Images personnelles de Podsal+ : fond d'écran, fond du menu et pochettes choisies par l'utilisateur.
 * Elles restent sur l'appareil (IndexedDB) et ne sont affichées que tant que l'abonnement est actif :
 * elles sont conservées si l'abonnement s'arrête, et réapparaissent s'il reprend.
 */
export type WallpaperSlot = 'main' | 'sidebar';

interface StoredImages {
  main?: Blob;
  sidebar?: Blob;
  covers: Record<string, Blob>;
}

const KEY = 'custom-images';

interface CustomImagesValue {
  /** Adresse de l'image importée pour ce fond (même sans abonnement, pour l'aperçu). */
  wallpaperUrl: (slot: WallpaperSlot) => string | undefined;
  setWallpaper: (slot: WallpaperSlot, file: File | null) => Promise<void>;
  /** Pochette personnelle d'un podcast, seulement si Podsal+ est actif. */
  coverUrl: (podcastId: string) => string | undefined;
  hasCover: (podcastId: string) => boolean;
  setCover: (podcastId: string, file: File | null) => Promise<void>;
}

const CustomImagesContext = createContext<CustomImagesValue | null>(null);

export function CustomImagesProvider({ children }: { children: ReactNode }) {
  const { isPremium } = usePremium();
  const [stored, setStored] = useState<StoredImages>({ covers: {} });

  useEffect(() => {
    idbGet<StoredImages>('kv', KEY)
      .then((s) => s && setStored({ ...s, covers: s.covers ?? {} }))
      .catch(() => undefined);
  }, []);

  // Une adresse par image, libérée quand l'image change.
  const [urls, setUrls] = useState<{ main?: string; sidebar?: string; covers: Record<string, string> }>({ covers: {} });
  useEffect(() => {
    const make = (b?: Blob) => (b ? URL.createObjectURL(b) : undefined);
    const next = {
      main: make(stored.main),
      sidebar: make(stored.sidebar),
      covers: Object.fromEntries(Object.entries(stored.covers).map(([id, b]) => [id, URL.createObjectURL(b)])),
    };
    setUrls(next);
    return () => {
      for (const u of [next.main, next.sidebar, ...Object.values(next.covers)]) if (u) URL.revokeObjectURL(u);
    };
  }, [stored]);

  const save = useCallback(async (change: (s: StoredImages) => StoredImages) => {
    const current = (await idbGet<StoredImages>('kv', KEY).catch(() => undefined)) ?? { covers: {} };
    const next = change({ ...current, covers: { ...(current.covers ?? {}) } });
    await idbPut('kv', next, KEY);
    setStored(next);
  }, []);

  const setWallpaper = useCallback(
    async (slot: WallpaperSlot, file: File | null) => {
      const blob = file ? await resizeImage(file, slot === 'main' ? 2400 : 1200) : undefined;
      await save((s) => ({ ...s, [slot]: blob }));
    },
    [save],
  );

  const setCover = useCallback(
    async (podcastId: string, file: File | null) => {
      const blob = file ? await resizeImage(file, 600, true) : undefined;
      await save((s) => {
        if (blob) s.covers[podcastId] = blob;
        else delete s.covers[podcastId];
        return s;
      });
    },
    [save],
  );

  const value = useMemo<CustomImagesValue>(
    () => ({
      wallpaperUrl: (slot) => urls[slot],
      setWallpaper,
      coverUrl: (id) => (isPremium ? urls.covers[id] : undefined),
      hasCover: (id) => id in urls.covers,
      setCover,
    }),
    [urls, isPremium, setWallpaper, setCover],
  );
  return <CustomImagesContext.Provider value={value}>{children}</CustomImagesContext.Provider>;
}

export function useCustomImages(): CustomImagesValue {
  const ctx = useContext(CustomImagesContext);
  if (!ctx) throw new Error('useCustomImages doit être utilisé dans <CustomImagesProvider>');
  return ctx;
}

/** Variante tolérante pour les composants affichés hors du fournisseur (tests, aperçus). */
export function useCustomImagesOptional(): CustomImagesValue | null {
  return useContext(CustomImagesContext);
}
