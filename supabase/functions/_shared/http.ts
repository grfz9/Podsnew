import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Enveloppe commune : CORS, erreurs lisibles. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: 'Erreur interne du serveur.' }, 500);
    }
  });
}

/** Client avec la clé service : contourne la RLS, à n'utiliser que côté serveur. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Utilisateur connecté à l'origine de la requête (401 sinon). */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<{ id: string }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Connexion requise.');
  const { data } = await admin.auth.getUser(token);
  if (!data.user) throw new HttpError(401, 'Connexion requise.');
  return { id: data.user.id };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Requête invalide.');
  }
}
