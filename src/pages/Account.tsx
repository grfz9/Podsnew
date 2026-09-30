import { useState, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router';
import { ChartColumn, Clock, Cloud, CloudOff, FileUp, Image, ListMusic, LogOut, Mail, Mic, ShieldCheck, Smartphone, Sparkle, Users } from 'lucide-react';
import { normalizePhone } from '../utils/phone';
import { usePremium } from '../store/premium';
import { useModeration } from '../store/moderation';
import { isUsernameAvailable } from '../api/social';
import { EmptyState, Tabs } from '../components/common';
import { useAuth } from '../store/auth';
import { formatReleaseDate } from '../utils/format';

const USERNAME = /^[a-z0-9_]{3,24}$/;

/** Logos officiels des fournisseurs de connexion. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M16.37 12.64c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.61 2.79-.41 6.92 1.16 9.18.77 1.11 1.68 2.35 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.39 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.24.88-1.29 1.24-2.53 1.26-2.6-.03-.01-2.42-.93-2.44-3.68zM14.08 5.9c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.02.08 2.07-.52 2.71-1.28z" />
    </svg>
  );
}

type Method = 'email' | 'phone';
type Mode = 'signin' | 'signup' | 'reset' | 'verify';

function AuthForms() {
  const auth = useAuth();
  const [method, setMethod] = useState<Method>('email');
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  // Erreur renvoyée par Google ou Apple dans l'adresse de retour.
  const [error, setError] = useState<string | null>(() => {
    const message = new URLSearchParams(location.search).get('error_description');
    if (!message) return null;
    return /not enabled|unsupported provider/i.test(message) ? "Cette méthode de connexion n'est pas encore activée sur le serveur." : message;
  });
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const native = Capacitor.isNativePlatform();

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const checkSignup = async () => {
    const name = username.trim().toLowerCase();
    if (!USERNAME.test(name)) throw new Error('Le pseudo doit contenir 3 à 24 caractères : lettres minuscules, chiffres ou _.');
    if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    if (!(await isUsernameAvailable(name))) throw new Error('Ce pseudo est déjà pris.');
    return name;
  };

  const phoneNumber = () => {
    const n = normalizePhone(phone);
    if (!n) throw new Error('Numéro de téléphone invalide. Exemple : 06 12 34 56 78 ou +33 6 12 34 56 78.');
    return n;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'verify') {
        await auth.verifyPhone(phoneNumber(), code);
      } else if (mode === 'reset') {
        await auth.resetPassword(email);
        setInfo('Un e-mail de réinitialisation vient de vous être envoyé.');
      } else if (mode === 'signin') {
        if (method === 'email') await auth.signIn(email, password);
        else await auth.signInPhone(phoneNumber(), password);
      } else {
        const name = await checkSignup();
        if (method === 'email') {
          const needsConfirmation = await auth.signUp(email, password, name, displayName.trim());
          if (needsConfirmation) setInfo('Compte créé. Confirmez votre adresse en cliquant sur le lien reçu par e-mail, puis connectez-vous.');
        } else {
          await auth.signUpPhone(phoneNumber(), password, name, displayName.trim());
          setMode('verify');
          setInfo('Un code vient de vous être envoyé par SMS.');
        }
      }
    });
  };

  return (
    <div className="auth-card">
      <Tabs
        tabs={[
          { id: 'signin', label: 'Se connecter' },
          { id: 'signup', label: 'Créer un compte' },
        ]}
        value={mode === 'signup' || (mode === 'verify' && method === 'phone') ? 'signup' : 'signin'}
        onChange={(m) => {
          setMode(m);
          setError(null);
          setInfo(null);
        }}
      />
      <p className="small muted">
        Avec un compte, vos abonnements, playlists, progression et statistiques sont synchronisés entre vos appareils ; vous pouvez partager vos
        playlists avec vos amis, proposer des podcasts islamiques, publier votre propre podcast et vous abonner à Podsal+.
      </p>

      {!native && mode !== 'verify' && (
        <>
          <div className="auth-providers">
            <button type="button" className="btn btn--provider" disabled={busy} onClick={() => run(() => auth.signInWithProvider('google'))}>
              <GoogleLogo /> Continuer avec Google
            </button>
            <button type="button" className="btn btn--provider btn--apple" disabled={busy} onClick={() => run(() => auth.signInWithProvider('apple'))}>
              <AppleLogo /> Continuer avec Apple
            </button>
          </div>
          <div className="auth-separator">
            <span>ou</span>
          </div>
        </>
      )}

      {mode !== 'verify' && mode !== 'reset' && (
        <div className="segmented" role="radiogroup" aria-label="Identifiant">
          {(
            [
              ['email', 'E-mail', Mail],
              ['phone', 'Téléphone', Smartphone],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} type="button" role="radio" aria-checked={method === id} className={`segmented__item ${method === id ? 'segmented__item--active' : ''}`} onClick={() => setMethod(id)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="form">
        {mode === 'verify' ? (
          <label>
            Code reçu par SMS au {normalizePhone(phone) ?? phone}
            <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{4,8}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </label>
        ) : method === 'email' || mode === 'reset' ? (
          <label>
            Adresse e-mail
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        ) : (
          <label>
            Numéro de téléphone
            <input type="tel" autoComplete="tel" required placeholder="06 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        )}
        {(mode === 'signin' || mode === 'signup') && (
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
          {mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : mode === 'verify' ? 'Valider le code' : 'Envoyer le lien'}
        </button>
        {mode === 'signin' && method === 'email' && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setMode('reset')}>
            Mot de passe oublié ?
          </button>
        )}
        {mode === 'verify' && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setMode('signup')}>
            Modifier le numéro
          </button>
        )}
      </form>
    </div>
  );
}

/** Pseudo provisoire (compte Google, Apple ou téléphone) : l'utilisateur choisit le sien. */
function ChooseUsername() {
  const auth = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!auth.profile || auth.profile.username_set !== false) return null;
  return (
    <section className="premium-teaser choose-username">
      <div>
        <h2>Choisissez votre pseudo</h2>
        <p className="small muted">
          Un pseudo provisoire vous a été attribué (@{auth.profile.username}). Vos amis vous trouveront avec celui que vous choisissez.
        </p>
        <form
          className="form form--inline"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setBusy(true);
            try {
              await auth.setUsername(name);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Pseudo
            <input required value={name} onChange={(e) => setName(e.target.value.toLowerCase())} pattern="[a-z0-9_]{3,24}" autoComplete="username" />
          </label>
          <button className="btn btn--primary btn--small" disabled={busy}>
            Enregistrer
          </button>
        </form>
        {error && <p className="small error-text">{error}</p>}
      </div>
    </section>
  );
}

function ProfileSettings() {
  const auth = useAuth();
  const { isAdmin } = useModeration();
  const { isPremium } = usePremium();
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

      <ChooseUsername />

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
        <Link to="/premium" className="account-link account-link--premium">
          <Sparkle size={20} /> {isPremium ? 'Podsal+ · actif' : 'Podsal+'}
        </Link>
        <Link to="/fonds-ecran" className="account-link">
          <Image size={20} /> Fonds d'écran
        </Link>
        <Link to="/stats" className="account-link">
          <ChartColumn size={20} /> Statistiques d'écoute
        </Link>
        <Link to="/friends" className="account-link">
          <Users size={20} /> Amis
        </Link>
        <Link to="/priere" className="account-link">
          <Clock size={20} /> Horaires de prière
        </Link>
        <Link to="/library?tab=playlists" className="account-link">
          <ListMusic size={20} /> Playlists
        </Link>
        <Link to="/studio" className="account-link">
          <Mic size={20} /> Studio créateur
        </Link>
        {isAdmin && (
          <Link to="/moderation" className="account-link">
            <ShieldCheck size={20} /> Modération
          </Link>
        )}
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
          Podsal fonctionne entièrement sur cet appareil : abonnements, progression, téléchargements et statistiques y sont conservés.
        </EmptyState>
        <nav className="account-links">
          <Link to="/fonds-ecran" className="account-link">
            <Image size={20} /> Fonds d'écran
          </Link>
          <Link to="/priere" className="account-link">
            <Clock size={20} /> Horaires de prière
          </Link>
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
