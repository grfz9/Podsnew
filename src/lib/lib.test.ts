import { describe, expect, it } from 'vitest';
import type { DeviceStats, Episode, Podcast } from '../types';
import { addCompletion, addListening, emptyDeviceStats, streaks, summarize } from './stats';
import { mergeSynced, type SyncedData } from './sync';
import { buildDailyMix, recommendationSeeds } from './recommend';
import { buildOpml, matchFeed, normalizeFeedUrl, parseOpml } from './opml';
import { isMusicPodcast, primaryGenreId } from '../api/genres';
import {
  audioKey,
  findItem,
  mergeSegments,
  parseChaptersJson,
  parseFeed,
  parseTimestamp,
  parseTranscript,
  pickTranscript,
} from '../../supabase/functions/_shared/podcast';

const ep = (id: string, podcastId = 'p1', releaseDate = '2026-09-01T00:00:00Z'): Episode => ({
  id,
  podcastId,
  podcastTitle: `Podcast ${podcastId}`,
  title: `Épisode ${id}`,
  description: '',
  audioUrl: `https://cdn.example.com/${podcastId}/${id}.mp3`,
  duration: 1800,
  releaseDate,
  artwork: '',
});

const meta = { title: 'Podcast', artwork: '', genre: 'Histoire' };

describe('statistiques', () => {
  it('cumule le temps par jour, par podcast et par heure', () => {
    const at = new Date(2026, 8, 29, 20, 15);
    let s = addListening(emptyDeviceStats(), 'p1', meta, 120, at);
    s = addListening(s, 'p1', meta, 60, at);
    s = addListening(s, 'p2', { ...meta, genre: 'Sciences' }, 30, at);
    s = addCompletion(s, at);
    expect(s.days['2026-09-29']).toEqual({ s: 210, p: { p1: 180, p2: 30 }, c: 1 });
    expect(s.hours[20]).toBe(210);
  });

  it('résume une période sur plusieurs appareils', () => {
    const a = addListening(emptyDeviceStats(), 'p1', meta, 3600, new Date(2026, 0, 10, 8));
    const b = addListening(emptyDeviceStats(), 'p2', { ...meta, genre: 'Sciences' }, 7200, new Date(2026, 1, 3, 9));
    const old = addListening(emptyDeviceStats(), 'p1', meta, 500, new Date(2025, 5, 1, 9));
    const devices: Record<string, DeviceStats> = { a, b, old };
    const s = summarize(devices, { from: '2026-01-01', to: '2026-12-31' }, '2026-09-29');
    expect(s.totalSeconds).toBe(10800);
    expect(s.byMonth[0]).toBe(3600);
    expect(s.byMonth[1]).toBe(7200);
    expect(s.podcasts.map((p) => p.item.id)).toEqual(['p2', 'p1']);
    expect(s.genres[0]).toEqual({ item: 'Sciences', seconds: 7200 });
  });

  it('calcule la série en cours et le record', () => {
    const day = (s: number) => ({ s, p: {}, c: 0 });
    const days = { '2026-09-27': day(600), '2026-09-28': day(600), '2026-09-20': day(600), '2026-09-21': day(600), '2026-09-22': day(600), '2026-09-23': day(30) };
    expect(streaks(days, '2026-09-29')).toEqual({ current: 2, best: 3 });
    expect(streaks(days, '2026-09-28')).toEqual({ current: 2, best: 3 });
    expect(streaks(days, '2026-10-02').current).toBe(0);
  });
});

