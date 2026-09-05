/** Validate the untransformed secure_url returned by the profile upload flow.
 * This establishes URL ownership/shape, not proof that an upload exists.
 * https://cloudinary.com/documentation/upload_images#upload_response
 */
export function validateProfileAvatarUrl(photoURL, cloudName, publicId) {
  const invalid = () => { throw new Error('La foto no coincide con el archivo autorizado'); };
  if (typeof photoURL !== 'string' || photoURL.length > 1200 ||
      !/^[A-Za-z0-9_-]+$/.test(cloudName || '') ||
      !/^tintin_profile_[a-f0-9]{24}$/.test(publicId || '')) invalid();
  let parsed;
  try { parsed = new URL(photoURL); } catch { invalid(); }
  if (parsed.origin !== 'https://res.cloudinary.com' || parsed.username || parsed.password ||
      parsed.search || parsed.hash || photoURL !== parsed.href) invalid();
  const segments = parsed.pathname.split('/');
  if (segments.length !== 6 || segments[0] !== '' || segments[1] !== cloudName ||
      segments[2] !== 'image' || segments[3] !== 'upload' || !/^v[0-9]+$/.test(segments[4])) invalid();
  const allowedFiles = ['jpg', 'jpeg', 'png', 'webp'].map(format => `${publicId}.${format}`);
  if (!allowedFiles.includes(segments[5])) invalid();
  return photoURL;
}

/** Read provider metadata server-side; never fetch the caller's delivery URL. */
export async function verifyProfileAvatarAsset(photoURL, publicId, config, request = fetch) {
  validateProfileAvatarUrl(photoURL, config.cloudName, publicId);
  if (!config.apiKey || !config.apiSecret) {
    throw Object.assign(new Error('No se puede verificar el almacenamiento de fotos'), { status: 503 });
  }
  let response;
  try {
    response = await request(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/image/upload/${encodeURIComponent(publicId)}`, {
      headers: { Authorization: `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}` },
      redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw Object.assign(new Error('No se pudo verificar la foto; volvé a intentar'), { status: 503 });
  }
  if (!response.ok) {
    const missing = response.status === 404;
    throw Object.assign(new Error(missing ? 'La foto no existe en el almacenamiento' : 'El almacenamiento no pudo verificar la foto; volvé a intentar'), { status: missing ? 400 : 503 });
  }
  const asset = await response.json().catch(() => null);
  if (!asset || asset.public_id !== publicId || asset.resource_type !== 'image' || asset.type !== 'upload' ||
      asset.secure_url !== photoURL || !['jpg', 'jpeg', 'png', 'webp'].includes(asset.format) ||
      !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 5 * 1024 * 1024) {
    throw Object.assign(new Error('La foto no coincide con la subida actual o supera el formato/tamaño permitido'), { status: 400 });
  }
  return { publicId: asset.public_id, photoURL: asset.secure_url, bytes: asset.bytes, format: asset.format };
}
