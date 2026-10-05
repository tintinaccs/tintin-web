// =============================================================
// TINTIN — Secretos de entrada desde Google Sheets / Apps Script
// =============================================================
// Antes, un único SHEETS_ENGAGEMENT_SECRET autorizaba todos los webhooks que
// Apps Script llama en Cloudflare. Si ese valor se filtraba, alcanzaba para
// cambiar roles de usuarios, editar el catálogo y exportar datos de clientes.
// Cada webhook sensible acepta ahora su propio secreto. Mientras no se cargue
// (ni en Cloudflare ni en Propiedades del script), sigue valiendo el secreto
// compartido, para que la migración no corte la sincronización.

export const SHEETS_INBOUND_SECRET_NAMES = Object.freeze({
  admin: 'SHEETS_ADMIN_WEBHOOK_SECRET',
  products: 'SHEETS_PRODUCTS_WEBHOOK_SECRET',
  snapshot: 'SHEETS_SNAPSHOT_SECRET',
});

const SHARED_SECRET_NAME = 'SHEETS_ENGAGEMENT_SECRET';

function read(env, name) {
  return String(env?.[name] ?? '').trim();
}

/** Secreto que el webhook `scope` debe exigir. */
export function sheetsInboundSecret(env, scope) {
  const name = SHEETS_INBOUND_SECRET_NAMES[scope];
  if (!name) throw new Error(`Webhook de Sheets desconocido: ${scope}`);
  return read(env, name) || read(env, SHARED_SECRET_NAME);
}

/** Qué webhooks ya usan un secreto propio (sin exponer valores). */
export function sheetsInboundSecretStatus(env) {
  return Object.fromEntries(Object.entries(SHEETS_INBOUND_SECRET_NAMES)
    .map(([scope, name]) => [scope, read(env, name) ? 'dedicated' : (read(env, SHARED_SECRET_NAME) ? 'shared' : 'missing')]));
}
