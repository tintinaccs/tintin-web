/* =============================================================
   TINTIN — Biblioteca multimedia de Super Admin

   Procesa imágenes en el navegador, solicita firmas temporales a funciones
   de Netlify y sube los archivos directamente a Cloudinary. Firestore guarda
   únicamente la metadata y las URLs públicas de la biblioteca.
   ============================================================= */

import { auth, db } from './firebase.js';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { validateImageFile, processImage } from './image-processing.js';

const MEDIA_COLLECTION = 'media';
const NETLIFY_FALLBACK_ORIGIN = 'https://tintinaccesorios.netlify.app';

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function functionOrigin() {
  const configured = String(window.TINTIN_FUNCTION_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (window.location.hostname.endsWith('github.io')) return NETLIFY_FALLBACK_ORIGIN;
  return '';
}

function functionUrl(name) {
  return `${functionOrigin()}/.netlify/functions/${name}`;
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `El servicio de imágenes respondió HTTP ${response.status}`);
  }
  return data;
}

async function callSecureFunction(name, payload) {
  const user = auth.currentUser;
  if (!user) throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
  const token = await user.getIdToken();
  const response = await fetch(functionUrl(name), {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return parseJsonResponse(response);
}

async function uploadBlobToCloudinary(blob, mediaId, variant) {
  const authorization = await callSecureFunction('cloudinary-sign-upload', { mediaId, variant });
  const form = new FormData();
  form.append('file', blob, `${variant}.${variant === 'thumb' ? 'webp' : (blob.type.split('/')[1] || 'webp')}`);
  form.append('api_key', authorization.apiKey);
  form.append('timestamp', String(authorization.timestamp));
  form.append('signature', authorization.signature);
  form.append('public_id', authorization.publicId);
  form.append('overwrite', 'true');

  const response = await fetch(authorization.uploadUrl, {
    method: 'POST',
    body: form
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || `Cloudinary respondió HTTP ${response.status}`);
  }
  if (!result.secure_url || !result.public_id) {
    throw new Error('Cloudinary no devolvió una URL válida para la imagen.');
  }
  return result;
}

async function deleteCloudinaryAssets(publicIds) {
  const cleanIds = [...new Set((publicIds || []).filter(Boolean))];
  if (!cleanIds.length) return [];
  const result = await callSecureFunction('cloudinary-delete', { publicIds: cleanIds });
  return result.results || [];
}

/**
 * Valida, procesa y sube un archivo a la biblioteca multimedia. Progreso se
 * reporta vía onProgress(stage) con stage en 'validating'|'processing'|
 * 'uploading'|'saving'. Si alguna etapa falla, limpia de Cloudinary cualquier
 * archivo que haya quedado subido antes de guardar la metadata.
 */
export async function uploadImageToLibrary(file, options = {}) {
  const {
    maxWidth,
    maxHeight,
    quality,
    thumbSize,
    onProgress,
    section = 'biblioteca',
    slotKey = null,
    alt = ''
  } = options;
  const report = stage => { try { onProgress?.(stage); } catch {} };

  report('validating');
  const validation = await validateImageFile(file);
  if (!validation.ok) throw new Error(validation.error);

  report('processing');
  const processed = await processImage(file, { maxWidth, maxHeight, quality, thumbSize });

  const mediaId = randomId();
  let fullUpload = null;
  let thumbUpload = null;

  try {
    report('uploading');
    fullUpload = await uploadBlobToCloudinary(processed.fullBlob, mediaId, 'full');
    thumbUpload = await uploadBlobToCloudinary(processed.thumbBlob, mediaId, 'thumb');

    report('saving');
    const record = {
      provider: 'cloudinary',
      publicId: fullUpload.public_id,
      thumbPublicId: thumbUpload.public_id,
      url: fullUpload.secure_url,
      thumbUrl: thumbUpload.secure_url,
      originalName: String(file.name || '').slice(0, 200),
      alt: String(alt || file.name || '').slice(0, 240),
      section: String(section || 'biblioteca').slice(0, 80),
      slotKey: slotKey ? String(slotKey).slice(0, 160) : null,
      format: String(fullUpload.format || processed.format || '').slice(0, 20),
      width: Number(fullUpload.width || processed.width || 0),
      height: Number(fullUpload.height || processed.height || 0),
      bytes: Number(fullUpload.bytes || processed.bytes || 0),
      thumbBytes: Number(thumbUpload.bytes || 0),
      uploadedBy: auth.currentUser?.email || null,
      uploadedByUid: auth.currentUser?.uid || null,
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, MEDIA_COLLECTION, mediaId), record);

    return {
      mediaId,
      publicId: record.publicId,
      thumbPublicId: record.thumbPublicId,
      url: record.url,
      thumbUrl: record.thumbUrl,
      width: record.width,
      height: record.height,
      bytes: record.bytes,
      format: record.format,
      provider: 'cloudinary'
    };
  } catch (error) {
    const uploadedIds = [fullUpload?.public_id, thumbUpload?.public_id].filter(Boolean);
    if (uploadedIds.length) {
      try {
        await deleteCloudinaryAssets(uploadedIds);
      } catch (cleanupError) {
        console.warn('[media-library] No se pudo limpiar una carga incompleta:', cleanupError);
      }
    }
    throw error;
  }
}

/**
 * Revisa si una URL de imagen sigue en uso en algún lugar de la plataforma
 * antes de borrarla: settings/images, products.imageUrl y collections.image.
 */
export async function findImageUsage(url) {
  if (!url) return [];
  const usages = [];

  try {
    const imagesSnap = await getDoc(doc(db, 'settings', 'images'));
    if (imagesSnap.exists()) {
      const data = imagesSnap.data() || {};
      Object.entries(data).forEach(([key, value]) => {
        if (value === url) usages.push(`Configuración de imágenes · ${key}`);
      });
    }
  } catch (error) {
    console.warn('[media-library] No se pudo revisar settings/images:', error);
  }

  try {
    const productsSnap = await getDocs(query(collection(db, 'products'), where('imageUrl', '==', url), limit(5)));
    productsSnap.forEach(docSnap => {
      usages.push(`Producto · ${docSnap.data()?.name || docSnap.id}`);
    });
  } catch (error) {
    console.warn('[media-library] No se pudo revisar products:', error);
  }

  try {
    const collectionsSnap = await getDocs(query(collection(db, 'collections'), where('image', '==', url), limit(5)));
    collectionsSnap.forEach(docSnap => {
      usages.push(`Colección · ${docSnap.data()?.name || docSnap.id}`);
    });
  } catch (error) {
    console.warn('[media-library] No se pudo revisar collections:', error);
  }

  return usages;
}

/**
 * Borra un elemento de la biblioteca: primero revisa uso real (salvo force),
 * después elimina los assets de Cloudinary y por último borra la metadata de
 * Firestore. Así nunca queda un documento apuntando a un archivo inexistente.
 */
export async function deleteMediaItem(mediaId, { force = false } = {}) {
  const mediaRef = doc(db, MEDIA_COLLECTION, mediaId);
  const snap = await getDoc(mediaRef);
  if (!snap.exists()) return false;
  const data = snap.data() || {};

  if (!force) {
    const usage = await findImageUsage(data.url);
    if (usage.length) {
      const error = new Error(`Esta imagen está en uso y no se puede borrar: ${usage.join(', ')}.`);
      error.usage = usage;
      throw error;
    }
  }

  await deleteCloudinaryAssets([data.publicId, data.thumbPublicId]);
  await deleteDoc(mediaRef);
  return true;
}

/**
 * Limpia automáticamente una imagen anterior solo cuando ya no aparece en
 * ningún slot, producto o colección. Se usa después de reemplazar o quitar.
 */
export async function deleteMediaByUrlIfUnused(url) {
  if (!url) return false;
  const usage = await findImageUsage(url);
  if (usage.length) return false;

  const snap = await getDocs(query(collection(db, MEDIA_COLLECTION), where('url', '==', url), limit(10)));
  let deleted = false;
  for (const item of snap.docs) {
    await deleteMediaItem(item.id, { force: true });
    deleted = true;
  }
  return deleted;
}

/** Suscripción en vivo a toda la biblioteca, más recientes primero. */
export function onMediaLibraryUpdate(cb, onError) {
  return onSnapshot(
    query(collection(db, MEDIA_COLLECTION), orderBy('uploadedAt', 'desc'), limit(500)),
    snap => cb(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))),
    error => {
      console.warn('[media-library] listener failed:', error);
      onError?.(error);
    }
  );
}
