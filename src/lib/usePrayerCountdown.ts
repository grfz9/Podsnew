import { useEffect, useState } from 'react';
import { formatClock, nextPrayer, PRAYER_NAMES } from './prayer';
import { useLibrary } from '../store/library';

export interface PrayerCountdown {
  name: string;
  at: string;
  left: string;
  soon: boolean;
}

/** Prochaine prière et temps restant, mis à jour chaque seconde (null sans ville réglée). */
export function usePrayerCountdown(): PrayerCountdown | null {
  const { settings } = useLibrary();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = nextPrayer(settings.prayer, now);
  if (!next) return null;
  const total = Math.max(0, Math.floor((next.time.getTime() - now.getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const left = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  return { name: PRAYER_NAMES[next.key], at: formatClock(next.time), left, soon: total < 15 * 60 };
}
