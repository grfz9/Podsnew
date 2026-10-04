import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BookOpenText, Check, Clock, Compass, Copy, Download, EllipsisVertical, FolderOpen, Headphones, Mic, MonitorDown, MousePointerClick, PartyPopper, Settings, Share, ShieldCheck, Smartphone, SquarePlus, Sun, Terminal, WifiOff } from 'lucide-react';
import { AppMark } from '../components/Wordmark';
import { Tabs } from '../components/common';
import { desktopOs, DESKTOP_DOWNLOADS, detectPlatform, INSTALL_URL, iosBrowser, isInAppBrowser, isStandalone, useInstall, type DesktopOs } from '../lib/install';

const PERKS = ['Gratuite, sans publicité', '100 % islamique', 'Hors-ligne', 'Mises à jour automatiques'];

const FEATURES = [
  { icon: Headphones, title: 'Écouter le Coran', text: 'De nombreux récitateurs, des récitations anciennes, et les versets qui défilent avec la traduction pendant l’écoute.' },
  { icon: BookOpenText, title: 'Lire le Coran', text: '114 sourates en arabe avec la traduction officielle, marque-pages et reprise là où vous vous étiez arrêté.' },
  { icon: Sun, title: 'Un verset par jour', text: 'Un verset différent chaque jour, propre à chacun, à lire et à méditer.' },
  { icon: Clock, title: 'Prière', text: 'Les horaires pour votre ville, l’adhan de votre choix et la pause automatique de l’écoute.' },
  { icon: Mic, title: 'Podcasts vérifiés', text: 'Cours, rappels et khoutbas validés par une modération. Aucun autre contenu.' },
  { icon: WifiOff, title: 'Partout, même sans internet', text: 'Téléchargez vos sourates et épisodes. iPhone, Android, Windows, Mac et Linux.' },
];

type Target = 'ios' | 'android' | DesktopOs;
const TARGETS: { id: Target; label: string }[] = [
  { id: 'ios', label: 'iPhone' },
  { id: 'android', label: 'Android' },
  { id: 'windows', label: 'Windows' },
  { id: 'mac', label: 'Mac' },
  { id: 'linux', label: 'Linux' },
];

