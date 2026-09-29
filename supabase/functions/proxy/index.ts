// Récupère un flux RSS, un fichier de chapitres ou une transcription pour le navigateur,
// quand l'hébergeur du podcast refuse les requêtes cross-origin. Réservé aux utilisateurs connectés.
import { adminClient, HttpError, json, readJson, requireUser, serve } from '../_shared/http.ts';
import { fetchText } from '../_shared/fetch.ts';

const ALLOWED_TYPES = /xml|rss|atom|json|text\/|subrip|srt|vtt/i;

serve(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
  await requireUser(req, adminClient());
  const { url } = await readJson<{ url?: string }>(req);
  if (typeof url !== 'string') throw new HttpError(400, 'Paramètre « url » manquant.');
  const { body, type } = await fetchText(url);
  if (type && !ALLOWED_TYPES.test(type)) throw new HttpError(415, 'Type de fichier non pris en charge.');
  return json({ body, type });
});
