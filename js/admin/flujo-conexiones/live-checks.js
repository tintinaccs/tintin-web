// =============================================================
// TINTIN ACCESORIOS — Normalización de probes en vivo (puro)
// =============================================================
// Traduce las respuestas de /api/health, /api/system-health,
// /api/admin-runtime-health y los headers de admin.html en evidencia por
// nodo/conexión que estado-flujo.js puede resolver. No depende del DOM ni
// de Firebase: solo de los cuerpos JSON ya obtenidos, para que sea probable
// con node --test sin red ni navegador.
import { EDGES } from './datos-flujo-conexiones.js?v=tintin-20261006-flow-evidence-1';
import { EVIDENCIA } from './estado-flujo.js?v=tintin-20260929-partial-live-markers-1';

function edgeIdFor(from, to) {
  return EDGES.find(edge => edge.from === from && edge.to === to)?.id || '';
}

function ciCheckPassed(currentEvidence, key) {
  return Boolean(currentEvidence?.commit && currentEvidence?.checks?.[key]?.state === 'PASS');
}

function ciCheckFailed(currentEvidence, key) {
  return Boolean(currentEvidence?.commit && currentEvidence?.checks?.[key]?.state === 'FAIL');
}

// "Pendiente" = ni pasó ni falló: en curso, en cola, omitido o aún sin
// reportar por GitHub. Solo un FAIL real debe verse como error.
function ciCheckPending(currentEvidence, key) {
  return Boolean(currentEvidence?.commit) && !ciCheckPassed(currentEvidence, key) && !ciCheckFailed(currentEvidence, key);
}

function ciNote(currentEvidence, key, label) {
  const check = currentEvidence?.checks?.[key] || {};
  const commit = String(currentEvidence?.commit || '').slice(0, 10) || 'commit desconocido';
  return `GitHub CI · ${label}=${check.state || 'NOT_VERIFIED'} · commit ${commit}`;
}

// El webhook de productos se prueba con un POST SIN secreto: el guard lo
// rechaza (401) antes de leer el cuerpo, así que no escribe nada. Confirma
// que la revisión esperada está desplegada y que el servidor tiene el secreto
// configurado ('missing-header' y no 'server-secret-missing'). No repite la
// escritura Sheets → Firestore: por eso queda parcial, nunca verde.
export const PRODUCTS_WEBHOOK_EXPECTED_REVISION = 'products-canonical-v3';

export function classifySheetsWebhookProbe(probe) {
  if (!probe) return null;
  const revisionOk = probe.revision === PRODUCTS_WEBHOOK_EXPECTED_REVISION;
  const guardOk = (probe.status === 200 && probe.authState === 'configured') || (probe.status === 401 && probe.authState === 'missing-header');
  const ok = revisionOk && guardOk;
  const note = `${probe.status === 401 ? 'POST sin secreto' : 'GET diagnóstico'} /api/sheets-products-webhook → HTTP ${probe.status || 'sin respuesta'}`
    + ` · revisión=${probe.revision || 'ausente'} · guard=${probe.authState || 'desconocido'}`
    + (ok ? '; escritura Sheets → Firestore no probada' : '');
  // El 401 esperado es el éxito de esta sonda; si falla, se informa con el
  // estado real (o 500 cuando el guard responde pero algo no coincide).
  const status = ok ? 200 : (probe.status === 401 || (probe.status >= 200 && probe.status < 300) ? 500 : Number(probe.status || 0));
  return { ok, note, status };
}

// Conexiones de decisión de acceso y la prueba que ejecuta su código real.
// Cada archivo corre dentro del Repository audit (test:accounts,
// audit:login-profile y audit:login-isolation): si esa prueba falla, el
// audit del commit falla y la conexión deja de estar verde.
export const ACCESS_DECISION_EDGES = Object.freeze([
  ['users-uid', 'cuenta-bloqueada', 'tests/accounts/blocked-account-listener.test.mjs'],
  ['roles', 'pagina-principal', 'tests/login/redirect-by-role.test.mjs'],
  ['roles', 'pagina-perfil', 'tests/auth/admin-guard-role-destination.test.mjs'],
]);

// Pruebas del Repository audit que ejecutan el código de cada escritura.
export const WRITE_CONTRACT_SUITES = Object.freeze({
  orders: 'dominio de pedidos ejecutado: tests/orders/order-admin-domain.test.mjs',
  stock: 'transición de stock ejecutada: tests/orders/order-admin-domain.test.mjs + tests/orders/variant-inventory.test.mjs',
  panel: 'Rules reales en emulador con escrituras del panel: test:rules-critical',
  cart: 'Rules reales en emulador con alta, edición y baja del carrito propio: test:rules-critical',
  engagement: 'escritura de "me gusta" y reseñas ejecutada: tests/engagement/escritura-participacion.test.mjs',
});

// Resultado de la ÚLTIMA sincronización real con Sheets en un sentido, tal
// como la anotó el servidor (cloudflare/evidencia-sync-sheets.js). No es una
// sonda: sólo existe si una operación real terminó.
//   confirmed → la última operación real terminó bien (y con la revisión esperada).
//   failed    → la última operación real falló.
//   none      → todavía no hubo ninguna operación real desde que existe el acuse.
//   stale     → el último éxito es de una revisión anterior del webhook.
export function classifySheetsChannel(channel, { expectedRevision = '' } = {}) {
  if (!channel || typeof channel !== 'object') {
    return { state: 'none', note: 'el servidor todavía no entrega el acuse de sincronizaciones reales' };
  }
  const successAt = Date.parse(channel.lastSuccessAt || '');
  const errorAt = Date.parse(channel.lastErrorAt || '');
  const hasSuccess = Number.isFinite(successAt);
  if (Number.isFinite(errorAt) && (!hasSuccess || errorAt > successAt)) {
    return {
      state: 'failed',
      note: `la última sincronización real falló el ${channel.lastErrorAt} (${channel.lastErrorKind || 'operación'}): ${channel.lastError || 'sin detalle'}`,
    };
  }
  if (!hasSuccess) return { state: 'none', note: 'todavía no se registró ninguna sincronización real' };
  if (expectedRevision && channel.revision !== expectedRevision) {
    return {
      state: 'stale',
      note: `la última sincronización real (${channel.lastSuccessAt}) fue con la revisión ${channel.revision || 'desconocida'}, no con ${expectedRevision}`,
    };
  }
  return {
    state: 'confirmed',
    note: `última sincronización real confirmada el ${channel.lastSuccessAt} (${channel.lastSuccessKind || 'operación'})`,
  };
}

