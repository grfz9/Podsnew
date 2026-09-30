import { describe, expect, it } from 'vitest';
import { allowsEpisode, allowsPodcast, isReligiousContent, type PolicyState } from './policy';
import { episodePath, podcastPath } from './paths';
import { nextPrayer, prayerTimes } from './prayer';
import { SURAHS } from '../data/surahs';
import { ayahAt, BASMALA, parseMoshafName, parseSurahEpisodeId, stripBasmala, surahEpisode, type Moshaf } from '../api/quran';
import { monogram, starPath } from '../components/Cover';
import { isLocalId, isPublicationOutdated, mediaKindOf, titleFromName, toEpisode } from './localFiles';

const state = (validated: string[] = [], blocked: string[] = []): PolicyState => ({ validated: new Set(validated), blocked: new Set(blocked) });

describe('règles de contenu', () => {
  it('exclut musique, contenu explicite et religion non validée', () => {
    expect(allowsPodcast({ id: '1', genreIds: ['1487'] }, state())).toBe(true);
    expect(allowsPodcast({ id: '2', genreIds: ['1310'] }, state())).toBe(false);
    expect(allowsPodcast({ id: '3', genreIds: ['1487'], explicit: true }, state())).toBe(false);
    expect(allowsPodcast({ id: '4', genreIds: ['1439'] }, state())).toBe(false); // christianisme
    expect(allowsPodcast({ id: '5', genreIds: ['1440'] }, state())).toBe(false); // islam non validé
    expect(allowsPodcast({ id: '6', genre: 'Religion et spiritualité' }, state())).toBe(false);
  });

  it('accepte les podcasts islamiques validés et respecte les podcasts masqués', () => {
    expect(allowsPodcast({ id: '5', genreIds: ['1440'] }, state(['5']))).toBe(true);
    expect(allowsPodcast({ id: '1', genreIds: ['1487'] }, state([], ['1']))).toBe(false);
    expect(allowsPodcast({ id: 'quran-7' }, state())).toBe(true);
  });

  it('filtre aussi les épisodes et repère le contenu religieux', () => {
    expect(allowsEpisode({ podcastId: '9', genre: 'Histoire' }, state())).toBe(true);
    expect(allowsEpisode({ podcastId: '9', genre: 'Islam' }, state())).toBe(false);
    expect(allowsEpisode({ podcastId: '9', genre: 'Islam' }, state(['9']))).toBe(true);
    expect(allowsEpisode({ podcastId: '9', genre: 'Histoire', explicit: true }, state())).toBe(false);
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

describe('monogram', () => {
  it('prend les initiales des mots importants', () => {
    expect(monogram('Les Grosses Têtes')).toBe('GT');
    expect(monogram("L'After Foot")).toBe('AF');
    expect(monogram("C dans l'air")).toBe('CA');
    expect(monogram('Les Grandes Gueules')).toBe('GG');
    expect(monogram("L'Heure du Monde")).toBe('HM');
  });
  it('gère les titres d’un seul mot et les sous-titres', () => {
    expect(monogram('LEGEND')).toBe('Le');
    expect(monogram('HugoDécrypte - Actus du jour')).toBe('HD');
    expect(monogram('Small Talk - Konbini')).toBe('ST');
    expect(monogram('UNBX, le podcast tech')).toBe('UNBX');
    expect(monogram('')).toBe('•');
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
