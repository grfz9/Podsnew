export interface Podcast {
  id: string;
  title: string;
  author: string;
  artwork: string;
  genre?: string;
  description?: string;
  feedUrl?: string;
  episodeCount?: number;
  lastRelease?: string;
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
