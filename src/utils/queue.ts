import type { Episode } from '../types';

/* Opérations pures sur la file d'attente (faciles à tester). */

export function addToQueue(queue: Episode[], episode: Episode): Episode[] {
  if (queue.some((e) => e.id === episode.id)) return queue;
  return [...queue, episode];
}

/** Place l'épisode en tête de file (le déplace s'il y était déjà). */
export function playNext(queue: Episode[], episode: Episode): Episode[] {
  return [episode, ...queue.filter((e) => e.id !== episode.id)];
}

export function removeFromQueue(queue: Episode[], id: string): Episode[] {
  return queue.filter((e) => e.id !== id);
}

export function moveInQueue(queue: Episode[], from: number, to: number): Episode[] {
  if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return queue;
  const next = [...queue];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
