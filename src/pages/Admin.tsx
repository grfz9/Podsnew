import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Crown, Search, ShieldCheck, Sparkle, UserRound, Users } from 'lucide-react';
import { getAdminStats, getMembers, PAGE_SIZE, setMemberRole, type Member } from '../api/admin';
import type { Role } from '../api/moderation';
import { EmptyState, ErrorState, Spinner } from '../components/common';
import { useAuth } from '../store/auth';
import { useModeration } from '../store/moderation';
import { formatReleaseDate } from '../utils/format';
import { useAsync, useDebounced } from '../utils/hooks';

const ROLE_LABELS: Record<Role, string> = { admin: 'Administrateur', moderator: 'Modérateur', user: 'Utilisateur' };

function Stat({ label, value, detail, i }: { label: string; value: number | undefined; detail?: string; i: number }) {
  return (
    <div className="admin-stat" style={{ '--i': i } as CSSProperties}>
      <span className="admin-stat__label">{label}</span>
      <strong className="admin-stat__value">{value ?? '–'}</strong>
      {detail && <span className="admin-stat__detail">{detail}</span>}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const Icon = role === 'admin' ? Crown : role === 'moderator' ? ShieldCheck : UserRound;
  return (
    <span className={`role-badge role-badge--${role}`}>
      <Icon size={12} /> {ROLE_LABELS[role]}
    </span>
  );
}

function MemberRow({ member, me, onChanged }: { member: Member; me: string | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = member.display_name || member.username || member.email || 'Membre';
  const change = async (role: Role) => {
    if (role === member.role) return;
    const verb = role === 'user' ? 'retirer le rôle de' : `nommer ${ROLE_LABELS[role].toLowerCase()}`;
    if (!window.confirm(`Voulez-vous ${verb} ${name} ?`)) return;
    setBusy(true);
    setError(null);
    try {
      await setMemberRole(member.id, role);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="member">
      <span className="avatar" aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="member__body">
        <span className="member__name">
          {member.username ? (
            <Link to={`/u/${member.username}`} className="link-button">
              {name}
            </Link>
          ) : (
            name
          )}
          <RoleBadge role={member.role} />
          {member.premium && (
            <span className="role-badge role-badge--premium">
              <Sparkle size={12} /> Podsal+
            </span>
          )}
        </span>
        <span className="member__meta">
          {member.username && `@${member.username} · `}
          {member.email}
        </span>
        <span className="member__meta">
          Inscrit {formatReleaseDate(member.created_at).toLowerCase()}
          {member.last_sign_in_at && ` · vu ${formatReleaseDate(member.last_sign_in_at).toLowerCase()}`}
        </span>
        {error && <span className="small error-text">{error}</span>}
      </div>
      <label className="member__role">
        <span className="sr-only">Rôle de {name}</span>
        <select value={member.role} disabled={busy || member.id === me} onChange={(e) => void change(e.target.value as Role)}>
          <option value="user">Utilisateur</option>
          <option value="moderator">Modérateur</option>
          <option value="admin">Administrateur</option>
        </select>
      </label>
    </li>
  );
}

/** Espace administrateur : chiffres clés, membres inscrits et rôles. */
export function AdminPage() {
  const auth = useAuth();
  const { isAdmin } = useModeration();
  const [query, setQuery] = useState('');
  const search = useDebounced(query);
  const [page, setPage] = useState(0);
  const stats = useAsync(() => (isAdmin ? getAdminStats() : Promise.resolve(null)), [isAdmin]);
  const members = useAsync(() => (isAdmin ? getMembers(search, page) : Promise.resolve(null)), [isAdmin, search, page]);

  if (!auth.userId || !isAdmin) {
    return (
      <div className="page">
        <EmptyState icon={<Crown size={32} />} title="Page réservée aux administrateurs" />
      </div>
    );
  }

  const s = stats.data;
  const total = members.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reload = () => {
    members.reload();
    stats.reload();
  };

  return (
    <div className="page admin-page">
      <h1 className="page__title">Administration</h1>
      <p className="muted">
        Vous êtes administrateur : vous voyez les membres et nommez les modérateurs, qui gèrent la{' '}
        <Link to="/moderation" className="link">
          modération
        </Link>
        .
      </p>

      {stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.reload} />
      ) : (
        <div className="admin-stats">
          <Stat i={0} label="Membres" value={s?.members} detail={s ? `+${s.members_7d} cette semaine` : undefined} />
          <Stat i={1} label="Actifs (7 jours)" value={s?.active_7d} />
          <Stat i={2} label="Abonnés Podsal+" value={s?.premium} />
          <Stat i={3} label="Équipe" value={s ? s.admins + s.moderators : undefined} detail={s ? `${s.admins} admin · ${s.moderators} modo` : undefined} />
          <Stat i={4} label="Propositions en attente" value={s?.pending_suggestions} />
          <Stat i={5} label="Podcasts validés" value={s?.validated_podcasts} />
          <Stat i={6} label="Groupes publiés" value={s?.shared_groups} />
        </div>
      )}

      <section className="admin-members">
        <div className="admin-members__head">
          <h2 className="section-title">
            <Users size={20} /> Membres {total ? `(${total})` : ''}
          </h2>
          <div className="search-box search-box--small">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Nom, pseudo ou e-mail"
              aria-label="Rechercher un membre"
            />
          </div>
        </div>
        {members.loading && !members.data ? (
          <Spinner />
        ) : members.error ? (
          <ErrorState error={members.error} onRetry={members.reload} />
        ) : members.data?.members.length ? (
          <>
            <ul className="member-list">
              {members.data.members.map((m) => (
                <MemberRow key={m.id} member={m} me={auth.userId} onChanged={reload} />
              ))}
            </ul>
            {pages > 1 && (
              <div className="admin-pages">
                <button className="btn btn--outline btn--small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Précédents
                </button>
                <span className="small muted">
                  Page {page + 1} / {pages}
                </span>
                <button className="btn btn--outline btn--small" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                  Suivants
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="muted">Aucun membre ne correspond.</p>
        )}
      </section>
    </div>
  );
}
