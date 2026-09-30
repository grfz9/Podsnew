import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Check, ListMusic, Search, UserCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { addFriend, getFriendPlaylists, getFriendships, getProfile, removeFriend, searchProfiles, type Friendships } from '../api/social';
import { PlaylistGrid, PlaylistView } from '../components/Playlists';
import { FriendGroups } from '../components/SharedGroups';
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
            Ajoutez des amis pour écouter leurs playlists.{' '}
            <Link to="/account" className="link">
              Se connecter ou créer un compte
            </Link>
          </>
        ) : (
          'Cette installation de Podsal fonctionne sans serveur : les amis ne sont pas disponibles.'
        )}
      </EmptyState>
    </div>
  );
}

type Relation = 'friend' | 'incoming' | 'outgoing' | 'none';

function relationOf(id: string, f: Friendships | undefined): Relation {
  if (!f) return 'none';
  if (f.friends.some((p) => p.id === id)) return 'friend';
  if (f.incoming.some((p) => p.id === id)) return 'incoming';
  if (f.outgoing.some((p) => p.id === id)) return 'outgoing';
  return 'none';
}

function RelationButtons({ target, relation, onChange }: { target: Profile; relation: Relation; onChange: () => void }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  if (!auth.userId || target.id === auth.userId) return null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const me = auth.userId;
  switch (relation) {
    case 'friend':
      return (
        <button
          className="btn btn--outline btn--small"
          disabled={busy}
          onClick={() => confirm(`Retirer ${target.display_name || target.username} de vos amis ?`) && run(() => removeFriend(me, target.id))}
        >
          <UserMinus size={14} /> Retirer
        </button>
      );
    case 'incoming':
      return (
        <span className="row-actions">
          <button className="btn btn--primary btn--small" disabled={busy} onClick={() => run(() => addFriend(me, target.id))}>
            <Check size={14} /> Accepter
          </button>
          <button className="btn btn--outline btn--small" disabled={busy} onClick={() => run(() => removeFriend(me, target.id))}>
            <X size={14} /> Refuser
          </button>
        </span>
      );
    case 'outgoing':
      return (
        <button className="btn btn--outline btn--small" disabled={busy} onClick={() => run(() => removeFriend(me, target.id))}>
          <UserCheck size={14} /> Demande envoyée · annuler
        </button>
      );
    default:
      return (
        <button className="btn btn--primary btn--small" disabled={busy} onClick={() => run(() => addFriend(me, target.id))}>
          <UserPlus size={14} /> Ajouter en ami
        </button>
      );
  }
}

