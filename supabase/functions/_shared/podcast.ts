/**
 * Lecture des flux RSS de podcasts, des chapitres et des transcriptions.
 * Code sans dépendance au navigateur ni à Deno : utilisé à la fois par l'application
 * (src/lib/feed.ts) et par les fonctions Supabase (supabase/functions/*).
 */
import { XMLParser } from 'fast-xml-parser';

export interface TranscriptRef {
  url: string;
  type: string;
  language?: string;
}

export interface FeedItem {
  guid?: string;
  title: string;
  enclosureUrl?: string;
  pubDate?: string;
  description?: string;
  transcripts: TranscriptRef[];
  chaptersUrl?: string;
  /** Chapitres intégrés au flux (format Podlove Simple Chapters). */
  inlineChapters?: ParsedChapter[];
}

export interface ParsedFeed {
  title: string;
  description: string;
  items: FeedItem[];
}

export interface ParsedChapter {
  start: number;
  end?: number;
  title: string;
  url?: string;
  img?: string;
}

export interface ParsedSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

type Node = Record<string, unknown>;

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') return text((value as Node)['#text']);
  return '';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** "01:02:03.500", "02:03", "63.5" → secondes */
export function parseTimestamp(value: string): number {
  const clean = value.trim().replace(',', '.');
  if (!clean) return 0;
  const parts = clean.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function parseFeed(xml: string): ParsedFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false, // garde les guid tels quels (ex. « 00123 »)
    isArray: (name) => ['item', 'podcast:transcript', 'psc:chapter'].includes(name),
  });
  const doc = parser.parse(xml) as Node;
  const channel = ((doc.rss as Node | undefined)?.channel ?? {}) as Node;
  const items = asArray(channel.item as Node[] | undefined).map((item): FeedItem => {
    const enclosure = item.enclosure as Node | undefined;
    const chapters = item['podcast:chapters'] as Node | undefined;
    const psc = (item['psc:chapters'] as Node | undefined)?.['psc:chapter'] as Node[] | undefined;
    return {
      guid: text(item.guid) || undefined,
      title: text(item.title),
      enclosureUrl: (enclosure?.['@_url'] as string | undefined) ?? undefined,
      pubDate: text(item.pubDate) || undefined,
      description: text(item.description) || undefined,
      transcripts: asArray(item['podcast:transcript'] as Node[] | undefined)
        .filter((t) => typeof t['@_url'] === 'string')
        .map((t) => ({ url: t['@_url'] as string, type: String(t['@_type'] ?? ''), language: t['@_language'] as string | undefined })),
      chaptersUrl: (chapters?.['@_url'] as string | undefined) ?? undefined,
      inlineChapters: psc?.length
        ? psc.map((c) => ({
            start: parseTimestamp(String(c['@_start'] ?? '0')),
            title: String(c['@_title'] ?? ''),
            url: c['@_href'] as string | undefined,
            img: c['@_image'] as string | undefined,
          }))
        : undefined,
    };
  });
  return { title: text(channel.title), description: text(channel.description), items };
}

