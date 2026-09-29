/**
 * Récitateurs connus, mis en avant sur la page Coran.
 * Les récitations viennent de mp3quran.net : on reconnaît chaque récitateur à son nom
 * (plusieurs transcriptions possibles, et en arabe), puisque l'API ne fournit pas d'autre repère stable.
 * Les alias servent aussi à la recherche (« luhaidan » trouve « Mohammed Al-Lohaidan »).
 */
export interface KnownReciter {
  label: string;
  pattern: RegExp;
  aliases: string[];
}

export const KNOWN_RECITERS: KnownReciter[] = [
  { label: 'Muhammad al-Luhaidan', pattern: /l[oue]u?h[ae][iy]?[dt]h?an|اللحيدان/i, aliases: ['luhaidan', 'lohaidan', 'lehaidan', 'lhdan', 'اللحيدان'] },
  { label: 'Yasser al-Dossary', pattern: /yass?[ei]r.*(d[ao]w?ss?a?r[iy])|ياسر الدوسري/i, aliases: ['dossary', 'dosari', 'dossari', 'dawsari', 'الدوسري'] },
  { label: 'Abdul Rahman al-Sudais', pattern: /s[ou]u?da[ie]s|السديس/i, aliases: ['sudais', 'soudais', 'السديس'] },
  { label: 'Saud al-Shuraim', pattern: /sh?[ou]u?ra[iy]m|chouraim|shurem|الشريم/i, aliases: ['shuraim', 'shureim', 'chouraim', 'الشريم'] },
  { label: 'Maher al-Muaiqly', pattern: /m[ou]e?a?i?qu?l[iy]|المعيقلي/i, aliases: ['muaiqly', 'muaiqli', 'mueaqly', 'المعيقلي'] },
  { label: 'Ali al-Hudhaify', pattern: /h[ou]u?[dt]h?aif[iy]|الحذيفي/i, aliases: ['hudhaify', 'huthaifi', 'houdhaifi', 'الحذيفي'] },
  { label: 'Salah al-Budair', pattern: /b[ou]u?dair|البدير/i, aliases: ['budair', 'boudair', 'البدير'] },
  { label: 'Abdullah al-Juhany', pattern: /j[ou]u?han[iy]|الجهني/i, aliases: ['juhany', 'juhani', 'jouhani', 'الجهني'] },
  { label: 'Khalid al-Jalil', pattern: /khalid.*j[aei]l[ie]e?l|خالد الجليل/i, aliases: ['jalil', 'jaleel', 'الجليل'] },
  { label: 'Bandar Baleela', pattern: /bal[ie]e?la|بليلة/i, aliases: ['baleela', 'balila', 'بليلة'] },
  { label: 'Mishary Alafasy', pattern: /[ae]l?[- ]?[ae]fa?ss?[iy]|العفاسي/i, aliases: ['afasy', 'afassi', 'alafasy', 'العفاسي'] },
  { label: 'Saad al-Ghamdi', pattern: /gh?am[ie]?di|الغامدي/i, aliases: ['ghamdi', 'ghamidi', 'الغامدي'] },
  { label: 'Abu Bakr al-Shatri', pattern: /sh?atri|chatri|الشاطري/i, aliases: ['shatri', 'chatri', 'الشاطري'] },
  { label: 'Nasser al-Qatami', pattern: /[qk]atami|القطامي/i, aliases: ['qatami', 'katami', 'القطامي'] },
  { label: 'Ahmed al-Ajmi', pattern: /[ae]jm[iy]|ajami|العجمي/i, aliases: ['ajmi', 'ajami', 'العجمي'] },
  { label: 'Idris Abkar', pattern: /abk[ae]?r|أبكر/i, aliases: ['abkar', 'أبكر'] },
  { label: 'Ali Jaber', pattern: /ali ja?ab[ei]r|علي جابر/i, aliases: ['jaber', 'jabir', 'علي جابر'] },
  { label: 'Fares Abbad', pattern: /fa?res abb?ad|فارس عباد/i, aliases: ['abbad', 'فارس عباد'] },
  { label: 'Hani ar-Rifai', pattern: /hani.*ri?fa['ʿ]?[iy]|هاني الرفاعي/i, aliases: ['rifai', 'rifaai', 'الرفاعي'] },
  { label: 'Muhammad Ayyub', pattern: /m[ou]h?amm?[ae]d ay+[ou]u?b|محمد أيوب/i, aliases: ['ayyub', 'ayoub', 'أيوب'] },
  { label: 'Abdullah Basfar', pattern: /basfar|بصفر/i, aliases: ['basfar', 'بصفر'] },
  { label: 'Salah Bukhatir', pattern: /b[ou]u?khat[ie]r|بو ?خاطر/i, aliases: ['bukhatir', 'boukhatir', 'بوخاطر'] },
  { label: 'Abdul Basit Abdul Samad', pattern: /abd?[ue]?l?[- ]?bass?[ie]t|عبد ?الباسط/i, aliases: ['abdulbasit', 'abdelbasset', 'عبدالباسط'] },
  { label: 'Mahmoud Khalil al-Husary', pattern: /h[ou]u?ss?ar[iy]|الحصري/i, aliases: ['husary', 'hussary', 'houssary', 'الحصري'] },
  { label: 'Muhammad Siddiq al-Minshawi', pattern: /minsh?awi|المنشاوي/i, aliases: ['minshawi', 'minchaoui', 'المنشاوي'] },
];

/** Minuscules, sans accents ni ponctuation (« Al-Lohaidan » → « allohaidan »). */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٟ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, '');
}

/** Rang d'un récitateur dans la liste des récitateurs connus (-1 s'il n'y figure pas). */
export function knownReciterRank(name: string): number {
  return KNOWN_RECITERS.findIndex((k) => k.pattern.test(name));
}

/** Recherche tolérante : nom normalisé, ou alias du récitateur connu correspondant. */
export function reciterMatches(name: string, query: string): boolean {
  const q = normalizeName(query);
  if (!q) return true;
  if (normalizeName(name).includes(q)) return true;
  const known = KNOWN_RECITERS[knownReciterRank(name)];
  return !!known && known.aliases.some((alias) => normalizeName(alias).includes(q) || q.includes(normalizeName(alias)));
}
