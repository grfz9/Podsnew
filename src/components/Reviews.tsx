import { useState } from 'react';
import { Link } from 'react-router';
import type { Podcast } from '../types';
import { useAuth } from '../store/auth';
import { deleteReview, getRating, getReviews, postActivity, saveReview } from '../api/social';
import { useAsync } from '../utils/hooks';
import { formatReleaseDate } from '../utils/format';
import { Stars } from './common';

/** Notes et avis laissés par les utilisateurs de Podsnew (aucun avis n'est importé ni inventé). */
export function Reviews({ podcast }: { podcast: Podcast }) {
  const auth = useAuth();
  const reviews = useAsync(() => (auth.enabled ? getReviews(podcast.id) : Promise.resolve([])), [podcast.id, auth.enabled]);
  const rating = useAsync(() => (auth.enabled ? getRating(podcast.id) : Promise.resolve(null)), [podcast.id, auth.enabled]);
  const mine = reviews.data?.find((r) => r.user_id === auth.userId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!auth.enabled) return null;

  const startEdit = () => {
    setValue(mine?.rating ?? 0);
    setBody(mine?.body ?? '');
    setEditing(true);
  };

  const submit = async () => {
    if (!auth.userId || value < 1) return;
    setSaving(true);
    setError(null);
    try {
      await saveReview(auth.userId, podcast.id, value, body);
      if (!mine) {
        postActivity(auth.userId, 'review', {
          podcastId: podcast.id,
          podcastTitle: podcast.title,
          artwork: podcast.artwork,
          rating: value,
          body: body.trim().slice(0, 280) || undefined,
        }).catch(() => undefined);
      }
      setEditing(false);
      reviews.reload();
      rating.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!auth.userId) return;
    await deleteReview(auth.userId, podcast.id).catch((e: Error) => setError(e.message));
    setEditing(false);
    reviews.reload();
    rating.reload();
  };

  const others = (reviews.data ?? []).filter((r) => r.user_id !== auth.userId);

  return (
    <section className="reviews">
      <div className="section__header">
        <h2>Avis des auditeurs</h2>
        {rating.data && (
          <span className="reviews__average">
            <Stars value={rating.data.average} /> {String(rating.data.average).replace('.', ',')} · {rating.data.count} avis
          </span>
        )}
      </div>

      {auth.userId ? (
        editing ? (
          <div className="review-form">
            <Stars value={value} onChange={setValue} size={24} />
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 2000))} rows={3} placeholder="Votre avis (facultatif)" aria-label="Votre avis" />
            <div className="row-actions">
              <button className="btn btn--primary" onClick={submit} disabled={value < 1 || saving}>
                Publier
              </button>
              <button className="btn btn--outline" onClick={() => setEditing(false)}>
                Annuler
              </button>
              {mine && (
                <button className="btn btn--danger" onClick={remove}>
                  Supprimer mon avis
                </button>
              )}
            </div>
            {error && <p className="small error-text">{error}</p>}
          </div>
        ) : mine ? (
          <div className="review review--mine">
            <div className="review__head">
              <strong>Votre avis</strong> <Stars value={mine.rating} />
              <button className="btn btn--outline btn--small" onClick={startEdit}>
                Modifier
              </button>
            </div>
            {mine.body && <p>{mine.body}</p>}
          </div>
        ) : (
          <button className="btn btn--outline" onClick={startEdit}>
            Donner mon avis
          </button>
        )
      ) : (
        <p className="muted small">
          <Link to="/account" className="link">
            Connectez-vous
          </Link>{' '}
          pour noter ce podcast.
        </p>
      )}

      {others.length === 0 && !mine && <p className="muted small">Aucun avis pour l'instant.</p>}
      {others.map((r) => (
        <article key={r.id} className="review">
          <div className="review__head">
            <Link to={`/u/${r.profiles?.username}`} className="review__author">
              {r.profiles?.display_name || r.profiles?.username}
            </Link>
            <Stars value={r.rating} />
            <span className="small muted">{formatReleaseDate(r.updated_at)}</span>
          </div>
          {r.body && <p>{r.body}</p>}
        </article>
      ))}
    </section>
  );
}
