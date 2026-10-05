import { parseTajweed } from '../api/quranCom';
import { highlightFr, indexVerses, normalizeAr, normalizeFr, searchVerses } from './quranSearch';
import { angleDiff, cardinal, distanceToKaaba, qiblaBearing } from './qibla';
import { daysBetween, fromDay, hijriParts, indexOf, juzOf, pageOf, placeAt, TOTAL_PAGES, planStatus, portion, ramadanInfo, toDay, TOTAL_AYAHS } from './khatma';
import { frenchSpacing, wrapText } from './verseCard';
import { DAILY_VERSES, dailyVerse, today } from '../data/dailyVerses';
import { desktopOs, detectPlatform, iosBrowser, isInAppBrowser, isNewerVersion, manualDesktopVersion } from './install';
import { describe, expect, it } from 'vitest';
import { allowsEpisode, allowsPodcast, isReligiousContent, type PolicyState } from './policy';
import { episodePath, podcastPath } from './paths';
import { nextPrayer, prayerTimes } from './prayer';
import { SURAHS } from '../data/surahs';
import { ayahAt, stripNoteMarks, BASMALA, parseMoshafName, recitationToReciter, surahAudioUrl, parseSurahEpisodeId, stripBasmala, surahEpisode, type Moshaf } from '../api/quran';
import { starPath } from '../components/Cover';
import { parseSurahList, tracksFromLines, tracksFromPattern } from './recitationInput';
import { isLocalId, isPublicationOutdated, mediaKindOf, titleFromName, toEpisode } from './localFiles';

const state = (validated: string[] = [], blocked: string[] = []): PolicyState => ({ validated: new Set(validated), blocked: new Set(blocked) });

describe('règles de contenu (appli 100 % islamique)', () => {
  it('refuse tout podcast non validé par la modération, quel qu’il soit', () => {
    expect(allowsPodcast({ id: '1' }, state())).toBe(false); // podcast général
    expect(allowsPodcast({ id: 'c-abc' }, state())).toBe(false); // podcast du Studio non validé
    expect(allowsEpisode({ podcastId: '9' }, state())).toBe(false);
  });

  it('accepte le Coran et les podcasts islamiques validés, sauf s’ils sont masqués', () => {
    expect(allowsPodcast({ id: 'quran-7' }, state())).toBe(true);
    expect(allowsPodcast({ id: '5' }, state(['5']))).toBe(true);
    expect(allowsPodcast({ id: '5' }, state(['5'], ['5']))).toBe(false);
    expect(allowsEpisode({ podcastId: '9' }, state(['9']))).toBe(true);
    expect(allowsEpisode({ podcastId: 'quran-3' }, state())).toBe(true);
  });

  it('repère le contenu religieux', () => {
    expect(isReligiousContent('quran-3', state())).toBe(true);
    expect(isReligiousContent('9', state(['9']))).toBe(true);
    expect(isReligiousContent('1', state())).toBe(false);
  });
});

describe('Coran', () => {
  it('contient les 114 sourates et 6236 versets', () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((sum, s) => sum + s.ayahs, 0)).toBe(6236);
    expect(SURAHS[35]).toMatchObject({ number: 36, name: 'Ya-Sin', ayahs: 83 });
  });

  it('reconnaît la riwaya et le style', () => {
    expect(parseMoshafName("Rewayat Hafs A'n Assem - Murattal")).toEqual({ riwaya: 'Hafs ʿan ʿĀsim', style: 'Murattal' });
    expect(parseMoshafName("Rewayat Warsh A'n Nafi' - Mujawwad")).toEqual({ riwaya: 'Warsh ʿan Nāfiʿ', style: 'Mujawwad' });
    expect(parseMoshafName('حفص عن عاصم - مرتل').riwaya).toBe('Hafs ʿan ʿĀsim');
  });

  it('crée un épisode lisible et le lien de la sourate', () => {
    const moshaf: Moshaf = { id: 12, name: '', riwaya: 'Hafs ʿan ʿĀsim', style: 'Murattal', server: 'https://server.example/afs/', surahs: [1, 2] };
    const ep = surahEpisode({ id: 5, name: 'Récitateur' }, moshaf, 2);
    expect(ep.audioUrl).toBe('https://server.example/afs/002.mp3');
    expect(ep.podcastId).toBe('quran-5');
    expect(parseSurahEpisodeId(ep.id)).toEqual({ moshafId: 12, surah: 2 });
    expect(episodePath(ep)).toBe('/coran/5/2?m=12');
    expect(podcastPath('quran-5')).toBe('/coran/5');
    expect(podcastPath('123')).toBe('/podcast/123');
  });

  it('sépare la basmala du premier verset et situe le verset en cours', () => {
    expect(stripBasmala(2, 1, `${BASMALA} الٓمٓ`)).toBe('الٓمٓ');
    expect(stripBasmala(1, 1, BASMALA)).toBe(BASMALA);
    // Texte réel d'alquran.cloud (18:1) : shadda avant fatha, dans l'autre ordre que BASMALA.
    const api = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064e\u0647\u0650 \u0671\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650 \u0671\u0644\u0652\u062d\u064e\u0645\u0652\u062f\u064f';
    expect(stripBasmala(18, 1, api)).toBe('\u0671\u0644\u0652\u062d\u064e\u0645\u0652\u062f\u064f');
    const timings = [
      { ayah: 1, start: 0, end: 5 },
      { ayah: 2, start: 5, end: 9 },
    ];
    expect(ayahAt(timings, 6)).toBe(2);
    expect(ayahAt(timings, 12)).toBeNull();
  });
});

