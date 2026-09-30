/** Taille maximale acceptée pour une image importée (avant réduction). */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/**
 * Réduit une image importée (le plus grand côté ne dépasse pas `maxSide`) et la convertit en JPEG,
 * pour que les images personnelles restent légères dans le stockage de l'appareil.
 * `square` recadre au centre (pochettes).
 */
export async function resizeImage(file: File, maxSide: number, square = false, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Ce fichier n’est pas une image.');
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Image trop lourde (25 Mo maximum).');
  const bitmap = await loadBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const side = Math.min(srcW, srcH);
  const sx = square ? (srcW - side) / 2 : 0;
  const sy = square ? (srcH - side) / 2 : 0;
  const sw = square ? side : srcW;
  const sh = square ? side : srcH;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de traiter l’image sur cet appareil.');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if ('close' in bitmap) bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Impossible de traiter l’image.'))), 'image/jpeg', quality),
  );
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Certains formats (HEIC…) ne sont pas décodables : on tente la voie classique.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('Format d’image non pris en charge (utilisez JPEG, PNG ou WebP).');
  } finally {
    URL.revokeObjectURL(url);
  }
}
