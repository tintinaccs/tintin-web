import { normalizeAdminSearch, debounceAdminSearch } from './datos/busqueda-admin.mjs?v=tintin-20261028-search-admin-1';
import { iniciarCorreos } from './correos/correos-admin.js?v=tintin-20261028-correos-1-editor-search-20261028-2';
import {adminEventAttributes,installAdminEvents} from './eventos-dinamicos-admin.mjs?v=tintin-20261027-save-csp-1';
import {mountProductWorkspace} from './products/espacio-trabajo-producto.js?v=tintin-20261028-product-tabs-3-editor-search-20261028-2-guiado-1269-20261029-1';
import {readProductEditorResponse} from './products/respuesta-editor-producto.mjs?v=tintin-20261027-editor-ux-1';
import {ensureEditorialFields} from './products/editor-editorial-interfaz.js?v=tintin-20261024-editor-shopify-1-editor-search-20261028-2-guiado-1269-20261029-1';
import {editorialFields,productEditorialStatus,productTemplate} from '../core/store/estado-editorial-producto.mjs?v=tintin-20261024-editor-v2-6';
import {productStatistics} from './statistics/estadisticas-producto.mjs?v=tintin-20261024-editor-v2-3';
import {commercialDraft} from './products/editor-comercial-core.mjs?v=tintin-20261026-editor-phase6-1';
import {mountCommercialEditor} from './products/editor-comercial-interfaz.js?v=tintin-20261029-performance-2';
import { reorderVariantInventory, variantAttributes } from '../core/store/inventario-variantes.mjs?v=tintin-20261023-variant-engine-v2-2';
import { ordersForView, orderDisplayCode } from '../orders/pedidos-prueba.mjs?v=tintin-20261020-orders-clean-2';
import { calculateOrderStats } from '../core/store/estadisticas-pedidos.js?v=tintin-20261020-orders-clean-2';
import { adminReturnStorage, rememberAdminDestination, consumeAdminDestination } from '../core/auth/destino-admin.mjs?v=tintin-20261020-push-return-1';
import { closeMobileMore } from './maestro/navegacion-movil-admin.js?v=tintin-20261025-mobile-shell-1';
import { productCardPatch, productFingerprint, productDuplicateData, applyProductBulkTransaction, productBulkIds } from './products/maestro-productos-core.mjs?v=tintin-20261024-editor-v2-4';
import { filterStatisticsRows, ensureStatisticsControls } from './statistics/controles-estadisticas.js?v=tintin-20261022-avatar-inicial-1';
import { chooseOrderTrash } from './orders/seleccion-devolucion.mjs?v=tintin-20261017-stat-controls-1';
import { createAdminPagedSource } from './datos/fuente-paginada-admin.mjs?v=tintin-20261016-admin-live-1';
import { withAdminSiteChange } from '../core/store/publicar-cambio-administrativo.js?v=tintin-20261017-domain-cutover-1';
import { wristCategory, unifyWristCollections } from '../core/store/categorias-pulseras.mjs?v=tintin-20261014-pulseras-2';
import { attachProductGallery } from './products/galeria-unificada.js?v=tintin-20261030-home-history-5';
import { allowedOrderStatuses, orderStatusLabel } from '../orders/ciclo-pedido.mjs?v=tintin-20261012-orders-board-1';
import { createAdminOrderSource, reconcileAdminOrderSnapshot } from './orders/fuente-pedidos-admin.mjs?v=tintin-20261013-orders-board-4-fuente-pedidos-admin-mjs-admin-live-20261016-1';
import { auth, db } from "../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1";
import { waitForAdminAppCheck, recoverAdminSecurity } from "./auth/app-check-admin.js?v=tintin-20261017-domain-cutover-1";
import { logoutSession } from '../core/auth/salida-sesion.js?v=tintin-20261022-avatar-inicial-1';
import { AUTH_STATES, subscribeSession, readAuthHandoff, clearAuthHandoff } from "../core/auth/coordinador-sesion.js?v=tintin-20261022-avatar-inicial-1";
import { recordAuthDiagnostic } from "../core/auth/diagnostico-sesion.js?v=tintin-20261012-auth-privacy-1-diagnostico-sesion-js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, addDoc,
  query, orderBy, limit, startAfter, where, writeBatch, serverTimestamp, increment, onSnapshot, Timestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { sendTestCustomerEmail, sendTemplatedEmail, sendBulkTemplatedEmail } from "../email/notificaciones-correo.js?v=tintin-20261029-performance-1";
// El reenvío de correos de pedido usa el mismo camino por Resend que el envío
// automático del checkout (js/pages/checkout/checkout-puente-correo.js), no el webhook viejo
// de Apps Script de notificaciones-correo.js — evita reenviar por un canal que ya no
// se usa para pedidos reales.
import { sendOrderNotification } from "../email/notificacion-pedido-resend.js?v=tintin-20261017-domain-cutover-1";
import { getUserRole, SUPER_ADMIN, ROLE_LABELS, can } from "../core/auth/roles.js?v=tintin-20261017-domain-cutover-1";
import { ASSIGNABLE_ROLES } from '../core/auth/contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';
import {
  PERMISSION_MODULES, EDITABLE_ROLES, loadRolePermissions, getRolePermissionsCache,
  canDo, saveRolePermissions, buildDefaultRolePermissions
} from "../core/auth/permisos-roles.js?v=tintin-20261022-avatar-inicial-1";
import { EMAIL_WEBHOOK_URL } from "../email/configuracion-correo.js?v=tintin-20260925-cache-converge-1";
import { getStoreAccessConfig, isAccessAllowed, renderStoreClosedOverlay, renderStoreConfigUnavailableOverlay } from "../core/store-gate/nucleo-control-tienda.js?v=tintin-20261030-home-history-5";
import { normalizeCollectionDoc } from "../pages/collections/estado-colecciones.js?v=tintin-20261030-home-history-5";
import { sanitizeImageUrl } from "../components/images/utilidades-imagenes.js?v=tintin-20261030-home-history-5";
import { sanitizeVariantData } from "../core/auth/utilidades-seguridad.js?v=tintin-20260716-cloudinary-fix-1";
import { variantInventoryEntries } from '../core/store/inventario-variantes.mjs?v=tintin-20261023-variant-engine-v2-2';
import { authenticatedFetch } from "../core/auth/cliente-api-autenticado.js?v=tintin-20261022-avatar-inicial-1";
import { getDocsPaginated } from "../core/firebase/paginacion-firestore.js?v=tintin-20260925-cache-converge-1";
import { attachImageUploadWidget, attachMultiImageUploadWidget } from "../components/images/carga-imagenes.js?v=tintin-20261025-gallery-unified-1";
import { openMediaLibraryPicker } from "./products/biblioteca-multimedia-admin.js?v=tintin-20261019-variant-links-1-editor-search-20261028-2";
import { initSiteDiagnostics } from "./diagnostics/diagnostico-sitio-admin.js?v=tintin-20261017-domain-cutover-1-editor-search-20261028-2";
import { initWholesaleAdmin } from "./mayoristas/mayoristas-admin.js?v=tintin-20261030-home-history-5";
import { initConnectionsFlow } from "./flujo-conexiones/flujo-conexiones-admin.js?v=tintin-20261022-avatar-inicial-1-editor-search-20261028-2";
import "./pages/paginas-admin.js?v=tintin-20261022-avatar-inicial-1-editor-search-20261028-2";
import { PARAGUAY_LOCATIONS, FITOXPRESS_DELIVERY_CITIES } from "../components/location/ubicaciones-paraguay.js?v=tintin-20260725-paraguay-locations-1-master-20261007-1";
import {
  GLOBAL_TOKENS, GLOBAL_CATEGORIES,
  GLOBAL_CONTRAST_PAIRS, DEVICE_BREAKPOINTS,
  findTokenByKey, buildDefaultTokenMap
} from "../components/color/esquema-color-catalogo.js?v=tintin-20261012-unified-2-esquema-color-catalogo-js-palette-20261014-1-logos-wa-20261015-1";
import { contrastRatio, passesWcag } from "../components/color/utilidades-contraste-color.js?v=tintin-20260925-cache-converge-1";
import { attachColorPicker } from "../components/color/selector-color.js?v=tintin-20260925-cache-converge-1-brand-runtime-20261004-1-owner-pink-20261004-1";
import './orders/pedidos-superadmin-crud.js?v=tintin-20261030-home-history-5';
import './settings/cupones-admin.js?v=tintin-20261022-avatar-inicial-1';
import './products/integridad-inventario-admin.js?v=tintin-20261023-variant-engine-v2-2';
import { runAdminBulk } from './utilidades-progreso-admin.js?v=tintin-20261010-loader-front-2';
import { setOperationsViewerRole } from './operaciones/sistema-operaciones-admin.js?v=tintin-20261010-loader-front-2';

// ---- GLOBALS ----
let currentUser = null;
let currentRole = null;
let adminGuardInitializedUid = '';
// Firebase puede publicar más de una confirmación durante una navegación
// mientras otros módulos terminan de restaurarse. No arrancar dos veces la
// carga pesada del panel para el mismo usuario: las carreras duplicaban
// listeners, probes y overlays, y podían parecer un logout intermitente.
let adminGuardInitializingUid = '';
let allUsers = [];
let allOrders = [];
let rawAdminOrders = [];
function includesTestOrders() {
  if (currentRole !== 'superadmin' || !currentUser?.uid) return false;
  try { return localStorage.getItem(`tt-test-orders:${currentUser.uid}`) === 'show'; } catch { return false; }
}
function projectAdminOrders() {
  allOrders = ordersForView(rawAdminOrders, includesTestOrders());
}
function projectAdminUserStats() {
  if (!adminRealtimeReady.orders || currentRole !== 'superadmin') return;
  const byUid=new Map(),byEmail=new Map();
  for(const order of allOrders){
    if(order.userId){if(!byUid.has(order.userId))byUid.set(order.userId,[]);byUid.get(order.userId).push(order);}
    const email=String(order.userEmail||'').trim().toLowerCase();
    if(email){if(!byEmail.has(email))byEmail.set(email,[]);byEmail.get(email).push(order);}
  }
  allUsers = adminUsersLive.map(user => {
    const email = String(user.email || '').trim().toLowerCase();
    const orders = [...(byUid.get(user.uid)||[]),...(byEmail.get(email)||[])];
    return { ...user, ...calculateOrderStats(orders, { includeTestOrders: includesTestOrders() }) };
  }).sort(compareUsersByRecentCustomerActivity);
}
let adminOrdersUnsubscribe = null;
let adminUsersUnsubscribe = null;
let adminUsersLive = [];
// Nunca volver a descargar miles de documentos al abrir el panel. El panel
// debe trabajar con la ventana operativa reciente; las fichas y exportaciones
// consultan el documento o la página concreta que se necesita.
const ADMIN_REALTIME_LIMIT = 250;
const MAX_ADMIN_BULK_SELECTION = 30;

function rejectOversizedAdminBulkSelection(values, label = 'elementos') {
  const count = Array.isArray(values) ? values.length : values?.size || 0;
  if (count <= MAX_ADMIN_BULK_SELECTION) return false;
  toast(`Solo se pueden procesar ${MAX_ADMIN_BULK_SELECTION} ${label} por vez.`);
  return true;
}
function addAdminBulkSelection(set, id, checked, label = 'elementos') {
  if (!checked) { set.delete(id); return true; }
  if (set.size >= MAX_ADMIN_BULK_SELECTION && !set.has(id)) {
    toast(`Solo se pueden seleccionar ${MAX_ADMIN_BULK_SELECTION} ${label} por vez.`);
    return false;
  }
  set.add(id);
  return true;
}
// Cada bandera indica si esa consulta ya resolvió al menos una vez con éxito.
// Sirve para NO mostrar "0" cuando en realidad la consulta está cargando o
// falló (permisos/conexión) — en ese caso el indicador muestra "—", igual que
// los de pedidos/usuarios, y así se diferencia "vacío" de "error/cargando".
let adminRealtimeReady = { orders: false, users: false, products: false, traffic: false, presence: false };
let adminRealtimeErrors = { orders: '', users: '' };
let adminRealtimeAuthRecoveryAttempted = false;
let adminRealtimeAuthRecoveryPromise = null;
let statisticsTrafficSessions = [];
let statisticsTrafficHistorySessions = [];
let statisticsRangeDays = 7;
let statisticsTrafficLoadToken = 0;
let dashboardSessionUnsubscribe = null;
let dashboardPresenceUnsubscribe = null;
let dashboardAggregateUnsubscribe = null;
let dashboardActivityClock = 0;
let dashboardPresenceRestart = 0;
let dashboardActivityDay = '';
let dashboardActivityState = { sessions: [], presence: [], totalVisits: null };
let adminSettingsUnsubscribers = [];
const SHEETS_PRODUCT_SYNC_URL = '/api/sheets-product-sync';
let authReadyDiagnosticRecorded = false;
let coordinatorReadyDiagnosticRecorded = false;

recordAuthDiagnostic('AUTH_RESTORE_START', { source: 'admin-guard' });

function clearAdminAuthHandoffWithDiagnostic() {
  const handoff = readAuthHandoff();
  if (handoff) recordAuthDiagnostic('HANDOFF_FOUND', { source: 'admin-guard', legacy: Boolean(handoff.legacy) });
  clearAuthHandoff();
  if (handoff) recordAuthDiagnostic('HANDOFF_CLEARED', { source: 'admin-guard' });
}

// admin.html <-> login.html se navegan como documentos completos: cada carga
// reinicia el coordinador de sesión desde cero. Si la restauración de Firebase
// no confirma la identidad a tiempo en cargas sucesivas, cada página redirige
// a la otra sin memoria del intento anterior y el resultado es un rebote
// infinito. Este contador (por pestaña, vía sessionStorage) detecta esa
// repetición y corta el ciclo mostrando el aviso manual en vez de seguir
// redirigiendo solo.
const ADMIN_LOGIN_BOUNCE_KEY = 'tt_admin_login_bounce_v1';
const ADMIN_LOGIN_BOUNCE_WINDOW_MS = 15000;
const ADMIN_LOGIN_BOUNCE_LIMIT = 2;

function registerAdminLoginBounceAndShouldBreakLoop() {
  let record = null;
  try {
    const raw = sessionStorage.getItem(ADMIN_LOGIN_BOUNCE_KEY);
    record = raw ? JSON.parse(raw) : null;
  } catch { record = null; }
  const now = Date.now();
  if (!record || !Number.isFinite(record.firstAt) || now - record.firstAt > ADMIN_LOGIN_BOUNCE_WINDOW_MS) {
    record = { count: 0, firstAt: now };
  }
  record.count += 1;
  const shouldBreak = record.count > ADMIN_LOGIN_BOUNCE_LIMIT;
  try {
    if (shouldBreak) sessionStorage.removeItem(ADMIN_LOGIN_BOUNCE_KEY);
    else sessionStorage.setItem(ADMIN_LOGIN_BOUNCE_KEY, JSON.stringify(record));
  } catch {}
  return shouldBreak;
}

function clearAdminLoginBounceGuard() {
  try { sessionStorage.removeItem(ADMIN_LOGIN_BOUNCE_KEY); } catch {}
}

async function pushProductsToSheets(productIds) {
  const ids = [...new Set((productIds || []).map(id => String(id || '').trim()).filter(Boolean))];
  if (!ids.length || currentRole !== 'superadmin' || currentUser?.email !== SUPER_ADMIN) return false;
  try {
    const idToken = await currentUser.getIdToken();
    // Keep browser pushes aligned with the durable queue chunk size. Apps
    // Script writes several product columns and can time out on large batches.
    for (let i = 0; i < ids.length; i += 20) {
      await fetch(SHEETS_PRODUCT_SYNC_URL, {
        method: 'POST',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          action: 'syncProducts',
        productIds: ids.slice(i, i + 20),
          idToken,
        }),
      }).then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) {
          throw new Error(result.error || `El sincronizador respondió ${response.status}.`);
        }
      });
    }
    return true;
  } catch (error) {
    // El activador de un minuto sigue siendo el respaldo. El guardado real en
    // Firestore no se revierte si solamente falla el aviso inmediato a Sheets.
    console.warn('[Tintin Sync] El push inmediato a Google Sheets falló; queda activo el respaldo de un minuto.', error);
    return false;
  }
}
window.tintinPushProductsToSheets = pushProductsToSheets;

installAdminEvents();

function escapeHtmlAdmin(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}


function paraguayDayKeyAdmin() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Super Admin real (currentRole === 'superadmin') SIEMPRE tiene todo — no es
// una fila editable de la matriz de Roles y Permisos (EDITABLE_ROLES no lo
// incluye a propósito), así que canDo() nunca debe llamarse directo con
// currentRole sin antes chequear esto, o un Super Admin real quedaría
// bloqueado de sus propias acciones apenas exista un doc rolePermissions/main.
function roleCanDo(moduleKey, actionKey) {
  return currentRole === 'superadmin' || canDo(currentRole, moduleKey, actionKey);
}

// Reloj en vivo debajo del badge de rol — fecha y hora reales del
// dispositivo, con segundos, actualizado solo cada segundo (no depende de
// ninguna acción ni de que termine de resolver el login).
(function startLiveClock() {
  const el = document.getElementById('adm-live-clock');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('es-PY', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const tick = () => {
    const s = fmt.format(new Date());
    el.textContent = s.charAt(0).toUpperCase() + s.slice(1);
  };
  tick();
  setInterval(tick, 1000);
})();

// Fuente única de verdad de los estados de pedido/pago — la usan la tabla de
// Pedidos, los <select> de cambio de estado, el modal de edición completa y
// el export a CSV, así que no hay riesgo de que queden nombres distintos o
// mal escritos entre esos lugares. "enviado"/"error" quedan como alias
// legado: pedidos guardados antes de este cambio siguen mostrando algo con
// sentido en vez de un badge vacío o roto, pero ya no son opciones
// elegibles en ningún <select> nuevo.
const ORDER_STATUS_LABELS = {
  pendiente:    'Pendiente',
  confirmado:   'Confirmado',
  preparando:   'En preparación', listo: 'Listo', devuelto: 'Devuelto', incidencia: 'Con incidencia',
  listo_retiro: 'Listo para retirar',
  en_camino:    'En camino',
  entregado:    'Entregado',
  cancelado:    'Cancelado',
  rechazado:    'Rechazado',
  enviado:      'En camino', // legado
};
const ORDER_STATUS_BADGE = {
  pendiente:    'badge-pendiente',
  confirmado:   'badge-confirmado',
  preparando:   'badge-preparando',
  listo_retiro: 'badge-listo',
  en_camino:    'badge-enviado',
  entregado:    'badge-entregado',
  cancelado:    'badge-cancelado',
  rechazado:    'badge-rechazado',
  enviado:      'badge-enviado', // legado
};
const PAY_STATUS_LABELS = {
  pendiente:   'Pago pendiente', parcial: 'Parcialmente pagado',
  pagado:      'Pagado',
  rechazado:   'Rechazado',
  cancelado:   'Cancelado',
  reembolsado: 'Reembolsado',
  error:       'Error', // legado
};
const PAY_STATUS_BADGE = {
  pagado:      'badge-pagado',
  pendiente:   'badge-pendiente',
  rechazado:   'badge-rechazado',
  cancelado:   'badge-cancelado',
  reembolsado: 'badge-reembolsado',
  error:       'badge-cancelado', // legado
};
// Genera las <option> de un <select> de estado directo desde el mapa de
// labels de arriba — un solo lugar define el texto/orden, así el filtro,
// la tabla de Pedidos y el modal de edición completa no pueden desalinearse.
function orderStatusOptions(current) {
  return Object.keys(ORDER_STATUS_LABELS)
    .filter(k => k !== 'enviado') // legado: no elegible, solo se muestra si ya está guardado
    .map(k => `<option value="${k}" ${current===k?'selected':''}>${ORDER_STATUS_LABELS[k]}</option>`)
    .join('');
}
function payStatusOptions(current) {
  return Object.keys(PAY_STATUS_LABELS)
    .filter(k => k !== 'error') // legado: no elegible, solo se muestra si ya está guardado
    .map(k => `<option value="${k}" ${current===k?'selected':''}>${PAY_STATUS_LABELS[k]}</option>`)
    .join('');
}
function orderStatusBadgeHtml(status) {
  const s = status || 'pendiente';
  return `<span class="adm-badge ${ORDER_STATUS_BADGE[s] || 'badge-pendiente'}">${ORDER_STATUS_LABELS[s] || s}</span>`;
}
function payStatusBadgeHtml(status) {
  const s = status || 'pendiente';
  return `<span class="adm-badge ${PAY_STATUS_BADGE[s] || 'badge-pendiente'}" style="font-size:9px">${PAY_STATUS_LABELS[s] || s}</span>`;
}
let waConfirmMessageTemplate = 'Hola {nombre}! Te escribo por tu pedido realizado en nuestra página web. Ya recibimos todos tus datos para el envío y estamos preparando tu pedido. Te escribimos para confirmar los últimos detalles.';
getDoc(doc(db, 'settings', 'general')).then(snap => {
  if (snap.exists() && snap.data().waConfirmMessage) waConfirmMessageTemplate = snap.data().waConfirmMessage;
}).catch(() => {});

// ---- TOAST ----
// Los avisos van al sistema de operaciones (se apilan sin taparse y los
// errores duran más). #adm-toast queda como respaldo si ese módulo no cargó.
function toast(msg, duration = 3000) {
  const message = String(msg || '');
  const crudResult = [
    [/^(Producto (?:actualizado|creado|eliminado|activado|desactivado))/i, 'Producto', 'productos'],
    [/^(Colección (?:renombrada|actualizada|creada|eliminada)|\d+ producto\(s\) movidos)/i, 'Colección', 'colecciones'],
    [/^(\d+ producto\(s\) agregados a la colección|\d+ colección\(es\) (?:activadas|desactivadas|eliminadas)|Producto quitado de la colección)/i, 'Colección', 'colecciones'],
    [/^(Usuario (?:bloqueado|restaurado)|Rol actualizado|\d+ usuario\(s\) (?:bloqueados|restaurados)|Rol actualizado en \d+)/i, 'Cliente', 'clientes'],
    [/^(Pedido (?:actualizado|\S+ movido)|El pedido ya no estaba|Estado actualizado(?::| en)|Estado de pago actualizado|\d+ pedido\(s\) movidos a Borrados)/i, 'Pedido', 'pedidos'],
    [/^(Cuenta eliminada por completo|\d+ cuenta\(s\) eliminadas por completo)/i, 'Cuenta', 'clientes'],
    [/^(Producto quitado de su colección|\d+ productos (?:eliminados definitivamente|\w+)|Stock actualizado en \d+ producto|Precio actualizado en \d+ producto|Oferta .* en \d+ producto|Destacado .* en \d+ producto)/i, 'Producto', 'productos'],
  ].find(([pattern]) => pattern.test(message));
  if (crudResult && window.TintinAdminOps?.runOperation) {
    const [, label, module] = crudResult;
    window.TintinAdminOps.runOperation({
      title: `${label}: resultado`, name: message, module,
      stages: [{ id: 'result', label: 'Resultado de la operación' }],
      notifySuccess: false, showSuccessDialog: true,
      run: async ctx => { ctx.start('result'); ctx.ok('result', { message }); return message; },
    }).catch(error => console.error('[admin-crud-feedback] No se pudo mostrar el resultado:', error));
    return;
  }
  if (window.toast?.__tintinOps) { window.toast(msg, duration); return; }
  const el = document.getElementById('adm-toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// Las acciones CRUD individuales usan el mismo historial/progreso que las
// operaciones masivas y muestran el resultado en el diálogo central.
async function runAdminCrudOperation({ title, module, name, dangerous = false, stages, action }) {
  const runOperation = window.TintinAdminOps?.runOperation;
  if (typeof runOperation !== 'function') {
    throw new Error('El panel de operaciones no está disponible. Recargá el panel e intentá de nuevo.');
  }
  return runOperation({
    title, name, module, dangerous,
    centerLoader: true,
    stages: stages || [{ id: 'crud', label: title }],
    notifySuccess: false,
    showSuccessDialog: true,
    run: action,
  });
}

// ======== AUDITORÍA (Fase 2) ========
// Registro simple e inmutable de acciones sensibles — no un sistema de
// logging completo, solo lo necesario para poder responder "quién hizo qué
// y cuándo". Nunca bloquea la acción real: si el registro falla, la acción
// ya hecha (bloquear, cambiar rol, etc.) queda igual, solo se avisa en consola.
// meta.bulk/meta.count: distingue una acción individual de una masiva sobre
// N registros a la vez — pedido explícito de poder ver en Auditoría cuáles
// acciones fueron "de a una" y cuáles "en lote".
async function logAudit(action, targetType, targetId, targetLabel, details, meta) {
  try {
    const entry = {
      action,
      targetType,
      targetId: targetId || '',
      targetLabel: targetLabel || '',
      details: details || '',
      bulk: !!(meta && meta.bulk),
      bulkCount: (meta && meta.count) || 0,
      actorEmail: currentUser?.email || '',
      actorRole: currentRole || '',
      createdAt: serverTimestamp()
    };
    // Los cambios de precio/stock necesitan una trazabilidad consultable,
    // no solamente una frase humana. Se mantienen en el mismo auditLog
    // canónico para no crear una segunda autoridad ni otra colección paralela.
    if (meta?.productHistory) {
      entry.productHistory = meta.productHistory;
    }
    await addDoc(collection(db, 'auditLog'), entry);
  } catch (e) {
    console.error('No se pudo registrar en auditLog:', e);
  }
}

// Los módulos independientes (por ejemplo Páginas) usan este mismo registro;
// el actor siempre se obtiene de la sesión del panel, nunca del llamador.
window.logAudit = logAudit;

const AUDIT_ACTION_LABELS = {
  editar_pedido:          '📋 Editó pedido',
  cambiar_estado_pedido:  '🔄 Cambió estado de pedido',
  cambiar_estado_pago:    '💳 Cambió estado de pago',
  reenviar_correo_pedido: '✉️ Reenvió correo de pedido',
  eliminar_pedido:        '🗑️ Eliminó pedido',
  mover_pedido_borrados:  '🗑️ Movió pedido a Borrados',
  restaurar_pedido:       '↩️ Restauró pedido',
  reiniciar_estadisticas: '📊 Ajustó el inicio de estadísticas',
  crear_producto:         '➕ Creó producto',
  editar_producto:        '✏️ Editó producto',
  eliminar_producto:      '🗑️ Eliminó producto',
  cambiar_rol:            '👤 Cambió rol',
  bloquear_usuario:       '🚫 Bloqueó usuario',
  restaurar_usuario:      '✅ Restauró usuario',
  eliminar_usuario:       '🗑️ Eliminó usuario',
  plantilla_creada:       '➕ Duplicó plantilla',
  plantilla_archivada:    '🗄️ Archivó/reactivó plantilla',
  plantilla_eliminada:    '🗑️ Eliminó plantilla',
  crear_coleccion:        '➕ Creó colección',
  editar_coleccion:       '✏️ Editó colección',
  eliminar_coleccion:     '🗑️ Eliminó colección',
  config_correo_pedido:   '⚙️ Cambió correos automáticos de pedido',
  editar_envio:           '🚚 Cambió ciudades de envío',
  editar_permiso:         '🔐 Cambió permiso de rol',
  cambiar_estado_tienda:  '🏬 Cambió estado de la tienda',
  cambiar_acceso_tienda_cerrada: '🔑 Cambió accesos con tienda cerrada',
  cambiar_header_dispositivo: '🖥️ Cambió header por dispositivo',
  eliminar_imagen_biblioteca: '🗑️ Eliminó imagen de biblioteca'
};

let _allAuditLogs = [];
let _selectedAuditLogs = new Set();
let _auditUnsubscribe = null;

let _auditSlowTimer = null;
let _auditReady = false;
function loadAuditLog() {
  const tbody = document.getElementById('audit-tbody');
  if (_auditUnsubscribe) {
    renderAuditLogTable();
    return;
  }
  tbody.innerHTML = '<tr><td colspan="5" class="adm-loading"><span class="adm-spinner"></span> Cargando...</td></tr>';
  _auditReady = false;
  clearTimeout(_auditSlowTimer);
  _auditSlowTimer = setTimeout(() => {
    if (_auditReady) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#7a5a63;padding:24px">La carga está tardando más de lo esperado. Verificá tu conexión. <button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="reintentarCargaAuditoria()">Reintentar</button></td></tr>`;
  }, 12000);
  _auditUnsubscribe = onSnapshot(
    query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(200)),
    snapshot => {
      clearTimeout(_auditSlowTimer);
      _auditReady = true;
      _allAuditLogs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderAuditLogTable();
    },
    error => {
      clearTimeout(_auditSlowTimer);
      _auditReady = false;
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#c62828;padding:24px">Error al cargar la auditoría: ${escapeHtmlAdmin(error.message)} <button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="reintentarCargaAuditoria()">Reintentar</button></td></tr>`;
    }
  );
}
window.reintentarCargaAuditoria = function() {
  clearTimeout(_auditSlowTimer);
  if (_auditUnsubscribe) { _auditUnsubscribe(); _auditUnsubscribe = null; }
  loadAuditLog();
};

// La auditoría es de solo lectura (nunca se edita ni se borra un log) — la
// única acción posible sobre la selección es exportarla, nunca modificarla.
function renderAuditLogTable() {
  const tbody = document.getElementById('audit-tbody');
  if (!_allAuditLogs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:24px">Todavía no hay acciones registradas</td></tr>';
    updateAuditBulkToolbar();
    return;
  }
  const visibleIds = new Set(_allAuditLogs.map(l => l.id));
  [..._selectedAuditLogs].forEach(id => { if (!visibleIds.has(id)) _selectedAuditLogs.delete(id); });
  tbody.innerHTML = _allAuditLogs.map(l => {
    const actionLabel = AUDIT_ACTION_LABELS[l.action] || l.action;
    const bulkTag = l.bulk ? `<span class="adm-badge" style="background:#fff3e0;color:#bf360c;margin-left:6px">Masivo${l.bulkCount ? ` (${l.bulkCount})` : ''}</span>` : '';
    const history = Array.isArray(l.productHistory) ? l.productHistory : [];
    const historyText = history.length
      ? ` · Historial: ${history.length === 1 ? `precio ${history[0].priceBefore ?? '—'} → ${history[0].priceAfter ?? '—'} · stock ${history[0].stockBefore ?? 'ilimitado'} → ${history[0].stockAfter ?? 'ilimitado'}` : `${history.length} productos con valores anteriores y posteriores`}`
      : '';
    return `
      <tr>
        <td class="col-select"><input type="checkbox" class="audit-row-check" data-id="${escapeHtmlAdmin(l.id)}" onclick="toggleAuditSelect(this)" ${_selectedAuditLogs.has(l.id) ? 'checked' : ''}></td>
        <td style="white-space:nowrap;font-size:12px">${formatDate(l.createdAt)}</td>
        <td style="font-size:12px">${escapeHtmlAdmin(l.actorEmail || '—')}</td>
        <td style="font-size:12px">${escapeHtmlAdmin(actionLabel)}${bulkTag}</td>
        <td style="font-size:12px;color:var(--adm-muted)">${l.targetLabel ? `<strong>${escapeHtmlAdmin(l.targetLabel)}</strong> — ` : ''}${escapeHtmlAdmin((l.details || '') + historyText)}</td>
      </tr>
    `;
  }).join('');
  updateAuditBulkToolbar();
}

window.toggleSelectAllAudit = function(masterCb) {
  document.querySelectorAll('.audit-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedAuditLogs.add(cb.dataset.id);
    else _selectedAuditLogs.delete(cb.dataset.id);
  });
  updateAuditBulkToolbar();
};

window.toggleAuditSelect = function(cb) {
  if (cb.checked) _selectedAuditLogs.add(cb.dataset.id);
  else _selectedAuditLogs.delete(cb.dataset.id);
  updateAuditBulkToolbar();
};

function updateAuditBulkToolbar() {
  const count = _selectedAuditLogs.size;
  const toolbar = document.getElementById('audit-bulk-toolbar');
  const countEl = document.getElementById('audit-bulk-count');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
}

window.clearAuditSelection = function() {
  _selectedAuditLogs.clear();
  document.querySelectorAll('.audit-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-audit');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateAuditBulkToolbar();
};

window.bulkExportAuditLog = function() {
  if (!_selectedAuditLogs.size) { toast('No hay entradas seleccionadas'); return; }
  const list = _allAuditLogs.filter(l => _selectedAuditLogs.has(l.id));
  const header = ['Fecha', 'Quién', 'Acción', 'Masivo', 'Objetivo', 'Detalle'];
  const rows = list.map(l => [
    formatDate(l.createdAt), l.actorEmail || '', AUDIT_ACTION_LABELS[l.action] || l.action,
    l.bulk ? `Sí (${l.bulkCount || 0})` : 'No', l.targetLabel || '', l.details || ''
  ]);
  downloadCsv(`auditoria_${Date.now()}.csv`, [header, ...rows]);
  toast(`Exportadas ${list.length} entrada(s) a CSV`);
};

// ---- FORMAT ----
function formatPrice(n) {
  return 'Gs. ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// ---- CSV (Fase 2) ----
// Excel en Windows necesita el BOM UTF-8 al principio del archivo para no
// mostrar los acentos rotos (mojibake) — de ahí el '﻿'.
function toCsvValue(v) {
  let s = String(v ?? '');
  // Excel/Sheets interpretan una celda que empieza con =, +, -, @ (o tab/CR)
  // como fórmula. Estos CSV incluyen datos escritos por clientas (nombre,
  // email, ciudad) sin controlar su contenido, así que un valor como
  // "=HYPERLINK(...)" en un campo de nombre se ejecutaría al abrir el
  // archivo en un admin. Se neutraliza con un apóstrofe inicial, igual que
  // hace Google Sheets al pegar texto "peligroso".
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(toCsvValue).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
function statusBadge(status) {
  return `<span class="adm-badge badge-${status}">${status}</span>`;
}

// ---- SIDEBAR NAVIGATION ----
// navItems: los botones ESTÁTICOS de navegación (sidebar + tabs móvil) que
// existen al cargar el módulo; solo se usa para cablear sus clics. La
// deactivación/activación de secciones NO usa NodeList estáticas — se hace con
// querySelectorAll en vivo dentro de switchSection para incluir las secciones
// que otros módulos agregan después (p. ej. "Mensaje de bienvenida").
const mobileMoreGrid = document.getElementById('adm-mobile-more-grid');
const mobileMoreToggle = document.getElementById('adm-mobile-more-toggle');
const navItems = document.querySelectorAll('[data-section]');
const topbarTitle = document.getElementById('adm-topbar-title');

const SECTION_LABELS = {
  dashboard: 'Inicio',
  estadisticas: 'Estadísticas',
  usuarios: 'Usuarios',
  pedidos: 'Pedidos',
  'ventas-locales': 'Ventas locales',
  'clientes-compraron': 'Clientes que compraron',
  'espejos-sheets': 'Espejos de Sheets',
  mayoristas: 'Pedidos mayoristas',
  productos: 'Productos',
  resenas: 'Reseñas',
  'me-gusta': 'Me gusta',
  colecciones: 'Colecciones',
  mensajes: 'Mensajes',
  auditoria: 'Auditoría',
  diagnostico: 'Diagnóstico',
  'flujo-conexiones': 'Flujo de conexiones',
  correos: 'Correos',
  'notificaciones-push': 'Notificaciones push',
  configuracion: 'Configuración',
  importar: 'Import / Export',
  // Sin esta entrada el topbar mostraba la clave cruda "permisos" en lugar de
  // un título legible al entrar a Roles y Permisos.
  permisos: 'Roles y Permisos',
  apariencia: 'Apariencia y contenido'
  ,paginas: 'Páginas'
};

// Secciones sensibles y el permiso que hace falta para entrar — una sola
// fuente de verdad usada tanto para ocultar el botón (sidebar Y tabs mobile,
// que comparten el mismo data-section) como para bloquear el acceso directo
// (consola, hash, o cualquier otro camino que no pase por el botón).
const SECTION_PERMISSION = {
  'ventas-locales': 'manageSettings',
  'clientes-compraron': 'manageSettings',
  'espejos-sheets': 'manageSettings',
  estadisticas:  'manageSettings',
  usuarios:      'manageUsers',
  resenas:       'manageSettings',
  'me-gusta':    'manageSettings',
  configuracion: 'manageSettings',
  // La importación CSV puede sobrescribir el catálogo entero de una sola vez
  // — es una acción de riesgo distinto a editar un producto por vez, así que
  // se reserva a admin/superadmin igual que Configuración, no forma parte de
  // lo "operativo" del Modder.
  importar:      'manageSettings',
  // Auditoría: mismo criterio que Usuarios/Configuración — exclusivo Super
  // Admin. El Modder puede aparecer COMO ACTOR dentro del registro (sus
  // acciones se anotan igual), pero no puede abrir esta sección a verlo.
  auditoria:     'manageSettings',
  diagnostico:   'manageSettings',
  // Flujo de conexiones: mismo criterio que Diagnóstico — expone evidencia
  // real de arquitectura/seguridad del ecosistema, exclusivo Super Admin.
  'flujo-conexiones': 'manageSettings',
  // Correos: mismo criterio que Usuarios/Configuración/Auditoría — exclusivo
  // Super Admin (ni admin ni el Modder ven este menú, aunque sus propias
  // acciones en Pedidos puedan disparar un correo automático configurado acá).
  correos:       'manageSettings',
  'notificaciones-push': 'manageSettings',
  // Pedidos mayoristas: fija precios y aprueba cuentas mayoristas. Exclusivo
  // del Super Admin titular (además se bloquea por correo en switchSection).
  mayoristas:    'manageSettings',
  // Apariencia: cambia el esquema de colores de TODA la plataforma (o del
  // panel) — mismo criterio de sensibilidad que Configuración/Correos.
  apariencia:    'manageSettings',
  // Roles y Permisos: la sección MÁS sensible del panel — poder editarla
  // equivale a poder otorgarse cualquier otro permiso. manageSettings ya la
  // deja fuera del alcance de admin/agent/viewer (solo superadmin la tiene),
  // pero además se blinda con un chequeo de EMAIL exacto más abajo — no
  // alcanza con role==='superadmin' en Firestore, tiene que ser literalmente
  // tintinaccs@gmail.com (pedido explícito de seguridad).
  permisos:      'manageSettings',
  // El gestor de páginas publica contenido arbitrario; queda reservado al
  // superadmin titular, no sólo a cualquier cuenta con el permiso genérico.
  paginas:       'manageSettings'
};

// Evita el bucle switchSection → replaceState(#x) → hashchange → switchSection.
let admSuppressHashSync = false;

function canAccessUnifiedAppearance(role = currentRole) {
  return can(role, 'manageSettings') || role === 'superadmin' || canDo(role, 'contenido', 'ver');
}

function switchSection(target) {
  if (target === 'contenido') target = 'apariencia';
  const requiredPerm = SECTION_PERMISSION[target];
  const allowedByPermission = target === 'apariencia'
    ? canAccessUnifiedAppearance()
    : (!requiredPerm || can(currentRole, requiredPerm));
  if (requiredPerm && !allowedByPermission) {
    toast('No tenés permiso para ver esta sección');
    target = 'dashboard';
  }
  if (target === 'permisos' && currentUser?.email !== SUPER_ADMIN) {
    toast('Roles y Permisos es exclusivo de tintinaccs@gmail.com');
    target = 'dashboard';
  }
  if (target === 'paginas' && (currentRole !== 'superadmin' || currentUser?.email !== SUPER_ADMIN)) {
    toast('Páginas es exclusivo de tintinaccs@gmail.com');
    target = 'dashboard';
  }
  if ((target === 'resenas' || target === 'me-gusta') && currentUser?.email !== SUPER_ADMIN) {
    toast('Esta sección es exclusiva de tintinaccs@gmail.com');
    target = 'dashboard';
  }
  if (target === 'estadisticas' && currentRole !== 'superadmin') {
    toast('Estadísticas generales es exclusivo de Super Admin');
    target = 'dashboard';
  }
  if (target === 'diagnostico' && (currentRole !== 'superadmin' || currentUser?.email !== SUPER_ADMIN)) {
    toast('Diagnóstico es exclusivo de Super Admin');
    target = 'dashboard';
  }
  if (target === 'flujo-conexiones' && (currentRole !== 'superadmin' || currentUser?.email !== SUPER_ADMIN)) {
    toast('Flujo de conexiones es exclusivo de Super Admin');
    target = 'dashboard';
  }
  if (target === 'mayoristas' && (currentRole !== 'superadmin' || currentUser?.email !== SUPER_ADMIN)) {
    toast('Pedidos mayoristas es exclusivo de Super Admin');
    target = 'dashboard';
  }
  // IMPORTANTE: se consultan en vivo (no las NodeList estáticas navItems /
  // sections capturadas al cargar el módulo). Módulos que se inicializan
  // después — p. ej. control-bienvenida-admin.js agrega la sección "Mensaje de
  // bienvenida" (nav-welcome / mtab-welcome / section-welcome) recién cuando
  // resuelve el auth del Super Admin — quedan fuera de esas listas fijas. Si se
  // usaran, al salir de una sección dinámica su botón quedaría resaltado y su
  // panel visible DEBAJO del nuevo (dos secciones activas a la vez).
  document.querySelectorAll('.adm-nav-item, .adm-mobile-tab').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  // activate all items matching this section (sidebar + mobile tabs)
  document.querySelectorAll(`[data-section="${target}"]`).forEach(b => {
    b.classList.add('active');
    // aria-current="page" para que lectores de pantalla anuncien cuál sección
    // está abierta — antes solo cambiaba la clase visual .active.
    b.setAttribute('aria-current', 'page');
  });
  const activeInMore = !!mobileMoreGrid?.querySelector(`[data-section="${target}"]`);
  mobileMoreToggle?.classList.toggle('active', activeInMore);
  closeMobileMore();
  document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
  const targetSection = document.getElementById(`section-${target}`);
  if (targetSection) targetSection.classList.add('active');
  topbarTitle.textContent = SECTION_LABELS[target] || target;
  // Refleja la sección activa en la URL (#hash) sin crear entradas de historial
  // ni provocar scroll, para que el estado sea compartible y coherente con la
  // navegación por hash de abajo.
  if (!admSuppressHashSync && location.hash.slice(1) !== target) {
    admSuppressHashSync = true;
    try { history.replaceState(null, '', `#${target}`); } finally { admSuppressHashSync = false; }
  }
  if (target === 'usuarios') loadUsers();
  if (target === 'estadisticas') renderGeneralStatistics();
  if (target === 'pedidos') loadOrders();
  if (target === 'productos') loadProductos();
  if (target === 'colecciones') loadColecciones();
  if (target === 'auditoria') loadAuditLog();
  if (target === 'correos') loadCorreos();
  if (target === 'notificaciones-push') window.TintinPushMasterRefresh?.();
  if (target === 'configuracion') loadConfig();
  if (target === 'importar') loadImportar();
  if (target === 'permisos') loadPermisosSection();
  if (target === 'apariencia') loadApariencia();
  if (target === 'paginas') window.TintinPagesAdminRefresh?.();
  if (target === 'mayoristas') window.TintinWholesaleAdminRefresh?.();
}

navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    if (window.AdminUnsaved) {
      window.AdminUnsaved.requestNavigation(() => switchSection(btn.dataset.section));
    } else if (typeof UnsavedGuard !== 'undefined') {
      UnsavedGuard.confirmLeave(() => switchSection(btn.dataset.section));
    } else {
      switchSection(btn.dataset.section);
    }
  });
});

function closeSidebar() {}

// ---- DEEP-LINK POR URL / HASH ----
// Permite abrir una sección directamente con admin.html#usuarios o
// admin.html?section=pedidos, y navegar cambiando el hash. Siempre pasa por
// switchSection(), así que hereda TODOS los chequeos de permiso/email (un rol
// sin acceso termina en dashboard, nunca en la sección restringida). Solo
// considera valores que existan como sección real, para no generar estados
// contradictorios con claves inventadas.
function isKnownSection(name) {
  return !!name && !!document.getElementById(`section-${name}`);
}
function sectionFromUrl() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('section');
  if (fromQuery === 'contenido') return 'apariencia';
  if (isKnownSection(fromQuery)) return fromQuery;
  const fromHash = (location.hash || '').replace(/^#(?:section-)?/, '');
  if (fromHash === 'contenido') return 'apariencia';
  if (isKnownSection(fromHash)) return fromHash;
  return null;
}
function applyInitialSectionFromUrl() {
  // Compatibilidad: los enlaces viejos del editor de Contenido abren ahora la
  // única superficie Apariencia y contenido. El módulo Fase 6 conserva page/section.
  if (new URLSearchParams(location.search).get('tab') === 'contenido') {
    switchSection('apariencia');
    return;
  }
  const target = sectionFromUrl();
  if (target && target !== 'dashboard') switchSection(target);
  const params = new URLSearchParams(location.search);
  if (!['order', 'user', 'like', 'review', 'report', 'quote'].some(key => params.has(key))) {
    consumeAdminDestination(location.href, adminReturnStorage(window), location.origin);
  }
}
window.addEventListener('hashchange', () => {
  if (admSuppressHashSync) return;
  const target = sectionFromUrl();
  if (!target) return;
  const active = document.querySelector('.adm-section.active');
  if (active && active.id === `section-${target}`) return;
  const go = () => switchSection(target);
  window.AdminUnsaved ? window.AdminUnsaved.requestNavigation(go) : go();
});

// ---- ACCESIBILIDAD DE MODALES OPERATIVOS (compartido) ----
// El modal de "cambios sin guardar" (#unsaved-modal) ya trae su propio manejo
// de foco/Escape en proteccion-cambios-pendientes-admin.js. Este bloque agrega, de forma
// centralizada y aditiva (sin tocar cada open/close), el mismo nivel para los
// cuatro overlays operativos: cerrar con Escape, bloquear el scroll de fondo
// mientras hay uno abierto, mover el foco adentro al abrir y devolverlo al
// abrir/al cerrar, y atrapar el Tab dentro del overlay superior.
(function setupAdminOverlayA11y() {
  const OVERLAYS = [
    { id: 'order-edit-overlay',   close: () => window.closeOrderEdit && window.closeOrderEdit() },
    { id: 'client-ficha-overlay', close: () => window.closeClientFicha && window.closeClientFicha() },
    { id: 'tpl-edit-overlay',     close: () => window.closeTplEdit && window.closeTplEdit() },
    { id: 'tpl-preview-overlay',  close: () => window.closeTplPreview && window.closeTplPreview() },
    { id: 'promo-confirm-overlay',close: () => window.closePromoConfirm && window.closePromoConfirm() }
  ];
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
  const openers = new Map();
  const wasVisible = new Map();

  const isVisible = el => !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
  const unsavedOpen = () => isVisible(document.getElementById('unsaved-modal'));

  // El de mayor z-index gana: promo (4100) > tpl-preview (3100) > tpl-edit /
  // order-edit (3000). Se recorre en orden inverso al array para respetarlo.
  function topOverlay() {
    for (let i = OVERLAYS.length - 1; i >= 0; i--) {
      const el = document.getElementById(OVERLAYS[i].id);
      if (isVisible(el)) return { def: OVERLAYS[i], el };
    }
    return null;
  }
  function anyOpen() {
    return OVERLAYS.some(o => isVisible(document.getElementById(o.id))) || unsavedOpen();
  }
  function focusablesIn(el) {
    return [...el.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null || n === document.activeElement);
  }

  function syncScrollLock() {
    document.body.style.overflow = anyOpen() ? 'hidden' : '';
  }

  function onOverlayShown(el) {
    openers.set(el.id, document.activeElement);
    el.setAttribute('aria-hidden', 'false');
    // Enfoca el primer control real del modal para que teclado y lector de
    // pantalla entren adentro en vez de quedar detrás.
    const first = focusablesIn(el)[0];
    if (first) { try { first.focus({ preventScroll: true }); } catch(_) { first.focus(); } }
  }
  function onOverlayHidden(el) {
    el.setAttribute('aria-hidden', 'true');
    const opener = openers.get(el.id);
    openers.delete(el.id);
    // Devuelve el foco a lo que estaba enfocado antes de abrir, salvo que haya
    // quedado otro overlay abierto arriba.
    if (opener && opener.isConnected && !topOverlay()) {
      try { opener.focus({ preventScroll: true }); } catch(_) { opener.focus(); }
    }
  }

  function handleMutation() {
    OVERLAYS.forEach(o => {
      const el = document.getElementById(o.id);
      if (!el) return;
      const now = isVisible(el);
      const before = wasVisible.get(o.id) || false;
      if (now && !before) onOverlayShown(el);
      else if (!now && before) onOverlayHidden(el);
      wasVisible.set(o.id, now);
    });
    syncScrollLock();
  }

  OVERLAYS.forEach(o => {
    const el = document.getElementById(o.id);
    if (!el) return;
    wasVisible.set(o.id, isVisible(el));
    new MutationObserver(handleMutation).observe(el, { attributes: true, attributeFilter: ['style'] });
  });

  document.addEventListener('keydown', event => {
    // Si está el modal de cambios sin guardar, lo maneja su propio guard.
    if (unsavedOpen() || document.querySelector('dialog[open]')) return;
    const top = topOverlay();
    if (!top) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      top.def.close();
      return;
    }
    if (event.key === 'Tab') {
      const items = focusablesIn(top.el);
      if (!items.length) { event.preventDefault(); return; }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      // Mantiene el foco en ciclo dentro del overlay superior.
      if (!top.el.contains(active)) { event.preventDefault(); firstEl.focus(); return; }
      if (event.shiftKey && active === firstEl) { event.preventDefault(); lastEl.focus(); }
      else if (!event.shiftKey && active === lastEl) { event.preventDefault(); firstEl.focus(); }
    }
  }, true);

  syncScrollLock();
})();

// ---- MOBILE TAB LOGOUT ----
const mtabLogout = document.getElementById('mtab-logout');
if (mtabLogout) mtabLogout.onclick = () => {
  const leave = async () => {
    recordAuthDiagnostic('EXPLICIT_LOGOUT', { source: 'admin-mobile-logout' });
    try {
      await logoutSession();
      window.location.href = '/login';
    } catch { toast('No pudimos cerrar tu sesión. Volvé a intentarlo.'); }
  };
  window.AdminUnsaved ? window.AdminUnsaved.requestNavigation(leave) : leave();
};

// ---- LOGOUT ----
document.getElementById('adm-logout').onclick = () => {
  const leave = async () => {
    recordAuthDiagnostic('EXPLICIT_LOGOUT', { source: 'admin-logout' });
    try {
      await logoutSession();
      window.location.href = '/login';
    } catch { toast('No pudimos cerrar tu sesión. Volvé a intentarlo.'); }
  };
  window.AdminUnsaved ? window.AdminUnsaved.requestNavigation(leave) : leave();
};

// ======== AUTH GUARD ========
// El coordinador distingue restauración, sesión confirmada y estado desconocido.
// Ningún timer o reintento local puede decidir si una cuenta existe.
function hideOverlay() { window.ttPageReady && window.ttPageReady(); }

function dismissAdminAuthUnknown() {
  document.getElementById('adm-auth-unknown')?.remove();
}

function showAdminInitFailure() {
  document.documentElement.classList.remove('adm-auth-ready');
  let overlay = document.getElementById('adm-init-error');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'adm-init-error';
    overlay.setAttribute('role', 'alert');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#fff;padding:24px;font-family:Montserrat;color:#713C53';
    overlay.innerHTML = '<div style="max-width:560px;text-align:center">' +
      '<h1 style="font-size:22px;margin:0 0 10px">No se pudo iniciar el panel</h1>' +
      '<p style="margin:0 0 18px;line-height:1.5;color:#6f5960">Tu sesión sigue activa. Hubo un problema al cargar datos o componentes del panel; no se cerró la sesión ni se volvió al login.</p>' +
      '<button type="button" id="adm-init-retry" style="border:0;border-radius:10px;padding:11px 18px;background:#F8AACA;color:#713C53;font:inherit;font-weight:700;cursor:pointer">Reintentar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#adm-init-retry')?.addEventListener('click', () => window.location.reload());
  }
  hideOverlay();
}

function dismissAdminAppCheckUnavailable() {
  document.getElementById('adm-appcheck-unavailable')?.remove();
}

function showAdminAppCheckUnavailable() {
  document.documentElement.classList.remove('adm-auth-ready');
  let overlay = document.getElementById('adm-appcheck-unavailable');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'adm-appcheck-unavailable';
    overlay.setAttribute('role', 'status');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#fff;padding:24px;font-family:Montserrat;color:#713C53';
    overlay.innerHTML = '<div style="max-width:580px;text-align:center">' +
      '<h1 style="font-size:22px;margin:0 0 10px">Verificación de seguridad no disponible</h1>' +
      '<p style="margin:0 0 18px;line-height:1.5;color:#6f5960">Tu sesión sigue activa. Firebase App Check no pudo confirmar este navegador todavía, así que el panel no abrirá lecturas privadas hasta que la verificación esté disponible.</p>' +
      '<button type="button" id="adm-appcheck-retry" style="border:0;border-radius:10px;padding:11px 18px;background:#F8AACA;color:#713C53;font:inherit;font-weight:700;cursor:pointer">Reintentar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#adm-appcheck-retry')?.addEventListener('click', () => window.location.reload());
  }
  hideOverlay();
}

window.addEventListener('tintin:app-check-ready', event => {
  if (event?.detail?.ready !== true || !document.getElementById('adm-appcheck-unavailable')) return;
  // El token llegó después del timeout de arranque. Una única recarga ya parte
  // con App Check listo y evita montar listeners con credenciales incompletas.
  window.location.reload();
});

function adminSessionPresentation(reason, handoffPending = false) {
  const absent = !handoffPending && ['AUTHORITATIVE_EMPTY', 'EXPLICIT_LOGOUT', 'AUTH_REVOKED_OR_SIGNED_OUT'].includes(reason);
  return absent ? {
    title: reason === 'AUTHORITATIVE_EMPTY' ? 'Ingresá a tu panel' : 'Tu sesión terminó',
    message: reason === 'AUTHORITATIVE_EMPTY'
      ? 'Este navegador no tiene una sesión iniciada. Ingresá una vez para acceder al panel; la sesión se guarda en este navegador.'
      : 'Ingresá para continuar en la misma sección del panel.',
    retry: false,
  } : {
    title: 'No pudimos confirmar tu sesión',
    message: 'La verificación de acceso no terminó. Podés reintentar sin cerrar tu cuenta o volver al ingreso si el problema continúa.',
    retry: true,
  };
}

function showAdminAuthUnknown(reason, handoffPending = false) {
  rememberAdminDestination(location.href, adminReturnStorage(window), location.origin);
  const presentation = adminSessionPresentation(reason, handoffPending);
  document.documentElement.classList.remove('adm-auth-ready');
  let overlay = document.getElementById('adm-auth-unknown');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'adm-auth-unknown';
    overlay.setAttribute('role', 'status');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#fff;padding:24px;font-family:Montserrat;color:#713C53';
    overlay.innerHTML = '<div style="max-width:560px;text-align:center">' +
      '<h1 style="font-size:22px;margin:0 0 10px"></h1>' +
      '<p style="margin:0 0 18px;line-height:1.5;color:#6f5960"></p>' +
      '<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">' +
      '<button type="button" id="adm-auth-unknown-retry" style="border:0;border-radius:10px;padding:11px 18px;background:#F8AACA;color:#713C53;font:inherit;font-weight:700;cursor:pointer">Reintentar</button>' +
      '<a href="/login" id="adm-auth-login" style="display:inline-flex;align-items:center;border:1px solid #F8AACA;border-radius:10px;padding:10px 17px;color:#713C53;font:inherit;font-weight:700;text-decoration:none">Ingresar al panel</a>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#adm-auth-unknown-retry')?.addEventListener('click', () => window.location.reload());
  }
  overlay.querySelector('h1').textContent = presentation.title;
  overlay.querySelector('p').textContent = presentation.message;
  overlay.querySelector('#adm-auth-unknown-retry').hidden = !presentation.retry;
  overlay.querySelector('#adm-auth-login').href = '/login?from=' + encodeURIComponent('/admin' + window.location.search + window.location.hash);
  hideOverlay();
}

async function recoverAdminUserFromHandoff() {
  const handoff = readAuthHandoff();
  if (!handoff?.uid) return null;
  recordAuthDiagnostic('HANDOFF_WAIT_START', { source: 'admin-guard' });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const restored = auth.currentUser;
    if (restored?.uid === handoff.uid) {
      recordAuthDiagnostic('HANDOFF_RECOVERED', { source: 'admin-guard' });
      return restored;
    }
    await new Promise(resolve => window.setTimeout(resolve, 150));
  }
  recordAuthDiagnostic('HANDOFF_RECOVERY_EXPIRED', { source: 'admin-guard' });
  return null;
}

// Sin esto, los listeners en tiempo real ya arrancados (pedidos, usuarios,
// auditoría, configuración, email, dashboard) seguían corriendo cuando la
// sesión pasaba a UNKNOWN o a "sin usuario" de verdad, y cada uno chocaba
// por separado contra Firestore con "Missing or insufficient permissions"
// apenas el token dejaba de ser válido. pagehide no alcanza: ese evento sólo
// cubre cerrar la pestaña, no una sesión que se invalida mientras sigue abierta.
function teardownAdminRealtimeOnSessionLoss() {
  stopAdminRealtimeData();
  stopAdminSettingsRealtime();
  stopDashboardActivityMetrics();
  if (_productosUnsub) { try { _productosUnsub(); } catch {} _productosUnsub = null; }
  if (_productInventoryUnsub) { try { _productInventoryUnsub(); } catch {} _productInventoryUnsub = null; }
  if (_productosSlowTimer) { window.clearTimeout(_productosSlowTimer); _productosSlowTimer = null; }
  adminRealtimeReady.products = false;
  document.documentElement.classList.remove('adm-auth-ready');
  adminGuardInitializedUid = '';
  adminGuardInitializingUid = '';
  currentUser = null;
  publishAdminOrders();
}

// El overlay "No pudimos restaurar tu sesión" también lo ve cualquier
// visitante sin sesión (AUTHORITATIVE_EMPTY sin handoff) o quien cerró sesión
// en otra pestaña; eso no es un fallo y no se guarda. Sólo dos situaciones
// prueban que la restauración falló: login.html dejó un handoff (la persona
// acababa de ingresar) y aun así la sesión no apareció, o Firebase no pudo
// leer la sesión guardada (AUTH_RESTORE_FALLBACK). Devuelve null si no hay
// que registrar nada. Los valores deben coincidir con firestore.rules.
function classifyAdminSessionFailure(authReason, handoffPending) {
  const restoreError = authReason === 'AUTH_RESTORE_FALLBACK';
  if (handoffPending) return restoreError ? 'handoff-restore-error' : 'handoff-recovery-timeout';
  return restoreError ? 'auth-restore-fallback' : null;
}

// Best-effort: deja rastro en Firestore de un fallo real de restauración
// (ver classifyAdminSessionFailure) a cualquier usuario con acceso a
// admin.html, no solo Super Admin, para poder detectar si vuelve a pasar sin
// depender de que alguien capture la consola en el momento. Nunca debe
// demorar ni romper el guard: no se espera (no await en la llamada) y
// cualquier falla de red o de permisos se descarta en silencio.
async function persistAuthDiagnosticFailure(reason) {
  try {
    await fetch('/api/site-activity', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'authFailure', reason, route: window.location.pathname || '/' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

async function startAdminAuthGuard() {
  subscribeSession(async snapshot => {
    if (snapshot.status !== AUTH_STATES.RESTORING && !authReadyDiagnosticRecorded) {
      authReadyDiagnosticRecorded = true;
      recordAuthDiagnostic('AUTH_STATE_READY', {
        source: 'admin-guard',
        authState: snapshot.status,
        reason: snapshot.reason || 'coordinator-resolution'
      });
    }
    if (snapshot.status !== AUTH_STATES.RESTORING && !coordinatorReadyDiagnosticRecorded) {
      coordinatorReadyDiagnosticRecorded = true;
      recordAuthDiagnostic('COORDINATOR_READY', {
        source: 'admin-guard',
        sessionCoordinatorState: snapshot.status
      });
    }
    if (snapshot.status === AUTH_STATES.RESTORING) {
      window.TintinLoader?.setText?.('Restaurando tu sesión…', 'El panel se abrirá cuando termine la restauración.');
      return;
    }
    if (snapshot.status === AUTH_STATES.UNKNOWN) {
      // UNKNOWN no confirma una cuenta y tampoco autoriza navegar a login.
      // Mantener el documento evita el circuito Admin -> login -> Admin.
      recordAuthDiagnostic('REDIRECT_LOOP_BROKEN', { source: 'admin-guard', reason: 'auth-state-unknown' });
      teardownAdminRealtimeOnSessionLoss();
      showAdminAuthUnknown();
      return;
    }
    let user = snapshot.user;
    // Se lee antes de esperar: recoverAdminUserFromHandoff() puede tardar
    // hasta 5 s y el handoff vence por TTL.
    const handoffPending = !user && Boolean(readAuthHandoff()?.uid);
    if (!user) {
      user = await recoverAdminUserFromHandoff();
    }
    if (!user) {
      recordAuthDiagnostic('AUTH_SESSION_RECOVERY_REQUIRED', {
        source: 'admin-guard',
        authState: snapshot.status,
        reason: snapshot.reason || 'session-not-restored'
      });
      // La ausencia no confirmada se resuelve con acción explícita desde el
      // overlay, nunca con otra navegación automática.
      recordAuthDiagnostic('REDIRECT_LOOP_BROKEN', { source: 'admin-guard', reason: 'handoff-recovery-timeout' });
      const failureReason = classifyAdminSessionFailure(snapshot.reason, handoffPending);
      if (failureReason) persistAuthDiagnosticFailure(failureReason);
      teardownAdminRealtimeOnSessionLoss();
      showAdminAuthUnknown(snapshot.reason, handoffPending);
      return;
    }
    recordAuthDiagnostic('AUTH_USER_AVAILABLE', {
      source: 'admin-guard',
      authState: snapshot.status,
      sessionCoordinatorState: snapshot.status
    });
    // UNKNOWN puede haberse pintado por un snapshot transitorio antes de que
    // Firebase confirmara la identidad. Una sesión ya autenticada debe quitar
    // ese bloqueo visual para que el panel pueda continuar con su arranque.
    dismissAdminAuthUnknown();
    clearAdminAuthHandoffWithDiagnostic();
    clearAdminLoginBounceGuard();

    currentUser = user;

    // El guard puede volver a dispararse con el mismo usuario ya inicializado
    // (por ejemplo, tras absorber un null transitorio de arriba). Repetir toda
    // la carga (dashboard, productos, colecciones, listeners en tiempo real)
    // no aporta nada y sólo genera parpadeo; alcanza con seguir mostrando el
    // panel ya activo.
    if (adminGuardInitializedUid === user.uid && document.documentElement.classList.contains('adm-auth-ready')) {
      return;
    }
    if (adminGuardInitializingUid === user.uid) {
      return;
    }
    adminGuardInitializingUid = user.uid;

    try {
      const appCheckAvailable = await waitForAdminAppCheck(12000);
      if (!appCheckAvailable) {
        // No abrir ninguna consulta privada sin App Check cuando Enforcement
        // está activo. Esto conserva Auth y evita la cascada de
        // permission-denied que antes parecía un logout.
        currentUser = user;
        teardownAdminRealtimeOnSessionLoss();
        currentUser = user;
        showAdminAppCheckUnavailable();
        recordAuthDiagnostic('APP_CHECK_ADMIN_BLOCKED', {
          source: 'admin-guard',
          authState: snapshot.status,
          reason: 'app-check-token-unavailable'
        });
        return;
      }
      dismissAdminAppCheckUnavailable();

      const role = await getUserRole(user.uid, user.email);
      currentRole = role;
      // El detalle técnico de las operaciones solo se muestra a Super Admin/Admin.
      setOperationsViewerRole(role);

      // Una cuenta bloqueada pierde autorización, no su sesión de Firebase.
      // Mantener la sesión permite recuperar el acceso sin forzar un login
      // completo y evita que errores transitorios parezcan un logout.
      if (String(user.email || '').trim().toLowerCase() !== SUPER_ADMIN.toLowerCase()) {
        const selfSnap = await getDoc(doc(db, 'users', user.uid));
        if (selfSnap.exists() && selfSnap.data().blocked) {
          window.dispatchEvent(new CustomEvent('tintin:account-blocked', { detail: { uid: user.uid } }));
          recordAuthDiagnostic('REDIRECT_REASON', { source: 'admin-guard', reason: 'account-blocked', authState: snapshot.status });
          recordAuthDiagnostic('REDIRECT_REQUESTED', { source: 'admin-guard', destination: 'profile-blocked' });
          window.location.replace('perfil.html?blocked=1');
          return;
        }
      }

      // Una cuenta autenticada pero sin rol interno no es un error de Auth:
      // va a su perfil, nunca al login.
      if (role === 'client' || !role) {
        window.location.replace('perfil.html');
        recordAuthDiagnostic('REDIRECT_REASON', { source: 'admin-guard', reason: 'authenticated-without-admin-role', authState: snapshot.status });
        recordAuthDiagnostic('REDIRECT_REQUESTED', { source: 'admin-guard', destination: 'profile' });
        return;
      }

      const storeCfg = await getStoreAccessConfig();
      if (!isAccessAllowed(storeCfg, role, user.email)) {
        // Una lectura no confirmada (red/degradada) no bloquea el panel con
        // un cierre que no se comprobó — sólo un estado 'ok' confirma que
        // la tienda está realmente cerrada para este rol.
        if (storeCfg?.__storeConfigStatus !== 'ok') {
          renderStoreConfigUnavailableOverlay(storeCfg);
          hideOverlay();
          return;
        }
        renderStoreClosedOverlay();
        hideOverlay();
        return;
      }

      await loadRolePermissions();

      setupUserInfo(user, role);
      setupPermissions(role);
      if (role === 'superadmin' && String(user.email || '').trim().toLowerCase() === SUPER_ADMIN.toLowerCase()) {
        initSiteDiagnostics({ role });
        initConnectionsFlow({ role });
        initWholesaleAdmin();
      }
      startAdminSettingsRealtime();
      adminRealtimeAuthRecoveryAttempted = false;
      startAdminRealtimeData();
      loadDashboard();
      loadProductos();
      loadColecciones();
      applyInitialSectionFromUrl();
      document.documentElement.classList.add('adm-auth-ready');
      adminGuardInitializedUid = user.uid;
      hideOverlay();
    } catch (error) {
      // Un fallo de Firestore, App Check, permisos dinámicos o UI NO significa
      // que Firebase Auth haya perdido la sesión. Antes cualquier excepción
      // terminaba en login.html y podía crear /admin <-> /login infinito.
      console.error('[Admin] Init error; authenticated session preserved:', error);
      showAdminInitFailure();
    } finally {
      if (adminGuardInitializedUid !== user.uid) {
        adminGuardInitializingUid = '';
      }
    }
  });
}

void startAdminAuthGuard();

function setupUserInfo(user, role) {
  const initials = value => String(value || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  const avatarEl = document.getElementById('adm-avatar');
  if (avatarEl) {
    const avatarUrl = sanitizeImageUrl(user.photoURL || '');
    if (avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="" />`;
    } else {
      avatarEl.textContent = initials(user.displayName || user.email);
    }
  }
  const nameEl = document.getElementById('adm-user-name');
  if (nameEl) nameEl.textContent = user.displayName || user.email;
  const badge = document.getElementById('adm-role-badge');
  if (badge) {
    badge.textContent = ROLE_LABELS[role] || role;
    badge.className = `adm-user-role-badge role-${role}`;
  }
}

function setupPermissions(role) {
  // [data-section="X"] agarra el botón del sidebar de escritorio Y el de la
  // barra de pestañas de mobile en un solo paso — así los dos superficies
  // quedan siempre sincronizadas y no hace falta duplicar esta lógica por
  // pantalla (antes esto solo ocultaba el ID de escritorio, dejando visibles
  // en mobile pestañas que en desktop ya estaban ocultas).
  Object.entries(SECTION_PERMISSION).forEach(([section, perm]) => {
    const allowed = section === 'paginas'
      ? (role === 'superadmin' && currentUser?.email === SUPER_ADMIN)
      : section === 'apariencia'
        ? canAccessUnifiedAppearance(role)
        : can(role, perm);
    document.querySelectorAll(`[data-section="${section}"]`).forEach(el => {
      el.style.display = allowed ? '' : 'none';
    });
  });

  const canManageAppearance = can(role, 'manageSettings');
  document.querySelectorAll('[data-appearance-sensitive="true"]').forEach(el => {
    el.hidden = !canManageAppearance;
  });

  if (role !== 'superadmin' || currentUser?.email !== SUPER_ADMIN) {
    document.querySelectorAll('[data-section="diagnostico"]').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('[data-section="flujo-conexiones"]').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('[data-section="mayoristas"]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // Botones de "crear nuevo" que viven fuera de las filas de la tabla (no se
  // regeneran por producto/colección, así que se ocultan una sola vez acá).
  // dynamic: [moduleKey, actionKey] en Roles y Permisos — además del techo
  // fijo de roles.js, Super Admin puede apagar puntualmente "Crear".
  const ACTION_PERMISSION = {
    'btn-nuevo-producto':   { perm: 'addProducts',    dynamic: ['productos', 'crear'] },
    'btn-nueva-coleccion':  { perm: 'manageContent',  dynamic: ['colecciones', 'crear'] }
  };
  Object.entries(ACTION_PERMISSION).forEach(([id, cfg]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const allowed = can(role, cfg.perm) && (role === 'superadmin' || canDo(role, cfg.dynamic[0], cfg.dynamic[1]));
    el.style.display = allowed ? '' : 'none';
  });
}

// ======== DASHBOARD ========
const DASHBOARD_ONLINE_WINDOW_MS = 2 * 60 * 1000;
const DASHBOARD_PRESENCE_QUERY_MS = 10 * 60 * 1000;

function activityTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function activityLocationLabel(item) {
  const parts = [item?.city, item?.region, item?.country]
    .map(value => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  return parts.join(', ') || 'Ubicación no disponible';
}

function activityPageLabel(path) {
  const value = String(path || '/').replace(/^\/+/, '').replace(/\.html$/i, '');
  if (!value || value === 'index') return 'Inicio';
  return value.replace(/[-_]+/g, ' ').replace(/^./, char => char.toUpperCase()).slice(0, 80);
}

function activityRelativeTime(timestamp, now = Date.now()) {
  const milliseconds = activityTimestampMillis(timestamp);
  if (!milliseconds) return 'recién';
  const seconds = Math.max(0, Math.floor((now - milliseconds) / 1000));
  if (seconds < 10) return 'ahora';
  if (seconds < 60) return `hace ${seconds} s`;
  return `hace ${Math.max(1, Math.floor(seconds / 60))} min`;
}

function statisticsStartDate(days = statisticsRangeDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, Number(days || 1) - 1));
  return start;
}

function statisticsDayKey(value) {
  const milliseconds = activityTimestampMillis(value);
  if (!milliseconds) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(milliseconds));
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function statisticsSetText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function statisticsCompactNumber(value) {
  return new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
}

function statisticsPaymentStatus(order) {
  return order?.payment?.status || order?.paymentStatus || 'pendiente';
}

function statisticsOrderIsValid(order) {
  return !['cancelado', 'rechazado'].includes(order?.status || 'pendiente');
}

function statisticsActivePresence(now = Date.now()) {
  return dashboardActivityState.presence.filter(item => {
    const lastSeen = activityTimestampMillis(item.lastSeen);
    return lastSeen >= now - DASHBOARD_ONLINE_WINDOW_MS && lastSeen <= now + 60000;
  });
}

function renderStatisticsBars(containerId, entries, labels = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const sorted = [...entries]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    container.innerHTML = '<div class="adm-analytics-empty">Todavía no hay datos en este período.</div>';
    return;
  }
  const maximum = Math.max(...sorted.map(([, count]) => count), 1);
  container.innerHTML = sorted.slice(0, 8).map(([key, count]) => `
    <div class="adm-bar-row">
      <div class="adm-bar-label" title="${escapeHtmlAdmin(labels[key] || key)}">${escapeHtmlAdmin(labels[key] || key)}</div>
      <div class="adm-bar-track"><div class="adm-bar-fill" style="--adm-bar-width:${Math.max(4, Math.round(count / maximum * 100))}%"></div></div>
      <div class="adm-bar-value">${count}</div>
    </div>
  `).join('');
}

function renderStatisticsRanking(containerId, entries, emptyText = 'Todavía no hay datos.') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const list = entries.filter(item => item && item.value > 0).slice(0, 8);
  if (!list.length) {
    container.innerHTML = `<div class="adm-analytics-empty">${escapeHtmlAdmin(emptyText)}</div>`;
    return;
  }
  container.innerHTML = list.map((item, index) => `
    <div class="adm-rank-row">
      <div class="adm-rank-index">${index + 1}</div>
      <div class="adm-rank-main">
        <div class="adm-rank-name" title="${escapeHtmlAdmin(item.name)}">${escapeHtmlAdmin(item.name)}</div>
        <div class="adm-rank-meta">${escapeHtmlAdmin(item.meta || '')}</div>
      </div>
      <div class="adm-rank-value">${escapeHtmlAdmin(item.displayValue ?? item.value)}</div>
    </div>
  `).join('');
}

function renderStatisticsTrend() {
  const container = document.getElementById('statistics-revenue-trend');
  if (!container) return;
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
    const dayOrders = filterStatisticsRows('trend', allOrders, row => activityTimestampMillis(row.createdAt)).filter(order => statisticsDayKey(order.createdAt) === key && statisticsOrderIsValid(order));
    const revenue = dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const visits = filterStatisticsRows('trend', statisticsTrafficSessions, row => activityTimestampMillis(row.startedAt)).filter(session => statisticsDayKey(session.startedAt) === key).length;
    days.push({ date, key, orders: dayOrders.length, revenue, visits });
  }
  const maxRevenue = Math.max(...days.map(day => day.revenue), 1);
  const maxOrders = Math.max(...days.map(day => day.orders), 1);
  const maxVisits = Math.max(...days.map(day => day.visits), 1);
  container.innerHTML = days.map(day => {
    const label = new Intl.DateTimeFormat('es-PY', { weekday: 'short', day: '2-digit' }).format(day.date).replace('.', '');
    const revenueHeight = Math.max(3, Math.round(day.revenue / maxRevenue * 142));
    const ordersHeight = Math.max(3, Math.round(day.orders / maxOrders * 142));
    const visitsHeight = Math.max(3, Math.round(day.visits / maxVisits * 142));
    return `
      <div class="adm-trend-day">
        <div class="adm-trend-bars" title="${day.orders} pedidos · ${formatPrice(day.revenue)} · ${day.visits} sesiones">
          <div class="adm-trend-bar" style="--adm-trend-height:${revenueHeight}px" aria-label="Facturación ${formatPrice(day.revenue)}"></div>
          <div class="adm-trend-bar adm-trend-bar-orders" style="--adm-trend-height:${ordersHeight}px" aria-label="${day.orders} pedidos"></div>
          <div class="adm-trend-bar adm-trend-bar-visits" style="--adm-trend-height:${visitsHeight}px" aria-label="${day.visits} sesiones"></div>
        </div>
        <strong>${escapeHtmlAdmin(label)}</strong>
        <span>${statisticsCompactNumber(day.revenue)} · ${day.orders} · ${day.visits}</span>
      </div>
    `;
  }).join('');
}

function renderGeneralStatistics() {
  if (currentRole !== 'superadmin') return;
  if (!ensureStatisticsControls(refreshStatisticsViews, runAdminCrudOperation)) return;
  const now = Date.now();
  const rangeStart = statisticsStartDate().getTime();
  const rangeOrders = allOrders.filter(order => activityTimestampMillis(order.createdAt) >= rangeStart);
  const ordersFor = metric => filterStatisticsRows(metric, rangeOrders, row => activityTimestampMillis(row.createdAt));
  const sessionsFor = metric => filterStatisticsRows(metric, statisticsTrafficSessions, row => activityTimestampMillis(row.startedAt));
  const averageOrders = ordersFor('average').filter(statisticsOrderIsValid);
  const orderGroups = new Map(), sessionGroups = new Map();
  const orderIncluded = (metric, order) => {
    if (!orderGroups.has(metric)) orderGroups.set(metric, new Set(ordersFor(metric)));
    return orderGroups.get(metric).has(order);
  };
  const sessionIncluded = (metric, session) => {
    if (!sessionGroups.has(metric)) sessionGroups.set(metric, new Set(sessionsFor(metric)));
    return sessionGroups.get(metric).has(session);
  };
  const revenue = ordersFor('revenue').filter(statisticsOrderIsValid).reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paid = ordersFor('paid')
    .filter(order => statisticsPaymentStatus(order) === 'pagado')
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const rangeUsers = filterStatisticsRows('users', allUsers.filter(user => activityTimestampMillis(user.createdAt) >= rangeStart), row => activityTimestampMillis(row.createdAt));
  const activeUsers = allUsers.filter(user => !user.blocked).length;
  const blockedUsers = allUsers.filter(user => user.blocked).length;
  const uniqueVisitors = new Set(sessionsFor('visitors').map(session => session.visitorId).filter(Boolean)).size;
  const conversionVisitors = new Set(sessionsFor('conversion').map(session => session.visitorId).filter(Boolean)).size;
  const conversionOrders = ordersFor('conversion').filter(statisticsOrderIsValid).length;
  const activePresence = statisticsActivePresence(now);
  const activeProducts = _allProducts.filter(product => product.active !== false);
  const lowStockProducts = activeProducts.filter(product => Number(product.stock || 0) <= 5).length;

  statisticsSetText('statistics-revenue', adminRealtimeReady.orders ? formatPrice(revenue) : '—');
  statisticsSetText('statistics-paid', adminRealtimeReady.orders ? formatPrice(paid) : '—');
  statisticsSetText('statistics-orders', adminRealtimeReady.orders ? String(ordersFor('orders').length) : '—');
  statisticsSetText('statistics-average-ticket', adminRealtimeReady.orders ? formatPrice(averageOrders.length ? averageOrders.reduce((sum, row) => sum + Number(row.total || 0), 0) / averageOrders.length : 0) : '—');
  statisticsSetText('statistics-new-users', adminRealtimeReady.users ? String(rangeUsers.length) : '—');
  statisticsSetText('statistics-active-users', adminRealtimeReady.users ? String(activeUsers) : '—');
  statisticsSetText('statistics-blocked-users', adminRealtimeReady.users ? `${blockedUsers} bloqueado${blockedUsers === 1 ? '' : 's'}` : '—');
  statisticsSetText('statistics-visitors', adminRealtimeReady.traffic ? String(uniqueVisitors) : '—');
  statisticsSetText('statistics-sessions', adminRealtimeReady.traffic ? `${sessionsFor('visitors').length} ${sessionsFor('visitors').length === 1 ? 'sesión' : 'sesiones'}` : '—');
  statisticsSetText('statistics-conversion', adminRealtimeReady.orders && adminRealtimeReady.traffic && conversionVisitors ? ((conversionOrders / conversionVisitors) * 100).toFixed(1) + '%' : '—');
  statisticsSetText('statistics-online', adminRealtimeReady.presence ? String(activePresence.length) : '—');
  statisticsSetText('statistics-active-products', adminRealtimeReady.products ? String(activeProducts.length) : '—');
  statisticsSetText('statistics-low-stock', adminRealtimeReady.products ? `${lowStockProducts} con stock bajo` : '—');

  const orderStatuses = new Map();
  const paymentStatuses = new Map();
  const products = new Map();
  const orderLocations = new Map();
  rangeOrders.forEach(order => {
    const orderStatus = order.status || 'pendiente';
    if (orderIncluded('orderStatus', order)) orderStatuses.set(orderStatus, (orderStatuses.get(orderStatus) || 0) + 1);
    const paymentStatus = statisticsPaymentStatus(order);
    if (orderIncluded('paymentStatus', order)) paymentStatuses.set(paymentStatus, (paymentStatuses.get(paymentStatus) || 0) + 1);
    const location = String(order.shipping?.city || order.city || order.shipping?.zone || order.shipping?.department || 'Sin ubicación').trim();
    if (orderIncluded('orderLocations', order)) orderLocations.set(location, (orderLocations.get(location) || 0) + 1);
    (orderIncluded('products', order) && statisticsOrderIsValid(order) ? (order.items || []) : []).forEach(item => {
      const name = String(item.name || 'Producto sin nombre').trim();
      const productId = String(item.id || item.productId || '').trim();
      const productKey = productId ? `id:${productId}` : `legacy-name:${name}`;
      const quantity = Math.max(1, Number(item.qty || item.quantity || 1));
      const previous = products.get(productKey) || { id: productId, name, quantity: 0, revenue: 0 };
      previous.quantity += quantity;
      previous.revenue += quantity * Number(item.price || 0);
      products.set(productKey, previous);
    });
  });

  const visitLocations = new Map();
  const entryPages = new Map();
  statisticsTrafficSessions.forEach(session => {
    const location = activityLocationLabel(session);
    if (sessionIncluded('visitLocations', session)) visitLocations.set(location, (visitLocations.get(location) || 0) + 1);
    const page = activityPageLabel(session.landingPage);
    if (sessionIncluded('entryPages', session)) entryPages.set(page, (entryPages.get(page) || 0) + 1);
  });
  const livePages = new Map();
  activePresence.forEach(visitor => {
    const page = activityPageLabel(visitor.page);
    livePages.set(page, (livePages.get(page) || 0) + 1);
  });

  renderStatisticsBars('statistics-order-status', orderStatuses, ORDER_STATUS_LABELS);
  renderStatisticsBars('statistics-payment-status', paymentStatuses, PAY_STATUS_LABELS);
  renderStatisticsBars('statistics-live-pages', livePages);
  renderStatisticsRanking('statistics-top-products', [...products.entries()]
    .map(([, data]) => ({ id: data.id, name: data.name, value: data.quantity, displayValue: data.quantity, meta: `${data.quantity} unidades · ${formatPrice(data.revenue)}` }))
    .sort((a, b) => b.value - a.value));
  renderStatisticsRanking('statistics-order-locations', [...orderLocations.entries()]
    .map(([name, value]) => ({ name, value, displayValue: value, meta: `${value} pedido${value === 1 ? '' : 's'}` }))
    .sort((a, b) => b.value - a.value));
  renderStatisticsRanking('statistics-visit-locations', [...visitLocations.entries()]
    .map(([name, value]) => ({ name, value, displayValue: value, meta: `${value} ${value === 1 ? 'sesión' : 'sesiones'}` }))
    .sort((a, b) => b.value - a.value));
  renderStatisticsRanking('statistics-entry-pages', [...entryPages.entries()]
    .map(([name, value]) => ({ name, value, displayValue: value, meta: `${value} entrada${value === 1 ? '' : 's'}` }))
    .sort((a, b) => b.value - a.value));
  renderStatisticsTrend();

  const updated = new Intl.DateTimeFormat('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(now));
  statisticsSetText('statistics-live-status', `En vivo · ${updated}`);
  statisticsSetText('statistics-data-status', `Última actualización ${updated}. No hace falta recargar la página.`);
}

async function listenStatisticsTraffic() {
  statisticsTrafficSessions = [];
  statisticsTrafficHistorySessions = [];
  if (currentRole !== 'superadmin') return;
  const loadToken = ++statisticsTrafficLoadToken;
  adminRealtimeReady.traffic = false;
  const dayKeys = [];
  for (let offset = statisticsRangeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    dayKeys.push(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date));
  }
  try {
    const historySnapshots = await Promise.all(dayKeys.slice(0, -1).map(dayKey =>
      getDocsPaginated(collection(db, 'siteTraffic', dayKey, 'sessions'), {
        pageSize: 500,
        maxDocs: 5000
      })
    ));
    if (loadToken !== statisticsTrafficLoadToken) return;
    const historical = historySnapshots.flatMap(snapshot =>
      snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    );
    statisticsTrafficHistorySessions = historical;
    statisticsTrafficSessions = historical.concat(dashboardActivityState.sessions);
    adminRealtimeReady.traffic = true;
    renderGeneralStatistics();
  } catch (error) {
    if (loadToken !== statisticsTrafficLoadToken) return;
    adminRealtimeReady.traffic = false;
    statisticsSetText('statistics-live-status', 'Actividad no disponible');
    statisticsSetText('statistics-data-status', `No se pudo actualizar la actividad: ${error.code || error.message}`);
    // Que los indicadores de visitantes/sesiones muestren "—" (no "0") al fallar.
    renderGeneralStatistics();
    console.warn('Historial de actividad no disponible:', error);
  }
}

function sectionIsActive(name) {
  return document.getElementById(`section-${name}`)?.classList.contains('active') === true;
}

function refreshRealtimeConsumers() {
  projectAdminUserStats();
  publishAdminOrders();
  renderDashboardData();
  renderGeneralStatistics();
  if (sectionIsActive('pedidos')) applyOrderFilters();
  if (sectionIsActive('usuarios')) applyUserFilters();
  if (typeof refreshCorreosClientasFromRealtime === 'function' && sectionIsActive('correos')) {
    refreshCorreosClientasFromRealtime();
  }
}

// Punto de lectura mínimo para el enlace directo de las notificaciones push
// (js/admin/notifications/push-order-deeplink.js): saber si los pedidos ya
// están cargados y si un pedido existe, sin exponer ningún dato del pedido.
const adminOrderConsumers = new Set();
let adminOrdersOwnerUid = '';
function publishAdminOrders() {
  const productId=document.getElementById('prod-id')?.value;
  if(productId && document.getElementById('prod-form-card')?.style.display!=='none')renderProductStatistics(productId);
  const snapshot = { uid: currentUser?.uid || '', ready: adminRealtimeReady.orders, error: adminRealtimeErrors.orders, includeTestOrders: includesTestOrders(), orders: currentUser && adminOrdersOwnerUid===currentUser.uid ? allOrders : [] };
  for (const consume of adminOrderConsumers) { try { consume(snapshot); } catch(error) { console.error('No se pudo actualizar la vista de pedidos.',error?.message); } }
}
window.TintinAdminOrders = {
  includesTestOrders,
  setTestVisibility(show) {
    if (currentRole !== 'superadmin' || !currentUser?.uid) throw new Error('Acción reservada al Super Admin.');
    if(!adminRealtimeReady.orders) throw new Error('Esperá a que los pedidos terminen de sincronizarse.');
    localStorage.setItem(`tt-test-orders:${currentUser.uid}`, show ? 'show' : 'hide');
    projectAdminOrders(); refreshRealtimeConsumers();
    window.dispatchEvent(new Event('tintin:order-test-visibility'));
  },
  ready: () => adminRealtimeReady.orders === true,
  has: orderId => allOrders.some(order => order.id === orderId),
  get: orderId => currentUser && adminOrdersOwnerUid === currentUser.uid ? allOrders.find(order => order.id === orderId) : undefined,
  subscribe(consume) { adminOrderConsumers.add(consume); publishAdminOrders(); return () => adminOrderConsumers.delete(consume); },
  retry() { if (currentUser) startAdminRealtimeData(); }
};
window.dispatchEvent(new Event('tintin:admin-orders-source'));

function stopAdminRealtimeData() {
  if (adminOrdersUnsubscribe) adminOrdersUnsubscribe();
  if (adminUsersUnsubscribe) adminUsersUnsubscribe();
  if (_auditUnsubscribe) _auditUnsubscribe();
  stopCorreosRealtimeListeners();
  statisticsTrafficLoadToken += 1;
  adminOrdersUnsubscribe = null;
  adminUsersUnsubscribe = null;
  _auditUnsubscribe = null;
}

function stopAdminSettingsRealtime() {
  adminSettingsUnsubscribers.forEach(unsubscribe => {
    try { unsubscribe(); } catch {}
  });
  adminSettingsUnsubscribers = [];
}

// Estos listeners necesitan sesión autorizada y App Check listo. Antes se
// abrían al evaluar el módulo, durante la restauración inicial de Auth; en
// ese breve intervalo Firestore los rechazaba y el panel quedaba con una
// mezcla de datos cargados y pantallas vacías.
function startAdminSettingsRealtime() {
  stopAdminSettingsRealtime();
  adminSettingsUnsubscribers.push(onSnapshot(doc(db, 'settings', 'general'), snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    const waLink = document.getElementById('mensajes-wa-link');
    const digits = String(d.whatsappNumber || '').replace(/\D/g, '');
    if (waLink && digits) waLink.href = 'https://wa.me/' + digits;
    if (d.waConfirmMessage) waConfirmMessageTemplate = d.waConfirmMessage;
  }, error => console.warn('[admin-settings] No se pudo cargar settings/general:', error?.code || error)));

  adminSettingsUnsubscribers.push(onSnapshot(doc(db, 'settings', 'shippingRates'), async snap => {
    const d = snap.exists() ? snap.data() : {};
    if (Array.isArray(d.deliveryCities) || Array.isArray(d.encomiendaCities)) {
      shipCities.delivery = Array.isArray(d.deliveryCities) ? d.deliveryCities : [];
      shipCities.encomienda = Array.isArray(d.encomiendaCities) ? d.encomiendaCities : [];
      renderShipList('delivery');
      renderShipList('encomienda');
      return;
    }
    try {
      const legacySnap = await getDoc(doc(db, 'settings', 'general'));
      const legacy = legacySnap.exists() ? legacySnap.data() : {};
      if (!Array.isArray(legacy.deliveryCities) && !Array.isArray(legacy.encomiendaCities)) return;
      await withAdminSiteChange(async () => setDoc(doc(db, 'settings', 'shippingRates'), {
        deliveryCities: legacy.deliveryCities || [],
        encomiendaCities: legacy.encomiendaCities || [],
        deliveryCost: legacy.deliveryCost || 0,
        encomiendaCost: legacy.encomiendaCost || 0,
        updatedAt: serverTimestamp()
      }, { merge: true }));
      await withAdminSiteChange(async () => setDoc(doc(db, 'settings', 'general'), {
        deliveryCities: deleteField(),
        encomiendaCities: deleteField()
      }, { merge: true }));
      console.log('[envios] Ciudades migradas de settings/general a settings/shippingRates.');
    } catch (error) {
      console.warn('[envios] No se pudo migrar la configuración de envíos:', error?.code || error);
    }
  }, error => console.warn('[admin-settings] No se pudo cargar shippingRates:', error?.code || error)));
}

function adminRealtimeErrorCode(error) {
  return String(error?.code || error?.name || 'unknown').replace(/^firestore\//, '').toLowerCase();
}

function recoverAdminRealtimeAuth(error, source) {
  const code = adminRealtimeErrorCode(error);
  const authRelated = code === 'permission-denied' || code === 'unauthenticated';
  recordAuthDiagnostic('FIRESTORE_LISTENER_ERROR', {
    source: `admin-core-${source}`,
    firestoreCode: code,
    recovery: authRelated ? 'refresh-once' : 'manual-reload',
  });
  if (!authRelated || adminRealtimeAuthRecoveryAttempted || !currentUser) return;

  adminRealtimeAuthRecoveryAttempted = true;
  const targetUser = currentUser;
  if (!adminRealtimeAuthRecoveryPromise) {
    adminRealtimeAuthRecoveryPromise = recoverAdminSecurity(targetUser.uid)
      .then(Boolean)
      .catch(refreshError => {
        recordAuthDiagnostic('FIRESTORE_LISTENER_AUTH_REFRESH_FAILED', {
          source: 'admin-core',
          firestoreCode: adminRealtimeErrorCode(refreshError),
        });
        return false;
      })
      .finally(() => { adminRealtimeAuthRecoveryPromise = null; });
  }
  void adminRealtimeAuthRecoveryPromise.then(ok => {
    if (ok && currentUser?.uid === targetUser.uid) startAdminRealtimeData();
  });
}

function subscribeAdminCollectionPages(name, pageSize, onData, onError, onLoading) {
  return createAdminPagedSource({
    complete: currentRole === 'superadmin', onData, onError, onLoading,
    subscribePage(cursor, next, fail) {
      const base = collection(db, name);
      const source = cursor
        ? query(base, orderBy('__name__'), startAfter(cursor), limit(pageSize))
        : query(base, orderBy('__name__'), limit(pageSize));
      return onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
        const last = snapshot.docs.at(-1);
        next({ records: snapshot.docs.map(item => ({ id: item.id, record: item.data() })),
          cursor: last, cursorKey: last?.id || '', hasMore: snapshot.docs.length === pageSize,
          authoritative: snapshot.metadata?.fromCache !== true });
      }, fail);
    },
  }).stop;
}

function startAdminRealtimeData() {
  stopAdminRealtimeData();
  adminRealtimeReady = { ...adminRealtimeReady, orders: false, users: currentRole !== 'superadmin' };
  adminRealtimeErrors = { orders: '', users: '' };
  if(adminOrdersOwnerUid!==currentUser?.uid){allOrders=[];rawAdminOrders=[];}
  adminOrdersOwnerUid=currentUser?.uid || '';
  publishAdminOrders();
  if (can(currentRole, 'viewOrders') && roleCanDo('pedidos', 'ver')) {
    const source = createAdminOrderSource({
      complete: currentRole === 'superadmin',
      subscribePage(cursor, next, error) {
        const ordersQuery = cursor
          ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(ADMIN_REALTIME_LIMIT))
          : query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(ADMIN_REALTIME_LIMIT));
        return onSnapshot(ordersQuery, { includeMetadataChanges: true }, snapshot => {
          const last = snapshot.docs.at(-1);
          const created = last?.data()?.createdAt;
          next({ orders: snapshot.docs.map(item => ({ id: item.id, ...item.data() })),
            cursor: last, cursorKey: last ? last.id + ':' + activityTimestampMillis(created) : '',
            hasMore: snapshot.docs.length === ADMIN_REALTIME_LIMIT, authoritative: snapshot.metadata?.fromCache !== true });
        }, error);
      },
      onLoading() { adminRealtimeReady.orders = false; refreshRealtimeConsumers(); },
      onData(orders) {
        rawAdminOrders = reconcileAdminOrderSnapshot(orders, rawAdminOrders).sort((a, b) => activityTimestampMillis(b.createdAt) - activityTimestampMillis(a.createdAt));
        projectAdminOrders();
        adminRealtimeReady.orders = true;
        adminRealtimeErrors.orders = '';
        refreshRealtimeConsumers();
      },
      onError(error) {
        adminRealtimeReady.orders = false;
        adminRealtimeErrors.orders = 'No se pudieron actualizar los pedidos.';
        console.error('Pedidos en tiempo real no disponibles:', error);
        statisticsSetText('statistics-live-status', 'Pedidos no disponibles');
        recoverAdminRealtimeAuth(error, 'orders');
        refreshRealtimeConsumers();
      }
    });
    adminOrdersUnsubscribe = source.stop;
  } else {
    adminRealtimeReady.orders = true;
  }
  if (currentRole === 'superadmin') {
    const mergeAdminUsers = () => {
      allUsers = [...adminUsersLive]
        .sort(compareUsersByRecentCustomerActivity);
    };
    const usersSource = createAdminPagedSource({
      complete: true,
      subscribePage(cursor, next, fail) {
        // El ID existe también en cuentas históricas sin createdAt. Los
        // cambios de nombre/rol no mueven las fronteras de estas páginas.
        const usersQuery = cursor
          ? query(collection(db, 'users'), orderBy('__name__'), startAfter(cursor), limit(ADMIN_REALTIME_LIMIT))
          : query(collection(db, 'users'), orderBy('__name__'), limit(ADMIN_REALTIME_LIMIT));
        return onSnapshot(usersQuery, { includeMetadataChanges: true }, snapshot => {
          const last = snapshot.docs.at(-1);
          next({ records: snapshot.docs.map(item => ({ id: item.id, uid: item.id, ...item.data() })),
            cursor: last, cursorKey: last?.id || '', hasMore: snapshot.docs.length === ADMIN_REALTIME_LIMIT,
            authoritative: snapshot.metadata?.fromCache !== true });
        }, fail);
      },
      onLoading() { adminRealtimeReady.users = false; refreshRealtimeConsumers(); },
      onData(users) {
        adminUsersLive = users;
        mergeAdminUsers();
        adminRealtimeReady.users = true;
        adminRealtimeErrors.users = '';
        refreshRealtimeConsumers();
      },
      onError(error) {
        adminRealtimeReady.users = false;
        adminRealtimeErrors.users = 'No se pudieron actualizar los usuarios.';
        console.error('Usuarios en tiempo real no disponibles:', error);
        statisticsSetText('statistics-live-status', 'Usuarios no disponibles');
        recoverAdminRealtimeAuth(error, 'users');
        refreshRealtimeConsumers();
      },
    });
    adminUsersUnsubscribe = usersSource.stop;
    listenStatisticsTraffic();
  }
}

const statisticsRangeSelect = document.getElementById('statistics-range');
if (statisticsRangeSelect) {
  statisticsRangeSelect.addEventListener('change', () => {
    statisticsRangeDays = Math.max(1, Math.min(30, Number(statisticsRangeSelect.value || 7)));
    statisticsSetText('statistics-live-status', 'Actualizando…');
    listenStatisticsTraffic();
    renderGeneralStatistics();
  });
}

window.addEventListener('pagehide', stopAdminRealtimeData);

function renderOnlineLocations(active, now) {
  const container = document.getElementById('dashboard-online-locations');
  const detail = document.getElementById('dashboard-online-detail');
  if (detail) detail.textContent = `${active.length} activo${active.length === 1 ? '' : 's'}`;
  if (!container) return;
  if (!active.length) {
    container.innerHTML = '<div class="adm-visitor-empty">No hay visitantes activos en este momento.</div>';
    return;
  }
  container.innerHTML = active.slice(0, 20).map(item => `
    <div class="adm-visitor-row">
      <div>
        <div class="adm-visitor-location" title="${escapeHtmlAdmin(activityLocationLabel(item))}">${escapeHtmlAdmin(activityLocationLabel(item))}</div>
        <div class="adm-visitor-meta">${escapeHtmlAdmin(activityPageLabel(item.page))}</div>
      </div>
      <div class="adm-visitor-count">${escapeHtmlAdmin(activityRelativeTime(item.lastSeen, now))}</div>
    </div>
  `).join('');
}

function renderTodayLocations(sessions, now) {
  const container = document.getElementById('dashboard-today-locations');
  const detail = document.getElementById('dashboard-today-detail');
  if (detail) detail.textContent = `${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}`;
  if (!container) return;
  if (!sessions.length) {
    container.innerHTML = '<div class="adm-visitor-empty">Todavía no hay sesiones registradas hoy.</div>';
    return;
  }

  const locations = new Map();
  sessions.forEach(item => {
    const label = activityLocationLabel(item);
    const key = [item.countryCode || '', label].join('|');
    const previous = locations.get(key) || { label, count: 0, lastSeen: 0 };
    previous.count += 1;
    previous.lastSeen = Math.max(previous.lastSeen, activityTimestampMillis(item.startedAt));
    locations.set(key, previous);
  });

  const sorted = [...locations.values()]
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, 20);

  container.innerHTML = sorted.map(item => `
    <div class="adm-visitor-row">
      <div>
        <div class="adm-visitor-location" title="${escapeHtmlAdmin(item.label)}">${escapeHtmlAdmin(item.label)}</div>
        <div class="adm-visitor-meta">Última sesión ${escapeHtmlAdmin(activityRelativeTime(item.lastSeen, now))}</div>
      </div>
      <div class="adm-visitor-count">${item.count}</div>
    </div>
  `).join('');
}

function renderDashboardActivityMetrics() {
  const sessionsEl = document.getElementById('stat-visits-today');
  const onlineEl = document.getElementById('stat-online-now');
  const statusEl = document.getElementById('dashboard-live-status');
  const now = Date.now();
  const active = dashboardActivityState.presence
    .filter(item => {
      const lastSeen = activityTimestampMillis(item.lastSeen);
      return lastSeen >= now - DASHBOARD_ONLINE_WINDOW_MS && lastSeen <= now + 60000;
    })
    .sort((a, b) => activityTimestampMillis(b.lastSeen) - activityTimestampMillis(a.lastSeen));

  // El total real (siteAggregate) cuenta a toda visita, no solo a quienes
  // aceptaron estadísticas — se usa como fuente principal apenas llega el
  // primer snapshot; dashboardActivityState.sessions.length queda de
  // respaldo (sub-cuenta) mientras ese listener no resolvió todavía.
  if (sessionsEl) {
    sessionsEl.textContent = dashboardActivityState.totalVisits != null
      ? dashboardActivityState.totalVisits
      : dashboardActivityState.sessions.length;
  }
  if (onlineEl) onlineEl.textContent = active.length;
  if (statusEl) {
    statusEl.textContent = `En vivo · ${new Intl.DateTimeFormat('es-PY', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date(now))}`;
  }
  renderOnlineLocations(active, now);
  renderTodayLocations(dashboardActivityState.sessions, now);
  renderGeneralStatistics();
}

function stopDashboardActivityMetrics() {
  if (dashboardSessionUnsubscribe) dashboardSessionUnsubscribe();
  if (dashboardPresenceUnsubscribe) dashboardPresenceUnsubscribe();
  if (dashboardAggregateUnsubscribe) dashboardAggregateUnsubscribe();
  dashboardSessionUnsubscribe = null;
  dashboardPresenceUnsubscribe = null;
  dashboardAggregateUnsubscribe = null;
  window.clearInterval(dashboardActivityClock);
  window.clearInterval(dashboardPresenceRestart);
  dashboardActivityClock = 0;
  dashboardPresenceRestart = 0;
  dashboardActivityDay = '';
  dashboardActivityState = { sessions: [], presence: [], totalVisits: null };
}

// Total real de visitas del día (siteAggregate) — a diferencia de
// dashboardActivityState.sessions (siteTraffic), cuenta a CUALQUIER
// visitante sin depender de que haya aceptado estadísticas en el banner de
// cookies, porque no guarda identidad ni detalle por persona.
function listenDashboardAggregate() {
  const dayKey = paraguayDayKeyAdmin();
  if (dashboardAggregateUnsubscribe) dashboardAggregateUnsubscribe();
  dashboardAggregateUnsubscribe = onSnapshot(
    doc(db, 'siteAggregate', dayKey),
    snapshot => {
      dashboardActivityState.totalVisits = snapshot.exists() ? Number(snapshot.data()?.totalVisits || 0) : 0;
      renderDashboardActivityMetrics();
    },
    error => {
      dashboardActivityState.totalVisits = null;
      console.warn('Métrica agregada de visitas no disponible:', error);
      renderDashboardActivityMetrics();
    }
  );
}

function listenDashboardSessions() {
  const dayKey = paraguayDayKeyAdmin();
  if (dashboardSessionUnsubscribe) dashboardSessionUnsubscribe();
  dashboardActivityDay = dayKey;
  dashboardSessionUnsubscribe = onSnapshot(
    collection(db, 'siteTraffic', dayKey, 'sessions'),
    snapshot => {
      dashboardActivityState.sessions = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      statisticsTrafficSessions = statisticsTrafficHistorySessions.concat(dashboardActivityState.sessions);
      renderDashboardActivityMetrics();
    },
    error => {
      document.getElementById('stat-visits-today').textContent = '—';
      document.getElementById('dashboard-live-status').textContent = 'Sesiones no disponibles';
      console.warn('Métrica de sesiones no disponible:', error);
    }
  );
}

function listenDashboardPresence() {
  if (dashboardPresenceUnsubscribe) dashboardPresenceUnsubscribe();
  const recentSince = Timestamp.fromMillis(Date.now() - DASHBOARD_PRESENCE_QUERY_MS);
  dashboardPresenceUnsubscribe = onSnapshot(
    query(collection(db, 'sitePresence'), where('lastSeen', '>=', recentSince)),
    snapshot => {
      dashboardActivityState.presence = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      adminRealtimeReady.presence = true;
      renderDashboardActivityMetrics();
    },
    error => {
      adminRealtimeReady.presence = false;
      document.getElementById('stat-online-now').textContent = '—';
      document.getElementById('dashboard-live-status').textContent = 'Presencia no disponible';
      // El indicador "En línea" de Estadísticas muestra "—" (no "0") al fallar.
      renderGeneralStatistics();
      console.warn('Métrica de presencia no disponible:', error);
    }
  );
}

function startDashboardActivityMetrics() {
  stopDashboardActivityMetrics();
  const card = document.getElementById('dashboard-visitor-geo');
  const sessionsEl = document.getElementById('stat-visits-today');
  const onlineEl = document.getElementById('stat-online-now');
  if (currentRole !== 'superadmin') {
    if (card) card.hidden = true;
    if (sessionsEl) sessionsEl.textContent = '—';
    if (onlineEl) onlineEl.textContent = '—';
    return;
  }

  if (card) card.hidden = false;
  listenDashboardSessions();
  listenDashboardPresence();
  listenDashboardAggregate();
  renderDashboardActivityMetrics();

  dashboardActivityClock = window.setInterval(() => {
    if (paraguayDayKeyAdmin() !== dashboardActivityDay) {
      listenDashboardSessions();
      listenStatisticsTraffic();
    }
    renderDashboardActivityMetrics();
  }, 15000);
  dashboardPresenceRestart = window.setInterval(listenDashboardPresence, 5 * 60 * 1000);
}

window.addEventListener('pagehide', stopDashboardActivityMetrics);

function refreshStatisticsViews() {
  renderDashboardData();
  renderGeneralStatistics();
}

function renderDashboardData() {
    const statisticsReady = currentRole !== 'superadmin' || ensureStatisticsControls(refreshStatisticsViews, runAdminCrudOperation);
    // Users count — el Modder no tiene permiso para leer la colección users
    // (ni debería: expondría emails/teléfonos de todas las clientas), así que
    // ni se intenta la lectura para no generar un error de permisos silencioso.
    const statUsersEl = document.getElementById('stat-users');
    if (can(currentRole, 'manageUsers') && adminRealtimeReady.users) {
      statUsersEl.textContent = allUsers.length;
    } else {
      statUsersEl.textContent = '—';
    }

    // Orders
    const orders = allOrders;
    const ordersReady = adminRealtimeReady.orders === true;

    // Roles y Permisos: cada widget del Dashboard se puede apagar puntualmente
    // por rol (dashboard.verMetricas / verVentas / verPedidosRecientes) sin
    // tocar el techo fijo de viewDashboard, que sigue gateando la sección entera.
    const canMetricas = roleCanDo('dashboard', 'verMetricas');
    const canVentas = roleCanDo('dashboard', 'verVentas');
    const canRecientes = roleCanDo('dashboard', 'verPedidosRecientes');

    const statOrdersTotalEl = document.getElementById('stat-orders-total');
    const statOrdersTodayEl = document.getElementById('stat-orders-today');
    const statSalesMonthEl = document.getElementById('stat-sales-month');
    const recentWrap = document.getElementById('dash-recent-orders')?.closest('.adm-card');

    if (canMetricas && ordersReady) {
      statOrdersTotalEl.textContent = orders.length;
      // Orders today
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayOrders = orders.filter(o => {
        if (!o.createdAt) return false;
        const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return d >= today;
      });
      statOrdersTodayEl.textContent = todayOrders.length;
    } else {
      statOrdersTotalEl.textContent = '—';
      statOrdersTodayEl.textContent = '—';
    }

    if (canVentas && ordersReady && statisticsReady) {
      const today2 = new Date();
      const monthStart = new Date(today2.getFullYear(), today2.getMonth(), 1);
      const monthSales = filterStatisticsRows('revenue', orders, row => activityTimestampMillis(row.createdAt))
        .filter(o => {
          if (!o.createdAt) return false;
          const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
          return d >= monthStart;
        })
        .reduce((s, o) => s + (o.total || 0), 0);
      statSalesMonthEl.textContent = formatPrice(monthSales);
    } else {
      statSalesMonthEl.textContent = '—';
    }

    if (!canRecientes) {
      if (recentWrap) recentWrap.style.display = 'none';
      return;
    }
    if (recentWrap) recentWrap.style.display = '';

    const tbody = document.getElementById('dash-recent-orders');
    if (!ordersReady) {
      const message = adminRealtimeErrors.orders
        ? 'Pedidos no disponibles. Conservamos los últimos datos confirmados sin usarlos como métricas actuales.'
        : 'Sincronizando pedidos…';
      tbody.innerHTML = `<tr><td colspan="5" class="adm-loading">${escapeHtmlAdmin(message)}</td></tr>`;
      return;
    }

    // Recent orders (last 5)
    const recent = [...orders]
      .sort((a,b) => {
        const da = activityTimestampMillis(a.createdAt);
        const db_ = activityTimestampMillis(b.createdAt);
        return db_ - da;
      })
      .slice(0, 5);

    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:24px">Sin pedidos aún</td></tr>';
      return;
    }
    tbody.innerHTML = recent.map(o => `
      <tr>
        <td><strong>${escapeHtmlAdmin(o.userName || o.userEmail || '—')}</strong><br><small style="color:#777">${escapeHtmlAdmin(o.userPhone || '')}</small></td>
        <td style="font-weight:700;color:var(--color-text-primary,#713C53)">${formatPrice(o.total || 0)}</td>
        <td>${orderStatusBadgeHtml(o.status)}</td>
        <td>${escapeHtmlAdmin(o.shipping?.city || '—')}</td>
        <td>${formatDate(o.createdAt)}</td>
      </tr>
    `).join('');
}

function loadDashboard() {
  startDashboardActivityMetrics();
  renderDashboardData();
  renderGeneralStatistics();
}

// ======== USUARIOS ========
// Dos pestañas: Usuarios (activos) y Bloqueados. La eliminación borra la
// cuenta por completo (queda sólo la auditoría), así que no existe una lista
// de eliminados. Un resto histórico marcado como eliminado (tombstone del
// sistema anterior) no se muestra en ninguna de las dos: se limpia con
// "Eliminar por correo".
let userStatusFilter = 'active';
let userSortMode = 'recent';
let usersPage = 0;
const ADMIN_PAGE_SIZE = 30;

function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!adminRealtimeReady.users) {
    tbody.innerHTML = '<tr><td colspan="9" class="adm-loading"><span class="adm-spinner"></span> Sincronizando usuarios...</td></tr>';
    return;
  }
  applyUserFilters();
}

// Única fuente de verdad para lo que se ve en la tabla: combina el texto de
// búsqueda con la pestaña activa (Usuarios = solo activos, Bloqueados = solo
// bloqueados) — usada por ambos inputs.
function compareUsersByRecentCustomerActivity(a, b) {
  const isCustomer = user => String(user.email || '').trim().toLowerCase() !== SUPER_ADMIN.toLowerCase()
    && (user.role || 'client') === 'client'
    && (!user.roleBeforeBlock || user.roleBeforeBlock === 'client');
  const customerA = isCustomer(a), customerB = isCustomer(b);
  if (customerA !== customerB) return customerA ? -1 : 1;
  const activity = user => Math.max(activityTimestampMillis(user.createdAt), activityTimestampMillis(user.lastLogin), activityTimestampMillis(user.lastLoginAt));
  const at = user => isCustomer(user) ? activity(user) : activityTimestampMillis(user.createdAt);
  return at(b) - at(a) || String(a.uid || '').localeCompare(String(b.uid || ''));
}

let _lastFilteredUsers = [];
function applyUserFilters() {
  const q = normalizeAdminSearch(document.getElementById('user-search').value);
  let filtered = allUsers.filter(u =>
    normalizeAdminSearch(u.name).includes(q) ||
    normalizeAdminSearch(u.email).includes(q)
  );
  filtered = userStatusFilter === 'blocked'
    ? filtered.filter(u => u.blocked && u.deleted !== true && u.profileStatus !== 'deleted')
    : filtered.filter(u => !u.blocked && u.deleted !== true && u.profileStatus !== 'deleted');
  filtered = userSortMode === 'totalSpent'
    ? [...filtered].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    : userSortMode === 'purchaseCount'
      ? [...filtered].sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0))
      : userSortMode === 'name'
        ? [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
        : [...filtered].sort(compareUsersByRecentCustomerActivity);
  _lastFilteredUsers = filtered;
  usersPage = Math.min(usersPage, Math.max(0, Math.ceil(filtered.length / ADMIN_PAGE_SIZE) - 1));
  const visibleIds = new Set(filtered.map(u => u.uid));
  [..._selectedUsers].forEach(uid => { if (!visibleIds.has(uid)) _selectedUsers.delete(uid); });
  renderUsersTable(filtered);
  updateBlockedCount();
  updateUsersBulkToolbar();
}

function updateBlockedCount() {
  const el = document.getElementById('users-blocked-count');
  if (!el) return;
  const n = allUsers.filter(u => u.blocked && u.deleted !== true && u.profileStatus !== 'deleted').length;
  el.textContent = n ? `(${n})` : '';
}

window.filterUsersByStatus = (status) => {
  userStatusFilter = status;
  document.querySelectorAll('.user-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.userTab === status));
  applyUserFilters();
};

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  const totalPages = Math.max(1, Math.ceil(users.length / ADMIN_PAGE_SIZE));
  usersPage = Math.min(usersPage, totalPages - 1);
  const pageUsers = users.slice(usersPage * ADMIN_PAGE_SIZE, (usersPage + 1) * ADMIN_PAGE_SIZE);
  const pager = document.getElementById('users-pagination');
  if (pager) {
    pager.innerHTML = totalPages > 1 ? `<button type="button" class="adm-btn adm-btn-sm" ${adminEventAttributes('click','setUsersPage',[usersPage - 1])} ${usersPage <= 0 ? 'disabled' : ''}>Anterior</button><span>Página ${usersPage + 1} de ${totalPages}</span><button type="button" class="adm-btn adm-btn-sm" ${adminEventAttributes('click','setUsersPage',[usersPage + 1])} ${usersPage >= totalPages - 1 ? 'disabled' : ''}>Siguiente</button>` : '';
  }
  if (!users.length) {
    const emptyMsg = userStatusFilter === 'blocked' ? 'No hay usuarios bloqueados' : 'Sin usuarios';
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">${emptyMsg}</td></tr>`;
    return;
  }
  tbody.innerHTML = pageUsers.map(u => {
    const isSuperAdmin = u.email === SUPER_ADMIN;
    const safeUid = escapeHtmlAdmin(u.uid);
    const uidArg = String((u.uid) ?? '');
    const emailArg = String((u.email || '') ?? '');
    const nameArg = String((u.name || u.email || '') ?? '');
    const safeRole = Object.prototype.hasOwnProperty.call(ROLE_LABELS, u.role) ? u.role : 'client';
    // Se usa can(role,'manageUsers') en vez de comparar el nombre del rol a mano
    // — hoy solo superadmin tiene ese permiso, pero si el día de mañana cambia
    // la matriz de permisos, esta línea sigue siendo correcta sin tocarla.
    const canEdit = can(currentRole, 'manageUsers') && !isSuperAdmin;
    const roleBadge = `<span class="adm-badge role-${safeRole}">${escapeHtmlAdmin(ROLE_LABELS[safeRole] || 'Cliente')}</span>`;
    const deleted = u.deleted === true || u.profileStatus === 'deleted';
    const blockedBadge = deleted
      ? '<span class="adm-badge badge-cancelado">Eliminado</span>'
      : u.blocked
        ? '<span class="adm-badge badge-cancelado">Bloqueado</span>'
      : '<span class="adm-badge badge-entregado">Activo</span>';

    // Ficha ampliada de la Fase E: solo se arma para usuarios bloqueados, para
    // no recargar la tabla en el caso normal. IP de registro deliberadamente
    // NO se captura (no hay backend seguro en este proyecto sin facturación) —
    // se explicita acá en vez de omitirlo en silencio.
    const blockedDetail = u.blocked && !deleted ? `
      <div style="margin-top:6px;font-size:11px;color:#888;line-height:1.6;max-width:230px">
        ${u.phone ? `<div><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${escapeHtmlAdmin(u.phone)}</div>` : ''}
        ${u.roleBeforeBlock ? `<div>Rol antes del bloqueo: <strong>${escapeHtmlAdmin(ROLE_LABELS[u.roleBeforeBlock] || u.roleBeforeBlock)}</strong></div>` : ''}
        ${u.blockedAt ? `<div>Bloqueado: ${formatDate(u.blockedAt)}</div>` : ''}
        ${u.blockedBy ? `<div>Por: ${escapeHtmlAdmin(u.blockedBy)}</div>` : ''}
        <div>Motivo: ${u.blockReason ? escapeHtmlAdmin(u.blockReason) : '<span style="color:#777">sin especificar</span>'}</div>
        ${u.lastLogin ? `<div>Última actividad: ${formatDate(u.lastLogin)}</div>` : ''}
        <div style="color:#ccc">IP de registro: no disponible (requiere backend seguro)</div>
      </div>
    ` : '';

    // Mientras está bloqueado el rol no se edita a mano — cambiar el rol de
    // una cuenta bloqueada pasa exclusivamente por "Restaurar", para que
    // nunca quede el estado inconsistente blocked:true + role:'agent'/'admin'.
    const roleSelect = canEdit && can(currentRole, 'assignRoles') && !u.blocked && !deleted ? `
      <select class="adm-select" style="width:auto;font-size:11px;padding:4px 8px"
        ${adminEventAttributes('change','updateUserRole',[uidArg,{control:'value'},emailArg])}
        ${isSuperAdmin ? 'disabled' : ''}>
        <option value="superadmin" ${u.role==='superadmin'?'selected':''} ${!isSuperAdmin?'style="display:none"':''}>Super Admin</option>
        <option value="admin"      ${u.role==='admin'?'selected':''}>Admin</option>
        <option value="agent"      ${u.role==='agent'?'selected':''}>Agente</option>
        <option value="viewer"     ${u.role==='viewer'?'selected':''}>Viewer</option>
        <option value="client"     ${u.role==='client'?'selected':''}>Cliente</option>
      </select>
    ` : roleBadge;

    const actions = canEdit ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${!isSuperAdmin ? (u.blocked
          ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','restoreUser',[uidArg])}>Desbloquear</button>`
          : `<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" ${adminEventAttributes('click','blockUser',[uidArg,emailArg])}>Bloquear</button>`
        ) : ''}
      </div>
    ` : '<span style="color:#ccc;font-size:12px">—</span>';

    const avatarUrl = sanitizeImageUrl(u.photoURL || '');
    const avatar = avatarUrl
      ? `<div class="adm-tbl-avatar"><img src="${escapeHtmlAdmin(avatarUrl)}" alt="" /></div>`
      : `<div class="adm-tbl-avatar">${escapeHtmlAdmin(String(u.name || u.email || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?')}</div>`;

    return `
      <tr>
        <td class="col-select">${!isSuperAdmin ? `<input type="checkbox" class="user-row-check" data-id="${safeUid}" onclick="toggleUserSelect(this)" ${_selectedUsers.has(u.uid) ? 'checked' : ''}>` : ''}</td>
        <td>${avatar}</td>
        <td><strong>${escapeHtmlAdmin(u.name || '—')}</strong></td>
        <td style="font-size:12px;color:#713C53">${escapeHtmlAdmin(u.email || '—')}</td>
        <td style="font-size:12px;color:#713C53">${escapeHtmlAdmin(u.phone || '—')}</td>
        <td>${roleSelect}</td>
        <td>${blockedBadge}${blockedDetail}</td>
        <td style="font-size:12px;color:#713C53">${u.purchaseCount || 0}</td>
        <td style="font-size:12px;color:#713C53">${formatPrice(u.totalSpent || 0)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');
}

window.setUsersPage = function(page) {
  usersPage = Math.max(0, Number(page) || 0);
  renderUsersTable(_lastFilteredUsers);
};

// Búsqueda y pestañas Usuarios/Bloqueados — comparten applyUserFilters()
document.getElementById('user-search').oninput = debounceAdminSearch(() => { usersPage = 0; applyUserFilters(); });
document.getElementById('user-sort').onchange = (e) => { userSortMode = e.target.value; applyUserFilters(); };
document.querySelectorAll('#section-usuarios .user-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => window.filterUsersByStatus(btn.dataset.userTab));
});

window.updateUserRole = async (uid, role, email) => {
  // El rol del Super Admin real está protegido de raíz — no solo se oculta el
  // <select>. Su identidad viene únicamente de Firebase Auth (roles.js), así que
  // tocar el campo role de su ficha no lo degrada, pero dejaría un estado
  // inconsistente; se bloquea siempre ("no debe poder degradarse accidentalmente").
  if (email === SUPER_ADMIN) {
    toast('El rol del Super Admin está protegido y no se puede cambiar');
    return;
  }
  // Cada acción sensible valida el rol del actor, no solo la UI.
  if (!can(currentRole, 'assignRoles')) { toast('No tenés permiso para cambiar roles'); return; }
  // 'superadmin' es una identidad protegida por email, nunca un rol asignable
  // desde el panel (igual que setUserRole en roles.js y phase8). Un valor fuera
  // de la lista se rechaza en vez de escribir un rol inválido en la ficha.
  if (!ASSIGNABLE_ROLES.includes(role)) {
    toast('Rol no válido');
    return;
  }
  const u = allUsers.find(u => u.uid === uid);
  const prevRole = u?.role || 'client';
  await runAdminCrudOperation({
    title: 'Actualizar rol del cliente', name: u?.name || email || uid, module: 'clientes',
    stages: [{ id: 'write', label: 'Actualizar rol y permisos' }, { id: 'refresh', label: 'Actualizar lista de clientes' }],
    action: async ctx => {
      ctx.start('write');
      await withAdminSiteChange(async () => setDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() }, { merge: true }));
      if (u) u.role = role;
      await logAudit('cambiar_rol', 'usuario', uid, email, `Rol: ${ROLE_LABELS[prevRole] || prevRole} → ${ROLE_LABELS[role]}`);
      ctx.ok('write');
      ctx.start('refresh');
      applyUserFilters();
      ctx.ok('refresh');
      return `Rol actualizado a ${ROLE_LABELS[role]}.`;
    },
  });
};

// Bloquear: pide un motivo opcional, guarda quién y cuándo, y guarda el rol
// que tenía ANTES de bloquear (roleBeforeBlock) para poder restaurarlo bien
// — mientras está bloqueado, su rol pasa a 'client' así pierde de una todo
// permiso operativo (además de perderlo también en firestore.rules).
window.blockUser = async (uid, email) => {
  if (email === SUPER_ADMIN) { toast('No se puede bloquear al Super Admin'); return; }
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  const reason = window.prompt('Motivo del bloqueo (opcional, se puede dejar en blanco):', '') ?? null;
  if (reason === null) return; // canceló el diálogo, no bloqueamos nada
  const prevRole = u.role || 'client';
  if (!confirm(`¿Bloquear a "${u.name || u.email}"?\n\nNo va a poder comprar, entrar a Mi Cuenta${prevRole !== 'client' ? ' ni acceder al panel' : ''} hasta que la restaures.`)) return;
  await runAdminCrudOperation({
    title: 'Bloquear cliente', name: u.name || email || uid, module: 'clientes',
    stages: [{ id: 'write', label: 'Actualizar estado de la cuenta' }],
    action: async ctx => {
      ctx.start('write');
      await withAdminSiteChange(async () => updateDoc(doc(db, 'users', uid), {
        blocked: true,
        blockedAt: serverTimestamp(),
        blockedBy: currentUser?.email || '',
        blockReason: reason,
        roleBeforeBlock: prevRole,
        role: 'client',
        updatedAt: serverTimestamp()
      }));
      Object.assign(u, { blocked: true, blockedBy: currentUser?.email || '', blockReason: reason, roleBeforeBlock: prevRole, role: 'client' });
    await logAudit('bloquear_usuario', 'usuario', uid, u.name || email, reason ? `Motivo: ${reason}` : 'Sin motivo especificado');
      applyUserFilters();
      ctx.ok('write');
      return 'El cliente quedó bloqueado.';
    },
  });
};

// Restaurar: si tenía un rol elevado antes del bloqueo, pide confirmación
// explícita para devolvérselo; si no hay historial (o decide no confirmarlo),
// restaura como Cliente por seguridad — tal como pidió Tintin.
window.restoreUser = async (uid) => {
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  if (u.deleted === true || u.profileStatus === 'deleted') {
    toast('Esta cuenta quedó con una baja incompleta. Eliminala para liberar el correo; la persona podrá registrarse de nuevo.');
    return;
  }
  const targetRole = ASSIGNABLE_ROLES.includes(u.roleBeforeBlock) ? u.roleBeforeBlock : 'client';
  if (!confirm(`¿Restaurar a "${u.name || u.email}" como ${ROLE_LABELS[targetRole] || targetRole}?`)) return;
  await runAdminCrudOperation({
    title: 'Restaurar cliente', name: u.name || u.email || uid, module: 'clientes',
    stages: [{ id: 'write', label: 'Restaurar estado y permisos' }],
    action: async ctx => {
      ctx.start('write');
      await withAdminSiteChange(async () => updateDoc(doc(db, 'users', uid), {
        blocked: false,
        role: targetRole,
        blockedAt: deleteField(),
        blockedBy: deleteField(),
        blockReason: deleteField(),
        roleBeforeBlock: deleteField(),
        updatedAt: serverTimestamp()
      }));
      Object.assign(u, { blocked: false, role: targetRole });
      delete u.blockedAt; delete u.blockedBy; delete u.blockReason; delete u.roleBeforeBlock;
      await logAudit('restaurar_usuario', 'usuario', uid, u.name || u.email, `Restaurado como ${ROLE_LABELS[targetRole]}`);
      applyUserFilters();
      ctx.ok('write');
      return `El cliente quedó restaurado como ${ROLE_LABELS[targetRole]}.`;
    },
  });
};

// Cuentas: sólo Activas o Bloqueadas. La eliminación de cuentas se retiró
// por completo (panel, servidor y Google Sheets): para sacar a alguien se lo
// bloquea, y vuelve sólo cuando el Super Admin lo desbloquea manualmente.

// ══════════════════════════════════════════════
// USUARIOS: SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS
// ══════════════════════════════════════════════
let _selectedUsers = new Set();

window.toggleSelectAllUsers = function(masterCb) {
  const pageIds = new Set(_lastFilteredUsers.slice(usersPage * ADMIN_PAGE_SIZE, (usersPage + 1) * ADMIN_PAGE_SIZE).map(user => user.uid));
  document.querySelectorAll('.user-row-check').forEach(cb => {
    if (!pageIds.has(cb.dataset.id)) return;
    if (masterCb.checked) {
      if (_selectedUsers.size < MAX_ADMIN_BULK_SELECTION || _selectedUsers.has(cb.dataset.id)) {
        _selectedUsers.add(cb.dataset.id);
        cb.checked = true;
      } else cb.checked = false;
    } else {
      _selectedUsers.delete(cb.dataset.id);
      cb.checked = false;
    }
  });
  if (masterCb.checked && _selectedUsers.size >= MAX_ADMIN_BULK_SELECTION) toast(`La selección está limitada a ${MAX_ADMIN_BULK_SELECTION} usuarios.`);
  updateUsersBulkToolbar();
};

window.toggleUserSelect = function(cb) {
  if (cb.checked && _selectedUsers.size >= MAX_ADMIN_BULK_SELECTION && !_selectedUsers.has(cb.dataset.id)) {
    cb.checked = false;
    toast(`Solo se pueden seleccionar ${MAX_ADMIN_BULK_SELECTION} usuarios por vez.`);
  } else if (cb.checked) _selectedUsers.add(cb.dataset.id);
  else _selectedUsers.delete(cb.dataset.id);
  const master = document.getElementById('check-all-users');
  if (master) {
    const total = document.querySelectorAll('.user-row-check').length;
    const currentPageSelected = [...document.querySelectorAll('.user-row-check')].filter(cb => _selectedUsers.has(cb.dataset.id)).length;
    master.indeterminate = currentPageSelected > 0 && currentPageSelected < total;
    master.checked = currentPageSelected === total && total > 0;
  }
  updateUsersBulkToolbar();
};

function updateUsersBulkToolbar() {
  const count = _selectedUsers.size;
  const toolbar = document.getElementById('users-bulk-toolbar');
  const countEl = document.getElementById('users-bulk-count');
  const blockBtn = document.getElementById('users-bulk-block-btn');
  const restoreBtn = document.getElementById('users-bulk-restore-btn');
  const roleSelect = document.getElementById('users-bulk-role');
  const roleApplyBtn = document.getElementById('users-bulk-role-apply-btn');
  // Todo el módulo Usuarios (individual y masivo) es exclusivo de Super
  // Admin — mismo permiso que ya gatea las acciones de a una (manageUsers).
  const allowed = can(currentRole, 'manageUsers');
  if (toolbar) toolbar.classList.toggle('show', allowed && count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
  if (blockBtn) blockBtn.style.display = userStatusFilter === 'active' ? '' : 'none';
  if (restoreBtn) restoreBtn.style.display = userStatusFilter === 'blocked' ? '' : 'none';
  if (roleSelect) roleSelect.style.display = '';
  if (roleApplyBtn) roleApplyBtn.style.display = '';
}

window.clearUsersSelection = function() {
  _selectedUsers.clear();
  document.querySelectorAll('.user-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-users');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateUsersBulkToolbar();
};

window.bulkChangeUserRole = async function() {
  if (!_selectedUsers.size) return;
  if (!can(currentRole, 'manageUsers') || !can(currentRole, 'assignRoles')) { toast('No tenés permiso para cambiar roles'); return; }
  const role = document.getElementById('users-bulk-role')?.value;
  if (!role) { toast('Elegí un rol'); return; }
  // SUPER_ADMIN nunca se incluye en la selección (ver renderUsersTable), así
  // que esto ya excluye auto-asignación y degradación de tintinaccs@gmail.com
  // — doble resguardo además de lo que ya obliga firestore.rules.
  const ids = [..._selectedUsers].filter(uid => {
    const u = allUsers.find(x => x.uid === uid);
    return u && u.email !== SUPER_ADMIN && !u.blocked;
  });
  if (!ids.length) { toast('No hay usuarios elegibles en la selección (los bloqueados solo se restauran)'); return; }
  const n = ids.length;
  if (!confirm(`¿Cambiar el rol a "${ROLE_LABELS[role]}" en ${n} usuario(s)?`)) return;
  try {
    await batchUpdateChunked(ids, () => ({ role, updatedAt: serverTimestamp() }), 'users');
    ids.forEach(uid => { const u = allUsers.find(x => x.uid === uid); if (u) u.role = role; });
    logAudit('cambiar_rol', 'usuario', '', '', `Rol → ${ROLE_LABELS[role]}`, { bulk: true, count: n });
    toast(`Rol actualizado en ${n} usuario(s)`);
    clearUsersSelection();
    applyUserFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

window.bulkBlockUsers = async function() {
  if (!_selectedUsers.size) return;
  if (rejectOversizedAdminBulkSelection(_selectedUsers, 'usuarios')) return;
  if (!can(currentRole, 'manageUsers')) { toast('No tenés permiso para bloquear usuarios'); return; }
  const ids = [..._selectedUsers].filter(uid => {
    const u = allUsers.find(x => x.uid === uid);
    return u && u.email !== SUPER_ADMIN && !u.blocked;
  });
  if (!ids.length) { toast('No hay usuarios elegibles en la selección'); return; }
  const n = ids.length;
  if (!confirm(`¿Bloquear ${n} usuario(s)? No van a poder comprar ni entrar a Mi Cuenta hasta que los restaures.`)) return;
  const reason = window.prompt('Motivo del bloqueo (opcional, aplica a todos los seleccionados):', '') ?? '';
  try {
    const CHUNK = 450;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK).forEach(uid => {
        const u = allUsers.find(x => x.uid === uid);
        batch.update(doc(db, 'users', uid), {
          blocked: true, blockedAt: serverTimestamp(), blockedBy: currentUser?.email || '',
          blockReason: reason, roleBeforeBlock: u?.role || 'client', role: 'client', updatedAt: serverTimestamp()
        });
      });
      await withAdminSiteChange(async () => batch.commit());
    }
    ids.forEach(uid => {
      const u = allUsers.find(x => x.uid === uid);
      if (u) Object.assign(u, { blocked: true, blockedBy: currentUser?.email || '', blockReason: reason, roleBeforeBlock: u.role || 'client', role: 'client' });
    });
    logAudit('bloquear_usuario', 'usuario', '', '', reason ? `Motivo: ${reason}` : 'Sin motivo especificado', { bulk: true, count: n });
    toast(`${n} usuario(s) bloqueados`);
    clearUsersSelection();
    applyUserFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

// Restaurar masivo conserva el rol válido anterior. El bloqueo ya revoca el
// acceso mediante `blocked`; degradar silenciosamente a Cliente al desbloquear
// hacía perder permisos legítimos de viewer/agent/admin.
window.bulkRestoreUsers = async function() {
  if (!_selectedUsers.size) return;
  if (!can(currentRole, 'manageUsers')) { toast('No tenés permiso para restaurar usuarios'); return; }
  // Las cuentas eliminadas no se reactivan desde acá: se borran por completo
  // y la persona debe registrarse nuevamente (vuelve como cuenta nueva).
  const selected = [..._selectedUsers].map(uid => allUsers.find(x => x.uid === uid)).filter(Boolean);
  const ids = selected.filter(u => {
    return u && u.email !== SUPER_ADMIN && u.blocked && u.deleted !== true && u.profileStatus !== 'deleted';
  }).map(u => u.uid);
  if (!ids.length) { toast('No hay cuentas bloqueadas seleccionadas para restaurar.'); return; }
  const n = ids.length;
  if (!confirm(`¿Restaurar ${n} usuario(s)? Recuperarán su rol anterior.`)) return;
  try {
    const CHUNK = 450;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK).forEach(uid => {
        const u = allUsers.find(x => x.uid === uid);
        const restoredRole = ASSIGNABLE_ROLES.includes(u?.roleBeforeBlock) ? u.roleBeforeBlock : 'client';
        batch.update(doc(db, 'users', uid), {
          blocked: false, role: restoredRole, blockedAt: deleteField(), blockedBy: deleteField(),
          blockReason: deleteField(), roleBeforeBlock: deleteField(), updatedAt: serverTimestamp()
        });
      });
      await withAdminSiteChange(async () => batch.commit());
    }
    ids.forEach(uid => {
      const u = allUsers.find(x => x.uid === uid);
      if (u) {
        const restoredRole = ASSIGNABLE_ROLES.includes(u.roleBeforeBlock) ? u.roleBeforeBlock : 'client';
        Object.assign(u, { blocked: false, role: restoredRole });
        delete u.blockedAt; delete u.blockedBy; delete u.blockReason; delete u.roleBeforeBlock;
      }
    });
    logAudit('restaurar_usuario', 'usuario', '', '', 'Roles anteriores restaurados', { bulk: true, count: n });
    toast(`${n} usuario(s) restaurados correctamente`);
    clearUsersSelection();
    applyUserFilters();
  } catch (e) { toast('Error al restaurar: ' + e.message); }
};


function userRowsToCsv_(users) {
  const header = ['UID', 'Nombre', 'Email', 'Rol', 'Estado', 'Teléfono', 'Compras', 'Total gastado', 'Notas internas'];
  const rows = users.map(u => [
    u.uid || '', u.name || '', u.email || '', ROLE_LABELS[u.role] || u.role || '',
    u.blocked ? 'Bloqueado' : 'Activo', u.phone || '', u.purchaseCount || 0, u.totalSpent || 0, u.internalNotes || ''
  ]);
  return [header, ...rows];
}

window.bulkExportUsers = function(scope) {
  let list;
  if (scope === 'selected') {
    if (!_selectedUsers.size) { toast('No hay usuarios seleccionados'); return; }
    list = allUsers.filter(u => _selectedUsers.has(u.uid));
  } else if (scope === 'filtered') {
    list = _lastFilteredUsers.length ? _lastFilteredUsers : allUsers;
  } else {
    list = allUsers;
  }
  if (!list.length) { toast('No hay usuarios para exportar'); return; }
  downloadCsv(`usuarios_${scope}_${Date.now()}.csv`, userRowsToCsv_(list));
  toast(`Exportados ${list.length} usuario(s) a CSV`);
};

// ======== PEDIDOS ========
function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!adminRealtimeReady.orders) {
    tbody.innerHTML = '<tr><td colspan="12" class="adm-loading"><span class="adm-spinner"></span> Sincronizando pedidos...</td></tr>';
    return;
  }
  applyOrderFilters();
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (document.getElementById('section-pedidos')?.classList.contains('tt-commerce-mounted')) { tbody?.replaceChildren(); return; }
  const countEl = document.getElementById('orders-count-label');
  if (countEl) countEl.textContent = orders.length ? `${orders.length} pedido${orders.length !== 1 ? 's' : ''}` : '';

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#aaa;padding:24px">Sin pedidos aún</td></tr>';
    return;
  }

  const NOTIF_BADGE = {
    sent:    { cls: 'badge-entregado',  icon: '', label: 'Notificado' },
    pending: { cls: 'badge-pendiente',  icon: '', label: 'Pendiente' },
    partial: { cls: 'badge-preparando', icon: '', label: 'Parcial (1 de 2)' },
    failed:  { cls: 'badge-cancelado',  icon: '', label: 'Falló el envío' },
    error:   { cls: 'badge-cancelado',  icon: '', label: 'Error notif.' }, // legado, ya no se escribe
  };
  function notifBadge(status) {
    const b = NOTIF_BADGE[status] || NOTIF_BADGE.pending;
    return `<span class="adm-badge ${b.cls}" style="font-size:9px">${b.icon} ${b.label}</span>`;
  }

  tbody.innerHTML = orders.map(o => {
    const itemsText = (o.items || []).slice(0,2).map(it => `${it.qty}x ${it.name}`).join(', ') +
      (o.items?.length > 2 ? ` +${o.items.length - 2} más` : '');
    const safeOrderId = escapeHtmlAdmin(o.id);
    const orderArg = String((o.id) ?? '');
    const detailId = `order-detail-${o.id}`;
    const detailArg = String((detailId) ?? '');
    const payStatus = o.payment?.status || o.paymentStatus || 'pendiente';
    const orderStatus = o.status || 'pendiente';
    // manageOrders: cambiar estado/estado de pago — esto es lo único que el
    // Modder puede tocar, y coincide exactamente con lo que firestore.rules
    // le permite escribir en el pedido (ver comentario en firestore.rules).
    // canDo() nunca puede superar can() — solo puede acotarlo si Super Admin
    // apagó el switch específico en Roles y Permisos.
    const canUpdate = can(currentRole, 'manageOrders') && roleCanDo('pedidos', 'cambiarEstado');
    const canUpdatePay = can(currentRole, 'manageOrders') && roleCanDo('pedidos', 'cambiarPago');
    const canResend = can(currentRole, 'manageOrders') && roleCanDo('pedidos', 'reenviarCorreo');
    // manageOrdersFull: reescribir el pedido completo (productos, montos,
    // dirección, datos del cliente) o eliminarlo — reservado a admin/superadmin.
    const canEditFull = can(currentRole, 'manageOrdersFull') && roleCanDo('pedidos', 'editarCompleto');
    const canDelete = can(currentRole, 'manageOrdersFull') && roleCanDo('pedidos', 'eliminar');

    return `
      <tr class="adm-order-row" style="cursor:pointer" ${adminEventAttributes('click','toggleOrderDetail',[detailArg])}>
        <td class="col-select" data-label="Seleccionar" onclick="event.stopPropagation()"><input type="checkbox" class="order-row-check" data-id="${safeOrderId}" onclick="toggleOrderSelect(this)" ${_selectedOrders.has(o.id) ? 'checked' : ''}></td>
        <td data-label="Pedido" style="font-size:11px;color:#777;font-weight:700">#${escapeHtmlAdmin(o.orderNumber || o.shortId || o.id)}</td>
        <td data-label="Cliente">
          <strong>${escapeHtmlAdmin(o.userName || '—')}</strong><br>
          <small style="color:#777">${escapeHtmlAdmin(o.userPhone || '')}</small><br>
          <small style="color:#777;font-size:10px">${escapeHtmlAdmin(o.userEmail || '')}</small>
        </td>
        <td data-label="Productos" style="font-size:12px;max-width:160px">${escapeHtmlAdmin(itemsText || '—')}</td>
        <td data-label="Total" style="font-weight:800;color:var(--color-text-primary,#713C53)">${formatPrice(o.total || 0)}</td>
        <td data-label="Estado" onclick="event.stopPropagation()">
          ${orderStatusBadgeHtml(orderStatus)}
          ${canUpdate ? `<br><select class="adm-select" style="width:auto;font-size:10px;padding:2px 6px;margin-top:4px" ${adminEventAttributes('change','updateOrderStatus',[orderArg,{control:'value'}])}>
            ${orderStatusOptions(orderStatus)}
          </select>` : ''}
        </td>
        <td data-label="Ciudad">${escapeHtmlAdmin(o.shipping?.city || o.city || '—')}</td>
        <td data-label="Pago" onclick="event.stopPropagation()">
          <div style="font-size:11px;color:#713C53">${escapeHtmlAdmin(o.payment?.method || o.paymentMethod || '—')}</div>
          ${payStatusBadgeHtml(payStatus)}
          ${canUpdatePay ? `<br><select class="adm-select" style="width:auto;font-size:10px;padding:2px 6px;margin-top:4px" ${adminEventAttributes('change','updatePayStatus',[orderArg,{control:'value'}])}>
            ${payStatusOptions(payStatus)}
          </select>` : ''}
        </td>
        <td data-label="Fecha" style="font-size:12px;color:#aaa">${formatDate(o.createdAt)}</td>
        <td data-label="Notif." onclick="event.stopPropagation()" style="text-align:center">
          ${notifBadge(o.notificationStatus || 'pending')}
          ${o.resendCount ? `<div style="font-size:9px;color:#888;margin-top:2px">Reenviado (${o.resendCount})</div>` : ''}
          ${o.notificationError ? `<div style="font-size:9px;color:#c62828;margin-top:2px" title="${escapeHtmlAdmin(o.notificationError)}">ver error</div>` : ''}
          ${canResend ? `<button type="button" class="adm-btn adm-btn-sm" id="resend-btn-${safeOrderId}" style="margin-top:4px;font-size:9px;padding:3px 8px" ${adminEventAttributes('click','resendOrderEmail',[orderArg])} title="Reenviar el correo de este pedido"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6l9 7 9-7"/></svg>Reenviar</button>` : ''}
        </td>
        <td data-label="Editar" onclick="event.stopPropagation()">
          ${canEditFull ? `<button type="button" class="adm-btn adm-btn-sm" ${adminEventAttributes('click','openOrderEdit',[orderArg])} title="Editar pedido completo"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>` : '—'}
        </td>
        <td class="col-actions-sticky" data-label="Eliminar" onclick="event.stopPropagation()">
          ${canDelete ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" ${adminEventAttributes('click','deleteOrder',[orderArg])} title="Mover pedido a Borrados"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 011 1v1h4V4a1 1 0 011 1v1"/></svg><span> Borrar</span></button>` : '—'}
        </td>
      </tr>
      <tr id="${escapeHtmlAdmin(detailId)}" class="adm-order-detail-row" style="display:none">
        <td colspan="12" style="padding:0 14px 12px;background:#fef5f8">
          <div class="adm-order-detail open">
            <div style="font-weight:800;margin-bottom:8px;color:var(--color-text-primary,#713C53)">Detalle del pedido #${escapeHtmlAdmin(o.id.slice(-6).toUpperCase())}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
              <div class="adm-detail-row"><span class="adm-detail-label">Cliente:</span> ${escapeHtmlAdmin(o.userName || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Email:</span> ${escapeHtmlAdmin(o.userEmail || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Teléfono:</span> ${escapeHtmlAdmin(o.userPhone || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Envío:</span> ${escapeHtmlAdmin(o.shipping?.method || o.shippingMethod || '—')}${o.shipping?.encomiendaMode ? ` (${o.shipping.encomiendaMode === 'agencia' ? 'retiro en agencia' : 'entrega en puerta'})` : ''} — ${escapeHtmlAdmin(o.shipping?.city || o.city || '')}</div>
              ${o.shipping?.address || o.address ? `<div class="adm-detail-row"><span class="adm-detail-label">Dirección:</span> ${escapeHtmlAdmin(o.shipping?.address || o.address)}</div>` : ''}
              ${o.shipping?.referencia || o.referencia ? `<div class="adm-detail-row"><span class="adm-detail-label">Referencia:</span> ${escapeHtmlAdmin(o.shipping?.referencia || o.referencia)}</div>` : ''}
              <div class="adm-detail-row"><span class="adm-detail-label">Pago:</span> ${escapeHtmlAdmin(o.payment?.method || o.paymentMethod || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Estado pago:</span> ${escapeHtmlAdmin(payStatus)}</div>
              ${o.ci ? `<div class="adm-detail-row"><span class="adm-detail-label">CI:</span> ${escapeHtmlAdmin(o.ci)}</div>` : ''}
            </div>
            ${o.invoice?.wanted ? `<div class="adm-detail-row" style="grid-column:1/-1;background:#fff3f7;border-radius:6px;padding:6px 10px;margin-bottom:8px"><strong>🧾 Pidió factura</strong> — Razón social: ${escapeHtmlAdmin(o.invoice.razonSocial || '—')} · RUC: ${escapeHtmlAdmin(o.invoice.ruc || '—')}</div>` : ''}
            ${o.notes || o.customerNotes ? `<div class="adm-detail-row" style="grid-column:1/-1"><span class="adm-detail-label">Notas:</span> <em>${escapeHtmlAdmin(o.notes || o.customerNotes)}</em></div>` : ''}
            <div style="margin-top:8px">
              <strong>Productos:</strong>
              <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px">
                ${(o.items||[]).map(it => {
                  const itemImage = sanitizeImageUrl(it.imgUrl || it.imageUrl || '');
                  return `
                  <div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #f0d8e0;border-radius:8px;padding:8px 12px;font-size:12px">
                    ${itemImage ? `<img src="${escapeHtmlAdmin(itemImage)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">` : ''}
                    <div>
                      <div style="font-weight:700">${escapeHtmlAdmin(it.qty)}x ${escapeHtmlAdmin(it.name)}</div>
                      <div style="color:var(--color-text-primary,#713C53)">${formatPrice(it.price * it.qty)}</div>
                    </div>
                  </div>
                `;
                }).join('')}
              </div>
            </div>
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid #f0d8e0;font-size:13px">
              Subtotal: <strong>${formatPrice(o.subtotal||0)}</strong> &nbsp;|&nbsp;
              Envío: <strong>${o.shippingCost == null ? 'Consultar precio' : formatPrice(o.shippingCost)}</strong> &nbsp;|&nbsp;
              <span style="color:var(--color-text-primary,#713C53);font-weight:900;font-size:15px">TOTAL: ${formatPrice(o.total||0)}</span>
            </div>
            ${o.userPhone ? `
            <div style="margin-top:12px">
              <a href="https://wa.me/${o.userPhone.replace(/\D/g,'')}?text=${encodeURIComponent(waConfirmMessageTemplate.replace(/\{nombre\}/g, o.userName || ''))}" target="_blank" rel="noopener" class="adm-btn adm-btn-sm" style="background:#25D366;color:#fff!important;text-decoration:none;display:inline-flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>Abrir WhatsApp del cliente</a>
            </div>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  updateOrdersBulkToolbar();
}

window.toggleOrderDetail = (id) => {
  const row = document.getElementById(id);
  if (!row) return;
  const isHidden = row.style.display === 'none';
  row.style.display = isHidden ? 'table-row' : 'none';
};

window.updateOrderStatus = async (orderId, status, context = {}) => {
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'cambiarEstado')) { toast('No tenés permiso para cambiar el estado de pedidos'); return false; }
  if (context.paymentStatus && !roleCanDo('pedidos', 'cambiarPago')) { toast('No tenés permiso para cambiar el pago'); return false; }
  const o = allOrders.find(o => o.id === orderId);
  const prevStatus = o?.status || 'pendiente';
  const cancelling = status === 'cancelado';
  const operation = await runAdminCrudOperation({
    title: cancelling ? 'Cancelar pedido' : 'Actualizar estado del pedido',
    name: o?.orderNumber || o?.shortId || orderId, module: 'pedidos', dangerous: cancelling,
    stages: [{ id: 'write', label: 'Actualizar estado e inventario' }, { id: 'refresh', label: 'Actualizar lista y auditoría' }],
    action: async ctx => {
      ctx.start('write');
      const result = await window.TintinInventoryIntegrity.transitionStatus(orderId, status, { baseChangeId: o?.lastChangeId || '', ...context });
      if (o && result.order) Object.assign(o, result.order);
      ctx.ok('write');
      ctx.start('refresh');
      publishAdminOrders();
      applyOrderFilters();
      ctx.ok('refresh');
      return true;
    },
  });
  if (operation.status !== 'green') applyOrderFilters();
  return operation.status === 'green';
};

// Protección anti-spam para "✉️ Reenviar": cooldown fijo de 60s por pedido
// para que no se pueda reenviar "varias veces seguidas" el mismo correo.
// Se calcula con lastResendAt, un campo que YA viene en el pedido (admin y
// Modder siempre pueden leer sus propios pedidos) — no depende de leer
// emailLogs, que es exclusivo de Super Admin. El tope diario configurable
// (Correos → Configuración) lo hace cumplir Apps Script del lado del
// servidor sin importar qué rol llama, así que no hace falta releerlo acá.
const RESEND_COOLDOWN_SECONDS = 60;
function resendCooldownRemaining_(o) {
  const last = toJsDate_(o?.lastResendAt);
  if (!last) return 0;
  const elapsedSec = (Date.now() - last.getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSec));
}
function emailErrorMessage_(code) {
  const map = {
    cooldown_active: 'Esperá un momento antes de volver a intentarlo — es una protección anti-spam de la cuenta de correo.',
    daily_limit_exceeded: 'Se alcanzó el límite diario configurado en Correos → Configuración. No se envió nada.',
    duplicate_order_email: 'Este pedido ya tiene un correo original enviado — no se manda dos veces.',
    bulk_campaigns_disabled_gmail_sender: 'Los envíos masivos están deshabilitados: el remitente actual es una cuenta de Gmail común, reservada para correos transaccionales.'
  };
  return map[code] || null;
}

async function recordOrderEmailResend_(orderId) {
  if (!auth.currentUser) throw new Error('La sesión administrativa ya no está disponible.');
  const response = await authenticatedFetch('/api/admin-order-mutation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'recordEmailResend',
      orderId,
      changeId: `admin_email_${crypto.randomUUID().replaceAll('-', '')}`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) throw new Error(body.error || 'No se pudo registrar el reenvío.');
  return body.result?.order || null;
}

window.resendOrderEmail = async (orderId) => {
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'reenviarCorreo')) { toast('No tenés permiso para reenviar correos de pedido'); return; }
  const o = allOrders.find(x => x.id === orderId);
  if (!o) { toast('Pedido no encontrado'); return; }
  const remaining = resendCooldownRemaining_(o);
  if (remaining > 0) { toast(`Esperá ${remaining}s antes de reenviar de nuevo este pedido (protección anti-spam).`); return; }
  const btn = document.getElementById(`resend-btn-${orderId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try {
    const orderForEmail = { ...o, createdAt: o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : o.createdAt };
    const result = await sendOrderNotification(orderId, orderForEmail, true);
    if (!result.success) throw new Error(emailErrorMessage_(result.error) || result.error || 'Error desconocido — revisá que js/email/configuracion-correo.js esté configurado');

    const recordedOrder = await recordOrderEmailResend_(orderId);
    if (recordedOrder) Object.assign(o, recordedOrder);
    logAudit('reenviar_correo_pedido', 'pedido', orderId, o.shortId || orderId, `Reenvío #${o.resendCount}`);
    toast('Correo reenviado correctamente');
    applyOrderFilters();
  } catch (e) {
    toast('Error al reenviar el correo: ' + e.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6l9 7 9-7"/></svg>Reenviar'; }
  }
};

window.updatePayStatus = async (orderId, status) => {
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'cambiarPago')) { toast('No tenés permiso para cambiar el estado de pago'); return false; }
  const o = allOrders.find(o => o.id === orderId);
  const prevStatus = o?.paymentStatus || o?.payment?.status || 'pendiente';
  const operation = await runAdminCrudOperation({
    title: 'Actualizar estado de pago', name: o?.shortId || orderId, module: 'pedidos',
    stages: [{ id: 'save', label: 'Guardar estado de pago' }, { id: 'refresh', label: 'Actualizar lista y notificación' }],
    action: async ctx => {
      ctx.start('save');
      const user = auth.currentUser;
      if (!user) throw new Error('La sesión administrativa ya no está disponible.');
      const response = await authenticatedFetch('/api/admin-order-mutation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'updatePayment', orderId, paymentStatus: status,
          paymentMethod: o?.payment?.method || o?.paymentMethod || 'efectivo',
          baseChangeId: o?.lastChangeId || '', changeId: `admin_payment_${crypto.randomUUID().replaceAll('-', '')}` })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true) throw new Error(body.error || 'No se pudo guardar el estado de pago.');
      if (o && body.result?.order) Object.assign(o, body.result.order);
      ctx.ok('save');
      ctx.start('refresh');
      publishAdminOrders();
      applyOrderFilters();
      ctx.ok('refresh');
      return true;
    },
  });
  if (operation.status !== 'green') applyOrderFilters();
  return operation.status === 'green';
};

function orderDeleteErrorMessage_(error) {
  const raw = String(error?.message || error || '').trim();
  if (/quota|resource-exhausted/i.test(raw)) {
    return 'Se alcanzó temporalmente el límite de operaciones. Esperá un minuto y volvé a intentar.';
  }
  if (/permission-denied|insufficient permissions/i.test(raw)) {
    return 'La base rechazó la eliminación. Recargá el panel y volvé a intentar como Super Admin.';
  }
  return raw ? `No se pudo eliminar el pedido: ${raw}` : 'No se pudo eliminar el pedido.';
}

window.deleteOrder = async (orderId) => {
  if (!can(currentRole, 'manageOrdersFull') || !roleCanDo('pedidos', 'eliminar')) { toast('No tenés permiso para eliminar pedidos'); return { moved: false }; }
  if (currentRole !== 'superadmin') { toast('Solo Super Admin puede mover pedidos a Borrados'); return { moved: false }; }
  const orderBefore = allOrders.find(x => x.id === orderId) || null;
  const reason = ''; // El diálogo de devolución solicita el motivo y las cantidades.
  const operation = await runAdminCrudOperation({
    title: 'Mover pedido a Borrados',
    name: orderBefore?.orderNumber || orderBefore?.shortId || orderId,
    module: 'pedidos', dangerous: true,
    stages: [
      { id: 'trash', label: 'Mover pedido y aplicar la devolución elegida' },
      { id: 'refresh', label: 'Actualizar lista y registrar auditoría' },
    ],
    action: async ctx => {
      ctx.start('trash');
      const result = await window.TintinOrderAdmin.trashOrder(orderId, reason);
      ctx.ok('trash');
      ctx.start('refresh');
      if (result.moved) {allOrders = allOrders.filter(o => o.id !== orderId);rawAdminOrders = rawAdminOrders.filter(o=>o.id!==orderId);}
      if (result.moved) {
        await logAudit('mover_pedido_borrados', 'pedido', orderId, orderBefore?.orderNumber || orderBefore?.shortId || orderId, `Cliente: ${orderBefore?.userName || orderBefore?.userEmail || '—'}${reason ? ` · ${reason}` : ''}`);
      }
      applyOrderFilters();
      result.deleted = Boolean(result.moved);
      renderGeneralStatistics();
      ctx.ok('refresh', { message: result.moved ? 'Pedido movido a Borrados; stock actualizado según tu elección.' : result.cancelled ? 'Operación cancelada, sin cambios.' : 'El pedido ya no estaba en la lista activa.' });
      return { ...result, orderBefore };
    },
  });
  if (operation.status === 'green') return operation.value;
  const error = operation.operation?.error || new Error('No se pudo mover el pedido a Borrados.');
  console.error('[orders] No se pudo mover el pedido a Borrados:', error);
  return { moved: false, error, userMessage: orderDeleteErrorMessage_(error), orderBefore };
};

let _lastFilteredOrders = [];
function applyOrderFilters() {
  const search = normalizeAdminSearch(document.getElementById('order-search')?.value);
  const statusVal = document.getElementById('filter-status')?.value || '';
  const payVal = document.getElementById('filter-pay-status')?.value || '';
  let filtered = allOrders;
  if (statusVal) filtered = filtered.filter(o => o.status === statusVal);
  if (payVal) filtered = filtered.filter(o => (o.payment?.status || o.paymentStatus || 'pendiente') === payVal);
  if (search) filtered = filtered.filter(o =>
    normalizeAdminSearch(o.userName).includes(search) ||
    normalizeAdminSearch(o.userEmail).includes(search) ||
    normalizeAdminSearch(o.userPhone).includes(search) ||
    normalizeAdminSearch(o.id).includes(search) ||
    normalizeAdminSearch(o.orderNumber || o.shortId).includes(search)
  );
  _lastFilteredOrders = filtered;
  // Una selección deja de tener sentido si el pedido seleccionado ya no
  // está en la vista filtrada (cambió de estado, se eliminó, etc.)
  const visibleIds = new Set(filtered.map(o => o.id));
  [..._selectedOrders].forEach(id => { if (!visibleIds.has(id)) _selectedOrders.delete(id); });
  renderOrdersTable(filtered);
  updateOrdersBulkToolbar();
}

// Filter orders by status
document.getElementById('filter-status').onchange = applyOrderFilters;
document.getElementById('filter-pay-status').onchange = applyOrderFilters;
document.getElementById('order-search').oninput = debounceAdminSearch(applyOrderFilters);

document.getElementById('btn-cleanup-stale-orders')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  if (!confirm('¿Borrar los pedidos abandonados (más de 2 horas sin confirmarse, nunca descontaron stock)? Esta acción no se puede deshacer.')) return;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Limpiando…';
  try {
    const result = await window.TintinInventoryIntegrity.cleanupStalePendingOrders(2);
    toast(result.removed
      ? `Se limpiaron ${result.removed} pedido${result.removed === 1 ? '' : 's'} abandonado${result.removed === 1 ? '' : 's'}.`
      : 'No había pedidos abandonados para limpiar.');
    if (result.removed) loadOrders();
  } catch (error) {
    toast(error?.message || 'No se pudo limpiar los pedidos abandonados.');
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
});

// Opciones de los <select> de la barra de acciones masivas — mismas fuentes
// de verdad (ORDER_STATUS_LABELS/PAY_STATUS_LABELS) que el resto de la UI.
document.getElementById('orders-bulk-status').insertAdjacentHTML('beforeend', orderStatusOptions(null));
document.getElementById('orders-bulk-pay-status').insertAdjacentHTML('beforeend', payStatusOptions(null));

// ══════════════════════════════════════════════
// PEDIDOS: SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS
// ══════════════════════════════════════════════
let _selectedOrders = new Set();

window.toggleSelectAllOrders = function(masterCb) {
  document.querySelectorAll('.order-row-check').forEach(cb => {
    if (masterCb.checked) cb.checked = addAdminBulkSelection(_selectedOrders, cb.dataset.id, true, 'pedidos');
    else { cb.checked = false; _selectedOrders.delete(cb.dataset.id); }
  });
  updateOrdersBulkToolbar();
};

window.toggleOrderSelect = function(cb) {
  cb.checked = addAdminBulkSelection(_selectedOrders, cb.dataset.id, cb.checked, 'pedidos');
  const master = document.getElementById('check-all-orders');
  if (master) {
    const total = document.querySelectorAll('.order-row-check').length;
    master.indeterminate = _selectedOrders.size > 0 && _selectedOrders.size < total;
    master.checked = _selectedOrders.size === total && total > 0;
  }
  updateOrdersBulkToolbar();
};

function updateOrdersBulkToolbar() {
  const count = _selectedOrders.size;
  const toolbar = document.getElementById('orders-bulk-toolbar');
  const countEl = document.getElementById('orders-bulk-count');
  const delBtn = document.getElementById('orders-bulk-delete-btn');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
  // Eliminar en lote queda reservado a Super Admin — más estricto que borrar
  // de a uno (admin/superadmin), porque el riesgo de un error masivo es
  // mucho mayor. Pedido explícito del usuario para esta acción puntual.
  if (delBtn) delBtn.style.display = currentRole === 'superadmin' ? '' : 'none';
  // Roles y Permisos: cada control masivo se oculta si el rol actual no
  // tiene habilitada ni la acción puntual ni "Acciones masivas" en Pedidos.
  const hasMasivas = can(currentRole, 'manageOrders') && roleCanDo('pedidos', 'accionesMasivas');
  const statusWrap = document.getElementById('orders-bulk-status-wrap');
  const payWrap = document.getElementById('orders-bulk-pay-wrap');
  const resendBtn = document.getElementById('orders-bulk-resend-btn');
  const exportBtn = document.getElementById('orders-bulk-export-btn');
  const exportViewBtn = document.getElementById('orders-export-view-btn');
  if (statusWrap) statusWrap.style.display = (hasMasivas && roleCanDo('pedidos', 'cambiarEstado')) ? '' : 'none';
  if (payWrap) payWrap.style.display = (hasMasivas && roleCanDo('pedidos', 'cambiarPago')) ? '' : 'none';
  if (resendBtn) resendBtn.style.display = (hasMasivas && roleCanDo('pedidos', 'reenviarCorreo')) ? '' : 'none';
  if (exportBtn) exportBtn.style.display = roleCanDo('pedidos', 'exportar') ? '' : 'none';
  if (exportViewBtn) exportViewBtn.style.display = roleCanDo('pedidos', 'exportar') ? '' : 'none';
}

window.clearOrdersSelection = function() {
  _selectedOrders.clear();
  document.querySelectorAll('.order-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-orders');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateOrdersBulkToolbar();
};

window.bulkChangeOrderStatus = async function() {
  if (!_selectedOrders.size) return;
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'accionesMasivas') || !roleCanDo('pedidos', 'cambiarEstado')) { toast('No tenés permiso para cambiar el estado de pedidos'); return; }
  const status = document.getElementById('orders-bulk-status')?.value;
  if (!status) { toast('Elegí un estado'); return; }
  const n = _selectedOrders.size;
  if (!confirm(`¿Cambiar el estado a "${ORDER_STATUS_LABELS[status]}" en ${n} pedido(s)?`)) return;
  try {
    const ids = [..._selectedOrders];
    for (const id of ids) {
      await window.TintinInventoryIntegrity.transitionStatus(id, status);
    }
    ids.forEach(id => { const o = allOrders.find(x => x.id === id); if (o) o.status = status; });
    logAudit('cambiar_estado_pedido', 'pedido', '', '', `Estado → ${ORDER_STATUS_LABELS[status]}`, { bulk: true, count: n });
    toast(`Estado actualizado en ${n} pedido(s)`);
    clearOrdersSelection();
    applyOrderFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

window.bulkChangePayStatus = async function() {
  if (!_selectedOrders.size) return;
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'accionesMasivas') || !roleCanDo('pedidos', 'cambiarPago')) { toast('No tenés permiso para cambiar el estado de pago'); return; }
  const status = document.getElementById('orders-bulk-pay-status')?.value;
  if (!status) { toast('Elegí un estado de pago'); return; }
  const n = _selectedOrders.size;
  if (!confirm(`¿Cambiar el pago a "${PAY_STATUS_LABELS[status]}" en ${n} pedido(s)?`)) return;
  try {
    const ids = [..._selectedOrders];
    for (const id of ids) await window.updatePayStatus(id, status);
    ids.forEach(id => { const o = allOrders.find(x => x.id === id); if (o) { if (o.payment) o.payment.status = status; o.paymentStatus = status; } });
    logAudit('cambiar_estado_pago', 'pedido', '', '', `Pago → ${PAY_STATUS_LABELS[status]}`, { bulk: true, count: n });
    toast(`Estado de pago actualizado en ${n} pedido(s)`);
    clearOrdersSelection();
    applyOrderFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

// Reenvío masivo: son llamadas de red (no solo escrituras a Firestore), así
// que puede fallar pedido por pedido — se procesan de a una y se informa un
// resumen con éxitos/fallos en vez de asumir todo-o-nada.
window.bulkResendOrderEmails = async function() {
  if (!_selectedOrders.size) return;
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'accionesMasivas') || !roleCanDo('pedidos', 'reenviarCorreo')) { toast('No tenés permiso para reenviar correos de pedido'); return; }
  const ids = [..._selectedOrders];
  const n = ids.length;
  if (!confirm(`¿Reenviar el correo de confirmación a ${n} pedido(s)?`)) return;
  const results = await runAdminBulk(ids, async id => {
    const o = allOrders.find(x => x.id === id);
    if (!o) throw new Error('no encontrado');
    // Protección anti-spam: si este pedido puntual se reenvió hace menos
    // de RESEND_COOLDOWN_SECONDS, se omite (no cuenta como fallo) en vez
    // de forzar el reenvío — el tope diario global lo aplica Apps Script.
    if (resendCooldownRemaining_(o) > 0) return 'skipped';
    const orderForEmail = { ...o, createdAt: o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : o.createdAt };
    const result = await sendOrderNotification(id, orderForEmail, true);
    if (!result.success) throw new Error(result.error || 'error desconocido');
    const recordedOrder = await recordOrderEmailResend_(id);
    if (recordedOrder) Object.assign(o, recordedOrder);
    return 'sent';
  }, {
    // De a uno, como antes: cada envío pasa por el tope diario de Apps Script.
    title: 'Reenviando correos de pedido', name: 'ReenviarCorreosPedido', module: 'Pedidos', concurrency: 1,
    isSkipped: value => value === 'skipped', skippedText: 'omitidos por cooldown anti-spam',
  });
  const ok = results.filter(result => result.value === 'sent').length;
  const skipped = results.filter(result => result.value === 'skipped').length;
  const fail = results.filter(result => result.status === 'rejected').length;
  logAudit('reenviar_correo_pedido', 'pedido', '', '', `${ok} enviados, ${fail} fallaron${skipped ? `, ${skipped} omitidos por cooldown` : ''}`, { bulk: true, count: n });
  const summary = `${ok} correo(s) reenviados` + (fail ? `, ${fail} fallaron` : '') + (skipped ? `, ${skipped} omitidos (cooldown anti-spam)` : '');
  toast(fail || skipped ? summary : `${ok} correo(s) reenviados correctamente`, 6000);
  clearOrdersSelection();
  applyOrderFilters();
};

window.bulkDeleteOrders = async function() {
  if (!_selectedOrders.size) return { movedOrders: [], failed: [] };
  if (rejectOversizedAdminBulkSelection(_selectedOrders, 'pedidos')) return { movedOrders: [], failed: [] };
  if (currentRole !== 'superadmin') { toast('Solo Super Admin puede mover pedidos a Borrados en lote'); return { movedOrders: [], failed: [] }; }
  const n = _selectedOrders.size;
  const selection = await chooseOrderTrash(allOrders.filter(order => _selectedOrders.has(order.id)));
  if (!selection) return { movedOrders: [], failed: [], cancelled: true };
  const ids = [..._selectedOrders];
  const ordersById = new Map(allOrders.map(order => [order.id, order]));
  const movedOrders = [], removedIds = new Set(), failed = [];
  const results = await runAdminBulk(ids, id => window.TintinOrderAdmin.trashOrder(id, selection.reason, selection.selections[id]), {
    title: 'Moviendo pedidos a Borrados', name: 'MoverPedidosABorrados', module: 'Pedidos', concurrency: 3,
    isSkipped: value => value?.moved === false, skippedText: 'ya no existían',
  });
  results.forEach((result, index) => {
    const id = ids[index];
    if (result.status === 'fulfilled' && result.value?.moved) {
      removedIds.add(id); movedOrders.push(ordersById.get(id) || { id });
    } else if (result.status === 'rejected') {
      console.error(`[orders] No se pudo mover el pedido ${id}:`, result.reason);
      failed.push({ id, error: result.reason });
    }
  });
  allOrders = allOrders.filter(order => !removedIds.has(order.id));
  rawAdminOrders = rawAdminOrders.filter(order => !removedIds.has(order.id));
  _selectedOrders.clear();
  failed.forEach(item => _selectedOrders.add(item.id));
  if (movedOrders.length) logAudit('mover_pedido_borrados', 'pedido', '', '', `${movedOrders.length} pedidos movidos a Borrados`, { bulk: true, count: movedOrders.length, failed: failed.length });
  applyOrderFilters();
  toast(failed.length ? `${movedOrders.length} movidos; ${failed.length} fallaron.` : `${movedOrders.length} pedido(s) movidos a Borrados`, 7000);
  return { movedOrders, deletedOrders: movedOrders, failed };
};

function orderRowsToCsv_(orders) {
  const header = ['ID', 'Cliente', 'Email', 'Teléfono', 'Ciudad', 'Productos', 'Total', 'Estado', 'Estado de pago', 'Fecha'];
  const rows = orders.map(o => [
    o.orderNumber || o.shortId || o.id,
    o.userName || '',
    o.userEmail || '',
    o.userPhone || '',
    o.shipping?.city || o.city || '',
    (o.items || []).map(it => `${it.qty}x ${it.name}`).join('; '),
    o.total || 0,
    ORDER_STATUS_LABELS[o.status] || o.status || '',
    PAY_STATUS_LABELS[o.payment?.status || o.paymentStatus] || '',
    o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('es-PY') : ''
  ]);
  return [header, ...rows];
}

window.bulkExportOrders = function(scope) {
  if (!roleCanDo('pedidos', 'exportar')) { toast('No tenés permiso para exportar pedidos'); return; }
  let list;
  if (scope === 'selected') {
    if (!_selectedOrders.size) { toast('No hay pedidos seleccionados'); return; }
    list = allOrders.filter(o => _selectedOrders.has(o.id));
  } else if (scope === 'filtered') {
    list = _lastFilteredOrders.length ? _lastFilteredOrders : allOrders;
  } else {
    list = allOrders;
  }
  if (!list.length) { toast('No hay pedidos para exportar'); return; }
  downloadCsv(`pedidos_${scope}_${Date.now()}.csv`, orderRowsToCsv_(list));
  toast(`Exportados ${list.length} pedido(s) a CSV`);
};

// ======== CONFIGURACIÓN ========
const DEFAULT_WA_CONFIRM_MSG = 'Hola {nombre}! Te escribo por tu pedido realizado en nuestra página web. Ya recibimos todos tus datos para el envío y estamos preparando tu pedido. Te escribimos para confirmar los últimos detalles.';

const MAINTENANCE_ROLE_KEYS = ['admin', 'agent', 'viewer', 'support', 'client', 'guest'];
let _lastKnownStoreOpen = true;
let _lastKnownMaintenanceAccess = {};
let _lastKnownHeaderMode = { desktopTablet: true, mobile: true };

function updateHeaderModeWarning_() {
  const warn = document.getElementById('cfg-header-mobile-warning');
  if (!warn) return;
  const desktopTablet = document.getElementById('cfg-header-desktop-tablet').checked;
  const mobile = document.getElementById('cfg-header-mobile').checked;
  if (!desktopTablet && !mobile) {
    warn.textContent = '⚠️ No va a haber ninguna navegación persistente en ningún tamaño de pantalla — ni header en Desktop/Tablet ni tabbar en Mobile.';
    warn.style.display = 'block';
  } else if (!desktopTablet) {
    warn.textContent = 'ℹ️ Desktop y Tablet quedarán sin header. Mobile no se ve afectado por esto.';
    warn.style.display = 'block';
  } else if (!mobile) {
    warn.textContent = 'ℹ️ Mobile quedará sin ninguna navegación persistente (tabbar oculta). Desktop y Tablet no se ven afectados por esto.';
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }
}
document.getElementById('cfg-header-desktop-tablet').addEventListener('change', updateHeaderModeWarning_);
document.getElementById('cfg-header-mobile').addEventListener('change', updateHeaderModeWarning_);

function updateStoreStatePill_(isOpen) {
  const pill = document.getElementById('cfg-store-state-pill');
  if (!pill) return;
  pill.textContent = isOpen ? 'TIENDA ABIERTA' : 'TIENDA CERRADA';
  pill.classList.toggle('tt-store-state-pill-open', isOpen);
  pill.classList.toggle('tt-store-state-pill-closed', !isOpen);
}

function serializeGeneralConfig_() {
  const ids = [
    'cfg-wa-number', 'cfg-wa-confirm-msg', 'cfg-contact-email', 'cfg-store-address',
    'cfg-currency', 'cfg-delivery-cost', 'cfg-encomienda-cost', 'cfg-instagram',
    'cfg-facebook', 'cfg-tiktok', 'cfg-ga4-id', 'cfg-store-open',
    'cfg-header-desktop-tablet', 'cfg-header-mobile', 'cfg-pay-efectivo',
    'cfg-pay-transferencia', 'cfg-bank-ueno', 'cfg-bank-atlas',
    ...MAINTENANCE_ROLE_KEYS.map(role => 'ma-' + role),
  ];
  return JSON.stringify(ids.map(id => {
    const input = document.getElementById(id);
    return [id, input?.type === 'checkbox' ? Boolean(input.checked) : (input?.value || '')];
  }));
}

async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    const d = snap.exists() ? snap.data() : {};
    document.getElementById('cfg-wa-number').value = d.whatsappNumber || '595981299331';
    document.getElementById('cfg-wa-confirm-msg').value = d.waConfirmMessage || DEFAULT_WA_CONFIRM_MSG;
    document.getElementById('cfg-contact-email').value = d.contactEmail || '';
    document.getElementById('cfg-store-address').value = d.storeAddress || 'San Lorenzo, Paraguay';
    document.getElementById('cfg-currency').value = d.currency || 'PYG';
    document.getElementById('cfg-delivery-cost').value = d.deliveryCost ?? 15000;
    document.getElementById('cfg-encomienda-cost').value = d.encomiendaCost ?? 25000;
    document.getElementById('cfg-instagram').value = d.instagram || '';
    document.getElementById('cfg-facebook').value = d.facebook || '';
    document.getElementById('cfg-tiktok').value = d.tiktok || '';
    document.getElementById('cfg-ga4-id').value = d.ga4MeasurementId || '';
    // La interfaz debe usar exactamente el mismo criterio que storeGate y
    // firestore.rules: solo `true` explícito significa tienda abierta.
    const storeOpen = d.storeOpen === true;
    document.getElementById('cfg-store-open').checked = storeOpen;
    _lastKnownStoreOpen = storeOpen;
    updateStoreStatePill_(storeOpen);
    const headerDesktopTablet = typeof d.headerDesktopTabletEnabled === 'boolean' ? d.headerDesktopTabletEnabled : true;
    const headerMobile = typeof d.headerMobileEnabled === 'boolean' ? d.headerMobileEnabled : true;
    document.getElementById('cfg-header-desktop-tablet').checked = headerDesktopTablet;
    document.getElementById('cfg-header-mobile').checked = headerMobile;
    _lastKnownHeaderMode = { desktopTablet: headerDesktopTablet, mobile: headerMobile };
    updateHeaderModeWarning_();
    // Payment methods
    const pays = d.paymentMethods || { efectivo: true, transferencia: true };
    document.getElementById('cfg-pay-efectivo').checked = pays.efectivo !== false;
    document.getElementById('cfg-pay-transferencia').checked = pays.transferencia !== false;
    const bankAccounts = d.bankAccounts || {};
    document.getElementById('cfg-bank-ueno').value = bankAccounts.ueno || '';
    document.getElementById('cfg-bank-atlas').value = bankAccounts.atlas || '';
    // Accesos con tienda cerrada
    const maintenanceAccess = d.maintenanceAccess || {};
    _lastKnownMaintenanceAccess = {};
    MAINTENANCE_ROLE_KEYS.forEach(role => {
      const allowed = maintenanceAccess[role] === true;
      _lastKnownMaintenanceAccess[role] = allowed;
      const input = document.getElementById('ma-' + role);
      if (input) input.checked = allowed;
    });
    window.AdminUnsaved?.register('general-config', {
      serialize: serializeGeneralConfig_,
      label: 'Configuración general',
      save: () => {
        const waiting = window.AdminUnsaved.waitForEvent('tintin:admin-config-saved', 'tintin:admin-config-save-failed');
        document.getElementById('btn-save-config').click();
        return waiting;
      },
    });
  } catch(e) {
    console.error('loadConfig error:', e);
  }
}

document.getElementById('cfg-store-open').addEventListener('change', (e) => {
  updateStoreStatePill_(e.target.checked);
});

document.getElementById('btn-save-config').onclick = async () => {
  try {
    const willBeOpen = document.getElementById('cfg-store-open').checked;
    if (_lastKnownStoreOpen && !willBeOpen) {
      const confirmed = confirm('Vas a cerrar la tienda para visitantes y clientes. Solo los roles permitidos podrán acceder.');
      if (!confirmed) {
        document.getElementById('cfg-store-open').checked = true;
        updateStoreStatePill_(true);
        window.dispatchEvent(new Event('tintin:admin-config-save-failed'));
        return;
      }
    }
    const maintenanceAccess = {};
    MAINTENANCE_ROLE_KEYS.forEach(role => {
      const input = document.getElementById('ma-' + role);
      maintenanceAccess[role] = !!(input && input.checked);
    });
    const generalRef = doc(db, 'settings', 'general');
    const storeGateRef = doc(db, 'settings', 'storeGate');
    const settingsBatch = writeBatch(db);

    settingsBatch.set(generalRef, {
      whatsappNumber:  document.getElementById('cfg-wa-number').value.trim(),
      waConfirmMessage: document.getElementById('cfg-wa-confirm-msg').value.trim() || DEFAULT_WA_CONFIRM_MSG,
      contactEmail:    document.getElementById('cfg-contact-email').value.trim(),
      storeAddress:    document.getElementById('cfg-store-address').value.trim(),
      currency:        document.getElementById('cfg-currency').value,
      deliveryCost:    parseInt(document.getElementById('cfg-delivery-cost').value) || 15000,
      encomiendaCost:  parseInt(document.getElementById('cfg-encomienda-cost').value) || 25000,
      instagram:       document.getElementById('cfg-instagram').value.trim(),
      facebook:        document.getElementById('cfg-facebook').value.trim(),
      tiktok:          document.getElementById('cfg-tiktok').value.trim(),
      ga4MeasurementId: document.getElementById('cfg-ga4-id').value.trim(),
      storeOpen:       willBeOpen,
      // Mantiene sincronizado el campo legado mientras todavía exista código
      // o integraciones históricas que lo consulten.
      tiendaActiva:    willBeOpen,
      storeStatusUpdatedAt: serverTimestamp(),
      storeStatusUpdatedBy: currentUser?.email || SUPER_ADMIN,
      maintenanceAccess,
      headerDesktopTabletEnabled: document.getElementById('cfg-header-desktop-tablet').checked,
      headerMobileEnabled:        document.getElementById('cfg-header-mobile').checked,
      paymentMethods: {
        efectivo:       document.getElementById('cfg-pay-efectivo').checked,
        transferencia:  document.getElementById('cfg-pay-transferencia').checked,
      },
      bankAccounts: {
        ueno:  document.getElementById('cfg-bank-ueno').value.trim(),
        atlas: document.getElementById('cfg-bank-atlas').value.trim(),
      },
      updatedAt: serverTimestamp()
    }, { merge: true });

    // La configuración completa y el documento público mínimo deben cambiar
    // en el mismo commit. Así no existe una ventana donde el panel diga
    // "abierta" pero las reglas todavía bloqueen products/collections.
    settingsBatch.set(storeGateRef, {
      storeOpen: willBeOpen,
      maintenanceAccess,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || SUPER_ADMIN
    }, { merge: true });

    await withAdminSiteChange(async () => settingsBatch.commit());
    if (_lastKnownStoreOpen !== willBeOpen) {
      const antes = _lastKnownStoreOpen ? 'Abierta' : 'Cerrada';
      const despues = willBeOpen ? 'Abierta' : 'Cerrada';
      await logAudit('cambiar_estado_tienda', 'settings', 'general', 'Estado de la tienda', `${antes} → ${despues}`);
    }
    if (JSON.stringify(_lastKnownMaintenanceAccess) !== JSON.stringify(maintenanceAccess)) {
      await logAudit('cambiar_acceso_tienda_cerrada', 'settings', 'general', 'Accesos con tienda cerrada', JSON.stringify(maintenanceAccess));
    }
    const newHeaderMode = {
      desktopTablet: document.getElementById('cfg-header-desktop-tablet').checked,
      mobile:        document.getElementById('cfg-header-mobile').checked,
    };
    if (JSON.stringify(_lastKnownHeaderMode) !== JSON.stringify(newHeaderMode)) {
      await logAudit('cambiar_header_dispositivo', 'settings', 'general', 'Header por dispositivo', JSON.stringify(newHeaderMode));
    }
    _lastKnownStoreOpen = willBeOpen;
    _lastKnownMaintenanceAccess = maintenanceAccess;
    _lastKnownHeaderMode = newHeaderMode;
    updateStoreStatePill_(willBeOpen);
    toast('Configuración guardada correctamente');
    window.AdminUnsaved?.markClean('general-config');
    window.dispatchEvent(new Event('tintin:admin-config-saved'));
  } catch(e) {
    toast('Error al guardar configuración: ' + e.message);
    window.dispatchEvent(new Event('tintin:admin-config-save-failed'));
  }
};

function toJsDate_(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const { loadCorreos, refreshCorreosClientasFromRealtime, stopCorreosRealtimeListeners } = iniciarCorreos({
  db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, writeBatch, serverTimestamp, onSnapshot, getDocsPaginated, withAdminSiteChange, sendTestCustomerEmail, sendTemplatedEmail, sendBulkTemplatedEmail, EMAIL_WEBHOOK_URL, ORDER_STATUS_LABELS, adminEventAttributes, addAdminBulkSelection, rejectOversizedAdminBulkSelection, batchUpdateChunked, downloadCsv, emailErrorMessage_, escapeHtmlAdmin, formatDate, formatPrice, logAudit, toast, toJsDate_,
  getCurrentUser: () => currentUser, getAllUsers: () => allUsers, getAllOrders: () => allOrders
});

// ======== ENVÍOS: ciudades (CRUD real, con lista en tiempo real) ========
let shipCities  = { delivery: [], encomienda: [] };
let shipEditing = { delivery: null, encomienda: null }; // índice en edición, o null = alta nueva
// Ciudades identificadas por nombre (no por índice, que cambia al borrar/reordenar).
let _selectedShipCities = { delivery: new Set(), encomienda: new Set() };

function departamentoOptionsHtml(selected) {
  const options = ['<option value="">— Sin departamento —</option>'];
  PARAGUAY_LOCATIONS.forEach(({ departamento }) => {
    options.push(`<option value="${escapeHtmlAdmin(departamento)}" ${departamento === selected ? 'selected' : ''}>${escapeHtmlAdmin(departamento)}</option>`);
  });
  return options.join('');
}
['delivery', 'encomienda'].forEach(type => {
  const sel = document.getElementById(`ship-${type}-departamento`);
  if (sel) sel.innerHTML = departamentoOptionsHtml('');
});

function renderShipList(type) {
  const container = document.getElementById(`ship-${type}-list`);
  const list = shipCities[type];
  const names = new Set(list.map(c => c.name));
  [..._selectedShipCities[type]].forEach(name => { if (!names.has(name)) _selectedShipCities[type].delete(name); });
  if (!list.length) {
    container.innerHTML = '<p style="font-size:12px;color:var(--adm-muted);padding:6px 0">Todavía no cargaste ninguna ciudad.</p>';
    updateShipBulkToolbar(type);
    return;
  }
  container.innerHTML = list.map((c, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fef5f8;border:1px solid #f0d8e0;border-radius:8px;font-size:13px">
      <input type="checkbox" class="ship-${type}-check" data-name="${escapeHtmlAdmin(c.name)}" ${adminEventAttributes('click','toggleShipCitySelect',[type,{control:'element'}])} ${_selectedShipCities[type].has(c.name) ? 'checked' : ''}>
      <span style="font-weight:600;flex:1">${escapeHtmlAdmin(c.name)}${c.departamento ? ` <span style="font-weight:400;color:var(--adm-muted);font-size:11px">· ${escapeHtmlAdmin(c.departamento)}</span>` : ''}</span>
      <span style="font-size:12px;color:${c.price == null ? 'var(--gold-hover)' : 'var(--adm-muted)'}">${c.price == null ? 'Consultar precio' : formatPrice(c.price)}</span>
      <button type="button" class="adm-btn" data-ship-edit="${type}:${i}" style="padding:4px 10px;font-size:11px">Editar</button>
      <button type="button" class="adm-btn" data-ship-del="${type}:${i}" style="padding:4px 10px;font-size:11px;color:#c0392b">Eliminar</button>
    </div>
  `).join('');
  updateShipBulkToolbar(type);
}

window.toggleShipCitySelect = function(type, cb) {
  cb.checked = addAdminBulkSelection(_selectedShipCities[type], cb.dataset.name, cb.checked, 'ciudades');
  updateShipBulkToolbar(type);
};

function updateShipBulkToolbar(type) {
  const count = _selectedShipCities[type].size;
  const toolbar = document.getElementById(`ship-${type}-bulk-toolbar`);
  const countEl = document.getElementById(`ship-${type}-bulk-count`);
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionada${count !== 1 ? 's' : ''}`;
}

window.clearShipSelection = function(type) {
  _selectedShipCities[type].clear();
  document.querySelectorAll(`.ship-${type}-check`).forEach(cb => cb.checked = false);
  updateShipBulkToolbar(type);
};

window.bulkDeleteShipCities = async function(type) {
  const names = [..._selectedShipCities[type]];
  if (!names.length) return;
  if (rejectOversizedAdminBulkSelection(names, 'ciudades')) return;
  const n = names.length;
  if (!confirm(`¿Eliminar ${n} ciudad(es) de ${type === 'delivery' ? 'Delivery' : 'Encomienda'}?`)) return;
  const prevList = shipCities[type].slice();
  const nameSet = new Set(names);
  shipCities[type] = shipCities[type].filter(c => !nameSet.has(c.name));
  try {
    await saveShipCities();
    logAudit('editar_envio', 'envio', '', '', `${n} ciudad(es) de ${type} eliminadas`, { bulk: true, count: n });
    toast(`${n} ciudad(es) eliminadas`);
    clearShipSelection(type);
    renderShipList(type);
    if (shipEditing[type] != null) resetShipForm(type);
  } catch (e) {
    shipCities[type] = prevList;
    toast('Error al eliminar: ' + e.message);
    renderShipList(type);
  }
};

async function saveShipCities() {
  // Vive en settings/shippingRates, no en settings/general — ver
  // sparkShippingRatesPath() en firestore.rules y la migración automática
  // más abajo (onSnapshot de settings/shippingRates).
  await withAdminSiteChange(async () => setDoc(doc(db, 'settings', 'shippingRates'), {
    deliveryCities:   shipCities.delivery,
    encomiendaCities: shipCities.encomienda,
    updatedAt: serverTimestamp()
  }, { merge: true }));
}

function resetShipForm(type) {
  document.getElementById(`ship-${type}-name`).value = '';
  document.getElementById(`ship-${type}-departamento`).value = '';
  document.getElementById(`ship-${type}-price`).value = '';
  document.getElementById(`ship-${type}-add`).textContent = 'Agregar';
  document.getElementById(`ship-${type}-cancel`).style.display = 'none';
  shipEditing[type] = null;
}

['delivery', 'encomienda'].forEach(type => {
  document.getElementById(`ship-${type}-add`).onclick = async () => {
    const nameInput  = document.getElementById(`ship-${type}-name`);
    const departamentoInput = document.getElementById(`ship-${type}-departamento`);
    const priceInput = document.getElementById(`ship-${type}-price`);
    const name = nameInput.value.trim();
    if (!name) { toast('Ingresá el nombre de la ciudad'); return; }
    const departamento = departamentoInput.value || '';
    const priceRaw = priceInput.value.trim();
    const price = priceRaw === '' ? null : (parseInt(priceRaw) || 0);
    const idx = shipEditing[type];
    const dupIdx = shipCities[type].findIndex((c, i) => c.name.toLowerCase() === name.toLowerCase() && i !== idx);
    if (dupIdx !== -1) { toast('Esa ciudad ya está cargada'); return; }

    const prevList = shipCities[type].slice();
    if (idx != null) shipCities[type][idx] = { name, departamento, price };
    else shipCities[type].push({ name, departamento, price });

    try {
      await saveShipCities();
      renderShipList(type);
      resetShipForm(type);
      toast(idx != null ? 'Ciudad actualizada' : 'Ciudad agregada');
    } catch (e) {
      shipCities[type] = prevList; // revert on failure
      toast('Error al guardar la ciudad: ' + e.message);
    }
  };

  document.getElementById(`ship-${type}-cancel`).onclick = () => resetShipForm(type);

  document.getElementById(`ship-${type}-list`).addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-ship-edit]');
    const delBtn  = e.target.closest('[data-ship-del]');
    if (editBtn) {
      const idx = parseInt(editBtn.dataset.shipEdit.split(':')[1]);
      const city = shipCities[type][idx];
      document.getElementById(`ship-${type}-name`).value  = city.name;
      document.getElementById(`ship-${type}-departamento`).value = city.departamento || '';
      document.getElementById(`ship-${type}-price`).value = city.price ?? '';
      document.getElementById(`ship-${type}-add`).textContent = 'Guardar cambios';
      document.getElementById(`ship-${type}-cancel`).style.display = 'inline-block';
      shipEditing[type] = idx;
    } else if (delBtn) {
      const idx = parseInt(delBtn.dataset.shipDel.split(':')[1]);
      const city = shipCities[type][idx];
      if (!confirm(`¿Eliminar "${city.name}"?`)) return;
      const prevList = shipCities[type].slice();
      shipCities[type].splice(idx, 1);
      try {
        await saveShipCities();
        renderShipList(type);
        if (shipEditing[type] === idx) resetShipForm(type);
      } catch (e) {
        shipCities[type] = prevList;
        toast('Error al eliminar: ' + e.message);
      }
    }
  });
});

// Tiempo real: si se edita desde otra pestaña/dispositivo, la lista se refresca sola.
// Se inicia desde el guard, después de Auth + App Check.
function startAdminSettingsRealtimeLegacy() {
/*
onSnapshot(doc(db, 'settings', 'general'), snap => {
  if (!snap.exists()) return;
  const d = snap.data();

  // "Abrir WhatsApp Business" en Mensajes — única fuente: whatsappNumber de
  // Configuración. No se toca acá ningún link de "escribirle a esta clienta"
  // (esos usan el teléfono de cada pedido, no el de la tienda).
  const waLink = document.getElementById('mensajes-wa-link');
  const digits = String(d.whatsappNumber || '').replace(/\D/g, '');
  if (waLink && digits) waLink.href = 'https://wa.me/' + digits;

  if (d.waConfirmMessage) waConfirmMessageTemplate = d.waConfirmMessage;
});

// Ciudades de envío viven en settings/shippingRates, no en settings/general
// (ver sparkShippingRatesPath() en firestore.rules) — settings/general debe
// quedar liviano para que evaluarlo en cada pedido no choque con el límite
// de 1000 expresiones que Firestore evalúa por escritura. Si el documento
// nuevo todavía no existe pero settings/general conserva las listas viejas
// (deploys anteriores a este cambio), se migran una única vez y se borran
// de settings/general para que no vuelva a inflarse.
onSnapshot(doc(db, 'settings', 'shippingRates'), async snap => {
  const d = snap.exists() ? snap.data() : {};
  if (Array.isArray(d.deliveryCities) || Array.isArray(d.encomiendaCities)) {
    shipCities.delivery   = Array.isArray(d.deliveryCities)   ? d.deliveryCities   : [];
    shipCities.encomienda = Array.isArray(d.encomiendaCities) ? d.encomiendaCities : [];
    renderShipList('delivery');
    renderShipList('encomienda');
    return;
  }
  try {
    const legacySnap = await getDoc(doc(db, 'settings', 'general'));
    const legacy = legacySnap.exists() ? legacySnap.data() : {};
    if (!Array.isArray(legacy.deliveryCities) && !Array.isArray(legacy.encomiendaCities)) return;
    await setDoc(doc(db, 'settings', 'shippingRates'), {
      deliveryCities: legacy.deliveryCities || [],
      encomiendaCities: legacy.encomiendaCities || [],
      deliveryCost: legacy.deliveryCost || 0,
      encomiendaCost: legacy.encomiendaCost || 0,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await setDoc(doc(db, 'settings', 'general'), {
      deliveryCities: deleteField(),
      encomiendaCities: deleteField()
    }, { merge: true });
    console.log('[envios] Ciudades migradas de settings/general a settings/shippingRates.');
  } catch (e) {
    console.error('[envios] No se pudo migrar deliveryCities/encomiendaCities a settings/shippingRates:', e);
  }
});
*/
}

// Pestañas Delivery / Encomienda dentro de Envíos
document.querySelectorAll('.ship-tab-btn').forEach(btn => {
  btn.onclick = () => {
    const type = btn.dataset.shipTab;
    document.querySelectorAll('.ship-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.ship-tab-panel').forEach(p => p.classList.toggle('active', p.id === `ship-panel-${type}`));
  };
});

// Carga masiva: los 18 departamentos y todas las ciudades de Paraguay de una
// sola vez, igual que si se tipeara cada una a mano — mismo shipCities[type],
// mismo saveShipCities(). Las ciudades de la lista de cobertura de FitoXpress
// van a Delivery con su tarifa exacta; el resto de TODAS las ciudades del
// país va a Encomienda (precio "Consultar", como cualquier ciudad manual sin
// costo cargado). Nunca pisa una ciudad que ya exista (por nombre, sin
// importar mayúsculas) en ninguna de las dos listas.
document.getElementById('ship-import-paraguay')?.addEventListener('click', async () => {
  const existing = new Set([...shipCities.delivery, ...shipCities.encomienda].map(c => c.name.toLowerCase()));
  const deliveryByName = new Map(FITOXPRESS_DELIVERY_CITIES.map(c => [c.name.toLowerCase(), c.price]));

  const newDelivery = [];
  const newEncomienda = [];
  PARAGUAY_LOCATIONS.forEach(({ departamento, ciudades }) => {
    ciudades.forEach(name => {
      if (existing.has(name.toLowerCase())) return;
      if (deliveryByName.has(name.toLowerCase())) {
        newDelivery.push({ name, departamento, price: deliveryByName.get(name.toLowerCase()) });
      } else {
        newEncomienda.push({ name, departamento, price: null });
      }
    });
  });

  if (!newDelivery.length && !newEncomienda.length) { toast('Ya están todas cargadas — no hay ciudades nuevas para agregar.'); return; }
  const msg = `Se van a agregar ${newDelivery.length} ciudad(es) a Delivery y ${newEncomienda.length} a Encomienda (los 18 departamentos de Paraguay). Las ciudades que ya tenés cargadas no se tocan. ¿Continuar?`;
  if (!confirm(msg)) return;

  const prevDelivery = shipCities.delivery.slice();
  const prevEncomienda = shipCities.encomienda.slice();
  shipCities.delivery = [...shipCities.delivery, ...newDelivery];
  shipCities.encomienda = [...shipCities.encomienda, ...newEncomienda];
  try {
    await saveShipCities();
    renderShipList('delivery');
    renderShipList('encomienda');
    logAudit('editar_envio', 'envio', '', '', `Carga masiva de ciudades de Paraguay: ${newDelivery.length} delivery, ${newEncomienda.length} encomienda`, { bulk: true, delivery: newDelivery.length, encomienda: newEncomienda.length });
    toast(`Listo — ${newDelivery.length + newEncomienda.length} ciudad(es) agregada(s)`);
  } catch (e) {
    shipCities.delivery = prevDelivery;
    shipCities.encomienda = prevEncomienda;
    toast('Error al cargar las ciudades: ' + e.message);
  }
});

// Corrección masiva: productos viejos guardados antes de que prodGuardar()
// forzara price/priceBefore/stock a número (ver ese comentario más arriba)
// pueden haber quedado con esos campos como texto. sparkOrderCreateValid()
// en firestore.rules exige igualdad exacta de tipo entre el precio del
// carrito (siempre número) y products/{id}.price — un precio en texto
// rechaza CUALQUIER pedido de ese producto para siempre, sin relación con
// ciudad, departamento ni tienda abierta/cerrada. Reutiliza el mismo patrón
// que la carga masiva de ciudades: no toca productos que ya están bien.
window.fixLegacyProductNumbers = async function() {
  if (currentRole !== 'superadmin') {
    toast('Solo Super Admin puede corregir esto.');
    return;
  }

  const toNumberOrNull = value => {
    if (value === null || value === undefined || value === '') return null;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  };

  const broken = _allProducts.filter(p => {
    const priceBad = typeof p.price !== 'number' || !Number.isFinite(p.price);
    const priceBeforeBad = p.priceBefore != null &&
      (typeof p.priceBefore !== 'number' || !Number.isFinite(p.priceBefore));
    const stockBad = p.stock != null &&
      (typeof p.stock !== 'number' || !Number.isFinite(p.stock));
    return priceBad || priceBeforeBad || stockBad;
  });

  if (!broken.length) {
    toast('Ningún producto tiene precio, precio anterior o stock guardado como texto — no hay nada para corregir.');
    return;
  }

  const msg = `Se van a corregir ${broken.length} producto(s) que tienen precio, precio anterior o stock guardados como texto en vez de número (por eso sus pedidos se rechazaban siempre). No cambia ningún valor visible, solo el tipo de dato. ¿Continuar?`;
  if (!confirm(msg)) return;

  const batch = writeBatch(db);
  let skipped = 0;
  const fixedIds = [];
  broken.forEach(p => {
    const patch = { updatedAt: serverTimestamp() };
    if (typeof p.price !== 'number' || !Number.isFinite(p.price)) {
      const price = toNumberOrNull(p.price);
      if (price === null) { skipped += 1; return; }
      patch.price = price;
    }
    if (p.priceBefore != null && (typeof p.priceBefore !== 'number' || !Number.isFinite(p.priceBefore))) {
      patch.priceBefore = toNumberOrNull(p.priceBefore);
    }
    if (p.stock != null && (typeof p.stock !== 'number' || !Number.isFinite(p.stock))) {
      patch.stock = toNumberOrNull(p.stock);
    }
    batch.update(doc(db, 'products', p._docId), patch);
    fixedIds.push(p._docId);
  });

  try {
    await withAdminSiteChange(async () => batch.commit());
    await pushProductsToSheets(fixedIds);
    const fixed = broken.length - skipped;
    logAudit('editar_producto', 'producto', '', '', `Corrección masiva de precio/stock guardados como texto: ${fixed} producto(s)${skipped ? `, ${skipped} sin precio válido para corregir` : ''}`, { bulk: true, fixed, skipped });
    toast(`Listo — ${fixed} producto(s) corregido(s)${skipped ? `, ${skipped} necesitan revisión manual (sin precio numérico legible)` : ''}.`);
  } catch (e) {
    toast('Error al corregir productos: ' + e.message);
  }
};

/* =============================================
   UNSAVED CHANGES GUARD — reusable for product & collection editors
   ============================================= */
const UnsavedGuard = {
  _serializeFn: null,
  _onSave: null,

  /** Call once the form is populated with the item being edited/created. */
  track(serializeFn, onSave) {
    this._serializeFn = serializeFn;
    this._onSave = onSave;
    window.AdminUnsaved?.register('primary-editor', {
      serialize: () => JSON.stringify(serializeFn()),
      save: onSave,
      label: 'el formulario abierto',
    });
  },
  clear() {
    this._serializeFn = null;
    this._onSave = null;
    window.AdminUnsaved?.unregister('primary-editor');
  },
  isDirty() {
    return window.AdminUnsaved?.isDirty('primary-editor') || false;
  },
  /** Call before navigating away from the form. Runs `proceed` immediately
   *  if nothing changed; otherwise blocks with a Guardar/Descartar modal. */
  confirmLeave(proceed) {
    if (typeof productWorkspace!=='undefined' && productWorkspace) {
      void productWorkspace.leave(proceed);return;
    }
    if (!window.AdminUnsaved) {
      if (!this.isDirty() || window.confirm('Tenés cambios sin guardar. ¿Deseás salir sin guardarlos?')) {
        this.clear();
        proceed();
      }
      return;
    }
    window.AdminUnsaved.requestNavigation(() => {
      this.clear();
      proceed();
    }, { scopeIds: ['primary-editor'] });
  }
};

/* =============================================
   PRODUCTOS — CRUD
   ============================================= */
let _allProducts = [];
// La comparación concurrente usa el documento original, no su presentación saneada.
let _productSourceById = new Map();
let _productosUnsub = null;
let _productInventoryUnsub = null;
const _productInventoryById = new Map();
let productEditBaseline=null;
let productCommercialBaseline=null;
let productMasterBusy=false;

// Combina las opciones curadas de cada <datalist> de ficha técnica con los
// valores que ya se usaron en productos reales, para que las sugerencias
// crezcan solas sin dejar de aceptar texto libre.
const SPEC_DATALIST_FIELDS = [
  ['material', 'dl-prod-material'],
  ['measurements', 'dl-prod-measurements'],
  ['colorFinish', 'dl-prod-color-finish'],
  ['care', 'dl-prod-care'],
  ['waterResistance', 'dl-prod-water-resistance'],
  ['warranty', 'dl-prod-warranty'],
  ['sizeFit', 'dl-prod-size-fit'],
  ['packageContents', 'dl-prod-package-contents'],
];
function syncSpecDatalists(products) {
  SPEC_DATALIST_FIELDS.forEach(([field, datalistId]) => {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    datalist.querySelectorAll('option[data-dynamic="1"]').forEach(o => o.remove());
    const existing = new Set([...datalist.options].map(o => o.value.trim().toLowerCase()));
    products.forEach(p => {
      const value = String(p[field] || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (existing.has(key)) return;
      existing.add(key);
      const option = document.createElement('option');
      option.value = value;
      option.dataset.dynamic = '1';
      datalist.appendChild(option);
    });
  });
}

// Live listener: any create/edit/delete/activate/deactivate — from this session
// or another admin's — updates the table immediately, no manual refresh needed.
let _productosSlowTimer = null;
function loadProductos() {
  document.getElementById('prod-loading').style.display = '';
  document.getElementById('prod-loading').innerHTML = 'Cargando productos…';
  document.getElementById('prod-table-wrap').style.display = 'none';
  document.getElementById('prod-empty').style.display = 'none';
  if (!_productInventoryUnsub && currentRole === 'superadmin') {
    _productInventoryUnsub = onSnapshot(collection(db, 'productInventory'), snap => {
      _productInventoryById.clear();
      snap.docs.forEach(item => _productInventoryById.set(item.id, item.data()));
    }, error => console.error('[Tintin Inventory] No se pudo cargar el inventario interno.', error));
  }
  if (_productosUnsub) return; // listener already active, just re-show current data
  // Con conexión lenta o inestable (típico en tablet/mobile con wifi débil)
  // onSnapshot puede tardar mucho en resolver, o nunca resolver, sin avisar —
  // el spinner giraba indefinidamente sin ninguna pista de qué pasaba. A los
  // 12s (mismo umbral que BUSY_TIMEOUT_MS en experiencia-interfaz.js) se avisa y se
  // ofrece reintentar en vez de dejar la pantalla colgada en silencio.
  clearTimeout(_productosSlowTimer);
  _productosSlowTimer = setTimeout(() => {
    if (adminRealtimeReady.products) return;
    document.getElementById('prod-loading').innerHTML =
      'La carga de productos está tardando más de lo esperado. Verificá tu conexión. ' +
      '<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="reintentarCargaProductos()">Reintentar</button>';
  }, 12000);
  _productosUnsub = subscribeAdminCollectionPages('products', 1000,
    records => {
      clearTimeout(_productosSlowTimer);
      // A diferencia de la tienda pública (estado-productos.js), esto no
      // pasaba por sanitizeVariantData — un variants malformado (por
      // ejemplo un array con una entrada null, algo que ninguna pantalla
      // del propio admin puede producir pero que un editor externo directo
      // sobre Firestore sí podría dejar) rompía el formulario entero al
      // abrir justo ese producto.
      _productSourceById = new Map(records.map(({ id, record: data }) => [id, data]));
      _allProducts = records.map(({ id, record: data }) => ({ ...data, _docId: id,
        category: wristCategory(data.category || ''), variants: sanitizeVariantData(data.variants || null) }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
      adminRealtimeReady.products = true;
      syncSpecDatalists(_allProducts);
      applyProductFilters();
      renderGeneralStatistics();
    },
    e => {
      clearTimeout(_productosSlowTimer);
      adminRealtimeReady.products = false;
      document.getElementById('prod-loading').innerHTML =
        'Error al cargar productos. ' +
        '<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="reintentarCargaProductos()">Reintentar</button>';
      // Los indicadores de productos activos/stock bajo muestran "—" (no "0").
      renderGeneralStatistics();
      console.error(e);
    },
    () => { adminRealtimeReady.products = false; }
  );
}
window.reintentarCargaProductos = function() {
  clearTimeout(_productosSlowTimer);
  if (_productosUnsub) { _productosUnsub(); _productosUnsub = null; }
  loadProductos();
};

function productRowHtml(p) {
  const isSelected = _selectedProducts.has(p._docId);
  const safeDocId = escapeHtmlAdmin(p._docId);
  const docIdArg = String((p._docId) ?? '');
  const nameArg = String((p.name || '') ?? '');
  const imageUrl = sanitizeImageUrl(p.imageUrl || '');
  const fmt = n => 'Gs. ' + Number(n).toLocaleString('es-PY');
  const canEditProd = can(currentRole, 'editProducts') && roleCanDo('productos', 'editar');
  const canToggleProd = can(currentRole, 'editProducts') && roleCanDo('productos', 'activarDesactivar');
  const canDeleteProd = can(currentRole, 'deleteProducts') && roleCanDo('productos', 'eliminar');
  return `
    <tr style="border-top:1px solid var(--adm-border);transition:background .15s;background:${isSelected ? 'var(--adm-bg)' : ''}">
      <td style="padding:10px 16px;text-align:center">
        <input type="checkbox" class="prod-row-check" data-id="${safeDocId}" ${isSelected ? 'checked' : ''} onclick="toggleProductSelect(this)" style="cursor:pointer;width:15px;height:15px">
      </td>
      <td style="padding:10px 16px">
        ${imageUrl
          ? `<img src="${escapeHtmlAdmin(imageUrl)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--adm-border)">`
          : `<div style="width:48px;height:48px;background:#fce4ec;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8a0b4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`}
      </td>
      <td style="padding:10px 16px;font-weight:600;max-width:200px">${p.name && p.name.trim() ? escapeHtmlAdmin(p.name) : '<span style="color:#c62828;background:#fce4ec;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><path d="M12 2L2 21h20L12 2z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>SIN NOMBRE — revisar/eliminar</span>'}${
        p.name && p.name.length > 180
          ? '<br><span style="color:#bf360c;background:#fff3e0;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800" title="Un nombre de más de 180 caracteres no coincide con lo que envía el checkout y bloquea la compra de este producto"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><path d="M12 2L2 21h20L12 2z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>NOMBRE MUY LARGO</span>'
          : ''
      }${
        typeof p.price !== 'number' || !Number.isFinite(p.price)
          ? '<br><span style="color:#bf360c;background:#fff3e0;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800" title="El precio no es un número válido: las reglas de Firestore rechazan el checkout de este producto"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><path d="M12 2L2 21h20L12 2z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>PRECIO INVÁLIDO</span>'
          : ''
      }</td>
      <td style="padding:10px 16px;color:var(--adm-muted);text-transform:capitalize">${escapeHtmlAdmin(p.category||'—')}</td>
      <td style="padding:10px 16px;color:var(--adm-muted);font-size:12px">${escapeHtmlAdmin(p.collection||'—')}</td>
      <td style="padding:10px 16px;text-align:right;font-weight:700;color:var(--adm-primary)">${fmt(p.price||0)}</td>
      <td style="padding:10px 16px;text-align:center">${escapeHtmlAdmin(p.stock != null ? p.stock : '—')}</td>
      <td style="padding:10px 16px;text-align:center">
        <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${p.active !== false ? '#e8f5e9' : '#fce4ec'};color:${p.active !== false ? '#2e7d32' : '#c62828'}">
          ${p.active !== false ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td style="padding:10px 16px;text-align:center">
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
          ${canEditProd ? `<button type="button" class="adm-btn adm-btn-sm" ${adminEventAttributes('click','prodEditar',[docIdArg])} title="Editar producto"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>` : ''}
          ${canToggleProd ? `<button type="button" class="adm-btn adm-btn-sm" style="background:${p.active !== false ? '#fff3e0' : '#e8f5e9'};color:${p.active !== false ? '#bf360c' : '#2e7d32'}" ${adminEventAttributes('click','prodToggleActive',[docIdArg,p.active !== false])} title="${p.active !== false ? 'Desactivar — ocultar de la tienda' : 'Activar — mostrar en la tienda'}">${p.active !== false ? 'Desactivar' : 'Activar'}</button>` : ''}
          ${canDeleteProd ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" ${adminEventAttributes('click','prodEliminar',[docIdArg,nameArg])} title="Eliminar definitivamente"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Eliminar</button>` : ''}
          ${!canEditProd && !canToggleProd && !canDeleteProd ? '—' : ''}
        </div>
      </td>
    </tr>
  `;
}

function renderProductosTable(list) {
  document.getElementById('prod-loading').style.display = 'none';
  const tbody = document.getElementById('prod-tbody');
  if (!list.length) {
    document.getElementById('prod-empty').style.display = '';
    document.getElementById('prod-table-wrap').style.display = 'none';
    return;
  }
  document.getElementById('prod-table-wrap').style.display = '';
  document.getElementById('prod-empty').style.display = 'none';
  tbody.innerHTML = list.map(productRowHtml).join('');
}

// Default view (no search, no category filter): grouped by collection so the
// admin never lands on an empty-looking screen and can scan everything at once.
function renderProductosGrouped(list) {
  document.getElementById('prod-loading').style.display = 'none';
  if (!list.length) {
    document.getElementById('prod-empty').style.display = '';
    document.getElementById('prod-table-wrap').style.display = 'none';
    return;
  }
  document.getElementById('prod-table-wrap').style.display = '';
  document.getElementById('prod-empty').style.display = 'none';

  const labelFor = (slug) => {
    const c = _allCollections.find(x => wristCategory(x.slug) === wristCategory(slug));
    return c ? (c.name || slug) : (slug || 'Sin categoría');
  };
  const groups = new Map();
  list.forEach(p => {
    const key = p.category || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const oa = _allCollections.find(c => wristCategory(c.slug) === wristCategory(a))?.order ?? 999;
    const ob = _allCollections.find(c => wristCategory(c.slug) === wristCategory(b))?.order ?? 999;
    return oa - ob || labelFor(a).localeCompare(labelFor(b), 'es');
  });

  document.getElementById('prod-tbody').innerHTML = orderedKeys.map(key => `
    <tr><td colspan="9" style="padding:14px 16px 8px;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--adm-primary);background:var(--adm-bg)">
      ${escapeHtmlAdmin(labelFor(key))} <span style="color:var(--adm-muted);font-weight:600">(${groups.get(key).length})</span>
    </td></tr>
    ${groups.get(key).map(productRowHtml).join('')}
  `).join('');
}

// Search + category filter
function applyProductFilters() {
  const q = normalizeAdminSearch(document.getElementById('prod-search')?.value);
  const cat = document.getElementById('prod-filter-cat')?.value || '';
  let result = _allProducts;
  if (q === 'sin nombre' || q === 'sin-nombre') {
    result = result.filter(p => !p.name || !p.name.trim());
  } else if (q) {
    result = result.filter(p =>
      normalizeAdminSearch(p.name).includes(q) ||
      normalizeAdminSearch(p.category).includes(q) ||
      normalizeAdminSearch(p.collection).includes(q) ||
      normalizeAdminSearch(Array.isArray(p.tags) ? p.tags.join(' ') : p.tags).includes(q)
    );
  }
  if (cat) result = result.filter(p => wristCategory(p.category || '') === wristCategory(cat));
  if (!q && !cat) renderProductosGrouped(result);
  else renderProductosTable(result);

  // Keep the collection products workspace live if it's currently open
  if (_collProductsSlug && document.getElementById('coll-products-card').style.display !== 'none') renderCollCurrentList();
  if (document.getElementById('coll-picker-card').style.display !== 'none') renderCollPicker();
  updateBulkToolbar();
}
document.getElementById('prod-search').addEventListener('input', debounceAdminSearch(applyProductFilters));
document.getElementById('prod-filter-cat').addEventListener('change', applyProductFilters);

// Widgets de imagen de formulario: la carga real (validar/optimizar/subir a
// Storage) pasa apenas se confirma, pero el valor solo queda "aplicado" al
// producto/colección cuando se guarda el formulario completo — por eso el
// widget escribe en un <input type="hidden"> en vez de guardar solo, igual
// que cualquier otro campo del mismo form.
const _formImageWidgets = new Map();
function mountFormImageWidget(containerId, hiddenInputId, { value, label, hint } = {}) {
  _formImageWidgets.get(containerId)?.destroy();
  const container = document.getElementById(containerId);
  if (!container) return;
  const hiddenInput = document.getElementById(hiddenInputId);
  const controller = attachImageUploadWidget(container, {
    label: label || 'Imagen',
    hint,
    value: value || '',
    onOpenLibrary: openMediaLibraryPicker,
    onChange: url => {
      if (hiddenInput) { hiddenInput.value = url || ''; hiddenInput.dispatchEvent(new Event('change', { bubbles: true })); }
    },
  });
  _formImageWidgets.set(containerId, controller);
}

let productColorPhotos = null;
let productGalleryListener = null;
function mountProductColorPhotos(product) {
  productColorPhotos?.destroy();
  productGalleryListener?.abort();
  for(const id of ['prod-image-widget','prod-gallery-widget']) {_formImageWidgets.get(id)?.destroy();_formImageWidgets.delete(id);}
  for(const id of ['prod-gallery-widget','prod-gallery-thumbs','prod-gallery-links'])document.getElementById(id)?.remove();
  const mainInput=document.getElementById('prod-imageUrl'),imagesInput=document.getElementById('prod-images-extra');
  // Mantener los campos canónicos, sin controles de imagen duplicados.
  for(const field of [document.getElementById('prod-image-widget')?.parentElement,imagesInput.parentElement])if(field)field.hidden=true;
  let container=document.getElementById('prod-color-photos');
  if(!container){container=document.createElement('div');container.id='prod-color-photos';document.getElementById('prod-image-widget').parentElement.after(container);}
  productColorPhotos=attachProductGallery({container,product,mainInput,imagesInput,variantsInput:document.getElementById('prod-variants-text'),openLibrary:openMediaLibraryPicker});
}
let productVariantStockBaseline = null;
let productVariantStockEvents = null;
function productVariantStockConfiguration(text, previous = [], previousVariants = null, protectedEntries = previous) {
  const attributes = new Map();
  for (const line of String(text || '').split(/\r?\n/).filter(line => line.trim())) {
    const separator = line.indexOf(':');
    const key = line.slice(0, separator).replace(/\s+/g, ' ').trim();
    const values = line.slice(separator + 1).split(',').map(value => value.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (separator < 1 || !key || key.length > 60 || /[<>]/.test(key) || ['__proto__','constructor','prototype'].includes(key) || !values.length || values.some(value => value.length > 120 || /[\/<>]/.test(value))) {
      throw new Error('Escribí las opciones como Color: dorado, plateado, sin barras ni valores vacíos.');
    }
    attributes.set(key, [...new Set([...(attributes.get(key) || []), ...values])]);
  }
  if (!attributes.size) throw new Error('Agregá al menos un color u opción para distribuir el stock.');
  if (attributes.size > 20 || [...attributes.values()].some(values => values.length > 50)) throw new Error('Hay demasiadas opciones. Usá hasta 20 características y 50 opciones por característica.');
  let combinations = [''];
  for (const values of attributes.values()) {
    if (combinations.length * values.length > 1000) throw new Error('El máximo es de 1.000 combinaciones por producto.');
    combinations = combinations.flatMap(prefix => values.map(value => prefix ? `${prefix} / ${value}` : value));
  }
  if (combinations.some(value => value.length > 120)) throw new Error('Los nombres combinados deben tener hasta 120 caracteres.');
  if (previousVariants && previous.length) {
    const protectedKeys=new Set(protectedEntries.map(row=>row.variant));
    const retained=previous.filter(row=>{
      if(protectedKeys.has(row.variant))return true;
      const selected=variantAttributes({variants:previousVariants},row.variant);
      const keep=selected && Object.keys(selected).length===attributes.size && [...attributes].every(([key,values])=>values.includes(selected[key]));
      if(!keep && Number(row.stock)>0)throw new Error('Primero dejá en 0 el stock de la opción que querés quitar.');
      return keep;
    });
    return {variants:Object.fromEntries(attributes),entries:reorderVariantInventory({variants:previousVariants},Object.fromEntries(attributes),retained)};
  }
  const retained = new Set(combinations);
  if (previous.some(entry => Number(entry.stock) > 0 && !retained.has(entry.variant))) throw new Error('Primero dejá en 0 el stock de la opción que querés quitar.');
  const quantities = new Map(previous.map(entry => [entry.variant, entry.stock]));
  return {variants: Object.fromEntries(attributes), entries: combinations.map(variant => ({variant, stock: quantities.get(variant) ?? ''}))};
}

function productEditorialForm(product={}) {
  ensureEditorialFields(document.getElementById('prod-form-card'));
  const status=document.getElementById('prod-publicationStatus');
  const inactive=product.active===false && (!product.publicationStatus || product.publicationStatus==='active');
  if(inactive && !status.querySelector('option[value=inactive]'))status.add(new Option('Inactivo (histórico)','inactive'));
  if(!inactive)status.querySelector('option[value=inactive]')?.remove();
  const values={publicationStatus:inactive?'inactive':productEditorialStatus(product),productTemplate:productTemplate(product),seoTitle:product.seoTitle || '',seoDescription:product.seoDescription || ''};
  for(const [key,value] of Object.entries(values)){const field=document.getElementById(`prod-${key}`);if(field)field.value=value;}
}
function productEditorialData() {
  const status=document.getElementById('prod-publicationStatus');
  if(!status?.options)return {};
  const values=Object.fromEntries(['publicationStatus','productTemplate','seoTitle','seoDescription'].map(key=>[key,document.getElementById(`prod-${key}`).value]));
  const result=editorialFields({...values,publicationStatus:values.publicationStatus==='inactive'?'draft':values.publicationStatus});
  if(values.publicationStatus==='inactive')delete result.publicationStatus;
  return result;
}
function renderProductStatistics(productId) {
  const panel=document.getElementById('prod-statistics');if(!panel?.replaceChildren)return;
  panel.replaceChildren();
  if(!productId || !can(currentRole,'viewOrders') || !roleCanDo('pedidos','ver')){panel.textContent='Las estadísticas requieren un producto guardado y permiso para ver pedidos.';return;}
  if(!adminRealtimeReady.orders || adminOrdersOwnerUid!==currentUser?.uid){panel.textContent='Esperando la sincronización de pedidos para calcular las estadísticas.';return;}
  const metric=productStatistics(productId,filterStatisticsRows('products',allOrders,row=>activityTimestampMillis(row.createdAt)),activityTimestampMillis);
  const heading=document.createElement('h3');heading.textContent='Estadísticas del producto';panel.append(heading);
  const summary=document.createElement('p');summary.textContent=`${metric.units} unidades · ${formatPrice(metric.revenue)} brutos en líneas pagadas · ${metric.orders} pedidos`;panel.append(summary);
  const note=document.createElement('p');note.textContent='Datos de los pedidos disponibles en esta sesión, desde el último reinicio de Productos vendidos. Excluye pruebas, cancelados, rechazados y reembolsos completos. No representa ingresos netos: no descuenta devoluciones parciales ni distribuye descuentos generales.';panel.append(note);
  for(const row of metric.variants){const line=document.createElement('p');line.textContent=`${row.label}: ${row.units} unidades · ${formatPrice(row.revenue)}`;panel.append(line);}
  for(const [month,revenue] of metric.months){const line=document.createElement('p');line.textContent=`${month}: ${formatPrice(revenue)}`;panel.append(line);}
  if(metric.incomplete){const warning=document.createElement('p');warning.textContent=`${metric.incomplete} líneas sin datos completos excluidas.`;panel.append(warning);}
}
let productCommercialEditor = null;
let productWorkspace = null;
let productPrivateBaseline = null;
let pendingProductEditorSave = null;
function renderProductVariantStock(product, configuration = null) {
  productCommercialEditor = null;
  document.getElementById('prod-form-card')?.dispatchEvent?.(new CustomEvent('tintin:commercial-draft',{detail:null}));
  productVariantStockEvents?.abort();
  productVariantStockEvents = new AbortController();
  document.getElementById('prod-form-card')?.addEventListener('tintin:product-options-read',event=>{event.detail.product=configuration?.commercialBaseline ?? product;},{signal:productVariantStockEvents.signal});
  productVariantStockBaseline = null;
  let panel = document.getElementById('prod-variant-stock');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'prod-variant-stock';
    document.getElementById('prod-variants-text').parentElement.append(panel);
  }
  panel.replaceChildren();
  panel.classList.remove('tt-commercial-editor');
  const stockInput = document.getElementById('prod-stock');
  const optionsInput = document.getElementById('prod-variants-text');
  stockInput.readOnly = false;
  optionsInput.readOnly = false;
  if (product?.variantCommerceVersion === 2) {
    productCommercialEditor = mountCommercialEditor(panel, product, productVariantStockConfiguration, productVariantStockEvents.signal, configuration?.commercialBaseline ?? product,()=>{const retainedStock=stockInput.value;renderProductVariantStock(null);stockInput.value=retainedStock;stockInput.dispatchEvent(new Event('input',{bubbles:true}));});
    return;
  }
  const expectedEntries = variantInventoryEntries(product);
  // Existing allocations migrate through the commercial engine with identities intact.
  // An aggregate legacy stock is never copied into every combination.
  if(expectedEntries && !configuration && Number(document.getElementById('prod-price').value || product?.price)>0){
    const base={...product,price:Number(document.getElementById('prod-price').value) || product.price};
    try{renderProductVariantStock(commercialDraft(base,productVariantStockConfiguration(optionsInput.value).variants,product),{commercialBaseline:product});return;}catch(failure){const note=document.createElement('p');note.textContent='Las asignaciones históricas requieren revisión antes de cambiar su estructura. Se conservan sus cantidades y referencias.';panel.append(note);}
  }
  if(expectedEntries)optionsInput.addEventListener('tintin:variant-option-availability',event=>{
    if(event.detail.active!==false || !productVariantStockBaseline)return;
    try {
      const entries=productVariantStockBaseline.entries.map((row,index)=>({...row,stock:panel.querySelectorAll('input')[index]?.value===''?NaN:Number(panel.querySelectorAll('input')[index]?.value ?? row.stock)}));
      const variants=productVariantStockConfiguration(optionsInput.value).variants;
      const base={...product,variants:productVariantStockBaseline.variants,variantInventory:entries,price:Number(document.getElementById('prod-price').value),priceBefore:document.getElementById('prod-price-before').value===''?null:Number(document.getElementById('prod-price-before').value)};
      const draft=commercialDraft(base,variants,product);
      const keys=new Set(expectedEntries.map(row=>row.variant));
      if(!draft.variantInventory.some(row=>keys.has(row.variant) && row.attributes?.[event.detail.attribute]===event.detail.value))return;
      event.preventDefault();
      renderProductVariantStock(draft,{commercialBaseline:product});
      productCommercialEditor.setOptionAvailability(event.detail.attribute,event.detail.value,false);
      const error=document.getElementById('prod-form-error');error.textContent='';error.style.display='none';
    } catch(failure) {
      event.preventDefault();
      const error=document.getElementById('prod-form-error');error.textContent=failure.message;error.style.display='';
    }
  },{signal:productVariantStockEvents.signal});
  let acceptedOptions = optionsInput.value;
  optionsInput.addEventListener('input', () => {
    try {
      if(document.getElementById('prod-id').value && product?.variants && !Array.isArray(product.variants)){
        const requested=productVariantStockConfiguration(optionsInput.value).variants || {};
        for(const [key,values] of Object.entries(product.variants))if(Array.isArray(values)){
          if(values.some(value=>!requested[key]?.includes(value)))throw new Error('Esta opción tiene inventario o referencias históricas. Conservá su nombre y editá su disponibilidad; no se puede eliminar directamente.');
          if(/^colou?r$/i.test(key) && !product.variantMedia?.length && values.some((value,index)=>requested[key]?.[index]!==value))throw new Error('Estas fotos históricas pueden estar asociadas por posición. Revisá sus asociaciones antes de cambiar el orden.');
        }
      }
      if (!optionsInput.value.trim() && !productVariantStockBaseline) return;
      // Agregar opciones no activa el control de unidades por combinación.
      if (!productVariantStockBaseline) {const variants=productVariantStockConfiguration(optionsInput.value);if(Object.keys(variants.variants).length){renderProductVariantStock(product,variants);}acceptedOptions = optionsInput.value;return;}
      const previous = productVariantStockBaseline?.entries.map((entry, index) => ({...entry, stock:panel.querySelectorAll('input')[index]?.value==='' && entry.stock===null?null:panel.querySelectorAll('input')[index]?.value ?? entry.stock})) || [];
      if (!optionsInput.value.trim() && !product && !document.getElementById('prod-id').value) {
        if(previous.length>1 && previous.some(entry=>Number(entry.stock)>0))throw new Error('Primero revisá las cantidades de las opciones que querés quitar.');
        const unconfiguredStock = productVariantStockBaseline?.unconfiguredStock ?? '0';
        renderProductVariantStock(null);
        stockInput.value = unconfiguredStock;
        stockInput.dispatchEvent(new Event('input', {bubbles:true}));
        const error = document.getElementById('prod-form-error'); error.textContent='';error.style.display='none';
        return;
      }
      const draft = productVariantStockConfiguration(optionsInput.value, previous, productVariantStockBaseline?.variants || product?.variants, expectedEntries || []);
      if (!product) draft.unconfiguredStock = productVariantStockBaseline?.unconfiguredStock ?? stockInput.value;
      acceptedOptions = optionsInput.value;
      renderProductVariantStock(product, draft);
      const error = document.getElementById('prod-form-error'); error.textContent='';error.style.display='none';
    } catch (failure) {
      optionsInput.value = acceptedOptions;
      const error = document.getElementById('prod-form-error');error.textContent=failure.message;error.style.display='';
    }
  }, {signal:productVariantStockEvents.signal});
  if(expectedEntries===null && !configuration){
    if(!optionsInput.value.trim())return;
    configuration=productVariantStockConfiguration(optionsInput.value);
    if(stockInput.value==='')for(const row of configuration.entries)row.stock=null;
    else if(configuration.entries.length===1)configuration.entries[0].stock=Number(stockInput.value);
  }
  const aggregateStock=configuration?.unconfiguredStock ?? (product && product.variantInventory==null?(product.stock ?? ''):stockInput.value);
  if(configuration?.entries?.length && (aggregateStock!=='' && Number(aggregateStock)===0 || configuration.entries.some(row=>Number.isInteger(row.stock))))configuration.entries=configuration.entries.map(row=>({...row,stock:row.stock===''?0:row.stock}));
  if(configuration?.entries?.length && configuration.entries.every(row=>row.stock==='' || row.stock===null)){
    if(aggregateStock==='')configuration.entries=configuration.entries.map(row=>({...row,stock:null}));
    else if(configuration.entries.length===1)configuration.entries[0].stock=Number(aggregateStock);
  }
  if(configuration?.entries?.length && configuration.entries.every(row=>row.stock!=='') && (!product || product.variantInventory!=null) && Number(document.getElementById('prod-price').value)>0){
    const untracked=new Set(configuration.entries.filter(row=>row.stock===null).map(row=>row.variant));
    const base={...product,variants:configuration.variants,variantInventory:configuration.entries.map(row=>({...row,stock:row.stock===null?0:row.stock})),price:Number(document.getElementById('prod-price').value),priceBefore:document.getElementById('prod-price-before').value===''?null:Number(document.getElementById('prod-price-before').value)};
    const draft=commercialDraft(base,configuration.variants,product || {});
    for(const row of draft.variantInventory)if(untracked.has(row.variant))row.stock=null;
    if(untracked.size)draft.stock=null;
    renderProductVariantStock(draft,{commercialBaseline:product || {}});return;
  }
  // El backend protege reservas históricas de productos con stock agregado.
  // Mantener su contrato legado; nunca habilitar v2 mediante una conversión silenciosa.
  if(product && expectedEntries===null && configuration?.entries?.every(row=>row.stock===null)){
    const note=document.createElement('p');note.textContent='Stock sin control para todas las opciones.';panel.append(note);
    stockInput.addEventListener('input',()=>{if(stockInput.value!=='')renderProductVariantStock(product,productVariantStockConfiguration(optionsInput.value));},{signal:productVariantStockEvents.signal});return;
  }
  productVariantStockBaseline = { stock: product?.stock, expectedEntries, entries: configuration?.entries || expectedEntries, variants: configuration?.variants || product?.variants, ...(!product ? {unconfiguredStock:configuration?.unconfiguredStock ?? stockInput.value} : {}) };
  stockInput.readOnly = true;
  optionsInput.readOnly = false;
  const hint = document.createElement('p');
  hint.textContent = configuration
    ? `Distribuí las cantidades de cada opción. Stock anterior: ${product?.stock ?? 'sin control'}. No se guardará hasta completar todas las cantidades.`
    : 'Stock por opción. El total se calcula con estas cantidades.';
  if (configuration) stockInput.value = '';
  panel.append(hint);
  for (const entry of productVariantStockBaseline.entries) {
    const label = document.createElement('label');
    label.textContent = `${entry.variant} `;
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.max = '1000000'; input.step = '1';
    input.className = 'adm-input'; input.value = String(entry.stock);input.setAttribute('aria-label', `Stock de ${entry.variant}`);
    input.addEventListener('input', () => {
      const inputs=[...panel.querySelectorAll('input')];
      stockInput.value=inputs.every(item=>item.value!=='')?String(inputs.reduce((sum,item)=>sum+Number(item.value),0)):'';
      if((!product || product.variantInventory!=null) && inputs.every(item=>item.value!=='')){const focus=input.getAttribute('aria-label')?.replace(/^Stock de /,'');queueMicrotask(()=>{if(!panel.isConnected || panel.classList.contains('tt-commercial-editor'))return;const entries=productVariantStockBaseline.entries.map((row,index)=>({...row,stock:Number(inputs[index].value)}));renderProductVariantStock(product,{entries,variants:productVariantStockBaseline.variants});[...panel.querySelectorAll('input')].find(item=>item.getAttribute('aria-label')==='Stock: '+focus)?.focus({preventScroll:true});});}
    });
    label.append(input); panel.append(label);
  }
  document.getElementById('prod-price').addEventListener('input',()=>{
    if(productCommercialEditor || product && product.variantInventory==null || Number(document.getElementById('prod-price').value)<=0)return;
    const inputs=[...panel.querySelectorAll('input[type=number]')];
    const entries=productVariantStockBaseline.entries.map((row,index)=>({...row,stock:inputs[index]?.value===''?(row.stock===null?null:''):Number(inputs[index]?.value ?? row.stock)}));
    if(entries.every(row=>row.stock!==''))renderProductVariantStock(product,{entries,variants:productVariantStockBaseline.variants});
  },{signal:productVariantStockEvents.signal});
  const complete = productVariantStockBaseline.entries.every(entry => entry.stock !== '');
  stockInput.value = complete && !productVariantStockBaseline.entries.some(entry=>entry.stock===null) ? String(productVariantStockBaseline.entries.reduce((sum, entry) => sum + Number(entry.stock), 0)) : '';
}

function serializeProductForm() {
  return {
    name: document.getElementById('prod-name').value,
    sku: document.getElementById('prod-sku').value,
    category: document.getElementById('prod-category').value,
    price: document.getElementById('prod-price').value,
    priceBefore: document.getElementById('prod-price-before').value,
    stock: document.getElementById('prod-stock').value,
    imageUrl: document.getElementById('prod-imageUrl').value,
    description: document.getElementById('prod-description').value,
    material: document.getElementById('prod-material').value,
    measurements: document.getElementById('prod-measurements').value,
    colorFinish: document.getElementById('prod-color-finish').value,
    care: document.getElementById('prod-care').value,
    waterResistance: document.getElementById('prod-water-resistance').value,
    warranty: document.getElementById('prod-warranty').value,
    sizeFit: document.getElementById('prod-size-fit').value,
    packageContents: document.getElementById('prod-package-contents').value,
    imagesExtra: document.getElementById('prod-images-extra').value,
    costUnit: document.getElementById('prod-cost-unit').value,
    purchased: document.getElementById('prod-purchased').value,
    stockMinimum: document.getElementById('prod-stock-minimum').value,
    internalNotes: document.getElementById('prod-internal-notes').value,
    tags: document.getElementById('prod-tags').value,
    variants: document.getElementById('prod-variants-text').value,
    variantMedia: productColorPhotos?.serialize() || [],
    pendingPhotos:[..._formImageWidgets].filter(([id])=>id.startsWith('prod-')).map(([id,widget])=>[id,widget.pendingSignature?.() || []]),
    pendingColorPhotos:productColorPhotos?.pendingSignature?.() || [],
    editorial: productEditorialData(),
    commercialDraft: productCommercialEditor?.get() || null,
    variantStock: [...document.querySelectorAll('#prod-variant-stock input')].map(input => input.value),
    variantStockEntries: productVariantStockBaseline?.entries.map((entry,index)=>({variant:entry.variant,stock:document.querySelectorAll('#prod-variant-stock input')[index]?.value ?? ''})) || [],
    badge: document.getElementById('prod-badge').value,
    collection: document.getElementById('prod-collection').value,
    active: document.getElementById('prod-active').checked,
    oferta: document.getElementById('prod-oferta').checked,
    destacado: document.getElementById('prod-destacado').checked,
  };
}

function beginProductWorkspace(key,source) {
  productWorkspace?.destroy();productWorkspace=null;
  if(typeof mountProductWorkspace!=='function'){UnsavedGuard.track(serializeProductForm,prodGuardar);return;}
  const ownerUid=currentUser.uid;
  const ids={priceBefore:'price-before',imageUrl:'imageUrl',colorFinish:'color-finish',waterResistance:'water-resistance',sizeFit:'size-fit',packageContents:'package-contents',imagesExtra:'images-extra',costUnit:'cost-unit',stockMinimum:'stock-minimum',internalNotes:'internal-notes',variants:'variants-text'};
  const restore=async snapshot=>{
    for(const [key,value] of Object.entries(snapshot)){
      const input=document.getElementById('prod-'+(ids[key] || key));
      if(!input || ['active','oferta','destacado'].includes(key))continue;
      if(typeof value==='string' || typeof value==='number')input.value=value;
    }
    for(const key of ['active','oferta','destacado'])document.getElementById('prod-'+key).checked=Boolean(snapshot[key]);
    if(snapshot.editorial){
      const values={...snapshot.editorial,publicationStatus:snapshot.editorial.publicationStatus || 'inactive'};
      const status=document.getElementById('prod-publicationStatus');
      if(values.publicationStatus==='inactive' && !status.querySelector('option[value=inactive]'))status.add(new Option('Inactivo (histórico)','inactive'));
      for(const [key,value] of Object.entries(values)){const input=document.getElementById('prod-'+key);if(input)input.value=value;}
    }
    let variants=source?.variants;
    try{variants=productVariantStockConfiguration(snapshot.variants || '').variants;}catch{}
    const virtual={...source,variants,imageUrl:snapshot.imageUrl || '',imagesExtra:String(snapshot.imagesExtra || '').split(/\n/).filter(Boolean),variantMedia:snapshot.variantMedia || []};
    if(snapshot.commercialDraft)renderProductVariantStock({...virtual,...snapshot.commercialDraft},{commercialBaseline:source || {}});
    else if(snapshot.variantStockEntries?.length){
      renderProductVariantStock({...virtual,variantInventory:snapshot.variantStockEntries.map(row=>({...row,stock:row.stock===''?0:Number(row.stock)}))});
      for(const [index,row] of snapshot.variantStockEntries.entries()){const input=document.querySelectorAll('#prod-variant-stock input')[index];if(input)input.value=row.stock;}
      if(productVariantStockBaseline){productVariantStockBaseline.stock=source?.stock;productVariantStockBaseline.expectedEntries=variantInventoryEntries(source || {});}
    }
    mountProductColorPhotos(virtual);
    document.getElementById('prod-form-card').dispatchEvent(new Event('change',{bubbles:true}));
  };
  productWorkspace=mountProductWorkspace({card:document.getElementById('prod-form-card'),uid:ownerUid,key,productId:source?key:null,source,privateAllowed:currentRole==='superadmin',serialize:serializeProductForm,restore,
    async request(body){
      const check=()=>{if(currentUser?.uid!==ownerUid)throw Object.assign(Error('La cuenta cambió. Reabrí el editor con la cuenta propietaria.'),{status:403});};
      check();const response=await authenticatedFetch('/api/admin-order-mutation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const payload=await readProductEditorResponse(response);check();return {...payload,status:response.status};
    },
    async flushMedia(){await productColorPhotos?.flush();await Promise.all(['prod-image-widget','prod-gallery-widget'].map(id=>_formImageWidgets.get(id)?.flush()));},
    commit:()=>prodGuardar({commit:true}),close:_prodCloseForm});
  UnsavedGuard.track(serializeProductForm,()=>productWorkspace.save());
}
window.prodContinuarBorrador=function(key,productId=null){
  UnsavedGuard.confirmLeave(()=>{if(productId){if(!_allProducts.some(row=>row._docId===productId)){toast('Esperá a que se cargue el producto original y reintentá.');return;}_prodEditarNow(productId);}else _prodNuevoNow(key);});
};

window.prodNuevo = function() {
  UnsavedGuard.confirmLeave(_prodNuevoNow);
};

function _prodNuevoNow(workKey=null) {
  productPrivateBaseline = null;
  pendingProductEditorSave = null;
  productEditorialForm({publicationStatus:'draft',active:false});
  renderProductStatistics('');
  productCommercialBaseline=null;
  productEditBaseline=null;
  renderProductVariantStock(null);
  document.getElementById('prod-inventory-fields').style.display = currentRole === 'superadmin' ? 'contents' : 'none';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-form-title').textContent = 'Nuevo producto';
  document.getElementById('prod-save-btn').textContent = 'Guardar producto';
  const sectionSelect = document.getElementById('prod-editor-section');
  if (sectionSelect) sectionSelect.value = 'all';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-sku').value = '';
  document.getElementById('prod-category').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-price-before').value = '';
  document.getElementById('prod-stock').value = '0';
  document.getElementById('prod-imageUrl').value = '';
  mountFormImageWidget('prod-image-widget', 'prod-imageUrl', {
    label: 'Imagen principal',
    hint: 'Se muestra en la grilla y la ficha del producto',
  });
  document.getElementById('prod-description').value = '';
  document.getElementById('prod-material').value = '';
  document.getElementById('prod-measurements').value = '';
  document.getElementById('prod-color-finish').value = '';
  document.getElementById('prod-care').value = '';
  document.getElementById('prod-water-resistance').value = '';
  document.getElementById('prod-warranty').value = '';
  document.getElementById('prod-size-fit').value = '';
  document.getElementById('prod-package-contents').value = '';
  document.getElementById('prod-images-extra').value = '';
  document.getElementById('prod-cost-unit').value = '';
  document.getElementById('prod-purchased').value = '';
  document.getElementById('prod-stock-minimum').value = '';
  document.getElementById('prod-internal-notes').value = '';
  document.getElementById('prod-tags').value = '';
  document.getElementById('prod-variants-text').value = '';
  mountProductColorPhotos({});
  document.getElementById('prod-badge').value = '';
  document.getElementById('prod-collection').value = '';
  document.getElementById('prod-active').checked = false;
  document.getElementById('prod-oferta').checked = false;
  document.getElementById('prod-destacado').checked = false;
  document.getElementById('prod-form-error').style.display = 'none';
  document.getElementById('prod-list-card').style.display = 'none';
  document.getElementById('prod-form-card').style.display = '';
  beginProductWorkspace(typeof workKey==='string'?workKey:crypto.randomUUID(),null);
}

window.prodEditar = function(docId) {
  UnsavedGuard.confirmLeave(() => _prodEditarNow(docId));
};

function _prodEditarNow(docId, duplicate=false) {
  const source = _allProducts.find(x => x._docId === docId);
  if (!source) return;
  const p=duplicate ? productDuplicateData(source) : source;
  const stored = _productSourceById.get(docId) || source;
  productEditBaseline=duplicate ? null : productFingerprint(stored);
  const inventory = duplicate ? {} : _productInventoryById.get(docId) || {};
  pendingProductEditorSave = null;
  productEditorialForm(p);
  renderProductStatistics(duplicate?'':docId);
  productPrivateBaseline = Object.fromEntries(['costUnit','purchased','stockMinimum','internalNotes'].map(key=>[key,inventory[key] ?? (key==='internalNotes'?'':null)]));
  document.getElementById('prod-inventory-fields').style.display = currentRole === 'superadmin' ? 'contents' : 'none';
  document.getElementById('prod-id').value = duplicate ? '' : docId;
  document.getElementById('prod-form-title').textContent = duplicate ? 'Duplicar producto · copia inactiva y sin stock' : 'Editar producto';
  document.getElementById('prod-save-btn').textContent = duplicate ? 'Guardar producto' : 'Guardar cambios';
  const sectionSelect = document.getElementById('prod-editor-section');
  if (sectionSelect) sectionSelect.value = 'all';
  document.getElementById('prod-name').value = p.name || '';
  document.getElementById('prod-sku').value = p.sku || '';
  document.getElementById('prod-category').value = p.category || '';
  document.getElementById('prod-price').value = p.price || '';
  document.getElementById('prod-price-before').value = p.priceBefore || '';
  document.getElementById('prod-stock').value = p.stock ?? '';
  document.getElementById('prod-imageUrl').value = sanitizeImageUrl(p.imageUrl || p.image || '');
  mountFormImageWidget('prod-image-widget', 'prod-imageUrl', {
    // Si imageUrl no es texto (dato corrupto/legado), el widget asume que
    // sí lo es y llama src.replace(...) sobre el valor crudo — eso rompía
    // el formulario entero al abrir justo ese producto. sanitizeImageUrl
    // siempre devuelve un string (vacío si no es una URL válida).
    value: sanitizeImageUrl(p.imageUrl || p.image || ''),
    label: 'Imagen principal',
    hint: 'Se muestra en la grilla y la ficha del producto',
  });
  document.getElementById('prod-description').value = p.description || '';
  document.getElementById('prod-material').value = p.material || '';
  document.getElementById('prod-measurements').value = p.measurements || '';
  document.getElementById('prod-color-finish').value = p.colorFinish || '';
  document.getElementById('prod-care').value = p.care || '';
  document.getElementById('prod-water-resistance').value = p.waterResistance || '';
  document.getElementById('prod-warranty').value = p.warranty || '';
  document.getElementById('prod-size-fit').value = p.sizeFit || '';
  document.getElementById('prod-package-contents').value = p.packageContents || '';
  document.getElementById('prod-images-extra').value = Array.isArray(p.imagesExtra) ? p.imagesExtra.join('\n') : '';
  document.getElementById('prod-cost-unit').value = inventory.costUnit ?? '';
  document.getElementById('prod-purchased').value = inventory.purchased ?? '';
  document.getElementById('prod-stock-minimum').value = inventory.stockMinimum ?? '';
  document.getElementById('prod-internal-notes').value = inventory.internalNotes || '';
  document.getElementById('prod-badge').value = p.badge || '';
  document.getElementById('prod-collection').value = p.collection || '';
  document.getElementById('prod-tags').value = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
  // Variants: convert object/array to readable text
  let variantsText = '';
  if (p.variants) {
    if (Array.isArray(p.variants)) {
      // Una entrada nula o no-objeto en el array (dato corrupto/legado)
      // tiraba Object.entries(null) y rompía el formulario entero al abrir
      // ese producto puntual — se filtra antes de leer sus entries.
      variantsText = p.variants
        .filter(v => v && typeof v === 'object')
        .flatMap(v => Object.entries(v).filter(([k]) => !['price', 'sku', 'imageUrl', 'imageUrls', 'stock', 'active', 'colorHex', 'swatch'].includes(k)).map(([k,val]) => `${k}: ${val}`))
        .join('\n');
    } else if (typeof p.variants === 'object') {
      variantsText = Object.entries(p.variants).flatMap(([k, vals]) => Array.isArray(vals) ? vals.map(v => `${k}: ${v}`) : [`${k}: ${vals}`]).join('\n');
    }
  }
  document.getElementById('prod-variants-text').value = variantsText;
  renderProductVariantStock(p,duplicate?{commercialBaseline:{}}:null);
  // El inventario por opción bloquea editar las opciones: conservar su representación original.
  if (!duplicate && productVariantStockBaseline) productVariantStockBaseline.variants = stored.variants;
  mountProductColorPhotos(p);
  document.getElementById('prod-active').checked = p.active !== false;
  document.getElementById('prod-oferta').checked = !!p.oferta;
  document.getElementById('prod-destacado').checked = !!p.destacado;
  document.getElementById('prod-form-error').style.display = 'none';
  document.getElementById('prod-list-card').style.display = 'none';
  document.getElementById('prod-form-card').style.display = '';
  productCommercialBaseline = duplicate ? null : JSON.parse(JSON.stringify(serializeProductForm()));
  beginProductWorkspace(duplicate?crypto.randomUUID():docId,duplicate?null:stored);
}

function _prodCloseForm() {
  productWorkspace?.destroy();productWorkspace=null;UnsavedGuard.clear();
  document.getElementById('prod-form-card').style.display = 'none';
  document.getElementById('prod-list-card').style.display = '';
}
window.prodCancelForm = function() {
  if(productWorkspace){void productWorkspace.leave();return;}
  UnsavedGuard.confirmLeave(_prodCloseForm);
};

async function prodGuardar({commit=false}={}) {
  const errorBox=document.getElementById('prod-form-error');if(errorBox?.dataset)delete errorBox.dataset.errorScope;
  const invalidMoney=Array.from(document.querySelectorAll('#prod-form-card [data-money-for]')).find(input=>input.validity?.valid===false);
  if(invalidMoney){errorBox.textContent='Revisá el importe: usá números enteros en guaraníes.';errorBox.style.display='';if(errorBox.dataset){errorBox.dataset.editorField=invalidMoney.id;errorBox.dataset.stepValidation='true';}invalidMoney.reportValidity();return false;}
  if(productWorkspace && !commit){
    const workspace=productWorkspace;
    const box=document.getElementById('prod-form-error');box.textContent='';box.style.display='none';
    try{return await workspace.publish();}
    catch(error){if(productWorkspace===workspace)workspace.reportError(error);return false;}
  }
  const existingProduct = _allProducts.find(product => product._docId === document.getElementById('prod-id').value);
  if(existingProduct?.variantCommerceVersion===2 && !productCommercialEditor){const error=document.getElementById('prod-form-error');error.textContent='Este producto requiere el editor compatible.';error.style.display='';return false;}
  if (document.getElementById('prod-save-btn')?.disabled) return false;
  const errEl = document.getElementById('prod-form-error');
  // El ID se reserva antes del transporte para reintentos idempotentes. Tener
  // ese ID no convierte un alta fallida en una edición que exija otro permiso.
  const _isEdit = productEditBaseline != null;
  const _permOk = _isEdit
    ? (can(currentRole, 'editProducts') && roleCanDo('productos', 'editar'))
    : (can(currentRole, 'addProducts') && roleCanDo('productos', 'crear'));
  if (!_permOk) {
    errEl.textContent = _isEdit ? 'No tenés permiso para editar productos.' : 'No tenés permiso para crear productos.';
    errEl.style.display = '';
    return false;
  }
  // Recortado a 180 y forzado a número desde acá (no solo en checkout/
  // importador) para que un producto cargado a mano nunca choque con la
  // igualdad exacta que exige sparkItemValid() en firestore.rules.
  const name = document.getElementById('prod-name').value.trim().slice(0, 180);
  const category = document.getElementById('prod-category').value;
  const price = Number(document.getElementById('prod-price').value);
  const stockRaw = document.getElementById('prod-stock').value.trim();
  const stockValue = stockRaw === '' ? null : Number(stockRaw);
  const priceBeforeRaw = document.getElementById('prod-price-before').value.trim();
  const priceBeforeValue = priceBeforeRaw === '' ? null : Number(priceBeforeRaw);
  const categoryExists = _allCollections.some(collection => wristCategory(collection.slug) === wristCategory(category));

  if (!name || !category || !categoryExists || !Number.isInteger(price) || price <= 0 || price > 1000000000) {
    errEl.textContent = !categoryExists && category
      ? 'La colección elegida ya no existe. Actualizá la lista y seleccioná otra.'
      : 'Nombre, colección y un precio entero mayor a cero son obligatorios.';
    errEl.style.display = '';
    return false;
  }
  if (stockValue != null && (!Number.isInteger(stockValue) || stockValue < 0 || stockValue > 1000000)) {
    errEl.textContent = 'El stock debe ser un número entero entre 0 y 1.000.000, o quedar vacío si no se controla.';
    errEl.style.display = '';
    return false;
  }
  if (priceBeforeValue != null && (!Number.isInteger(priceBeforeValue) || priceBeforeValue <= price || priceBeforeValue > 1000000000)) {
    errEl.textContent = 'El precio anterior debe ser un entero mayor al precio actual, o quedar vacío.';
    errEl.style.display = '';
    return false;
  }
  errEl.style.display = 'none';

  const btn = document.getElementById('prod-save-btn');
  btn.textContent = 'Guardando…'; btn.disabled = true;

  try {
    // La vista previa local no es una URL persistida. Completar todas las
    // cargas antes de construir el payload evita guardar sin la foto elegida.
    await productColorPhotos?.flush();
    await Promise.all(['prod-image-widget', 'prod-gallery-widget'].map(id => _formImageWidgets.get(id)?.flush()));
    if (document.getElementById('prod-publicationStatus')?.value === 'active') {
      if (!document.getElementById('prod-description').value.trim()) throw new Error('Completá la descripción para publicar el producto.');
      if (!document.getElementById('prod-imageUrl').value.trim()) throw new Error('Elegí una foto principal para publicar el producto.');
    }
  } catch (error) {
    errEl.textContent = 'No se guardó el producto: ' + (error?.message || 'No se pudo subir la imagen.');
    errEl.style.display = '';
    btn.textContent = _isEdit ? 'Guardar cambios' : 'Guardar producto'; btn.disabled = false;
    return false;
  }

  // Parse variants from text: "Color: Rojo\nColor: Dorado" → {Color: ['Rojo','Dorado']}
  const variantsRaw = document.getElementById('prod-variants-text').value.trim();
  let variantsParsed = null;
  if (variantsRaw) {
    const vObj = {};
    variantsRaw.split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return;
      const key = line.slice(0, idx).trim();
      const values = line.slice(idx + 1).split(',').map(value => value.trim()).filter(Boolean);
      if (!key || !values.length || key.length > 60) return;
      if (!vObj[key]) vObj[key] = [];
      values.forEach(value => {
        const safeValue = value.slice(0, 120);
        if (safeValue && !vObj[key].includes(safeValue) && vObj[key].length < 50) vObj[key].push(safeValue);
      });
    });
    if (Object.keys(vObj).length > 20) {
      errEl.textContent = 'Un producto puede tener hasta 20 grupos de variantes.';
      errEl.style.display = '';
      btn.textContent = _isEdit ? 'Guardar cambios' : 'Guardar producto'; btn.disabled = false;
      return false;
    }
    if (Object.keys(vObj).length) {
      variantsParsed = vObj;
      document.getElementById('prod-variants-text').value = Object.entries(vObj)
        .flatMap(([key, values]) => values.map(value => `${key}: ${value}`)).join('\n');
    }
  }

  const tagsRaw = document.getElementById('prod-tags').value.trim();
  const tags = [...new Set(tagsRaw ? tagsRaw.split(',').map(tag => tag.trim().slice(0, 60)).filter(Boolean) : [])].slice(0, 30);
  document.getElementById('prod-tags').value = tags.join(', ');
  const badge = document.getElementById('prod-badge').value || null;

  const collection_ = document.getElementById('prod-collection').value.trim() || null;
  const imagesExtra = [...new Set(document.getElementById('prod-images-extra').value
    .split(/\r?\n/).map(value => sanitizeImageUrl(value.trim())).filter(Boolean))].slice(0, 12);
  const optionalInteger = id => {
    const raw = document.getElementById(id).value.trim();
    return raw === '' ? null : Number(raw);
  };
  const inventoryData = {
    costUnit: optionalInteger('prod-cost-unit'),
    purchased: optionalInteger('prod-purchased'),
    stockMinimum: optionalInteger('prod-stock-minimum'),
    internalNotes: document.getElementById('prod-internal-notes').value.trim().slice(0, 1000),
    updatedAt: serverTimestamp(),
  };
  if ([inventoryData.costUnit, inventoryData.purchased, inventoryData.stockMinimum]
    .some(value => value != null && (!Number.isInteger(value) || value < 0 || value > 1000000000))) {
    errEl.textContent = 'Costo, cantidad comprada y stock mínimo deben ser enteros positivos o quedar vacíos.';
    errEl.style.display = '';
    btn.textContent = _isEdit ? 'Guardar cambios' : 'Guardar producto'; btn.disabled = false;
    return false;
  }

  const data = {
    name,
    sku: document.getElementById('prod-sku').value.trim().slice(0,80),
    category,
    collection: collection_,
    price,
    priceBefore: priceBeforeValue,
    // Vacío = stock no controlado/ilimitado (el storefront ya lo trata así,
    // ver tienda.js) — no lo confundimos con "0" (agotado de verdad), que
    // solo se guarda si la vendedora lo escribe a propósito.
    stock: stockValue,
    imageUrl: document.getElementById('prod-imageUrl').value.trim() || null,
    description: document.getElementById('prod-description').value.trim() || '',
    material: document.getElementById('prod-material').value.trim().slice(0, 240),
    measurements: document.getElementById('prod-measurements').value.trim().slice(0, 240),
    colorFinish: document.getElementById('prod-color-finish').value.trim().slice(0, 240),
    care: document.getElementById('prod-care').value.trim().slice(0, 500),
    waterResistance: document.getElementById('prod-water-resistance').value.trim().slice(0, 240),
    warranty: document.getElementById('prod-warranty').value.trim().slice(0, 240),
    sizeFit: document.getElementById('prod-size-fit').value.trim().slice(0, 240),
    packageContents: document.getElementById('prod-package-contents').value.trim().slice(0, 500),
    imagesExtra,
    variantMedia: productColorPhotos?.serialize() || [],
    tags,
    badge,
    active: document.getElementById('prod-active').checked,
    oferta: document.getElementById('prod-oferta').checked,
    destacado: document.getElementById('prod-destacado').checked,
    ...(variantsParsed ? { variants: variantsParsed } : (_isEdit ? { variants: deleteField() } : {})),
    updatedAt: serverTimestamp(),
  };

  // Comparar contra la misma vista normalizada que se abrió, no contra campos
  // opcionales ausentes en documentos legados. La activación que acompaña una
  // cantidad positiva es parte de la reposición, no una edición comercial.
  if (_isEdit) {
    const current = serializeProductForm(), before = productCommercialBaseline;
    const comparable = ['name','sku','category','collection','price','priceBefore','imageUrl','description',
      'material','measurements','colorFinish','care','waterResistance','warranty','sizeFit',
      'packageContents','imagesExtra','variantMedia','tags','badge','active','oferta','destacado','variants','editorial'];
    const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
    const stockChanged = before && (!equal(current.stock,before.stock) || !equal(current.variantStock,before.variantStock));
    const stockOnly = before && stockChanged && comparable.every(key =>
      (key === 'active' && stockChanged && current.stock !== '' && current.active === (Number(current.stock) > 0))
      || equal(current[key],before[key]));
    if (stockOnly) data.restockedAt = serverTimestamp();
    else data.merchandisingUpdatedAt = serverTimestamp();
  } else {
    data.merchandisingUpdatedAt = serverTimestamp();
  }

  try {
  Object.assign(data, productEditorialData());
  if(!productCommercialEditor && existingProduct && Object.hasOwn(existingProduct,'image'))data.image=data.imageUrl;
  if (productCommercialEditor) Object.assign(data, productCommercialEditor.patch(data));
  if (productVariantStockBaseline) {
        const original = productVariantStockBaseline;
        const inputs = [...document.querySelectorAll('#prod-variant-stock input')];
        const entries = original.entries.map((entry, index) => ({ variant: entry.variant, stock: inputs[index]?.value === '' ? NaN : Number(inputs[index]?.value) }));
        data.variantInventory = variantInventoryEntries({ variantInventory: entries });
        data.stock = entries.reduce((sum, entry) => sum + entry.stock, 0);
        if (data.stock > 1000000) throw new Error('El stock total supera 1.000.000.');
        if (original.variants === undefined) delete data.variants;
        else data.variants = original.variants;
  }
    const operation = await runAdminCrudOperation({
      title: _isEdit ? 'Actualizar producto' : 'Crear producto',
      name, module: 'productos',
      stages: [{ id: 'save', label: 'Guardar producto, inventario y sincronización' }],
      action: async ctx => {
        ctx.start('save');
    const docId = document.getElementById('prod-id').value;
    if (productCommercialEditor || productWorkspace) {
      const targetId=docId || productWorkspace?.key || doc(collection(db,'products')).id;
      if(productWorkspace && !productCommercialEditor){
        if(productCommercialBaseline && serializeProductForm().variants===productCommercialBaseline.variants){
          if(existingProduct?.variants!==undefined)data.variants=existingProduct.variants;else delete data.variants;
        }else if(!variantsParsed)data.variants=null;
      }
      const privateData=Object.fromEntries(['costUnit','purchased','stockMinimum','internalNotes'].map(key=>[key,inventoryData[key]]));
      const request={action:'saveProduct',productId:targetId,expected:productEditBaseline,restockOnly:Boolean(data.restockedAt),product:Object.fromEntries(Object.entries(data).filter(([key])=>!['image','updatedAt','merchandisingUpdatedAt','restockedAt'].includes(key))),...(productWorkspace?{workspace:productWorkspace.reference}:{}),...(currentRole==='superadmin'?{inventory:privateData,expectedInventory:productPrivateBaseline}: {})};
      const signature=JSON.stringify(request);
      if(pendingProductEditorSave?.signature!==signature)pendingProductEditorSave={signature,changeId:crypto.randomUUID()};
      document.getElementById('prod-id').value=targetId;
      const response=await authenticatedFetch('/api/admin-order-mutation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,changeId:pendingProductEditorSave.changeId}),signal:AbortSignal.timeout(30000)});
      const payload=await readProductEditorResponse(response);
      if(!response.ok || !payload.ok)throw new Error(payload.error || 'No se pudo guardar el producto.');
      document.getElementById('prod-id').value=targetId;
      productEditBaseline=productFingerprint(payload.result.product);
      productPrivateBaseline=privateData;
      await pushProductsToSheets([targetId]);
    } else if (docId) {
      const oldProd = _allProducts.find(p => p._docId === docId);
      let savedProduct;
      if (productVariantStockBaseline) {
        const original=productVariantStockBaseline;
        await withAdminSiteChange(async () => runTransaction(db, async transaction => {
          const ref = doc(db, 'products', docId);
          const snapshot = await transaction.get(ref);
          const current = snapshot.data();
          if(productEditBaseline && productFingerprint(current)!==productEditBaseline) throw new Error('El producto cambió en otra sesión. Volvé a abrirlo antes de guardar.');
          if (!snapshot.exists() || current.stock !== original.stock || JSON.stringify(variantInventoryEntries(current)) !== JSON.stringify(original.expectedEntries)) {
            throw new Error('El stock o las opciones cambiaron mientras editabas. Volvé a abrir el producto antes de guardar.');
          }
          transaction.update(ref, data);
          savedProduct={...current,...data};
        }));
      } else {
        await withAdminSiteChange(async () => runTransaction(db,async transaction=>{
          const ref=doc(db,'products',docId),snapshot=await transaction.get(ref);
          if(!snapshot.exists() || (productEditBaseline && productFingerprint(snapshot.data())!==productEditBaseline)) throw new Error('El producto cambió o fue eliminado. Volvé a abrirlo antes de guardar.');
          transaction.update(ref,data);
          savedProduct={...snapshot.data(),...data,variants:variantsParsed || undefined};
        }));
      }
      productEditBaseline=productFingerprint(savedProduct);
      productCommercialBaseline=JSON.parse(JSON.stringify(serializeProductForm()));
      if(productVariantStockBaseline) productVariantStockBaseline={stock:data.stock,expectedEntries:variantInventoryEntries(data),entries:variantInventoryEntries(data),variants:data.variants};
      if (currentRole === 'superadmin') {
        await withAdminSiteChange(async () => setDoc(doc(db, 'productInventory', docId), inventoryData, { merge: true }));
      }
      await pushProductsToSheets([docId]);
      const changes = [];
      const productHistory = {
        productId: docId,
        priceBefore: oldProd?.price ?? null,
        priceAfter: data.price ?? null,
        stockBefore: oldProd?.stock ?? null,
        stockAfter: data.stock ?? null,
      };
      if (oldProd) {
        // Comparación directa (no Number(x || 0)): stock null (ilimitado) y
        // stock 0 (agotado de verdad) son estados distintos a propósito en
        // todo el resto del código — convertir ambos a 0 antes de comparar
        // ocultaba justo ese cambio del historial de auditoría.
        const oldStock = oldProd.stock ?? null;
        const newStock = data.stock ?? null;
        if (oldStock !== newStock) {
          changes.push(`Stock: ${oldStock ?? 'ilimitado'} → ${newStock ?? 'ilimitado'}`);
        }
      }
      if (oldProd && Number(oldProd.price || 0) !== Number(data.price || 0)) {
        changes.push(`Precio: ${oldProd.price ?? 0} → ${data.price}`);
      }
      if (oldProd && (oldProd.active !== false) !== data.active) {
        changes.push(`Activo: ${oldProd.active !== false} → ${data.active}`);
      }
      await logAudit('editar_producto', 'producto', docId, name, changes.join(' · ') || 'Datos actualizados', { productHistory });
    } else {
      data.createdAt = serverTimestamp();
      const newRef = doc(collection(db, 'products'));
      await withAdminSiteChange(async () => setDoc(newRef, data));
      // Si falla una etapa posterior (inventario o Sheets), el formulario
      // conserva el ID ya creado y reintenta como edición, sin duplicar.
      document.getElementById('prod-id').value = newRef.id;
      productEditBaseline=productFingerprint(data);
      productCommercialBaseline=JSON.parse(JSON.stringify(serializeProductForm()));
      if(productVariantStockBaseline) productVariantStockBaseline={stock:data.stock,expectedEntries:variantInventoryEntries(data),entries:variantInventoryEntries(data),variants:data.variants};
      if (currentRole === 'superadmin') {
        await withAdminSiteChange(async () => setDoc(doc(db, 'productInventory', newRef.id), inventoryData, { merge: true }));
      }
      await pushProductsToSheets([newRef.id]);
      await logAudit('crear_producto', 'producto', newRef.id, name, `Precio: ${data.price} · Stock: ${data.stock}`);
    }
    UnsavedGuard.clear();
    _prodCloseForm();
    loadProductos();
        ctx.ok('save');
        return true;
      },
    });
    if (operation.status !== 'green') {
      if(errEl.dataset)errEl.dataset.errorScope='operation';
      errEl.textContent = 'No se pudo completar el guardado. Revisá el detalle de la operación y volvé a intentar.';
      errEl.style.display = '';
      return false;
    }
    return true;
  } catch(e) {
    errEl.textContent = 'Error al guardar: ' + e.message;
    errEl.style.display = '';
    return false;
  } finally {
    btn.textContent = _isEdit ? 'Guardar cambios' : 'Guardar producto'; btn.disabled = false;
  }
}

window.prodToggleActive = async (docId, currentlyActive) => {
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'activarDesactivar')) { toast('No tenés permiso para activar/desactivar productos'); return; }
  const p = _allProducts.find(x => x._docId === docId);
  return runAdminCrudOperation({
    title: currentlyActive ? 'Desactivar producto' : 'Activar producto', name: p?.name || docId, module: 'productos',
    stages: [{ id: 'write', label: 'Actualizar estado del producto' }, { id: 'sync', label: 'Sincronizar catálogo y actualizar lista' }],
    action: async ctx => {
      ctx.start('write');
      await withAdminSiteChange(async () => updateDoc(doc(db, 'products', docId), { active: !currentlyActive, updatedAt: serverTimestamp() }));
      if (p) p.active = !currentlyActive;
      await logAudit('editar_producto', 'producto', docId, p?.name || docId, `Activo: ${currentlyActive} → ${!currentlyActive}`);
      ctx.ok('write');
      ctx.start('sync');
      await pushProductsToSheets([docId]);
      renderProductosTable(_allProducts);
      ctx.ok('sync');
      return currentlyActive ? 'Producto desactivado.' : 'Producto activado.';
    },
  });
};

async function prodEliminar(docId, name) {
  if (!can(currentRole, 'deleteProducts') || !roleCanDo('productos', 'eliminar')) { toast('No tenés permiso para eliminar productos'); return; }
  if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
  await runAdminCrudOperation({
    title: 'Eliminar producto', name, module: 'productos', dangerous: true,
    stages: [
      { id: 'delete', label: 'Eliminar producto e inventario' },
      { id: 'sync', label: 'Sincronizar catálogo' },
      { id: 'refresh', label: 'Actualizar lista' },
    ],
    action: async ctx => {
      ctx.start('delete');
      await withAdminSiteChange(async () => deleteDoc(doc(db, 'products', docId)));
      await withAdminSiteChange(async () => deleteDoc(doc(db, 'productInventory', docId)));
      ctx.ok('delete');
      ctx.start('sync');
      await pushProductsToSheets([docId]);
      await logAudit('eliminar_producto', 'producto', docId, name, 'Producto eliminado');
      ctx.ok('sync');
      ctx.start('refresh');
      loadProductos();
      ctx.ok('refresh');
      return 'Producto eliminado y catálogo actualizado.';
    },
  });
}
// Fix (Fase 2): estaban declaradas solo en el scope del módulo, pero el HTML
// las llama desde onclick="..." inline — eso solo puede resolver identificadores
// en window, así que sin esto, "Guardar producto" y "Eliminar" tiraban
// "ReferenceError: ... is not defined" y no hacían nada (bug preexistente,
// encontrado al conectar el registro de auditoría de productos de esta fase).
window.prodDuplicar = function(docId) {
  if(!can(currentRole,'addProducts') || !roleCanDo('productos','crear')) {toast('No tenés permiso para crear productos.');return;}
  UnsavedGuard.confirmLeave(()=>_prodEditarNow(docId,true));
};

window.TintinProductAdmin = Object.freeze({
  async updateCard(request) {
    if (!auth.currentUser || !currentUser || auth.currentUser.uid !== currentUser.uid || navigator.onLine === false) throw new Error('La sesión o la conexión no están disponibles.');
    if (!can(currentRole, 'editProducts') || !roleCanDo('productos', request.field === 'active' ? 'activarDesactivar' : 'editar')) throw new Error('No tenés permiso para modificar este producto.');
    if (productMasterBusy) throw new Error('Ya hay una operación de productos en curso.');
    productBulkIds([request.id]);
    if (request.field === 'category') productBulkIds([request.value]);
    const ownerUid = auth.currentUser.uid;
    const product = _allProducts.find(item => item._docId === request.id);
    productMasterBusy = true;
    try {
      return await runAdminCrudOperation({
        title: 'Actualizar producto', name: product?.name || request.id, module: 'productos',
        stages: [{id:'save', label:'Confirmar el cambio en el catálogo'}, {id:'sync', label:'Actualizar las vistas conectadas'}],
        action: async ctx => {
          ctx.start('save');
          let before, patch;
          await withAdminSiteChange(() => runTransaction(db, async transaction => {
            if (auth.currentUser?.uid !== ownerUid) throw new Error('La sesión cambió. Volvé a abrir el panel.');
            let collections = [];
            if (request.field === 'category') {
              const collection = await transaction.get(doc(db, 'collections', request.value));
              if (!collection.exists()) throw new Error('La colección ya no existe. Actualizá antes de asignarla.');
              collections = [{slug:request.value}];
            }
            const ref = doc(db, 'products', request.id), snapshot = await transaction.get(ref);
            if (auth.currentUser?.uid !== ownerUid) throw new Error('La sesión cambió. Volvé a abrir el panel.');
            if (!snapshot.exists() || productFingerprint(snapshot.data()) !== request.expected) throw new Error('El producto cambió en otra sesión. Revisá sus cantidades antes de guardar.');
            before = snapshot.data();
            patch = productCardPatch(before, request, collections);
            transaction.update(ref, {...patch, updatedAt:serverTimestamp(),
              ...(request.field === 'stock' ? { restockedAt:serverTimestamp() } : { merchandisingUpdatedAt:serverTimestamp() })});
          }));
          if (product) Object.assign(product, patch);
          ctx.ok('save');
          ctx.start('sync');
          applyProductFilters();
          // La escritura confirmada actualiza los listeners. Sheets conserva
          // su respaldo durable y no bloquea el cierre de la ventana.
          void pushProductsToSheets([request.id]).catch(error => console.warn('[products] Sincronización pendiente:', error?.code || 'unavailable'));
          await logAudit('editar_producto', 'producto', request.id, product?.name || request.id, `Tarjeta: ${request.field}${request.variant ? ` / ${request.variant}` : ''}`, {productHistory:[{productId:request.id,stockBefore:before.stock ?? null,stockAfter:patch.stock ?? before.stock ?? null}]}).catch(error => console.warn('[products] Auditoría pendiente:', error?.code || 'unavailable'));
          ctx.ok('sync');
          return {confirmed:true, fingerprint:productFingerprint({...before,...patch})};
        },
      });
    } finally { productMasterBusy = false; }
  },
  async updateCollectionVisibility(request) {
    if (!auth.currentUser || !currentUser || auth.currentUser.uid !== currentUser.uid || navigator.onLine === false) throw new Error('La sesión o la conexión no están disponibles.');
    if (!can(currentRole,'manageContent') || !roleCanDo('colecciones','activarDesactivar')) throw new Error('No tenés permiso para modificar esta colección.');
    productBulkIds([request.id]);
    if (typeof request.visible !== 'boolean' || typeof request.expectedVisible !== 'boolean') throw new Error('Estado de colección no válido.');
    if (productMasterBusy) throw new Error('Ya hay una operación de catálogo en curso.');
    const ownerUid = auth.currentUser.uid;
    productMasterBusy = true;
    try {
      return await runAdminCrudOperation({title:'Actualizar colección',name:request.id,module:'colecciones',
        stages:[{id:'save',label:'Confirmar la visibilidad'},{id:'sync',label:'Actualizar las vistas conectadas'}],
        action:async ctx=>{
          ctx.start('save');
          await withAdminSiteChange(()=>runTransaction(db,async transaction=>{
            const ref=doc(db,'collections',request.id),snapshot=await transaction.get(ref);
            if (auth.currentUser?.uid !== ownerUid) throw new Error('La sesión cambió. Volvé a abrir el panel.');
            if (!snapshot.exists() || (snapshot.data().visible !== false) !== request.expectedVisible) throw new Error('La colección cambió en otra sesión. Actualizá antes de guardar.');
            transaction.update(ref,{visible:request.visible,updatedAt:serverTimestamp()});
          }));
          ctx.ok('save');ctx.start('sync');
          const collection=_allCollections.find(item=>item.slug===request.id);
          if(collection)collection.visible=request.visible;
          renderColeccionesGrid(applyCollFilter(_allCollections));
          await logAudit('editar_coleccion','coleccion',request.id,collection?.name || request.id,request.visible?'Colección activada':'Colección desactivada').catch(error=>console.warn('[collections] Auditoría pendiente:',error?.code || 'unavailable'));
          ctx.ok('sync');return {confirmed:true};
        }
      });
    } finally {productMasterBusy=false;}
  },
  async applyBulkChanges(request) {
    if(!auth.currentUser || !currentUser || navigator.onLine===false)throw new Error('La sesión o la conexión no están disponibles.');
    if(productMasterBusy) throw new Error('Ya hay una operación de productos en curso.');
    if(!can(currentRole,'editProducts') || !roleCanDo('productos','accionesMasivas') || !roleCanDo('productos',request.field==='active'?'activarDesactivar':'editar')) throw new Error('No tenés permiso para esta edición masiva.');
    const ids=productBulkIds(request.ids);
    productMasterBusy=true;
    try {
      const hasCommercial=ids.some(id=>_allProducts.find(product=>product._docId===id)?.variantCommerceVersion===2);
      const changes=hasCommercial ? await (async()=>{
        const response=await authenticatedFetch('/api/admin-order-mutation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,action:'bulkProducts'})});
        const payload=await response.json();if(!response.ok || !payload.ok)throw new Error(payload.error || 'No se pudo guardar la edición masiva.');return payload.result.changes;
      })() : await withAdminSiteChange(()=>runTransaction(db,async transaction=>{
        let collections=_allCollections;
        if(request.field==='category'){
          const categorySnapshot=await transaction.get(doc(db,'collections',String(request.value)));
          if(!categorySnapshot.exists())throw new Error('La colección ya no existe. Actualizá antes de asignarla.');
          collections=[{slug:String(request.value)}];
        }
        return applyProductBulkTransaction(transaction,request,collections,id=>doc(db,'products',id),serverTimestamp);
      }));
      for(const change of changes){const product=_allProducts.find(p=>p._docId===change.id);if(product)Object.assign(product,change.patch);}
      let auditPending=false;
      try {if(!hasCommercial)await logAudit('editar_producto','producto','','',`Edición masiva: ${request.field}`,{bulk:true,count:ids.length,productHistory:changes.map(({id,before,patch})=>({productId:id,priceBefore:before.price ?? null,priceAfter:patch.price ?? before.price ?? null,stockBefore:before.stock ?? null,stockAfter:Object.hasOwn(patch,'stock')?patch.stock:before.stock ?? null}))});}catch(error){auditPending=true;console.warn('[products] Auditoría pendiente:',error?.message);}
      // La confirmación de Firestore no se revierte si Sheets está temporalmente fuera de servicio.
      let syncPending=false;
      try {await pushProductsToSheets(ids);}catch(error){syncPending=true;console.warn('[products] Sincronización externa pendiente:',error?.message);}
      applyProductFilters();
      return {confirmed:true,ids,syncPending,auditPending};
    } finally {productMasterBusy=false;}
  }
});

window.prodGuardar = prodGuardar;
window.prodEliminar = prodEliminar;

// Load products when section is shown
document.querySelectorAll('[data-section="productos"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!_allProducts.length) loadProductos();
  });
});

/* =============================================
   COLECCIONES — CRUD (real-time, synced to public site)
   ============================================= */
let _allCollections = [];
let _collectionsUnsub = null;

function collectionDocumentSlugs(slug) {
  return _allCollections.find(item => item.slug === slug)?.sourceSlugs || [slug];
}

async function deleteCollectionDocuments(slug) {
  const batch = writeBatch(db);
  collectionDocumentSlugs(slug).forEach(id => batch.delete(doc(db, 'collections', id)));
  await withAdminSiteChange(async () => batch.commit());
}

function collSlugify(s) {
  return (wristCategory(s) || '')
    .toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// No orderBy() in the query itself: a doc missing the `order` field would
// silently drop out of an orderBy('order') query in Firestore — every
// collection doc is fetched unconditionally, then sorted client-side
// (normalizeCollectionDoc gives every doc a safe default order).
let _collectionsSlowTimer = null;
let _collectionsReady = false;
function loadColecciones() {
  document.getElementById('coll-loading').style.display = '';
  document.getElementById('coll-loading').innerHTML = 'Cargando colecciones…';
  document.getElementById('coll-grid-wrap').style.display = 'none';
  document.getElementById('coll-empty').style.display = 'none';
  if (_collectionsUnsub) { renderColeccionesGrid(applyCollFilter(_allCollections)); return; }
  _collectionsReady = false;
  clearTimeout(_collectionsSlowTimer);
  _collectionsSlowTimer = setTimeout(() => {
    if (_collectionsReady) return;
    document.getElementById('coll-loading').innerHTML =
      'La carga de colecciones está tardando más de lo esperado. Verificá tu conexión. ' +
      '<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="reintentarCargaColecciones()">Reintentar</button>';
  }, 12000);
  // Páginas limitadas también para Super Admin; el conjunto se publica completo.
  _collectionsUnsub = subscribeAdminCollectionPages('collections', 200,
    records => {
      clearTimeout(_collectionsSlowTimer);
      _collectionsReady = true;
      _allCollections = unifyWristCollections(records
        .map(({ id, record }) => normalizeCollectionDoc(id, record)), false)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
      renderColeccionesGrid(applyCollFilter(_allCollections));
      syncCategorySelects();
      renderGeneralStatistics();
    },
    e => {
      clearTimeout(_collectionsSlowTimer);
      _collectionsReady = false;
      document.getElementById('coll-loading').innerHTML =
        'Error al cargar colecciones: ' + escapeHtmlAdmin(e.message) + ' ' +
        '<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="reintentarCargaColecciones()">Reintentar</button>';
      console.error('[colecciones] listener failed:', e);
      toast('No se pudieron cargar las colecciones: ' + e.message);
    },
    () => { _collectionsReady = false; }
  );
}
window.reintentarCargaColecciones = function() {
  clearTimeout(_collectionsSlowTimer);
  if (_collectionsUnsub) { _collectionsUnsub(); _collectionsUnsub = null; }
  loadColecciones();
};

// Any collection created in Super Admin → Colecciones automatically becomes
// an assignable option in Productos (new/edit form, filter, bulk-assign).
// Full rebuild every time (not just "add what's missing"): a renamed
// collection must update its label here too, and a deleted one must
// disappear — not linger as a stale static <option>. Hidden collections
// stay selectable here on purpose: visibility only gates the PUBLIC site,
// not what Super Admin/staff can manage from this panel.
function syncCategorySelects() {
  ['prod-category', 'prod-filter-cat', 'bulk-category-input'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = wristCategory(sel.value);
    // Keep only the placeholder option (always the first, never dynamic)
    [...sel.options].slice(1).forEach(o => o.remove());
    _allCollections
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach(c => {
        const opt = document.createElement('option');
        opt.value = wristCategory(c.slug);
        opt.textContent = c.name + (c.visible === false ? ' (oculta)' : '');
        sel.appendChild(opt);
      });
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  });
}

function applyCollFilter(list) {
  const q = normalizeAdminSearch(document.getElementById('coll-search')?.value);
  if (!q) return list;
  return list.filter(c => normalizeAdminSearch(c.name).includes(q) || normalizeAdminSearch(c.slug).includes(q));
}
document.getElementById('coll-search').addEventListener('input', debounceAdminSearch(() => renderColeccionesGrid(applyCollFilter(_allCollections))));

// ══════════════════════════════════════════════
// COLECCIONES: SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS
// ══════════════════════════════════════════════
let _selectedCollections = new Set();

window.toggleCollectionSelect = function(cb) {
  cb.checked = addAdminBulkSelection(_selectedCollections, cb.dataset.slug, cb.checked, 'colecciones');
  updateCollBulkToolbar();
};

function updateCollBulkToolbar() {
  const count = _selectedCollections.size;
  const toolbar = document.getElementById('coll-bulk-toolbar');
  const countEl = document.getElementById('coll-bulk-count');
  const delBtn = document.getElementById('coll-bulk-delete-btn');
  const delAllBtn = document.getElementById('coll-bulk-delete-all-btn');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionada${count !== 1 ? 's' : ''}`;
  if (delBtn) delBtn.style.display = (can(currentRole, 'deleteCollections') && roleCanDo('colecciones', 'eliminar')) ? '' : 'none';
  // La eliminación global queda fuera del flujo operativo: todas las bajas
  // deben pasar por una selección explícita de hasta 30 elementos.
  if (delAllBtn) delAllBtn.style.display = 'none';
  const visBtns = document.getElementById('coll-bulk-visible-group');
  if (visBtns) visBtns.style.display = (can(currentRole, 'manageContent') && roleCanDo('colecciones', 'activarDesactivar')) ? 'contents' : 'none';
}

window.clearCollSelection = function() {
  _selectedCollections.clear();
  document.querySelectorAll('.coll-row-check').forEach(cb => cb.checked = false);
  updateCollBulkToolbar();
};

window.bulkSetCollVisible = async function(visible) {
  if (!_selectedCollections.size) return;
  if (!can(currentRole, 'manageContent') || !roleCanDo('colecciones', 'activarDesactivar')) { toast('No tenés permiso para editar colecciones'); return; }
  const n = _selectedCollections.size;
  if (!confirm(`¿${visible ? 'Activar (mostrar)' : 'Desactivar (ocultar)'} ${n} colección(es)?`)) return;
  try {
    const slugs = [..._selectedCollections];
    await batchUpdateChunked(slugs, () => ({ visible, updatedAt: serverTimestamp() }), 'collections');
    _allCollections.forEach(c => { if (_selectedCollections.has(c.slug)) c.visible = visible; });
    logAudit('editar_coleccion', 'coleccion', '', '', `Colecciones ${visible ? 'activadas' : 'desactivadas'}`, { bulk: true, count: n });
    toast(`${n} colección(es) ${visible ? 'activadas' : 'desactivadas'}`);
    clearCollSelection();
    renderColeccionesGrid(applyCollFilter(_allCollections));
  } catch (e) { toast('Error: ' + e.message); }
};

// Por seguridad, el borrado masivo solo alcanza a colecciones SIN productos
// asociados — reasignar los productos de una colección con contenido es una
// decisión por-colección (a qué otra colección van), no algo que tenga
// sentido resolver igual para varias a la vez. Las que tengan productos se
// listan aparte para que se borren de a una desde "Eliminar" (ese flujo ya
// pide a dónde mover los productos).
window.bulkDeleteCollections = async function() {
  if (!_selectedCollections.size) return;
  if (rejectOversizedAdminBulkSelection(_selectedCollections, 'colecciones')) return;
  if (!can(currentRole, 'deleteCollections') || !roleCanDo('colecciones', 'eliminar')) { toast('No tenés permiso para eliminar colecciones'); return; }
  const slugs = [..._selectedCollections];
  const empty = [], withProducts = [];
  slugs.forEach(slug => {
    const count = _allProducts.filter(p => wristCategory(p.category || '') === wristCategory(slug)).length;
    (count > 0 ? withProducts : empty).push(slug);
  });
  if (!empty.length) {
    toast('Todas las colecciones seleccionadas tienen productos — eliminalas de a una con "Eliminar" para reasignarlos primero.');
    return;
  }
  const n = empty.length;
  let msg = `¿ELIMINAR DEFINITIVAMENTE ${n} colección(es) vacías? Esta acción no se puede deshacer.`;
  if (withProducts.length) msg += `\n\n(${withProducts.length} de la selección tienen productos y NO se van a tocar — eliminalas de a una.)`;
  if (!confirm(msg)) return;
  try {
    const CHUNK = 450;
    for (let i = 0; i < empty.length; i += CHUNK) {
      const batch = writeBatch(db);
      empty.slice(i, i + CHUNK).forEach(slug => collectionDocumentSlugs(slug).forEach(id => batch.delete(doc(db, 'collections', id))));
      await withAdminSiteChange(async () => batch.commit());
    }
    const emptySet = new Set(empty);
    _allCollections = _allCollections.filter(c => !emptySet.has(c.slug));
    logAudit('eliminar_coleccion', 'coleccion', '', '', `${n} colecciones vacías eliminadas`, { bulk: true, count: n });
    toast(`${n} colección(es) eliminadas` + (withProducts.length ? ` — ${withProducts.length} con productos no se tocaron` : ''));
    clearCollSelection();
    renderColeccionesGrid(applyCollFilter(_allCollections));
  } catch (e) { toast('Error: ' + e.message); }
};

function collRowsToCsv_(cols) {
  const header = ['Nombre', 'Slug', 'Descripción', 'Orden', 'Visible', 'Productos'];
  const rows = cols.map(c => [
    c.name || '', c.slug || '', c.description || '', c.order ?? 0,
    c.visible === false ? 'No' : 'Sí',
    _allProducts.filter(p => wristCategory(p.category || '') === wristCategory(c.slug)).length
  ]);
  return [header, ...rows];
}

window.bulkExportCollections = function() {
  if (!_selectedCollections.size) { toast('No hay colecciones seleccionadas'); return; }
  const list = _allCollections.filter(c => _selectedCollections.has(c.slug));
  downloadCsv(`colecciones_${Date.now()}.csv`, collRowsToCsv_(list));
  toast(`Exportadas ${list.length} colección(es) a CSV`);
};

// Categories already in use by real products but with no matching doc in
// `collections` yet — e.g. products imported/assigned before this module
// existed. Surfaced so nothing "disappears" from the admin's view.
function getUnmanagedCategories() {
  const known = new Set(_allCollections.map(c => c.slug));
  const found = new Map();
  _allProducts.forEach(p => {
    const cat = (p.category || '').trim();
    if (!cat || known.has(cat)) return;
    found.set(cat, (found.get(cat) || 0) + 1);
  });
  return [...found.entries()].map(([slug, count]) => ({ slug, count }));
}

function renderColeccionesGrid(list) {
  document.getElementById('coll-loading').style.display = 'none';
  const unmanaged = getUnmanagedCategories();
  if (!_allCollections.length && !unmanaged.length) {
    document.getElementById('coll-empty').style.display = '';
    document.getElementById('coll-grid-wrap').style.display = 'none';
    document.getElementById('coll-empty').innerHTML = `
      No hay colecciones configuradas todavía — el sitio público no muestra ninguna colección hasta que crees al menos una.
      <div style="margin-top:14px"><button type="button" class="adm-btn adm-btn-primary adm-btn-sm" onclick="collImportarDefaults()">Importar las 12 colecciones actuales</button></div>
    `;
    return;
  }
  document.getElementById('coll-grid-wrap').style.display = '';
  document.getElementById('coll-empty').style.display = 'none';
  const grid = document.getElementById('coll-grid');
  const visibleSlugs = new Set(list.map(c => c.slug));
  [..._selectedCollections].forEach(slug => { if (!visibleSlugs.has(slug)) _selectedCollections.delete(slug); });
  grid.innerHTML = list.map(c => {
    const count = _allProducts.filter(p => wristCategory(p.category || '') === wristCategory(c.slug)).length;
    const safeSlug = escapeHtmlAdmin(c.slug);
    const slugArg = String((c.slug) ?? '');
    const imageUrl = sanitizeImageUrl(c.image || '');
    return `
    <div class="adm-card" style="margin:0;overflow:hidden;position:relative">
      <label style="position:absolute;top:8px;left:8px;z-index:3;background:rgba(255,255,255,.9);border-radius:6px;padding:3px;display:flex" title="Seleccionar">
        <input type="checkbox" class="coll-row-check" data-slug="${safeSlug}" onclick="toggleCollectionSelect(this)" ${_selectedCollections.has(c.slug) ? 'checked' : ''}>
      </label>
      <div style="height:120px;background:${imageUrl ? `url('${escapeHtmlAdmin(imageUrl)}') center/cover` : 'linear-gradient(135deg,#fce4ec,#e8a0b4)'};position:relative">
        ${c.visible === false ? `<span style="position:absolute;top:8px;right:8px;background:#fff3e0;color:#bf360c;font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px">OCULTA</span>` : ''}
      </div>
      <div style="padding:14px">
        <div style="font-weight:800;font-size:14px">${escapeHtmlAdmin(c.name || c.slug)}</div>
        <div style="color:var(--adm-muted);font-size:11px;margin-bottom:8px">/${safeSlug} · orden ${escapeHtmlAdmin(c.order ?? 0)}</div>
        <div style="font-size:12px;font-weight:700;color:var(--adm-primary);margin-bottom:12px">${count} producto${count===1?'':'s'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="adm-btn adm-btn-sm" ${adminEventAttributes('click','collVerProductos',[slugArg])}>Ver productos</button>
          ${(can(currentRole, 'manageContent') && roleCanDo('colecciones', 'editar')) ? `<button type="button" class="adm-btn adm-btn-sm" ${adminEventAttributes('click','collEditar',[slugArg])}>Editar</button>` : ''}
          ${(can(currentRole, 'deleteCollections') && roleCanDo('colecciones', 'eliminar')) ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" ${adminEventAttributes('click','collEliminar',[slugArg,count])}>Eliminar</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('') + unmanaged.map(u => {
    const safeSlug = escapeHtmlAdmin(u.slug);
    const slugArg = String((u.slug) ?? '');
    return `
    <div class="adm-card" style="margin:0;overflow:hidden;border:1.5px dashed #e8a0b4">
      <div style="height:120px;background:#fff3e0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#bf360c">SIN GESTIONAR</div>
      <div style="padding:14px">
        <div style="font-weight:800;font-size:14px">${safeSlug}</div>
        <div style="color:var(--adm-muted);font-size:11px;margin-bottom:8px">Categoría usada en productos, sin colección creada</div>
        <div style="font-size:12px;font-weight:700;color:var(--adm-primary);margin-bottom:12px">${u.count} producto${u.count===1?'':'s'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="adm-btn adm-btn-sm" ${adminEventAttributes('click','collVerProductos',[slugArg])}>Ver productos</button>
          <button type="button" class="adm-btn adm-btn-primary adm-btn-sm" ${adminEventAttributes('click','collCrearDesdeCategoria',[slugArg])}>Crear colección</button>
        </div>
      </div>
    </div>`;
  }).join('');
  updateCollBulkToolbar();
}

window.collVerProductos = function(slug) {
  switchSection('productos');
  const sel = document.getElementById('prod-filter-cat');
  const search = document.getElementById('prod-search');
  const hasOption = sel && [...sel.options].some(o => o.value === slug);
  if (hasOption) {
    sel.value = slug;
    if (search) search.value = '';
  } else {
    // Category not yet a formal collection/select option — fall back to search
    if (sel) sel.value = '';
    if (search) search.value = slug;
  }
  applyProductFilters();
};

window.collCrearDesdeCategoria = function(slug) {
  UnsavedGuard.confirmLeave(() => {
    _collNuevaNow();
    document.getElementById('coll-name').value = slug.charAt(0).toUpperCase() + slug.slice(1);
    document.getElementById('coll-slug').value = slug;
  });
};

function serializeCollForm() {
  return {
    name: document.getElementById('coll-name').value,
    slug: document.getElementById('coll-slug').value,
    description: document.getElementById('coll-description').value,
    image: document.getElementById('coll-image').value,
    order: document.getElementById('coll-order').value,
    visible: document.getElementById('coll-visible').checked,
  };
}

window.collNueva = function() {
  UnsavedGuard.confirmLeave(_collNuevaNow);
};

function _collNuevaNow() {
  document.getElementById('coll-form-title').textContent = 'Nueva colección';
  document.getElementById('coll-original-slug').value = '';
  document.getElementById('coll-name').value = '';
  document.getElementById('coll-slug').value = '';
  document.getElementById('coll-description').value = '';
  document.getElementById('coll-image').value = '';
  mountFormImageWidget('coll-image-widget', 'coll-image', {
    label: 'Imagen de portada',
    hint: 'Si la dejás vacía, se usa automáticamente la imagen del primer producto de la colección',
  });
  document.getElementById('coll-order').value = _allCollections.length;
  document.getElementById('coll-visible').checked = true;
  document.getElementById('coll-form-error').style.display = 'none';
  document.getElementById('coll-list-card').style.display = 'none';
  document.getElementById('coll-form-card').style.display = '';
  document.getElementById('coll-products-card').style.display = 'none';
  document.getElementById('coll-picker-card').style.display = 'none';
  _collProductsSlug = null;
  UnsavedGuard.track(serializeCollForm, collGuardar);
}

window.collAutoSlug = function() {
  const slugEl = document.getElementById('coll-slug');
  const originalSlug = document.getElementById('coll-original-slug').value;
  if (originalSlug) return; // don't auto-rewrite the slug of an existing collection
  slugEl.value = collSlugify(document.getElementById('coll-name').value);
};

window.collEditar = function(slug) {
  UnsavedGuard.confirmLeave(() => _collEditarNow(slug));
};

function _collEditarNow(slug) {
  const c = _allCollections.find(x => x.slug === slug);
  if (!c) return;
  document.getElementById('coll-form-title').textContent = 'Editar colección';
  document.getElementById('coll-original-slug').value = c.slug;
  document.getElementById('coll-name').value = c.name || '';
  document.getElementById('coll-slug').value = c.slug || '';
  document.getElementById('coll-description').value = c.description || '';
  document.getElementById('coll-image').value = c.image || '';
  mountFormImageWidget('coll-image-widget', 'coll-image', {
    value: c.image || '',
    label: 'Imagen de portada',
    hint: 'Si la dejás vacía, se usa automáticamente la imagen del primer producto de la colección',
  });
  document.getElementById('coll-order').value = c.order ?? 0;
  document.getElementById('coll-visible').checked = c.visible !== false;
  document.getElementById('coll-form-error').style.display = 'none';
  document.getElementById('coll-list-card').style.display = 'none';
  document.getElementById('coll-form-card').style.display = '';
  document.getElementById('coll-picker-card').style.display = 'none';
  document.getElementById('coll-products-card').style.display = '';
  _collProductsSlug = slug;
  renderCollCurrentList();
  UnsavedGuard.track(serializeCollForm, collGuardar);
}

function _collCloseForm() {
  document.getElementById('coll-form-card').style.display = 'none';
  document.getElementById('coll-products-card').style.display = 'none';
  document.getElementById('coll-picker-card').style.display = 'none';
  document.getElementById('coll-list-card').style.display = '';
  _collProductsSlug = null;
}
window.collCancelForm = function() {
  UnsavedGuard.confirmLeave(_collCloseForm);
};

/* =============================================
   COLECCIONES — Products workspace (bulk add/remove, manual reorder)
   ============================================= */
let _collProductsSlug = null;
let _collPickerSelected = new Set();

function _collInStock(p) { return !(p.stock != null && Number(p.stock) <= 0); }

function renderCollCurrentList() {
  if (!_collProductsSlug) return;
  const items = _allProducts.filter(p => wristCategory(p.category || '') === wristCategory(_collProductsSlug));
  document.getElementById('coll-products-count').textContent = items.length;
  document.getElementById('coll-current-empty').style.display = items.length ? 'none' : '';

  // In-stock sorted by manual order (or name if never ordered); out-of-stock always last.
  const inStock = items.filter(_collInStock).sort((a, b) => (a.collectionOrder ?? 9999) - (b.collectionOrder ?? 9999) || (a.name||'').localeCompare(b.name||'', 'es'));
  const outStock = items.filter(p => !_collInStock(p)).sort((a, b) => (a.name||'').localeCompare(b.name||'', 'es'));
  const ordered = [...inStock, ...outStock];
  const fmt = n => 'Gs. ' + Number(n||0).toLocaleString('es-PY');

  document.getElementById('coll-current-list').innerHTML = ordered.map((p, i) => {
    const inStockRow = _collInStock(p);
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--adm-border)">
      <div style="display:flex;flex-direction:column;gap:2px">
        <button type="button" class="adm-btn adm-btn-sm" style="padding:2px 8px" ${(!inStockRow || i === 0) ? 'disabled' : ''} ${adminEventAttributes('click','collMoveProduct',[p._docId,-1])} title="Mover arriba">↑</button>
        <button type="button" class="adm-btn adm-btn-sm" style="padding:2px 8px" ${(!inStockRow || i === inStock.length - 1) ? 'disabled' : ''} ${adminEventAttributes('click','collMoveProduct',[p._docId,1])} title="Mover abajo">↓</button>
      </div>
      ${p.imageUrl
        ? `<img src="${p.imageUrl}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--adm-border);flex-shrink:0">`
        : `<div style="width:44px;height:44px;background:#fce4ec;border-radius:6px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtmlAdmin(p.name || '(sin nombre)')}</div>
        <div style="font-size:11px;color:var(--adm-muted)">${fmt(p.price)} · ${p.stock != null ? p.stock + ' en stock' : 'stock no definido'}</div>
      </div>
      ${!inStockRow ? `<span style="font-size:10px;font-weight:800;background:#fce4ec;color:#c62828;padding:2px 8px;border-radius:20px;flex-shrink:0">SIN STOCK</span>` : ''}
      <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0;background:${p.active !== false ? '#e8f5e9' : '#fce4ec'};color:${p.active !== false ? '#2e7d32' : '#c62828'}">
        ${p.active !== false ? 'Activo' : 'Inactivo'}
      </span>
      ${(can(currentRole, 'editProducts') && roleCanDo('productos', 'activarDesactivar')) ? `<button type="button" class="adm-btn adm-btn-sm" style="flex-shrink:0;background:${p.active !== false ? '#fff3e0' : '#e8f5e9'};color:${p.active !== false ? '#bf360c' : '#2e7d32'}" ${adminEventAttributes('click','collToggleActive',[p._docId,p.active !== false])} title="${p.active !== false ? 'Desactivar — ocultar de la tienda' : 'Activar — mostrar en la tienda'}">${p.active !== false ? 'Desactivar' : 'Activar'}</button>` : ''}
      ${(can(currentRole, 'manageContent') && roleCanDo('colecciones', 'editar')) ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" style="flex-shrink:0" ${adminEventAttributes('click','collRemoveFromCollection',[p._docId])} title="Quitar de esta colección"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;margin-right:2px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Quitar</button>` : ''}
    </div>`;
  }).join('');
}

window.collMoveProduct = async function(docId, direction) {
  if (!can(currentRole, 'manageContent') || !roleCanDo('colecciones', 'editar')) { toast('No tenés permiso para editar el orden de la colección'); return; }
  const items = _allProducts.filter(p => wristCategory(p.category || '') === wristCategory(_collProductsSlug) && _collInStock(p));
  const sorted = items.sort((a, b) => (a.collectionOrder ?? 9999) - (b.collectionOrder ?? 9999) || (a.name||'').localeCompare(b.name||'', 'es'));
  const idx = sorted.findIndex(p => p._docId === docId);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
  // Calcular fuera del cache local: un fallo de escritura no debe dejar el
  // orden visible distinto del que realmente quedó guardado.
  const orderById = new Map(sorted.map((p, i) => [p._docId, i]));
  const firstId = sorted[idx]._docId, secondId = sorted[swapIdx]._docId;
  const firstOrder = orderById.get(firstId);
  orderById.set(firstId, orderById.get(secondId));
  orderById.set(secondId, firstOrder);
  await runAdminCrudOperation({
    title: 'Reordenar producto en la colección', name: sorted[idx].name || docId, module: 'colecciones',
    stages: [{ id: 'write', label: 'Guardar el orden de los productos' }, { id: 'refresh', label: 'Actualizar el panel' }],
    action: async ctx => {
      ctx.start('write');
      const batch = writeBatch(db);
      sorted.forEach(p => batch.update(doc(db, 'products', p._docId), { collectionOrder: orderById.get(p._docId) }));
      await withAdminSiteChange(async () => batch.commit());
      sorted.forEach(p => { p.collectionOrder = orderById.get(p._docId); });
      ctx.ok('write');
      ctx.start('refresh');
      renderCollCurrentList();
      ctx.ok('refresh');
      return 'Orden de colección actualizado.';
    },
  });
};

window.collRemoveFromCollection = async function(docId) {
  if (!can(currentRole, 'manageContent') || !roleCanDo('colecciones', 'editar')) { toast('No tenés permiso para editar colecciones'); return; }
  const p = _allProducts.find(x => x._docId === docId);
  if (!confirm(`¿Quitar "${p?.name || 'este producto'}" de la colección?`)) return;
  await runAdminCrudOperation({
    title: 'Quitar producto de la colección', name: p?.name || docId, module: 'colecciones',
    stages: [{ id: 'write', label: 'Quitar vínculo de colección' }, { id: 'sync', label: 'Sincronizar catálogo' }],
    action: async ctx => {
      ctx.start('write');
      await withAdminSiteChange(async () => updateDoc(doc(db, 'products', docId), { category: '', updatedAt: serverTimestamp() }));
      ctx.ok('write');
      ctx.start('sync');
      await pushProductsToSheets([docId]);
      ctx.ok('sync');
      return 'Producto quitado de la colección.';
    },
  });
};

window.collToggleActive = async function(docId, currentlyActive) {
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'activarDesactivar')) { toast('No tenés permiso para activar/desactivar productos'); return; }
  const p = _allProducts.find(x => x._docId === docId);
  await runAdminCrudOperation({
    title: currentlyActive ? 'Desactivar producto' : 'Activar producto', name: p?.name || docId, module: 'productos',
    stages: [{ id: 'write', label: 'Actualizar estado del producto' }, { id: 'sync', label: 'Sincronizar catálogo y lista' }],
    action: async ctx => {
      ctx.start('write');
      await withAdminSiteChange(async () => updateDoc(doc(db, 'products', docId), { active: !currentlyActive, updatedAt: serverTimestamp() }));
      if (p) p.active = !currentlyActive;
      await logAudit('editar_producto', 'producto', docId, p?.name || docId, `Activo: ${currentlyActive} → ${!currentlyActive}`);
      ctx.ok('write');
      ctx.start('sync');
      await pushProductsToSheets([docId]);
      renderCollCurrentList();
      renderProductosTable(_allProducts);
      ctx.ok('sync');
      return currentlyActive ? 'Producto desactivado.' : 'Producto activado.';
    },
  });
};

window.collOpenPicker = function() {
  _collPickerSelected = new Set();
  document.getElementById('coll-products-card').style.display = 'none';
  document.getElementById('coll-picker-card').style.display = '';
  document.getElementById('coll-picker-search').value = '';
  renderCollPicker();
};

window.collClosePicker = function() {
  document.getElementById('coll-picker-card').style.display = 'none';
  document.getElementById('coll-products-card').style.display = '';
  renderCollCurrentList();
};

function renderCollPicker() {
  const q = normalizeAdminSearch(document.getElementById('coll-picker-search').value);
  const filtered = q
    ? _allProducts.filter(p => normalizeAdminSearch(p.name).includes(q))
    : _allProducts;

  document.getElementById('coll-picker-list').innerHTML = filtered.map(p => {
    const checked = _collPickerSelected.has(p._docId);
    const currentColl = p.category ? (_allCollections.find(c => wristCategory(c.slug) === wristCategory(p.category))?.name || p.category) : '—';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 16px;border-top:1px solid var(--adm-border)">
      <input type="checkbox" data-picker-id="${p._docId}" ${checked ? 'checked' : ''} onclick="collPickerToggleOne(this)" style="width:16px;height:16px;cursor:pointer;flex-shrink:0">
      ${p.imageUrl
        ? `<img src="${p.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">`
        : `<div style="width:40px;height:40px;background:#fce4ec;border-radius:6px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtmlAdmin(p.name || '(sin nombre)')}</div>
        <div style="font-size:11px;color:var(--adm-muted)">Gs. ${Number(p.price||0).toLocaleString('es-PY')} · ${p.stock != null && p.stock <= 0 ? 'Sin stock' : 'Con stock'}</div>
      </div>
      <div style="font-size:11px;color:var(--adm-muted);flex-shrink:0">${escapeHtmlAdmin(currentColl)}</div>
    </div>`;
  }).join('');
  updatePickerSelCount();
}
document.getElementById('coll-picker-search').addEventListener('input', debounceAdminSearch(renderCollPicker));

function updatePickerSelCount() {
  document.getElementById('coll-picker-sel-count').textContent = `${_collPickerSelected.size} seleccionados`;
  const q = normalizeAdminSearch(document.getElementById('coll-picker-search').value);
  const filtered = q ? _allProducts.filter(p => normalizeAdminSearch(p.name).includes(q)) : _allProducts;
  document.getElementById('coll-picker-select-all').checked = filtered.length > 0 && filtered.every(p => _collPickerSelected.has(p._docId));
}

window.collPickerToggleOne = function(input) {
  const id = input.dataset.pickerId;
  if (input.checked) _collPickerSelected.add(id);
  else _collPickerSelected.delete(id);
  updatePickerSelCount();
};

window.collPickerToggleAll = function(checkbox) {
  const q = normalizeAdminSearch(document.getElementById('coll-picker-search').value);
  const filtered = q ? _allProducts.filter(p => normalizeAdminSearch(p.name).includes(q)) : _allProducts;
  if (checkbox.checked) filtered.forEach(p => _collPickerSelected.add(p._docId));
  else filtered.forEach(p => _collPickerSelected.delete(p._docId));
  renderCollPicker();
};

// Firestore batches cap at 500 writes — chunk so bulk actions scale to
// thousands of products without silently failing.
async function batchUpdateChunked(ids, dataFn, collectionName = 'products') {
  const CHUNK = 450;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = writeBatch(db);
    ids.slice(i, i + CHUNK).forEach(id => batch.update(doc(db, collectionName, id), dataFn(id)));
    await withAdminSiteChange(async () => batch.commit());
  }
  if (collectionName === 'products') await pushProductsToSheets(ids);
}

window.collPickerAddSelected = async function() {
  if (!_collPickerSelected.size) { toast('Seleccioná al menos un producto'); return; }
  const ids = [..._collPickerSelected];
  await runAdminCrudOperation({
    title: 'Agregar productos a la colección', name: `${ids.length} producto(s)`, module: 'colecciones',
    stages: [{ id: 'assign', label: 'Asignar productos por lotes' }, { id: 'sync', label: 'Sincronizar catálogo y cerrar selección' }],
    action: async ctx => {
      ctx.start('assign');
      await batchUpdateChunked(ids, () => ({ category: wristCategory(_collProductsSlug), updatedAt: serverTimestamp() }));
      ctx.ok('assign', { affected: ids.length });
      ctx.start('sync');
      collClosePicker();
      ctx.ok('sync');
      return `${ids.length} producto(s) agregados a la colección.`;
    },
  });
};

window.collGuardar = async function() {
  if (document.getElementById('coll-save-btn')?.disabled) return false;
  const errEl = document.getElementById('coll-form-error');
  errEl.style.display = 'none';
  const originalSlug = document.getElementById('coll-original-slug').value;
  const _isEdit = !!originalSlug;
  const _permOk = _isEdit
    ? (can(currentRole, 'manageContent') && roleCanDo('colecciones', 'editar'))
    : (can(currentRole, 'manageContent') && roleCanDo('colecciones', 'crear'));
  if (!_permOk) {
    errEl.textContent = _isEdit ? 'No tenés permiso para editar colecciones.' : 'No tenés permiso para crear colecciones.';
    errEl.style.display = '';
    return false;
  }
  const name = document.getElementById('coll-name').value.trim();
  const slug = originalSlug || collSlugify(document.getElementById('coll-slug').value);
  const description = document.getElementById('coll-description').value.trim();
  const order = parseInt(document.getElementById('coll-order').value) || 0;
  const visible = document.getElementById('coll-visible').checked;

  if (!name || !slug) {
    errEl.textContent = 'Completá nombre y slug.';
    errEl.style.display = '';
    return false;
  }
  const dup = _allCollections.find(c => wristCategory(c.slug) === wristCategory(slug) && c.slug !== originalSlug);
  if (dup) {
    errEl.textContent = `Ya existe una colección con el slug "${slug}". Elegí otro.`;
    errEl.style.display = '';
    return false;
  }

  const btn = document.getElementById('coll-save-btn');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    await _formImageWidgets.get('coll-image-widget')?.flush();
    const image = document.getElementById('coll-image').value.trim();
    const operation = await runAdminCrudOperation({
      title: _isEdit ? 'Actualizar colección' : 'Crear colección', name,
      module: 'colecciones',
      stages: [{ id: 'save', label: 'Guardar colección y actualizar productos vinculados' }],
      action: async ctx => {
        ctx.start('save');
        const data = { name, description, image, order, visible, updatedAt: serverTimestamp() };
    if (originalSlug && originalSlug !== slug) {
      // Slug changed: create new doc, move products over, delete old doc
      data.createdAt = serverTimestamp();
      await withAdminSiteChange(async () => setDoc(doc(db, 'collections', slug), data));
      const affected = _allProducts.filter(p => wristCategory(p.category || '') === wristCategory(originalSlug));
      if (affected.length) {
        // Chunked (max 450/batch, Firestore hard-caps a batch at 500 writes)
        // so a slug rename never silently fails on a collection with 500+ products.
        await batchUpdateChunked(affected.map(p => p._docId), () => ({ category: slug, updatedAt: serverTimestamp() }));
      }
      await withAdminSiteChange(async () => deleteDoc(doc(db, 'collections', originalSlug)));
      // El CRUD de colección individual ahora deja rastro en Auditoría igual que
      // el de productos y las acciones masivas de colecciones (antes solo se
      // registraban las masivas, dejando huecos en el historial).
      await logAudit('editar_coleccion', 'coleccion', slug, name, `Renombrada "${originalSlug}" → "${slug}" · ${affected.length} producto(s) movidos`);
    } else if (originalSlug) {
      await withAdminSiteChange(async () => updateDoc(doc(db, 'collections', originalSlug), data));
      await logAudit('editar_coleccion', 'coleccion', originalSlug, name, 'Datos actualizados');
    } else {
      data.createdAt = serverTimestamp();
      await withAdminSiteChange(async () => setDoc(doc(db, 'collections', slug), data));
      await logAudit('crear_coleccion', 'coleccion', slug, name, `Orden: ${order} · ${visible ? 'visible' : 'oculta'}`);
    }
    UnsavedGuard.clear();
    _collCloseForm();
        ctx.ok('save');
        return true;
      },
    });
    if (operation.status !== 'green') {
      errEl.textContent = 'No se pudo completar el guardado. Revisá el detalle de la operación y volvé a intentar.';
      errEl.style.display = '';
      return false;
    }
    return true;
  } catch (e) {
    errEl.textContent = 'Error al guardar: ' + e.message;
    errEl.style.display = '';
    return false;
  } finally {
    btn.textContent = 'Guardar colección'; btn.disabled = false;
  }
};

window.collEliminar = async function(slug, count) {
  if (!can(currentRole, 'deleteCollections') || !roleCanDo('colecciones', 'eliminar')) { toast('No tenés permiso para eliminar colecciones'); return; }
  const c = _allCollections.find(x => x.slug === slug);
  const label = c?.name || slug;

  if (count > 0) {
    const others = _allCollections.filter(x => x.slug !== slug).map(x => `${x.slug} (${x.name || x.slug})`).join(', ') || 'ninguna otra creada';
    const target = prompt(
      `"${label}" tiene ${count} producto(s) asociados. No se puede eliminar sin reasignarlos primero.\n\n` +
      `Escribí el slug de la colección a la que mover esos productos (colecciones disponibles: ${others}), ` +
      `o dejá vacío y aceptá para quitarles la categoría (quedan sin colección).`,
      ''
    );
    if (target === null) return; // cancelled
    const targetSlug = collSlugify(target);
    if (targetSlug && !_allCollections.some(x => wristCategory(x.slug) === wristCategory(targetSlug))) {
      toast(`"${targetSlug}" no es una colección existente. Cancelado — no se movió ningún producto.`);
      return;
    }
    if (!confirm(`¿Mover ${count} producto(s) de "${label}" a "${targetSlug || '(sin colección)'}" y luego eliminar "${label}"?`)) return;
    await runAdminCrudOperation({
      title: 'Eliminar colección y reasignar productos', name: label,
      module: 'colecciones', dangerous: true,
      stages: [
        { id: 'move', label: 'Reasignar productos vinculados' },
        { id: 'delete', label: 'Eliminar colección' },
        { id: 'audit', label: 'Registrar y actualizar el resultado' },
      ],
      action: async ctx => {
        const affected = _allProducts.filter(p => wristCategory(p.category || '') === wristCategory(slug));
        // Chunked (max 450/batch) so reassigning 500+ products never silently
        // fails on Firestore's 500-write batch cap.
        ctx.start('move');
        await batchUpdateChunked(affected.map(p => p._docId), () => ({ category: targetSlug, updatedAt: serverTimestamp() }));
        ctx.ok('move', { message: `${affected.length} producto(s)` });
        ctx.start('delete');
        await deleteCollectionDocuments(slug);
        ctx.ok('delete');
        ctx.start('audit');
        await logAudit('eliminar_coleccion', 'coleccion', slug, label, `${affected.length} producto(s) reasignados a "${targetSlug || '(sin colección)'}"`);
        ctx.ok('audit');
        return `${affected.length} producto(s) reasignados; colección eliminada.`;
      },
    });
    return;
  }

  if (!confirm(`¿Eliminar la colección "${label}"? Esta acción no se puede deshacer.`)) return;
  await runAdminCrudOperation({
    title: 'Eliminar colección', name: label, module: 'colecciones', dangerous: true,
    stages: [{ id: 'delete', label: 'Eliminar colección y registrar el cambio' }],
    action: async ctx => {
      ctx.start('delete');
      await deleteCollectionDocuments(slug);
      await logAudit('eliminar_coleccion', 'coleccion', slug, label, 'Colección vacía eliminada');
      ctx.ok('delete');
      return 'Colección eliminada.';
    },
  });
};

window.collImportarDefaults = async function() {
  if (!confirm('Esto crea las 11 colecciones actuales en la base de datos para que puedas administrarlas (renombrar, ocultar, reordenar, agregar imagen). ¿Continuar?')) return;
  const DEFAULTS = [
    ['relojes','Relojes'], ['bolsos','Bags'], ['aros','Aros'], ['collares','Collares'],
    ['pulseras','Pulseras'], ['anillos','Anillos'], ['tobilleras','Tobilleras'],
    ['earcuff','Earcuff'], ['armcuff','Armcuff'],
    ['gafas','Gafas'], ['joyeros','Joyeros'],
  ];
  await runAdminCrudOperation({
    title: 'Crear colecciones predeterminadas', name: `${DEFAULTS.length} colecciones`, module: 'colecciones',
    stages: [{ id: 'create', label: 'Crear colecciones en Firestore' }],
    action: async ctx => {
      ctx.start('create');
      const batch = writeBatch(db);
      DEFAULTS.forEach(([slug, name], i) => {
        batch.set(doc(db, 'collections', slug), {
          name, description: '', image: '', order: i, visible: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      });
      await withAdminSiteChange(async () => batch.commit());
      ctx.ok('create', { affected: DEFAULTS.length });
      return `${DEFAULTS.length} colecciones creadas.`;
    },
  });
};

// Load collections when section is shown
document.querySelectorAll('[data-section="colecciones"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!_collectionsUnsub) loadColecciones();
  });
});

// ======== IMPORT / EXPORT ========
let csvProductos = [];
// Legacy import markup remains in the historical HTML until the next template
// cleanup, but every write-capable handler is deliberately inert. The mounted
// canonical importer in importacion-admin.js is the only import authority.
const LEGACY_IMPORT_DISABLED = true;
let _importarInited = false;

function loadImportar() {
  if (_importarInited) return;
  _importarInited = true;

  // ── EXPORTAR JSON
  document.getElementById('btn-exportar').onclick = async () => {
    const snap = await getDocsPaginated(collection(db, 'products'), { pageSize: 500, maxDocs: 20000 });
    if (snap.truncated) {
      toast('La exportación supera el límite seguro de 20.000 productos. Aplicá filtros o ampliá el límite de forma controlada.');
      return;
    }
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tintin-productos-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    toast('JSON descargado');
  };

  // ── EXPORTAR PEDIDOS (CSV) — Fase 2
  document.getElementById('btn-exportar-pedidos').onclick = async () => {
    const snap = await getDocsPaginated(collection(db, 'orders'), { pageSize: 500, maxDocs: 20000 });
    if (snap.truncated) {
      toast('La exportación supera el límite seguro de 20.000 pedidos. Exportá por períodos.');
      return;
    }
    const SHIP_LABELS = { delivery: 'Delivery', encomienda: 'Encomienda', retiro: 'Retiro en tienda' };
    const rows = [[
      'Número de pedido', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Estado',
      'Estado de pago', 'Productos', 'Total', 'Método de entrega', 'Ciudad/Zona'
    ]];
    snap.docs.forEach(d => {
      const o = d.data();
      if (!ordersForView([{id:d.id,...o}], includesTestOrders()).length) return;
      const productos = (o.items || []).map(i => `${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''}`).join('; ');
      const metodo = SHIP_LABELS[o.shipping?.method] || o.shipping?.method || '—';
      const ciudadZona = [o.shipping?.city, o.shipping?.zone].filter(Boolean).join(' / ') || '—';
      rows.push([
        orderDisplayCode({id:d.id,...o}),
        formatDate(o.createdAt),
        o.userName || '—',
        o.userEmail || '—',
        o.userPhone || '—',
        ORDER_STATUS_LABELS[o.status] || o.status || 'Pendiente',
        PAY_STATUS_LABELS[o.paymentStatus || o.payment?.status] || o.paymentStatus || o.payment?.status || 'Pago pendiente',
        productos,
        o.total ?? 0,
        metodo,
        ciudadZona
      ]);
    });
    downloadCsv('tintin-pedidos-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast(`${rows.length - 1} pedidos exportados`);
  };

  // ── EXPORTAR USUARIOS (CSV) — Fase 2
  document.getElementById('btn-exportar-usuarios').onclick = async () => {
    const snap = await getDocsPaginated(collection(db, 'users'), { pageSize: 500, maxDocs: 20000 });
    if (snap.truncated) {
      toast('La exportación supera el límite seguro de 20.000 usuarios. Exportá en segmentos.');
      return;
    }
    const rows = [['Nombre', 'Email', 'Teléfono', 'Rol', 'Bloqueado', 'Fecha de creación']];
    snap.docs.forEach(d => {
      const u = d.data();
      rows.push([
        u.name || '—',
        u.email || '—',
        u.phone || '—',
        ROLE_LABELS[u.role] || u.role || 'Cliente',
        u.blocked ? 'Sí' : 'No',
        u.createdAt ? formatDate(u.createdAt) : '—'
      ]);
    });
    downloadCsv('tintin-usuarios-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast(`${snap.size} usuarios exportados`);
  };

  // ── IMPORTAR JSON SAMPLE
  document.getElementById('btn-importar-sample').onclick = () => {
    document.getElementById('import-json').value = JSON.stringify([
      { name: 'Reloj Rosa Elegante', category: 'relojes', price: 85000, imageUrl: 'https://via.placeholder.com/400x400/fce4ec/ea7ea3?text=Reloj', stock: 3, active: true, description: 'Reloj elegante de acero inoxidable' }
    ], null, 2);
  };

  // ── IMPORTAR JSON
  document.getElementById('btn-importar').onclick = async () => {
    if (LEGACY_IMPORT_DISABLED) { toast('Este importador legacy está deshabilitado. Usá la superficie Shopify canónica.'); return; }
    const raw = document.getElementById('import-json').value.trim();
    const result = document.getElementById('import-result');
    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) throw new Error('Debe ser un array JSON');
      if (!items.length) throw new Error('El array está vacío');
      let ok = 0;
      const importedIds = [];
      const skipped = [];
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx] || {};
        const label = item.name ? `"${item.name}"` : `fila ${idx + 1}`;
        // price se valida por separado de !item.price para no descartar
        // productos legítimos de precio 0 (promos/regalos).
        const priceNum = Number(item.price);
        if (!item.name || typeof item.name !== 'string' || !item.name.trim()) { skipped.push(`${label}: falta "name"`); continue; }
        if (!item.category || typeof item.category !== 'string') { skipped.push(`${label}: falta "category"`); continue; }
        if (item.price == null || Number.isNaN(priceNum) || priceNum < 0) { skipped.push(`${label}: "price" inválido`); continue; }
        try {
          const importedRef = await withAdminSiteChange(async () => addDoc(collection(db, 'products'), {
            name:        String(item.name).trim().slice(0, 180),
            category:    item.category,
            price:       Math.max(0, Math.round(priceNum)),
            imageUrl:    sanitizeImageUrl(item.imageUrl || ''),
            // Igual que el formulario manual: sin stock especificado = null
            // (ilimitado/no controlado), nunca 0 (agotado de verdad) por
            // defecto silencioso.
            stock:       item.stock == null || item.stock === '' ? null : (Number(item.stock) || 0),
            active:      item.active !== false,
            description: item.description || '',
            createdAt:   serverTimestamp(),
            createdBy:   currentUser?.email || 'import',
          }));
          importedIds.push(importedRef.id);
          ok++;
        } catch (writeError) {
          console.error('Error importando', label, writeError);
          skipped.push(`${label}: error al guardar (${writeError.message})`);
        }
      }
      await pushProductsToSheets(importedIds);
      const skippedHtml = skipped.length
        ? `<br><span style="color:#b45309">${skipped.length} omitido${skipped.length === 1 ? '' : 's'}: ${skipped.map(escapeHtmlAdmin).join(' · ')}</span>`
        : '';
      result.innerHTML = `<span style="color:${ok > 0 ? 'green' : '#e57'}">${ok} producto${ok === 1 ? '' : 's'} importado${ok === 1 ? '' : 's'} correctamente</span>${skippedHtml}`;
      toast(ok > 0 ? `${ok} productos importados${skipped.length ? `, ${skipped.length} omitidos` : ''}` : 'No se importó ningún producto — revisá los detalles');
    } catch(e) {
      result.innerHTML = `<span style="color:#e57">Error: ${escapeHtmlAdmin(e.message)}</span>`;
    }
  };

  // ── CSV UNIVERSAL (Shopify, Google Sheets, Excel u otros)
  const CAT_MAP = {
    'relojes':'relojes','reloj':'relojes','watches':'relojes',
    'bolsos':'bolsos','bags':'bolsos','bag':'bolsos','cartera':'bolsos',
    'aros':'aros','aretes':'aros','earrings':'aros',
    'collares':'collares','collar':'collares','necklace':'collares','cadenas':'collares',
    'pulseras':'pulseras','pulsera':'pulseras','bracelet':'pulseras',
    'anillos':'anillos','anillo':'anillos','ring':'anillos',
    'tobilleras':'tobilleras','tobillera':'tobilleras','ankle':'tobilleras',
    'brazaletes':'pulseras','brazalete':'pulseras',
    'earcuff':'earcuff','ear cuff':'earcuff',
    'armcuff':'armcuff','arm cuff':'armcuff',
    'gafas':'gafas','lentes':'gafas','sunglasses':'gafas',
    'joyeros':'joyeros','joyero':'joyeros','jewelry box':'joyeros',
  };

  function detectarCategoria(type, tags, title) {
    const wordMatch = (s, key) => new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(s);
    // 1. Product Type is the most authoritative signal — check it alone first
    const t = (type || '').toLowerCase().trim();
    for (const [key, val] of Object.entries(CAT_MAP)) {
      if (t === key || wordMatch(t, key)) return val;
    }
    // 2. Tags — checked as individual tokens, not substring-of-everything
    const tagList = (tags || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    for (const [key, val] of Object.entries(CAT_MAP)) {
      if (tagList.includes(key)) return val;
    }
    // 3. Title — last resort, word-boundary match only (avoids "reloj" matching every product
    //    when a shared tagline/brand tag is present across the whole catalog)
    const ti = (title || '').toLowerCase();
    for (const [key, val] of Object.entries(CAT_MAP)) {
      if (wordMatch(ti, key)) return val;
    }
    return 'otros';
  }

  function parsearPrecio(str) {
    if (!str) return 0;
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? 0 : Math.round(num);
  }

  // Tokeniza el CSV completo respetando RFC4180: campos entre comillas pueden
  // contener comas, comillas escapadas ("") y saltos de línea reales — algo
  // habitual en el "Body (HTML)" de exports de Shopify. Partir primero por
  // '\n' (como hacía la versión anterior) corta esas descripciones a la
  // mitad y desalinea todas las columnas siguientes de esa fila.
  function tokenizarCSV(texto) {
    const filas = [];
    let fila = [];
    let celda = '';
    let inQuote = false;
    const text = texto.replace(/\r\n?/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuote) {
        if (ch === '"') {
          if (text[i + 1] === '"') { celda += '"'; i++; }
          else inQuote = false;
        } else {
          celda += ch;
        }
        continue;
      }
      if (ch === '"') { inQuote = true; continue; }
      if (ch === ',') { fila.push(celda.trim()); celda = ''; continue; }
      if (ch === '\n') { fila.push(celda.trim()); filas.push(fila); fila = []; celda = ''; continue; }
      celda += ch;
    }
    if (celda !== '' || fila.length) { fila.push(celda.trim()); filas.push(fila); }
    return filas.filter(f => f.some(c => c !== ''));
  }

  function parsearCSV(texto) {
    const lineas = tokenizarCSV(texto);
    if (lineas.length < 2) return [];
    const headers = lineas[0].map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const col = name => headers.indexOf(name);
    const iHandle=col('handle'),iTitle=col('title'),iType=col('type'),iTags=col('tags'),
          iStatus=col('status'),iPrice=col('variant price'),iCompare=col('variant compare at price'),
          iStock=col('variant inventory qty'),iImg=col('image src'),iImgPos=col('image position'),
          iVariantImg=col('variant image'),iImgUrl=col('imageurl'),iImageUrl=col('image url'),
          iImagenUrl=col('imagen url'),iUrlImagen=col('url imagen'),iUrlDeImagen=col('url de imagen'),
          iImage=col('image'),iFoto=col('foto'),iImagen=col('imagen'),
          iOpt1N=col('option1 name'),iOpt1V=col('option1 value'),
          iOpt2N=col('option2 name'),iOpt2V=col('option2 value'),
          iOpt3N=col('option3 name'),iOpt3V=col('option3 value'),
          iVariantSku=col('variant sku');
    const iDesc = col('body (html)') >= 0 ? col('body (html)') : col('body html');
    function stripHtml(html) { return (html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
    const productos = new Map();
    for (let i = 1; i < lineas.length; i++) {
      const cols = lineas[i];
      if (!cols || !cols.some(c => c !== '')) continue;
      const handle = cols[iHandle] || '';
      if (!handle) continue;
      const stockRaw = iStock >= 0 ? cols[iStock] : undefined;
      // Igual que el formulario manual: columna ausente o vacía = null
      // (ilimitado/no controlado), nunca 0 (agotado de verdad) por defecto
      // silencioso.
      const title=cols[iTitle]||'',type=cols[iType]||'',tags=cols[iTags]||'',
            status=cols[iStatus]||'active',price=parsearPrecio(cols[iPrice]),
            compare=parsearPrecio(cols[iCompare]),
            stock=(stockRaw === undefined || stockRaw === '') ? null : (parseInt(stockRaw) || 0),
            img=cols[iImg]||(iVariantImg>=0?cols[iVariantImg]:'')||(iImgUrl>=0?cols[iImgUrl]:'')||(iImageUrl>=0?cols[iImageUrl]:'')||(iImagenUrl>=0?cols[iImagenUrl]:'')||(iUrlImagen>=0?cols[iUrlImagen]:'')||(iUrlDeImagen>=0?cols[iUrlDeImagen]:'')||(iImage>=0?cols[iImage]:'')||(iFoto>=0?cols[iFoto]:'')||(iImagen>=0?cols[iImagen]:'')||'',
            imgPos=parseInt(cols[iImgPos])||99,
            desc=iDesc>=0?cols[iDesc]||'':'',
            opt1n=iOpt1N>=0?cols[iOpt1N]||'':'', opt1v=iOpt1V>=0?cols[iOpt1V]||'':'',
            opt2n=iOpt2N>=0?cols[iOpt2N]||'':'', opt2v=iOpt2V>=0?cols[iOpt2V]||'':'',
            opt3n=iOpt3N>=0?cols[iOpt3N]||'':'', opt3v=iOpt3V>=0?cols[iOpt3V]||'':'',
            variantSku=iVariantSku>=0?cols[iVariantSku]||'':'',
            variantImg=iVariantImg>=0?cols[iVariantImg]||'':'';
      if (!productos.has(handle)) {
        productos.set(handle, {
          name: title||handle, category: detectarCategoria(type,tags,title),
          price, priceBefore: compare||null, stock, imageUrl:'', imagesExtra:[],
          description: stripHtml(desc),
          tags: tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : [],
          active: status.toLowerCase()==='active', _imgs:[], variants:[],
        });
      }
      const prod = productos.get(handle);
      if (!prod.description && desc) prod.description = stripHtml(desc);
      if (price && !prod.price) prod.price = price;
      if (stock && !prod.stock) prod.stock = stock;
      if (img) prod._imgs.push({ pos: imgPos, url: img });
      if (opt1v) {
        const variant = { price, sku: variantSku };
        if (opt1n) variant[opt1n] = opt1v;
        if (opt2n && opt2v) variant[opt2n] = opt2v;
        if (opt3n && opt3v) variant[opt3n] = opt3v;
        if (variantImg) variant.imageUrl = variantImg;
        prod.variants.push(variant);
      }
    }
    const resultado = [];
    for (const [, p] of productos) {
      if (!p.name || !p.price) continue;
      p._imgs.sort((a,b)=>a.pos-b.pos);
      p.imageUrl = p._imgs[0]?.url || '';
      p.imagesExtra = p._imgs.slice(1).map(i=>i.url);
      delete p._imgs;
      resultado.push(p);
    }
    return resultado;
  }

  const dropZone  = document.getElementById('csv-drop-zone');
  const fileInput = document.getElementById('csv-file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.style.background='#fce4ec';
    dropZone.style.borderColor='var(--adm-accent)';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.background='#fef5f8';
    dropZone.style.borderColor='var(--adm-border)';
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.background='#fef5f8';
    dropZone.style.borderColor='var(--adm-border)';
    const file = e.dataTransfer.files[0];
    if (file) procesarCSV(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) procesarCSV(fileInput.files[0]);
  });

  function procesarCSV(file) {
    if (LEGACY_IMPORT_DISABLED) { toast('Este importador legacy está deshabilitado. Usá la superficie Shopify canónica.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        csvProductos = parsearCSV(e.target.result);
        mostrarPreviewCSV(csvProductos);
      } catch(err) {
        toast('Error al leer el CSV: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function mostrarPreviewCSV(lista) {
    if (!lista.length) { toast('No se encontraron productos válidos en el CSV'); return; }
    document.getElementById('csv-preview').style.display = 'block';
    document.getElementById('csv-preview-title').textContent = `${lista.length} productos encontrados — revisá antes de importar`;
    _selectedCsvRows.clear();
    const tbody = document.getElementById('csv-preview-body');
    tbody.innerHTML = lista.map((p, i) => `
      <tr>
        <td class="col-select"><input type="checkbox" class="csv-row-check" data-idx="${i}" onclick="toggleCsvRowSelect(this)"></td>
        <td style="color:var(--adm-muted);font-size:12px">${i + 1}</td>
        <td>${sanitizeImageUrl(p.imageUrl||'') ? `<img src="${sanitizeImageUrl(p.imageUrl||'')}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'" />` : '<div style="width:48px;height:48px;background:#fce4ec;border-radius:6px"></div>'}</td>
        <td style="font-weight:700;max-width:200px;word-break:break-word">${escapeHtmlAdmin(p.name)}</td>
        <td>
          <select class="adm-select" style="padding:4px 8px;font-size:12px;border-radius:20px;width:auto"
                  ${adminEventAttributes('change','setCsvRowCategory',[i,{control:'value'}])}>
            ${['relojes','bolsos','aros','collares','pulseras','anillos','tobilleras','earcuff','armcuff','gafas','joyeros','otros'].map(c =>
              `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`
            ).join('')}
          </select>
        </td>
        <td style="font-weight:700;color:var(--color-text-primary,#713C53)">Gs. ${p.price.toLocaleString('es-PY')}</td>
        <td style="font-weight:700">${p.stock}</td>
        <td><span class="adm-badge ${p.active ? 'badge-entregado' : 'badge-cancelado'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
      </tr>
    `).join('');
    updateCsvBulkCount();
  }

  document.getElementById('btn-csv-limpiar').addEventListener('click', () => {
    csvProductos = [];
    _selectedCsvRows.clear();
    fileInput.value = '';
    document.getElementById('csv-preview').style.display = 'none';
    document.getElementById('csv-import-result').innerHTML = '';
  });

  async function importCsvProducts_(list) {
    if (LEGACY_IMPORT_DISABLED) { toast('Este importador legacy está deshabilitado. Usá la superficie Shopify canónica.'); return; }
    if (!list.length) return;
    const progress=document.getElementById('csv-import-progress');
    const progressBar=document.getElementById('csv-progress-bar');
    const progressLbl=document.getElementById('csv-progress-label');
    const result=document.getElementById('csv-import-result');
    const btn=document.getElementById('btn-csv-importar');
    const btnSel=document.getElementById('btn-csv-importar-seleccionados');
    btn.disabled=true; btnSel.disabled=true; progress.style.display='block'; result.innerHTML='';
    let ok=0, errores=0;
    const importedIds=[];
    for (let i=0; i<list.length; i++) {
      const p = list[i];
      const pct = Math.round(((i+1)/list.length)*100);
      progressBar.style.width=pct+'%';
      progressLbl.textContent=`Importando ${i+1} de ${list.length}: ${p.name}`;
      try {
        const importedRef = await withAdminSiteChange(async () => addDoc(collection(db,'products'), {
          name:        String(p.name || '').trim().slice(0, 180),
          category:    p.category,
          price:       Math.max(0, Math.round(Number(p.price) || 0)),
          priceBefore: p.priceBefore||null,
          stock:       p.stock,
          imageUrl:    sanitizeImageUrl(p.imageUrl || ''),
          imagesExtra: (p.imagesExtra||[]).map(u => sanitizeImageUrl(u)).filter(Boolean),
          description: p.description||'',
          variants:    p.variants?.length ? p.variants : [],
          tags:        p.tags||[],
          active:      p.active,
          oferta:      false,
          createdAt:   serverTimestamp(),
          createdBy:   currentUser?.email||'import',
          source:      'catalog-csv',
        }));
        importedIds.push(importedRef.id);
        ok++;
      } catch(e) { errores++; console.error('Error importando:', p.name, e); }
    }
    await pushProductsToSheets(importedIds);
    btn.disabled=false; btnSel.disabled=false; progress.style.display='none';
    if (ok>0) {
      result.innerHTML=`<span style="color:green">${ok} productos importados correctamente${errores>0?` (${errores} con error)`:''}</span>`;
      toast(`${ok} productos importados del CSV`);
      const fullImport = list.length === csvProductos.length;
      if (fullImport) {
        csvProductos=[]; fileInput.value='';
        setTimeout(()=>{ document.getElementById('csv-preview').style.display='none'; }, 2000);
      } else {
        // Importación parcial (solo seleccionados): saca del preview solo lo
        // ya importado, deja el resto para revisar/importar después.
        const importedNames = new Set(list.map(p => p.name));
        csvProductos = csvProductos.filter(p => !importedNames.has(p.name));
        _selectedCsvRows.clear();
        mostrarPreviewCSV(csvProductos);
        if (!csvProductos.length) setTimeout(()=>{ document.getElementById('csv-preview').style.display='none'; }, 2000);
      }
    } else {
      result.innerHTML=`<span style="color:#e57">No se pudo importar ningún producto</span>`;
    }
  }

  document.getElementById('btn-csv-importar').addEventListener('click', () => importCsvProducts_(csvProductos));
  document.getElementById('btn-csv-importar-seleccionados').addEventListener('click', () => {
    const list = [..._selectedCsvRows].sort((a, b) => a - b).map(idx => csvProductos[idx]).filter(Boolean);
    if (!list.length) { toast('No hay productos seleccionados'); return; }
    importCsvProducts_(list);
  });
}

let _selectedCsvRows = new Set();
window.toggleSelectAllCsvRows = function(masterCb) {
  document.querySelectorAll('.csv-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    const idx = Number(cb.dataset.idx);
    if (masterCb.checked) _selectedCsvRows.add(idx); else _selectedCsvRows.delete(idx);
  });
  updateCsvBulkCount();
};
window.toggleCsvRowSelect = function(cb) {
  const idx = Number(cb.dataset.idx);
  if (cb.checked) _selectedCsvRows.add(idx); else _selectedCsvRows.delete(idx);
  updateCsvBulkCount();
};
window.setCsvRowCategory = function(idx, value) {
  if (csvProductos[idx]) csvProductos[idx].category = value;
};
function updateCsvBulkCount() {
  const el = document.getElementById('csv-bulk-count');
  if (el) el.textContent = `${_selectedCsvRows.size} seleccionado${_selectedCsvRows.size !== 1 ? 's' : ''}`;
}

// ══════════════════════════════════════════════
// ROLES Y PERMISOS
// ══════════════════════════════════════════════
const PERM_ROLE_LABELS = { admin: 'Admin', agent: 'Agente / Modder', viewer: 'Viewer' };
let _permPending = null;   // copia editable en memoria — no se guarda hasta "Guardar cambios"
let _permOriginal = null;  // último estado guardado/cargado — para calcular el diff al guardar
let _permInited = false;

async function loadPermisosSection() {
  if (_permInited) return;
  _permInited = true;
  const cache = getRolePermissionsCache() || await loadRolePermissions();
  _permOriginal = JSON.parse(JSON.stringify(cache));
  _permPending = JSON.parse(JSON.stringify(cache));

  const modSel = document.getElementById('perm-filter-module');
  Object.entries(PERMISSION_MODULES).forEach(([key, mod]) => {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = mod.label;
    modSel.appendChild(opt);
  });

  renderPermisosMatrix();

  document.getElementById('perm-search').oninput = debounceAdminSearch(renderPermisosMatrix);
  document.getElementById('perm-filter-module').onchange = renderPermisosMatrix;
  document.getElementById('perm-filter-role').onchange = renderPermisosMatrix;
  document.getElementById('btn-perm-save').onclick = savePermisosChanges;
  document.getElementById('btn-perm-restore').onclick = restorePermisosDefaults;
  window.AdminUnsaved?.register('permissions', {
    serialize: () => JSON.stringify(_permPending),
    active: () => document.getElementById('section-permisos')?.classList.contains('active'),
    label: 'Roles y permisos',
    save: savePermisosChanges,
  });
}

function renderPermisosMatrix() {
  const q = normalizeAdminSearch(document.getElementById('perm-search').value);
  const modFilter = document.getElementById('perm-filter-module').value;
  const roleFilter = document.getElementById('perm-filter-role').value;
  const wrap = document.getElementById('perm-modules-wrap');

  const modKeys = Object.keys(PERMISSION_MODULES).filter(k => !modFilter || k === modFilter);
  const rolesToShow = EDITABLE_ROLES.filter(r => !roleFilter || r === roleFilter);

  wrap.innerHTML = modKeys.map(modKey => {
    const mod = PERMISSION_MODULES[modKey];
    const actionEntries = Object.entries(mod.actions).filter(([actKey, act]) => {
      if (!q) return true;
      return normalizeAdminSearch(act.label).includes(q) || normalizeAdminSearch(mod.label).includes(q);
    });
    if (!actionEntries.length) return '';

    // Pill "No disponible": mismo bloque para las dos razones por las que
    // una celda no tiene switch (acción no implementada todavía, o rol sin
    // acceso a esa acción puntual) — así se ve igual de claro en los dos casos,
    // bien diferenciado del pill sólido de Activado/Desactivado.
    const notAvailablePill = () => `<span class="perm-pill-disabled">No disponible</span>`;

    const rows = actionEntries.map(([actKey, act]) => {
      if (act.implemented === false) {
        return `
          <tr>
            <td data-label="Acción">${act.label} <span class="perm-row-not-implemented">— no implementado</span><br><span class="perm-row-fixed-note">${act.note || ''}</span></td>
            ${rolesToShow.map(role => `<td data-label="${PERM_ROLE_LABELS[role]}">${notAvailablePill()}</td>`).join('')}
          </tr>`;
      }
      const dangerBadge = act.dangerous ? '<span class="perm-danger-badge">Sensible</span>' : '';
      const uiOnlyBadge = act.uiOnly ? '<span class="perm-uionly-badge" title="Solo oculta el dato en pantalla — Firestore no permite redactar campos dentro de un documento ya permitido">Solo visual</span>' : '';
      return `
        <tr>
          <td data-label="Acción">${act.label}${dangerBadge}${uiOnlyBadge}</td>
          ${rolesToShow.map(role => {
            const editable = !act.rolesEditable || act.rolesEditable.includes(role);
            if (!editable) return `<td data-label="${PERM_ROLE_LABELS[role]}">${notAvailablePill()}</td>`;
            const checked = !!(_permPending[role]?.[modKey]?.[actKey]);
            return `<td data-label="${PERM_ROLE_LABELS[role]}">
              <label class="perm-pill-toggle">
                <input type="checkbox" class="perm-pill-input" data-role="${role}" data-module="${modKey}" data-action="${actKey}" onchange="permToggleChanged(this)" ${checked ? 'checked' : ''}>
                <span class="perm-pill-track">
                  <span class="perm-pill-text perm-pill-text-on">Activado</span>
                  <span class="perm-pill-text perm-pill-text-off">Desactivado</span>
                </span>
              </label>
            </td>`;
          }).join('')}
        </tr>`;
    }).join('');

    return `
      <details class="perm-module-block" open>
        <summary>${mod.label}</summary>
        <div class="perm-module-body">
          <table class="adm-table perm-matrix-table">
            <thead><tr><th>Acción</th>${rolesToShow.map(r => `<th>${PERM_ROLE_LABELS[r]}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </details>`;
  }).join('') || '<p style="color:var(--adm-muted);text-align:center;padding:24px">Sin resultados para ese filtro.</p>';
}

window.permToggleChanged = function(cb) {
  const { role, module: modKey, action: actKey } = cb.dataset;
  _permPending[role] = _permPending[role] || {};
  _permPending[role][modKey] = _permPending[role][modKey] || {};
  _permPending[role][modKey][actKey] = cb.checked;
  updatePermDirtyState();
};

function computePermDiff() {
  const diff = [];
  EDITABLE_ROLES.forEach(role => {
    Object.entries(PERMISSION_MODULES).forEach(([modKey, mod]) => {
      Object.entries(mod.actions).forEach(([actKey, act]) => {
        if (act.implemented === false) return;
        const before = !!(_permOriginal[role]?.[modKey]?.[actKey]);
        const after = !!(_permPending[role]?.[modKey]?.[actKey]);
        if (before !== after) diff.push({ role, modKey, actKey, act, before, after });
      });
    });
  });
  return diff;
}

function updatePermDirtyState() {
  const diff = computePermDiff();
  const badge = document.getElementById('perm-unsaved-badge');
  const saveBtn = document.getElementById('btn-perm-save');
  const dirty = diff.length > 0;
  badge.style.display = dirty ? '' : 'none';
  saveBtn.disabled = !dirty;
}

window.restorePermisosDefaults = function restorePermisosDefaults() {
  if (!confirm('¿Restaurar los permisos por defecto para Admin, Agente/Modder y Viewer? Esto NO se guarda todavía — vas a poder revisar los cambios antes de confirmar con "Guardar cambios".')) return;
  _permPending = buildDefaultRolePermissions();
  renderPermisosMatrix();
  updatePermDirtyState();
  toast('Valores por defecto cargados — revisá y guardá para aplicarlos');
};

async function savePermisosChanges() {
  const diff = computePermDiff();
  if (!diff.length) return true;

  const dangerousEnabling = diff.filter(d => d.act.dangerous && d.after === true);
  const deleteEnabling = dangerousEnabling.filter(d => d.actKey === 'eliminar');

  if (dangerousEnabling.length) {
    const summary = dangerousEnabling.map(d => `${PERM_ROLE_LABELS[d.role]}: ${PERMISSION_MODULES[d.modKey].label} → ${d.act.label}`).join('\n');
    if (!confirm(`⚠️ Este cambio puede afectar datos importantes de la tienda:\n\n${summary}\n\n¿Confirmás que querés habilitar esto?`)) return false;
  }
  if (deleteEnabling.length) {
    const typed = prompt(`Para confirmar la habilitación de acciones de ELIMINAR, escribí CONFIRMAR:\n\n${deleteEnabling.map(d => `${PERM_ROLE_LABELS[d.role]}: ${d.act.label}`).join('\n')}`);
    if (typed !== 'CONFIRMAR') { toast('Cancelado — no se escribió CONFIRMAR'); return false; }
  }

  const saveBtn = document.getElementById('btn-perm-save');
  saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
  try {
    await saveRolePermissions(_permPending, currentUser?.email);
    for (const d of diff) {
      await logAudit(
        'editar_permiso', 'permiso', '', `${PERM_ROLE_LABELS[d.role]}`,
        `${PERMISSION_MODULES[d.modKey].label} → ${d.act.label}: ${d.before ? 'ON' : 'OFF'} → ${d.after ? 'ON' : 'OFF'}`
      );
    }
    _permOriginal = JSON.parse(JSON.stringify(_permPending));
    updatePermDirtyState();
    window.AdminUnsaved?.markClean('permissions');
    toast(`${diff.length} permiso(s) actualizados — algunos cambios se aplican al cambiar de sección o recargar la página`);
    return true;
  } catch (e) {
    toast('Error al guardar permisos: ' + e.message);
    return false;
  } finally {
    saveBtn.textContent = 'Guardar cambios';
    saveBtn.disabled = !computePermDiff().length;
  }
}


// PRODUCTS: SELECTION & BULK ACTIONS
// ══════════════════════════════════════════════
let _selectedProducts = new Set();

window.toggleSelectAll = function(masterCb) {
  _selectedProducts.clear();
  document.querySelectorAll('.prod-row-check').forEach(cb => {
    if (masterCb.checked) cb.checked = addAdminBulkSelection(_selectedProducts, cb.dataset.id, true, 'productos');
    else cb.checked = false;
  });
  updateBulkToolbar();
};

window.toggleProductSelect = function(cb) {
  cb.checked = addAdminBulkSelection(_selectedProducts, cb.dataset.id, cb.checked, 'productos');
  const master = document.getElementById('check-all-prods');
  if (master) {
    const total = document.querySelectorAll('.prod-row-check').length;
    master.indeterminate = _selectedProducts.size > 0 && _selectedProducts.size < total;
    master.checked = _selectedProducts.size === total && total > 0;
  }
  updateBulkToolbar();
};

function updateBulkToolbar() {
  const count = _selectedProducts.size;
  const toolbar = document.getElementById('bulk-toolbar');
  const selCount = document.getElementById('bulk-sel-count');
  const delBtn = document.getElementById('bulk-delete-btn');
  const delAllBtn = document.getElementById('bulk-delete-all-products-btn');
  if (toolbar) toolbar.style.display = count > 0 ? 'flex' : 'none';
  if (selCount) selCount.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
  // Antes esto era exclusivo de "superadmin" a mano; ahora sigue el mismo
  // permiso que ya gatea el botón de eliminar de a un producto (deleteProducts)
  // — si podés borrar uno, tiene sentido que también puedas borrar varios.
  if (delBtn) delBtn.style.display = (can(currentRole, 'deleteProducts') && roleCanDo('productos', 'eliminar')) ? '' : 'none';
  // La eliminación global queda fuera del flujo operativo: todas las bajas
  // deben pasar por una selección explícita de hasta 30 elementos.
  if (delAllBtn) delAllBtn.style.display = 'none';
  // Roles y Permisos: el grupo de acciones masivas (colección/categoría/
  // activar/desactivar/stock/precio/oferta/destacado) se oculta entero si el
  // rol no tiene habilitada "Acciones masivas" en Productos.
  const hasMasivas = can(currentRole, 'editProducts') && roleCanDo('productos', 'accionesMasivas');
  const masivasGroup = document.getElementById('prod-bulk-masivas-group');
  const moreActions = document.getElementById('prod-more-actions');
  const exportBtn = document.getElementById('prod-bulk-export-btn');
  const exportAllBtn = document.getElementById('prod-export-all-btn');
  if (masivasGroup) masivasGroup.style.display = hasMasivas ? 'contents' : 'none';
  if (moreActions) moreActions.style.display = hasMasivas ? '' : 'none';
  if (exportBtn) exportBtn.style.display = roleCanDo('productos', 'exportar') ? '' : 'none';
  if (exportAllBtn) exportAllBtn.style.display = roleCanDo('productos', 'exportar') ? '' : 'none';
}

window.clearSelection = function() {
  _selectedProducts.clear();
  document.querySelectorAll('.prod-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-prods');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateBulkToolbar();
};

window.bulkRemoveFromCollection = async function() {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'accionesMasivas')) { toast('No tenés permiso para acciones masivas de productos'); return; }
  if (!confirm(`¿Quitar de su colección a ${_selectedProducts.size} producto(s)?`)) return;
  try {
    const n = _selectedProducts.size;
    await batchUpdateChunked([..._selectedProducts], () => ({ category: '', updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.category = ''; });
    logAudit('editar_producto', 'producto', '', '', 'Quitado de colección', { bulk: true, count: n });
    toast(`${_selectedProducts.size} productos quitados de su colección`);
    clearSelection();
    applyProductFilters();
  } catch(e) { toast('Error: ' + e.message); }
};

window.bulkActivate = async function(activate) {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'accionesMasivas') || !roleCanDo('productos', 'activarDesactivar')) { toast('No tenés permiso para acciones masivas de productos'); return; }
  const label = activate ? 'activar' : 'desactivar';
  if (!confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} ${_selectedProducts.size} producto(s)?`)) return;
  try {
    const n = _selectedProducts.size;
    await batchUpdateChunked([..._selectedProducts], () => ({ active: activate, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.active = activate; });
    logAudit('editar_producto', 'producto', '', '', activate ? 'Activados' : 'Desactivados', { bulk: true, count: n });
    toast(`${_selectedProducts.size} productos ${activate ? 'activados' : 'desactivados'}`);
    clearSelection();
    applyProductFilters();
  } catch(e) { toast('Error: ' + e.message); }
};

window.bulkSetCategory = async function() {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'accionesMasivas')) { toast('No tenés permiso para acciones masivas de productos'); return; }
  const cat = document.getElementById('bulk-category-input')?.value;
  if (!cat) { toast('Elegí una colección'); return; }
  const label = document.getElementById('bulk-category-input')?.selectedOptions?.[0]?.textContent || cat;
  if (!confirm(`¿Asignar la colección "${label}" a ${_selectedProducts.size} producto(s)?`)) return;
  try {
    const n = _selectedProducts.size;
    await batchUpdateChunked([..._selectedProducts], () => ({ category: cat, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.category = cat; });
    logAudit('editar_producto', 'producto', '', '', `Colección → "${label}"`, { bulk: true, count: n });
    toast(`Colección "${label}" asignada a ${_selectedProducts.size} productos`);
    clearSelection();
    applyProductFilters();
  } catch(e) { toast('Error: ' + e.message); }
};

window.bulkDelete = async function(explicitIds) {
  const ids1 = Array.isArray(explicitIds) && explicitIds.length ? [...new Set(explicitIds)] : [..._selectedProducts];
  if (!ids1.length) return;
  if (rejectOversizedAdminBulkSelection(ids1, 'productos')) return;
  if (!can(currentRole, 'deleteProducts') || !roleCanDo('productos', 'eliminar')) { toast('No tenés permiso para eliminar productos'); return; }
  const n = ids1.length;
  if (!confirm(`¿ELIMINAR DEFINITIVAMENTE ${n} producto(s)? Esta acción NO se puede deshacer.`)) return;
  if (!confirm(`Segunda confirmación: ¿confirmar la eliminación de ${n} productos?`)) return;
  try {
    const ids0 = ids1;
    const CHUNK = 450;
    for (let i = 0; i < ids0.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids0.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'products', id)));
      await withAdminSiteChange(async () => batch.commit());
    }
    await pushProductsToSheets(ids0);
    const ids = new Set(ids1);
    _allProducts = _allProducts.filter(p => !ids.has(p._docId));
    logAudit('eliminar_producto', 'producto', '', '', `${n} productos eliminados`, { bulk: true, count: n });
    toast(`${n} productos eliminados definitivamente`);
    clearSelection();
    applyProductFilters();
  } catch(e) { toast('Error: ' + e.message); }
};

function productRowsToCsv_(products) {
  const header = ['Nombre', 'Categoría', 'Etiqueta', 'Precio', 'Stock', 'Activo'];
  const rows = products.map(p => [p.name || '', p.category || '', p.collection || '', p.price || 0, p.stock ?? '', p.active === false ? 'No' : 'Sí']);
  return [header, ...rows];
}

window.bulkExportProducts = function(scope) {
  if (!roleCanDo('productos', 'exportar')) { toast('No tenés permiso para exportar productos'); return; }
  let list;
  if (scope === 'selected') {
    if (!_selectedProducts.size) { toast('No hay productos seleccionados'); return; }
    list = _allProducts.filter(p => _selectedProducts.has(p._docId));
  } else {
    list = _allProducts;
  }
  if (!list.length) { toast('No hay productos para exportar'); return; }
  downloadCsv(`productos_${scope}_${Date.now()}.csv`, productRowsToCsv_(list));
  toast(`Exportados ${list.length} producto(s) a CSV`);
};

window.toggleProdMoreActions = function() {
  document.getElementById('prod-more-actions-panel').classList.toggle('show');
};
// Cierra el menú "Más acciones" al tocar afuera — mismo criterio para
// cualquier otro menú de este tipo que se agregue en otros módulos.
document.addEventListener('click', (e) => {
  document.querySelectorAll('.adm-more-actions').forEach(wrap => {
    if (!wrap.contains(e.target)) wrap.querySelector('.adm-more-actions-panel')?.classList.remove('show');
  });
});

window.bulkSetStock = async function() {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'accionesMasivas')) { toast('No tenés permiso para acciones masivas de productos'); return; }
  if (_allProducts.some(product => _selectedProducts.has(product._docId) && product.variantInventory != null)) {
    toast('Los productos con stock por opción se actualizan desde Editar producto.'); return;
  }
  const val = document.getElementById('bulk-stock-input')?.value;
  if (val === '' || val == null || Number(val) < 0) { toast('Escribí un stock válido (0 o más)'); return; }
  const stock = Math.round(Number(val));
  const n = _selectedProducts.size;
  if (!confirm(`¿Cambiar el stock a ${stock} en ${n} producto(s)?`)) return;
  try {
    const ids = [..._selectedProducts];
    const productHistory = ids.map(id => {
      const product = _allProducts.find(item => item._docId === id);
      return { productId: id, priceBefore: product?.price ?? null, priceAfter: product?.price ?? null, stockBefore: product?.stock ?? null, stockAfter: stock };
    });
    await withAdminSiteChange(async () => runTransaction(db, async transaction => {
      const refs = ids.map(id => doc(db, 'products', id));
      const snapshots = [];
      for (const ref of refs) snapshots.push(await transaction.get(ref));
      if (snapshots.some(snapshot => !snapshot.exists() || snapshot.data()?.variantInventory != null)) {
        throw new Error('Un producto cambió o controla stock por opción. Actualizá la lista y editá sus cantidades individuales.');
      }
      for (const ref of refs) transaction.update(ref, { stock, updatedAt: serverTimestamp() });
    }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.stock = stock; });
    await logAudit('editar_producto', 'producto', '', '', `Stock → ${stock}`, { bulk: true, count: n, productHistory });
    toast(`Stock actualizado en ${n} producto(s)`);
    clearSelection();
    applyProductFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

window.bulkSetPrice = async function() {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'accionesMasivas')) { toast('No tenés permiso para acciones masivas de productos'); return; }
  const val = document.getElementById('bulk-price-input')?.value;
  if (val === '' || val == null || Number(val) < 0) { toast('Escribí un precio válido (0 o más)'); return; }
  const price = Math.round(Number(val));
  const n = _selectedProducts.size;
  if (!confirm(`¿Cambiar el precio a ${formatPrice(price)} en ${n} producto(s)?`)) return;
  try {
    const ids = [..._selectedProducts];
    const productHistory = ids.map(id => {
      const product = _allProducts.find(item => item._docId === id);
      return { productId: id, priceBefore: product?.price ?? null, priceAfter: price, stockBefore: product?.stock ?? null, stockAfter: product?.stock ?? null };
    });
    await batchUpdateChunked(ids, () => ({ price, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.price = price; });
    await logAudit('editar_producto', 'producto', '', '', `Precio → ${formatPrice(price)}`, { bulk: true, count: n, productHistory });
    toast(`Precio actualizado en ${n} producto(s)`);
    clearSelection();
    applyProductFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

// "Aplicar/quitar descuento" en lote se mapea al campo real que ya existe
// en la ficha de producto ("En oferta") — no existe un % de descuento
// numérico en el esquema actual, así que no se inventa uno nuevo acá.
window.bulkSetOferta = async function(oferta) {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'accionesMasivas')) { toast('No tenés permiso para acciones masivas de productos'); return; }
  const n = _selectedProducts.size;
  if (!confirm(`¿${oferta ? 'Aplicar' : 'Quitar'} oferta en ${n} producto(s)?`)) return;
  try {
    const ids = [..._selectedProducts];
    await batchUpdateChunked(ids, () => ({ oferta, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.oferta = oferta; });
    logAudit('editar_producto', 'producto', '', '', oferta ? 'Oferta aplicada' : 'Oferta quitada', { bulk: true, count: n });
    toast(`Oferta ${oferta ? 'aplicada' : 'quitada'} en ${n} producto(s)`);
    clearSelection();
    applyProductFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

window.bulkSetDestacado = async function(destacado) {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'accionesMasivas')) { toast('No tenés permiso para acciones masivas de productos'); return; }
  const n = _selectedProducts.size;
  if (!confirm(`¿${destacado ? 'Marcar como más vendido' : 'Quitar de más vendidos'} ${n} producto(s)?`)) return;
  try {
    const ids = [..._selectedProducts];
    await batchUpdateChunked(ids, () => ({ destacado, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.destacado = destacado; });
    logAudit('editar_producto', 'producto', '', '', destacado ? 'Marcado como más vendido' : 'Quitado de más vendidos', { bulk: true, count: n });
    toast(`Más vendido ${destacado ? 'marcado' : 'quitado'} en ${n} producto(s)`);
    clearSelection();
    applyProductFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

// ══════════════════════════════════════════════
// ORDERS: EDIT MODAL
// ══════════════════════════════════════════════
let _editingOrder = null;
// Marca de tiempo (updatedAt) del pedido en el momento en que se abrió el
// editor. Sirve para la concurrencia optimista de saveOrderEdit: si otro
// administrador escribió el mismo pedido mientras este editor estaba abierto,
// no se pisan sus cambios en silencio.
let _orderEditBaselineMillis = null;
let _orderEditBaseChangeId = '';

window.openOrderEdit = function(orderId) {
  const o = allOrders.find(x => x.id === orderId);
  if (!o) return;
  _editingOrder = JSON.parse(JSON.stringify(o)); // deep copy
  // Guarda el updatedAt real (Timestamp de Firestore) — no la copia JSON, que
  // pierde el tipo — para comparar contra el servidor al guardar.
  _orderEditBaselineMillis = toJsDate_(o.updatedAt)?.getTime() ?? null;
  _orderEditBaseChangeId = o.lastChangeId || '';

  document.getElementById('oe-id').value = orderId;
  document.getElementById('oe-short-id').textContent = '#' + orderId.slice(-6).toUpperCase();
  document.getElementById('oe-name').value = o.userName || '';
  document.getElementById('oe-phone').value = o.userPhone || '';
  document.getElementById('oe-email').value = o.userEmail || '';
  document.getElementById('oe-city').value = o.shipping?.city || o.city || '';
  document.getElementById('oe-address').value = o.shipping?.address || o.address || '';
  document.getElementById('oe-referencia').value = o.shipping?.referencia || o.referencia || '';
  const oeMapLoc = o.shipping?.mapLocation || null;
  const oeMapWrap = document.getElementById('oe-map-location-wrap');
  if (oeMapLoc) {
    oeMapWrap.style.display = 'flex';
    const mapUrl = `https://maps.google.com/?q=${oeMapLoc.lat},${oeMapLoc.lng}`;
    document.getElementById('oe-map-location-info').innerHTML =
      (oeMapLoc.name ? `<strong>${escapeHtmlAdmin(oeMapLoc.name)}</strong><br>` : '') +
      `<a href="${escapeHtmlAdmin(mapUrl)}" target="_blank" rel="noopener">Ver en Google Maps →</a>`;
  } else {
    oeMapWrap.style.display = 'none';
  }
  document.getElementById('oe-ship-method').value = o.shipping?.method || o.shippingMethod || 'delivery';
  // Un pedido viejo puede tener guardado un método que ya no se ofrece —por
  // ejemplo PagoPar, retirado mientras no esté integrado—. Sin esta opción de
  // respaldo el select quedaría sin selección y, al guardar, escribiría una
  // cadena vacía encima del método real del pedido.
  const oePayMethod = document.getElementById('oe-pay-method');
  const oePayMethodValue = o.payment?.method || o.paymentMethod || 'efectivo';
  if (!Array.from(oePayMethod.options).some(option => option.value === oePayMethodValue)) {
    const retired = document.createElement('option');
    retired.value = oePayMethodValue;
    retired.textContent = `${oePayMethodValue} (método retirado)`;
    oePayMethod.appendChild(retired);
  }
  oePayMethod.value = oePayMethodValue;
  const oePayStatus = document.getElementById('oe-pay-status');
  const oePaymentValue = o.paymentStatus || o.payment?.status || 'pendiente';
  oePayStatus.innerHTML = payStatusOptions(oePaymentValue);
  if (![...oePayStatus.options].some(option => option.value === oePaymentValue)) { const legacy = document.createElement('option'); legacy.value = oePaymentValue; legacy.textContent = PAY_STATUS_LABELS[oePaymentValue] || 'Estado de pago no reconocido'; oePayStatus.appendChild(legacy); }
  oePayStatus.value = oePaymentValue;
  const oeStatus = document.getElementById('oe-status');
  const refreshOeStatus = selected => {
    const context = { ...o, shippingMethod: document.getElementById('oe-ship-method').value || o.shippingMethod || o.shipping?.method };
    oeStatus.innerHTML = o.localEntryId ? orderStatusOptions(selected) : '<option value="" disabled>Elegí un estado compatible</option>' + allowedOrderStatuses(context).filter(status => ORDER_STATUS_LABELS[status] && (status !== 'en_camino' || context.shippingMethod !== 'retiro') && (status !== 'listo_retiro' || context.shippingMethod === 'retiro')).map(status => `<option value="${status}">${orderStatusLabel({ ...context, status })}</option>`).join('');
    oeStatus.value = selected === 'enviado' ? 'en_camino' : selected || 'pendiente';
  };
  refreshOeStatus(o.status);
  document.getElementById('oe-ship-method').onchange = () => refreshOeStatus(oeStatus.value);
  document.getElementById('oe-notes').value = o.adminNotes || o.notes || '';

  renderOeItems();
  document.getElementById('order-edit-overlay').style.display = '';
  document.body.style.overflow = 'hidden';
  window.AdminUnsaved?.register('order-editor', {
    root: '#order-edit-overlay',
    active: () => document.getElementById('order-edit-overlay')?.style.display !== 'none' && Boolean(_editingOrder),
    serialize: () => JSON.stringify({
      form: window.AdminUnsaved.serializeRoot(document.getElementById('order-edit-overlay')),
      items: _editingOrder?.items || [],
    }),
    label: 'el pedido abierto',
    save: window.saveOrderEdit,
  });
};

window.closeOrderEdit = function(force = false) {
  if (!force && window.AdminUnsaved?.isDirty('order-editor')) {
    window.AdminUnsaved.requestNavigation(() => window.closeOrderEdit(true), { scopeIds: ['order-editor'] });
    return;
  }
  document.getElementById('order-edit-overlay').style.display = 'none';
  document.body.style.overflow = '';
  _editingOrder = null;
  _orderEditBaselineMillis = null;
  window.AdminUnsaved?.unregister('order-editor');
};

function renderOeItems() {
  const items = _editingOrder?.items || [];
  const el = document.getElementById('oe-items');
  const fmt = n => 'Gs. ' + Math.round(n).toLocaleString('es-PY');
  el.innerHTML = items.map((it, idx) => `
    <div style="display:flex;align-items:center;gap:10px;background:var(--adm-bg);border-radius:8px;padding:8px 12px" id="oe-item-${idx}">
      ${sanitizeImageUrl(it.imgUrl||it.imageUrl||'') ? `<img src="${sanitizeImageUrl(it.imgUrl||it.imageUrl||'')}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">` : `<div style="width:40px;height:40px;background:#fce4ec;border-radius:6px;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8a0b4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`}
      <div style="flex:1;font-size:13px;font-weight:600">${escapeHtmlAdmin(it.name||'—')}${it.variant ? `<div style="font-size:11px;font-weight:400;color:var(--adm-muted)">${escapeHtmlAdmin(it.variant)}</div>` : ''}</div>
      <div style="font-size:12px;color:var(--adm-muted)">${fmt(it.price||0)} c/u</div>
      <input type="number" min="1" value="${it.qty||1}" style="width:56px;padding:4px 8px;border:1px solid var(--adm-border);border-radius:6px;font-size:13px;text-align:center"
        ${adminEventAttributes('change','updateOeItemQty',[idx,{control:'value'}])} ${adminEventAttributes('input','updateOeItemQty',[idx,{control:'value'}])}>
      <div style="font-size:13px;font-weight:700;color:var(--adm-primary);min-width:90px;text-align:right">${fmt((it.price||0)*(it.qty||1))}</div>
      <button type="button" ${adminEventAttributes('click','removeOeItem',[idx])} style="background:none;border:none;color:#e53935;font-size:18px;cursor:pointer;padding:0 4px" title="Quitar del pedido">×</button>
    </div>
  `).join('');
  recalcOeTotals();
}

window.updateOeItemQty = function(idx, val) {
  const q = Math.max(1, parseInt(val) || 1);
  if (_editingOrder?.items[idx]) {
    _editingOrder.items[idx].qty = q;
    recalcOeTotals();
    // update displayed subtotal for this item inline
    const row = document.getElementById(`oe-item-${idx}`);
    if (row) {
      const priceEl = row.querySelectorAll('div')[3];
      if (priceEl) priceEl.textContent = 'Gs. ' + Math.round((_editingOrder.items[idx].price||0)*q).toLocaleString('es-PY');
    }
  }
};

window.removeOeItem = function(idx) {
  if (!_editingOrder) return;
  if (_editingOrder.items.length <= 1) { toast('El pedido debe tener al menos un producto'); return; }
  _editingOrder.items.splice(idx, 1);
  renderOeItems();
};

function recalcOeTotals() {
  if (!_editingOrder) return;
  const subtotal = (_editingOrder.items||[]).reduce((s, i) => s + (i.price||0)*(i.qty||1), 0);
  const shipCost = _editingOrder.shippingCost || 0;
  const total = subtotal + shipCost;
  const fmt = n => 'Gs. ' + Math.round(n).toLocaleString('es-PY');
  const sub = document.getElementById('oe-subtotal-display');
  const ship = document.getElementById('oe-ship-cost-display');
  const tot = document.getElementById('oe-total-display');
  if (sub) sub.textContent = fmt(subtotal);
  if (ship) ship.textContent = fmt(shipCost);
  if (tot) tot.textContent = fmt(total);
  _editingOrder._calcSubtotal = subtotal;
  _editingOrder._calcTotal = total;
}

window.saveOrderEdit = async function() {
  if (!can(currentRole, 'manageOrdersFull') || !roleCanDo('pedidos', 'editarCompleto')) { toast('No tenés permiso para editar el pedido completo'); return false; }
  const orderId = document.getElementById('oe-id').value;
  if (!orderId || !_editingOrder) return false;
  // Snapshot ANTES de tocar allOrders (más abajo se sobreescribe con
  // Object.assign) — así se puede armar un resumen simple de qué cambió.
  const _before = allOrders.find(x => x.id === orderId);
  const _beforeStatus = _before?.status;
  const _beforeTotal = _before?.total;

  // Validations
  const name  = document.getElementById('oe-name').value.trim();
  const phone = document.getElementById('oe-phone').value.trim();
  if (!name)  { toast('El nombre del cliente es obligatorio'); document.getElementById('oe-name').focus(); return false; }
  if (!phone) { toast('El teléfono del cliente es obligatorio'); document.getElementById('oe-phone').focus(); return false; }
  const items = _editingOrder.items || [];
  if (items.some(i => !i.qty || i.qty < 1)) { toast('Las cantidades deben ser al menos 1'); return false; }
  const total    = _editingOrder._calcTotal ?? (_editingOrder.total || 0);
  const subtotal = _editingOrder._calcSubtotal ?? (_editingOrder.subtotal || 0);
  if (total < 0) { toast('El total no puede ser negativo'); return false; }

  const btn = document.getElementById('oe-save-btn');
  btn.disabled = true; btn.textContent = 'Guardando…';

  const updateData = {
    userName:    document.getElementById('oe-name').value.trim(),
    userPhone:   document.getElementById('oe-phone').value.trim(),
    userEmail:   document.getElementById('oe-email').value.trim(),
    status:      document.getElementById('oe-status').value,
    paymentStatus: document.getElementById('oe-pay-status').value,
    adminNotes:  document.getElementById('oe-notes').value.trim(),
    items:       _editingOrder.items,
    subtotal,
    total,
    'payment.method': document.getElementById('oe-pay-method').value,
    'payment.status': document.getElementById('oe-pay-status').value,
    'shipping.city':       document.getElementById('oe-city').value.trim(),
    'shipping.address':    document.getElementById('oe-address').value.trim(),
    'shipping.referencia': document.getElementById('oe-referencia').value.trim(),
    'shipping.method':     document.getElementById('oe-ship-method').value,
    updatedAt: serverTimestamp(),
  };

  try {
    const operation = await runAdminCrudOperation({
      title: 'Actualizar pedido', name: _before?.shortId || orderId,
      module: 'pedidos',
      stages: [
        { id: 'concurrency', label: 'Comprobar cambios recientes' },
        { id: 'save', label: 'Guardar pedido y actualizar inventario' },
        { id: 'refresh', label: 'Actualizar panel y auditoría' },
      ],
      action: async ctx => {
        ctx.start('concurrency');
        // Concurrencia optimista: no pisar cambios recientes de otra persona.
        try {
          const freshSnap = await getDoc(doc(db, 'orders', orderId));
          if (!freshSnap.exists()) {
            ctx.fail('concurrency', { detail: 'El pedido ya no existe.' });
            return false;
          }
          const freshMillis = toJsDate_(freshSnap.data()?.updatedAt)?.getTime() ?? null;
          if (_orderEditBaselineMillis && freshMillis && freshMillis > _orderEditBaselineMillis) {
            ctx.fail('concurrency', { detail: 'Otro administrador modificó este pedido mientras lo editabas.' });
            return false;
          }
        } catch (_) { /* fail-open: no bloquear por un error de lectura */ }
        ctx.ok('concurrency');
        ctx.start('save');
        await window.TintinInventoryIntegrity.updateEditedOrder(orderId, { ...updateData, baseChangeId: _orderEditBaseChangeId });
        ctx.ok('save');
        ctx.start('refresh');
        const idx = allOrders.findIndex(x => x.id === orderId);
        if (idx >= 0) {
          Object.assign(allOrders[idx], {
            userName: updateData.userName,
            userPhone: updateData.userPhone,
            userEmail: updateData.userEmail,
            status: updateData.status,
            paymentStatus: updateData.paymentStatus,
            adminNotes: updateData.adminNotes,
            items: updateData.items,
            subtotal,
            total,
            payment: { method: updateData['payment.method'], status: updateData['payment.status'] },
            shipping: {
              city: updateData['shipping.city'],
              address: updateData['shipping.address'],
              referencia: updateData['shipping.referencia'],
              method: updateData['shipping.method'],
            },
          });
        }
        const changes = [];
        if (_beforeStatus !== updateData.status) changes.push(`Estado: ${ORDER_STATUS_LABELS[_beforeStatus] || _beforeStatus || '—'} → ${ORDER_STATUS_LABELS[updateData.status] || updateData.status}`);
        if (_beforeTotal !== total) changes.push(`Total: ${_beforeTotal ?? 0} → ${total}`);
        await logAudit('editar_pedido', 'pedido', orderId, _before?.shortId || orderId, changes.join(' · ') || 'Datos del pedido actualizados');
        window.AdminUnsaved?.markClean('order-editor');
        closeOrderEdit(true);
        applyOrderFilters();
        ctx.ok('refresh');
        return true;
      },
    });
    return operation.status === 'green' && operation.value === true;
  } catch(e) {
    toast('Error al guardar: ' + e.message);
    return false;
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar cambios';
  }
};

// ======== ACCESIBILIDAD DE SWITCHES (iOS-style) ========
// .adm-toggle / .perm-pill-input / .tt-access-pill-input / .tt-mini-switch
// son todos <input type=checkbox> nativos con apariencia de switch — un
// checkbox nativo no expone aria-checked por sí solo, así que se agrega acá
// role="switch" + aria-checked, sincronizado con el estado real. Se corre
// en un intervalo (en vez de sólo en 'change') porque buena parte de estos
// switches se re-renderizan dinámicamente (matriz de Roles y Permisos,
// campos de Contenido, tablas) y muchas pantallas los marcan `.checked =`
// directo desde JS (loadConfig, etc.) sin disparar 'change'.
function ttSyncSwitchAria() {
  document.querySelectorAll('.adm-toggle input, .perm-pill-input, .tt-access-pill-input, input.tt-mini-switch').forEach(el => {
    if (el.getAttribute('role') !== 'switch') el.setAttribute('role', 'switch');
    const checked = el.checked ? 'true' : 'false';
    if (el.getAttribute('aria-checked') !== checked) el.setAttribute('aria-checked', checked);
  });
}
document.addEventListener('change', e => {
  if (e.target && e.target.matches && e.target.matches('.adm-toggle input, .perm-pill-input, .tt-access-pill-input, input.tt-mini-switch')) {
    ttSyncSwitchAria();
  }
});
ttSyncSwitchAria();
setInterval(ttSyncSwitchAria, 1200);

// ---- Tabs de nivel superior de Apariencia (contenido vs. colores) ----
// Solo alternan qué panel se ve — ninguno de los dos pierde su estado al
// cambiar de pestaña, así que no hace falta confirmar nada acá.
document.querySelectorAll('#apar-main-tabs .correos-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#apar-main-tabs .correos-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('#section-apariencia > .correos-panel').forEach(p => {
      p.classList.toggle('active', p.id === `apar-panel-${btn.dataset.aparMainTab}`);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// APARIENCIA Y ESQUEMAS DE COLOR (Super Admin, exclusivo — mismo
// criterio de acceso que Configuración/Correos, ver SECTION_PERMISSION)
// ══════════════════════════════════════════════════════════════
const APAR_CATALOG = {
  global: { tokens: GLOBAL_TOKENS, categories: GLOBAL_CATEGORIES, pairs: GLOBAL_CONTRAST_PAIRS, defaultSchemeId: 'default-global' },
};
const APAR_PREVIEW_ROLES = {
  global: { bgPage:'bg-page', bgSurface:'bg-surface', textPrimary:'text-primary', textSecondary:'text-secondary', textTertiary:'text-tertiary', textTitle:'text-title',
    btnPrimaryBg:'btn-primary-bg', btnPrimaryText:'btn-primary-text', btnSecondaryBg:'btn-secondary-bg', btnSecondaryText:'btn-secondary-text', btnSecondaryBorder:'btn-secondary-border',
    fieldBg:'field-bg', fieldBorder:'field-border', fieldText:'field-text', cardBorder:'card-border',
    tableHeaderBg:'table-header-bg', tableHeaderText:'table-header-text', tableBorder:'table-border',
    successBg:'state-success-bg', successText:'state-success-text', errorBg:'state-error-bg', errorText:'state-error-text', warningBg:'state-warning-bg', warningText:'state-warning-text',
    link:'text-link', badgeBg:'badge-bg', badgeText:'badge-text', border:'border-primary' },
};

const aparScope = 'global';
let aparSchemes = { global: [] };
let aparEditingSchemeId = { global: null };
let aparActiveSchemeId = { global: null };
let aparDraft = { global: {} };
let aparPublished = { global: {} };
let aparDeviceOverrideEnabled = { global: false };
let aparDeviceOverrides = { global: {} };
let aparPublishedDeviceOverrideEnabled = { global: false };
let aparPublishedDeviceOverrides = { global: {} };
let aparSavedState = { global: '' };
let aparUndoStack = { global: [] };
let aparTransientColor = null;
let aparSearchTerm = '';
let aparPreviewDevice = 'desktop';
let aparDeviceTab = 'desktopLg';
let aparBootstrapped = false;
let aparUnsavedRegistered = false;

const APAR_CATEGORY_IMPACT = {
  global: {
    generales: 'marca, enlaces, acciones destacadas y componentes que comparten el color corporativo en toda la plataforma',
    fondos: 'fondos de páginas, secciones, header, footer, menús, tablas, campos, overlays y superficies públicas/privadas',
    tipografia: 'títulos, textos, etiquetas, ayudas, enlaces y contenido dinámico de clientes y visitantes',
    botones: 'botones y sus estados normal, hover, focus, active y disabled en desktop, tablet y mobile',
    bordes: 'bordes, divisores, foco y validaciones de formularios, tarjetas y tablas',
    estados: 'mensajes, badges y estados de éxito, error, advertencia, información, stock, selección y deshabilitado',
    formularios: 'inputs, selects, textareas, placeholders, foco y validación',
    navegacion: 'header, menús, pestañas, breadcrumbs, acordeones e indicadores',
    tarjetas: 'tarjetas, tablas, encabezados, filas, badges y chips',
    modales: 'modales, fondos oscurecidos, tooltips, popups y estados vacíos',
    productos: 'productos, precios, promociones, valoraciones y carrito',
    avanzado: 'íconos, scrollbars, switches, checks, radios, progreso, skeletons, selección y carga',
  },
};

function aparCatalog() { return APAR_CATALOG[aparScope]; }
function aparDefaultMap() { return buildDefaultTokenMap(aparCatalog().tokens); }
function aparTokenImpact(tok, scope = aparScope) {
  return APAR_CATEGORY_IMPACT[scope]?.[tok.category] || 'componentes que utilizan este token compartido';
}
function aparResolve(key, overrideMap, deviceKey = null) {
  if (aparTransientColor && aparTransientColor.scope === aparScope && aparTransientColor.key === key) {
    const sameLayer = aparTransientColor.deviceKey
      ? aparTransientColor.deviceKey === deviceKey
      : !deviceKey;
    if (sameLayer) return aparTransientColor.value;
  }
  if (overrideMap && overrideMap[key] != null && overrideMap[key] !== '') return overrideMap[key];
  const d = aparDraft[aparScope];
  if (d && d[key] != null && d[key] !== '') return d[key];
  const tok = findTokenByKey(aparCatalog().tokens, key);
  return tok ? tok.default : '#000000';
}
function aparResolvePreview(key) {
  if (aparScope === 'global' && aparDeviceOverrideEnabled.global) {
    const overrideMap = aparDeviceOverrides.global[aparPreviewDevice] || null;
    return aparResolve(key, overrideMap, aparPreviewDevice);
  }
  return aparResolve(key);
}
function aparEditingOverrideMap() {
  if (aparScope !== 'global' || !aparDeviceOverrideEnabled.global) return null;
  return aparDeviceOverrides.global[aparDeviceTab] || (aparDeviceOverrides.global[aparDeviceTab] = {});
}
function aparStateObject(scope = aparScope) {
  return {
    schemeId: aparEditingSchemeId[scope] || '',
    tokens: aparDraft[scope] || {},
    deviceOverrideEnabled: scope === 'global' ? !!aparDeviceOverrideEnabled.global : false,
    deviceOverrides: scope === 'global' ? (aparDeviceOverrides.global || {}) : {},
  };
}
function aparStateString(scope = aparScope) {
  return JSON.stringify(aparStateObject(scope));
}
function aparAllStateString() {
  return JSON.stringify({ global: aparStateObject('global') });
}
function aparSnapshot(scope = aparScope) {
  return JSON.parse(JSON.stringify(aparStateObject(scope)));
}
function aparRestoreSnapshot(snapshot, scope = aparScope) {
  aparEditingSchemeId[scope] = snapshot.schemeId;
  aparDraft[scope] = { ...(snapshot.tokens || {}) };
  if (scope === 'global') {
    aparDeviceOverrideEnabled.global = !!snapshot.deviceOverrideEnabled;
    aparDeviceOverrides.global = JSON.parse(JSON.stringify(snapshot.deviceOverrides || {}));
  }
}
function aparHasPending(scope = aparScope) {
  return aparStateString(scope) !== aparSavedState[scope];
}
function aparSyncUnsavedState() {
  window.AdminUnsaved?.updateState?.();
}
function aparMarkClean(scope = aparScope) {
  aparSavedState[scope] = aparStateString(scope);
  window.AdminUnsaved?.markClean?.('appearance-colors');
}
function aparMutate(label, mutation, { renderAll = false } = {}) {
  const before = aparSnapshot();
  mutation();
  aparTransientColor = null;
  if (JSON.stringify(before) === aparStateString()) return false;
  aparUndoStack[aparScope].push({ label, snapshot: before });
  if (aparUndoStack[aparScope].length > 40) aparUndoStack[aparScope].shift();
  if (renderAll) aparRenderAll();
  else {
    aparRenderCategories();
    aparRenderPreview();
    aparRenderContrast();
    aparRenderToolbar();
  }
  aparSyncUnsavedState();
  return true;
}
function aparUndoLast() {
  const entry = aparUndoStack[aparScope].pop();
  if (!entry) return;
  aparTransientColor = null;
  aparRestoreSnapshot(entry.snapshot);
  aparRenderAll();
  aparSyncUnsavedState();
  toast(`Cambio deshecho: ${entry.label}`);
}
function aparRegisterUnsavedGuard() {
  if (aparUnsavedRegistered || !window.AdminUnsaved) return;
  window.AdminUnsaved.register('appearance-colors', {
    root: '#section-apariencia',
    serialize: aparAllStateString,
    save: aparSaveDraft,
    active: () => document.getElementById('section-apariencia')?.classList.contains('active'),
    label: 'Apariencia y esquema de colores',
  });
  aparUnsavedRegistered = true;
}

async function aparEnsureBootstrap() {
  if (aparBootstrapped) return;
  aparBootstrapped = true;
  try {
    const appearanceSnap = await getDoc(doc(db, 'settings', 'appearance'));
    let cfg = appearanceSnap.exists() ? appearanceSnap.data() : {};
    let changed = false;
    if (!cfg.activeGlobalSchemeId) { cfg = { ...cfg, activeGlobalSchemeId: 'default-global' }; changed = true; }
    for (const scope of ['global']) {
      const id = APAR_CATALOG[scope].defaultSchemeId;
      const schemeSnap = await getDoc(doc(db, 'colorSchemes', id));
      if (!schemeSnap.exists()) {
        const defaults = buildDefaultTokenMap(APAR_CATALOG[scope].tokens);
        await withAdminSiteChange(async () => setDoc(doc(db, 'colorSchemes', id), {
          scope, name: 'Predeterminado', isDefault: true, active: true,
          tokens: defaults, draftTokens: defaults,
          deviceOverrideEnabled: false, draftDeviceOverrideEnabled: false,
          deviceOverrides: {}, draftDeviceOverrides: {},
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '',
        }));
      }
    }
    if (changed) await withAdminSiteChange(async () => setDoc(doc(db, 'settings', 'appearance'), cfg, { merge: true }));
  } catch (e) { console.error('[apariencia] bootstrap error:', e); }
}

async function loadApariencia() {
  await aparEnsureBootstrap();
  await aparLoadSchemesList('global');
  try {
    const appearanceSnap = await getDoc(doc(db, 'settings', 'appearance'));
    const cfg = appearanceSnap.exists() ? appearanceSnap.data() : {};
    aparActiveSchemeId.global = cfg.activeGlobalSchemeId || 'default-global';
  } catch (e) {
    console.error('[apariencia] no se pudo leer settings/appearance:', e);
    aparActiveSchemeId.global = aparActiveSchemeId.global || 'default-global';
  }
  aparEditingSchemeId.global = aparEditingSchemeId.global || aparActiveSchemeId.global;
  await aparLoadSchemeIntoDraft('global', aparEditingSchemeId.global);
  aparRenderAll();
  aparRegisterUnsavedGuard();
  window.AdminUnsaved?.markClean?.('appearance-colors');

  const searchEl = document.getElementById('apar-search');
  searchEl.value = aparSearchTerm;
  searchEl.oninput = () => { aparSearchTerm = normalizeAdminSearch(searchEl.value); aparRenderCategories(); };
}

async function aparLoadSchemesList(scope) {
  try {
    const q = query(collection(db, 'colorSchemes'), where('scope', '==', scope), limit(100));
    const snap = await getDocs(q);
    aparSchemes[scope] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error('[apariencia] no se pudo listar esquemas', scope, e); aparSchemes[scope] = []; }
}

async function aparLoadSchemeIntoDraft(scope, schemeId) {
  try {
    const snap = await getDoc(doc(db, 'colorSchemes', schemeId));
    const data = snap.exists() ? snap.data() : {};
    aparDraft[scope] = { ...(data.draftTokens || data.tokens || {}) };
    aparPublished[scope] = { ...(data.tokens || {}) };
    if (scope === 'global') {
      aparDeviceOverrideEnabled.global = !!data.draftDeviceOverrideEnabled;
      aparDeviceOverrides.global = data.draftDeviceOverrides || {};
      aparPublishedDeviceOverrideEnabled.global = !!data.deviceOverrideEnabled;
      aparPublishedDeviceOverrides.global = data.deviceOverrides || {};
    }
    aparSavedState[scope] = aparStateString(scope);
    aparUndoStack[scope] = [];
  } catch (e) {
    console.error('[apariencia] no se pudo cargar esquema', schemeId, e);
    aparDraft[scope] = {};
    aparPublished[scope] = {};
    aparSavedState[scope] = aparStateString(scope);
  }
}

async function aparReloadCurrentScheme(scope = aparScope) {
  await aparLoadSchemeIntoDraft(scope, aparEditingSchemeId[scope]);
  aparTransientColor = null;
}

function aparRenderAll() {
  aparRenderSchemeBar();
  aparRenderCategories();
  aparRenderPreview();
  aparRenderContrast();
  aparRenderHistory();
  aparRenderToolbar();
}

function aparRenderToolbar() {
  const el = document.getElementById('apar-toolbar');
  const pending = aparHasPending();
  const undoEntry = aparUndoStack[aparScope][aparUndoStack[aparScope].length - 1];
  el.innerHTML = `
    <span class="tt-store-state-pill" style="background:${pending ? 'var(--admin-color-warning-background)' : 'var(--admin-color-success-background)'};color:${pending ? 'var(--admin-color-warning-text)' : 'var(--admin-color-success-text)'}">${pending ? 'CAMBIOS SIN GUARDAR' : 'SIN CAMBIOS PENDIENTES'}</span>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-undo" ${undoEntry ? '' : 'disabled'} title="${undoEntry ? `Deshacer: ${escapeHtmlAdmin(undoEntry.label)}` : 'No hay cambios para deshacer'}">Deshacer último cambio</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-discard" ${pending ? '' : 'disabled'}>Cancelar cambios</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-save-draft" ${pending ? '' : 'disabled'}>Guardar borrador</button>
    <button type="button" class="adm-btn adm-btn-primary adm-btn-sm" id="apar-btn-publish">Publicar cambios</button>
  `;
  document.getElementById('apar-btn-undo').onclick = aparUndoLast;
  document.getElementById('apar-btn-save-draft').onclick = aparSaveDraft;
  document.getElementById('apar-btn-publish').onclick = aparPublish;
  document.getElementById('apar-btn-discard').onclick = aparDiscard;
}

function aparRenderSchemeBar() {
  const el = document.getElementById('apar-scheme-bar');
  const list = aparSchemes[aparScope] || [];
  const editingId = aparEditingSchemeId[aparScope];
  const activeId = aparActiveSchemeId[aparScope];
  const opts = list.map(s => `<option value="${s.id}" ${s.id === editingId ? 'selected' : ''}>${escapeHtmlAdmin(s.name)}${s.id === activeId ? ' (activo)' : ''}</option>`).join('');
  el.innerHTML = `
    <label style="font-size:12px;font-weight:700;color:var(--adm-muted)">Esquema:</label>
    <select class="adm-select" id="apar-scheme-select" style="max-width:220px">${opts}</select>
    ${editingId === activeId ? '<span class="tt-store-state-pill">ACTIVO</span>' : `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm" id="apar-btn-activate">Activar este esquema</button>`}
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-new">+ Nuevo</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-duplicate">Duplicar</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-rename">Renombrar</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-export">Exportar</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-import">Importar</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="apar-btn-reset-all">Restablecer</button>
    ${list.length > 1 && !list.find(s => s.id === editingId)?.isDefault ? '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" id="apar-btn-delete">Eliminar</button>' : ''}
  `;
  document.getElementById('apar-scheme-select').onchange = async e => {
    const previousId = aparEditingSchemeId[aparScope];
    const nextId = e.target.value;
    if (nextId === previousId) return;
    if (aparHasPending()) {
      const leave = confirm('Hay cambios sin guardar en este esquema. Si elegís otro se descartarán. ¿Continuar?');
      if (!leave) {
        e.target.value = previousId;
        return;
      }
    }
    aparEditingSchemeId[aparScope] = nextId;
    await aparLoadSchemeIntoDraft(aparScope, nextId);
    aparRenderAll();
    window.AdminUnsaved?.markClean?.('appearance-colors');
  };
  const btnActivate = document.getElementById('apar-btn-activate');
  if (btnActivate) btnActivate.onclick = aparActivateScheme;
  document.getElementById('apar-btn-new').onclick = aparCreateScheme;
  document.getElementById('apar-btn-duplicate').onclick = aparDuplicateScheme;
  document.getElementById('apar-btn-rename').onclick = aparRenameScheme;
  document.getElementById('apar-btn-export').onclick = aparExportScheme;
  document.getElementById('apar-btn-import').onclick = aparImportScheme;
  document.getElementById('apar-btn-reset-all').onclick = aparResetAll;
  const btnDelete = document.getElementById('apar-btn-delete');
  if (btnDelete) btnDelete.onclick = aparDeleteScheme;
}

function aparRenderCategories() {
  const container = document.getElementById('apar-categories');
  const { tokens, categories } = aparCatalog();
  const term = aparSearchTerm;
  container.innerHTML = '';

  if (aparScope === 'global') {
    const devRow = document.createElement('div');
    devRow.className = 'adm-card';
    devRow.style.marginBottom = '12px';
    devRow.innerHTML = `
      <div class="adm-card-body" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="adm-toggle"><input type="checkbox" id="apar-device-toggle" ${aparDeviceOverrideEnabled.global ? 'checked' : ''}><span></span></label>
        <span style="font-size:13px;font-weight:700">Personalizar colores por dispositivo</span>
        <span style="font-size:12px;color:var(--adm-muted)">Desactivado: todas las pantallas usan el esquema global. Activado: podés sobrescribir valores puntuales por resolución (lo no sobrescrito hereda del esquema general).</span>
      </div>
      <div id="apar-device-tabs" style="display:${aparDeviceOverrideEnabled.global ? 'flex' : 'none'};gap:6px;flex-wrap:wrap;padding:0 16px 14px"></div>
    `;
    container.appendChild(devRow);
    document.getElementById('apar-device-toggle').onchange = e => {
      const enabled = e.target.checked;
      aparMutate(
        enabled ? 'activar colores por dispositivo' : 'desactivar colores por dispositivo',
        () => { aparDeviceOverrideEnabled.global = enabled; }
      );
    };
    if (aparDeviceOverrideEnabled.global) {
      const tabsEl = devRow.querySelector('#apar-device-tabs');
      tabsEl.style.display = 'flex';
      tabsEl.innerHTML = DEVICE_BREAKPOINTS.map(bp =>
        `<button type="button" class="adm-btn ${bp.key === aparDeviceTab ? 'adm-btn-primary' : 'adm-btn-outline'} adm-btn-sm" data-dev="${bp.key}">${bp.label}</button>`
      ).join('');
      tabsEl.querySelectorAll('[data-dev]').forEach(btn => {
        btn.onclick = () => { aparDeviceTab = btn.dataset.dev; aparRenderCategories(); };
      });
    }
  }

  const overrideMap = (aparScope === 'global' && aparDeviceOverrideEnabled.global)
    ? (aparDeviceOverrides.global[aparDeviceTab] || (aparDeviceOverrides.global[aparDeviceTab] = {}))
    : null;
  const editingOverride = overrideMap !== null;

  categories.forEach(cat => {
    const allCatTokens = tokens.filter(t => t.category === cat.key);
    const catTokens = allCatTokens.filter(t => !term ||
      normalizeAdminSearch(t.label).includes(term) || normalizeAdminSearch(t.key).includes(term) || normalizeAdminSearch(cat.label).includes(term));
    if (!catTokens.length) return;
    const details = document.createElement('details');
    details.open = !!term;
    details.className = 'adm-card';
    details.style.marginBottom = '10px';
    const summary = document.createElement('summary');
    summary.style.cssText = 'cursor:pointer;padding:12px 16px;font-weight:800;font-size:13px;color:var(--adm-text);display:flex;justify-content:space-between;align-items:center';
    summary.innerHTML = `<span>${cat.label} <span style="font-weight:400;color:var(--adm-muted)">(${catTokens.length})</span></span><button type="button" class="adm-btn adm-btn-outline adm-btn-sm" data-reset-cat="${cat.key}" style="font-size:10px">Restablecer categoría</button>`;
    details.appendChild(summary);
    const body = document.createElement('div');
    body.style.cssText = 'padding:4px 16px 14px';
    catTokens.forEach(tok => body.appendChild(aparBuildTokenRow(tok, overrideMap, editingOverride)));
    details.appendChild(body);
    container.appendChild(details);
    summary.querySelector('[data-reset-cat]').addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (!confirm(`¿Restablecer todos los colores de "${cat.label}" a su valor por defecto?`)) return;
      aparMutate(`restablecer la categoría ${cat.label}`, () => {
        allCatTokens.forEach(t => {
          if (editingOverride) delete overrideMap[t.key];
          else aparDraft[aparScope][t.key] = t.default;
        });
      });
    });
  });

  if (!container.children.length) {
    container.innerHTML += '<p style="font-size:13px;color:var(--adm-muted);padding:12px">No se encontraron configuraciones para esa búsqueda.</p>';
  }
}

function aparBuildTokenRow(tok, overrideMap, editingOverride) {
  const row = document.createElement('div');
  row.className = 'apar-token-row';
  row.style.cssText = 'display:grid;grid-template-columns:auto minmax(120px,1fr) auto auto;align-items:center;gap:8px 10px;padding:9px 0;border-bottom:1px solid var(--adm-border)';
  const isInherited = editingOverride && (overrideMap[tok.key] == null);
  const currentVal = aparResolve(tok.key, editingOverride ? overrideMap : null, editingOverride ? aparDeviceTab : null);
  const resetValue = editingOverride ? (aparDraft[aparScope][tok.key] || tok.default) : tok.default;
  const impact = aparTokenImpact(tok);
  row.innerHTML = `
    <button type="button" class="tcp-swatch" data-tcp-swatch="1" style="background:${currentVal}" aria-label="Editar ${tok.label}" title="Editar color"></button>
    <div style="flex:1;min-width:0">
      <div style="font-size:12.5px;font-weight:600;color:var(--adm-text)">${tok.label}${isInherited ? ' <span style=\"font-weight:400;color:var(--adm-muted);font-size:10.5px\">(heredado)</span>' : ''}</div>
      <div style="font-size:10.5px;color:var(--adm-muted);font-family:'Montserrat'">${tok.cssVar}</div>
    </div>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" style="font-size:10.5px;min-width:78px;padding-inline:8px" data-val-label aria-label="Editar valor ${currentVal}">${currentVal}</button>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" data-reset title="Restablecer solamente ${tok.label}" aria-label="Restablecer solamente ${tok.label}">↺</button>
    <div class="apar-token-impact" style="grid-column:2 / -1;font-size:10px;line-height:1.35;color:var(--adm-muted)"><strong>Impacta:</strong> ${impact}.</div>
  `;
  const swatch = row.querySelector('[data-tcp-swatch]');
  const valLabel = row.querySelector('[data-val-label]');
  const deviceKey = editingOverride ? aparDeviceTab : null;
  const picker = attachColorPicker(swatch, {
    value: currentVal,
    defaultValue: resetValue,
    label: tok.label,
    cssVar: tok.cssVar,
    impact,
    onPreview(v) {
      aparTransientColor = { scope: aparScope, key: tok.key, value: v, deviceKey };
      valLabel.textContent = v;
      valLabel.setAttribute('aria-label', `Editar valor ${v}`);
      if (deviceKey) aparPreviewDevice = deviceKey;
      aparRenderPreview(); aparRenderContrast();
    },
    onCancel() {
      aparTransientColor = null;
      valLabel.textContent = currentVal;
      valLabel.setAttribute('aria-label', `Editar valor ${currentVal}`);
      aparRenderPreview(); aparRenderContrast();
    },
    onConfirm(v) {
      aparTransientColor = null;
      aparMutate(`cambiar ${tok.label}`, () => {
        if (editingOverride) overrideMap[tok.key] = v;
        else aparDraft[aparScope][tok.key] = v;
      });
    },
  });
  valLabel.addEventListener('click', () => picker.open());
  row.querySelector('[data-reset]').addEventListener('click', () => {
    aparMutate(`restablecer ${tok.label}`, () => {
      if (editingOverride) delete overrideMap[tok.key];
      else aparDraft[aparScope][tok.key] = tok.default;
    });
  });
  return row;
}

function aparRenderPreview() {
  const devices = [
    { key: 'desktop', label: 'Desktop', w: 960 },
    { key: 'laptop', label: 'Laptop', w: 760 },
    { key: 'tablet', label: 'Tablet', w: 560 },
    { key: 'mobile', label: 'Mobile', w: 360 },
    { key: 'miniMobile', label: 'Mini', w: 280 },
  ];
  const devEl = document.getElementById('apar-preview-devices');
  devEl.innerHTML = devices.map(d => `<button type="button" class="adm-btn ${d.key === aparPreviewDevice ? 'adm-btn-primary' : 'adm-btn-outline'} adm-btn-sm" data-pdev="${d.key}">${d.label}</button>`).join('');
  devEl.querySelectorAll('[data-pdev]').forEach(btn => { btn.onclick = () => { aparPreviewDevice = btn.dataset.pdev; aparRenderPreview(); }; });
  const frame = document.getElementById('apar-preview-frame');
  const dev = devices.find(d => d.key === aparPreviewDevice) || devices[0];
  frame.style.width = dev.w + 'px';

  const R = APAR_PREVIEW_ROLES[aparScope];
  const c = key => aparResolvePreview(R[key]);
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;font-family:'Montserrat'}
    body{margin:0;padding:18px;background:${c('bgPage')};color:${c('textPrimary')}}
    h2{font-family:'Montserrat';color:${c('textTitle')};margin:0 0 4px}
    p.sub{color:${c('textSecondary')};font-size:13px;margin:0 0 16px}
    .card{background:${c('bgSurface')};border:1px solid ${c('cardBorder')};border-radius:12px;padding:14px;margin-bottom:12px}
    .row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
    .btn{padding:9px 16px;border-radius:8px;font-size:12.5px;font-weight:700;border:none;cursor:pointer}
    .btn-p{background:${c('btnPrimaryBg')};color:${c('btnPrimaryText')}}
    .btn-s{background:${c('btnSecondaryBg')};color:${c('btnSecondaryText')};border:2px solid ${c('btnSecondaryBorder')}}
    input{padding:8px 10px;border-radius:8px;border:1px solid ${c('fieldBorder')};background:${c('fieldBg')};color:${c('fieldText')};font-size:12.5px;width:100%;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
    th{background:${c('tableHeaderBg')};color:${c('tableHeaderText')};padding:7px;text-align:left;border:1px solid ${c('tableBorder')}}
    td{padding:7px;border:1px solid ${c('tableBorder')}}
    .alert{padding:10px 12px;border-radius:8px;font-size:12.5px;font-weight:600;margin-bottom:8px}
    .a-success{background:${c('successBg')};color:${c('successText')}}
    .a-error{background:${c('errorBg')};color:${c('errorText')}}
    .a-warning{background:${c('warningBg')};color:${c('warningText')}}
    a{color:${c('link')}}
    .badge{display:inline-block;padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:800;background:${c('badgeBg')};color:${c('badgeText')}}
    .menu{display:flex;gap:14px;padding:10px 14px;border:1px solid ${c('border')};border-radius:10px;margin-bottom:12px;font-size:12.5px}
  </style></head><body>
    <h2>Título de ejemplo</h2>
    <p class="sub">Texto secundario de ejemplo — así se ve la tipografía.</p>
    <div class="menu"><a href="#">Inicio</a><a href="#">Catálogo</a><a href="#">Contacto</a></div>
    <div class="row">
      <button class="btn btn-p">Botón principal</button>
      <button class="btn btn-s">Botón secundario</button>
      <span class="badge">NUEVO</span>
    </div>
    <div class="card">
      <p style="margin:0 0 8px;font-size:13px">Tarjeta de ejemplo con texto principal y <a href="#">un enlace</a>.</p>
      <input placeholder="Campo de ejemplo">
    </div>
    <table><tr><th>Producto</th><th>Precio</th></tr><tr><td>Reloj Ámbar</td><td>Gs. 85.000</td></tr></table>
    <div class="alert a-success">Estado de éxito</div>
    <div class="alert a-error">Estado de error</div>
    <div class="alert a-warning">Estado de advertencia</div>
  </body></html>`;
}

function aparRenderContrast() {
  const el = document.getElementById('apar-contrast-list');
  const { pairs } = aparCatalog();
  const overrideMap = aparEditingOverrideMap();
  el.innerHTML = pairs.map(p => {
    const fg = aparResolve(p.fg, overrideMap, overrideMap ? aparDeviceTab : null);
    const bg = aparResolve(p.bg, overrideMap, overrideMap ? aparDeviceTab : null);
    const ratio = contrastRatio(fg, bg);
    const ok = passesWcag(ratio, p.level);
    const min = p.level === 'normal' ? '4.5' : '3';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--adm-border)">
      <span>${p.label}</span>
      <span style="font-weight:700;color:${ok ? 'var(--admin-color-success-text)' : 'var(--admin-color-error-text)'}">${ratio ? ratio.toFixed(2) : '?'}:1 ${ok ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><polyline points="20 6 9 17 4 12"/></svg>' : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="vertical-align:-1px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> (mín ${min}:1)`}</span>
    </div>`;
  }).join('');
}

async function aparRenderHistory() {
  const el = document.getElementById('apar-history-list');
  el.innerHTML = '<p style="color:var(--adm-muted)">Cargando...</p>';
  try {
    const schemeId = aparEditingSchemeId[aparScope];
    const snap = await getDocs(query(collection(db, 'colorSchemes', schemeId, 'history'), orderBy('at', 'desc'), limit(10)));
    if (snap.empty) { el.innerHTML = '<p style="color:var(--adm-muted)">Sin cambios registrados todavía.</p>'; return; }
    el.innerHTML = snap.docs.map(d => {
      const h = d.data();
      const when = h.at?.toDate ? h.at.toDate().toLocaleString('es-PY') : '';
      const actionLabel = { publish: 'Publicado', restore: 'Restaurado', 'save-draft': 'Borrador guardado', create: 'Creado', activate: 'Activado' }[h.action] || h.action;
      return `<div style="padding:7px 0;border-bottom:1px solid var(--adm-border)">
        <div style="font-weight:700">${actionLabel}</div>
        <div style="color:var(--adm-muted)">${when} — ${escapeHtmlAdmin(h.byEmail || '')}</div>
        ${h.action === 'publish' ? `<button type="button" class="adm-btn adm-btn-outline adm-btn-sm" data-restore="${d.id}" style="margin-top:4px;font-size:10px">Restaurar esta versión</button>` : ''}
      </div>`;
    }).join('');
    el.querySelectorAll('[data-restore]').forEach(btn => {
      btn.onclick = () => aparRestoreVersion(btn.dataset.restore);
    });
  } catch (e) { console.error('[apariencia] historial error', e); el.innerHTML = '<p style="color:var(--adm-muted)">No se pudo cargar el historial.</p>'; }
}

async function aparLogHistory(schemeId, action, before, after) {
  try {
    await withAdminSiteChange(async () => addDoc(collection(db, 'colorSchemes', schemeId, 'history'), {
      at: serverTimestamp(), byUid: currentUser?.uid || '', byEmail: currentUser?.email || '',
      action, before: before || {}, after: after || {},
    }));
  } catch (e) { console.error('[apariencia] no se pudo registrar historial:', e); }
}

function aparPublishedChanges() {
  const changedTokens = aparCatalog().tokens.filter(tok =>
    (aparDraft[aparScope][tok.key] || tok.default) !== (aparPublished[aparScope][tok.key] || tok.default)
  );
  const devicesChanged = aparScope === 'global' && (
    aparDeviceOverrideEnabled.global !== aparPublishedDeviceOverrideEnabled.global ||
    JSON.stringify(aparDeviceOverrides.global || {}) !== JSON.stringify(aparPublishedDeviceOverrides.global || {})
  );
  return { changedTokens, devicesChanged };
}

function aparPublishImpactMessage(changedTokens, devicesChanged) {
  const categories = [...new Set(changedTokens.map(tok => tok.category))];
  const impacts = categories.map(category => APAR_CATEGORY_IMPACT[aparScope]?.[category]).filter(Boolean);
  const shown = changedTokens.slice(0, 10).map(tok => `• ${tok.label} (${tok.cssVar})`).join('\n');
  const remaining = changedTokens.length > 10 ? `\n• y ${changedTokens.length - 10} colores más` : '';
  const scopeText = 'toda Tintín: tienda, cuenta, checkout y administración';
  return `Se publicarán ${changedTokens.length} color(es)${devicesChanged ? ' y cambios por dispositivo' : ''} en ${scopeText}.

${shown || '• Configuración por dispositivo'}${remaining}

Impacto compartido:
${impacts.map(impact => `• ${impact}`).join('\n') || '• componentes que consumen estos tokens globales'}

La vista previa y la plataforma usarán exactamente estos valores. ¿Confirmás la publicación?`;
}

async function aparSaveDraft() {
  const schemeId = aparEditingSchemeId[aparScope];
  const patch = { draftTokens: aparDraft[aparScope], updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '' };
  if (aparScope === 'global') {
    patch.draftDeviceOverrideEnabled = aparDeviceOverrideEnabled.global;
    patch.draftDeviceOverrides = aparDeviceOverrides.global;
  }
  try {
    await withAdminSiteChange(async () => setDoc(doc(db, 'colorSchemes', schemeId), patch, { merge: true }));
    await aparLogHistory(schemeId, 'save-draft', {}, aparDraft[aparScope]);
    aparMarkClean();
    toast('Borrador guardado');
    aparRenderHistory();
    aparRenderToolbar();
    return true;
  } catch (e) {
    toast('Error al guardar borrador: ' + e.message);
    return false;
  }
}

async function aparPublish() {
  const { pairs } = aparCatalog();
  const contrastContexts = [{ label: 'general', map: null, deviceKey: null }];
  if (aparScope === 'global' && aparDeviceOverrideEnabled.global) {
    DEVICE_BREAKPOINTS.forEach(device => {
      contrastContexts.push({
        label: device.label,
        map: aparDeviceOverrides.global[device.key] || null,
        deviceKey: device.key,
      });
    });
  }
  const failing = [];
  contrastContexts.forEach(context => {
    pairs.forEach(pair => {
      const ratio = contrastRatio(
        aparResolve(pair.fg, context.map, context.deviceKey),
        aparResolve(pair.bg, context.map, context.deviceKey)
      );
      if (!passesWcag(ratio, pair.level)) failing.push(`${pair.label} (${context.label})`);
    });
  });
  if (failing.length && !confirm(`${failing.length} combinación(es) no cumplen el contraste mínimo WCAG:

${failing.slice(0, 12).join('\n')}${failing.length > 12 ? `\n… y ${failing.length - 12} más` : ''}

¿Publicar de todas formas?`)) return false;
  const { changedTokens, devicesChanged } = aparPublishedChanges();
  if (!changedTokens.length && !devicesChanged) {
    toast('No hay cambios nuevos para publicar');
    return true;
  }
  if (!confirm(aparPublishImpactMessage(changedTokens, devicesChanged))) return false;
  const schemeId = aparEditingSchemeId[aparScope];
  try {
    const before = (await getDoc(doc(db, 'colorSchemes', schemeId))).data()?.tokens || {};
    const patch = {
      tokens: aparDraft[aparScope], draftTokens: aparDraft[aparScope],
      updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '',
      publishedAt: serverTimestamp(), publishedBy: currentUser?.email || '',
    };
    if (aparScope === 'global') {
      patch.deviceOverrideEnabled = aparDeviceOverrideEnabled.global;
      patch.deviceOverrides = aparDeviceOverrides.global;
      patch.draftDeviceOverrideEnabled = aparDeviceOverrideEnabled.global;
      patch.draftDeviceOverrides = aparDeviceOverrides.global;
    }
    await withAdminSiteChange(async () => setDoc(doc(db, 'colorSchemes', schemeId), patch, { merge: true }));
    await aparLogHistory(schemeId, 'publish', before, aparDraft[aparScope]);
    aparPublished[aparScope] = { ...aparDraft[aparScope] };
    if (aparScope === 'global') {
      aparPublishedDeviceOverrideEnabled.global = aparDeviceOverrideEnabled.global;
      aparPublishedDeviceOverrides.global = JSON.parse(JSON.stringify(aparDeviceOverrides.global || {}));
    }
    aparMarkClean();
    toast('Cambios publicados — ya están en vivo en toda la plataforma');
    aparRenderHistory();
    aparRenderToolbar();
    return true;
  } catch (e) {
    toast('Error al publicar: ' + e.message);
    return false;
  }
}

async function aparDiscard() {
  if (!confirm('¿Cancelar los cambios actuales y volver a la última versión publicada?')) return false;
  try {
    const snap = await getDoc(doc(db, 'colorSchemes', aparEditingSchemeId[aparScope]));
    const data = snap.exists() ? snap.data() : {};
    aparDraft[aparScope] = { ...(data.tokens || {}) };
    aparPublished[aparScope] = { ...(data.tokens || {}) };
    if (aparScope === 'global') {
      aparDeviceOverrideEnabled.global = !!data.deviceOverrideEnabled;
      aparDeviceOverrides.global = data.deviceOverrides || {};
      aparPublishedDeviceOverrideEnabled.global = !!data.deviceOverrideEnabled;
      aparPublishedDeviceOverrides.global = data.deviceOverrides || {};
    }
  } catch (e) {
    toast('Error al cancelar: ' + e.message);
    return false;
  }
  aparUndoStack[aparScope] = [];
  aparMarkClean();
  aparRenderAll();
  toast('Cambios cancelados');
  return true;
}

function aparResetAll() {
  if (!confirm('¿Restablecer TODO el esquema a los valores predeterminados del sistema? No se publicará hasta que confirmes “Publicar cambios”.')) return;
  aparMutate('restablecer todo el esquema', () => {
    aparDraft[aparScope] = aparDefaultMap();
    if (aparScope === 'global') {
      aparDeviceOverrideEnabled.global = false;
      aparDeviceOverrides.global = {};
    }
  }, { renderAll: true });
}

async function aparRestoreVersion(entryId) {
  if (!confirm('¿Restaurar esta versión anterior como borrador? Vas a poder revisarla antes de publicar.')) return;
  try {
    const snap = await getDoc(doc(db, 'colorSchemes', aparEditingSchemeId[aparScope], 'history', entryId));
    if (!snap.exists()) return;
    const h = snap.data();
    aparMutate('restaurar una versión del historial', () => {
      aparDraft[aparScope] = { ...(h.after || h.before || {}) };
    }, { renderAll: true });
    toast('Versión cargada en el borrador — revisá y publicá si está bien');
  } catch (e) { toast('Error al restaurar: ' + e.message); }
}

async function aparActivateScheme() {
  const schemeId = aparEditingSchemeId[aparScope];
  const field = 'activeGlobalSchemeId';
  if (aparHasPending() && !confirm('Este esquema tiene cambios sin publicar. Al activarlo se usará la última versión publicada, no el borrador actual. ¿Continuar?')) return;
  try {
    await withAdminSiteChange(async () => setDoc(doc(db, 'settings', 'appearance'), { [field]: schemeId }, { merge: true }));
    await aparLogHistory(schemeId, 'activate', {}, {});
    aparActiveSchemeId[aparScope] = schemeId;
    toast('Esquema activado');
    aparRenderSchemeBar();
  } catch (e) { toast('Error al activar esquema: ' + e.message); }
}

async function aparCreateScheme() {
  const name = prompt('Nombre del nuevo esquema:');
  if (!name || !name.trim()) return;
  const defaults = aparDefaultMap();
  try {
    const ref = await withAdminSiteChange(async () => addDoc(collection(db, 'colorSchemes'), {
      scope: aparScope, name: name.trim(), isDefault: false, active: false,
      tokens: defaults, draftTokens: defaults,
      deviceOverrideEnabled: false, draftDeviceOverrideEnabled: false, deviceOverrides: {}, draftDeviceOverrides: {},
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '',
    }));
    await aparLoadSchemesList(aparScope);
    aparEditingSchemeId[aparScope] = ref.id;
    await aparLoadSchemeIntoDraft(aparScope, ref.id);
    aparRenderAll();
    window.AdminUnsaved?.markClean?.('appearance-colors');
    toast('Esquema creado');
  } catch (e) { toast('Error al crear esquema: ' + e.message); }
}

async function aparDuplicateScheme() {
  const src = aparSchemes[aparScope].find(s => s.id === aparEditingSchemeId[aparScope]);
  const name = prompt('Nombre para la copia:', (src?.name || 'Esquema') + ' (copia)');
  if (!name || !name.trim()) return;
  try {
    const ref = await withAdminSiteChange(async () => addDoc(collection(db, 'colorSchemes'), {
      scope: aparScope, name: name.trim(), isDefault: false, active: false,
      tokens: { ...aparDraft[aparScope] }, draftTokens: { ...aparDraft[aparScope] },
      deviceOverrideEnabled: aparScope === 'global' ? aparDeviceOverrideEnabled.global : false,
      draftDeviceOverrideEnabled: aparScope === 'global' ? aparDeviceOverrideEnabled.global : false,
      deviceOverrides: aparScope === 'global' ? aparDeviceOverrides.global : {},
      draftDeviceOverrides: aparScope === 'global' ? aparDeviceOverrides.global : {},
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '',
    }));
    await aparLoadSchemesList(aparScope);
    aparEditingSchemeId[aparScope] = ref.id;
    await aparLoadSchemeIntoDraft(aparScope, ref.id);
    aparRenderAll();
    window.AdminUnsaved?.markClean?.('appearance-colors');
    toast('Esquema duplicado');
  } catch (e) { toast('Error al duplicar: ' + e.message); }
}

async function aparRenameScheme() {
  const schemeId = aparEditingSchemeId[aparScope];
  const current = aparSchemes[aparScope].find(s => s.id === schemeId);
  const name = prompt('Nuevo nombre:', current?.name || '');
  if (!name || !name.trim()) return;
  try {
    await withAdminSiteChange(async () => setDoc(doc(db, 'colorSchemes', schemeId), { name: name.trim() }, { merge: true }));
    await aparLoadSchemesList(aparScope);
    aparRenderSchemeBar();
    toast('Esquema renombrado');
  } catch (e) { toast('Error al renombrar: ' + e.message); }
}

async function aparDeleteScheme() {
  const schemeId = aparEditingSchemeId[aparScope];
  const current = aparSchemes[aparScope].find(s => s.id === schemeId);
  if (current?.isDefault) { toast('No se puede eliminar el esquema predeterminado'); return; }
  if (schemeId === aparActiveSchemeId[aparScope]) { toast('No se puede eliminar el esquema activo — activá otro primero'); return; }
  if (!confirm(`¿Eliminar el esquema "${current?.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await withAdminSiteChange(async () => deleteDoc(doc(db, 'colorSchemes', schemeId)));
    aparEditingSchemeId[aparScope] = APAR_CATALOG[aparScope].defaultSchemeId;
    await aparLoadSchemesList(aparScope);
    await aparLoadSchemeIntoDraft(aparScope, aparEditingSchemeId[aparScope]);
    aparRenderAll();
    window.AdminUnsaved?.markClean?.('appearance-colors');
    toast('Esquema eliminado');
  } catch (e) { toast('Error al eliminar: ' + e.message); }
}

function aparExportScheme() {
  const schemeId = aparEditingSchemeId[aparScope];
  const current = aparSchemes[aparScope].find(s => s.id === schemeId);
  const payload = {
    scope: aparScope, name: current?.name || 'Esquema', tokens: aparDraft[aparScope],
    deviceOverrideEnabled: aparScope === 'global' ? aparDeviceOverrideEnabled.global : undefined,
    deviceOverrides: aparScope === 'global' ? aparDeviceOverrides.global : undefined,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tintin-esquema-${aparScope}-${(current?.name || 'esquema').replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function aparImportScheme() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.tokens !== 'object') { toast('El archivo no tiene un formato de esquema válido'); return; }
        const { tokens: catalogTokens } = aparCatalog();
        const validKeys = new Set(catalogTokens.map(t => t.key));
        const clean = {};
        let invalidCount = 0;
        Object.entries(data.tokens).forEach(([k, v]) => {
          if (!validKeys.has(k)) return;
          if (typeof v === 'string' && isValidColorLocal(v)) clean[k] = v; else invalidCount++;
        });
        const cleanDeviceOverrides = {};
        if (aparScope === 'global' && data.deviceOverrides && typeof data.deviceOverrides === 'object') {
          const validDevices = new Set(DEVICE_BREAKPOINTS.map(device => device.key));
          Object.entries(data.deviceOverrides).forEach(([deviceKey, values]) => {
            if (!validDevices.has(deviceKey) || !values || typeof values !== 'object') return;
            cleanDeviceOverrides[deviceKey] = {};
            Object.entries(values).forEach(([key, value]) => {
              if (validKeys.has(key) && typeof value === 'string' && isValidColorLocal(value)) {
                cleanDeviceOverrides[deviceKey][key] = value;
              } else {
                invalidCount++;
              }
            });
          });
        }
        aparMutate('importar un esquema de colores', () => {
          aparDraft[aparScope] = { ...aparDraft[aparScope], ...clean };
          if (aparScope === 'global' && data.deviceOverrideEnabled != null) {
            aparDeviceOverrideEnabled.global = !!data.deviceOverrideEnabled;
            aparDeviceOverrides.global = cleanDeviceOverrides;
          }
        }, { renderAll: true });
        toast(`Esquema importado (${Object.keys(clean).length} colores)${invalidCount ? `, ${invalidCount} valores inválidos ignorados` : ''}`);
      } catch (e) { toast('El archivo no es un JSON válido'); }
    };
    reader.readAsText(file);
  };
  input.click();
}
function isValidColorLocal(v) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) || /^rgba?\(/i.test(v) || /^hsla?\(/i.test(v);
}
