import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Check, Compass, Copy, EllipsisVertical, Laptop, MonitorDown, PartyPopper, Share, Smartphone, SquarePlus } from 'lucide-react';
import { AppMark } from '../components/Wordmark';
import { Tabs } from '../components/common';
import { detectPlatform, INSTALL_URL, iosBrowser, isInAppBrowser, isStandalone, useInstall, type Platform } from '../lib/install';

const PERKS = ['Gratuite, sans publicité', 'Écoute écran éteint', 'Hors-ligne', 'Mises à jour automatiques'];

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

function IosSteps() {
  return (
    <Steps
      items={[
        { icon: <Compass size={18} />, text: <>Ouvrez <strong>podsal.com/telecharger</strong> dans <strong>Safari</strong>.</> },
        { icon: <Share size={18} />, text: <>Touchez le bouton <strong>Partager</strong>, en bas de l’écran (ou en haut sur iPad).</> },
        { icon: <SquarePlus size={18} />, text: <>Choisissez <strong>Sur l’écran d’accueil</strong> puis <strong>Ajouter</strong>.</> },
      ]}
    />
  );
}

function AndroidSteps() {
  return (
    <Steps
      items={[
        { icon: <Compass size={18} />, text: <>Ouvrez <strong>podsal.com/telecharger</strong> dans <strong>Chrome</strong>.</> },
        { icon: <EllipsisVertical size={18} />, text: <>Touchez le menu <strong>⋮</strong> en haut à droite.</> },
        { icon: <SquarePlus size={18} />, text: <>Choisissez <strong>Installer l’application</strong> (ou « Ajouter à l’écran d’accueil »).</> },
      ]}
    />
  );
}

function DesktopSteps() {
  return (
    <Steps
      items={[
        { icon: <Compass size={18} />, text: <>Ouvrez <strong>podsal.com</strong> dans <strong>Chrome</strong>, <strong>Edge</strong> ou <strong>Brave</strong>.</> },
        { icon: <MonitorDown size={18} />, text: <>Cliquez sur l’icône d’installation à droite de la barre d’adresse.</> },
        { icon: <Laptop size={18} />, text: <>Sur Mac avec Safari : menu <strong>Fichier → Ajouter au Dock</strong>.</> },
      ]}
    />
  );
}

/** Page à partager (podsal.com/telecharger) : installe Podsal sur l'appareil, avec les bonnes étapes selon le téléphone. */
export function InstallPage() {
  const { mode, install } = useInstall();
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform());
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const here = detectPlatform();
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

  return (
    <div className="page install-page">
      <header className="install-hero">
        <span className="install-hero__icon">
          <AppMark />
        </span>
        <h1>Installer Podsal</h1>
        <p className="muted">Podcasts, Coran et rappels, réunis dans une seule appli sur votre écran d’accueil.</p>
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

      <section className="panel install-how">
        <h2 className="panel__title">Comment l’installer</h2>
        <Tabs
          tabs={[
            { id: 'ios', label: 'iPhone / iPad' },
            { id: 'android', label: 'Android' },
            { id: 'desktop', label: 'Ordinateur' },
          ]}
          value={platform}
          onChange={setPlatform}
        />
        {platform === 'ios' ? <IosSteps /> : platform === 'android' ? <AndroidSteps /> : <DesktopSteps />}
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

      <p className="small muted install-stores">Bientôt sur l’App Store et Google Play. L’appli installée depuis ce lien se met à jour toute seule.</p>
    </div>
  );
}
