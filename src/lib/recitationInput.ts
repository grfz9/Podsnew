/**
 * Saisie d'une récitation par la modération : transforme un modèle d'adresse ou une liste de liens
 * en { sourate: adresse du fichier }. Seules les adresses https sont acceptées.
 */

/** « 1-114 », « 1-10, 18, 36 » → [1, …] (sans doublons, dans l'ordre, de 1 à 114). */
export function parseSurahList(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const range = part.match(/^(\d{1,3})-(\d{1,3})$/);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
      for (let n = Math.max(1, a); n <= Math.min(114, b); n++) out.add(n);
    } else if (/^\d{1,3}$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= 114) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** Modèle « https://…/{nnn}.mp3 » ({nnn} = 001, {nn} = 01, {n} = 1) appliqué aux sourates choisies. */
export function tracksFromPattern(pattern: string, surahs: number[]): { tracks: Record<number, string>; error?: string } {
  const p = pattern.trim();
  if (!p.startsWith('https://')) return { tracks: {}, error: 'L’adresse doit commencer par https://' };
  if (!/\{n{1,3}\}/.test(p)) return { tracks: {}, error: 'Indiquez où se trouve le numéro de sourate : {nnn} (001), {nn} (01) ou {n} (1).' };
  const tracks: Record<number, string> = {};
  for (const n of surahs) {
    tracks[n] = p.replace(/\{nnn\}/g, String(n).padStart(3, '0')).replace(/\{nn\}/g, String(n).padStart(2, '0')).replace(/\{n\}/g, String(n));
  }
  return { tracks };
}

/** Une ligne par sourate : « 18 https://…mp3 » (ou « 18 : https://… »). */
export function tracksFromLines(text: string): { tracks: Record<number, string>; errors: string[] } {
  const tracks: Record<number, string> = {};
  const errors: string[] = [];
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const m = line.match(/^(\d{1,3})\s*[:.\-–]?\s*(\S+)$/);
      const n = m ? Number(m[1]) : NaN;
      if (!m || n < 1 || n > 114) errors.push(`Ligne ${i + 1} : écrivez le numéro de la sourate puis le lien.`);
      else if (!m[2].startsWith('https://')) errors.push(`Ligne ${i + 1} : le lien doit commencer par https://`);
      else tracks[n] = m[2];
    });
  return { tracks, errors };
}
