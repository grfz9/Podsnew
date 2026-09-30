import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  deleteLocalFile,
  importLocalFile,
  loadGroups,
  loadLocalFiles,
  newGroupId,
  renameLocalFile,
  saveGroups,
  toEpisode,
  type FileGroup,
  type LocalFile,
} from '../lib/localFiles';
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

  groups: FileGroup[];
  createGroup: (name: string, fileIds?: string[]) => FileGroup;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  toggleInGroup: (groupId: string, fileId: string) => void;
  moveInGroup: (groupId: string, from: number, to: number) => void;
  /** Enregistre l'état de publication (remoteId absent : groupe redevenu privé). */
  setPublished: (groupId: string, remoteId: string | undefined) => void;
}

const LocalFilesContext = createContext<LocalFilesValue | null>(null);

export function LocalFilesProvider({ children }: { children: ReactNode }) {
  const { isPremium } = usePremium();
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [groups, setGroupsState] = useState<FileGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const groupsRef = useRef(groups);

  useEffect(() => {
    Promise.all([loadLocalFiles(), loadGroups()])
      .then(([f, g]) => {
        setFiles(f);
        groupsRef.current = g;
        setGroupsState(g);
      })
      .finally(() => setLoading(false));
  }, []);

  /** Modifie les groupes et les enregistre sur l'appareil. */
  const updateGroups = useCallback((change: (groups: FileGroup[]) => FileGroup[]) => {
    const next = change(groupsRef.current);
    groupsRef.current = next;
    setGroupsState(next);
    void saveGroups(next).catch(() => undefined);
  }, []);

  const editGroup = useCallback(
    (id: string, change: (g: FileGroup) => FileGroup) =>
      updateGroups((list) => list.map((g) => (g.id === id ? { ...change(g), updatedAt: Date.now() } : g))),
    [updateGroups],
  );

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

  const rename = useCallback(
    async (id: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      await renameLocalFile(id, clean);
      setFiles((list) => list.map((f) => (f.id === id ? { ...f, title: clean } : f)));
      // Les groupes publiés qui contiennent ce fichier sont à mettre à jour.
      updateGroups((list) => list.map((g) => (g.fileIds.includes(id) ? { ...g, updatedAt: Date.now() } : g)));
    },
    [updateGroups],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteLocalFile(id);
      setFiles((list) => list.filter((f) => f.id !== id));
      updateGroups((list) => list.map((g) => (g.fileIds.includes(id) ? { ...g, fileIds: g.fileIds.filter((f) => f !== id), updatedAt: Date.now() } : g)));
    },
    [updateGroups],
  );

  const createGroup = useCallback(
    (name: string, fileIds: string[] = []) => {
      const now = Date.now();
      const group: FileGroup = { id: newGroupId(), name: name.trim().slice(0, 80) || 'Nouveau groupe', fileIds, createdAt: now, updatedAt: now };
      updateGroups((list) => [group, ...list]);
      return group;
    },
    [updateGroups],
  );

  const value = useMemo<LocalFilesValue>(
    () => ({
      files,
      episodes: files.map(toEpisode),
      loading,
      remaining,
      importFiles,
      rename,
      remove,
      groups,
      createGroup,
      renameGroup: (id, name) => {
        const clean = name.trim().slice(0, 80);
        if (clean) editGroup(id, (g) => ({ ...g, name: clean }));
      },
      deleteGroup: (id) => updateGroups((list) => list.filter((g) => g.id !== id)),
      toggleInGroup: (groupId, fileId) =>
        editGroup(groupId, (g) => ({ ...g, fileIds: g.fileIds.includes(fileId) ? g.fileIds.filter((f) => f !== fileId) : [...g.fileIds, fileId] })),
      moveInGroup: (groupId, from, to) =>
        editGroup(groupId, (g) => {
          if (to < 0 || to >= g.fileIds.length) return g;
          const ids = [...g.fileIds];
          const [moved] = ids.splice(from, 1);
          ids.splice(to, 0, moved);
          return { ...g, fileIds: ids };
        }),
      setPublished: (groupId, remoteId) =>
        updateGroups((list) =>
          list.map((g) => (g.id === groupId ? { ...g, remoteId, publishedAt: remoteId ? Math.max(Date.now(), g.updatedAt) : undefined } : g)),
        ),
    }),
    [files, loading, remaining, importFiles, rename, remove, groups, createGroup, editGroup, updateGroups],
  );
  return <LocalFilesContext.Provider value={value}>{children}</LocalFilesContext.Provider>;
}

export function useLocalFiles(): LocalFilesValue {
  const ctx = useContext(LocalFilesContext);
  if (!ctx) throw new Error('useLocalFiles doit être utilisé dans <LocalFilesProvider>');
  return ctx;
}