function PersonRow({ profile, relation, onChange }: { profile: Profile; relation: Relation; onChange: () => void }) {
  return (
    <li className="person">
      <span className="avatar" aria-hidden>
        {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
      </span>
      <Link to={`/u/${profile.username}`} className="person__name">
        <strong>{profile.display_name || profile.username}</strong>
        <span className="small muted">@{profile.username}</span>
      </Link>
      <RelationButtons target={profile} relation={relation} onChange={onChange} />
    </li>
  );
}

export function FriendsPage() {
  const auth = useAuth();
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim());
  const friendships = useAsync(() => (auth.userId ? getFriendships(auth.userId) : Promise.resolve(undefined)), [auth.userId]);
  const results = useAsync(() => (term.length >= 2 ? searchProfiles(term) : Promise.resolve([])), [term]);
  const f = friendships.data;

  if (!auth.userId) return <NeedsAccount title="Amis" />;

  return (
    <div className="page">
      <h1 className="page__title">Amis</h1>
      <p className="muted">Vos amis peuvent voir et écouter vos playlists, et vous les leurs. Il n'y a ni messagerie ni commentaires.</p>

      <div className="friends-layout">
        <section>
          {f && f.incoming.length > 0 && (
            <>
              <h2 className="section-title">Demandes reçues</h2>
              <ul className="people">
                {f.incoming.map((p) => (
                  <PersonRow key={p.id} profile={p} relation="incoming" onChange={friendships.reload} />
                ))}
              </ul>
            </>
          )}

          <h2 className="section-title">Vos amis</h2>
          {friendships.loading && !f ? (
            <Spinner />
          ) : friendships.error ? (
            <ErrorState error={friendships.error} onRetry={friendships.reload} />
          ) : f?.friends.length ? (
            <ul className="people">
              {f.friends.map((p) => (
                <PersonRow key={p.id} profile={p} relation="friend" onChange={friendships.reload} />
              ))}
            </ul>
          ) : (
            <p className="muted">Vous n'avez pas encore d'amis sur Podsal.</p>
          )}

          {f && f.outgoing.length > 0 && (
            <>
              <h2 className="section-title">Demandes envoyées</h2>
              <ul className="people">
                {f.outgoing.map((p) => (
                  <PersonRow key={p.id} profile={p} relation="outgoing" onChange={friendships.reload} />
                ))}
              </ul>
            </>
          )}
        </section>

        <aside>
          <h2 className="section-title">Trouver une personne</h2>
          <div className="search-box search-box--small">
            <Search size={16} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pseudo" aria-label="Rechercher une personne" />
          </div>
          {term.length >= 2 && (
            <ul className="people">
              {results.loading ? (
                <li className="small muted">Recherche…</li>
              ) : results.data?.length ? (
                results.data
                  .filter((p) => p.id !== auth.userId)
                  .map((p) => <PersonRow key={p.id} profile={p} relation={relationOf(p.id, f)} onChange={friendships.reload} />)
              ) : (
                <li className="small muted">Personne ne correspond à « {term} ».</li>
              )}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Profil d'une personne : ses playlists si vous êtes amis. */
export function ProfilePage() {
  const { username = '', playlistId } = useParams();
  const auth = useAuth();
  const profile = useAsync(() => (auth.enabled ? getProfile(username) : Promise.resolve(null)), [username, auth.enabled]);
  const friendships = useAsync(() => (auth.userId ? getFriendships(auth.userId) : Promise.resolve(undefined)), [auth.userId]);
  const id = profile.data?.id;
  const relation = id ? relationOf(id, friendships.data) : 'none';
  const isFriend = relation === 'friend';
  const playlists = useAsync(() => (id && isFriend ? getFriendPlaylists(id) : Promise.resolve([])), [id, isFriend]);

  if (!auth.enabled || !auth.userId) return <NeedsAccount title="Profil" />;
  if (profile.loading || friendships.loading) return <div className="page"><Spinner /></div>;
  if (!profile.data) {
    return (
      <div className="page">
        <EmptyState icon={<Users size={32} />} title={`Aucun profil « ${username} »`} />
      </div>
    );
  }
  const p = profile.data;
  const name = p.display_name || p.username;
  const selected = playlistId ? playlists.data?.find((pl) => pl.id === playlistId) : undefined;

  return (
    <div className="page">
      <header className="profile-head">
        <span className="avatar avatar--large" aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1>{name}</h1>
          <p className="muted small">@{p.username}</p>
        </div>
        <RelationButtons
          target={p}
          relation={relation}
          onChange={() => {
            friendships.reload();
            playlists.reload();
          }}
        />
      </header>

      {p.id === auth.userId ? (
        <p className="muted">
          C'est votre profil. Vos playlists sont dans la{' '}
          <Link to="/library?tab=playlists" className="link">
            Bibliothèque
          </Link>
          , et les groupes que vous publiez depuis{' '}
          <Link to="/fichiers" className="link">
            Mes fichiers
          </Link>{' '}
          sont visibles ici par vos amis.
        </p>
      ) : !isFriend ? (
        <p className="muted">Ses playlists et ses groupes seront visibles lorsque vous serez amis (ajout mutuel).</p>
      ) : playlists.loading && !playlists.data ? (
        <Spinner />
      ) : playlists.error ? (
        <ErrorState error={playlists.error} onRetry={playlists.reload} />
      ) : selected ? (
        <>
          <Link to={`/u/${p.username}`} className="link-button muted small">
            ← Toutes les playlists de {name}
          </Link>
          <h2 className="section-title">{selected.name}</h2>
          <PlaylistView playlist={selected} editable={false} />
        </>
      ) : playlists.data?.length ? (
        <>
          <h2 className="section-title">Playlists</h2>
          <PlaylistGrid playlists={playlists.data} linkTo={(pl) => `/u/${p.username}/playlist/${pl.id}`} />
        </>
      ) : (
        <EmptyState icon={<ListMusic size={32} />} title={`${name} n'a pas encore de playlist`} />
      )}
      {isFriend && !selected && p.id !== auth.userId && <FriendGroups ownerId={p.id} username={p.username} name={name} />}
    </div>
  );
}
