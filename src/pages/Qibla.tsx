import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Compass, Info, LocateFixed, MapPin } from 'lucide-react';
import { angleDiff, cardinal, distanceToKaaba, qiblaBearing } from '../lib/qibla';
import { useLibrary } from '../store/library';

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Cap de l'appareil (0 = nord) d'après la boussole du téléphone :
 * iPhone (webkitCompassHeading, après autorisation), Android (deviceorientationabsolute).
 */
function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'asking' | 'on' | 'denied' | 'unavailable'>('idle');
  const smooth = useRef<number | null>(null);

  const listen = () => {
    const onEvent = (e: Event) => {
      const ev = e as OrientationEvent;
      let h: number | null = null;
      if (typeof ev.webkitCompassHeading === 'number') h = ev.webkitCompassHeading;
      else if (ev.absolute && typeof ev.alpha === 'number') h = 360 - ev.alpha;
      if (h === null) return;
      h = (h + (screen.orientation?.angle ?? 0) + 360) % 360;
      // Lissage léger : l'aiguille ne tremble pas.
      smooth.current = smooth.current === null ? h : (smooth.current + angleDiff(h, smooth.current) * 0.25 + 360) % 360;
      setHeading(smooth.current);
      setState('on');
    };
    const name = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(name, onEvent);
    // Pas de boussole (ordinateur) : rien n'arrive.
    setTimeout(() => setState((s) => (s === 'asking' || s === 'idle' ? 'unavailable' : s)), 2500);
    return () => window.removeEventListener(name, onEvent);
  };

  const start = async () => {
    setState('asking');
    const api = (window.DeviceOrientationEvent as unknown as PermissionApi) ?? {};
    if (typeof api.requestPermission === 'function') {
      try {
        if ((await api.requestPermission()) !== 'granted') return setState('denied');
      } catch {
        return setState('denied');
      }
    }
    listen();
  };

  return { heading, state, start };
}

export function QiblaPage() {
  const library = useLibrary();
  const p = library.settings.prayer;
  const [locError, setLocError] = useState<string | null>(null);
  const { heading, state, start } = useHeading();
  const hasPlace = p.latitude !== null && p.longitude !== null;
  const bearing = hasPlace ? qiblaBearing(p.latitude!, p.longitude!) : null;
  const facing = bearing !== null && heading !== null && Math.abs(angleDiff(bearing, heading)) <= 5;

  // Petite vibration quand on est face à la Qibla.
  const wasFacing = useRef(false);
  useEffect(() => {
    if (facing && !wasFacing.current) navigator.vibrate?.(60);
    wasFacing.current = facing;
  }, [facing]);

  const locate = () => {
    setLocError(null);
    if (!navigator.geolocation) return setLocError('La localisation n’est pas disponible sur cet appareil.');
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        library.setSettings({
          prayer: { ...library.settings.prayer, latitude: Number(pos.coords.latitude.toFixed(4)), longitude: Number(pos.coords.longitude.toFixed(4)), place: 'Ma position' },
        }),
      () => setLocError('Position refusée. Choisissez votre ville dans Prière.'),
      { timeout: 15_000 },
    );
  };

  // Rotation du cadran : le nord du cadran suit le vrai nord quand la boussole est active.
  const dialRotation = heading !== null ? -heading : 0;

  return (
    <div className="page qibla-page">
      <h1 className="page__title">Qibla</h1>

      {!hasPlace ? (
        <div className="panel qibla-setup">
          <MapPin size={20} />
          <p>Pour trouver la direction de la Qibla, Podsal a besoin de savoir où vous êtes.</p>
          <div className="row-actions">
            <button className="btn btn--primary btn--small" onClick={locate}>
              <LocateFixed size={15} /> Utiliser ma position
            </button>
            <Link to="/priere" className="btn btn--outline btn--small">
              Choisir ma ville
            </Link>
          </div>
          {locError && <p className="small error-text">{locError}</p>}
        </div>
      ) : (
        <>
          <div className={`qibla-dial ${facing ? 'is-facing' : ''}`} aria-hidden>
            <div className="qibla-dial__rose" style={{ transform: `rotate(${dialRotation}deg)` }}>
              {['N', 'E', 'S', 'O'].map((c, i) => (
                <span key={c} className={`qibla-dial__cardinal ${c === 'N' ? 'is-north' : ''}`} style={{ transform: `rotate(${i * 90}deg) translateY(-118px) rotate(${-i * 90 - dialRotation}deg)` }}>
                  {c}
                </span>
              ))}
              <div className="qibla-dial__needle" style={{ transform: `rotate(${bearing}deg)` }}>
                <span className="qibla-dial__kaaba" style={{ transform: `rotate(${-bearing! - dialRotation}deg)` }}>
                  🕋
                </span>
              </div>
            </div>
            <span className="qibla-dial__phone" />
          </div>

          <p className="qibla-info">
            {facing ? (
              <strong className="ok-text">Vous êtes face à la Qibla</strong>
            ) : (
              <>
                Qibla : <strong>{Math.round(bearing!)}°</strong> par rapport au nord ({cardinal(bearing!)})
              </>
            )}
          </p>
          <p className="small muted qibla-info">
            {p.place ? `${p.place} · ` : ''}
            {Math.round(distanceToKaaba(p.latitude!, p.longitude!)).toLocaleString('fr-FR')} km de la Kaaba
          </p>

          {state !== 'on' && (
            <div className="qibla-compass">
              {state === 'idle' && (
                <button className="btn btn--primary" onClick={() => void start()}>
                  <Compass size={16} /> Activer la boussole
                </button>
              )}
              {state === 'asking' && <p className="small muted">Recherche de la boussole…</p>}
              {state === 'denied' && (
                <p className="small error-text">
                  Accès à la boussole refusé. Sur iPhone, autorisez « Mouvement et orientation » dans Réglages → Safari ; sinon, dans les autorisations du navigateur.
                </p>
              )}
              {(state === 'unavailable' || state === 'denied') && (
                <p className="small muted">
                  Pas de boussole sur cet appareil : le cadran est orienté nord en haut. Tournez-vous de {Math.round(bearing!)}° depuis le nord, vers le {cardinal(bearing!)}.
                </p>
              )}
            </div>
          )}

          <p className="small muted qibla-tips">
            <Info size={13} /> Tenez le téléphone à plat, loin des objets métalliques et des aimants. Si la direction semble fausse, calibrez la boussole en
            décrivant un 8 avec le téléphone. En cas de doute, fiez-vous à la mosquée la plus proche.
          </p>
          <Link to="/priere" className="link small">
            Changer de ville
          </Link>
        </>
      )}
    </div>
  );
}
