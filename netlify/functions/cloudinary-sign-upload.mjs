import {
  cleanMediaId,
  cleanVariant,
  cloudinarySignature,
  getCloudinaryConfig,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from './_cloudinary-security.mjs';

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
    const mediaId = cleanMediaId(body?.mediaId);
    const variant = cleanVariant(body?.variant);
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

    const publicId = `tintin/media/${mediaId}/${variant}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParameters = {
      overwrite: 'true',
      public_id: publicId,
      timestamp
    };
    const signature = cloudinarySignature(signedParameters, apiSecret);

    return jsonResponse({
      cloudName,
      apiKey,
      publicId,
      timestamp,
      signature,
      overwrite: true,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`
    }, 200, origin);
  } catch (error) {
    const message = error?.message || 'No se pudo autorizar la subida';
    const status = /Cloudinary todavía no está configurado/i.test(message) ? 503 : 401;
    return jsonResponse({ error: message }, status, origin);
  }
};

export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['domain', 'ip'],
    windowSize: 60,
    windowLimit: 30
  }
};
