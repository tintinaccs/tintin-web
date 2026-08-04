/**
 * Lectura pública de respaldo para navegadores que bloquean el canal interno
 * de Firestore o reCAPTCHA. Usa la API REST oficial y las mismas reglas de
 * seguridad del proyecto; no permite escrituras ni evita el cierre de tienda.
 */
const PROJECT_ID = 'tintin-accesorios';
const API_KEY = 'AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0';
const BASE_URL =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const REQUEST_TIMEOUT_MS = 7000;

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue === true;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) {
    return (value.arrayValue?.values || []).map(decodeValue);
  }
  if ('mapValue' in value) {
    return decodeFields(value.mapValue?.fields || {});
  }
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)])
  );
}

async function requestJson(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Firestore REST respondió ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getPublicDocumentRest(documentPath) {
  const cleanPath = String(documentPath || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  if (!cleanPath) return null;
  const payload = await requestJson(`${BASE_URL}/${cleanPath}?key=${encodeURIComponent(API_KEY)}`);
  if (!payload) return null;
  return {
    id: String(payload.name || '').split('/').pop() || '',
    data: decodeFields(payload.fields || {})
  };
}

export async function listPublicCollectionRest(collectionName, maxDocuments = 1000) {
  const cleanCollection = String(collectionName || '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanCollection)) {
    throw new Error('Colección REST no válida');
  }

  const limit = Math.max(1, Math.min(1000, Number(maxDocuments) || 1));
  const documents = [];
  let pageToken = '';

  do {
    const remaining = limit - documents.length;
    const params = new URLSearchParams({
      pageSize: String(Math.min(300, remaining)),
      key: API_KEY
    });
    if (pageToken) params.set('pageToken', pageToken);

    const payload = await requestJson(
      `${BASE_URL}/${encodeURIComponent(cleanCollection)}?${params.toString()}`
    );
    const page = Array.isArray(payload?.documents) ? payload.documents : [];
    page.forEach(item => {
      documents.push({
        id: String(item.name || '').split('/').pop() || '',
        data: decodeFields(item.fields || {})
      });
    });
    pageToken = payload?.nextPageToken || '';
  } while (pageToken && documents.length < limit);

  return documents.slice(0, limit);
}
