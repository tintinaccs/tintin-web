'use strict';

/* =============================================================
   TINTIN — Auditoría de Estadísticas, Auditoría y Diagnóstico

   El dashboard, las estadísticas, la presencia/visitantes, la auditoría y el
   diagnóstico ya tenían cobertura parcial (audit-admin-foundation.js,
   audit-diagnostics.js, audit-diagnostic-findings.js, audit-security-phase8.js).
   Esta auditoría fija las invariantes que faltaban blindar de punta a punta:

   - Los indicadores NO muestran "0" cuando la consulta está cargando o falló:
     se diferencia vacío vs error/cargando mostrando "—", igual que pedidos/
     usuarios. Cada fuente (pedidos, usuarios, productos, tráfico, presencia)
     tiene su bandera de disponibilidad.
   - Zona horaria de Paraguay (America/Asuncion) para agrupar por día.
   - Pedidos cancelados/rechazados quedan fuera de facturación y ticket promedio.
   - Privacidad: nunca se guarda ni se devuelve IP, GPS, coordenadas ni código
     postal — solo ciudad/región/país aproximados; identificadores aleatorios
     que rotan por día; todo bajo consentimiento de estadísticas.
   - Auditoría inmutable con actor, acción, fecha y objetivo; acciones masivas
     marcadas; exportación de solo lectura.
   - Diagnóstico real gateado al Super Admin real.

   No abre navegador: comprobaciones estáticas sobre el código publicado.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const admin    = read('js/admin-app.js');
const activity = read('js/site-activity.js');
const geoFn    = read('functions/api/visitor-geo.js');
const orderStats = read('js/order-stats.js');
const rules    = read('firestore.rules');

// ===========================================================================
// 1. NO MOSTRAR "0" CUANDO LA CONSULTA FALLÓ / ESTÁ CARGANDO
// ===========================================================================
check(
  'Hay una bandera de disponibilidad por cada fuente (pedidos/usuarios/productos/tráfico/presencia)',
  admin.includes('let adminRealtimeReady = { orders: false, users: false, products: false, traffic: false, presence: false }'),
  'Sin bandera por fuente no se puede diferenciar "vacío" de "cargando/error".'
);
check(
  'Visitantes y sesiones muestran "—" (no "0") si el tráfico no está disponible',
  admin.includes("statisticsSetText('statistics-visitors', adminRealtimeReady.traffic ? String(uniqueVisitors) : '—')") &&
    admin.includes("statisticsSetText('statistics-sessions', adminRealtimeReady.traffic ?"),
  'Una lectura fallida de siteTraffic no debe presentarse como "0 visitantes".'
);
check(
  'La conversión exige pedidos Y tráfico disponibles y un denominador real',
  admin.includes('adminRealtimeReady.orders && adminRealtimeReady.traffic && uniqueVisitors ?'),
  'La conversión no debe calcularse (ni mostrarse "0%") sobre datos que no cargaron.'
);
check(
  'El indicador "En línea" muestra "—" (no "0") si la presencia no está disponible',
  admin.includes("statisticsSetText('statistics-online', adminRealtimeReady.presence ? String(activePresence.length) : '—')"),
  'Una lectura fallida de sitePresence no debe presentarse como "0 en línea".'
);
check(
  'Productos activos y stock bajo muestran "—" (no "0") si productos no está disponible',
  admin.includes("statisticsSetText('statistics-active-products', adminRealtimeReady.products ? String(activeProducts.length) : '—')") &&
    admin.includes("statisticsSetText('statistics-low-stock', adminRealtimeReady.products ?"),
  'Sin productos cargados no debe decirse "0 con stock bajo".'
);
check(
  'Usuarios bloqueados muestra "—" (no "0") si usuarios no está disponible',
  admin.includes("statisticsSetText('statistics-blocked-users', adminRealtimeReady.users ?"),
  'El conteo de bloqueados debe respetar la disponibilidad de usuarios.'
);
// Prueba negativa: el patrón viejo (sin bandera) NO debe seguir presente.
check(
  'No quedó ningún indicador de estadísticas mostrando el conteo crudo sin bandera',
  !admin.includes("statisticsSetText('statistics-visitors', String(uniqueVisitors))") &&
    !admin.includes("statisticsSetText('statistics-online', String(activePresence.length))") &&
    !admin.includes("statisticsSetText('statistics-active-products', String(activeProducts.length))"),
  'El patrón anterior mostraba "0" ante un fallo; no debe quedar ninguna variante sin proteger.'
);
check(
  'El tráfico marca su disponibilidad al cargar y la retira al fallar',
  admin.includes('adminRealtimeReady.traffic = true;') &&
    admin.includes('adminRealtimeReady.traffic = false;'),
  'listenStatisticsTraffic debe encender/apagar la bandera según el resultado real.'
);
check(
  'La presencia y los productos marcan disponibilidad y re-renderizan al fallar',
  admin.includes('adminRealtimeReady.presence = true;') &&
    admin.includes('adminRealtimeReady.presence = false;') &&
    admin.includes('adminRealtimeReady.products = true;') &&
    admin.includes('adminRealtimeReady.products = false;'),
  'Al fallar la lectura, el indicador debe volver a "—", no quedar en un valor viejo o "0".'
);

// ===========================================================================
// 2. ZONA HORARIA DE PARAGUAY
// ===========================================================================
check(
  'Las estadísticas agrupan por día en la zona horaria de Paraguay',
  admin.includes("timeZone: 'America/Asuncion'") &&
    /function statisticsDayKey\(value\)/.test(admin),
  'Sin America/Asuncion, un pedido de la noche caería en el día equivocado.'
);
check(
  'La analítica del sitio también usa la zona horaria de Paraguay',
  activity.includes("timeZone: 'America/Asuncion'") &&
    /function paraguayDayKey\(\)/.test(activity),
  'La sesión debe contarse por día de Paraguay, no por UTC ni por la hora del visitante.'
);

// ===========================================================================
// 3. CÁLCULOS: CANCELADOS FUERA DE FACTURACIÓN, TICKET PROMEDIO, TOTALES
// ===========================================================================
check(
  'Los pedidos cancelados/rechazados quedan fuera de la facturación',
  /function statisticsOrderIsValid\(order\)/.test(admin) &&
    admin.includes("['cancelado', 'rechazado'].includes(order?.status"),
  'La facturación no debe incluir pedidos cancelados o rechazados.'
);
check(
  'El ticket promedio divide entre pedidos válidos con guardia de cero',
  admin.includes('adminRealtimeReady.orders && validOrders.length ? formatPrice(revenue / validOrders.length) : ') ,
  'El ticket promedio no debe dividir por cero ni calcularse sobre datos no cargados.'
);
check(
  'El gasto por usuaria excluye cancelados y nunca es negativo',
  orderStats.includes('const validForSpent = clean.filter(o => !isCancelled(o))') &&
    orderStats.includes('Math.max(0, validForSpent.reduce('),
  'Un total de gasto no debe incluir cancelados ni volverse negativo.'
);

// ===========================================================================
// 4. PRIVACIDAD: NADA DE IP / GPS / COORDENADAS
// ===========================================================================
check(
  'La analítica solo maneja geo aproximada (ciudad/región/país), nunca IP ni GPS',
  activity.includes('nunca IP, GPS, coordenadas') &&
    !activity.includes('getCurrentPosition') &&
    !/latitude|longitude/i.test(activity),
  'El cliente no debe capturar ni enviar IP, coordenadas ni geolocalización precisa.'
);
check(
  'El servicio de geo nunca devuelve IP, coordenadas ni código postal',
  geoFn.includes('approximate: true') &&
    geoFn.includes('Nunca se devuelve IP') &&
    !/latitude|longitude|postalCode/i.test(geoFn),
  'El endpoint de geo solo debe devolver datos aproximados de ubicación.'
);
check(
  'Las reglas fijan los campos permitidos de presencia (sin IP/GPS/postal)',
  /function presenceIsValid\(visitorId\)/.test(rules) &&
    /data\.keys\(\)\.hasOnly\(\[\s*'visitorId', 'sessionId', 'userId', 'page', 'lastSeen',\s*'city', 'region', 'country', 'countryCode', 'geoSource'/.test(rules),
  'hasOnly debe bloquear cualquier campo extra (ip, lat, lng, postal) del lado del servidor.'
);
check(
  'Las reglas fijan los campos permitidos de las sesiones de tráfico',
  /function trafficSessionIsValid\(dateKey, sessionId\)/.test(rules) &&
    /data\.keys\(\)\.hasOnly\(\[\s*'dayKey', 'sessionId', 'visitorId', 'userId', 'landingPage', 'startedAt',\s*'city', 'region', 'country', 'countryCode', 'geoSource'/.test(rules),
  'Las sesiones no deben poder guardar IP ni coordenadas.'
);
check(
  'La analítica es consentida y con identificadores que rotan por día',
  activity.includes('hasStatisticsConsent') &&
    /function dailyId\(storage, key, prefix, dayKey\)/.test(activity) &&
    activity.includes('onPrivacyConsentChange'),
  'Sin consentimiento no debe registrarse actividad, y el ID no debe ser permanente.'
);

// ===========================================================================
// 5. SESIONES / PRESENCIA (sin duplicados, con limpieza de listeners)
// ===========================================================================
check(
  'La sesión se registra una sola vez por pestaña y día',
  activity.includes('SESSION_RECORDED_PREFIX') &&
    activity.includes('recordedKey) === sessionId') ,
  'Sin marca de registro, cada recarga duplicaría la sesión del día.'
);
check(
  'El heartbeat de presencia se detiene al ocultar la pestaña o al salir',
  activity.includes("document.addEventListener('visibilitychange'") &&
    activity.includes("window.addEventListener('pagehide'") &&
    activity.includes('clearInterval(heartbeatTimer)'),
  'El heartbeat no debe seguir corriendo con la pestaña oculta o cerrada.'
);
check(
  'Las páginas de administración no se rastrean como visitas del sitio',
  activity.includes("from './admin-path.js") &&
    activity.includes('const trackablePage = !isAdminPage()'),
  'El panel no debe contarse como tráfico público.'
);
check(
  'Los listeners del panel se liberan al salir de la página',
  admin.includes("window.addEventListener('pagehide', stopAdminRealtimeData)") &&
    admin.includes("window.addEventListener('pagehide', stopDashboardActivityMetrics)"),
  'Los listeners en tiempo real deben cerrarse para no filtrar lecturas.'
);

// ===========================================================================
// 6. AUDITORÍA INMUTABLE (actor / acción / fecha / objetivo / masivas)
// ===========================================================================
check(
  'Cada registro de auditoría guarda actor, acción, objetivo, fecha y si fue masivo',
  admin.includes('actorEmail: currentUser?.email') &&
    admin.includes('actorRole: currentRole') &&
    admin.includes('bulk: !!(meta && meta.bulk)') &&
    admin.includes('createdAt: serverTimestamp()'),
  'El log debe registrar quién, qué, sobre qué, cuándo y si fue una acción en lote.'
);
check(
  'La auditoría es inmutable en las reglas (no se edita ni se borra)',
  /match \/auditLog\/\{logId\}[\s\S]{0,240}allow read: if isSuperAdmin\(\)[\s\S]{0,260}allow update, delete: if false;/.test(rules),
  'Un registro de auditoría no debe poder modificarse ni eliminarse.'
);
check(
  'La tabla de auditoría diferencia cargando, error y vacío',
  admin.includes('Cargando...') &&
    admin.includes('Error al cargar la auditoría') &&
    admin.includes('Todavía no hay acciones registradas'),
  'Auditoría debe distinguir claramente los tres estados, no mostrar vacío ante un error.'
);
check(
  'Sobre la selección de auditoría solo se puede exportar (nunca modificar)',
  admin.includes('window.bulkExportAuditLog = function()') &&
    admin.includes('downloadCsv(`auditoria_'),
  'La única acción masiva sobre la auditoría debe ser exportar, no editar ni borrar.'
);

// ===========================================================================
// 7. PRESENCIA/TRÁFICO: LECTURA SOLO SUPER ADMIN + DIAGNÓSTICO REAL
// ===========================================================================
check(
  'Solo el Super Admin lee la presencia y el tráfico',
  /match \/sitePresence\/\{visitorId\}[\s\S]{0,80}allow read, delete: if isSuperAdmin\(\)/.test(rules) &&
    /match \/siteTraffic\/\{dateKey\}\/sessions\/\{sessionId\}[\s\S]{0,120}allow read, delete: if isSuperAdmin\(\)/.test(rules) &&
    /match \/siteTraffic[\s\S]{0,320}allow update: if false;/.test(rules),
  'Los datos de visitantes no deben ser legibles por otros roles y las sesiones no deben editarse.'
);
check(
  'El diagnóstico del sitio se inicia solo para el Super Admin real',
  admin.includes("role === 'superadmin' && user.email === SUPER_ADMIN") &&
    admin.includes('initSiteDiagnostics({ role })'),
  'El diagnóstico no debe ejecutarse para un rol que no sea el Super Admin real.'
);

// ===========================================================================
// 8. LÍMITES / PAGINACIÓN / GUARDIAS DE CONSULTA
// ===========================================================================
check(
  'El historial de tráfico se lee paginado y con tope de seguridad',
  admin.includes('getDocsPaginated(collection(db, ') &&
    admin.includes('maxDocs: 5000'),
  'Una lectura sin tope podría traer un volumen peligroso de documentos.'
);
check(
  'La recalculación global de estadísticas corta si supera el límite seguro',
  orderStats.includes('getDocsPaginated(collection(db, ') &&
    orderStats.includes('usersSnap.truncated || ordersSnap.truncated') &&
    orderStats.includes('límite seguro'),
  'La recalculación masiva no debe procesar datos truncados como si fueran completos.'
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de estadísticas/auditoría/diagnóstico fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de estadísticas/auditoría/diagnóstico completada correctamente (${checks.length} comprobaciones).`);
