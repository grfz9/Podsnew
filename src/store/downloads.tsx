import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Episode } from '../types';
import { deleteDownload, downloadEpisode, loadDownloads, type DownloadInfo } from '../lib/downloads';
import { FREE_DOWNLOADS, usePremium } from './premium';

export type DownloadStatus =
  | { state: 'none' }
  | { state: 'downloading'; progress: number }
  | { state: 'done'; info: DownloadInfo }
  | { state: 'error'; message: string };

interface DownloadsValue {
  downloads: DownloadInfo[];
  status: (episodeId: string) => DownloadStatus;
  download: (episode: Episode) => void;
  cancel: (episodeId: string) => void;
  remove: (episodeId: string) => void;
  usage: { used: number; quota: number } | null;
}

const DownloadsContext = createContext<DownloadsValue | null>(null);

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]);
  const [active, setActive] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<DownloadsValue['usage']>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const { isPremium } = usePremium();

  const refreshUsage = useCallback(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadDownloads().then((list) => setDownloads(list.sort((a, b) => b.createdAt - a.createdAt)));
    refreshUsage();
  }, [refreshUsage]);

  const download = useCallback(
    (episode: Episode) => {
      if (controllers.current.has(episode.id)) return;
      if (!isPremium && downloads.length + controllers.current.size >= FREE_DOWNLOADS) {
        setErrors((e) => ({ ...e, [episode.id]: `Limite de ${FREE_DOWNLOADS} téléchargements atteinte : supprimez-en un, ou passez à Podsal+ (illimité).` }));
        return;
      }
      const controller = new AbortController();
      controllers.current.set(episode.id, controller);
      setErrors(({ [episode.id]: _, ...rest }) => rest);
      setActive((a) => ({ ...a, [episode.id]: 0 }));
      downloadEpisode(episode, (p) => setActive((a) => ({ ...a, [episode.id]: p })), controller.signal)
        .then((info) => setDownloads((list) => [info, ...list.filter((d) => d.id !== info.id)]))
        .catch((error: Error) => {
          if (!controller.signal.aborted) setErrors((e) => ({ ...e, [episode.id]: error.message }));
        })
        .finally(() => {
          controllers.current.delete(episode.id);
          setActive(({ [episode.id]: _, ...rest }) => rest);
          refreshUsage();
        });
    },
    [refreshUsage, isPremium, downloads.length],
  );

  const cancel = useCallback((id: string) => controllers.current.get(id)?.abort(), []);

  const remove = useCallback(
    (id: string) => {
      const info = downloads.find((d) => d.id === id);
      if (!info) return;
      setDownloads((list) => list.filter((d) => d.id !== id));
      deleteDownload(info).finally(refreshUsage);
    },
    [downloads, refreshUsage],
  );

  const value = useMemo<DownloadsValue>(() => {
    const byId = new Map(downloads.map((d) => [d.id, d]));
    return {
      downloads,
      usage,
      download,
      cancel,
      remove,
      status: (id) => {
        if (id in active) return { state: 'downloading', progress: active[id] };
        const info = byId.get(id);
        if (info) return { state: 'done', info };
        if (errors[id]) return { state: 'error', message: errors[id] };
        return { state: 'none' };
      },
    };
  }, [downloads, usage, download, cancel, remove, active, errors]);

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

export function useDownloads(): DownloadsValue {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error('useDownloads doit être utilisé dans <DownloadsProvider>');
  return ctx;
}
