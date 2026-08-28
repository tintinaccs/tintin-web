import fs from 'node:fs';

export const DEFAULT_PATHS = Object.freeze({
  visualContract: 'js/core/store/contratos-visual-builder.js',
  visualRuntime: 'js/core/store/editor-visual-runtime.js',
  orderDomain: 'cloudflare/order-admin-domain.js',
  userLifecycle: 'cloudflare/user-lifecycle-domain.js',
  adminOrderCrud: 'js/admin/orders/pedidos-superadmin-crud.js',
  inventoryAdmin: 'js/admin/products/integridad-inventario-admin.js',
  adminDeleteUser: 'functions/api/admin-delete-user.js',
  sheetsAdminWebhook: 'functions/api/sheets-admin-webhook.js',
  sheetsProductsWebhook: 'functions/api/sheets-products-webhook.js',
  appsScriptParity: 'apps-script/AdminParity.gs',
  syncAuthorityAudit: 'scripts/auditar-sync-authority.mjs',
});

const GENERIC_VISUAL_TYPES = new Set(['banner', 'text', 'promotion', 'button', 'section']);

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function unique(values) {
  return [...new Set(values)];
}

function extractFunctionBody(source, functionName) {
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`);
  const match = declaration.exec(String(source));
  if (!match) return '';

  const openingBrace = match.index + match[0].lastIndexOf('{');
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return source.slice(match.index, index + 1);
  }
  return '';
}

function quotedValues(fragment = '') {
  return unique([...fragment.matchAll(/['"]([a-z][a-z0-9-]*)['"]/gi)].map(match => match[1]));
}

export function parseVisualRegistry(source) {
  const match = String(source).match(/VISUAL_BLOCK_TYPES\s*=\s*Object\.freeze\(\s*\[([\s\S]*?)\]\s*\)/);
  return match ? quotedValues(match[1]) : [];
}

export function parseRenderedVisualTypes(source) {
  return unique([...String(source).matchAll(/block\.type\s*===\s*['"]([a-z][a-z0-9-]*)['"]/gi)].map(match => match[1]));
}

export function auditComponentRegistrySources({ contractSource, runtimeSource }) {
  const errors = [];
  const registered = parseVisualRegistry(contractSource);
  const rendered = parseRenderedVisualTypes(runtimeSource);
  if (!registered.length) errors.push('No se pudo leer VISUAL_BLOCK_TYPES desde el contrato canónico.');
  for (const type of rendered) {
    if (!registered.includes(type)) errors.push(`El runtime renderiza el tipo “${type}” pero no está registrado en VISUAL_BLOCK_TYPES.`);
  }
  for (const type of registered) {
    if (!rendered.includes(type) && !GENERIC_VISUAL_TYPES.has(type)) {
      errors.push(`El tipo registrado “${type}” no tiene renderer explícito ni pertenece al grupo genérico permitido.`);
    }
  }
  return { errors, registered, rendered };
}

export function auditDomainConsumerSources(sources) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const adminOrderCrud = sources.adminOrderCrud || '';
  const inventoryAdmin = sources.inventoryAdmin || '';
  const sheetsWebhook = sources.sheetsAdminWebhook || '';
  const adminDeleteUser = sources.adminDeleteUser || '';
  const userLifecycle = sources.userLifecycle || '';
  const orderDomain = sources.orderDomain || '';

  check(/\/api\/admin-order-mutation/.test(adminOrderCrud) && /action:\s*['"]createOrder['"]/.test(adminOrderCrud),
    'Superadmin debe crear pedidos mediante /api/admin-order-mutation.');
  check(/\/api\/admin-order-mutation/.test(inventoryAdmin),
    'Superadmin debe editar/transicionar pedidos mediante /api/admin-order-mutation.');
  check(/createOrderAdmin/.test(sheetsWebhook) && /applyOrderAdminMutation/.test(sheetsWebhook),
    'Sheets debe delegar altas y ediciones de pedidos al dominio canónico.');
  check(/applyUserLifecycle/.test(adminDeleteUser) && /applyUserLifecycle/.test(sheetsWebhook),
    'Superadmin y Sheets deben compartir applyUserLifecycle para bajas/reactivaciones.');
  check(/export\s+async\s+function\s+createOrderAdmin/.test(orderDomain) && /export\s+async\s+function\s+applyOrderAdminMutation/.test(orderDomain),
    'El dominio canónico de pedidos debe exponer creación y mutación administrativa.');
  check(/export\s+async\s+function\s+applyUserLifecycle/.test(userLifecycle),
    'El lifecycle canónico de usuarios debe seguir siendo la autoridad de bajas/reactivaciones.');
  return errors;
}

export function auditNoDuplicateAuthoritiesSources(sources) {
  const errors = [];
  const sheets = sources.sheetsAdminWebhook || '';
  const parity = sources.appsScriptParity || '';
  const adminCrud = sources.adminOrderCrud || '';
  const inventoryAdmin = sources.inventoryAdmin || '';

  if (/firestoreAdmin(?:Commit|Patch|Create)\s*\([^)]*[`'"]orders\//s.test(sheets)) {
    errors.push('Sheets contiene una escritura directa a orders; debe delegar al dominio de pedidos.');
  }
  if (/productInventory\//.test(sheets) && /firestoreAdmin(?:Commit|Patch|Create)/.test(sheets)) {
    errors.push('Sheets no debe escribir productInventory directamente.');
  }
  if (/transaction\.(?:set|update|delete)\([^\n]*(?:orders|ACTIVE_COLLECTION)/.test(adminCrud) && /function\s+(?:createManualOrder_|saveModal_)/.test(adminCrud)) {
    const normalMutationBody = extractFunctionBody(adminCrud, 'saveModal_');
    if (/runTransaction|transaction\.(?:set|update|delete)/.test(normalMutationBody)) {
      errors.push('El guardado normal de pedidos de Superadmin volvió a implementar una autoridad Firestore paralela.');
    }
  }
  const updateBody = extractFunctionBody(inventoryAdmin, 'updateEditedOrder');
  if (!/\/api\/admin-order-mutation/.test(updateBody) || /runTransaction/.test(updateBody)) {
    errors.push('updateEditedOrder debe ser consumidor del dominio server-side, no reconciliador paralelo.');
  }
  if (/deleteOrder/.test(parity)) errors.push('Apps Script no debe exponer borrado físico de pedidos.');
  return errors;
}

