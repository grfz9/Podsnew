import { useEffect, useState } from 'react';
import type { Chapter, Episode, Podcast } from '../types';
import { getAnyPodcast } from '../api/catalog';
import { useLibrary } from '../store/library';
import { useDownloads } from '../store/downloads';
import { useAsync, type AsyncState } from '../utils/hooks';
import { getEpisodeExtras, type EpisodeExtras } from './feed';

/**
 * Charge un épisode et son podcast. Si l'épisode n'est plus dans les 200 derniers
 * (ou si l'on est hors-ligne), on le retrouve dans la bibliothèque locale.
 */
export function useEpisode(podcastId: string, episodeId: string): AsyncState<{ podcast?: Podcast; episode: Episode }> {
  const library = useLibrary();
  const { downloads } = useDownloads();
  const local = () =>
    library.history.find((e) => e.id === episodeId) ??
    library.savedEpisodes.find((e) => e.id === episodeId) ??
    library.clips.find((c) => c.episode.id === episodeId)?.episode ??
    downloads.find((d) => d.id === episodeId)?.episode;

  return useAsync(async (signal) => {
    try {
      const { podcast, episodes } = await getAnyPodcast(podcastId, library.country, 200, signal);
      const episode = episodes.find((e) => e.id === episodeId) ?? local();
      if (!episode) throw new Error('Épisode introuvable');
      return { podcast, episode };
    } catch (error) {
      const episode = local();
      if (episode) return { episode };
      throw error;
    }
  }, [podcastId, episodeId, library.country]);
}

export function useEpisodeExtras(podcast: Podcast | undefined, episode: Episode | undefined): EpisodeExtras & { loading: boolean } {
  const [state, setState] = useState<EpisodeExtras & { loading: boolean }>({ chapters: [], loading: false });
  useEffect(() => {
    if (!podcast?.feedUrl || !episode || podcast.native) {
      setState({ chapters: [], loading: false });
      return;
    }
    let cancelled = false;
    setState({ chapters: [], loading: true });
    getEpisodeExtras(podcast, episode)
      .then((extras) => !cancelled && setState({ ...extras, loading: false }))
      .catch(() => !cancelled && setState({ chapters: [], loading: false }));
    return () => {
      cancelled = true;
    };
  }, [podcast, episode]);
  return state;
}

export function currentChapterIndex(chapters: Chapter[], time: number): number {
  let index = -1;
  for (let i = 0; i < chapters.length; i++) if (chapters[i].start <= time + 0.5) index = i;
  return index;
}
