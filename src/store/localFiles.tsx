import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deleteLocalFile, importLocalFile, loadLocalFiles, renameLocalFile, toEpisode, type LocalFile } from '../lib/localFiles';
import type { Episode } from '../types';
import { usePremium } from './premium';

/** Fichiers audio ou vidéo importés sans abonnement (illimité avec Podsal+). */
export const FREE_LOCAL_FILES = 5;

interface LocalFilesValue {
  files: LocalFile[];
  episodes: Episode[];
  loading: boolean;
  /** Nombre de fichiers encore importables (Infinity avec Podsal+). */
  remaining: number;
  /** Importe les fichiers dans la limite autorisée ; renvoie les messages d'erreur éventuels. */
  importFiles: (files: File[]) => Promise<string[]>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const LocalFilesContext = createContext<LocalFilesValue | null>(null);

export function LocalFilesProvider({ children }: { children: ReactNode }) {
  const { isPremium } = usePremium();
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocalFiles()
      .then(setFiles)
      .finally(() => setLoading(false));
  }, []);

  const remaining = isPremium ? Infinity : Math.max(0, FREE_LOCAL_FILES - files.length);

  const importFiles = useCallback(
    async (picked: File[]) => {
      const errors: string[] = [];
      let left = remaining;
      for (const file of picked) {
        if (left <= 0) {
          errors.push(`Limite de ${FREE_LOCAL_FILES} fichiers atteinte : supprimez-en un, ou passez à Podsal+ (illimité).`);
          break;
        }
        try {
          const info = await importLocalFile(file);
          setFiles((list) => [info, ...list]);
          left--;
        } catch (error) {
          errors.push((error as Error).message);
        }
      }
      return errors;
    },
    [remaining],
  );

  const rename = useCallback(async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    await renameLocalFile(id, clean);
    setFiles((list) => list.map((f) => (f.id === id ? { ...f, title: clean } : f)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteLocalFile(id);
    setFiles((list) => list.filter((f) => f.id !== id));
  }, []);

  const value = useMemo<LocalFilesValue>(
    () => ({ files, episodes: files.map(toEpisode), loading, remaining, importFiles, rename, remove }),
    [files, loading, remaining, importFiles, rename, remove],
  );
  return <LocalFilesContext.Provider value={value}>{children}</LocalFilesContext.Provider>;
}

export function useLocalFiles(): LocalFilesValue {
  const ctx = useContext(LocalFilesContext);
  if (!ctx) throw new Error('useLocalFiles doit être utilisé dans <LocalFilesProvider>');
  return ctx;
}
