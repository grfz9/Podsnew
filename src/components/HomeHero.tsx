import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Pause, Play, Shuffle } from 'lucide-react';
import { useLibrary } from '../store/library';
import { useModeration } from '../store/moderation';
import { usePlayer, usePlayerTime } from '../store/player';
import type { Episode } from '../types';
import { formatDuration } from '../utils/format';
import { progressRatio, remainingSeconds } from '../utils/progress';
import { episodePath } from '../lib/paths';
import { EpisodeList } from './EpisodeRow';
import { Artwork, NowPlaying } from './common';

/** Épisode à reprendre : celui du lecteur s'il n'est pas fini, sinon le dernier épisode commencé. */
export function useResumeEpisode(): Episode | null {
  const { history, progress } = useLibrary();
  const { current } = usePlayer();
  const { allowsEpisode } = useModeration();
  if (current && !progress[current.id]?.completed) return current;
  return (
    history.find((e) => {
      const p = progress[e.id];
      return allowsEpisode(e) && !e.mediaKind && p && !p.completed && p.position > 5;
    }) ?? null
  );
}

/** Barre de progression en direct (seulement pour l'épisode du lecteur : évite de redessiner tout l'accueil). */
function LiveProgress() {
  const { time, duration } = usePlayerTime();
  const ratio = duration ? Math.min(1, time / duration) : 0;
  return (
    <>
      <span className="resume-hero__bar" style={{ '--p': ratio } as CSSProperties} />
      <span className="resume-hero__left">{duration ? `Reste ${formatDuration(duration - time) || 'moins d’1 min'}` : ''}</span>
    </>
  );
}

/** Grande carte « Reprendre » en haut de l'accueil. */
export function ResumeHero({ episode }: { episode: Episode }) {
  const player = usePlayer();
  const { progress } = useLibrary();
  const isCurrent = player.current?.id === episode.id;
  const playing = isCurrent && player.isPlaying;
  const p = progress[episode.id];
  const ratio = progressRatio(p, episode.duration);

  return (
    <section className={`resume-hero ${playing ? 'resume-hero--playing' : ''}`} aria-label="Reprendre l'écoute">
      <Link to={episodePath(episode)} className="resume-hero__art">
        <Artwork alt={episode.podcastTitle} podcastId={episode.podcastId} genre={episode.genre} />
      </Link>
      <div className="resume-hero__body">
        <span className="resume-hero__kicker">
          {playing ? (
            <>
              <NowPlaying /> En cours de lecture
            </>
          ) : (
            'Reprendre'
          )}
        </span>
        <Link to={episodePath(episode)} className="resume-hero__title">
          {episode.title}
        </Link>
        <span className="resume-hero__podcast">{episode.podcastTitle}</span>
        <span className="resume-hero__progress">
          {isCurrent ? (
            <LiveProgress />
          ) : (
            <>
              <span className="resume-hero__bar" style={{ '--p': ratio } as CSSProperties} />
              <span className="resume-hero__left">{p ? `Reste ${formatDuration(remainingSeconds(p, episode.duration)) || 'moins d’1 min'}` : ''}</span>
            </>
          )}
        </span>
      </div>
      <button
        className="play-btn resume-hero__play"
        onClick={() => (isCurrent ? player.toggle() : player.play(episode))}
        aria-label={playing ? 'Pause' : `Reprendre ${episode.title}`}
      >
        {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
      </button>
    </section>
  );
}

/** Mix du jour en carte compacte : pochettes empilées, « Tout lire », liste dépliable. */
export function MixCard({ mix, subscribedCount }: { mix: Episode[]; subscribedCount: number }) {
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const discoveries = mix.length - subscribedCount;
  const playingMix = !!player.current && mix.some((e) => e.id === player.current!.id) && player.isPlaying;
  return (
    <section className="mix-card">
      <div className="mix-card__head">
        <div className="mix-card__stack" aria-hidden>
          {mix.slice(0, 3).map((e, i) => (
            <span key={e.id} className="mix-card__cover" style={{ '--i': i } as CSSProperties}>
              <Artwork alt="" podcastId={e.podcastId} genre={e.genre} />
            </span>
          ))}
        </div>
        <div className="mix-card__text">
          <span className="resume-hero__kicker">
            <Shuffle size={13} /> Renouvelé chaque jour
          </span>
          <h2>Votre mix du jour</h2>
          <p className="small muted">
            {mix.length} épisodes · {subscribedCount} de vos abonnements
            {discoveries > 0 && ` · ${discoveries} découverte${discoveries > 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="play-btn mix-card__play" onClick={() => (playingMix ? player.pause() : player.playAll(mix))} aria-label={playingMix ? 'Pause' : 'Lire le mix du jour'}>
          {playingMix ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
      </div>
      <button className="mix-card__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Masquer les épisodes' : 'Voir les épisodes'} <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
      </button>
      {open && <EpisodeList episodes={mix} showPodcast />}
    </section>
  );
}
