import {
  cleanPublicId,
  cloudinarySignature,
  getCloudinaryConfig,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from './_cloudinary-security.mjs';

async function destroyAsset(publicId, config) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedParameters = {
    invalidate: 'true',
    public_id: publicId,
    timestamp,
    type: 'upload'
  };
  const signature = cloudinarySignature(signedParameters, config.apiSecret);
  const form = new URLSearchParams({
    api_key: config.apiKey,
    invalidate: 'true',
    public_id: publicId,
    signature,
    timestamp: String(timestamp),
    type: 'upload'
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/destroy`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Cloudinary respondió HTTP ${response.status}`);
  }
  if (!['ok', 'not found'].includes(data.result)) {
    throw new Error(`Cloudinary no confirmó el borrado de ${publicId}`);
  }
  return { publicId, result: data.result };
}

export default async (request) => {
  const origin = request.headers.get('origin') || '';

  if (!originIsAllowed(origin)) {
    return jsonResponse({ error: 'Origen no permitido' }, 403, origin);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin);
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405, origin);
  }

  try {
    await requireSuperAdmin(request);
    const body = await request.json();
    const values = Array.isArray(body?.publicIds) ? body.publicIds : [body?.publicId];
    const publicIds = [...new Set(values.filter(Boolean).map(cleanPublicId))];
    if (!publicIds.length || publicIds.length > 4) {
      throw new Error('Cantidad de archivos inválida');
    }

    const config = getCloudinaryConfig();
    const results = [];
    for (const publicId of publicIds) {
      results.push(await destroyAsset(publicId, config));
    }

    return jsonResponse({ ok: true, results }, 200, origin);
  } catch (error) {
    const message = error?.message || 'No se pudo borrar la imagen';
    const status = /Cloudinary todavía no está configurado/i.test(message) ? 503 : 400;
    return jsonResponse({ error: message }, status, origin);
  }
};

export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['domain', 'ip'],
    windowSize: 60,
    windowLimit: 20
  }
};
