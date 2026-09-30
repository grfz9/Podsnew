// Résumé automatique d'un épisode (points clés, thèmes, chapitres) avec Claude.
// Chaque épisode n'est résumé qu'une fois : le résultat est mis en cache dans « episode_summaries ».
import Anthropic from '@anthropic-ai/sdk';
import { adminClient, HttpError, json, readJson, requireUser, serve } from '../_shared/http.ts';
import { getOrIndexTranscript, loadEpisode } from '../_shared/episodes.ts';
import type { ParsedSegment } from '../_shared/podcast.ts';

const MODEL = 'claude-opus-5-5';
/** Nombre de nouveaux résumés qu'un utilisateur peut demander par 24 h (maîtrise des coûts). */
const DAILY_LIMIT_FREE = 3;
const DAILY_LIMIT_PREMIUM = 20;
/** Au-delà (≈ 350 000 jetons), on résume à partir de la description plutôt que de la transcription. */
const MAX_TRANSCRIPT_CHARS = 1_200_000;

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: "Résumé de l'épisode en 3 à 5 phrases." },
    keyPoints: { type: 'array', items: { type: 'string' }, description: 'Idées principales, 3 à 7 éléments.' },
    topics: { type: 'array', items: { type: 'string' }, description: 'Thèmes abordés, 2 à 6 mots-clés.' },
    chapters: {
      type: 'array',
      description: 'Découpage en parties. Vide si aucun horodatage n’est fourni.',
      items: {
        type: 'object',
        properties: {
          start: { type: 'number', description: 'Début de la partie, en secondes.' },
          title: { type: 'string' },
        },
        required: ['start', 'title'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'keyPoints', 'topics', 'chapters'],
  additionalProperties: false,
} as const;

const SYSTEM = `Tu résumes des épisodes de podcasts pour les auditeurs d'une application d'écoute.
Écris en français, même si l'épisode est dans une autre langue.
Ne rapporte que ce qui est dit dans le contenu fourni : n'invente ni faits, ni noms, ni chiffres, et ne donne pas ton avis.
Si seule une description est fournie, résume-la sans prétendre avoir écouté l'épisode, et laisse « chapters » vide.
Quand une transcription horodatée est fournie, propose 3 à 10 chapitres dont les débuts correspondent à des horodatages réels.`;

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function transcriptForPrompt(segments: ParsedSegment[]): { text: string; timed: boolean } {
  const timed = segments.some((s) => s.start > 0);
  const text = segments
    .map((s) => `${timed && s.start >= 0 ? `[${formatTime(s.start)} = ${Math.floor(s.start)} s] ` : ''}${s.speaker ? `${s.speaker} : ` : ''}${s.text}`)
    .join('\n');
  return { text, timed };
}

serve(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const { podcastId, episodeId, country } = await readJson<{ podcastId?: string; episodeId?: string; country?: string }>(req);
  if (!podcastId || !episodeId) throw new HttpError(400, 'Paramètres manquants.');

  // Pas de résumé automatique pour le Coran ni pour les podcasts islamiques validés.
  if (podcastId.startsWith('quran-')) throw new HttpError(422, 'Pas de résumé automatique pour le Coran.');
  const { data: religious } = await admin.from('islamic_podcasts').select('podcast_id').eq('podcast_id', podcastId).maybeSingle();
  if (religious) throw new HttpError(422, 'Pas de résumé automatique pour les contenus religieux.');

  const { data: cached } = await admin.from('episode_summaries').select('summary, source').eq('episode_id', episodeId).maybeSingle();
  if (cached) return json(cached);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('episode_summaries')
    .select('episode_id', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .gte('created_at', since);
  const { data: sub } = await admin.from('subscriptions').select('status, current_period_end').eq('user_id', user.id).maybeSingle();
  const premium = !!sub && ['active', 'trialing', 'past_due'].includes(sub.status) && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
  if ((count ?? 0) >= (premium ? DAILY_LIMIT_PREMIUM : DAILY_LIMIT_FREE)) {
    throw new HttpError(
      429,
      premium
        ? 'Limite de résumés atteinte pour aujourd’hui. Réessayez demain.'
        : `Limite de ${DAILY_LIMIT_FREE} résumés par jour atteinte. Podsal+ en offre ${DAILY_LIMIT_PREMIUM} par jour.`,
    );
  }

  const { podcast, episode } = await loadEpisode(admin, podcastId, episodeId, country);

  let segments: ParsedSegment[] | null = null;
  try {
    segments = await getOrIndexTranscript(admin, podcast, episode);
  } catch (error) {
    console.warn('Transcription indisponible :', error);
  }

  const transcript = segments?.length ? transcriptForPrompt(segments) : null;
  const useTranscript = !!transcript && transcript.text.length <= MAX_TRANSCRIPT_CHARS;
  const description = episode.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!useTranscript && description.length < 80) {
    throw new HttpError(422, 'Pas assez d’informations sur cet épisode pour en faire un résumé.');
  }

  const content = [
    `Podcast : ${episode.podcastTitle}`,
    `Épisode : ${episode.title}`,
    episode.duration ? `Durée : ${formatTime(episode.duration)}` : '',
    '',
    useTranscript
      ? `Transcription${transcript!.timed ? ' (chaque ligne commence par son horodatage)' : ''} :\n${transcript!.text}`
      : `Description publiée par l'éditeur :\n${description}`,
  ]
    .filter((line, i) => line || i === 3)
    .join('\n');

  if (!Deno.env.get('ANTHROPIC_API_KEY')) throw new HttpError(503, 'Les résumés ne sont pas activés sur ce serveur.');
  const client = new Anthropic(); // clé lue dans ANTHROPIC_API_KEY (secret de la fonction)
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Si un filtre de sécurité refuse à tort, la requête est rejouée sur le modèle de repli recommandé.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SUMMARY_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new HttpError(503, 'Service de résumé saturé, réessayez dans un instant.');
    if (error instanceof Anthropic.APIError) {
      console.error('Erreur API Claude', error.status, error.message);
      throw new HttpError(502, 'Le service de résumé est indisponible.');
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') throw new HttpError(422, 'Aucun résumé ne peut être proposé pour cet épisode.');
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'Résumé incomplet, réessayez.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new HttpError(502, 'Réponse inattendue du service de résumé.');

  const parsed = JSON.parse(text.text) as {
    summary: string;
    keyPoints: string[];
    topics: string[];
    chapters: { start: number; title: string }[];
  };
  const maxStart = episode.duration || Infinity;
  const summary = {
    summary: parsed.summary,
    keyPoints: parsed.keyPoints.slice(0, 10),
    topics: parsed.topics.slice(0, 8),
    chapters: useTranscript && transcript!.timed
      ? parsed.chapters.filter((c) => c.start >= 0 && c.start < maxStart).sort((a, b) => a.start - b.start).slice(0, 15)
      : [],
  };
  const source = useTranscript ? 'transcript' : 'description';

  await admin.from('episode_summaries').upsert(
    { episode_id: episodeId, podcast_id: podcastId, summary, source, model: response.model, requested_by: user.id },
    { onConflict: 'episode_id', ignoreDuplicates: true },
  );
  return json({ summary, source });
});
