export interface Podcast {
  id: string;
  title: string;
  author: string;
  artwork: string;
  genre?: string;
  genreIds?: string[];
  description?: string;
  feedUrl?: string;
  episodeCount?: number;
  lastRelease?: string;
  /** Podcast publié par un créateur directement sur Podsal. */
  native?: boolean;
  /** Contenu signalé comme explicite par l'éditeur. */
  explicit?: boolean;
}

export interface Episode {
  id: string;
  podcastId: string;
  podcastTitle: string;
  title: string;
  description: string;
  audioUrl: string;
  /** Durée en secondes (0 si inconnue). */
  duration: number;
  releaseDate: string;
  artwork: string;
  /** Identifiant de l'épisode dans le flux RSS (sert à retrouver chapitres et transcription). */
  guid?: string;
  genre?: string;
  explicit?: boolean;
}

export interface EpisodeProgress {
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export interface Genre {
  id: number;
  name: string;
  color: string;
}

export interface Chapter {
  start: number;
  end?: number;
  title: string;
  url?: string;
  img?: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface Clip {
  id: string;
  episode: Episode;
  start: number;
  end: number;
  note?: string;
  createdAt: number;
}

/** Temps d'écoute d'une journée. */
export interface DayStats {
  /** Secondes écoutées. */
  s: number;
  /** Secondes par podcast. */
  p: Record<string, number>;
  /** Épisodes terminés. */
  c: number;
}

export interface PodcastMeta {
  title: string;
  artwork: string;
  genre?: string;
}

/** Statistiques d'un appareil (fusionnées entre appareils lors de la synchronisation). */
export interface DeviceStats {
  updatedAt: number;
  days: Record<string, DayStats>;
  podcasts: Record<string, PodcastMeta>;
  /** Secondes écoutées par heure de la journée (0 à 23). */
  hours: number[];
}

export interface Playlist {
  id: string;
  name: string;
  items: Episode[];
  createdAt: number;
  updatedAt: number;
}
