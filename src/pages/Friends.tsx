import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Search, UserCheck, UserPlus, Users } from 'lucide-react';
import { follow, getFeed, getFollowCounts, getFollowing, getProfile, getUserActivity, searchProfiles, unfollow } from '../api/social';
import { ActivityItem } from '../components/Activity';
import { EmptyState, ErrorState, Spinner } from '../components/common';
import type { Profile } from '../lib/supabase';
import { useAuth } from '../store/auth';
import { useAsync, useDebounced } from '../utils/hooks';

function NeedsAccount({ title }: { title: string }) {
  const auth = useAuth();
  return (
    <div className="page">
      <h1 className="page__title">{title}</h1>
      <EmptyState icon={<Users size={32} />} title={auth.enabled ? 'Connectez-vous pour retrouver vos amis' : 'Les comptes ne sont pas activés'}>
        {auth.enabled ? (
          <>
            Suivez d'autres auditeurs, voyez ce qu'ils écoutent et partagez vos extraits.{' '}
            <Link to="/account" className="link">
              Se connecter ou créer un compte
            </Link>
          </>
        ) : (
          "Cette installation de Podsnew fonctionne sans serveur : les fonctions sociales ne sont pas disponibles."
        )}
      </EmptyState>
    </div>
  );
}

function FollowButton({ target, following, onChange }: { target: Profile; following: boolean; onChange: () => void }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  if (!auth.userId || target.id === auth.userId) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      await (following ? unfollow(auth.userId!, target.id) : follow(auth.userId!, target.id));
      onChange();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={`btn btn--small ${following ? 'btn--outline' : 'btn--primary'}`} onClick={toggle} disabled={busy}>
      {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
      {following ? 'Suivi' : 'Suivre'}
    </button>
  );
}

function PersonRow({ profile, following, onChange }: { profile: Profile; following: boolean; onChange: () => void }) {
  return (
    <li className="person">
      <span className="avatar" aria-hidden>
        {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
      </span>
      <Link to={`/u/${profile.username}`} className="person__name">
        <strong>{profile.display_name || profile.username}</strong>
        <span className="small muted">@{profile.username}</span>
      </Link>
      <FollowButton target={profile} following={following} onChange={onChange} />
    </li>
  );
}

export function FriendsPage() {
  const auth = useAuth();
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim());
  const following = useAsync(() => (auth.userId ? getFollowing(auth.userId) : Promise.resolve([])), [auth.userId]);
  const feed = useAsync(() => (auth.userId ? getFeed(auth.userId) : Promise.resolve([])), [auth.userId]);
  const results = useAsync(() => (term.length >= 2 ? searchProfiles(term) : Promise.resolve([])), [term]);
  const followingIds = new Set((following.data ?? []).map((p) => p.id));
  const refresh = () => {
    following.reload();
    feed.reload();
  };

  if (!auth.userId) return <NeedsAccount title="Amis" />;

  return (
    <div className="page">
      <h1 className="page__title">Amis</h1>

      <div className="share-toggle">
        <label className="setting">
          <span>
            Partager mon activité d'écoute
            <span className="small muted"> — les personnes qui vous suivent voient les épisodes que vous écoutez</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={auth.profile?.share_activity ?? false}
            onChange={(e) => void auth.updateProfile({ share_activity: e.target.checked })}
          />
        </label>
      </div>

      <div className="friends-layout">
        <section>
          <h2 className="section-title">Activité</h2>
          {feed.loading && !feed.data ? (
            <Spinner />
          ) : feed.error ? (
            <ErrorState error={feed.error} onRetry={feed.reload} />
          ) : feed.data?.length ? (
            <div className="activity-list">
              {feed.data.map((row) => (
                <ActivityItem key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <p className="muted">
              {followingIds.size ? "Les personnes que vous suivez n'ont encore rien partagé." : 'Suivez des personnes pour voir leurs écoutes, extraits et avis.'}
            </p>
          )}
        </section>

        <aside>
          <h2 className="section-title">Trouver des personnes</h2>
          <div className="search-box search-box--small">
            <Search size={16} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pseudo ou nom" aria-label="Rechercher une personne" />
          </div>
          {term.length >= 2 && (
            <ul className="people">
              {results.loading ? (
                <li className="small muted">Recherche…</li>
              ) : results.data?.length ? (
                results.data.filter((p) => p.id !== auth.userId).map((p) => <PersonRow key={p.id} profile={p} following={followingIds.has(p.id)} onChange={refresh} />)
              ) : (
                <li className="small muted">Personne ne correspond à « {term} ».</li>
              )}
            </ul>
          )}

          <h2 className="section-title">Vous suivez</h2>
          {following.data?.length ? (
            <ul className="people">
              {following.data.map((p) => (
                <PersonRow key={p.id} profile={p} following onChange={refresh} />
              ))}
            </ul>
          ) : (
            <p className="small muted">Vous ne suivez personne pour l'instant.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { username = '' } = useParams();
  const auth = useAuth();
  const profile = useAsync(() => (auth.enabled ? getProfile(username) : Promise.resolve(null)), [username, auth.enabled]);
  const id = profile.data?.id;
  const counts = useAsync(() => (id ? getFollowCounts(id) : Promise.resolve(null)), [id]);
  const following = useAsync(() => (auth.userId ? getFollowing(auth.userId) : Promise.resolve([])), [auth.userId]);
  const activity = useAsync(() => (id && auth.userId ? getUserActivity(id) : Promise.resolve([])), [id, auth.userId]);
  const isFollowing = !!following.data?.some((p) => p.id === id);

  if (!auth.enabled) return <NeedsAccount title="Profil" />;
  if (profile.loading) return <div className="page"><Spinner /></div>;
  if (!profile.data) {
    return (
      <div className="page">
        <EmptyState icon={<Users size={32} />} title={`Aucun profil « ${username} »`} />
      </div>
    );
  }
  const p = profile.data;

  return (
    <div className="page">
      <header className="profile-head">
        <span className="avatar avatar--large" aria-hidden>
          {(p.display_name || p.username).slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1>{p.display_name || p.username}</h1>
          <p className="muted small">
            @{p.username}
            {counts.data && ` · ${counts.data.followers} abonné${counts.data.followers > 1 ? 's' : ''} · ${counts.data.following} abonnement${counts.data.following > 1 ? 's' : ''}`}
          </p>
        </div>
        <FollowButton
          target={p}
          following={isFollowing}
          onChange={() => {
            following.reload();
            counts.reload();
            activity.reload();
          }}
        />
      </header>

      <h2 className="section-title">Activité récente</h2>
      {!auth.userId ? (
        <p className="muted">
          <Link to="/account" className="link">
            Connectez-vous
          </Link>{' '}
          et suivez {p.display_name || p.username} pour voir son activité.
        </p>
      ) : activity.data?.length ? (
        <div className="activity-list">
          {activity.data.map((row) => (
            <ActivityItem key={row.id} row={row} showAuthor={false} />
          ))}
        </div>
      ) : (
        <p className="muted">{p.id === auth.userId || isFollowing ? 'Aucune activité partagée.' : 'Suivez cette personne pour voir son activité.'}</p>
      )}
    </div>
  );
}