export function auditSyncContractSources(sources) {
  const errors = [];
  const syncAudit = sources.syncAuthorityAudit || '';
  const parity = sources.appsScriptParity || '';
  const sheets = sources.sheetsAdminWebhook || '';
  const orderDomain = sources.orderDomain || '';
  const requiredAuditTokens = ['createOrderAdmin', 'applyOrderAdminMutation', 'baseChangeId', 'auditLog'];
  for (const token of requiredAuditTokens) {
    if (!syncAudit.includes(token)) errors.push(`La auditoría canónica de sync dejó de cubrir “${token}”.`);
  }
  if (!/changeId/.test(parity) || !/baseChangeId/.test(parity)) errors.push('Apps Script debe transportar changeId/baseChangeId.');
  if (!/baseChangeId/.test(sheets)) errors.push('El webhook administrativo debe validar baseChangeId.');
  if (!/canonicalPrices:\s*true/.test(orderDomain)) errors.push('El creador de pedidos debe conservar precios canónicos del servidor.');
  return errors;
}

export function readArchitectureSources(paths = DEFAULT_PATHS) {
  return Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, read(path)]));
}

export function formatErrors(title, errors) {
  if (!errors.length) return `${title}: OK`;
  return `${title}: ${errors.length} problema(s):\n${errors.map(error => `  - ${error}`).join('\n')}`;
}
