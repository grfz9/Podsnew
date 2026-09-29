import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Clock, LocateFixed, MapPin } from 'lucide-react';
import { CITIES, FIVE_PRAYERS, formatClock, formatCountdown, nextPrayer, PRAYER_METHODS, PRAYER_NAMES, prayerTimes, type PrayerKey } from '../lib/prayer';
import { useLibrary, type PrayerSettings } from '../store/library';
import { notificationsSupported, requestNotificationPermission } from '../lib/notifications';

/** Rafraîchit l'affichage chaque minute. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Carte « Prochaine prière » (accueil). */
export function PrayerCard() {
  const { settings } = useLibrary();
  const now = useMinuteClock();
  const p = settings.prayer;
  if (!p.enabled || p.latitude === null) {
    return (
      <Link to="/priere" className="prayer-card prayer-card--setup">
        <Clock size={20} />
        <span>
          <strong>Horaires de prière</strong>
          <span className="small muted">Indiquez votre ville pour afficher les horaires et mettre la lecture en pause à l'heure de la prière.</span>
        </span>
      </Link>
    );
  }
  const next = nextPrayer(p, now);
  const today = prayerTimes(p, now);
  if (!next || !today) return null;
  return (
    <Link to="/priere" className="prayer-card">
      <span className="prayer-card__next">
        <span className="small muted">Prochaine prière · {p.place}</span>
        <strong>
          {PRAYER_NAMES[next.key]} à {formatClock(next.time)}
        </strong>
        <span className="small muted">{formatCountdown(next.time.getTime() - now.getTime())}</span>
      </span>
      <span className="prayer-card__list">
        {FIVE_PRAYERS.map((k) => (
          <span key={k} className={`prayer-card__item ${k === next.key ? 'prayer-card__item--next' : ''}`}>
            <span className="small">{PRAYER_NAMES[k]}</span>
            <strong>{formatClock(today[k])}</strong>
          </span>
        ))}
      </span>
    </Link>
  );
}

export function PrayerPage() {
  const library = useLibrary();
  const p = library.settings.prayer;
  const now = useMinuteClock();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PrayerSettings>) => library.setSettings({ prayer: { ...p, ...patch } });

  const locate = () => {
    if (!navigator.geolocation) {
      setError('La géolocalisation n’est pas disponible : choisissez une ville.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ enabled: true, latitude: Number(pos.coords.latitude.toFixed(4)), longitude: Number(pos.coords.longitude.toFixed(4)), place: 'Ma position' });
        setLocating(false);
      },
      () => {
        setError('Position refusée ou indisponible : choisissez une ville.');
        setLocating(false);
      },
      { timeout: 15000, maximumAge: 24 * 3600 * 1000 },
    );
  };

  const toggleNotify = async (enabled: boolean) => {
    if (enabled && !(await requestNotificationPermission().catch(() => false))) {
      setError('Autorisez les notifications pour Podsal dans les réglages du navigateur ou du téléphone.');
      return;
    }
    set({ notify: enabled });
  };

  const today = p.enabled ? prayerTimes(p, now) : null;
  const next = p.enabled ? nextPrayer(p, now) : null;

  return (
    <div className="page">
      <h1 className="page__title">Horaires de prière</h1>

      {today && next && (
        <section className="prayer-today">
          <p className="muted">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {p.place}
          </p>
          <ul className="prayer-table">
            {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]).map((k) => (
              <li key={k} className={`prayer-row ${k === next.key ? 'prayer-row--next' : ''} ${k === 'sunrise' ? 'prayer-row--minor' : ''}`}>
                <span>{PRAYER_NAMES[k]}</span>
                <strong>{formatClock(today[k])}</strong>
                {k === next.key && <span className="small">{formatCountdown(next.time.getTime() - now.getTime())}</span>}
              </li>
            ))}
          </ul>
          <p className="small muted">Horaires calculés : vérifiez-les avec ceux de votre mosquée, qui peuvent différer de quelques minutes.</p>
        </section>
      )}

      <section className="settings">
        <h2>Lieu</h2>
        <div className="row-actions">
          <button className="btn btn--outline" onClick={locate} disabled={locating}>
            <LocateFixed size={16} /> {locating ? 'Localisation…' : 'Utiliser ma position'}
          </button>
          <label className="setting setting--inline">
            <MapPin size={16} />
            <select
              value={CITIES.find((c) => c.name === p.place)?.name ?? ''}
              onChange={(e) => {
                const city = CITIES.find((c) => c.name === e.target.value);
                if (city) set({ enabled: true, latitude: city.lat, longitude: city.lng, place: city.name });
              }}
              aria-label="Choisir une ville"
            >
              <option value="">Choisir une ville…</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {p.latitude !== null && (
          <p className="small muted">
            {p.place} ({p.latitude.toFixed(2)}, {p.longitude?.toFixed(2)})
          </p>
        )}
        {error && <p className="small error-text">{error}</p>}

        <h2>Calcul</h2>
        <label className="setting">
          <span>Méthode</span>
          <select value={p.method} onChange={(e) => set({ method: e.target.value as PrayerSettings['method'] })}>
            {PRAYER_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="setting">
          <span>Heure de Asr</span>
          <select value={p.madhab} onChange={(e) => set({ madhab: e.target.value as PrayerSettings['madhab'] })}>
            <option value="shafi">Ombre égale à l'objet (majorité des savants)</option>
            <option value="hanafi">Ombre égale au double de l'objet</option>
          </select>
        </label>

        <h2>Pendant l'écoute</h2>
        <label className="setting">
          <span>
            Mettre la lecture en pause à l'heure de la prière
            <span className="small muted"> — un message indique quelle prière est entrée</span>
          </span>
          <input type="checkbox" className="switch" checked={p.pauseAtAdhan} onChange={(e) => set({ pauseAtAdhan: e.target.checked })} />
        </label>
        {notificationsSupported() && (
          <label className="setting">
            <span>
              Notification à l'heure de chaque prière
              <span className="small muted"> — quand l'application est ouverte</span>
            </span>
            <input type="checkbox" className="switch" checked={p.notify} onChange={(e) => toggleNotify(e.target.checked)} />
          </label>
        )}
        <label className="setting">
          <span>Afficher les horaires</span>
          <input type="checkbox" className="switch" checked={p.enabled} disabled={p.latitude === null} onChange={(e) => set({ enabled: e.target.checked })} />
        </label>
      </section>
    </div>
  );
}
