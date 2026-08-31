const ENDPOINT = '/api/public-catalog';
const TIMEOUT_MS = 8000;

async function fetchPublicCatalogPayload(params) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT + '?' + params.toString(), {
      method: 'GET',
      credentials: 'omit',
      cache: 'default',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('API pública de catálogo respondió ' + response.status);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchPublicCatalogResource(resource) {
  const normalized = resource === 'collections' ? 'collections' : resource === 'products' ? 'products' : '';
  if (!normalized) throw new Error('Recurso público de catálogo inválido');
  const payload = await fetchPublicCatalogPayload(new URLSearchParams({ resource: normalized }));
  if (!payload?.ok || payload.resource !== normalized || !Array.isArray(payload.items)) {
    throw new Error('Respuesta pública de catálogo inválida');
  }
  return payload.items;
}

export async function fetchPublicProduct(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) throw new Error('ID de producto público inválido');
  const payload = await fetchPublicCatalogPayload(new URLSearchParams({
    resource: 'products',
    id: normalizedId
  }));
  if (!payload?.ok || payload.resource !== 'products' || !Object.prototype.hasOwnProperty.call(payload, 'item')) {
    throw new Error('Respuesta pública de producto inválida');
  }
  if (payload.item == null) return null;
  if (!payload.item.id || !payload.item.data || typeof payload.item.data !== 'object') {
    throw new Error('Producto público inválido');
  }
  return payload.item;
}
