/**
 * Versets proposés comme « verset du jour » : des versets connus, porteurs de sens seuls
 * (rappel, invocation, espoir, patience), pour éviter un passage sorti de son contexte.
 * [sourate, verset]
 */
export const DAILY_VERSES: [number, number][] = [
  [1, 5], [2, 45], [2, 152], [2, 153], [2, 156], [2, 186], [2, 201], [2, 216], [2, 255], [2, 286],
  [3, 8], [3, 26], [3, 139], [3, 159], [3, 173], [3, 190], [3, 200], [6, 162], [7, 23], [7, 56],
  [9, 51], [10, 62], [12, 87], [13, 11], [13, 28], [14, 7], [16, 97], [16, 128], [17, 24], [17, 82],
  [18, 10], [20, 114], [21, 87], [23, 1], [25, 74], [28, 24], [29, 45], [29, 69], [31, 17], [33, 41],
  [39, 53], [40, 60], [41, 34], [49, 13], [50, 16], [51, 56], [52, 48], [55, 13], [59, 22], [64, 11],
  [65, 2], [65, 3], [67, 2], [93, 5], [94, 5], [94, 6], [3, 185], [112, 1],
];

/** Petit hachage stable (FNV-1a) : même verset toute la journée pour une personne, différent d'une personne à l'autre. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Verset du jour pour une personne (identifiant du compte, sinon de l'appareil) à une date « AAAA-MM-JJ ». */
export function dailyVerse(personId: string, day: string): { surah: number; ayah: number } {
  const [surah, ayah] = DAILY_VERSES[hash(`${personId}|${day}`) % DAILY_VERSES.length];
  return { surah, ayah };
}

/** Date locale du jour au format AAAA-MM-JJ. */
export function today(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
