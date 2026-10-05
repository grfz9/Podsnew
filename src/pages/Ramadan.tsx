import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Info, MapPin, Moon, Sunrise, Sunset } from 'lucide-react';
import { ReadingPlanCard } from '../components/ReadingPlan';
import { DailyVerse } from '../components/DailyVerse';
import { ramadanInfo } from '../lib/khatma';
import { formatClock, prayerTimes } from '../lib/prayer';
import { useLibrary } from '../store/library';

const longDate = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s).padStart(2, '0')} s`;
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** Suhoor (fin à l'heure du Fajr) et iftar (Maghrib) pour la ville réglée dans Prière. */
function FastTimes() {
  const now = useNow(1000);
  const { settings } = useLibrary();
  const today = prayerTimes(settings.prayer, now);
  if (!today) {
    return (
      <div className="fast-card fast-card--setup">
        <MapPin size={18} />
        <span>
          Indiquez votre ville dans <Link to="/priere" className="link">Prière</Link> pour afficher l’heure du suhoor et de l’iftar.
        </span>
      </div>
    );
  }
  const tomorrow = prayerTimes(settings.prayer, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))!;
  // Avant le Fajr : on attend la fin du suhoor ; avant le Maghrib : l'iftar ; après : le suhoor de demain.
  const next =
    now < today.fajr
      ? { label: 'Fin du suhoor', time: today.fajr, icon: Sunrise }
      : now < today.maghrib
        ? { label: 'Iftar', time: today.maghrib, icon: Sunset }
        : { label: 'Fin du suhoor', time: tomorrow.fajr, icon: Sunrise };
  const Icon = next.icon;
  return (
    <div className="fast-card">
      <div className="fast-card__next">
        <Icon size={22} />
        <span>
          <span className="small muted">{next.label} dans</span>
          <strong>{countdown(next.time.getTime() - now.getTime())}</strong>
          <span className="small muted">à {formatClock(next.time)}</span>
        </span>
      </div>
      <div className="fast-card__times">
        <span>
          <Sunrise size={15} /> Suhoor jusqu’à <strong>{formatClock(today.fajr)}</strong>
        </span>
        <span>
          <Sunset size={15} /> Iftar à <strong>{formatClock(today.maghrib)}</strong>
        </span>
      </div>
    </div>
  );
}

export function RamadanPage() {
  const info = ramadanInfo();
  return (
    <div className="page ramadan-page">
      <header className="ramadan-hero">
        <Moon size={34} />
        <h1>{info?.day ? `Ramadan ${info.year} · jour ${info.day}` : `Ramadan ${info?.year ?? ''}`}</h1>
        {info && !info.day && (
          <p>
            Commence dans <strong>{info.daysUntil} jour{info.daysUntil > 1 ? 's' : ''}</strong>, vers le {longDate(info.start)}.
          </p>
        )}
        {info?.day && <p>Fin prévue vers le {longDate(info.end)}.</p>}
        <p className="small muted ramadan-hero__note">
          <Info size={13} /> Dates estimées d’après le calendrier Umm al-Qura. Le début et la fin réels dépendent de l’observation du croissant :
          suivez l’annonce de votre mosquée ou des autorités religieuses de votre pays.
        </p>
      </header>

      {info?.day && <FastTimes />}
      <ReadingPlanCard />
      <DailyVerse />
    </div>
  );
}

/** Petite carte d'accueil : visible pendant le Ramadan et dans les 30 jours qui précèdent. */
export function RamadanTeaser() {
  const info = ramadanInfo();
  if (!info || (!info.day && info.daysUntil > 30)) return null;
  return (
    <Link to="/ramadan" className="ramadan-teaser">
      <Moon size={20} />
      <span>
        <strong>{info.day ? `Ramadan · jour ${info.day}` : `Ramadan dans ${info.daysUntil} jour${info.daysUntil > 1 ? 's' : ''}`}</strong>
        <span className="small muted">{info.day ? 'Suhoor, iftar et plan de lecture' : 'Préparez votre plan de lecture'}</span>
      </span>
    </Link>
  );
}
