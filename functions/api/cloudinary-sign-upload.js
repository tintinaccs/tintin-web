import {
  cleanMediaId,
  cleanVariant,
  cloudinarySignature,
  getCloudinaryConfig,
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin
} from '../../cloudflare/cloudinary-security.js';

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ error: 'Origen no permitido' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl);
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405, origin, requestUrl);
  }

  try {
    await requireSuperAdmin(request);
    const body = await request.json();
    const mediaId = cleanMediaId(body?.mediaId);
    const variant = cleanVariant(body?.variant);
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(env);

    // Sin "/": un public_id con carpetas exige permiso de creación de carpeta en
    // cuentas con Dynamic Folder Mode, y eso puede rechazar cada subida nueva.
    const publicId = `tintin_media_${mediaId}_${variant}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParameters = {
      overwrite: 'true',
      public_id: publicId,
      timestamp
    };
    const signature = await cloudinarySignature(signedParameters, apiSecret);

    return jsonResponse({
      cloudName,
      apiKey,
      publicId,
      timestamp,
      signature,
      overwrite: true,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`
    }, 200, origin, requestUrl);
  } catch (error) {
    const message = error?.message || 'No se pudo autorizar la subida';
    const status = /Cloudinary todavía no está configurado/i.test(message) ? 503 : 401;
    return jsonResponse({ error: message }, status, origin, requestUrl);
  }
}