// Opciones de evidencia para un registro cuya única prueba posible es el
// acuse: verde si se confirmó, rojo si la última operación real falló y "sin
// confirmar" (conserva el estado base) mientras no haya ninguna.
function sheetsChannelOutcome(result) {
  if (result.state === 'confirmed') return { ok: true, status: 200, promote: true, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION };
  if (result.state === 'failed') return { ok: false, status: 502, promote: false, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION };
  return { ok: true, status: 200, promote: false, pending: true, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION_READ_ONLY };
}

// Una sonda de lectura (guard del webhook, guard de Apps Script) combinada
// con el acuse de escritura real. La lectura sola deja evidencia parcial.
function sheetsGuardOutcome(guardOk, guardStatus, results) {
  if (guardOk !== true) return { ok: false, status: Number(guardStatus || 0), promote: false, partial: false, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION_READ_ONLY };
  if (results.some(result => result.state === 'failed')) return { ok: false, status: 502, promote: false, partial: false, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION };
  if (results.every(result => result.state === 'confirmed')) return { ok: true, status: 200, promote: true, partial: false, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION };
  return { ok: true, status: 200, promote: false, partial: true, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION_READ_ONLY };
}

// "Me gusta" y reseñas. Verde sólo con las tres evidencias a la vez:
//  1. las estadísticas públicas responden en producción (lectura real);
//  2. existe un registro real en likeRecords/reviewRecords, colecciones que
//     únicamente escribe /api/engagement (las Rules niegan toda escritura de
//     cliente): es una escritura real de la API en producción;
//  3. el Repository audit del commit actual, que ejecuta ese código de escritura.
// Sin registro real o sin CI queda parcial; con el audit en FAIL, rojo.
function engagementWriteOutcome(statsProbe, recordProbe, currentEvidence, label) {
  if (!statsProbe) return null;
  const statsOk = statsProbe.ok === true;
  const statsNote = `GET /api/engagement · estadísticas públicas de ${label} ${statsOk ? 'disponibles' : 'no confirmadas'}`;
  const readOnly = EVIDENCIA.LIVE_PRODUCTION_READ_ONLY;
  if (!statsOk) {
    return { ok: false, note: `${statsNote}; mutación no probada`, status: Number(statsProbe.status || 0), promote: false, partial: false, evidenceLevel: readOnly };
  }
  const partial = reason => ({ ok: true, note: `${statsNote}; ${reason}`, status: Number(statsProbe.status || 200), promote: false, partial: true, evidenceLevel: readOnly });
  if (!recordProbe || recordProbe.ok !== true) return partial(`mutación no probada: no se pudo leer el registro real de ${label} con esta sesión`);
  if (recordProbe.exists !== true) return partial(`mutación no probada: todavía no hay ningún registro real de ${label} escrito por la API en producción`);
  const liveNote = `${statsNote} · registro real escrito por /api/engagement en producción${recordProbe.lastAt ? ` (último: ${recordProbe.lastAt})` : ''}`;
  if (!currentEvidence?.commit) return partial(`registro real presente${recordProbe.lastAt ? ` (último: ${recordProbe.lastAt})` : ''}, pero falta la evidencia de CI del commit actual (${WRITE_CONTRACT_SUITES.engagement})`);
  const note = `${liveNote} · ${ciNote(currentEvidence, 'repositoryAudit', 'Repository audit')} · ${WRITE_CONTRACT_SUITES.engagement}`;
  if (ciCheckFailed(currentEvidence, 'repositoryAudit')) return { ok: false, note, status: 200, promote: false, partial: false, evidenceLevel: EVIDENCIA.CI_VERIFIED };
  return {
    ok: true,
    note,
    status: Number(statsProbe.status || 200),
    promote: ciCheckPassed(currentEvidence, 'repositoryAudit'),
    partial: false,
    pending: ciCheckPending(currentEvidence, 'repositoryAudit'),
    evidenceLevel: EVIDENCIA.LIVE_PRODUCTION,
  };
}

// Entrega de correos de pedido a partir de /api/system-health. Sólo lee lo que
// producción ya registró: no envía nada. `delivered` exige pedidos pagados
// reales, todos con correo confirmado, y ningún correo abandonado en la cola.
export function classifyOrderEmailDelivery(report) {
  const integrations = report?.integrations;
  if (!integrations || typeof integrations.resend !== 'boolean') return null;
  if (integrations.resend !== true) {
    return { ok: false, delivered: false, note: 'GET /api/system-health · Resend sin configurar en producción' };
  }
  const checkout = report.checkout;
  const queue = integrations.orderEmailQueue;
  if (checkout?.available !== true || !queue) {
    return { ok: true, delivered: false, note: 'GET /api/system-health · Resend configurado; conciliación de pedidos o cola de correos no disponible, entrega sin confirmar' };
  }
  const paid = Number(checkout.paidOrders) || 0;
  const withoutEmail = Number(checkout.paidWithoutEmail) || 0;
  const deadLetter = Number(queue.deadLetterCount) || 0;
  const pending = Number(queue.pendingCount) || 0;
  const delivered = paid > 0 && withoutEmail === 0 && deadLetter === 0;
  const reason = paid === 0 ? ' · sin pedidos pagados en la muestra para confirmar entrega'
    : withoutEmail > 0 ? ` · ${withoutEmail} pedido(s) pagado(s) sin correo confirmado`
      : deadLetter > 0 ? ` · ${deadLetter} correo(s) sin entregar en la cola` : '';
  return {
    ok: true,
    delivered,
    note: `GET /api/system-health · Resend configurado · pedidos pagados con correo confirmado: ${paid - withoutEmail}/${paid}`
      + ` · cola: ${pending} pendiente(s), ${deadLetter} sin entregar${reason}`,
  };
}