function Steps({ items }: { items: { icon: ReactNode; text: ReactNode }[] }) {
  return (
    <ol className="install-steps">
      {items.map((s, i) => (
        <li key={i}>
          <span className="install-steps__n">{i + 1}</span>
          <span className="install-steps__icon">{s.icon}</span>
          <span>{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

const STEPS: Record<Target, { icon: ReactNode; text: ReactNode }[]> = {
  ios: [
    { icon: <Compass size={18} />, text: <>Ouvrez <strong>podsal.com/telecharger</strong> dans <strong>Safari</strong>.</> },
    { icon: <Share size={18} />, text: <>Touchez le bouton <strong>Partager</strong>, en bas de l’écran (ou en haut sur iPad).</> },
    { icon: <SquarePlus size={18} />, text: <>Choisissez <strong>Sur l’écran d’accueil</strong> puis <strong>Ajouter</strong>.</> },
  ],
  android: [
    { icon: <Compass size={18} />, text: <>Ouvrez <strong>podsal.com/telecharger</strong> dans <strong>Chrome</strong>.</> },
    { icon: <EllipsisVertical size={18} />, text: <>Touchez le menu <strong>⋮</strong> en haut à droite.</> },
    { icon: <SquarePlus size={18} />, text: <>Choisissez <strong>Installer l’application</strong> (ou « Ajouter à l’écran d’accueil »).</> },
  ],
  windows: [
    { icon: <Download size={18} />, text: <>Téléchargez <strong>Podsal-Setup.exe</strong> et ouvrez-le.</> },
    { icon: <ShieldCheck size={18} />, text: <>Si Windows affiche « Windows a protégé votre ordinateur » : <strong>Informations complémentaires</strong> puis <strong>Exécuter quand même</strong>.</> },
    { icon: <MousePointerClick size={18} />, text: <>Podsal s’installe et s’ouvre, avec un raccourci sur le Bureau et dans le menu Démarrer.</> },
  ],
  mac: [
    { icon: <Download size={18} />, text: <>Téléchargez le fichier <strong>.dmg</strong> (puce Apple ou Intel : menu Pomme → <em>À propos de ce Mac</em>).</> },
    { icon: <FolderOpen size={18} />, text: <>Ouvrez-le et glissez <strong>Podsal</strong> dans le dossier <strong>Applications</strong>.</> },
    { icon: <Settings size={18} />, text: <>Au premier lancement, si macOS bloque Podsal : <strong>Réglages Système → Confidentialité et sécurité → Ouvrir quand même</strong>.</> },
  ],
  linux: [
    { icon: <Download size={18} />, text: <>Ubuntu, Debian, Mint : téléchargez le <strong>.deb</strong> et ouvrez-le pour l’installer.</> },
    { icon: <Terminal size={18} />, text: <>Ou dans un terminal : <code>sudo apt install ./Podsal-linux.deb</code></> },
    { icon: <MousePointerClick size={18} />, text: <>Autres distributions : <strong>.AppImage</strong>, à rendre exécutable (clic droit → Propriétés) puis à ouvrir.</> },
  ],
};

/** Page à partager (podsal.com/telecharger) : appli pour ordinateur à télécharger, installation sur téléphone. */
export function InstallPage() {
  const { mode, install } = useInstall();
  const here = detectPlatform();
  const os = desktopOs();
  const [target, setTarget] = useState<Target>(os ?? (here === 'desktop' ? 'windows' : here));
  const [installed, setInstalled] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const standalone = isStandalone();
  const inApp = isInAppBrowser();

  const share = async () => {
    const data = { title: 'Podsal', text: 'Podcasts, Coran et rappels dans une seule appli. Installe-la ici :', url: INSTALL_URL };
    try {
      if (navigator.share) return await navigator.share(data);
    } catch {
      return; // partage annulé
    }
    try {
      await navigator.clipboard.writeText(INSTALL_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiez ce lien :', INSTALL_URL);
    }
  };

  const onDownload = (system: DesktopOs) => {
    setTarget(system);
    setDownloading(true);
  };

  const desktopCta = os && (
    <div className="install-download">
      <div className="install-download__main">
        {DESKTOP_DOWNLOADS[os].files.map((f, i) => (
          <a key={f.url} href={f.url} className={`btn ${i === 0 ? 'btn--primary install-cta' : 'btn--outline install-cta install-cta--alt'}`} onClick={() => onDownload(os)}>
            <Download size={18} /> {i === 0 ? `Télécharger pour ${DESKTOP_DOWNLOADS[os].label}` : f.label}
            <small>{f.note}</small>
          </a>
        ))}
      </div>
      {downloading && (
        <p className="install-download__hint">
          Le téléchargement commence. Ouvrez ensuite le fichier : les étapes sont juste en dessous.
        </p>
      )}
      <p className="small muted install-download__others">
        Autres systèmes :{' '}
        {(Object.keys(DESKTOP_DOWNLOADS) as DesktopOs[])
          .filter((k) => k !== os)
          .flatMap((k) => DESKTOP_DOWNLOADS[k].files.map((f) => ({ ...f, system: k })))
          .map((f, i) => (
            <span key={f.url}>
              {i > 0 && ' · '}
              <a href={f.url} onClick={() => onDownload(f.system)}>
                {f.label}
              </a>
            </span>
          ))}
      </p>
      {mode === 'prompt' && (
        <button className="link-button small install-download__light" onClick={async () => setInstalled(await install())}>
          <MonitorDown size={14} /> Ou installer la version légère depuis le navigateur, sans téléchargement
        </button>
      )}
    </div>
  );

  return (
    <div className="page install-page">
      <header className="install-hero">
        <span className="install-hero__icon">
          <AppMark />
        </span>
        <h1>Télécharger Podsal</h1>
        <p className="muted">Podcasts, Coran et rappels, réunis dans une seule appli, sur ordinateur comme sur téléphone.</p>
        <ul className="install-perks">
          {PERKS.map((p) => (
            <li key={p}>
              <Check size={14} /> {p}
            </li>
          ))}
        </ul>

        {standalone || installed ? (
          <div className="install-done">
            <PartyPopper size={22} />
            <span>{standalone ? 'Podsal est déjà installée sur cet appareil.' : 'C’est fait ! Podsal est sur votre appareil.'}</span>
            <Link to="/" className="btn btn--primary btn--small">
              Ouvrir l’accueil
            </Link>
          </div>
        ) : os ? (
          desktopCta
        ) : mode === 'prompt' ? (
          <button className="btn btn--primary install-cta" onClick={async () => setInstalled(await install())}>
            <Smartphone size={18} /> Installer Podsal
          </button>
        ) : inApp ? (
          <p className="install-warn">
            Vous êtes dans le navigateur d’une autre appli : touchez <strong>⋯</strong> puis <strong>Ouvrir dans {here === 'ios' ? 'Safari' : 'le navigateur'}</strong>, puis suivez les étapes ci-dessous.
          </p>
        ) : here === 'ios' && iosBrowser() === 'other' ? (
          <p className="install-warn">
            Pour installer Podsal sur iPhone, ouvrez cette page dans <strong>Safari</strong>.
          </p>
        ) : null}
      </header>

      <section className="install-features" aria-label="Ce que contient Podsal">
        <h2>Tout ce qu’il faut, au même endroit</h2>
        <div className="install-features__grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="install-feature">
              <span className="install-feature__icon">
                <Icon size={20} />
              </span>
              <h3>{title}</h3>
              <p className="small muted">{text}</p>
            </article>
          ))}
        </div>
        <p className="small muted install-features__note">Une traduction ne rend le sens du Coran que de façon approchée : pour comprendre les versets, il est fortement conseillé de se tourner vers un savant.</p>
      </section>

      <section className="panel install-how">
        <h2 className="panel__title">Comment l’installer</h2>
        <Tabs tabs={TARGETS} value={target} onChange={setTarget} />
        <Steps items={STEPS[target]} />
        {(target === 'windows' || target === 'mac' || target === 'linux') && !(os === target && !standalone) && (
          <div className="install-files">
            {DESKTOP_DOWNLOADS[target].files.map((f) => (
              <a key={f.url} href={f.url} className="btn btn--outline btn--small" onClick={() => onDownload(target)}>
                <Download size={14} /> {f.label}
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="install-grid">
        {here === 'desktop' && (
          <section className="panel install-qr">
            <img src="./telecharger/qr.svg" alt={`QR code vers ${INSTALL_URL}`} width={148} height={148} />
            <div>
              <h2 className="panel__title">Sur votre téléphone</h2>
              <p className="small muted">Scannez ce code avec l’appareil photo de votre téléphone pour ouvrir cette page et installer Podsal.</p>
            </div>
          </section>
        )}
        <section className="panel install-share">
          <h2 className="panel__title">Partager Podsal</h2>
          <p className="small muted">Envoyez ce lien à vos proches : la page leur montre comment installer l’appli sur leur appareil.</p>
          <div className="install-link">
            <code>podsal.com/telecharger</code>
            <button className="btn btn--outline btn--small" onClick={() => void share()}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copié' : 'Partager le lien'}
            </button>
          </div>
        </section>
      </div>

      <p className="small muted install-stores">Bientôt sur l’App Store et Google Play. L’appli se met à jour toute seule.</p>
    </div>
  );
}
