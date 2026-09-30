/**
 * Numéro de téléphone au format international (E.164), attendu par l'authentification par SMS.
 * « 06 12 34 56 78 » → « +33612345678 » ; « 0032 470 12 34 56 » → « +32470123456 ».
 * Renvoie null si le numéro n'est pas valide.
 */
export function normalizePhone(input: string, defaultCountryCode = '33'): string | null {
  let digits = input.trim().replace(/[\s.\-()/]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  else if (/^0\d{9}$/.test(digits)) digits = `+${defaultCountryCode}${digits.slice(1)}`;
  else if (/^\d+$/.test(digits)) digits = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
