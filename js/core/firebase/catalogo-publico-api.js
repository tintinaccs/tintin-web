const ENDPOINT = '/api/public-catalog';
const TIMEOUT_MS = 8000;

export async function fetchPublicCatalogResource(resource) {
  const normalized = resource === 'collections' ? 'collections' : resource === 'products' ? 'products' : '';
  if (!normalized) throw new Error('Recurso público de catálogo inválido');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT + '?resource=' + encodeURIComponent(normalized), {
      method: 'GET',
      credentials: 'omit',
      cache: 'default',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('API pública de catálogo respondió ' + response.status);
    const payload = await response.json();
    if (!payload?.ok || payload.resource !== normalized || !Array.isArray(payload.items)) {
      throw new Error('Respuesta pública de catálogo inválida');
    }
    return payload.items;
  } finally {
    window.clearTimeout(timer);
  }
}
