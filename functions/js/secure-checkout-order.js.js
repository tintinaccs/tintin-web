// =============================================================
// TINTIN — Compatibilidad temporal del checkout con Firestore
//
// El checkout fuente todavía agrega shipping.departamento, pero las reglas
// publicadas aceptan la ciudad completa (por ejemplo, "J. Augusto Saldívar
// (Central)") y no admiten ese campo redundante. En Cloudflare Pages el
// último sufijo .js identifica el archivo de implementación de la Function;
// por eso este nombre doble .js.js expone exactamente la ruta pública
// /js/secure-checkout-order.js que usa checkout.html.
//
// La Function obtiene el asset estático original y elimina ese único campo
// antes de enviarlo al navegador. No cambia precios, stock, datos personales
// ni permisos. Cuando el archivo fuente y las reglas vuelvan a compartir el
// mismo esquema, la sustitución no encontrará nada y devolverá el asset sin
// cambios.
// =============================================================

const DEPARTAMENTO_FIELD = /^\s*departamento:\s*draft\.departamento\s*\|\|\s*'',\s*$/m;

export async function onRequest(context) {
  const { request, env } = context;
  const assetResponse = await env.ASSETS.fetch(request);

  if (request.method === 'HEAD' || !assetResponse.ok) {
    return assetResponse;
  }

  const source = await assetResponse.text();
  const patchedSource = source.replace(DEPARTAMENTO_FIELD, '');
  const headers = new Headers(assetResponse.headers);

  headers.delete('content-length');
  headers.set('content-type', 'text/javascript; charset=utf-8');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set(
    'x-tintin-checkout-schema-fix',
    patchedSource === source ? 'not-needed' : 'applied'
  );

  return new Response(patchedSource, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
}