// Si /api/master-diagnostics no entrega la evidencia de CI del commit actual,
// todo lo que depende del Repository audit queda sin confirmar. Se avisa en
// el panel en vez de dejarlo amarillo sin explicación.
export function ciEvidenceProblem(masterDiagnostics) {
  if (masterDiagnostics?.body?.currentEvidence?.commit) return '';
  return `/api/master-diagnostics respondió ${masterDiagnostics?.status || 'sin respuesta'} sin evidencia de CI del commit actual: lo que depende del Repository audit queda sin confirmar`;
}

export function buildLiveChecks({ publicHealth, systemHealth, adminHealth, headers, routeProbes = {}, protectedProbes = {}, sessionProbe = {}, currentEvidence }, checkedAt) {
  const out = {};
  const setFrom = (id, ok, note, options = {}) => {
    if (typeof ok !== 'boolean') return;
    out[id] = {
      ok,
      note,
      status: Number(options.status ?? 200),
      evidenceLevel: options.evidenceLevel || EVIDENCIA.LIVE_PRODUCTION_READ_ONLY,
      promote: options.promote === true,
      partial: options.partial === true,
      authRequired: options.authRequired === true,
      pending: options.pending === true,
      checkedAt,
    };
  };

  // Nodos de infraestructura y de contrato único: la prueba live confirma
  // exactamente lo que el nodo afirma (alcanzabilidad, un campo específico,
  // un protocolo puntual). Ahí sí corresponde LIVE_PRODUCTION promovible.
  // El health público ejecuta lecturas server-side contra cada superficie con
  // la cuenta de servicio y devuelve un booleano por dominio. Eso sí confirma
  // disponibilidad operativa de la superficie en producción, aunque no
  // pretende probar una mutación CRUD. El detalle del nodo conserva esa
  // diferencia para no confundir disponibilidad con una prueba de escritura.
  const publicOk = publicHealth?.status === 200 && publicHealth.body?.ok === true;
  const publicChecks = publicHealth?.body?.checks || {};
  const publicAdmin = publicHealth?.body?.admin || {};
  const LP = EVIDENCIA.LIVE_PRODUCTION;
  const sessionOk = sessionProbe.authenticated === true && sessionProbe.token === true;
  if (sessionProbe.status !== undefined || sessionOk) {
    setFrom('firebase-auth', sessionOk,
      `SDK Firebase Auth · token ${sessionOk ? 'válido' : 'no confirmado'} · email=${sessionProbe.emailClaim === true ? 'ok' : 'no confirmado'} · proyecto=${sessionProbe.projectClaim === true ? 'ok' : 'no confirmado'}`,
      { status: sessionProbe.status, promote: sessionOk, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
    setFrom('sesion-estado', sessionOk,
      `onAuthStateChanged · usuario actual ${sessionOk ? 'disponible' : 'no confirmado'}`,
      { status: sessionProbe.status, promote: sessionOk, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
    setFrom('roles', sessionProbe.role === true,
      `Rol efectivo del panel · ${sessionProbe.role === true ? 'superadmin confirmado' : 'no confirmado'}`,
      { status: sessionProbe.status, promote: sessionProbe.role === true, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
    setFrom('perfil', sessionProbe.profile === true,
      `SDK Firestore · perfil de la sesión actual ${sessionProbe.profile === true ? 'disponible' : 'no confirmado'}${sessionProbe.firestoreError ? ` · ${sessionProbe.firestoreError}` : ''}`,
      { status: sessionProbe.status, promote: sessionProbe.profile === true, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
    // El guard client-side de admin-app.js ya se ejecutó antes de montar este
    // panel: solo llega aquí una sesión con role=superadmin verificado. Que
    // este código corra es en sí la prueba en vivo de que el guard dejó pasar
    // a esta sesión — no es una inferencia, es la precondición real de ejecución.
    const guardOk = sessionOk && sessionProbe.role === true;
    setFrom('admin-guard', guardOk,
      `Guard client-side (admin-app.js) · sesión actual ${guardOk ? 'superadmin verificado' : 'no confirmado'}`,
      { status: sessionProbe.status, promote: guardOk, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
  }
  setFrom('cf-pages', publicOk, `GET /api/health → ${publicHealth?.status || 'sin respuesta'}`, { status: publicHealth?.status, promote: publicOk, evidenceLevel: LP });
  setFrom('cf-functions', publicOk, `GET /api/health → ${publicHealth?.status || 'sin respuesta'}`, { status: publicHealth?.status, promote: publicOk, evidenceLevel: LP });
  setFrom('apis-internas', publicOk, `GET /api/health → ${publicHealth?.status || 'sin respuesta'}`, { status: publicHealth?.status, promote: publicOk, evidenceLevel: LP });
  setFrom('firestore', publicChecks.firebase, `GET /api/health · checks.firebase=${publicChecks.firebase === true}`, { status: publicHealth?.status, promote: publicChecks.firebase === true, evidenceLevel: LP });
  setFrom('users-uid', typeof publicAdmin.users === 'boolean' ? publicAdmin.users : undefined,
    `GET /api/health · admin.users=${publicAdmin.users === true}`, { status: publicHealth?.status, promote: publicAdmin.users === true, evidenceLevel: LP });
  Object.entries({
    productos: 'products',
    inventario: 'productInventory',
    pedidos: 'orders',
    comentarios: 'reviews',
    likes: 'likes',
    correos: 'emailLogs',
  }).forEach(([id, key]) => setFrom(id, typeof publicAdmin[key] === 'boolean' ? publicAdmin[key] : undefined,
    `GET /api/health · superficie admin.${key}=${publicAdmin[key] === true} (lectura operativa)`, {
      status: publicHealth?.status,
      promote: publicAdmin[key] === true,
      evidenceLevel: LP,
    }));

  if (adminHealth && adminHealth.checks) {
    const c = adminHealth.checks;
    setFrom('users-uid', c.users?.ok, `GET /api/admin-runtime-health · lectura users`, { status: adminHealth.status || 200, promote: c.users?.ok === true, evidenceLevel: LP });
    Object.entries({
      productos: 'products', inventario: 'productInventory', pedidos: 'orders',
      comentarios: 'reviews', likes: 'likes', correos: 'emailLogs',
    }).forEach(([id, key]) => setFrom(id, c[key]?.ok, `GET /api/admin-runtime-health · lectura ${key}`, { status: adminHealth.status || 200 }));
  }

  if (systemHealth?.body?.report) {
    const report = systemHealth.body.report;
    const integrations = report.integrations || {};
    setFrom('firestore', integrations.firebase, 'GET /api/system-health · runtime Firestore', { status: systemHealth.status, promote: integrations.firebase === true, evidenceLevel: LP });
    const appsScript = integrations.appsScript;
    if (appsScript) setFrom('apps-script', appsScript.protocolOk === true,
      `GET /api/system-health · Apps Script ${appsScript.protocolOk ? 'protocolo reconocido' : 'protocolo no confirmado'}`,
      { status: appsScript.httpStatus || systemHealth.status, promote: appsScript.protocolOk === true, evidenceLevel: LP });
    // La hoja queda verde sólo si además hay constancia de una sincronización
    // real en cada sentido (hoja → Firestore y Firestore → hoja).
    const sheetsInbound = classifySheetsChannel(integrations.sheetsEvidence?.inbound, { expectedRevision: PRODUCTS_WEBHOOK_EXPECTED_REVISION });
    const sheetsMirror = classifySheetsChannel(integrations.sheetsEvidence?.mirror);
    const sheetsNode = sheetsGuardOutcome(integrations.sheets === true, systemHealth.status, [sheetsInbound, sheetsMirror]);
    setFrom('google-sheets', sheetsNode.ok,
      `GET /api/system-health · configuración y guard de Apps Script ${integrations.sheets === true ? 'confirmados' : 'no confirmados'}`
        + ` · hoja → Firestore: ${sheetsInbound.note} · Firestore → hoja: ${sheetsMirror.note}`, {
        status: sheetsNode.ok ? systemHealth.status : sheetsNode.status,
        promote: sheetsNode.promote,
        partial: sheetsNode.partial,
        evidenceLevel: sheetsNode.evidenceLevel,
      });
    const paypalOk = integrations.paypal?.productionReady === true;
    const sandbox = integrations.paypal?.environment === 'sandbox';
    const externalServicesOk = integrations.resend === true && integrations.cloudinary === true && (paypalOk || sandbox);
    setFrom('servicios-externos', externalServicesOk,
      `GET /api/system-health · Resend=${integrations.resend === true} · Cloudinary=${integrations.cloudinary === true} · PayPal=${integrations.paypal?.environment || 'no configurado'}${paypalOk ? '' : ' · requiere Live'}`,
      { status: systemHealth.status, promote: externalServicesOk && paypalOk, partial: externalServicesOk && sandbox && !paypalOk, evidenceLevel: LP });
    if (report.deployment?.commitSha) {
      setFrom('deployments', true, `GET /api/system-health · commit ${report.deployment.commitSha.slice(0, 10)} (${report.deployment.branch || 'branch desconocida'})`, { promote: true, evidenceLevel: LP });
    }
  }
  if (headers) {
    setFrom('csp', headers.csp === true, `GET /admin.html · CSP ${headers.csp ? 'presente' : 'ausente'}`, { status: headers.status, promote: headers.csp === true, evidenceLevel: LP });
  }

  // Estas lecturas no mutan datos: consultan APIs públicas/protegidas y Rules
  // desplegadas, sin crear engagement ni marcar notificaciones como leídas.
  const favoriteApi = protectedProbes.favoriteApi;
  const notificationApi = protectedProbes.notificationApi;
  const favoriteRules = protectedProbes.firestoreRules?.favorites;
  const notificationRules = protectedProbes.firestoreRules?.notifications;
  const favoriteOk = favoriteApi?.ok === true && favoriteRules?.ok === true;
  const notificationsOk = notificationApi?.ok === true && notificationRules?.ok === true;
  if (favoriteApi || favoriteRules) {
    setFrom('favoritos', favoriteOk,
      `GET /api/engagement=200 · SDK Firestore favorites=${favoriteRules?.ok === true ? 'permitido' : 'no confirmado'}`,
      { status: favoriteApi?.status || favoriteRules?.status, promote: favoriteOk, evidenceLevel: LP, authRequired: favoriteApi?.status === 401 || favoriteRules?.authRequired === true });
  }
  if (notificationApi || notificationRules) {
    setFrom('notificaciones', notificationsOk,
      `GET /api/notifications?health=200 · SDK Firestore adminNotifications=${notificationRules?.ok === true ? 'permitido' : 'no confirmado'}`,
      { status: notificationApi?.status || notificationRules?.status, promote: notificationsOk, evidenceLevel: LP, authRequired: notificationApi?.status === 401 || notificationRules?.authRequired === true });
  }
  const engagementStats = protectedProbes.engagementStats || {};
  const engagementRecords = protectedProbes.engagementRecords || {};
  for (const [id, key, label] of [
    ['likes', 'likes', 'likes'],
    ['comentarios', 'reviews', 'reseñas'],
  ]) {
    const outcome = engagementWriteOutcome(engagementStats[key], engagementRecords[key], currentEvidence, label);
    if (!outcome) continue;
    setFrom(id, outcome.ok, outcome.note, outcome);
  }
  const sheetsWebhook = classifySheetsWebhookProbe(protectedProbes.sheetsWebhook);
  if (sheetsWebhook) {
    // El guard prueba que el webhook está desplegado y protegido; la
    // escritura sólo la prueba el acuse de una edición real de la hoja.
    const report = systemHealth?.body?.report;
    const inbound = report?.integrations
      ? classifySheetsChannel(report.integrations.sheetsEvidence?.inbound, { expectedRevision: PRODUCTS_WEBHOOK_EXPECTED_REVISION })
      : { state: 'none', note: 'acuse de escritura no consultado (falta /api/system-health)' };
    const outcome = sheetsGuardOutcome(sheetsWebhook.ok, sheetsWebhook.status, [inbound]);
    setFrom('sheets-products-webhook', outcome.ok, `${sheetsWebhook.note} · ${inbound.note}`,
      { status: outcome.ok ? sheetsWebhook.status : outcome.status, promote: outcome.promote, partial: outcome.partial, evidenceLevel: outcome.evidenceLevel });
  }
  const cartRules = protectedProbes.firestoreRules?.cart;
  if (cartRules) {
    setFrom('carrito', cartRules.ok === true,
      `SDK Firestore autenticado · lectura del carrito propio ${cartRules.ok === true ? 'permitida' : 'no confirmada'}; persistencia/edición no probadas`,
      { status: cartRules.status, promote: false, partial: cartRules.ok === true, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION_READ_ONLY });
  }
  const rulesOk = favoriteRules?.ok === true && notificationRules?.ok === true;
  if (favoriteRules || notificationRules) {
    setFrom('reglas-firestore', rulesOk,
      `SDK Firestore autenticado · favorites=${favoriteRules?.ok === true ? 'permitido' : 'no confirmado'} · adminNotifications=${notificationRules?.ok === true ? 'permitido' : 'no confirmado'}`,
      { status: rulesOk ? 200 : (favoriteRules?.status || notificationRules?.status), promote: rulesOk, evidenceLevel: LP, authRequired: favoriteRules?.authRequired === true || notificationRules?.authRequired === true });
  }
  const firestoreAuthorityOk = publicChecks.firebase === true && rulesOk;
  if (publicChecks.firebase !== undefined || favoriteRules || notificationRules) {
    setFrom('firestore-fuente-verdad', firestoreAuthorityOk,
      `Firebase runtime=${publicChecks.firebase === true} · Rules protegidas=${rulesOk}`,
      { status: publicHealth?.status || (rulesOk ? 200 : 0), promote: firestoreAuthorityOk, evidenceLevel: LP, authRequired: favoriteRules?.authRequired === true || notificationRules?.authRequired === true });
  }

  // GitHub Actions y el deployment se validan contra el commit actual, no
  // contra la última corrida histórica del Diagnóstico Maestro. Es evidencia
  // CI verificable, distinta de un probe HTTP de producción.
  const auditPassed = ciCheckPassed(currentEvidence, 'repositoryAudit');
  const deploymentPassed = ciCheckPassed(currentEvidence, 'cloudflarePages');
  const auditPending = ciCheckPending(currentEvidence, 'repositoryAudit');
  const deploymentPending = ciCheckPending(currentEvidence, 'cloudflarePages');
  if (currentEvidence?.commit) {
    setFrom('github-actions', auditPassed, ciNote(currentEvidence, 'repositoryAudit', 'Repository audit'), {
      promote: auditPassed,
      pending: auditPending,
      evidenceLevel: EVIDENCIA.CI_VERIFIED,
    });
    setFrom('pruebas-automatizadas', auditPassed, ciNote(currentEvidence, 'repositoryAudit', 'suite automatizada'), {
      promote: auditPassed,
      pending: auditPending,
      evidenceLevel: EVIDENCIA.CI_VERIFIED,
    });
    // Repository audit ejecuta audit:login-profile y audit:login-isolation,
    // que comprueban los contratos reales de Google popup/redirect, OTP y el
    // gate de perfil. Es evidencia CI del commit actual, no una suposición a
    // partir del texto estático del nodo.
    const authContractIds = ['google-btn', 'login-codigo', 'redirect-result', 'ultimos-datos'];
    authContractIds.forEach(id => setFrom(id, auditPassed,
      `${ciNote(currentEvidence, 'repositoryAudit', 'contratos de acceso/perfil')} · login-profile + login-isolation`, {
        promote: auditPassed,
        pending: auditPending,
        evidenceLevel: EVIDENCIA.CI_VERIFIED,
      }));
    // test:accounts (blocked-account-message) corre en el mismo Repository
    // audit: comprueba aviso, enlace a WhatsApp y cierre en login/perfil/checkout.
    setFrom('cuenta-bloqueada', auditPassed,
      `${ciNote(currentEvidence, 'repositoryAudit', 'contrato de cuenta bloqueada')} · test:accounts`, {
        promote: auditPassed,
        pending: auditPending,
        evidenceLevel: EVIDENCIA.CI_VERIFIED,
      });
    // Si el CI de Cloudflare Pages aún no terminó, no se pisa la evidencia
    // runtime ya obtenida de /api/system-health (commit realmente desplegado).
    if (!(deploymentPending && out.deployments?.ok === true)) {
      setFrom('deployments', deploymentPassed, ciNote(currentEvidence, 'cloudflarePages', 'Cloudflare Pages'), {
        promote: deploymentPassed,
        pending: deploymentPending,
        evidenceLevel: EVIDENCIA.CI_VERIFIED,
      });
    }
  }

  // Las rutas públicas se prueban como navegación real. No se consideran
  // equivalentes a una escritura ni se aceptan redirecciones silenciosas.
  Object.entries({
    'entrada-login': 'login',
    'pagina-principal': 'home',
    'pagina-perfil': 'profile',
    'super-panel': 'admin',
    'carrito': 'cart',
  }).forEach(([id, probeKey]) => {
    const probe = routeProbes[probeKey];
    if (!probe) return;
    const routeOk = probe.ok === true && probe.status >= 200 && probe.status < 400;
    const contractOk = id === 'carrito' ? routeOk && probe.hasCartDrawer === true : routeOk;
    setFrom(id, contractOk,
      `GET ${probe.path || probeKey} → HTTP ${probe.status || 'sin respuesta'}`, {
        status: probe.status,
        promote: contractOk,
        evidenceLevel: LP,
      });
  });
  return out;
}

export function buildLiveEdges({ publicHealth, systemHealth, headers, protectedProbes = {}, sessionProbe = {}, currentEvidence }, checkedAt) {
  const out = {};
  const set = (from, to, ok, note, status = 200, options = {}) => {
    if (typeof ok !== 'boolean') return;
    out[edgeIdFor(from, to)] = {
      ok,
      note,
      status,
      promote: options.promote !== false && ok,
      partial: options.partial === true,
      pending: options.pending === true,
      evidenceLevel: options.evidenceLevel || EVIDENCIA.LIVE_PRODUCTION,
      checkedAt,
    };
  };
  const publicOk = publicHealth?.status === 200 && publicHealth.body?.ok === true;
  const checks = publicHealth?.body?.checks || {};
  const sessionOk = sessionProbe.authenticated === true && sessionProbe.token === true;
  set('cf-pages', 'cf-functions', publicOk, `GET /api/health → ${publicHealth?.status || 'sin respuesta'}`, publicHealth?.status);
  set('cf-functions', 'apis-internas', publicOk, `GET /api/health → ${publicHealth?.status || 'sin respuesta'}`, publicHealth?.status);
  set('apis-internas', 'firestore', typeof checks.firebase === 'boolean' ? checks.firebase : undefined,
    `GET /api/health · checks.firebase=${checks.firebase === true}`, publicHealth?.status);
  const admin = publicHealth?.body?.admin || {};
  set('firestore', 'users-uid', typeof admin.users === 'boolean' ? admin.users : undefined, `GET /api/health · admin.users=${admin.users === true}`, publicHealth?.status);
  if (sessionProbe.status !== undefined || sessionOk) {
    set('sesion-estado', 'firestore', sessionOk,
      `Sesión actual · lectura Firestore ${sessionOk ? 'habilitada' : 'no confirmada'}`,
      sessionProbe.status || 0);
    set('users-uid', 'roles', sessionProbe.role === true,
      `Rol efectivo de la sesión · ${sessionProbe.role === true ? 'superadmin confirmado' : 'no confirmado'}`,
      sessionProbe.status || 0);
    set('roles', 'perfil', sessionProbe.profile === true,
      `Perfil de la sesión · ${sessionProbe.profile === true ? 'disponible' : 'no confirmado'}`,
      sessionProbe.status || 0);
    set('roles', 'super-panel', sessionProbe.role === true,
      `Destino actual · ${sessionProbe.role === true ? 'Super Panel autorizado' : 'no confirmado'}`,
      sessionProbe.status || 0);
    const guardOk = sessionOk && sessionProbe.role === true;
    set('super-panel', 'admin-guard', guardOk,
      `Guard client-side · sesión actual ${guardOk ? 'superadmin verificado' : 'no confirmado'}`,
      sessionProbe.status || 0);
  }
  set('cf-functions', 'csp', headers ? headers.csp === true : undefined, `GET /admin.html · CSP ${headers?.csp ? 'presente' : 'ausente'}`, headers?.status);
  const report = systemHealth?.body?.report;
  if (report?.integrations?.appsScript) {
    set('apis-internas', 'apps-script', report.integrations.appsScript.protocolOk === true,
      `GET /api/system-health · Apps Script ${report.integrations.appsScript.protocolOk ? 'OK' : 'no confirmado'}`,
      report.integrations.appsScript.httpStatus || systemHealth.status);
  }
  if (report?.integrations?.paypal) {
    const paypalOk = report.integrations.paypal.productionReady === true;
    const sandbox = report.integrations.paypal.environment === 'sandbox';
    const available = (paypalOk || sandbox) && report.integrations.resend === true && report.integrations.cloudinary === true;
    set('apis-internas', 'servicios-externos', available,
      `GET /api/system-health · PayPal ${report.integrations.paypal.environment || 'no configurado'}${paypalOk ? '' : ' · requiere Live'} · externos listos=${paypalOk && report.integrations.resend === true && report.integrations.cloudinary === true}`,
      systemHealth.status, { promote: available && paypalOk, partial: available && sandbox && !paypalOk });
  }
  // Sheets: el guard HTTP sólo prueba que el puente está desplegado. Cada
  // conexión queda verde únicamente con el acuse de una sincronización real
  // en su sentido; si la última falló, se muestra el fallo.
  const sheetsInbound = report?.integrations
    ? classifySheetsChannel(report.integrations.sheetsEvidence?.inbound, { expectedRevision: PRODUCTS_WEBHOOK_EXPECTED_REVISION })
    : null;
  const sheetsMirror = report?.integrations ? classifySheetsChannel(report.integrations.sheetsEvidence?.mirror) : null;
  if (report?.integrations?.sheets !== undefined) {
    const outcome = sheetsGuardOutcome(report.integrations.sheets === true, systemHealth.status, [sheetsMirror]);
    set('apps-script', 'google-sheets', outcome.ok,
      `GET /api/system-health · guard HTTP ${report.integrations.sheets === true ? 'reconocido' : 'no confirmado'} · Firestore → hoja: ${sheetsMirror.note}`,
      outcome.ok ? systemHealth.status : outcome.status, {
        promote: outcome.promote,
        partial: outcome.partial,
        evidenceLevel: outcome.evidenceLevel,
      });
  }
  if (sheetsInbound && sheetsMirror) {
    for (const [from, to, result, label] of [
      ['google-sheets', 'apps-script', sheetsInbound, 'Edición real de la hoja recibida por el webhook con el secreto de Apps Script'],
      ['sheets-products-webhook', 'firestore', sheetsInbound, 'Commit de producto e inventario pedido por la hoja'],
      ['firestore', 'apps-script', sheetsMirror, 'Registro real de Firestore aceptado por Apps Script'],
    ]) {
      const outcome = sheetsChannelOutcome(result);
      set(from, to, outcome.ok, `${label} · ${result.note}`, outcome.status,
        { promote: outcome.promote, pending: outcome.pending === true, evidenceLevel: outcome.evidenceLevel });
    }
  }
  const favoriteApi = protectedProbes.favoriteApi;
  const notificationApi = protectedProbes.notificationApi;
  const favoriteRules = protectedProbes.firestoreRules?.favorites;
  const notificationRules = protectedProbes.firestoreRules?.notifications;
  if (favoriteApi) {
    set('apis-internas', 'favoritos', favoriteApi.ok === true,
      `GET /api/engagement?action=ownFavorite → HTTP ${favoriteApi.status || 'sin respuesta'}`,
      favoriteApi.status || 0, { evidenceLevel: EVIDENCIA.LIVE_PRODUCTION });
  }
  if (notificationApi) {
    set('apis-internas', 'notificaciones', notificationApi.ok === true,
      `GET /api/notifications?action=health → HTTP ${notificationApi.status || 'sin respuesta'}`,
      notificationApi.status || 0, { evidenceLevel: EVIDENCIA.LIVE_PRODUCTION });
  }
  const engagementStats = protectedProbes.engagementStats || {};
  const engagementRecords = protectedProbes.engagementRecords || {};
  for (const [to, key, label] of [
    ['likes', 'likes', 'likes'],
    ['comentarios', 'reviews', 'reseñas'],
  ]) {
    const outcome = engagementWriteOutcome(engagementStats[key], engagementRecords[key], currentEvidence, label);
    if (outcome) set('apis-internas', to, outcome.ok, outcome.note, outcome.status,
      { promote: outcome.promote, partial: outcome.partial, pending: outcome.pending === true, evidenceLevel: outcome.evidenceLevel });
  }
  const sheetsWebhook = classifySheetsWebhookProbe(protectedProbes.sheetsWebhook);
  if (sheetsWebhook) {
    const inbound = sheetsInbound || { state: 'none', note: 'acuse de escritura no consultado (falta /api/system-health)' };
    const outcome = sheetsGuardOutcome(sheetsWebhook.ok, sheetsWebhook.status, [inbound]);
    set('apps-script', 'sheets-products-webhook', outcome.ok, `${sheetsWebhook.note} · ${inbound.note}`,
      outcome.ok ? sheetsWebhook.status : outcome.status, { promote: outcome.promote, partial: outcome.partial, evidenceLevel: outcome.evidenceLevel });
  }
  const rulesOk = favoriteRules?.ok === true && notificationRules?.ok === true;
  if (favoriteRules || notificationRules) {
    set('cf-functions', 'reglas-firestore', rulesOk,
      `SDK Firestore autenticado · paths protegidos=${rulesOk ? 'permitidos' : 'no confirmados'}`,
      rulesOk ? 200 : (favoriteRules?.status || notificationRules?.status || 0), { evidenceLevel: EVIDENCIA.LIVE_PRODUCTION });
  }
  if (typeof checks.firebase === 'boolean' && (favoriteRules || notificationRules)) {
    const firestoreAuthorityOk = checks.firebase === true && rulesOk;
    set('admin-guard', 'firestore-fuente-verdad', firestoreAuthorityOk,
      `Firebase runtime=${checks.firebase === true} · Rules protegidas=${rulesOk}`,
      firestoreAuthorityOk ? 200 : (favoriteRules?.status || notificationRules?.status || 0), { evidenceLevel: EVIDENCIA.LIVE_PRODUCTION });
  }
  const auditPassed = ciCheckPassed(currentEvidence, 'repositoryAudit');
  const deploymentPassed = ciCheckPassed(currentEvidence, 'cloudflarePages');
  if (currentEvidence?.commit) {
    const anyFailed = ciCheckFailed(currentEvidence, 'repositoryAudit') || ciCheckFailed(currentEvidence, 'cloudflarePages');
    set('github-actions', 'pruebas-automatizadas', auditPassed,
      ciNote(currentEvidence, 'repositoryAudit', 'suite automatizada'), 200, {
        evidenceLevel: EVIDENCIA.CI_VERIFIED,
        pending: ciCheckPending(currentEvidence, 'repositoryAudit'),
      });
    set('github-actions', 'deployments', auditPassed && deploymentPassed,
      `${ciNote(currentEvidence, 'repositoryAudit', 'Repository audit')} · ${ciNote(currentEvidence, 'cloudflarePages', 'Cloudflare Pages')}`,
      200,
      {
        evidenceLevel: EVIDENCIA.CI_VERIFIED,
        pending: !anyFailed && !(auditPassed && deploymentPassed),
      });
    const authContractOk = auditPassed;
    for (const [from, to] of [
      ['entrada-login', 'google-btn'],
      ['entrada-login', 'login-codigo'],
      ['google-btn', 'firebase-auth'],
      ['login-codigo', 'firebase-auth'],
      ['firebase-auth', 'redirect-result'],
      ['redirect-result', 'sesion-estado'],
      ['perfil', 'ultimos-datos'],
      ['ultimos-datos', 'perfil'],
    ]) {
      set(from, to, authContractOk,
        `${ciNote(currentEvidence, 'repositoryAudit', 'contratos de acceso/perfil')} · login-profile + login-isolation`,
        200, { evidenceLevel: EVIDENCIA.CI_VERIFIED, pending: ciCheckPending(currentEvidence, 'repositoryAudit') });
    }
    // Bloqueo de cuenta y destino por rol son decisiones del propio sitio.
    // El Repository audit del commit actual ejecuta ese código real (no lee su
    // texto), así que su PASS es la evidencia; sin él no hay verde.
    for (const [from, to, suite] of ACCESS_DECISION_EDGES) {
      set(from, to, auditPassed,
        `${ciNote(currentEvidence, 'repositoryAudit', 'Repository audit')} · ${suite}`,
        200, { evidenceLevel: EVIDENCIA.CI_VERIFIED, pending: ciCheckPending(currentEvidence, 'repositoryAudit') });
    }
  }

  // Conexiones que incluyen una escritura (pedido, stock, edición desde el
  // panel). Una lectura sola no la certifica y un test solo no prueba
  // producción: quedan verdes únicamente con las dos evidencias a la vez —
  // la lectura real de producción y el Repository audit del commit actual,
  // que ejecuta el código de esa escritura.
  const auditPending = ciCheckPending(currentEvidence, 'repositoryAudit');
  const auditFailed = ciCheckFailed(currentEvidence, 'repositoryAudit');
  const setLiveAndCi = (from, to, liveOk, liveNote, liveStatus, suite) => {
    if (typeof liveOk !== 'boolean') return;
    const status = Number(liveStatus || 0);
    if (!liveOk) {
      set(from, to, false, liveNote, status);
      return;
    }
    if (!currentEvidence?.commit) {
      set(from, to, true, `${liveNote}; falta la evidencia de CI del commit actual (${suite})`, status,
        { promote: false, partial: true, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION_READ_ONLY });
      return;
    }
    const note = `${liveNote} · ${ciNote(currentEvidence, 'repositoryAudit', 'Repository audit')} · ${suite}`;
    if (auditFailed) {
      set(from, to, false, note, 200, { evidenceLevel: EVIDENCIA.CI_VERIFIED });
      return;
    }
    set(from, to, true, note, status, { promote: auditPassed, pending: auditPending, evidenceLevel: EVIDENCIA.LIVE_PRODUCTION });
  };
  setLiveAndCi('apis-internas', 'pedidos', typeof admin.orders === 'boolean' ? admin.orders : undefined,
    `GET /api/health · admin.orders=${admin.orders === true} (lectura server-side de pedidos)`,
    publicHealth?.status, WRITE_CONTRACT_SUITES.orders);
  setLiveAndCi('pedidos', 'inventario',
    typeof admin.orders === 'boolean' && typeof admin.productInventory === 'boolean' ? admin.orders && admin.productInventory : undefined,
    `GET /api/health · admin.orders=${admin.orders === true} · admin.productInventory=${admin.productInventory === true}`,
    publicHealth?.status, WRITE_CONTRACT_SUITES.stock);
  for (const [to, key, label] of [
    ['productos', 'products', 'productos'],
    ['pedidos', 'orders', 'pedidos'],
  ]) {
    const probe = protectedProbes.firestoreRules?.[key];
    if (!probe) continue;
    setLiveAndCi('super-panel', to, probe.ok === true,
      `SDK Firestore con la sesión del panel · lectura de ${label} ${probe.ok === true ? 'permitida' : 'no confirmada'}`,
      probe.status, WRITE_CONTRACT_SUITES.panel);
  }

  // Carrito: la clienta escribe directo en users/{uid}/cart. La lectura con
  // la sesión real prueba las Rules desplegadas; el alta, la edición y la
  // baja las ejecuta el Repository audit contra esas mismas Rules.
  const cartRules = protectedProbes.firestoreRules?.cart;
  if (cartRules) {
    setLiveAndCi('firestore', 'carrito', cartRules.ok === true,
      `SDK Firestore autenticado · lectura del carrito propio ${cartRules.ok === true ? 'permitida' : 'no confirmada'}`,
      cartRules.status, WRITE_CONTRACT_SUITES.cart);
  }

  // Correos: la evidencia real es la entrega confirmada de cada pedido pagado
  // (notificationStatus=sent lo escribe el servidor cuando Resend acepta) y la
  // cola de reintentos sin correos perdidos. No envía ningún correo de prueba.
  const emailDelivery = classifyOrderEmailDelivery(report);
  if (emailDelivery) {
    set('apis-internas', 'correos', emailDelivery.ok, emailDelivery.note, emailDelivery.ok ? systemHealth.status : 503, {
      promote: emailDelivery.delivered,
      partial: emailDelivery.ok && !emailDelivery.delivered,
      evidenceLevel: emailDelivery.delivered ? EVIDENCIA.LIVE_PRODUCTION : EVIDENCIA.LIVE_PRODUCTION_READ_ONLY,
    });
  }
  return out;
}
