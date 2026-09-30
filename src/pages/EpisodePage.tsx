import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Heart, ListPlus, Pause, Play, Share2, ShieldCheck } from 'lucide-react';
import { Artwork, EmptyState, ErrorState, Spinner, shareLink } from '../components/common';
import { useModeration } from '../store/moderation';
import { DownloadButton, episodeUrl } from '../components/EpisodeRow';
import { ChapterList, ClipEditor, SummaryPanel, TranscriptPanel } from '../components/EpisodeExtras';
import { useEpisode, useEpisodeExtras } from '../lib/useEpisode';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { formatDuration, formatReleaseDate, stripHtml } from '../utils/format';
import { progressRatio } from '../utils/progress';
import { podcastPath } from '../lib/paths';

export function EpisodePage() {
  const { podcastId = '', episodeId = '' } = useParams();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useEpisode(podcastId, episodeId);
  const extras = useEpisodeExtras(data?.podcast, data?.episode);
  const library = useLibrary();
  const player = usePlayer();
  const moderation = useModeration();
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !data) return <div className="page"><Spinner /></div>;
  if (!data) return <div className="page">{error && <ErrorState error={error} onRetry={reload} />}</div>;

  const { episode, podcast } = data;
  if (!(podcast ? moderation.allowsPodcast(podcast) : moderation.allowsEpisode(episode))) {
    if (moderation.loading) return <div className="page"><Spinner /></div>;
    return (
      <div className="page">
        <EmptyState icon={<ShieldCheck size={32} />} title="Cet épisode n'est pas disponible sur Podsal" />
      </div>
    );
  }
  const isCurrent = player.current?.id === episode.id;
  const playing = isCurrent && player.isPlaying;
  const saved = library.isSaved(episode.id);
  const ratio = progressRatio(library.progress[episode.id], episode.duration);
  const startAt = params.get('t') ? Number(params.get('t')) : undefined;
  const description = stripHtml(episode.description);

  return (
    <div className="page">
      <header className="episode-hero">
        <Artwork alt={episode.podcastTitle} className="episode-hero__art" podcastId={episode.podcastId} genre={episode.genre} />
        <div className="episode-hero__info">
          <Link to={podcastPath(episode.podcastId)} className="episode-hero__podcast">
            {episode.podcastTitle}
          </Link>
          <h1>{episode.title}</h1>
          <p className="small muted">
            {formatReleaseDate(episode.releaseDate)}
            {episode.duration ? ` · ${formatDuration(episode.duration)}` : ''}
            {ratio > 0 && ratio < 1 ? ` · ${Math.round(ratio * 100)} % écouté` : ''}
            {ratio === 1 ? ' · Écouté' : ''}
          </p>
        </div>
      </header>

      <div className="podcast-actions podcast-actions--flush">
        <button
          className="play-btn play-btn--big"
          onClick={() => (playing ? player.pause() : player.play(episode, startAt))}
          aria-label={playing ? 'Pause' : 'Lire'}
        >
          {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
        </button>
        <button className={`icon-btn ${saved ? 'icon-btn--active' : ''}`} onClick={() => library.toggleSaved(episode)} aria-label={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
          <Heart size={22} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <DownloadButton episode={episode} />
        <button className="icon-btn" onClick={() => player.enqueue(episode)} aria-label="Ajouter à la file d'attente" disabled={isCurrent}>
          <ListPlus size={22} />
        </button>
        <button className="icon-btn" onClick={() => shareLink(episode.title, episodeUrl(episode)).then(setNotice)} aria-label="Partager">
          <Share2 size={20} />
        </button>
        {notice && <span className="small muted">{notice}</span>}
      </div>

      <div className="episode-layout">
        <div className="episode-layout__main">
          {description && <p className="episode-description">{description}</p>}
          <SummaryPanel podcastId={podcastId} episode={episode} />
          <TranscriptPanel podcast={podcast} episode={episode} transcript={extras.transcript} initialQuery={params.get('q') ?? ''} />
        </div>
        <aside className="episode-layout__side">
          <ChapterList episode={episode} chapters={extras.chapters} />
          <ClipEditor episode={episode} autoOpen={params.get('clip') === '1'} />
        </aside>
      </div>
    </div>
  );
}