describe('synchronisation', () => {
  const base = (): SyncedData => ({
    subscriptions: [],
    savedEpisodes: [],
    history: [],
    clips: [],
    playlists: [],
    progress: {},
    stats: {},
    modified: { subscriptions: 0, savedEpisodes: 0, history: 0, clips: 0, playlists: 0 },
  });
  const pod = (id: string) => ({ id, title: id, author: '', artwork: '' }) as Podcast;

  it('réunit les listes à la première synchronisation', () => {
    const local = { ...base(), subscriptions: [pod('a'), pod('b')] };
    const remote = { ...base(), subscriptions: [pod('b'), pod('c')] };
    expect(mergeSynced(local, remote, true).subscriptions.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('garde la version la plus récente ensuite (suppressions comprises)', () => {
    const local = { ...base(), subscriptions: [pod('a')], modified: { ...base().modified, subscriptions: 200 } };
    const remote = { ...base(), subscriptions: [pod('a'), pod('b')], modified: { ...base().modified, subscriptions: 100 } };
    expect(mergeSynced(local, remote, false).subscriptions.map((p) => p.id)).toEqual(['a']);
    expect(mergeSynced({ ...local, modified: { ...local.modified, subscriptions: 50 } }, remote, false).subscriptions).toHaveLength(2);
  });

  it('fusionne progression par épisode et statistiques par appareil', () => {
    const local = {
      ...base(),
      progress: { e1: { position: 10, duration: 100, completed: false, updatedAt: 5 } },
      stats: { phone: { ...emptyDeviceStats(), updatedAt: 10 } },
    };
    const remote = {
      progress: { e1: { position: 50, duration: 100, completed: false, updatedAt: 9 }, e2: { position: 1, duration: 9, completed: false, updatedAt: 1 } },
      stats: { phone: { ...emptyDeviceStats(), updatedAt: 3 }, laptop: { ...emptyDeviceStats(), updatedAt: 4 } },
    };
    const merged = mergeSynced(local, remote, false);
    expect(merged.progress.e1.position).toBe(50);
    expect(Object.keys(merged.progress)).toEqual(['e1', 'e2']);
    expect(merged.stats.phone.updatedAt).toBe(10);
    expect(merged.stats.laptop).toBeDefined();
  });

  const prefs = (favorites: number[], updatedAt: number, translation = 'rashid') =>
    ({ quran: { translation, showArabic: true, favorites }, interests: ['quran'], episodeOrder: 'oldest', updatedAt }) as SyncedData['prefs'];

  it('retrouve les récitateurs favoris sur un nouvel appareil', () => {
    const merged = mergeSynced({ ...base(), prefs: prefs([], 0) }, { prefs: prefs([7, 12], 100) }, true);
    expect(merged.prefs?.quran.favorites).toEqual([7, 12]);
  });

  it('additionne les favoris à la première synchronisation, puis garde les plus récents', () => {
    expect(mergeSynced({ ...base(), prefs: prefs([1], 50) }, { prefs: prefs([2], 100) }, true).prefs?.quran.favorites.sort()).toEqual([1, 2]);
    const later = mergeSynced({ ...base(), prefs: prefs([1], 200, 'hamidullah') }, { prefs: prefs([1, 2], 100) }, false);
    expect(later.prefs?.quran.favorites).toEqual([1]);
    expect(later.prefs?.quran.translation).toBe('hamidullah');
  });
});

describe('mix du jour', () => {
  const subs = [
    ep('a1', 'A', '2026-09-28T00:00:00Z'),
    ep('a2', 'A', '2026-09-27T00:00:00Z'),
    ep('a3', 'A', '2026-09-26T00:00:00Z'),
    ep('b1', 'B', '2026-09-25T00:00:00Z'),
    ep('c1', 'C', '2026-09-20T00:00:00Z'),
  ];
  const discovery = [ep('d1', 'D'), ep('d2', 'D'), ep('e1', 'E'), ep('a9', 'A')];

  it('limite à 2 épisodes par podcast, ignore les épisodes écoutés et varie chaque jour', () => {
    const progress = { b1: { position: 1800, duration: 1800, completed: true, updatedAt: 0 } };
    const mix = buildDailyMix({ fromSubscriptions: subs, discovery, progress, date: '2026-09-29' });
    const ids = mix.map((e) => e.id).sort();
    expect(ids).toEqual(['a1', 'a2', 'c1', 'd1', 'e1']);
    expect(buildDailyMix({ fromSubscriptions: subs, discovery, progress, date: '2026-09-29' }).map((e) => e.id)).toEqual(mix.map((e) => e.id));
  });

  it('choisit des points de départ dans des catégories différentes', () => {
    const podcasts: Podcast[] = [
      { id: 'x', title: 'X', author: '', artwork: '', genreIds: ['1487'] },
      { id: 'y', title: 'Y', author: '', artwork: '', genreIds: ['1487'] },
      { id: 'z', title: 'Z', author: '', artwork: '', genreIds: ['1533'] },
    ];
    expect(recommendationSeeds({}, podcasts, 2).map((s) => [s.podcast.id, s.genreId])).toEqual([
      ['x', 1487],
      ['z', 1533],
    ]);
  });
});

describe('OPML', () => {
  const xml = `<?xml version="1.0"?><opml version="1.0"><body><outline text="Mes podcasts">
    <outline type="rss" text="Les Pieds sur terre" xmlUrl="https://radiofrance-podcast.net/podcast09/rss_10078.xml"/>
    <outline type="rss" title="Autre" xmlUrl="http://www.example.com/feed/"/>
    <outline type="rss" text="Doublon" xmlUrl="https://example.com/feed"/>
  </outline></body></opml>`;

  it('lit les flux sans doublons', () => {
    const feeds = parseOpml(xml);
    expect(feeds).toHaveLength(2);
    expect(feeds[1]).toEqual({ title: 'Autre', feedUrl: 'http://www.example.com/feed/' });
    expect(normalizeFeedUrl('HTTPS://www.Example.com/feed/')).toBe('example.com/feed');
  });

  it('associe par adresse de flux puis par titre, et exporte', () => {
    const candidates: Podcast[] = [
      { id: '1', title: 'Autre chose', author: '', artwork: '', feedUrl: 'https://example.com/feed' },
      { id: '2', title: 'Les Pieds sur terre', author: '', artwork: '' },
    ];
    const [pieds, autre] = parseOpml(xml);
    expect(matchFeed(autre, candidates)?.id).toBe('1');
    expect(matchFeed(pieds, candidates)?.id).toBe('2');
    const out = buildOpml([{ id: '1', title: 'A & B', author: '', artwork: '', feedUrl: 'https://x.org/rss?a=1&b=2' }]);
    expect(parseOpml(out)).toEqual([{ title: 'A & B', feedUrl: 'https://x.org/rss?a=1&b=2' }]);
  });
});

describe('flux RSS, chapitres et transcriptions', () => {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:psc="http://podlove.org/simple-chapters">
  <channel>
    <title>Mon podcast</title>
    <item>
      <title>Épisode 2</title>
      <guid isPermaLink="false">00123</guid>
      <enclosure url="https://tracking.example/redirect/cdn.example.com/show/ep2.mp3?x=1" length="1" type="audio/mpeg"/>
      <podcast:transcript url="https://example.com/ep2.html" type="text/html"/>
      <podcast:transcript url="https://example.com/ep2.vtt" type="text/vtt" language="fr"/>
      <podcast:chapters url="https://example.com/ep2.json" type="application/json+chapters"/>
    </item>
    <item>
      <title><![CDATA[Épisode 1 & fin]]></title>
      <guid>ep-1</guid>
      <enclosure url="https://cdn.example.com/show/ep1.mp3" length="1" type="audio/mpeg"/>
      <psc:chapters version="1.2"><psc:chapter start="00:00:00" title="Intro"/><psc:chapter start="00:05:30.500" title="Sujet"/></psc:chapters>
    </item>
  </channel>
</rss>`;

  it('lit les épisodes, transcriptions et chapitres du flux', () => {
    const feed = parseFeed(rss);
    expect(feed.title).toBe('Mon podcast');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0].guid).toBe('00123');
    expect(feed.items[0].transcripts).toHaveLength(2);
    expect(feed.items[0].chaptersUrl).toBe('https://example.com/ep2.json');
    expect(feed.items[1].title).toBe('Épisode 1 & fin');
    expect(feed.items[1].inlineChapters).toEqual([
      { start: 0, title: 'Intro', url: undefined, img: undefined },
      { start: 330.5, title: 'Sujet', url: undefined, img: undefined },
    ]);
  });

  it("retrouve l'épisode par guid, par fichier audio ou par titre", () => {
    const feed = parseFeed(rss);
    expect(findItem(feed, { guid: '00123', audioUrl: 'x', title: 'x' })?.title).toBe('Épisode 2');
    expect(findItem(feed, { audioUrl: 'https://other-cdn.net/show/ep2.mp3', title: 'x' })?.title).toBe('Épisode 2');
    expect(findItem(feed, { audioUrl: 'https://nope/a.mp3', title: 'épisode 1 & fin' })?.guid).toBe('ep-1');
    expect(audioKey('https://a.b/c/show/ep1.mp3?utm=1')).toBe('show/ep1.mp3');
  });

  it('préfère une transcription horodatée', () => {
    const feed = parseFeed(rss);
    expect(pickTranscript(feed.items[0].transcripts, 'fr')?.type).toBe('text/vtt');
  });

  it('lit les chapitres JSON', () => {
    expect(
      parseChaptersJson({ version: '1.2.0', chapters: [{ startTime: 60, title: 'B' }, { startTime: 0, title: 'A' }, { startTime: 90, title: 'caché', toc: false }] }),
    ).toEqual([
      { start: 0, end: undefined, title: 'A', url: undefined, img: undefined },
      { start: 60, end: undefined, title: 'B', url: undefined, img: undefined },
    ]);
    expect(parseChaptersJson(null)).toEqual([]);
  });

  it('lit les formats VTT, SRT, JSON et HTML', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Marie>Bonjour et bienvenue\n\n00:00:03.200 --> 00:00:05.000\n<v Marie>dans ce nouvel épisode.\n\n01:02.000 --> 01:04.000\n<v Paul>Merci !';
    expect(parseTranscript(vtt, 'text/vtt')).toEqual([
      { start: 1, end: 5, text: 'Bonjour et bienvenue dans ce nouvel épisode.', speaker: 'Marie' },
      { start: 62, end: 64, text: 'Merci !', speaker: 'Paul' },
    ]);
    const srt = '1\n00:00:01,500 --> 00:00:02,000\nPremière ligne.\n\n2\n00:00:02,500 --> 00:00:04,000\nDeuxième ligne.';
    expect(parseTranscript(srt, 'application/srt').map((s) => s.start)).toEqual([1.5, 2.5]);
    const json = JSON.stringify({ version: '1.0.0', segments: [{ speaker: 'A', startTime: 0, endTime: 2, body: 'Salut' }] });
    expect(parseTranscript(json, 'application/json')).toEqual([{ start: 0, end: 2, text: 'Salut', speaker: 'A' }]);
    expect(parseTranscript('<p>Un</p><p>Deux &amp; trois</p>', 'text/html')).toEqual([
      { start: -1, end: -1, text: 'Un' },
      { start: -1, end: -1, text: 'Deux & trois' },
    ]);
    expect(parseTimestamp('1:02:03.5')).toBe(3723.5);
  });

  it('regroupe les sous-titres courts mais coupe aux fins de phrase', () => {
    const merged = mergeSegments([
      { start: 0, end: 1, text: 'Un' },
      { start: 1, end: 2, text: 'deux.' },
      { start: 2, end: 3, text: 'Trois' },
    ]);
    expect(merged.map((s) => s.text)).toEqual(['Un deux.', 'Trois']);
  });
});

describe('pas de musique', () => {
  it('reconnaît les podcasts musicaux', () => {
    expect(isMusicPodcast({ genreIds: ['1310'] })).toBe(true);
    expect(isMusicPodcast({ genreIds: ['1524'] })).toBe(true);
    expect(isMusicPodcast({ genre: 'Musique' })).toBe(true);
    expect(isMusicPodcast({ genre: 'Music Commentary' })).toBe(true);
    expect(isMusicPodcast({ genre: 'Histoire', genreIds: ['1487'] })).toBe(false);
    expect(isMusicPodcast({ genre: 'Musicologie' })).toBe(false);
  });

  it("déduit la catégorie d'un podcast", () => {
    expect(primaryGenreId({ genreIds: ['26', '1487'] })).toBe(1487);
    expect(primaryGenreId({ genre: 'Sciences' })).toBe(1533);
    expect(primaryGenreId({})).toBeUndefined();
  });
});

describe('graphiques', async () => {
  const { niceMax } = await import('../components/BarChart');
  it('arrondit le maximum de l’axe à une valeur ronde', () => {
    expect([0, 1, 3, 7, 14, 16.7, 23, 45, 100, 170].map(niceMax)).toEqual([2, 2, 4, 8, 16, 20, 24, 50, 100, 200]);
  });
});
