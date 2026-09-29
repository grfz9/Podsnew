// Flux RSS public d'un podcast publié sur Podsnew : à soumettre à Apple Podcasts, Spotify, Deezer…
// GET /functions/v1/rss?podcast=<uuid>   (vérification JWT désactivée dans supabase/config.toml)
import { adminClient, corsHeaders, HttpError, json } from '../_shared/http.ts';

/** Noms de catégories attendus par Apple Podcasts (en anglais). */
const APPLE_CATEGORIES: Record<number, string> = {
  1489: 'News',
  1303: 'Comedy',
  1324: 'Society &amp; Culture',
  1487: 'History',
  1488: 'True Crime',
  1533: 'Science',
  1318: 'Technology',
  1321: 'Business',
  1304: 'Education',
  1545: 'Sports',
  1512: 'Health &amp; Fitness',
  1301: 'Arts',
  1483: 'Fiction',
  1309: 'TV &amp; Film',
  1305: 'Kids &amp; Family',
  1502: 'Leisure',
  1314: 'Religion &amp; Spirituality',
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const id = new URL(req.url).searchParams.get('podcast') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Paramètre « podcast » invalide.');
    const admin = adminClient();
    const { data: podcast } = await admin.from('creator_podcasts').select('*').eq('id', id).maybeSingle();
    if (!podcast) throw new HttpError(404, 'Podcast introuvable.');
    const { data: episodes } = await admin
      .from('creator_episodes')
      .select('*')
      .eq('podcast_id', id)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });

    const selfUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/rss?podcast=${id}`;
    const category = APPLE_CATEGORIES[podcast.category_id as number];
    const items = (episodes ?? [])
      .map(
        (e) => `    <item>
      <title>${esc(e.title)}</title>
      <description>${esc(e.description)}</description>
      <guid isPermaLink="false">${e.id}</guid>
      <pubDate>${new Date(e.published_at).toUTCString()}</pubDate>
      <enclosure url="${esc(e.audio_url)}" length="${e.audio_size}" type="${esc(e.audio_type)}"/>
      <itunes:duration>${duration(e.duration)}</itunes:duration>
      <itunes:explicit>${podcast.explicit ? 'true' : 'false'}</itunes:explicit>
    </item>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>${esc(podcast.title)}</title>
    <description>${esc(podcast.description)}</description>
    <language>${esc(podcast.language)}</language>
    <atom:link href="${esc(selfUrl)}" rel="self" type="application/rss+xml"/>
    <itunes:author>${esc(podcast.author)}</itunes:author>
    <itunes:explicit>${podcast.explicit ? 'true' : 'false'}</itunes:explicit>
    ${podcast.cover_url ? `<itunes:image href="${esc(podcast.cover_url)}"/>` : ''}
    ${category ? `<itunes:category text="${category}"/>` : ''}
    ${podcast.contact_email ? `<itunes:owner><itunes:name>${esc(podcast.author)}</itunes:name><itunes:email>${esc(podcast.contact_email)}</itunes:email></itunes:owner>` : ''}
    <podcast:guid>${id}</podcast:guid>
${items}
  </channel>
</rss>`;
    return new Response(xml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: 'Erreur interne du serveur.' }, 500);
  }
});
