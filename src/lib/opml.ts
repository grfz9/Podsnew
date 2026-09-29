import type { Podcast } from '../types';

export interface OpmlFeed {
  title: string;
  feedUrl: string;
}

/** Lit un fichier OPML (export d'abonnements d'une autre application de podcasts). */
export function parseOpml(xml: string): OpmlFeed[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error("Ce fichier n'est pas un OPML valide.");
  const feeds: OpmlFeed[] = [];
  const seen = new Set<string>();
  doc.querySelectorAll('outline').forEach((node) => {
    const feedUrl = node.getAttribute('xmlUrl') ?? node.getAttribute('xmlurl') ?? node.getAttribute('url');
    if (!feedUrl || seen.has(normalizeFeedUrl(feedUrl))) return;
    seen.add(normalizeFeedUrl(feedUrl));
    feeds.push({ title: (node.getAttribute('text') ?? node.getAttribute('title') ?? '').trim(), feedUrl: feedUrl.trim() });
  });
  return feeds;
}

/** Compare deux adresses de flux sans tenir compte du protocole, du « www » ni de la barre finale. */
export function normalizeFeedUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

/** Choisit, parmi les résultats de recherche, le podcast correspondant à un flux OPML. */
export function matchFeed(feed: OpmlFeed, candidates: Podcast[]): Podcast | undefined {
  const target = normalizeFeedUrl(feed.feedUrl);
  const byUrl = candidates.find((p) => p.feedUrl && normalizeFeedUrl(p.feedUrl) === target);
  if (byUrl) return byUrl;
  const title = feed.title.trim().toLowerCase();
  return title ? candidates.find((p) => p.title.trim().toLowerCase() === title) : undefined;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildOpml(podcasts: Podcast[], date: Date = new Date()): string {
  const outlines = podcasts
    .filter((p) => p.feedUrl)
    .map((p) => `      <outline type="rss" text="${escapeXml(p.title)}" title="${escapeXml(p.title)}" xmlUrl="${escapeXml(p.feedUrl!)}"/>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Abonnements Podsal</title>
    <dateCreated>${date.toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="Podcasts">
${outlines}
    </outline>
  </body>
</opml>
`;
}
