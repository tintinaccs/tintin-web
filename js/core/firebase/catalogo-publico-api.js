import { runSingleFlight } from './cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';

const ENDPOINT = '/api/public-catalog';
const TIMEOUT_MS = 8000;

export async function fetchPublicCatalogResource(resource) {
  const normalized = resource === 'collections' ? 'collections' : resource === 'products' ? 'products' : '';
  if (!normalized) throw new Error('Recurso público de catálogo inválido');
  // Inicio, catálogo, recomendaciones y búsqueda consumen la misma lectura.
  // Compartir el request evita respuestas duplicadas y repintados en carrera.
  return runSingleFlight('public-catalog:' + normalized, () => fetchResource(normalized));
}

export async function fetchPublicProductsByIds(ids) {
  const unique=[...new Set(ids.map(id=>String(id).trim()).filter(Boolean))].sort();
  const items=[];
  for(let offset=0;offset<unique.length;offset+=30) {
    const batch=unique.slice(offset,offset+30);
    items.push(...await runSingleFlight('public-catalog:products:'+JSON.stringify(batch),()=>fetchResource('products',batch)));
  }
  return items;
}

async function fetchResource(normalized, ids = []) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const params=new URLSearchParams({resource:normalized});
    if(ids.length)params.set('ids',JSON.stringify(ids));
    const response = await fetch(ENDPOINT + '?' + params, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
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
