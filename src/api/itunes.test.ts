import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPodcast, getTopPodcasts, mapEpisode, upscaleArtwork } from './itunes';

afterEach(() => vi.unstubAllGlobals());

function mockFetch(body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('itunes', () => {
  it('upscaleArtwork', () => {
    expect(upscaleArtwork('https://is1.mzstatic.com/a/b/100x100bb.jpg')).toBe('https://is1.mzstatic.com/a/b/600x600bb.jpg');
    expect(upscaleArtwork('https://x/170x170.png', 300)).toBe('https://x/300x300bb.png');
    expect(upscaleArtwork(undefined)).toBe('');
  });

  it("mapEpisode ignore les épisodes sans fichier audio", () => {
    expect(
      mapEpisode({ wrapperType: 'podcastEpisode', trackId: 1, trackName: 'x', collectionId: 2, collectionName: 'y', releaseDate: '' }),
    ).toBeNull();
  });

  it('getPodcast sépare le podcast de ses épisodes et les trie', async () => {
    const fetch = mockFetch({
      results: [
        { wrapperType: 'track', kind: 'podcast', collectionId: 42, collectionName: 'Mon podcast', artistName: 'Moi', artworkUrl600: 'art.jpg' },
        { wrapperType: 'podcastEpisode', trackId: 1, trackName: 'Ancien', collectionId: 42, collectionName: 'Mon podcast', episodeUrl: 'a.mp3', trackTimeMillis: 60000, releaseDate: '2024-01-01T00:00:00Z' },
        { wrapperType: 'podcastEpisode', trackId: 2, trackName: 'Récent', collectionId: 42, collectionName: 'Mon podcast', episodeUrl: 'b.mp3', releaseDate: '2025-01-01T00:00:00Z' },
      ],
    });
    const { podcast, episodes } = await getPodcast('42', 'fr');
    expect(fetch.mock.calls[0][0]).toContain('/lookup?id=42&entity=podcastEpisode');
    expect(podcast).toMatchObject({ id: '42', title: 'Mon podcast', author: 'Moi' });
    expect(episodes.map((e) => e.title)).toEqual(['Récent', 'Ancien']);
    expect(episodes[1]).toMatchObject({ duration: 60, artwork: 'art.jpg', podcastId: '42' });
  });

  it('getTopPodcasts gère une entrée unique', async () => {
    const fetch = mockFetch({
      feed: {
        entry: {
          id: { attributes: { 'im:id': '7' } },
          'im:name': { label: 'Top 1' },
          'im:artist': { label: 'Radio' },
          'im:image': [{ label: 'https://x/55x55bb.png' }, { label: 'https://x/170x170bb.png' }],
        },
      },
    });
    const top = await getTopPodcasts('fr', 1489, 10);
    expect(fetch.mock.calls[0][0]).toBe('https://itunes.apple.com/fr/rss/toppodcasts/limit=10/genre=1489/json');
    expect(top).toEqual([expect.objectContaining({ id: '7', title: 'Top 1', artwork: 'https://x/600x600bb.png' })]);
  });
});
