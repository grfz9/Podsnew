import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRssPodcast, isRssId, previewFeed, rssPodcastId } from './rss';
import { ISLAMIC_SEED } from '../data/islamicSeed';
import { parseFeed, rssEpisodeId } from '../../supabase/functions/_shared/podcast';
import { knownReciterRank, KNOWN_RECITERS, reciterMatches } from '../data/reciters';

const FEED = `<?xml version="1.0"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0"><channel>
  <title>Khoutbas</title>
  <description>Khoutbas du vendredi</description>
  <itunes:author>Imam Younes</itunes:author>
  <itunes:category text="Religion &amp; Spirituality"><itunes:category text="Islam"/></itunes:category>
  <item><title>Khoutba 2</title><guid>b</guid><pubDate>Fri, 12 Sep 2025 12:00:00 GMT</pubDate>
    <itunes:duration>12:30</itunes:duration><enclosure url="https://audio.test/2.mp3" type="audio/mpeg"/></item>
  <item><title>Khoutba 1</title><guid>a</guid><pubDate>Fri, 05 Sep 2025 12:00:00 GMT</pubDate>
    <itunes:explicit>no</itunes:explicit><enclosure url="https://audio.test/1.mp3" type="audio/mpeg"/></item>
  <item><title>Annonce sans audio</title><guid>c</guid></item>
</channel></rss>`;

afterEach(() => vi.unstubAllGlobals());

function stubFeed(xml: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) }));
}

describe('podcasts par flux RSS', () => {
  it('donne un identifiant stable, identique à celui de la liste de départ', () => {
    const seed = ISLAMIC_SEED.find((p) => p.feedUrl);
    expect(seed).toBeDefined();
    expect(rssPodcastId(seed!.feedUrl!)).toBe(seed!.id);
    expect(isRssId(seed!.id)).toBe(true);
    expect(rssPodcastId('https://a.test/feed.xml#x')).toBe(rssPodcastId('https://a.test/feed.xml'));
    expect(() => rssPodcastId('ftp://a.test/feed')).toThrow();
  });

  it('lit auteur, catégories, durée et marquage explicite', () => {
    const feed = parseFeed(FEED);
    expect(feed.author).toBe('Imam Younes');
    expect(feed.categories).toEqual(['Religion & Spirituality', 'Islam']);
    expect(feed.explicit).toBe(false);
    expect(feed.items[0].duration).toBe(750);
  });

  it('transforme le flux en podcast et épisodes (sans les éléments sans audio)', async () => {
    stubFeed(FEED);
    const { podcast, episodes } = await previewFeed('https://feeds.test/khoutbas.rss');
    expect(podcast.id).toBe(rssPodcastId('https://feeds.test/khoutbas.rss'));
    expect(podcast).toMatchObject({ title: 'Khoutbas', author: 'Imam Younes', feedUrl: 'https://feeds.test/khoutbas.rss', artwork: '' });
    expect(episodes.map((e) => e.title)).toEqual(['Khoutba 2', 'Khoutba 1']);
    expect(episodes[0]).toMatchObject({ podcastId: podcast.id, duration: 750, audioUrl: 'https://audio.test/2.mp3', id: rssEpisodeId({ guid: 'b' }) });
    // Une fois vérifié, le flux est connu : le podcast s'ouvre par son identifiant.
    const again = await getRssPodcast(podcast.id, 1);
    expect(again.episodes).toHaveLength(1);
  });

  it('refuse un flux sans épisode audio ou classé en musique', async () => {
    stubFeed('<rss><channel><title>Vide</title></channel></rss>');
    await expect(previewFeed('https://feeds.test/vide.rss')).rejects.toThrow(/aucun épisode/);
    stubFeed(FEED.replace('Religion &amp; Spirituality', 'Music'));
    await expect(previewFeed('https://feeds.test/musique.rss')).rejects.toThrow(/musique/);
  });
});

describe('récitateurs connus', () => {
  const label = (name: string) => KNOWN_RECITERS[knownReciterRank(name)]?.label;

  it('reconnaît les transcriptions usuelles', () => {
    expect(label('Mohammed Al-Lohaidan')).toBe('Muhammad al-Luhaidan');
    expect(label('محمد اللحيدان')).toBe('Muhammad al-Luhaidan');
    expect(label('Yasser Al-Dosari')).toBe('Yasser al-Dossary');
    expect(label('Maher Al Muaiqly')).toBe('Maher al-Muaiqly');
    expect(label('Ibrahim Al-Dosari')).toBeUndefined();
    expect(label('Nabil Ar-Rifai')).toBeUndefined();
  });

  it('place al-Luhaidan en tête et tolère les variantes dans la recherche', () => {
    expect(knownReciterRank('Mohammed Al-Lohaidan')).toBe(0);
    expect(reciterMatches('Mohammed Al-Lohaidan', 'luhaidan')).toBe(true);
    expect(reciterMatches('Mohammed Al-Lohaidan', 'Al Lohaidan')).toBe(true);
    expect(reciterMatches('Maher Al Muaiqly', 'luhaidan')).toBe(false);
  });
});
