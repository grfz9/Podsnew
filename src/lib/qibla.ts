/** Direction de la Qibla (Kaaba, La Mecque) : cap initial du plus court chemin sur la sphère terrestre. */
export const KAABA = { lat: 21.422487, lng: 39.826206 };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Cap vers la Kaaba, en degrés depuis le nord géographique, dans le sens des aiguilles d'une montre (0 à 360). */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = rad(lat);
  const φ2 = rad(KAABA.lat);
  const Δλ = rad(KAABA.lng - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Distance jusqu'à la Kaaba en kilomètres (formule de haversine). */
export function distanceToKaaba(lat: number, lng: number): number {
  const R = 6371;
  const dφ = rad(KAABA.lat - lat);
  const dλ = rad(KAABA.lng - lng);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(KAABA.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const DIRECTIONS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];

/** 119 → « sud-est » */
export function cardinal(bearing: number): string {
  return DIRECTIONS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** Écart signé le plus court entre deux caps (−180 à 180). */
export function angleDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}
