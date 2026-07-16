/* =============================================================
   TINTIN — Biblioteca multimedia de Super Admin

   Sube archivos ya procesados (image-processing.js) a Firebase Storage bajo
   media/{mediaId}/ y guarda su metadata en Firestore (media/{mediaId}) para
   que el panel pueda listar, buscar y reutilizar imágenes ya subidas sin
   tocar Storage directamente.
   ============================================================= */

import { auth, db, storage } from './firebase.js';
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
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { validateImageFile, processImage } from './image-processing.js';

const MEDIA_COLLECTION = 'media';

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Valida, procesa y sube un archivo a la biblioteca multimedia. Progreso se
 * reporta vía onProgress(stage) con stage en 'validating'|'processing'|
 * 'uploading'|'saving'. Lanza un Error con mensaje claro en cualquier fallo
 * (nunca deja una referencia a medias parcialmente subidas en Firestore).
 */
export async function uploadImageToLibrary(file, options = {}) {
  const { maxWidth, maxHeight, quality, thumbSize, onProgress } = options;
  const report = stage => { try { onProgress?.(stage); } catch {} };

  report('validating');
  const validation = await validateImageFile(file);
  if (!validation.ok) throw new Error(validation.error);

  report('processing');
  const processed = await processImage(file, { maxWidth, maxHeight, quality, thumbSize });

  const mediaId = randomId();
  const fullPath = `media/${mediaId}/full.${processed.format}`;
  const thumbPath = `media/${mediaId}/thumb.webp`;

  report('uploading');
  const fullRef = ref(storage, fullPath);
  const thumbRef = ref(storage, thumbPath);
  await uploadBytes(fullRef, processed.fullBlob, { contentType: processed.fullBlob.type || `image/${processed.format}` });
  await uploadBytes(thumbRef, processed.thumbBlob, { contentType: processed.thumbBlob.type || 'image/webp' });
  const [url, thumbUrl] = await Promise.all([getDownloadURL(fullRef), getDownloadURL(thumbRef)]);

  report('saving');
  const record = {
    path: fullPath,
    thumbPath,
    url,
    thumbUrl,
    originalName: String(file.name || '').slice(0, 200),
    format: processed.format,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
    uploadedBy: auth.currentUser?.email || null,
    uploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, MEDIA_COLLECTION, mediaId), record);

  return { mediaId, url, thumbUrl, width: processed.width, height: processed.height, bytes: processed.bytes, format: processed.format };
}

/**
 * Revisa si una URL de imagen sigue en uso en algún lugar de la plataforma
 * antes de borrarla: settings/images (todos los espacios + variantes por
 * dispositivo), products.imageUrl y collections.image. Devuelve un array de
 * descripciones legibles de dónde se usa (vacío si es seguro borrar).
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
 * Borra un elemento de la biblioteca: primero revisa uso real (a menos que
 * force=true), borra los archivos de Storage y finalmente el documento de
 * Firestore. Lanza un Error con el detalle de uso si está activo y no se
 * fuerza el borrado.
 */
export async function deleteMediaItem(mediaId, { force = false } = {}) {
  const mediaRef = doc(db, MEDIA_COLLECTION, mediaId);
  const snap = await getDoc(mediaRef);
  if (!snap.exists()) return;
  const data = snap.data();

  if (!force) {
    const usage = await findImageUsage(data.url);
    if (usage.length) {
      const error = new Error(`Esta imagen está en uso y no se puede borrar: ${usage.join(', ')}.`);
      error.usage = usage;
      throw error;
    }
  }

  await Promise.allSettled([
    data.path ? deleteObject(ref(storage, data.path)) : Promise.resolve(),
    data.thumbPath ? deleteObject(ref(storage, data.thumbPath)) : Promise.resolve(),
  ]);
  await deleteDoc(mediaRef);
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