describe('horaires de prière', () => {
  const paris = { latitude: 48.8566, longitude: 2.3522, method: 'mwl' as const, madhab: 'shafi' as const };

  it('calcule des horaires dans le bon ordre', () => {
    const t = prayerTimes(paris, new Date(2026, 2, 15, 12))!;
    expect(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha).toBe(true);
    expect(t.dhuhr.getHours()).toBeGreaterThanOrEqual(11);
    expect(t.dhuhr.getHours()).toBeLessThanOrEqual(14);
  });

  it('retarde Asr selon le second avis et passe au Fajr du lendemain après Isha', () => {
    const day = new Date(2026, 2, 15, 12);
    const shafi = prayerTimes(paris, day)!;
    const hanafi = prayerTimes({ ...paris, madhab: 'hanafi' }, day)!;
    expect(hanafi.asr.getTime()).toBeGreaterThan(shafi.asr.getTime());
    const late = new Date(2026, 2, 15, 23, 50);
    const next = nextPrayer(paris, late)!;
    expect(next.key).toBe('fajr');
    expect(next.time.getDate()).toBe(16);
  });

  it('ne calcule rien sans lieu', () => {
    expect(prayerTimes({ ...paris, latitude: null })).toBeNull();
  });
});

describe('couvertures géométriques', () => {
  it('trace une étoile à huit branches fermée', () => {
    const d = starPath(50, 50, 10, 7);
    expect(d.startsWith('M50.00 40.00')).toBe(true);
    expect(d.split('L')).toHaveLength(16);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('numéros de téléphone', () => {
  it('convertit au format international', async () => {
    const { normalizePhone } = await import('../utils/phone');
    expect(normalizePhone('06 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('0032 470 12 34 56')).toBe('+32470123456');
    expect(normalizePhone('06.12.34.56.78')).toBe('+33612345678');
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('fichiers importés', () => {
  it('reconnaît les audios et les vidéos, par type ou par extension', () => {
    expect(mediaKindOf({ name: 'cours.mp3', type: 'audio/mpeg' })).toBe('audio');
    expect(mediaKindOf({ name: 'rappel.MP4', type: '' })).toBe('video');
    expect(mediaKindOf({ name: 'note.m4a', type: '' })).toBe('audio');
    expect(mediaKindOf({ name: 'photo.jpg', type: 'image/jpeg' })).toBeNull();
  });
  it('fait un titre lisible et renvoie vers « Mes fichiers »', () => {
    expect(titleFromName('cours_tafsir-01.mp3')).toBe('cours tafsir-01');
    expect(titleFromName('.mp3')).toBe('Fichier sans nom');
    const episode = toEpisode({ id: 'file-1', title: 'Cours', kind: 'video', mime: 'video/mp4', size: 10, duration: 60, createdAt: 0 });
    expect(isLocalId(episode.id)).toBe(true);
    expect(episode.mediaKind).toBe('video');
    expect(episodePath(episode)).toBe('/fichiers');
    expect(podcastPath(episode.podcastId)).toBe('/fichiers');
  });
});

describe('groupes de fichiers', () => {
  it('sait si la publication est à jour', () => {
    const base = { id: 'g', name: 'Tafsir', fileIds: [], createdAt: 1, updatedAt: 10 };
    expect(isPublicationOutdated(base)).toBe(false);
    expect(isPublicationOutdated({ ...base, remoteId: 'r', publishedAt: 12 })).toBe(false);
    expect(isPublicationOutdated({ ...base, remoteId: 'r', publishedAt: 5 })).toBe(true);
  });
  it('renvoie les fichiers d’un ami vers son profil', () => {
    expect(podcastPath('shared:ali_92')).toBe('/u/ali_92');
    expect(episodePath({ id: 'shared-1', podcastId: 'shared:ali_92' })).toBe('/u/ali_92');
  });
});

describe('récitations ajoutées par la modération', () => {
  it('lit une liste de sourates', () => {
    expect(parseSurahList('1-3, 18 36')).toEqual([1, 2, 3, 18, 36]);
    expect(parseSurahList('110-114, 200, 0, 114')).toEqual([110, 111, 112, 113, 114]);
  });
  it('applique un modèle d’adresse', () => {
    expect(tracksFromPattern('https://ex.org/{nnn}.mp3', [1, 18]).tracks).toEqual({ 1: 'https://ex.org/001.mp3', 18: 'https://ex.org/018.mp3' });
    expect(tracksFromPattern('https://ex.org/s{n}.mp3', [7]).tracks).toEqual({ 7: 'https://ex.org/s7.mp3' });
    expect(tracksFromPattern('http://ex.org/{nnn}.mp3', [1]).error).toBeTruthy();
    expect(tracksFromPattern('https://ex.org/a.mp3', [1]).error).toBeTruthy();
  });
  it('lit une liste de liens', () => {
    const r = tracksFromLines('18 https://ex.org/kahf.mp3\n36: https://ex.org/yasin.mp3\nabc\n200 https://x');
    expect(r.tracks).toEqual({ 18: 'https://ex.org/kahf.mp3', 36: 'https://ex.org/yasin.mp3' });
    expect(r.errors).toHaveLength(2);
  });
  it('transforme une ligne de la base en récitateur', () => {
    const r = recitationToReciter({ id: 3, reciter: 'Cheikh X', title: 'Le Caire, 1960', riwaya: 'Hafs ʿan ʿĀsim', style: 'Mujawwad', source: null, tracks: { '1': 'https://ex.org/1.mp3', '2': 'http://no' }, created_at: '' });
    expect(r.id).toBe(1_000_003);
    expect(r.moshaf[0].surahs).toEqual([1]);
    expect(surahAudioUrl(r.moshaf[0], 1)).toBe('https://ex.org/1.mp3');
  });
});

describe('page d’installation', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
  const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

  it('reconnaît l’appareil', () => {
    expect(detectPlatform(IPHONE)).toBe('ios');
    expect(detectPlatform(ANDROID)).toBe('android');
    expect(detectPlatform(WINDOWS)).toBe('desktop');
  });

  it('propose le bon fichier pour ordinateur', () => {
    expect(desktopOs(WINDOWS)).toBe('windows');
    expect(desktopOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15')).toBe('mac');
    expect(desktopOs('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBe('linux');
    expect(desktopOs('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBe(null);
    expect(desktopOs(ANDROID)).toBe(null);
    expect(desktopOs(IPHONE)).toBe(null);
  });

  it('compare les versions de l’appli pour ordinateur', () => {
    expect(isNewerVersion('1.2.0', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.2')).toBe(true);
    expect(isNewerVersion('1.2.0', '1.2.0')).toBe(false);
    expect(isNewerVersion('1.1.9', '1.2.0')).toBe(false);
  });

  it('ne propose le bandeau qu’aux applis qui ne se mettent pas à jour seules', () => {
    const w = window as Window & { podsalDesktop?: object };
    expect(manualDesktopVersion()).toBe(null); // site web
    w.podsalDesktop = { platform: 'win32' };
    expect(manualDesktopVersion()).toBe('1.0.0');
    w.podsalDesktop = { platform: 'win32', version: '1.3.0', autoUpdate: true };
    expect(manualDesktopVersion()).toBe(null);
    w.podsalDesktop = { platform: 'darwin', version: '1.3.0', autoUpdate: false };
    expect(manualDesktopVersion()).toBe('1.3.0');
    delete w.podsalDesktop;
  });

  it('repère les navigateurs où l’installation est impossible', () => {
    expect(isInAppBrowser(INSTAGRAM)).toBe(true);
    expect(isInAppBrowser(IPHONE)).toBe(false);
    expect(iosBrowser(IPHONE)).toBe('safari');
    expect(iosBrowser(IPHONE_CHROME)).toBe('other');
    expect(iosBrowser(INSTAGRAM)).toBe('other');
  });
});

describe('verset du jour', () => {
  it('ne propose que des versets qui existent', () => {
    for (const [surah, ayah] of DAILY_VERSES) {
      const s = SURAHS[surah - 1];
      expect(s, `${surah}:${ayah}`).toBeDefined();
      expect(ayah, `${surah}:${ayah}`).toBeGreaterThanOrEqual(1);
      expect(ayah, `${surah}:${ayah}`).toBeLessThanOrEqual(s.ayahs);
    }
  });

  it('garde le même verset toute la journée et varie selon la personne et le jour', () => {
    expect(dailyVerse('alice', '2026-10-04')).toEqual(dailyVerse('alice', '2026-10-04'));
    const days = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(dailyVerse('alice', `2026-11-${String(i + 1).padStart(2, '0')}`))));
    expect(days.size).toBeGreaterThan(15);
    const people = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((p) => JSON.stringify(dailyVerse(p, '2026-10-04'))));
    expect(people.size).toBeGreaterThan(3);
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('traduction sans commentaires', () => {
  it('retire les appels de note de la traduction', () => {
    expect(stripNoteMarks('Au nom d’Allah, le Tout Miséricordieux, le Très Miséricordieux.[1]')).toBe('Au nom d’Allah, le Tout Miséricordieux, le Très Miséricordieux.');
    expect(stripNoteMarks('Louange à Allah [2], Seigneur de l’univers.')).toBe('Louange à Allah, Seigneur de l’univers.');
  });
});

describe('carte image d’un verset', () => {
  it('garde la ponctuation française avec son mot et coupe aux espaces ordinaires', () => {
    expect(frenchSpacing('« Une facilité ! »')).toBe('«\u00A0Une facilité\u00A0!\u00A0»');
    const ctx = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };
    expect(wrapText(ctx, frenchSpacing('aaa bbb facilité !'), 120)).toEqual(['aaa bbb', 'facilité\u00A0!']);
  });
});

describe('plan de lecture et Ramadan', () => {
  it('découpe tout le Coran en portions sans trou ni chevauchement', () => {
    expect(placeAt(0)).toEqual({ surah: 1, ayah: 1 });
    expect(placeAt(7)).toEqual({ surah: 2, ayah: 1 });
    expect(placeAt(TOTAL_AYAHS - 1)).toEqual({ surah: 114, ayah: 6 });
    let total = 0;
    for (let d = 0; d < 30; d++) total += portion(30, d).ayahs;
    expect(total).toBe(TOTAL_AYAHS);
    expect(portion(30, 0).from).toEqual({ surah: 1, ayah: 1 });
    expect(portion(30, 29).to).toEqual({ surah: 114, ayah: 6 });
    // Découpage par pages du mushaf : 20 ou 21 pages par jour, le 1er jour finit avant le 2e juz (2:142).
    expect(portion(30, 0).pages).toEqual([1, 20]);
    expect(indexOf(portion(30, 0).to)).toBeLessThan(indexOf({ surah: 2, ayah: 142 }));
    for (let d = 0; d < 30; d++) {
      const [a, b] = portion(30, d).pages;
      expect(b - a + 1).toBeGreaterThanOrEqual(20);
      expect(b - a + 1).toBeLessThanOrEqual(21);
    }
    expect(TOTAL_PAGES).toBe(604);
  });

  it('suit les jours lus et le retard', () => {
    const plan = { start: '2026-10-01', days: 30, done: [0, 1], label: '30 jours' };
    const s = planStatus(plan, new Date(2026, 9, 5)); // 5e jour
    expect(s.today).toBe(4);
    expect(s.next).toBe(2);
    expect(s.due).toBe(3); // jours 3, 4 et 5 à lire pour être à jour
    expect(planStatus({ ...plan, done: Array.from({ length: 30 }, (_, i) => i) }).finished).toBe(true);
    expect(planStatus({ ...plan, start: '2026-12-01' }, new Date(2026, 9, 5)).started).toBe(false);
  });

  it('compte les jours sans être gêné par le changement d’heure', () => {
    expect(daysBetween(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
    expect(toDay(fromDay('2027-02-08'))).toBe('2027-02-08');
  });

  it('trouve le prochain Ramadan (calendrier Umm al-Qura)', () => {
    const info = ramadanInfo(new Date(2026, 9, 5));
    expect(info).not.toBeNull();
    expect(info!.day).toBeNull();
    expect(hijriParts(info!.start)).toMatchObject({ month: 9, day: 1 });
    expect(info!.daysUntil).toBeGreaterThan(100);
    expect(info!.daysUntil).toBeLessThan(160);
    const during = ramadanInfo(new Date(info!.start.getFullYear(), info!.start.getMonth(), info!.start.getDate() + 4));
    expect(during!.day).toBe(5);
    expect(during!.daysUntil).toBe(0);
  });
});

describe('Qibla', () => {
  it('donne la direction et la distance de la Kaaba', () => {
    const paris = qiblaBearing(48.8566, 2.3522);
    expect(paris).toBeGreaterThan(118);
    expect(paris).toBeLessThan(121);
    expect(cardinal(paris)).toBe('sud-est');
    expect(Math.round(distanceToKaaba(48.8566, 2.3522) / 100)).toBe(45); // environ 4 500 km
    const casablanca = qiblaBearing(33.5731, -7.5898);
    expect(casablanca).toBeGreaterThan(88);
    expect(casablanca).toBeLessThan(96); // presque plein est
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
  });
});

describe('recherche dans le Coran', () => {
  const index = indexVerses([
    { surah: 2, ayah: 153, arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ', french: 'Ô les croyants ! Cherchez secours dans l’endurance et la Salât.' },
    { surah: 103, ayah: 3, arabic: 'وَتَوَاصَوْا بِالصَّبْرِ', french: 'et s’enjoignent mutuellement l’endurance.' },
    { surah: 19, ayah: 16, arabic: 'وَاذْكُرْ فِي الْكِتَابِ مَرْيَمَ', french: 'Mentionne, dans le Livre, Marie.' },
  ]);

  it('ignore accents, majuscules et voyelles arabes', () => {
    expect(normalizeFr('L’Éte, DÉJÀ !')).toBe('l ete deja');
    expect(normalizeAr('بِالصَّبْرِ')).toBe('بالصبر');
    expect(searchVerses(index, 'ENDURANCE').total).toBe(2);
    expect(searchVerses(index, 'endur').total).toBe(2); // début de mot
    expect(searchVerses(index, 'secours endurance').results.map((v) => v.ayah)).toEqual([153]); // tous les mots
    expect(searchVerses(index, 'الصبر').total).toBe(2);
    expect(searchVerses(index, 'marie').results[0].surah).toBe(19);
    expect(searchVerses(index, 'x').total).toBe(0);
  });

  it('surligne les mots trouvés', () => {
    const parts = highlightFr('dans l’endurance et la Salât.', 'endurance');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['l’endurance']);
  });
});

describe('pages et juz du mushaf', () => {
  it('situe un verset dans le mushaf de Médine', () => {
    expect(pageOf({ surah: 1, ayah: 1 })).toBe(1);
    expect(pageOf({ surah: 2, ayah: 1 })).toBe(2);
    expect(pageOf({ surah: 114, ayah: 6 })).toBe(604);
    expect(juzOf({ surah: 2, ayah: 141 })).toBe(1);
    expect(juzOf({ surah: 2, ayah: 142 })).toBe(2);
    expect(juzOf({ surah: 18, ayah: 75 })).toBe(16);
    expect(juzOf({ surah: 78, ayah: 1 })).toBe(30);
  });
});

describe('tajwid (quran.com)', () => {
  it('découpe le texte en morceaux colorables sans garder de HTML', () => {
    const parts = parseTajweed('بِسْمِ <tajweed class=ham_wasl>ٱ</tajweed>للَّهِ <span class=end>١</span>');
    expect(parts).toEqual([{ text: 'بِسْمِ ' }, { text: 'ٱ', rule: 'ham_wasl' }, { text: 'للَّهِ' }]);
    expect(parseTajweed('<b>x</b>نص').map((p) => p.text).join('')).toBe('xنص');
  });
});
