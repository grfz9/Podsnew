import type { EpisodeProgress } from '../types';

/** Un épisode est considéré comme écouté à 95 % ou s'il reste moins de 30 s. */
export function isFinished(position: number, duration: number): boolean {
  if (!duration) return false;
  return position / duration >= 0.95 || duration - position < 30;
}

export function progressRatio(progress: EpisodeProgress | undefined, fallbackDuration = 0): number {
  if (!progress) return 0;
  if (progress.completed) return 1;
  const duration = progress.duration || fallbackDuration;
  return duration ? Math.min(1, progress.position / duration) : 0;
}

/** Position à laquelle reprendre la lecture (repart à 0 si l'épisode est terminé). */
export function resumePosition(progress: EpisodeProgress | undefined): number {
  if (!progress || progress.completed) return 0;
  // On recule de quelques secondes pour retrouver le fil.
  return Math.max(0, progress.position - 3);
}

export function remainingSeconds(progress: EpisodeProgress | undefined, duration: number): number {
  if (!progress || progress.completed) return duration;
  return Math.max(0, (progress.duration || duration) - progress.position);
}
