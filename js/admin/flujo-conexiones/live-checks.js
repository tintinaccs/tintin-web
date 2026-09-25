// =============================================================
// TINTIN ACCESORIOS — Normalización de probes en vivo (puro)
// =============================================================
// Traduce las respuestas de /api/health, /api/system-health,
// /api/admin-runtime-health y los headers de admin.html en evidencia por
// nodo/conexión que estado-flujo.js puede resolver. No depende del DOM ni
// de Firebase: solo de los cuerpos JSON ya obtenidos, para que sea probable
// con node --test sin red ni navegador.
import { EDGES } from './datos-flujo-conexiones.js?v=tintin-20260925-cache-converge-1';
import { EVIDENCIA } from './estado-flujo.js?v=tintin-20260920-admin-status-fixes-1';

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

export function buildLiveChecks({ publicHealth, systemHealth, adminHealth, headers, routeProbes = {}, protectedProbes = {}, sessionProbe = {}, currentEvidence }, checkedAt) {
  const out = {};
  const setFrom = (id, ok, note, options = {}) => {
    if (typeof ok !== 'boolean') return;
    out[id] = {
      ok,
      note,
      status: Number(options.status || 200),
      evidenceLevel: options.evidenceLevel || EVIDENCIA.LIVE_PRODUCTION_READ_ONLY,
      promote: options.promote === true,
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
      `SDK Firebase Auth · token de la sesión actual ${sessionOk ? 'válido' : 'no confirmado'}`,
      { status: sessionProbe.status, promote: sessionOk, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
    setFrom('sesion-estado', sessionOk,
      `onAuthStateChanged · usuario actual ${sessionOk ? 'disponible' : 'no confirmado'}`,
      { status: sessionProbe.status, promote: sessionOk, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
    setFrom('roles', sessionProbe.role === true,
      `Rol efectivo del panel · ${sessionProbe.role === true ? 'superadmin confirmado' : 'no confirmado'}`,
      { status: sessionProbe.status, promote: sessionProbe.role === true, evidenceLevel: LP, authRequired: sessionProbe.authRequired === true });
    setFrom('perfil', sessionProbe.profile === true,
      `SDK Firestore · perfil de la sesión actual ${sessionProbe.profile === true ? 'disponible' : 'no confirmado'}`,
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
    setFrom('google-sheets', integrations.sheets === true,
      'GET /api/system-health · protocolo de sincronización confirmado', { status: systemHealth.status, promote: integrations.sheets === true, evidenceLevel: LP });
    const paypalOk = integrations.paypal?.configured === true;
    const externalServicesOk = integrations.resend === true && integrations.cloudinary === true && paypalOk;
    setFrom('servicios-externos', externalServicesOk,
      `GET /api/system-health · Resend=${integrations.resend === true} · Cloudinary=${integrations.cloudinary === true} · PayPal=${paypalOk ? 'configurado' : 'no configurado'}`,
      { status: systemHealth.status, promote: externalServicesOk, evidenceLevel: LP });
    if (report.deployment?.commitSha) {
      setFrom('deployments', true, `GET /api/system-health · commit ${report.deployment.commitSha.slice(0, 10)} (${report.deployment.branch || 'branch desconocida'})`, { promote: true, evidenceLevel: LP });
    }
  }
  if (headers) {
    setFrom('csp', headers.csp === true, `GET /admin.html · CSP ${headers.csp ? 'presente' : 'ausente'}`, { status: headers.status, promote: headers.csp === true, evidenceLevel: LP });
  }

  // Estas cuatro lecturas no mutan datos: dos pasan por las APIs reales y
  // dos por el SDK cliente. Juntas comprueban endpoint, Firebase Auth, Rules
  // desplegadas y la colección correspondiente, sin marcar favoritos ni
  // notificaciones como leídos.
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
      promote: ok,
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
    const paypalOk = report.integrations.paypal.configured === true;
    set('apis-internas', 'servicios-externos', paypalOk && report.integrations.resend === true && report.integrations.cloudinary === true,
      `GET /api/system-health · externos configurados=${paypalOk && report.integrations.resend === true && report.integrations.cloudinary === true}`,
      systemHealth.status);
  }
  if (report?.integrations?.sheets !== undefined) {
    set('apps-script', 'google-sheets', report.integrations.sheets === true,
      'GET /api/system-health · protocolo Sheets', systemHealth.status);
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
  }
  return out;
}
