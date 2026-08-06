/* =============================================================
   TINTIN — Procesamiento de imágenes en el navegador

   Sin backend propio (Firebase Storage vive en el plan gratuito Spark), todo
   el procesamiento ocurre acá antes de subir: validación real de tipo,
   redimensionado, conversión a WebP cuando el navegador puede codificarlo, y
   generación de una miniatura para la biblioteca del panel. No hay AVIF real
   porque hoy ningún navegador ofrece un codificador confiable en Canvas —
   se degrada a WebP y, si tampoco está disponible, al formato original.
   ============================================================= */

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Firma binaria real de cada formato (los primeros bytes del archivo), para
// no confiar solamente en la extensión o en el Content-Type declarado por el
// navegador — ambos pueden mentir; los bytes no.
const SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP: "RIFF" + 4 bytes de tamaño + "WEBP"
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, extra: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 } },
  // AVIF/HEIF: caja ftyp con marca avif/avis en el offset 4-11
  { mime: 'image/avif', bytes: [], isAvif: true },
];

async function readHeader(file, length = 32) {
  const slice = file.slice(0, length);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

function matchesBytes(header, bytes, offset = 0) {
  if (header.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (header[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function detectAvif(header) {
  if (header.length < 12) return false;
  const brand = String.fromCharCode(header[8], header[9], header[10], header[11]);
  return brand === 'avif' || brand === 'avis';
}

/**
 * Determina el tipo real de imagen a partir de los bytes del archivo, sin
 * confiar en la extensión ni en file.type. Devuelve el MIME real detectado
 * o '' si el contenido no corresponde a ninguno de los formatos permitidos
 * (esto es lo que bloquea ejecutables/archivos maliciosos disfrazados de
 * imagen: un .exe renombrado a .png nunca matchea ninguna firma real).
 */
export async function detectRealImageMime(file) {
  const header = await readHeader(file, 16);
  for (const signature of SIGNATURES) {
    if (signature.isAvif) {
      if (detectAvif(header)) return 'image/avif';
      continue;
    }
    if (matchesBytes(header, signature.bytes, signature.offset || 0)) {
      if (signature.extra && !matchesBytes(header, signature.extra.bytes, signature.extra.offset)) continue;
      return signature.mime;
    }
  }
  return '';
}

/**
 * Valida un archivo antes de procesarlo: tamaño, tipo real (firma binaria) Y
 * que el navegador pueda efectivamente decodificarlo como imagen (createImageBitmap
 * falla en contenido corrupto o que no es realmente una imagen pese a tener
 * una firma parecida). Devuelve { ok, error, mime } — nunca lanza.
 */
export async function validateImageFile(file) {
  if (!file || !(file instanceof Blob)) {
    return { ok: false, error: 'No se recibió ningún archivo.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `El archivo pesa demasiado (máximo ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).` };
  }
  if (file.size === 0) {
    return { ok: false, error: 'El archivo está vacío.' };
  }

  const mime = await detectRealImageMime(file);
  if (!mime || !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'El archivo no es una imagen válida (formatos permitidos: JPG, PNG, WebP, AVIF).' };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close?.();
    if (!width || !height) {
      return { ok: false, error: 'No se pudo leer el contenido de la imagen.' };
    }
    return { ok: true, mime, width, height };
  } catch {
    return { ok: false, error: 'El archivo dice ser una imagen pero no pudo decodificarse.' };
  }
}

let _webpSupport = null;
/** Feature-detection real (no por user-agent): intenta codificar 1 pixel a WebP. */
export async function supportsWebpEncoding() {
  if (_webpSupport != null) return _webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));
    _webpSupport = Boolean(blob && blob.type === 'image/webp');
  } catch {
    _webpSupport = false;
  }
  return _webpSupport;
}

function drawScaled(bitmap, maxWidth, maxHeight) {
  const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, width, height };
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar el archivo procesado.'));
    }, mime, quality);
  });
}

/**
 * Procesa un archivo ya validado: lo redimensiona (sin deformar — mantiene
 * proporción, nunca hace upscale) a maxWidth/maxHeight, lo re-codifica a
 * WebP cuando el navegador puede (esto de paso elimina metadatos EXIF, ya
 * que el canvas nunca los conserva), y genera una miniatura cuadrada para
 * la biblioteca. Devuelve blobs listos para subir a Storage.
 */
export async function processImage(file, { maxWidth = 2000, maxHeight = 2000, quality = 0.82, thumbSize = 320 } = {}) {
  const bitmap = await createImageBitmap(file);
  const canUseWebp = await supportsWebpEncoding();
  const targetMime = canUseWebp ? 'image/webp' : (ALLOWED_MIME.has(file.type) ? file.type : 'image/jpeg');
  const extension = targetMime === 'image/webp' ? 'webp' : targetMime === 'image/png' ? 'png' : 'jpg';

  const full = drawScaled(bitmap, maxWidth, maxHeight);
  const fullBlob = await canvasToBlob(full.canvas, targetMime, quality);

  const thumb = drawScaled(bitmap, thumbSize, thumbSize);
  const thumbBlob = await canvasToBlob(thumb.canvas, canUseWebp ? 'image/webp' : targetMime, 0.75);

  bitmap.close?.();

  return {
    fullBlob,
    thumbBlob,
    width: full.width,
    height: full.height,
    format: extension,
    bytes: fullBlob.size,
  };
}

export const IMAGE_PROCESSING_LIMITS = Object.freeze({
  maxUploadBytes: MAX_UPLOAD_BYTES,
  allowedMime: [...ALLOWED_MIME],
});
