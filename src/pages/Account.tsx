import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ChartColumn, Cloud, CloudOff, FileUp, ListMusic, LogOut, Mic, Users } from 'lucide-react';
import { isUsernameAvailable } from '../api/social';
import { EmptyState, Tabs } from '../components/common';
import { useAuth } from '../store/auth';
import { formatReleaseDate } from '../utils/format';

const USERNAME = /^[a-z0-9_]{3,24}$/;

function AuthForms() {
  const auth = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await auth.signIn(email, password);
      } else if (mode === 'reset') {
        await auth.resetPassword(email);
        setInfo('Un e-mail de réinitialisation vient de vous être envoyé.');
      } else {
        const name = username.trim().toLowerCase();
        if (!USERNAME.test(name)) throw new Error('Le pseudo doit contenir 3 à 24 caractères : lettres minuscules, chiffres ou _.');
        if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
        if (!(await isUsernameAvailable(name))) throw new Error('Ce pseudo est déjà pris.');
        const needsConfirmation = await auth.signUp(email, password, name, displayName.trim());
        if (needsConfirmation) setInfo('Compte créé. Confirmez votre adresse en cliquant sur le lien reçu par e-mail, puis connectez-vous.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <Tabs
        tabs={[
          { id: 'signin', label: 'Se connecter' },
          { id: 'signup', label: 'Créer un compte' },
        ]}
        value={mode === 'reset' ? 'signin' : mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
          setInfo(null);
        }}
      />
      <p className="small muted">
        Avec un compte, vos abonnements, votre progression et vos statistiques sont synchronisés entre vos appareils, et vous pouvez suivre vos amis,
        laisser des avis et publier votre propre podcast.
      </p>
      <form onSubmit={submit} className="form">
        <label>
          Adresse e-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'reset' && (
          <label>
            Mot de passe
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {mode === 'signup' && (
          <>
            <label>
              Pseudo <span className="small muted">(visible par les autres, ex. marie_dupont)</span>
              <input required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} pattern="[a-z0-9_]{3,24}" autoComplete="username" />
            </label>
            <label>
              Nom affiché <span className="small muted">(facultatif)</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 60))} autoComplete="name" />
            </label>
          </>
        )}
        {error && <p className="error-text small">{error}</p>}
        {info && <p className="ok-text small">{info}</p>}
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
        </button>
        {mode === 'signin' && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setMode('reset')}>
            Mot de passe oublié ?
          </button>
        )}
      </form>
    </div>
  );
}

function ProfileSettings() {
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(auth.profile?.display_name ?? '');
  const [saved, setSaved] = useState(false);
  const p = auth.profile;

  return (
    <>
      <header className="profile-head">
        <span className="avatar avatar--large" aria-hidden>
          {(p?.display_name || p?.username || '?').slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1>{p?.display_name || p?.username}</h1>
          <p className="small muted">
            {p && (
              <Link to={`/u/${p.username}`} className="link">
                @{p.username}
              </Link>
            )}{' '}
            · {auth.email}
          </p>
        </div>
      </header>

      <div className="sync-status">
        {auth.syncStatus === 'error' ? <CloudOff size={18} /> : <Cloud size={18} />}
        <span>
          {auth.syncStatus === 'syncing' && 'Synchronisation…'}
          {auth.syncStatus === 'synced' && `Synchronisé${auth.lastSyncedAt ? ` · ${formatReleaseDate(new Date(auth.lastSyncedAt).toISOString()).toLowerCase()}` : ''}`}
          {auth.syncStatus === 'error' && 'La synchronisation a échoué.'}
          {auth.syncStatus === 'off' && 'Synchronisation inactive'}
        </span>
        <button className="btn btn--ghost btn--small" onClick={auth.syncNow}>
          Synchroniser maintenant
        </button>
      </div>

      <nav className="account-links">
        <Link to="/stats" className="account-link">
          <ChartColumn size={20} /> Statistiques d'écoute
        </Link>
        <Link to="/friends" className="account-link">
          <Users size={20} /> Amis
        </Link>
        <Link to="/studio" className="account-link">
          <Mic size={20} /> Studio créateur
        </Link>
        <Link to="/queue" className="account-link">
          <ListMusic size={20} /> File d'attente
        </Link>
        <Link to="/import" className="account-link">
          <FileUp size={20} /> Importer des abonnements
        </Link>
      </nav>

      <section className="settings">
        <h2>Profil</h2>
        <form
          className="form form--inline"
          onSubmit={async (e) => {
            e.preventDefault();
            await auth.updateProfile({ display_name: displayName.trim() || null });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          <label>
            Nom affiché
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 60))} />
          </label>
          <button className="btn btn--outline btn--small" type="submit">
            Enregistrer
          </button>
          {saved && <span className="small ok-text">Enregistré</span>}
        </form>
        <label className="setting">
          <span>
            Partager mon activité d'écoute
            <span className="small muted"> — visible par les personnes qui vous suivent</span>
          </span>
          <input type="checkbox" className="switch" checked={p?.share_activity ?? false} onChange={(e) => void auth.updateProfile({ share_activity: e.target.checked })} />
        </label>
        <button className="btn btn--outline" onClick={() => void auth.signOut()}>
          <LogOut size={16} /> Se déconnecter
        </button>
      </section>
    </>
  );
}

export function AccountPage() {
  const auth = useAuth();
  if (!auth.enabled) {
    return (
      <div className="page">
        <h1 className="page__title">Compte</h1>
        <EmptyState icon={<Cloud size={32} />} title="Les comptes ne sont pas activés sur cette installation">
          Podsnew fonctionne entièrement sur cet appareil : abonnements, progression, téléchargements et statistiques y sont conservés.
        </EmptyState>
        <nav className="account-links">
          <Link to="/stats" className="account-link">
            <ChartColumn size={20} /> Statistiques d'écoute
          </Link>
          <Link to="/import" className="account-link">
            <FileUp size={20} /> Importer des abonnements
          </Link>
        </nav>
      </div>
    );
  }
  return <div className="page">{auth.loading ? null : auth.userId ? <ProfileSettings key={auth.profile?.id ?? 'chargement'} /> : <AuthForms />}</div>;
}
