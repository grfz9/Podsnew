import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { FileText, ListOrdered, Play, Scissors, Search, ScrollText } from 'lucide-react';
import type { Chapter, Episode, Podcast, TranscriptSegment } from '../types';
import type { TranscriptRef } from '../../supabase/functions/_shared/podcast';
import { usePlayer, usePlayerTime } from '../store/player';
import { useLibrary } from '../store/library';
import { useAuth } from '../store/auth';
import { useModeration } from '../store/moderation';
import { getTranscript } from '../lib/feed';
import { currentChapterIndex } from '../lib/useEpisode';
import { getCachedSummary, getServerTranscript, requestSummary, type SummaryResult } from '../api/ai';
import { formatTime } from '../utils/format';
import { shareLink } from './common';

/** Temps de lecture de cet épisode s'il est en cours, sinon null. */
function useEpisodeTime(episode: Episode): number | null {
  const { current } = usePlayer();
  const { time } = usePlayerTime();
  return current?.id === episode.id ? time : null;
}

/* ---------- Chapitres ---------- */

export function ChapterList({ episode, chapters }: { episode: Episode; chapters: Chapter[] }) {
  const player = usePlayer();
  const time = useEpisodeTime(episode);
  const active = time === null ? -1 : currentChapterIndex(chapters, time);
  if (!chapters.length) return null;
  return (
    <section className="panel">
      <h2 className="panel__title">
        <ListOrdered size={18} /> Chapitres
      </h2>
      <ol className="chapters">
        {chapters.map((c, i) => (
          <li key={`${c.start}-${i}`}>
            <button className={`chapter ${i === active ? 'chapter--active' : ''}`} onClick={() => player.play(episode, c.start)}>
              <span className="chapter__time">{formatTime(c.start)}</span>
              <span className="chapter__title">{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Transcription ---------- */

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))}
    </>
  );
}

export function TranscriptPanel({
  podcast,
  episode,
  transcript,
  initialQuery = '',
}: {
  podcast?: Podcast;
  episode: Episode;
  transcript?: TranscriptRef;
  initialQuery?: string;
}) {
  const auth = useAuth();
  const library = useLibrary();
  const player = usePlayer();
  const time = useEpisodeTime(episode);
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [follow, setFollow] = useState(true);
  const activeRef = useRef<HTMLButtonElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let result: TranscriptSegment[] | null = null;
      if (auth.userId && podcast) {
        // Côté serveur : contourne les restrictions des hébergeurs et alimente la recherche.
        result = await getServerTranscript(podcast.id, episode.id, library.country).catch(() => null);
      }
      if (!result?.length && transcript) result = await getTranscript(episode, transcript);
      if (!result?.length) throw new Error("La transcription n'a pas pu être lue.");
      setSegments(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Ouverture directe depuis un résultat de recherche.
  useEffect(() => {
    if (initialQuery && transcript && !segments) void load();
  }, [initialQuery, transcript]);

  const timed = segments?.some((s) => s.start >= 0) ?? false;
  const activeIndex = useMemo(() => {
    if (!segments || time === null || !timed) return -1;
    let idx = -1;
    for (let i = 0; i < segments.length; i++) if (segments[i].start <= time) idx = i;
    return idx;
  }, [segments, time, timed]);

  useEffect(() => {
    if (follow && activeIndex >= 0) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, follow]);

  if (!transcript && !segments) return null;

  const q = query.trim().toLowerCase();
  const matches = segments && q ? segments.filter((s) => s.text.toLowerCase().includes(q)).length : 0;

  return (
    <section className="panel">
      <h2 className="panel__title">
        <FileText size={18} /> Transcription
      </h2>
      {!segments ? (
        <>
          <p className="muted small">Transcription fournie par l'éditeur du podcast.</p>
          <button className="btn btn--outline" onClick={load} disabled={loading}>
            {loading ? 'Chargement…' : 'Afficher la transcription'}
          </button>
          {error && <p className="small error-text">{error}</p>}
        </>
      ) : (
        <>
          <div className="panel__tools">
            <div className="search-box search-box--small">
              <Search size={16} />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher dans la transcription" aria-label="Chercher dans la transcription" />
            </div>
            {q && <span className="small muted">{matches} passage{matches > 1 ? 's' : ''}</span>}
            {timed && time !== null && (
              <label className="checkbox small">
                <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Suivre la lecture
              </label>
            )}
          </div>
          <div className="transcript">
            {segments
              .filter((s) => !q || s.text.toLowerCase().includes(q))
              .map((s) => {
                const index = segments.indexOf(s);
                const active = index === activeIndex;
                return (
                  <button
                    key={index}
                    ref={active ? activeRef : undefined}
                    className={`transcript__line ${active ? 'transcript__line--active' : ''}`}
                    onClick={() => timed && s.start >= 0 && player.play(episode, s.start)}
                    disabled={!timed || s.start < 0}
                  >
                    {timed && s.start >= 0 && <span className="transcript__time">{formatTime(s.start)}</span>}
                    <span>
                      {s.speaker && <strong>{s.speaker} : </strong>}
                      <Highlight text={s.text} query={q} />
                    </span>
                  </button>
                );
              })}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- Résumé automatique ---------- */

export function SummaryPanel({ podcastId, episode }: { podcastId: string; episode: Episode }) {
  const moderation = useModeration();
  if (moderation.isReligious(podcastId)) return null;
  return <SummaryPanelInner podcastId={podcastId} episode={episode} />;
}

/** Pas de résumé automatique pour le Coran et les podcasts islamiques (voir SummaryPanel). */
function SummaryPanelInner({ podcastId, episode }: { podcastId: string; episode: Episode }) {
  const auth = useAuth();
  const library = useLibrary();
  const player = usePlayer();
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setChecked(false);
    getCachedSummary(episode.id)
      .then((r) => !cancelled && setResult(r))
      .finally(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [episode.id]);

  if (!auth.enabled || !checked) return null;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await requestSummary(podcastId, episode.id, library.country));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">
        <ScrollText size={18} /> Résumé automatique
      </h2>
      {result ? (
        <div className="summary">
          <p>{result.summary.summary}</p>
          {result.summary.keyPoints.length > 0 && (
            <>
              <h3>Points clés</h3>
              <ul>
                {result.summary.keyPoints.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </>
          )}
          {result.summary.topics.length > 0 && (
            <div className="tags">
              {result.summary.topics.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
          {result.summary.chapters.length > 0 && (
            <>
              <h3>Parties</h3>
              <ol className="chapters">
                {result.summary.chapters.map((c) => (
                  <li key={`${c.start}-${c.title}`}>
                    <button className="chapter" onClick={() => player.play(episode, c.start)}>
                      <span className="chapter__time">{formatTime(c.start)}</span>
                      <span className="chapter__title">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          <p className="small muted">
            Rédigé automatiquement à partir {result.source === 'transcript' ? 'de la transcription' : "de la description de l'éditeur"}. Il peut contenir des erreurs.
          </p>
        </div>
      ) : auth.userId ? (
        <>
          <p className="muted small">Points clés, thèmes et découpage de l'épisode.</p>
          <button className="btn btn--outline" onClick={generate} disabled={loading}>
            {loading ? 'Rédaction en cours…' : 'Obtenir le résumé'}
          </button>
          {error && <p className="small error-text">{error}</p>}
        </>
      ) : (
        <p className="muted small">
          <Link to="/account" className="link">
            Connectez-vous
          </Link>{' '}
          pour obtenir le résumé de cet épisode.
        </p>
      )}
    </section>
  );
}

/* ---------- Extraits ---------- */

export const CLIP_MIN = 5;
export const CLIP_MAX = 120;

export function clipPath(episode: Pick<Episode, 'podcastId' | 'id'>, start: number, end: number, note?: string): string {
  const params = new URLSearchParams({ p: episode.podcastId, e: episode.id, s: String(Math.floor(start)), t: String(Math.ceil(end)) });
  if (note) params.set('n', note);
  return `/clip?${params}`;
}

function parseTime(value: string): number | null {
  const parts = value.trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function ClipEditor({ episode, autoOpen = false }: { episode: Episode; autoOpen?: boolean }) {
  const player = usePlayer();
  const library = useLibrary();
  const time = useEpisodeTime(episode);
  const [open, setOpen] = useState(autoOpen);
  const initialEnd = time !== null && time > CLIP_MIN ? Math.floor(time) : 30;
  const [start, setStart] = useState(formatTime(Math.max(0, initialEnd - 30)));
  const [end, setEnd] = useState(formatTime(initialEnd));
  const [note, setNote] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const s = parseTime(start);
  const e = parseTime(end);
  const length = s !== null && e !== null ? e - s : 0;
  const maxEnd = episode.duration || Infinity;
  const invalid =
    s === null || e === null ? 'Format attendu : minutes:secondes (ex. 12:30).'
    : length < CLIP_MIN ? `Un extrait dure au moins ${CLIP_MIN} secondes.`
    : length > CLIP_MAX ? `Un extrait dure au plus ${CLIP_MAX / 60} minutes.`
    : e > maxEnd + 1 ? "La fin dépasse la durée de l'épisode."
    : null;

  if (!open) {
    return (
      <button className="btn btn--outline" onClick={() => setOpen(true)}>
        <Scissors size={16} /> Créer un extrait
      </button>
    );
  }

  const create = async () => {
    if (invalid || s === null || e === null) return;
    const clip = library.addClip({ episode, start: s, end: e, note: note.trim() || undefined });
    const path = clipPath(episode, clip.start, clip.end, clip.note);
    const url = `${location.origin}${location.pathname}#${path}`;
    setLink(url);
    const m = await shareLink(`Extrait de « ${episode.title} »`, url);
    // Si le lien n'a pu être ni partagé ni copié, il reste affiché dans le champ ci-dessous.
    setMessage(m === url ? null : m);
  };

  return (
    <section className="panel">
      <h2 className="panel__title">
        <Scissors size={18} /> Créer un extrait
      </h2>
      <div className="clip-form">
        <label>
          Début
          <input value={start} onChange={(ev) => setStart(ev.target.value)} inputMode="numeric" />
        </label>
        <label>
          Fin
          <input value={end} onChange={(ev) => setEnd(ev.target.value)} inputMode="numeric" />
        </label>
        {time !== null && (
          <div className="clip-form__now">
            <button className="btn btn--outline btn--small" onClick={() => setStart(formatTime(time))}>
              Début = {formatTime(time)}
            </button>
            <button className="btn btn--outline btn--small" onClick={() => setEnd(formatTime(time))}>
              Fin = {formatTime(time)}
            </button>
          </div>
        )}
        <label className="clip-form__note">
          Note (facultative)
          <input value={note} onChange={(ev) => setNote(ev.target.value.slice(0, 140))} placeholder="Pourquoi ce passage ?" />
        </label>
      </div>
      {invalid ? <p className="small error-text">{invalid}</p> : <p className="small muted">Durée : {formatTime(length)}</p>}
      <div className="row-actions">
        <button className="btn btn--outline" disabled={!!invalid} onClick={() => s !== null && e !== null && player.playSegment(episode, s, e)}>
          <Play size={16} /> Écouter
        </button>
        <button className="btn btn--primary" disabled={!!invalid} onClick={create}>
          Créer et partager
        </button>
      </div>
      {link && (
        <p className="small">
          {message ?? 'Extrait enregistré dans votre bibliothèque.'}{' '}
          <input className="copy-field" readOnly value={link} onFocus={(ev) => ev.target.select()} aria-label="Lien de l'extrait" />
        </p>
      )}
    </section>
  );
}
