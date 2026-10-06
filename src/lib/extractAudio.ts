/**
 * Piste son d'une vidéo MP4/MOV, sans réencodage (mp4box.js) : on recopie les échantillons audio dans un
 * fichier audio seul (MP4 fragmenté, « audio/mp4 »).
 *
 * Pourquoi : Safari sur iPhone met en pause tout média qui contient une piste vidéo dès que l'écran
 * s'éteint ou qu'on quitte l'appli, même lu par un élément <audio>. Avec la piste son seule, l'écoute
 * continue en arrière-plan ; l'image reste affichée par la vidéo muette quand l'appli est ouverte.
 */
type Mp4Buffer = ArrayBuffer & { fileStart: number };

const CHUNK = 4 * 1024 * 1024;

export async function extractAudioTrack(file: Blob): Promise<Blob | null> {
  const { createFile } = await import('mp4box');
  return new Promise<Blob | null>((resolve) => {
    const mp4 = createFile();
    const parts: ArrayBuffer[] = [];
    let ready = false;
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      resolve(ok && parts.length > 1 ? new Blob(parts, { type: 'audio/mp4' }) : null);
    };

    mp4.onError = () => finish(false);
    mp4.onReady = (info) => {
      const track = info.audioTracks?.[0];
      if (!track) return finish(false); // vidéo sans son
      ready = true;
      mp4.setSegmentOptions(track.id, null, { nbSamples: 1000 });
      parts.push(mp4.initializeSegmentation().buffer);
      mp4.start();
    };
    mp4.onSegment = (_id, _user, buffer, _next, last) => {
      parts.push(buffer);
      if (last) finish(true);
    };

    void (async () => {
      let offset = 0;
      while (offset < file.size && !finished) {
        const buffer = (await file.slice(offset, offset + CHUNK).arrayBuffer()) as Mp4Buffer;
        buffer.fileStart = offset;
        offset += buffer.byteLength;
        mp4.appendBuffer(buffer as never, offset >= file.size);
      }
      mp4.flush();
      // Les derniers morceaux arrivent pendant flush() ; si « last » n'a pas été signalé, on termine ici.
      setTimeout(() => finish(ready), 0);
    })().catch(() => finish(false));
  });
}

/** Formats qu'on sait découper (conteneur ISO : MP4, M4V, MOV, 3GP). */
export function canExtractAudio(mime: string, name = ''): boolean {
  return /mp4|quicktime|3gpp|m4v/i.test(mime) || /\.(mp4|m4v|mov|3gp)$/i.test(name);
}
