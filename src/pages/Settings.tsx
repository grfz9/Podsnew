import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Bell,
  BookOpen,
  ChartColumn,
  ChevronRight,
  Clock,
  Cloud,
  Compass,
  Crown,
  Download,
  FolderOpen,
  Image,
  KeyRound,
  ListMusic,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Monitor,
  ShieldCheck,
  Sparkle,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { TRANSLATIONS, type TranslationId } from '../api/quran';
import { HomeInterests } from '../components/HomeInterests';
import { SHOW_WHATS_NEW_EVENT } from '../components/WhatsNew';
import { isStandalone } from '../lib/install';
import { notificationsSupported, registerBackgroundCheck, requestNotificationPermission } from '../lib/notifications';
import { useAuth } from '../store/auth';
import { useDownloads } from '../store/downloads';
import { useLibrary } from '../store/library';
import { useModeration } from '../store/moderation';
import { usePremium } from '../store/premium';

function Row({ to, onClick, icon, title, subtitle, right }: { to?: string; onClick?: () => void; icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  const content = (
    <>
      <span className="settings-row__icon">{icon}</span>
      <span className="settings-row__text">
        <strong>{title}</strong>
        {subtitle && <span className="small muted">{subtitle}</span>}
      </span>
      {right ?? ((to || onClick) && <ChevronRight size={18} className="settings-row__chevron" />)}
    </>
  );
  if (to) return <Link to={to} className="settings-row">{content}</Link>;
  if (onClick) return <button className="settings-row" onClick={onClick}>{content}</button>;
  return <div className="settings-row">{content}</div>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <h2>{title}</h2>
      <div className="settings-group__rows">{children}</div>
    </section>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Au moins 8 caractères.');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      await auth.changePassword(password);
      setOk(true);
      setTimeout(onDone, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        Nouveau mot de passe
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label>
        Confirmer
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && <p className="small error-text">{error}</p>}
      {ok && <p className="small ok-text">Mot de passe changé.</p>}
      <div className="row-actions">
        <button className="btn btn--primary btn--small" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}

/** Paramètres : compte, contenu, Coran, écoute, prière, notifications, appli (inspiré des réglages de Spotify). */
export function SettingsPage() {
  const auth = useAuth();
  const library = useLibrary();
  const premium = usePremium();
  const { downloads } = useDownloads();
  const { isModerator, isAdmin } = useModeration();
  const [changingPassword, setChangingPassword] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const translation: TranslationId = library.settings.quran.translation === 'rashid' ? 'rashid' : 'hamidullah';
  const desktopVersion = (window as Window & { podsalDesktop?: { version?: string | null } }).podsalDesktop?.version;

  const toggleNotifications = async (enabled: boolean) => {
    setNotifyError(null);
    if (enabled) {
      const granted = await requestNotificationPermission().catch(() => false);
      if (!granted) return setNotifyError('Autorisez les notifications pour Podsal dans les réglages de votre navigateur ou de votre téléphone.');
      void registerBackgroundCheck();
    }
    library.setSettings({ notifications: enabled });
  };

  const switchInput = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
  );

  return (
    <div className="page settings-page">
      <h1 className="page__title">Paramètres</h1>

      <div className="settings-tiles">
        <Link to="/premium" className={`settings-tile ${premium.isPremium ? 'settings-tile--gold' : ''}`}>
          <Sparkle size={26} />
          <strong>Podsal+</strong>
          <span className="small">{premium.isPremium ? 'Actif' : 'Découvrir'}</span>
        </Link>
        <Link to="/library?tab=downloads" className="settings-tile">
          <Download size={26} />
          <strong>Hors-ligne</strong>
          <span className="small">
            {downloads.length} téléchargement{downloads.length > 1 ? 's' : ''}
          </span>
        </Link>
        <Link to="/stats" className="settings-tile">
          <ChartColumn size={26} />
          <strong>Statistiques</strong>
          <span className="small">Mon écoute</span>
        </Link>
      </div>

      <Group title="Compte">
        {auth.userId ? (
          <>
            <Row to="/account" icon={<User size={20} />} title="Profil" subtitle={[auth.profile?.display_name, auth.profile?.username && `@${auth.profile.username}`].filter(Boolean).join(' · ') || 'Nom affiché, pseudo'} />
            <Row icon={<Mail size={20} />} title="Adresse e-mail" subtitle={auth.email ?? '—'} />
            {changingPassword ? (
              <PasswordForm onDone={() => setChangingPassword(false)} />
            ) : (
              <Row onClick={() => setChangingPassword(true)} icon={<KeyRound size={20} />} title="Mot de passe" subtitle="Changer de mot de passe" />
            )}
            <Row to="/friends" icon={<Users size={20} />} title="Amis" subtitle="Inviter, suivre, partager des groupes" />
            <Row
              onClick={auth.syncNow}
              icon={<Cloud size={20} />}
              title="Synchronisation"
              subtitle={auth.syncStatus === 'error' ? 'La dernière synchronisation a échoué : toucher pour réessayer' : auth.syncStatus === 'syncing' ? 'Synchronisation…' : 'Bibliothèque, favoris et plan de lecture sur tous vos appareils'}
            />
          </>
        ) : (
          <Row to="/account" icon={<LogIn size={20} />} title="Se connecter" subtitle="Pour retrouver votre bibliothèque sur tous vos appareils" />
        )}
      </Group>

      <Group title="Contenu et affichage">
        <Row to="/fonds-ecran" icon={<Image size={20} />} title="Fonds d’écran" subtitle="Page principale et menu de gauche" />
        <div className="settings-embed">
          <HomeInterests />
        </div>
      </Group>

      <Group title="Coran">
        <Row
          icon={<BookOpen size={20} />}
          title="Traduction"
          subtitle="Traductions officielles revues par des savants"
          right={
            <select
              className="input settings-select"
              value={translation}
              onChange={(e) => library.setSettings({ quran: { ...library.settings.quran, translation: e.target.value as TranslationId } })}
              aria-label="Traduction"
            >
              {TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          }
        />
      </Group>

      <Group title="Écoute">
        <Row
          icon={<ListMusic size={20} />}
          title="Épisodes du plus ancien au plus récent"
          subtitle="Ordre de lecture sur la page d’un podcast"
          right={switchInput(library.settings.episodeOrder === 'oldest', (v) => library.setSettings({ episodeOrder: v ? 'oldest' : 'newest' }), 'Épisodes du plus ancien au plus récent')}
        />
        <Row to="/queue" icon={<ListMusic size={20} />} title="File d’attente" subtitle="Aussi accessible depuis la barre d’écoute" />
        <Row to="/fichiers" icon={<FolderOpen size={20} />} title="Mes fichiers" subtitle="Vos audios et vidéos importés" />
      </Group>

      <Group title="Prière">
        <Row to="/priere" icon={<Clock size={20} />} title="Horaires et adhan" subtitle={library.settings.prayer.place || 'Choisir sa ville'} />
        <Row to="/qibla" icon={<Compass size={20} />} title="Qibla" subtitle="Direction de la Kaaba" />
        <Row to="/ramadan" icon={<Moon size={20} />} title="Ramadan" subtitle="Compte à rebours, suhoor et iftar" />
      </Group>

      {notificationsSupported() && (
        <Group title="Notifications">
          <Row
            icon={<Bell size={20} />}
            title="Nouveaux épisodes"
            subtitle="Quand un podcast suivi publie un épisode"
            right={switchInput(library.settings.notifications, (v) => void toggleNotifications(v), 'Nouveaux épisodes')}
          />
          {notifyError && <p className="small error-text settings-note">{notifyError}</p>}
        </Group>
      )}

      <Group title="Appli">
        {!isStandalone() && <Row to="/telecharger" icon={<Monitor size={20} />} title="Télécharger l’appli" subtitle="iPhone, Android, Windows, Mac, Linux" />}
        <Row onClick={() => window.dispatchEvent(new Event(SHOW_WHATS_NEW_EVENT))} icon={<Sparkles size={20} />} title="Quoi de neuf ?" subtitle="Les dernières nouveautés" />
        {desktopVersion && <Row icon={<Monitor size={20} />} title="Version de l’appli" subtitle={desktopVersion} />}
      </Group>

      {(isModerator || isAdmin) && (
        <Group title="Équipe">
          {isModerator && <Row to="/moderation" icon={<ShieldCheck size={20} />} title="Modération" subtitle="Podcasts, récitations, signalements" />}
          {isAdmin && <Row to="/admin" icon={<Crown size={20} />} title="Administration" subtitle="Membres et rôles" />}
        </Group>
      )}

      <p className="small muted settings-about">
        Texte du Coran : édition Uthmani (Hafs) · Traductions : QuranEnc.com · Récitations : mp3quran.net. Podsal ne traduit ni n’explique le
        Coran lui-même.
      </p>

      {auth.userId && (
        <button className="btn settings-logout" onClick={() => void auth.signOut()}>
          <LogOut size={16} /> Déconnexion
        </button>
      )}
    </div>
  );
}