/** Normalise une URL audio pour comparer flux RSS et catalogue (sans paramètres ni préfixes de mesure d'audience). */
export function audioKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').filter(Boolean);
    return `${path.slice(-2).join('/')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Retrouve l'élément du flux correspondant à un épisode du catalogue. */
export function findItem(
  feed: ParsedFeed,
  episode: { guid?: string; audioUrl: string; title: string },
): FeedItem | undefined {
  if (episode.guid) {
    const byGuid = feed.items.find((i) => i.guid === episode.guid);
    if (byGuid) return byGuid;
  }
  const key = audioKey(episode.audioUrl);
  const byAudio = feed.items.find((i) => i.enclosureUrl && audioKey(i.enclosureUrl) === key);
  if (byAudio) return byAudio;
  const title = episode.title.trim().toLowerCase();
  return feed.items.find((i) => i.title.trim().toLowerCase() === title);
}

/* ---------- Chapitres (Podcasting 2.0, JSON) ---------- */

export function parseChaptersJson(json: unknown): ParsedChapter[] {
  const chapters = (json as { chapters?: Node[] } | null)?.chapters;
  if (!Array.isArray(chapters)) return [];
  const list = chapters
    .filter((c) => c.toc !== false && typeof c.startTime === 'number')
    .map((c) => ({
      start: c.startTime as number,
      end: typeof c.endTime === 'number' ? (c.endTime as number) : undefined,
      title: String(c.title ?? '').trim(),
      url: typeof c.url === 'string' ? c.url : undefined,
      img: typeof c.img === 'string' ? c.img : undefined,
    }))
    .filter((c) => c.title)
    .sort((a, b) => a.start - b.start);
  return list;
}

/* ---------- Transcriptions ---------- */

const TRANSCRIPT_PREFERENCE = ['json', 'vtt', 'srt', 'subrip', 'html', 'plain'];

/** Choisit la transcription la plus exploitable (horodatée de préférence). */
export function pickTranscript(refs: TranscriptRef[], language?: string): TranscriptRef | undefined {
  const rank = (t: TranscriptRef) => {
    const i = TRANSCRIPT_PREFERENCE.findIndex((p) => t.type.toLowerCase().includes(p));
    const langPenalty = language && t.language && !t.language.toLowerCase().startsWith(language) ? 10 : 0;
    return (i === -1 ? TRANSCRIPT_PREFERENCE.length : i) + langPenalty;
  };
  return [...refs].sort((a, b) => rank(a) - rank(b))[0];
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCues(body: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const blocks = body.replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const timeIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeIndex === -1) continue;
    const [from, to] = lines[timeIndex].split('-->');
    const raw = lines.slice(timeIndex + 1).join(' ');
    const voice = raw.match(/<v(?:\.[^\s>]+)?\s+([^>]+)>/);
    const content = stripTags(raw);
    if (!content) continue;
    segments.push({
      start: parseTimestamp(from.trim().split(/\s+/)[0]),
      end: parseTimestamp(to.trim().split(/\s+/)[0]),
      text: content,
      speaker: voice?.[1]?.trim(),
    });
  }
  return segments;
}

/** Regroupe les sous-titres très courts en phrases lisibles. */
export function mergeSegments(segments: ParsedSegment[], maxLength = 240): ParsedSegment[] {
  const out: ParsedSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    const sameSpeaker = last && (last.speaker ?? '') === (seg.speaker ?? '');
    const lastEnded = last && /[.!?…]["»)]?$/.test(last.text);
    if (last && sameSpeaker && !lastEnded && last.text.length + seg.text.length < maxLength && seg.start - last.end < 2) {
      last.text = `${last.text} ${seg.text}`;
      last.end = seg.end;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

export function parseTranscript(body: string, type: string): ParsedSegment[] {
  const t = type.toLowerCase();
  const trimmed = body.trim();
  if (t.includes('json') || trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { segments?: Node[] };
      const segments = (json.segments ?? [])
        .filter((s) => typeof s.body === 'string' && (s.body as string).trim())
        .map((s) => ({
          start: Number(s.startTime) || 0,
          end: Number(s.endTime) || Number(s.startTime) || 0,
          text: stripTags(s.body as string),
          speaker: typeof s.speaker === 'string' ? s.speaker : undefined,
        }));
      return mergeSegments(segments);
    } catch {
      return [];
    }
  }
  if (t.includes('vtt') || t.includes('srt') || t.includes('subrip') || trimmed.startsWith('WEBVTT') || /-->/.test(trimmed.slice(0, 500))) {
    return mergeSegments(parseCues(trimmed));
  }
  // HTML ou texte brut : pas d'horodatage, un segment par paragraphe.
  const paragraphs = t.includes('html')
    ? trimmed.split(/<\/p>|<br\s*\/?>/i).map(stripTags)
    : trimmed.split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim());
  return paragraphs.filter(Boolean).map((p) => ({ start: -1, end: -1, text: p }));
}

export function transcriptToText(segments: ParsedSegment[]): string {
  return segments.map((s) => (s.speaker ? `${s.speaker} : ${s.text}` : s.text)).join('\n');
}
