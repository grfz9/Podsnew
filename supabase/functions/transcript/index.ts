// Renvoie la transcription d'un épisode (fournie par l'éditeur dans son flux RSS)
// et l'ajoute à l'index de recherche « dans quel épisode parle-t-on de… ».
import { adminClient, HttpError, json, readJson, requireUser, serve } from '../_shared/http.ts';
import { getOrIndexTranscript, loadEpisode } from '../_shared/episodes.ts';

serve(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
  const admin = adminClient();
  await requireUser(req, admin);
  const { podcastId, episodeId, country } = await readJson<{ podcastId?: string; episodeId?: string; country?: string }>(req);
  if (!podcastId || !episodeId) throw new HttpError(400, 'Paramètres manquants.');
  const { podcast, episode } = await loadEpisode(admin, podcastId, episodeId, country);
  const segments = await getOrIndexTranscript(admin, podcast, episode);
  return json({ segments });
});
