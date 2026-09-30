import type { LocalFile } from '../lib/localFiles';
import { useLocalFiles } from '../store/localFiles';
import { usePlayer } from '../store/player';
import type { Episode } from '../types';

/** Demande au lecteur de s'ouvrir en grand (pour voir une vidéo). */
export const EXPAND_PLAYER_EVENT = 'podsal:expand-player';

export function expandPlayerFor(episode: Pick<Episode, 'mediaKind'>) {
  if (episode.mediaKind === 'video') window.dispatchEvent(new Event(EXPAND_PLAYER_EVENT));
}

/** Lance un fichier importé (ou le met en pause) ; une vidéo ouvre le grand lecteur. */
export function usePlayLocal() {
  const player = usePlayer();
  const local = useLocalFiles();
  return (file: LocalFile) => {
    const episode = local.episodes.find((e) => e.id === file.id);
    if (!episode) return;
    if (player.current?.id === file.id) player.toggle();
    else player.play(episode);
    expandPlayerFor(episode);
  };
}
