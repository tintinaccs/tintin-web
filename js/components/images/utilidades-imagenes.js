/* =============================================================
   TINTIN — Utilidades seguras para imágenes (Fase 5)
   ============================================================= */

const MAX_IMAGE_URL_LENGTH = 2048;
const FORBIDDEN_URL_CHARS = /['"<>\u0000-\u001f\u007f]/;

const CLOUDINARY_HOST = 'res.cloudinary.com';
const CLOUDINARY_UPLOAD_MARKER = '/upload/';

/**
 * Inserta f_auto,q_auto en cualquier URL de entrega de Cloudinary: el CDN
 * elige automáticamente el formato más liviano que el navegador soporte
 * (AVIF/WebP) y la calidad perceptual óptima para esa imagen puntual, sin
 * tocar el archivo original subido. Resultado: misma nitidez percibida, con
 * bytes bastante menores y sin ningún cambio en la firma de subida ni en
 * Cloudinary mismo — es puro reescritura de URL en el momento de mostrarla.
 */
function withCloudinaryAutoDelivery(href) {
  try {
    const url = new URL(href);
    if (url.hostname !== CLOUDINARY_HOST) return href;
    const idx = url.pathname.indexOf(CLOUDINARY_UPLOAD_MARKER);
    if (idx === -1 || url.pathname.includes(`${CLOUDINARY_UPLOAD_MARKER}f_auto`)) return href;
    const insertAt = idx + CLOUDINARY_UPLOAD_MARKER.length;
    url.pathname = `${url.pathname.slice(0, insertAt)}f_auto,q_auto/${url.pathname.slice(insertAt)}`;
    return url.href;
  } catch {
    return href;
  }
}

export function sanitizeImageUrl(value, options = {}) {
  const {
    allowRelative = true,
    allowHttpOnHttps = false,
  } = options;

  const raw = String(value == null ? '' : value).trim();
  if (!raw || raw.length > MAX_IMAGE_URL_LENGTH || FORBIDDEN_URL_CHARS.test(raw)) {
    return '';
  }

  try {
    const parsed = new URL(raw, window.location.href);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';

    if (!allowRelative) {
      const looksRelative = !/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith('//');
      if (looksRelative) return '';
    }

    if (
      window.location.protocol === 'https:' &&
      parsed.protocol === 'http:' &&
      parsed.origin !== window.location.origin &&
      !allowHttpOnHttps
    ) {
      return '';
    }

    return withCloudinaryAutoDelivery(parsed.href);
  } catch {
    return '';
  }
}

export function sanitizeImageAlt(value, fallback = '') {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 180) || fallback;
}

export function isSafeImageUrl(value, options = {}) {
  return Boolean(sanitizeImageUrl(value, options));
}

export function uniqueSafeImageUrls(values, options = {}) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(value => sanitizeImageUrl(value, options))
      .filter(Boolean)
  )];
}

export function createSafeImage({
  src,
  alt = '',
  fallbackUrls = [],
  loading = 'lazy',
  decoding = 'async',
  className = '',
  fit = '',
  marker = '',
} = {}) {
  const image = document.createElement('img');
  const candidates = uniqueSafeImageUrls([src, ...fallbackUrls]);
  let index = 0;

  image.alt = sanitizeImageAlt(alt);
  image.loading = loading;
  image.decoding = decoding;
  image.className = className;
  if (fit) image.style.objectFit = fit;
  if (marker) image.dataset[marker] = '1';

  const applyNext = () => {
    const next = candidates[index++];
    if (next) image.src = next;
    else image.remove();
  };

  image.addEventListener('error', applyNext);
  applyNext();
  return image;
}

export const IMAGE_URL_LIMIT = MAX_IMAGE_URL_LENGTH;
