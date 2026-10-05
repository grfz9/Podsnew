/**
 * Carte image d'un verset (1080 × 1350, format portrait des réseaux sociaux), dessinée sur l'appareil :
 * texte arabe, traduction officielle, référence, nom du traducteur et adresse de Podsal.
 */
export interface VerseCardInput {
  arabic: string;
  translation?: string;
  /** « Al-Kahf · 18:10 » */
  reference: string;
  /** « Trad. Muhammad Hamidullah (Complexe du Roi Fahd) » */
  translator?: string;
}

const W = 1080;
const H = 1350;
const PAD = 96;
const GOLD = '#e2c485';
const CREAM = '#f5f1ec';
const ARABIC_FONT = "'Amiri Quran', 'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif";
const LATIN_FONT = "Inter, system-ui, sans-serif";

/** Espaces insécables avant « ! ? : ; » et à l'intérieur des guillemets, pour ne jamais isoler un signe en début de ligne. */
export function frenchSpacing(text: string): string {
  return text.replace(/\s+([!?:;»])/g, '\u00A0$1').replace(/«\s+/g, '«\u00A0');
}

/** Découpe un texte en lignes qui tiennent dans `width` (mesure réelle de la police). */
export function wrapText(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number): string[] {
  // Espaces insécables (ponctuation française) gardées : seuls les espaces ordinaires coupent la ligne.
  const words = text.split(/[ \t\n]+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Plus grande taille de police (entre max et min) pour laquelle le texte tient dans la hauteur donnée. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, max: number, min: number, lineHeight: number, width: number, height: number) {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = font(size);
    const lines = wrapText(ctx, text, width);
    if (lines.length * size * lineHeight <= height) return { size, lines };
  }
  ctx.font = font(min);
  const lines = wrapText(ctx, text, width);
  const maxLines = Math.max(1, Math.floor(height / (min * lineHeight)));
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]} …`;
  }
  return { size: min, lines };
}

/** Symbole de Podsal (arche et ondes), comme l'icône de l'appli. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.strokeStyle = CREAM;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.stroke(new Path2D('M22 88 V50 C22 33 36 22 50 12 C64 22 78 33 78 50 V88'));
  ctx.lineWidth = 5;
  for (const [x1, y1, y2] of [[34, 54, 70], [42, 47, 77], [50, 40, 84], [58, 47, 77], [66, 54, 70]]) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1, y2);
    ctx.stroke();
  }
  ctx.restore();
}

export async function renderVerseCard(input: VerseCardInput): Promise<Blob> {
  // Les polices viennent du site (Google Fonts) : on attend qu'elles soient prêtes pour le dessin.
  await Promise.all([document.fonts.load(`64px ${ARABIC_FONT}`, input.arabic), document.fonts.load(`36px ${LATIN_FONT}`)]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fond : vert profond de Podsal, halo doré en haut.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#173a35');
  bg.addColorStop(1, '#0b0f0f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 700);
  halo.addColorStop(0, 'rgba(226, 196, 133, 0.22)');
  halo.addColorStop(1, 'rgba(226, 196, 133, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Cadre fin doré.
  ctx.strokeStyle = 'rgba(226, 196, 133, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(48, 48, W - 96, H - 96, 36);
  ctx.stroke();

  const width = W - PAD * 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Référence en haut.
  ctx.fillStyle = GOLD;
  ctx.font = `700 34px ${LATIN_FONT}`;
  ctx.fillText(input.reference, W / 2, 112);

  // Arabe, puis traduction : chacun dans sa zone, à la plus grande taille possible.
  const top = 190;
  const bottom = H - 230;
  const zone = bottom - top;
  const hasTranslation = !!input.translation;
  const arabicZone = hasTranslation ? zone * 0.55 : zone;

  // Mise en page d'abord (tailles et lignes), puis dessin centré verticalement dans la zone.
  ctx.direction = 'rtl';
  const arabic = fit(ctx, input.arabic, (s) => `${s}px ${ARABIC_FONT}`, 96, 34, 1.85, width, arabicZone);
  ctx.direction = 'ltr';
  const arabicHeight = arabic.lines.length * arabic.size * 1.85;
  const GAP = 84; // ornement entre l'arabe et la traduction
  const translation = hasTranslation
    ? fit(ctx, frenchSpacing(`« ${input.translation} »`), (s) => `${s}px ${LATIN_FONT}`, 44, 24, 1.5, width, zone - arabicHeight - GAP)
    : null;
  const translationHeight = translation ? translation.lines.length * translation.size * 1.5 : 0;
  const blockHeight = arabicHeight + (translation ? GAP + translationHeight : 0);
  let y = top + Math.max(0, (zone - blockHeight) / 2);

  ctx.direction = 'rtl';
  ctx.fillStyle = CREAM;
  ctx.font = `${arabic.size}px ${ARABIC_FONT}`;
  for (const line of arabic.lines) {
    ctx.fillText(line, W / 2, y);
    y += arabic.size * 1.85;
  }
  ctx.direction = 'ltr';

  if (translation) {
    // Petit losange doré entre l'arabe et la traduction.
    y += 24;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(W / 2, y);
    ctx.lineTo(W / 2 + 10, y + 10);
    ctx.lineTo(W / 2, y + 20);
    ctx.lineTo(W / 2 - 10, y + 10);
    ctx.closePath();
    ctx.fill();
    y += GAP - 24;
    ctx.fillStyle = 'rgba(245, 241, 236, 0.9)';
    ctx.font = `${translation.size}px ${LATIN_FONT}`;
    for (const line of translation.lines) {
      ctx.fillText(line, W / 2, y);
      y += translation.size * 1.5;
    }
  }

  // Pied : traducteur, puis Podsal.
  if (input.translator) {
    ctx.fillStyle = 'rgba(245, 241, 236, 0.55)';
    ctx.font = `24px ${LATIN_FONT}`;
    ctx.fillText(input.translator, W / 2, H - 200);
  }
  const markSize = 56;
  ctx.font = `800 40px ${LATIN_FONT}`;
  const label = 'podsal.com';
  const total = markSize + 16 + ctx.measureText(label).width;
  const startX = (W - total) / 2;
  drawMark(ctx, startX, H - 148, markSize);
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, startX + markSize + 16, H - 148 + markSize / 2 + 2);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image impossible à créer.'))), 'image/png'));
}

/** Partage l'image (téléphone) ou la télécharge (ordinateur). */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
