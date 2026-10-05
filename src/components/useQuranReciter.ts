import { useMemo } from 'react';
import { getReciters, getTimedReads, type Moshaf, type Reciter } from '../api/quran';
import { knownReciterRank } from '../data/reciters';
import { isQuranId, QURAN_PREFIX } from '../lib/policy';
import { useLibrary } from '../store/library';
import { useAsync } from '../utils/hooks';

/**
 * Récitateur proposé pour écouter une sourate en lisant : le dernier écouté s'il a une récitation
 * minutée verset par verset (surlignage et répétition possibles), sinon le premier récitateur connu qui en a une.
 */
export function useQuranReciter(surah: number): { reciter: Reciter; moshaf: Moshaf } | null {
  const library = useLibrary();
  const lastReciter = library.history.find((e) => isQuranId(e.podcastId))?.podcastId.slice(QURAN_PREFIX.length);
  const data = useAsync(() => Promise.all([getReciters(), getTimedReads()]), []);
  return useMemo(() => {
    if (!data.data) return null;
    const [all, timed] = data.data;
    const ranked = all
      .map((r) => ({ r, rank: knownReciterRank(r.name) }))
      .filter((x) => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.r);
    for (const r of [...all.filter((x) => String(x.id) === lastReciter), ...ranked]) {
      const m = r.moshaf.find((mo) => timed.has(mo.id) && mo.surahs.includes(surah));
      if (m) return { reciter: r, moshaf: m };
    }
    return null;
  }, [data.data, lastReciter, surah]);
}
