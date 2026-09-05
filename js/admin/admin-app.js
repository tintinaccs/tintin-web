Warning: truncated output (original token count: 106678)
Total output lines: 8189

import { auth, db, appCheckReady } from "../core/firebase/firebase.js?v=tintin-20260904-auth-tab-session-fix-1";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, addDoc,
  query, orderBy, limit, where, writeBatch, serverTimestamp, increment, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { sendTestCustomerEmail, sendTemplatedEmail, sendBulkTemplatedEmail } from "../email/notificaciones-correo.js?v=tintin-20260716-cloudinary-fix-2";
// El reenvío de correos de pedido usa el mismo camino por Resend que el envío
// automático del checkout (js/pages/checkout/checkout-puente-correo.js), no el webhook viejo
// de Apps Script de notificaciones-correo.js — evita reenviar por un canal que ya no
// se usa para pedidos reales.
import { sendOrderNotification } from "../email/notificacion-pedido-resend.js?v=tintin-20260814-social-notifications-2";
import { getUserRole, SUPER_ADMIN, ROLE_LABELS, can } from "../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-2";
import { ASSIGNABLE_ROLES } from '../core/auth/contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';
import {
  PERMISSION_MODULES, EDITABLE_ROLES, loadRolePermissions, getRolePermissionsCache,
  canDo, saveRolePermissions, buildDefaultRolePermissions
} from "../core/auth/permisos-roles.js?v=tintin-20260821-accounts-phase-a-2";
import { EMAIL_WEBHOOK_URL } from "../email/configuracion-correo.js?v=tintin-20260716-cloudinary-fix-1";
import { getStoreAccessConfig, isAccessAllowed, renderStoreClosedOverlay } from "../core/store-gate/nucleo-control-tienda.js?v=tintin-20260903-store-gate-fast-rest-3";
import { normalizeCollectionDoc } from "../pages/collections/estado-colecciones.js?v=tintin-20260901-firestore-budget-2";
import { sanitizeImageUrl } from "../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1";
import { sanitizeVariantData } from "../core/auth/utilidades-seguridad.js?v=tintin-20260716-cloudinary-fix-1";
import { getDocsPaginated } from "../core/firebase/paginacion-firestore.js?v=tintin-20260716-cloudinary-fix-1";
import { attachImageUploadWidget } from "../components/images/carga-imagenes.js?v=tintin-20260901-media-orphan-log-3";
import { openMediaLibraryPicker } from "./products/biblioteca-multimedia-admin.js?v=tintin-20260901-media-orphan-scan-2";
import { initSiteDiagnostics } from "./diagnostics/diagnostico-sitio-admin.js?v=tintin-20260821-accounts-phase-a-2";
import "./pages/paginas-admin.js?v=tintin-20260825-pages-3";
import { PARAGUAY_LOCATIONS, FITOXPRESS_DELIVERY_CITIES } from "../components/location/ubicaciones-paraguay.js?v=tintin-20260725-paraguay-locations-1";
import {
  GLOBAL_TOKENS, GLOBAL_CATEGORIES, ADMIN_TOKENS, ADMIN_CATEGORIES,
  GLOBAL_CONTRAST_PAIRS, ADMIN_CONTRAST_PAIRS, DEVICE_BREAKPOINTS,
  findTokenByKey, buildDefaultTokenMap
} from "../components/color/esquema-color-catalogo.js?v=tintin-20260716-cloudinary-fix-1";
import { contrastRatio, passesWcag } from "../components/color/utilidades-contraste-color.js?v=tintin-20260716-cloudinary-fix-1";
import { attachColorPicker } from "../components/color/selector-color.js?v=tintin-20260716-cloudinary-fix-1";
import './orders/pedidos-superadmin-crud.js?v=tintin-20260821-accounts-phase-a-2';

// ---- GLOBALS ----
let currentUser = null;
let currentRole = null;
let allUsers = [];
let allOrders = [];
let adminOrdersUnsubscribe = null;
let adminUsersUnsubscribe = null;
// Nunca volver a descargar miles de documentos al abrir el panel. El panel
// debe trabajar con la ventana operativa reciente; las fichas y exportaciones
// consultan el documento o la página concreta que se necesita.
const ADMIN_REALTIME_LIMIT = 250;
// Cada bandera indica si esa consulta ya resolvió al menos una vez con éxito.
// Sirve para NO mostrar "0" cuando en realidad la consulta está cargando o
// falló (permisos/conexión) — en ese caso el indicador muestra "—", igual que
// los de pedidos/usuarios, y así se diferencia "vacío" de "error/cargando".
let adminRealtimeReady = { orders: false, users: false, products: false, traffic: false, presence: false };
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
const SHEETS_PRODUCT_SYNC_URL = '/api/sheets-product-sync';

async function pushProductsToSheets(productIds) {
  const ids = [...new Set((productIds || []).map(id => String(id || '').trim()).filter(Boolean))];
  if (!ids.length || currentRole !== 'superadmin' || currentUser?.email !== SUPER_ADMIN) return false;
  try {
    const idToken = await currentUser.getIdToken();
    for (let i = 0; i < ids.length; i += 100) {
      await fetch(SHEETS_PRODUCT_SYNC_URL, {
        method: 'POST',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncProducts',
          productIds: ids.slice(i, i + 100),
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

function escapeHtmlAdmin(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function inlineArgumentAdmin(value) {
  return escapeHtmlAdmin(JSON.stringify(String(value ?? '')));
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
  preparando:   'En preparación',
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
  pendiente:   'Pago pendiente',
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
function toast(msg, duration = 3000) {
  const el = document.getElementById('adm-toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
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
    await addDoc(collection(db, 'auditLog'), {
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
    });
  } catch (e) {
    console.error('No se pudo registrar en auditLog:', e);
  }
}

const AUDIT_ACTION_LABELS = {
  editar_pedido:          '📋 Editó pedido',
  cambiar_estado_pedido:  '🔄 Cambió estado de pedido',
  cambiar_estado_pago:    '💳 Cambió estado de pago',
  reenviar_correo_pedido: '✉️ Reenvió correo de pedido',
  eliminar_pedido:        '🗑️ Eliminó pedido',
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
    return `
      <tr>
        <td class="col-select"><input type="checkbox" class="audit-row-check" data-id="${escapeHtmlAdmin(l.id)}" onclick="toggleAuditSelect(this)" ${_selectedAuditLogs.has(l.id) ? 'checked' : ''}></td>
        <td style="white-space:nowrap;font-size:12px">${formatDate(l.createdAt)}</td>
        <td style="font-size:12px">${escapeHtmlAdmin(l.actorEmail || '—')}</td>
        <td style="font-size:12px">${escapeHtmlAdmin(actionLabel)}${bulkTag}</td>
        <td style="font-size:12px;color:var(--adm-muted)">${l.targetLabel ? `<strong>${escapeHtmlAdmin(l.targetLabel)}</strong> — ` : ''}${escapeHtmlAdmin(l.details || '')}</td>
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
const mobileTabs = document.getElementById('adm-mobile-tabs');
const mobileMoreToggle = document.getElementById('adm-mobile-more-toggle');
const mobileMoreSheet = document.getElementById('adm-mobile-more-sheet');
const mobileMoreBackdrop = document.getElementById('adm-mobile-more-backdrop');
const mobileMoreClose = document.getElementById('adm-mobile-more-close');
const mobileMoreGrid = document.getElementById('adm-mobile-more-grid');

function moveSecondaryMobileTab(node) {
  if (!(node instanceof Element) || !node.matches('.adm-mobile-tab')) return;
  if (node.hasAttribute('data-mobile-primary') || node === mobileMoreToggle) return;
  mobileMoreGrid?.appendChild(node);
}

if (mobileTabs && mobileMoreGrid) {
  [...mobileTabs.querySelectorAll('.adm-mobile-tab')].forEach(moveSecondaryMobileTab);
  new MutationObserver(records => {
    records.flatMap(record => [...record.addedNodes]).forEach(moveSecondaryMobileTab);
  }).observe(mobileTabs, { childList: true });
}

function setMobileMore(open, restoreFocus = false) {
  if (!mobileMoreToggle || !mobileMoreSheet || !mobileMoreBackdrop) return;
  mobileMoreSheet.hidden = !open;
  mobileMoreBackdrop.hidden = !open;
  mobileMoreToggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('adm-mobile-more-open', open);
  if (open) {
    mobileMoreClose?.focus({ preventScroll: true });
  } else if (restoreFocus) {
    mobileMoreToggle.focus({ preventScroll: true });
  }
}

function closeMobileMore(restoreFocus = false) {
  setMobileMore(false, restoreFocus);
}

mobileMoreToggle?.addEventListener('click', () => {
  setMobileMore(mobileMoreToggle.getAttribute('aria-expanded') !== 'true');
});
mobileMoreClose?.addEventListener('click', () => closeMobileMore(true));
mobileMoreBackdrop?.addEventListener('click', () => closeMobileMore(true));
mobileMoreGrid?.addEventListener('click', event => {
  if (event.target.closest('.adm-mobile-tab')) closeMobileMore();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mobileMoreToggle?.getAttribute('aria-expanded') === 'true') {
    event.preventDefault();
    closeMobileMore(true);
  }
});

const navItems = document.querySelectorAll('[data-section]');
const topbarTitle = document.getElementById('adm-topbar-title');

const SECTION_LABELS = {
  dashboard: 'Dashboard',
  estadisticas: 'Estadísticas',
  usuarios: 'Usuarios',
  pedidos: 'Pedidos',
  productos: 'Productos',
  resenas: 'Reseñas',
  'me-gusta': 'Me gusta',
  colecciones: 'Colecciones',
  mensajes: 'Mensajes',
  auditoria: 'Auditoría',
  diagnostico: 'Diagnóstico',
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
  // Correos: mismo criterio que Usuarios/Configuración/Auditoría — exclusivo
  // Super Admin (ni admin ni el Modder ven este menú, aunque sus propias
  // acciones en Pedidos puedan disparar un correo automático configurado acá).
  correos:       'manageSettings',
  'notificaciones-push': 'manageSettings',
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
  const fromHash = (location.hash || '').replace(/^#/, '');
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
    if (unsavedOpen()) return;
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
  const leave = async () => { await signOut(auth); window.location.href = '/login'; };
  window.AdminUnsaved ? window.AdminUnsaved.requestNavigation(leave) : leave();
};

// ---- LOGOUT ----
document.getElementById('adm-logout').onclick = () => {
  const leave = async () => { await signOut(auth); window.location.href = '/login'; };
  window.AdminUnsaved ? window.AdminUnsaved.requestNavigation(leave) : leave();
};

// ======== AUTH GUARD ========
// El loader de marca (js/cargador-pagina.js) cubre la pantalla mientras se
// resuelve esta función, pero además el CSS de <head> mantiene el sidebar,
// la tabbar mobile y .adm-main en visibility:hidden hasta que se agregue
// html.adm-auth-ready — eso solo pasa al final del único camino que
// realmente muestra el panel real (ver más abajo).
function hideOverlay() { window.ttPageReady && window.ttPageReady(); }

function showAdminInitError(error) {
  console.error('[Admin] Auth init error:', error);
  document.documentElement.classList.add('adm-auth-error');
  document.getElementById('adm-init-retry')?.addEventListener('click', () => window.location.reload(), { once: true });
  hideOverlay();
}

onAuthStateChanged(auth, async user => {
  try {
    // El loader de marca se mantiene arriba (no se llama a hideOverlay) en
    // todo camino que termine navegando a otra página. Antes se ocultaba
    // siempre en un finally, así que en conexiones lentas el loader podía
    // desaparecer y dejar ver el panel real (sidebar, secciones) durante el
    // rato en que la navegación todavía no terminaba de cargar el destino.
    if (!user) { window.location.href = 'login.html'; return; }
    currentUser = user;

    // Sin esto, la primera lectura a Firestore (chequeo de bloqueo más abajo
    // y getUserRole) puede salir antes de que App Check tenga token listo.
    // Con Enforcement activo, Firestore la rechaza (permission-denied), el
    // catch de más abajo la toma como sesión inválida y manda a login.html
    // — un rebote admin→login que no depende del método de login usado.
    await appCheckReady;

    const role = await getUserRole(user.uid, user.email);
    currentRole = role;

    // Cuenta bloqueada (Fase E): afuera del panel con mensaje claro, sin
    // esperar a que el rol demovido a 'client' la saque por la vía indirecta
    // de perfil.html. tintinaccs@gmail.com nunca puede estar bloqueada.
    if (user.email !== SUPER_ADMIN) {
      const selfSnap = await getDoc(doc(db, 'users', user.uid));
      if (selfSnap.exists() && selfSnap.data().blocked) {
        await signOut(auth);
        window.location.href = 'login.html?blocked=1';
        return;
      }
    }

    if (role === 'client' || !role) {
      window.location.href = 'perfil.html';
      return;
    }

    // Tienda cerrada: un rol sin excepción configurada en Configuración →
    // "Permitir acceso con tienda cerrada" se queda afuera del panel — no se
    // le cierra la sesión (Super Admin puede reabrir la tienda y su sesión
    // sigue intacta), solo se tapa la pantalla con el mismo aviso público.
    const storeCfg = await getStoreAccessConfig();
    if (!isAccessAllowed(storeCfg, role, user.email)) {
      renderStoreClosedOverlay();
      hideOverlay();
      return;
    }

    // Permisos dinámicos (Roles y Permisos) — se cargan ANTES de armar la UI
    // para que canDo() ya tenga datos reales desde el primer render, no solo
    // el techo fijo de roles.js.
    await loadRolePermissions();

    // Set up UI and reveal page
    setupUserInfo(user, role);
    setupPermissions(role);
    if (role === 'superadmin' && user.email === SUPER_ADMIN) {
      initSiteDiagnostics({ role });
    }
    startAdminRealtimeData();
    loadDashboard();
    // Load eagerly (not just on nav click) so category/collection selects in
    // Productos stay correct even if the admin never opens Colecciones first.
    loadProductos();
    loadColecciones();
    applyInitialSectionFromUrl();
    document.documentElement.classList.add('adm-auth-ready');
    hideOverlay();
  } catch(e) {
    // No se sabe si el usuario es válido: se mantiene oculto el panel real y
    // se muestra una recuperación explícita. Antes el redirect podía fallar o
    // quedar a mitad de navegación y dejaba el Dashboard estático visible,
    // sin sidebar, topbar ni datos (pantalla con métricas "—").
    showAdminInitError(e);
  }
});

function setupUserInfo(user, role) {
  const avatarEl = document.getElementById('adm-avatar');
  if (avatarEl) {
    const avatarUrl = sanitizeImageUrl(user.photoURL || '');
    if (avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="" />`;
    } else {
      avatarEl.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
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
    const dayOrders = allOrders.filter(order => statisticsDayKey(order.createdAt) === key && statisticsOrderIsValid(order));
    const revenue = dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const visits = statisticsTrafficSessions.filter(session => statisticsDayKey(session.startedAt) === key).length;
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
  const now = Date.now();
  const rangeStart = statisticsStartDate().getTime();
  const rangeOrders = allOrders.filter(order => activityTimestampMillis(order.createdAt) >= rangeStart);
  const validOrders = rangeOrders.filter(statisticsOrderIsValid);
  const revenue = validOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paid = rangeOrders
    .filter(order => statisticsPaymentStatus(order) === 'pagado')
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const rangeUsers = allUsers.filter(user => activityTimestampMillis(user.createdAt) >= rangeStart);
  const activeUsers = allUsers.filter(user => !user.blocked).length;
  const blockedUsers = allUsers.filter(user => user.blocked).length;
  const uniqueVisitors = new Set(statisticsTrafficSessions.map(session => session.visitorId).filter(Boolean)).size;
  const activePresence = statisticsActivePresence(now);
  const activeProducts = _allProducts.filter(product => product.active !== false);
  const lowStockProducts = activeProducts.filter(product => Number(product.stock || 0) <= 5).length;

  statisticsSetText('statistics-revenue', adminRealtimeReady.orders ? formatPrice(revenue) : '—');
  statisticsSetText('statistics-paid', adminRealtimeReady.orders ? formatPrice(paid) : '—');
  statisticsSetText('statistics-orders', adminRealtimeReady.orders ? String(rangeOrders.length) : '—');
  statisticsSetText('statistics-average-ticket', adminRealtimeReady.orders && validOrders.length ? formatPrice(revenue / validOrders.length) : '—');
  statisticsSetText('statistics-new-users', adminRealtimeReady.users ? String(rangeUsers.length) : '—');
  statisticsSetText('statistics-active-users', adminRealtimeReady.users ? String(activeUsers) : '—');
  statisticsSetText('statistics-blocked-users', adminRealtimeReady.users ? `${blockedUsers} bloqueado${blockedUsers === 1 ? '' : 's'}` : '—');
  statisticsSetText('statistics-visitors', adminRealtimeReady.traffic ? String(uniqueVisitors) : '—');
  statisticsSetText('statistics-sessions', adminRealtimeReady.traffic ? `${statisticsTrafficSessions.length} sesión${statisticsTrafficSessions.length === 1 ? '' : 'es'}` : '—');
  statisticsSetText('statistics-conversion', adminRealtimeReady.orders && adminRealtimeReady.traffic && uniqueVisitors ? `${(validOrders.length / uniqueVisitors * 100).toFixed(1)}%` : '—');
  statisticsSetText('statistics-online', adminRealtimeReady.presence ? String(activePresence.length) : '—');
  statisticsSetText('statistics-active-products', adminRealtimeReady.products ? String(activeProducts.length) : '—');
  statisticsSetText('statistics-low-stock', adminRealtimeReady.products ? `${lowStockProducts} con stock bajo` : '—');

  const orderStatuses = new Map();
  const paymentStatuses = new Map();
  const products = new Map();
  const orderLocations = new Map();
  rangeOrders.forEach(order => {
    const orderStatus = order.status || 'pendiente';
    orderStatuses.set(orderStatus, (orderStatuses.get(orderStatus) || 0) + 1);
    const paymentStatus = statisticsPaymentStatus(order);
    paymentStatuses.set(paymentStatus, (paymentStatuses.get(paymentStatus) || 0) + 1);
    const location = String(order.shipping?.city || order.city || order.shipping?.zone || order.shipping?.department || 'Sin ubicación').trim();
    orderLocations.set(location, (orderLocations.get(location) || 0) + 1);
    (order.items || []).forEach(item => {
      const name = String(item.name || 'Producto sin nombre').trim();
      const quantity = Math.max(1, Number(item.qty || item.quantity || 1));
      const previous = products.get(name) || { quantity: 0, revenue: 0 };
      previous.quantity += quantity;
      previous.revenue += quantity * Number(item.price || 0);
      products.set(name, previous);
    });
  });

  const visitLocations = new Map();
  const entryPages = new Map();
  statisticsTrafficSessions.forEach(session => {
    const location = activityLocationLabel(session);
    visitLocations.set(location, (visitLocations.get(location) || 0) + 1);
    const page = activityPageLabel(session.landingPage);
    entryPages.set(page, (entryPages.get(page) || 0) + 1);
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
    .map(([name, data]) => ({ name, value: data.quantity, displayValue: data.quantity, meta: `${data.quantity} unidades · ${formatPrice(data.revenue)}` }))
    .sort((a, b) => b.value - a.value));
  renderStatisticsRanking('statistics-order-locations', [...orderLocations.entries()]
    .map(([name, value]) => ({ name, value, displayValue: value, meta: `${value} pedido${value === 1 ? '' : 's'}` }))
    .sort((a, b) => b.value - a.value));
  renderStatisticsRanking('statistics-visit-locations', [...visitLocations.entries()]
    .map(([name, value]) => ({ name, value, displayValue: value, meta: `${value} sesión${value === 1 ? '' : 'es'}` }))
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
window.TintinAdminOrders = {
  ready: () => adminRealtimeReady.orders === true,
  has: orderId => allOrders.some(order => order.id === orderId)
};

function stopAdminRealtimeData() {
  if (adminOrdersUnsubscribe) adminOrdersUnsubscribe();
  if (adminUsersUnsubscribe) adminUsersUnsubscribe();
  if (_auditUnsubscribe) _auditUnsubscribe();
  emailRealtimeUnsubscribers.forEach(unsubscribe => unsubscribe());
  emailRealtimeUnsubscribers = [];
  emailModuleStarted = false;
  statisticsTrafficLoadToken += 1;
  adminOrdersUnsubscribe = null;
  adminUsersUnsubscribe = null;
  _auditUnsubscribe = null;
}

function startAdminRealtimeData() {
  stopAdminRealtimeData();
  adminRealtimeReady = { orders: false, users: currentRole !== 'superadmin' };
  if (can(currentRole, 'viewOrders') && roleCanDo('pedidos', 'ver')) {
    adminOrdersUnsubscribe = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(ADMIN_REALTIME_LIMIT)), snapshot => {
      allOrders = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .sort((a, b) => activityTimestampMillis(b.createdAt) - activityTimestampMillis(a.createdAt));
      adminRealtimeReady.orders = true;
      refreshRealtimeConsumers();
    }, error => {
      adminRealtimeReady.orders = false;
      console.error('Pedidos en tiempo real no disponibles:', error);
      statisticsSetText('statistics-live-status', 'Pedidos no disponibles');
    });
  } else {
    adminRealtimeReady.orders = true;
  }
  if (currentRole === 'superadmin') {
    adminUsersUnsubscribe = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(ADMIN_REALTIME_LIMIT)), snapshot => {
      allUsers = snapshot.docs.map(item => ({ uid: item.id, ...item.data() }))
        .sort((a, b) => activityTimestampMillis(b.createdAt || b.updatedAt || b.lastAccess) - activityTimestampMillis(a.createdAt || a.updatedAt || a.lastAccess) || String(a.uid || '').localeCompare(String(b.uid || '')));
      adminRealtimeReady.users = true;
      refreshRealtimeConsumers();
    }, error => {
      adminRealtimeReady.users = false;
      console.error('Usuarios en tiempo real no disponibles:', error);
      statisticsSetText('statistics-live-status', 'Usuarios no disponibles');
    });
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
  if (detail) detail.textContent = `${sessions.length} sesión${sessions.length === 1 ? '' : 'es'}`;
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

function renderDashboardData() {
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

    if (canMetricas) {
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

    if (canVentas) {
      const today2 = new Date();
      const monthStart = new Date(today2.getFullYear(), today2.getMonth(), 1);
      const monthSales = orders
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

    // Recent orders (last 5)
    const recent = [...orders]
      .sort((a,b) => {
        const da = a.createdAt?.toDate?.() || new Date(0);
        const db_ = b.createdAt?.toDate?.() || new Date(0);
        return db_ - da;
      })
      .slice(0, 5);

    const tbody = document.getElementById('dash-recent-orders');
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:24px">Sin pedidos aún</td></tr>';
      return;
    }
    tbody.innerHTML = recent.map(o => `
      <tr>
        <td><strong>${escapeHtmlAdmin(o.userName || o.userEmail || '—')}</strong><br><small style="color:#777">${escapeHtmlAdmin(o.userPhone || '')}</small></td>
        <td style="font-weight:700;color:var(--adm-accent)">${formatPrice(o.total || 0)}</td>
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
// Ahora son dos pestañas ('active' | 'blocked'), no un dropdown Todos/Activos/
// Bloqueados — un usuario bloqueado desaparece de "Usuarios" y solo aparece
// en "Bloqueados", nunca en las dos a la vez.
let userStatusFilter = 'active';
let userSortMode = 'recent';

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
let _lastFilteredUsers = [];
function applyUserFilters() {
  const q = document.getElementById('user-search').value.toLowerCase();
  let filtered = allUsers.filter(u =>
    (u.name||'').toLowerCase().includes(q) ||
    (u.email||'').toLowerCase().includes(q)
  );
  filtered = userStatusFilter === 'blocked'
    ? filtered.filter(u => u.blocked)
    : filtered.filter(u => !u.blocked);
  filtered = userSortMode === 'totalSpent'
    ? [...filtered].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    : userSortMode === 'purchaseCount'
      ? [...filtered].sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0))
      : userSortMode === 'name'
        ? [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
        : [...filtered].sort((a, b) => activityTimestampMillis(b.createdAt || b.updatedAt || b.lastAccess) - activityTimestampMillis(a.createdAt || a.updatedAt || a.lastAccess) || String(a.uid || '').localeCompare(String(b.uid || '')));
  _lastFilteredUsers = filtered;
  const visibleIds = new Set(filtered.map(u => u.uid));
  [..._selectedUsers].forEach(uid => { if (!visibleIds.has(uid)) _selectedUsers.delete(uid); });
  renderUsersTable(filtered);
  updateBlockedCount();
  updateUsersBulkToolbar();
}

function updateBlockedCount() {
  const el = document.getElementById('users-blocked-count');
  if (!el) return;
  const n = allUsers.filter(u => u.blocked).length;
  el.textContent = n ? `(${n})` : '';
}

window.filterUsersByStatus = (status) => {
  userStatusFilter = status;
  document.querySelectorAll('.user-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.userTab === status));
  applyUserFilters();
};

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!users.length) {
    const emptyMsg = userStatusFilter === 'blocked' ? 'No hay usuarios bloqueados' : 'Sin usuarios';
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">${emptyMsg}</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => {
    const isSuperAdmin = u.email === SUPER_ADMIN;
    const safeUid = escapeHtmlAdmin(u.uid);
    const uidArg = inlineArgumentAdmin(u.uid);
    const emailArg = inlineArgumentAdmin(u.email || '');
    const nameArg = inlineArgumentAdmin(u.name || u.email || '');
    const safeRole = Object.prototype.hasOwnProperty.call(ROLE_LABELS, u.role) ? u.role : 'client';
    // Se usa can(role,'manageUsers') en vez de comparar el nombre del rol a mano
    // — hoy solo superadmin tiene ese permiso, pero si el día de mañana cambia
    // la matriz de permisos, esta línea sigue siendo correcta sin tocarla.
    const canEdit = can(currentRole, 'manageUsers') && !isSuperAdmin;
    const roleBadge = `<span class="adm-badge role-${safeRole}">${escapeHtmlAdmin(ROLE_LABELS[safeRole] || 'Cliente')}</span>`;
    const blockedBadge = u.blocked
      ? '<span class="adm-badge badge-cancelado">Bloqueado</span>'
      : '<span class="adm-badge badge-entregado">Activo</span>';

    // Ficha ampliada de la Fase E: solo se arma para usuarios bloqueados, para
    // no recargar la tabla en el caso normal. IP de registro deliberadamente
    // NO se captura (no hay backend seguro en este proyecto sin facturación) —
    // se explicita acá en vez de omitirlo en silencio.
    const blockedDetail = u.blocked ? `
      <div style="margin-top:6px;font-size:11px;color:#888;line-height:1.6;max-width:230px">
        ${u.phone ? `<div><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${escapeHtmlAdmin(u.phone)}</div>` : ''}
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
    const roleSelect = canEdit && can(currentRole, 'assignRoles') && !u.blocked ? `
      <select class="adm-select" style="width:auto;font-size:11px;padding:4px 8px"
        onchange="window.updateUserRole(${uidArg}, this.value, ${emailArg})"
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
          ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.restoreUser(${uidArg})">Restaurar</button>`
          : `<button type="button" class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.blockUser(${uidArg}, ${emailArg})">Bloquear</button>`
        ) : ''}
        ${can(currentRole,'deleteUsers') && !isSuperAdmin ? `
          <button type="button" class="adm-btn adm-btn-sm adm-btn-danger"
            onclick="window.deleteUser(${uidArg}, ${nameArg})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;vertical-align:-2px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Eliminar
          </button>` : ''}
      </div>
    ` : '<span style="color:#ccc;font-size:12px">—</span>';

    const avatarUrl = sanitizeImageUrl(u.photoURL || '');
    const avatar = avatarUrl
      ? `<div class="adm-tbl-avatar"><img src="${escapeHtmlAdmin(avatarUrl)}" alt="" /></div>`
      : `<div class="adm-tbl-avatar">${escapeHtmlAdmin((u.name || u.email || '?')[0].toUpperCase())}</div>`;

    return `
      <tr>
        <td class="col-select">${!isSuperAdmin ? `<input type="checkbox" class="user-row-check" data-id="${safeUid}" onclick="toggleUserSelect(this)" ${_selectedUsers.has(u.uid) ? 'checked' : ''}>` : ''}</td>
        <td>${avatar}</td>
        <td><strong>${escapeHtmlAdmin(u.name || '—')}</strong></td>
        <td style="font-size:12px;color:#666">${escapeHtmlAdmin(u.email || '—')}</td>
        <td style="font-size:12px;color:#666">${escapeHtmlAdmin(u.phone || '—')}</td>
        <td>${roleSelect}</td>
        <td>${blockedBadge}${blockedDetail}</td>
        <td style="font-size:12px;color:#666">${u.purchaseCount || 0}</td>
        <td style="font-size:12px;color:#666">${formatPrice(u.totalSpent || 0)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');
}

// Búsqueda y pestañas Usuarios/Bloqueados — comparten applyUserFilters()
document.getElementById('user-search').oninput = applyUserFilters;
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
  try {
    const u = allUsers.find(u => u.uid === uid);
    const prevRole = u?.role || 'client';
    await setDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() }, { merge: true });
    if (u) u.role = role;
    logAudit('cambiar_rol', 'usuario', uid, email, `Rol: ${ROLE_LABELS[prevRole] || prevRole} → ${ROLE_LABELS[role]}`);
    toast(`Rol actualizado a ${ROLE_LABELS[role]}`);
    applyUserFilters();
  } catch(e) {
    toast('Error al actualizar rol');
  }
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
  try {
    await updateDoc(doc(db, 'users', uid), {
      blocked: true,
      blockedAt: serverTimestamp(),
      blockedBy: currentUser?.email || '',
      blockReason: reason,
      roleBeforeBlock: prevRole,
      role: 'client',
      updatedAt: serverTimestamp()
    });
    Object.assign(u, { blocked: true, blockedBy: currentUser?.email || '', blockReason: reason, roleBeforeBlock: prevRole, role: 'client' });
    logAudit('bloquear_usuario', 'usuario', uid, u.name || email, reason ? `Motivo: ${reason}` : 'Sin motivo especificado');
    toast('Usuario bloqueado');
    applyUserFilters();
  } catch(e) {
    toast('Error al bloquear usuario');
  }
};

async function updateAccountStatusFromAdmin_(uid, action, reason = '') {
  if (!currentUser || currentRole !== 'superadmin' || currentUser.email !== SUPER_ADMIN) {
    throw new Error('Solo el Super Admin puede cambiar el estado de una cuenta');
  }
  const token = await currentUser.getIdToken();
  const response = await fetch('/api/admin-delete-user', {
    method: 'POST',
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ uid, action, reason })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'No se pudo actualizar la cuenta');
  return result;
}

// Restaurar: si tenía un rol elevado antes del bloqueo, pide confirmación
// explícita para devolvérselo; si no hay historial (o decide no confirmarlo),
// restaura como Cliente por seguridad — tal como pidió Tintin.
window.restoreUser = async (uid) => {
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  if (u.deleted === true || u.profileStatus === 'deleted') {
    if (!confirm(`¿Reactivar la identidad histórica de "${u.name || u.email}" como Cliente?`)) return;
    try {
      await updateAccountStatusFromAdmin_(uid, 'reactivate', 'Reactivación desde Super Admin');
      toast('Cuenta reactivada y auditada');
    } catch (e) {
      toast(e.message || 'Error al reactivar usuario');
    }
    return;
  }
  const targetRole = ASSIGNABLE_ROLES.includes(u.roleBeforeBlock) ? u.roleBeforeBlock : 'client';
  if (!confirm(`¿Restaurar a "${u.name || u.email}" como ${ROLE_LABELS[targetRole] || targetRole}?`)) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      blocked: false,
      role: targetRole,
      blockedAt: deleteField(),
      blockedBy: deleteField(),
      blockReason: deleteField(),
      roleBeforeBlock: deleteField(),
      updatedAt: serverTimestamp()
    });
    Object.assign(u, { blocked: false, role: targetRole });
    delete u.blockedAt; delete u.blockedBy; delete u.blockReason; delete u.roleBeforeBlock;
    logAudit('restaurar_usuario', 'usuario', uid, u.name || u.email, `Restaurado como ${ROLE_LABELS[targetRole]}`);
    toast(`Usuario restaurado como ${ROLE_LABELS[targetRole]}`);
    applyUserFilters();
  } catch(e) {
    toast('Error al restaurar usuario');
  }
};

window.deleteUser = async (uid, name) => {
  // El perfil del Super Admin real no se puede eliminar (firestore.rules también
  // lo bloquea del lado servidor, línea 692-693). Sin esta guarda el botón solo
  // se oculta en la fila, y "ocultar un botón no cuenta como seguridad".
  const _target = allUsers.find(x => x.uid === uid);
  if (_target && _target.email === SUPER_ADMIN) { toast('El perfil del Super Admin no se puede eliminar'); return; }
  // Cada acción sensible valida el permiso del actor, no solo la UI.
  if (!can(currentRole, 'deleteUsers')) { toast('No tenés permiso para eliminar usuarios'); return; }
  const reason = window.prompt('Motivo de la eliminación (queda en auditoría):', '') ?? null;
  if (reason === null) return;
  if (!confirm(
    `¿Eliminar la cuenta de "${name}"?\n\n` +
    `Se revocará el acceso y se liberará el teléfono, pero se conservarán customerId, email, pedidos y auditoría ` +
    `como identidad histórica. Super Admin podrá reactivarla.`
  )) return;
  try {
    await updateAccountStatusFromAdmin_(uid, 'softDelete', reason);
    toast('Acceso revocado; identidad histórica conservada y auditada');
    applyUserFilters();
  } catch(e) {
    toast('Error al eliminar usuario');
  }
};

// ══════════════════════════════════════════════
// USUARIOS: SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS
// ══════════════════════════════════════════════
let _selectedUsers = new Set();

window.toggleSelectAllUsers = function(masterCb) {
  document.querySelectorAll('.user-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedUsers.add(cb.dataset.id);
    else _selectedUsers.delete(cb.dataset.id);
  });
  updateUsersBulkToolbar();
};

window.toggleUserSelect = function(cb) {
  if (cb.checked) _selectedUsers.add(cb.dataset.id);
  else _selectedUsers.delete(cb.dataset.id);
  const master = document.getElementById('check-all-users');
  if (master) {
    const total = document.querySelectorAll('.user-row-check').length;
    master.indeterminate = _selectedUsers.size > 0 && _selectedUsers.size < total;
    master.checked = _selectedUsers.size === total && total > 0;
  }
  updateUsersBulkToolbar();
};

function updateUsersBulkToolbar() {
  const count = _selectedUsers.size;
  const toolbar = document.getElementById('users-bulk-toolbar');
  const countEl = document.getElementById('users-bulk-count');
  const blockBtn = document.getElementById('users-bulk-block-btn');
  const restoreBtn = document.getElementById('users-bulk-restore-btn');
  // Todo el módulo Usuarios (individual y masivo) es exclusivo de Super
  // Admin — mismo permiso que ya gatea las acciones de a una (manageUsers).
  const allowed = can(currentRole, 'manageUsers');
  if (toolbar) toolbar.classList.toggle('show', allowed && count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
  if (blockBtn) blockBtn.style.display = userStatusFilter === 'blocked' ? 'none' : '';
  if (restoreBtn) restoreBtn.style.display = userStatusFilter === 'blocked' ? '' : 'none';
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
      await batch.commit();
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
  const ids = [..._selectedUsers].filter(uid => {
    const u = allUsers.find(x => x.uid === uid);
    return u && u.email !== SUPER_ADMIN && u.blocked;
  });
  if (!ids.length) { toast('No hay usuarios elegibles en la selección'); return; }
  const n = ids.length;
  if (!confirm(`¿Restaurar ${n} usuario(s) con el rol que tenían antes del bloqueo?`)) return;
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
      await batch.commit();
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
    toast(`${n} usuario(s) restaurados con su rol anterior`);
    clearUsersSelection();
    applyUserFilters();
  } catch (e) { toast('Error: ' + e.message); }
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
    error:   { cls: 'badge-cancelado',  icon: '…56678 tokens truncated…const skippedHtml = skipped.length
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
    'brazaletes':'brazaletes','brazalete':'brazaletes',
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
                  onchange="window.setCsvRowCategory(${i}, this.value)">
            ${['relojes','bolsos','aros','collares','pulseras','anillos','tobilleras','brazaletes','earcuff','armcuff','gafas','joyeros','otros'].map(c =>
              `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`
            ).join('')}
          </select>
        </td>
        <td style="font-weight:700;color:var(--adm-accent)">Gs. ${p.price.toLocaleString('es-PY')}</td>
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
        const importedRef = await addDoc(collection(db,'products'), {
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
        });
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

  document.getElementById('perm-search').oninput = renderPermisosMatrix;
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
  const q = (document.getElementById('perm-search').value || '').toLowerCase();
  const modFilter = document.getElementById('perm-filter-module').value;
  const roleFilter = document.getElementById('perm-filter-role').value;
  const wrap = document.getElementById('perm-modules-wrap');

  const modKeys = Object.keys(PERMISSION_MODULES).filter(k => !modFilter || k === modFilter);
  const rolesToShow = EDITABLE_ROLES.filter(r => !roleFilter || r === roleFilter);

  wrap.innerHTML = modKeys.map(modKey => {
    const mod = PERMISSION_MODULES[modKey];
    const actionEntries = Object.entries(mod.actions).filter(([actKey, act]) => {
      if (!q) return true;
      return act.label.toLowerCase().includes(q) || mod.label.toLowerCase().includes(q);
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
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedProducts.add(cb.dataset.id);
  });
  updateBulkToolbar();
};

window.toggleProductSelect = function(cb) {
  if (cb.checked) _selectedProducts.add(cb.dataset.id);
  else _selectedProducts.delete(cb.dataset.id);
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
  if (toolbar) toolbar.style.display = count > 0 ? 'flex' : 'none';
  if (selCount) selCount.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
  // Antes esto era exclusivo de "superadmin" a mano; ahora sigue el mismo
  // permiso que ya gatea el botón de eliminar de a un producto (deleteProducts)
  // — si podés borrar uno, tiene sentido que también puedas borrar varios.
  if (delBtn) delBtn.style.display = (can(currentRole, 'deleteProducts') && roleCanDo('productos', 'eliminar')) ? '' : 'none';
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

window.bulkDelete = async function() {
  if (!_selectedProducts.size) return;
  if (!can(currentRole, 'deleteProducts') || !roleCanDo('productos', 'eliminar')) { toast('No tenés permiso para eliminar productos'); return; }
  const n = _selectedProducts.size;
  if (!confirm(`¿ELIMINAR DEFINITIVAMENTE ${n} producto(s)? Esta acción NO se puede deshacer.`)) return;
  if (!confirm(`Segunda confirmación: ¿confirmar la eliminación de ${n} productos?`)) return;
  try {
    const ids0 = [..._selectedProducts];
    const CHUNK = 450;
    for (let i = 0; i < ids0.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids0.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'products', id)));
      await batch.commit();
    }
    await pushProductsToSheets(ids0);
    const ids = new Set(_selectedProducts);
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
  const val = document.getElementById('bulk-stock-input')?.value;
  if (val === '' || val == null || Number(val) < 0) { toast('Escribí un stock válido (0 o más)'); return; }
  const stock = Math.round(Number(val));
  const n = _selectedProducts.size;
  if (!confirm(`¿Cambiar el stock a ${stock} en ${n} producto(s)?`)) return;
  try {
    const ids = [..._selectedProducts];
    await batchUpdateChunked(ids, () => ({ stock, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.stock = stock; });
    logAudit('editar_producto', 'producto', '', '', `Stock → ${stock}`, { bulk: true, count: n });
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
    await batchUpdateChunked(ids, () => ({ price, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.price = price; });
    logAudit('editar_producto', 'producto', '', '', `Precio → ${formatPrice(price)}`, { bulk: true, count: n });
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
  if (!confirm(`¿${destacado ? 'Marcar' : 'Quitar'} destacado en ${n} producto(s)?`)) return;
  try {
    const ids = [..._selectedProducts];
    await batchUpdateChunked(ids, () => ({ destacado, updatedAt: serverTimestamp() }));
    _allProducts.forEach(p => { if (_selectedProducts.has(p._docId)) p.destacado = destacado; });
    logAudit('editar_producto', 'producto', '', '', destacado ? 'Marcado destacado' : 'Quitado destacado', { bulk: true, count: n });
    toast(`Destacado ${destacado ? 'marcado' : 'quitado'} en ${n} producto(s)`);
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

window.openOrderEdit = function(orderId) {
  const o = allOrders.find(x => x.id === orderId);
  if (!o) return;
  _editingOrder = JSON.parse(JSON.stringify(o)); // deep copy
  // Guarda el updatedAt real (Timestamp de Firestore) — no la copia JSON, que
  // pierde el tipo — para comparar contra el servidor al guardar.
  _orderEditBaselineMillis = toJsDate_(o.updatedAt)?.getTime() ?? null;

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
  document.getElementById('oe-pay-status').value = o.payment?.status || o.paymentStatus || 'pendiente';
  document.getElementById('oe-status').value = o.status || 'pendiente';
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
      ${sanitizeImageUrl(it.imgUrl||it.imageUrl||'') ? `<img src="${sanitizeImageUrl(it.imgUrl||it.imageUrl||'')}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">` : `<div style="width:40px;height:40px;background:#fce4ec;border-radius:6px;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8a0b4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`}
      <div style="flex:1;font-size:13px;font-weight:600">${escapeHtmlAdmin(it.name||'—')}${it.variant ? `<div style="font-size:11px;font-weight:400;color:var(--adm-muted)">${escapeHtmlAdmin(it.variant)}</div>` : ''}</div>
      <div style="font-size:12px;color:var(--adm-muted)">${fmt(it.price||0)} c/u</div>
      <input type="number" min="1" value="${it.qty||1}" style="width:56px;padding:4px 8px;border:1px solid var(--adm-border);border-radius:6px;font-size:13px;text-align:center"
        onchange="updateOeItemQty(${idx}, this.value)" oninput="updateOeItemQty(${idx}, this.value)">
      <div style="font-size:13px;font-weight:700;color:var(--adm-primary);min-width:90px;text-align:right">${fmt((it.price||0)*(it.qty||1))}</div>
      <button type="button" onclick="removeOeItem(${idx})" style="background:none;border:none;color:#e53935;font-size:18px;cursor:pointer;padding:0 4px" title="Quitar del pedido">×</button>
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
    // Concurrencia optimista: si otro administrador escribió este pedido después
    // de que se abrió el editor, no pisamos sus cambios en silencio. Fail-open:
    // si no se puede comparar (sin updatedAt, o falla la lectura), se guarda
    // igual para no bloquear una edición legítima.
    try {
      const freshSnap = await getDoc(doc(db, 'orders', orderId));
      if (!freshSnap.exists()) { toast('El pedido ya no existe (puede haber sido eliminado).'); return false; }
      const freshMillis = toJsDate_(freshSnap.data()?.updatedAt)?.getTime() ?? null;
      if (_orderEditBaselineMillis && freshMillis && freshMillis > _orderEditBaselineMillis) {
        toast('Otro administrador modificó este pedido mientras lo editabas. Cerralo y volvé a abrirlo para no pisar sus cambios.');
        return false;
      }
    } catch (_) { /* fail-open: no bloquear por un error de lectura */ }
    await window.TintinInventoryIntegrity.updateEditedOrder(orderId, updateData);
    // Sync local array
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
    logAudit('editar_pedido', 'pedido', orderId, _before?.shortId || orderId, changes.join(' · ') || 'Datos del pedido actualizados');
    toast('Pedido actualizado');
    window.AdminUnsaved?.markClean('order-editor');
    closeOrderEdit(true);
    applyOrderFilters();
    return true;
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
  admin:  { tokens: ADMIN_TOKENS,  categories: ADMIN_CATEGORIES,  pairs: ADMIN_CONTRAST_PAIRS,  defaultSchemeId: 'default-admin' },
};
const APAR_PREVIEW_ROLES = {
  global: { bgPage:'bg-page', bgSurface:'bg-surface', textPrimary:'text-primary', textSecondary:'text-secondary', textTertiary:'text-tertiary', textTitle:'text-title',
    btnPrimaryBg:'btn-primary-bg', btnPrimaryText:'btn-primary-text', btnSecondaryBg:'btn-secondary-bg', btnSecondaryText:'btn-secondary-text', btnSecondaryBorder:'btn-secondary-border',
    fieldBg:'field-bg', fieldBorder:'field-border', fieldText:'field-text', cardBorder:'card-border',
    tableHeaderBg:'table-header-bg', tableHeaderText:'table-header-text', tableBorder:'table-border',
    successBg:'state-success-bg', successText:'state-success-text', errorBg:'state-error-bg', errorText:'state-error-text', warningBg:'state-warning-bg', warningText:'state-warning-text',
    link:'text-link', badgeBg:'badge-bg', badgeText:'badge-text', border:'border-primary' },
  admin: { bgPage:'bg-page', bgSurface:'bg-surface', textPrimary:'text-primary', textSecondary:'text-secondary', textTertiary:'text-tertiary', textTitle:'text-title',
    btnPrimaryBg:'btn-primary-bg', btnPrimaryText:'btn-primary-text', btnSecondaryBg:'bg-surface', btnSecondaryText:'btn-outline-text', btnSecondaryBorder:'btn-outline-text',
    fieldBg:'field-bg', fieldBorder:'field-border', fieldText:'text-primary', cardBorder:'border',
    tableHeaderBg:'table-header-bg', tableHeaderText:'text-title', tableBorder:'border',
    successBg:'state-success-bg', successText:'state-success-text', errorBg:'state-error-bg', errorText:'state-error-text', warningBg:'state-warning-bg', warningText:'state-warning-text',
    link:'brand', badgeBg:'badge-bg', badgeText:'badge-text', border:'border' },
};

let aparScope = 'global';
let aparSchemes = { global: [], admin: [] };
let aparEditingSchemeId = { global: null, admin: null };
let aparActiveSchemeId = { global: null, admin: null };
let aparDraft = { global: {}, admin: {} };
let aparPublished = { global: {}, admin: {} };
let aparDeviceOverrideEnabled = { global: false };
let aparDeviceOverrides = { global: {} };
let aparPublishedDeviceOverrideEnabled = { global: false };
let aparPublishedDeviceOverrides = { global: {} };
let aparSavedState = { global: '', admin: '' };
let aparUndoStack = { global: [], admin: [] };
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
  admin: {
    generales: 'acento y acciones compartidas de todo el Super Admin',
    estructura: 'dashboard, sidebar, header, superficies y bordes del panel',
    tipografia: 'títulos, textos principales y textos secundarios del panel',
    botones: 'botones administrativos y sus estados',
    tarjetas: 'tarjetas, tablas, filas y badges administrativos',
    formularios: 'campos, filtros, buscadores y estados de foco',
    estados: 'alertas y mensajes de éxito, error y advertencia',
    modales: 'modales y overlays del Super Admin',
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
  return JSON.stringify({ global: aparStateObject('global'), admin: aparStateObject('admin') });
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
    if (!cfg.activeAdminSchemeId) { cfg = { ...cfg, activeAdminSchemeId: 'default-admin' }; changed = true; }
    for (const scope of ['global', 'admin']) {
      const id = APAR_CATALOG[scope].defaultSchemeId;
      const schemeSnap = await getDoc(doc(db, 'colorSchemes', id));
      if (!schemeSnap.exists()) {
        const defaults = buildDefaultTokenMap(APAR_CATALOG[scope].tokens);
        await setDoc(doc(db, 'colorSchemes', id), {
          scope, name: 'Predeterminado', isDefault: true, active: true,
          tokens: defaults, draftTokens: defaults,
          deviceOverrideEnabled: false, draftDeviceOverrideEnabled: false,
          deviceOverrides: {}, draftDeviceOverrides: {},
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '',
        });
      }
    }
    if (changed) await setDoc(doc(db, 'settings', 'appearance'), cfg, { merge: true });
  } catch (e) { console.error('[apariencia] bootstrap error:', e); }
}

async function loadApariencia() {
  await aparEnsureBootstrap();
  await aparLoadSchemesList('global');
  await aparLoadSchemesList('admin');
  try {
    const appearanceSnap = await getDoc(doc(db, 'settings', 'appearance'));
    const cfg = appearanceSnap.exists() ? appearanceSnap.data() : {};
    aparActiveSchemeId.global = cfg.activeGlobalSchemeId || 'default-global';
    aparActiveSchemeId.admin = cfg.activeAdminSchemeId || 'default-admin';
  } catch (e) {
    console.error('[apariencia] no se pudo leer settings/appearance:', e);
    aparActiveSchemeId.global = aparActiveSchemeId.global || 'default-global';
    aparActiveSchemeId.admin = aparActiveSchemeId.admin || 'default-admin';
  }
  aparEditingSchemeId.global = aparEditingSchemeId.global || aparActiveSchemeId.global;
  aparEditingSchemeId.admin = aparEditingSchemeId.admin || aparActiveSchemeId.admin;
  await aparLoadSchemeIntoDraft('global', aparEditingSchemeId.global);
  await aparLoadSchemeIntoDraft('admin', aparEditingSchemeId.admin);
  aparRenderAll();
  aparRegisterUnsavedGuard();
  window.AdminUnsaved?.markClean?.('appearance-colors');

  document.querySelectorAll('#apar-scope-tabs .correos-tab-btn').forEach(btn => {
    btn.onclick = async () => {
      const nextScope = btn.dataset.aparScope;
      if (nextScope === aparScope) return;
      if (aparHasPending(aparScope)) {
        const leave = confirm('Hay cambios sin guardar en este esquema. Si cambiás de pestaña se descartarán. ¿Continuar?');
        if (!leave) return;
        await aparReloadCurrentScheme(aparScope);
      }
      aparScope = nextScope;
      document.querySelectorAll('#apar-scope-tabs .correos-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      aparRenderAll();
      window.AdminUnsaved?.markClean?.('appearance-colors');
    };
  });
  const searchEl = document.getElementById('apar-search');
  searchEl.value = aparSearchTerm;
  searchEl.oninput = () => { aparSearchTerm = searchEl.value.trim().toLowerCase(); aparRenderCategories(); };
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
      t.label.toLowerCase().includes(term) || t.key.toLowerCase().includes(term) || cat.label.toLowerCase().includes(term));
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
    await addDoc(collection(db, 'colorSchemes', schemeId, 'history'), {
      at: serverTimestamp(), byUid: currentUser?.uid || '', byEmail: currentUser?.email || '',
      action, before: before || {}, after: after || {},
    });
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
  const scopeText = aparScope === 'global'
    ? 'todas las páginas públicas y privadas de clientes y visitantes'
    : 'todas las secciones del Super Admin';
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
    await setDoc(doc(db, 'colorSchemes', schemeId), patch, { merge: true });
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
    await setDoc(doc(db, 'colorSchemes', schemeId), patch, { merge: true });
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
  const field = aparScope === 'global' ? 'activeGlobalSchemeId' : 'activeAdminSchemeId';
  if (aparHasPending() && !confirm('Este esquema tiene cambios sin publicar. Al activarlo se usará la última versión publicada, no el borrador actual. ¿Continuar?')) return;
  try {
    await setDoc(doc(db, 'settings', 'appearance'), { [field]: schemeId }, { merge: true });
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
    const ref = await addDoc(collection(db, 'colorSchemes'), {
      scope: aparScope, name: name.trim(), isDefault: false, active: false,
      tokens: defaults, draftTokens: defaults,
      deviceOverrideEnabled: false, draftDeviceOverrideEnabled: false, deviceOverrides: {}, draftDeviceOverrides: {},
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '',
    });
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
    const ref = await addDoc(collection(db, 'colorSchemes'), {
      scope: aparScope, name: name.trim(), isDefault: false, active: false,
      tokens: { ...aparDraft[aparScope] }, draftTokens: { ...aparDraft[aparScope] },
      deviceOverrideEnabled: aparScope === 'global' ? aparDeviceOverrideEnabled.global : false,
      draftDeviceOverrideEnabled: aparScope === 'global' ? aparDeviceOverrideEnabled.global : false,
      deviceOverrides: aparScope === 'global' ? aparDeviceOverrides.global : {},
      draftDeviceOverrides: aparScope === 'global' ? aparDeviceOverrides.global : {},
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '',
    });
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
    await setDoc(doc(db, 'colorSchemes', schemeId), { name: name.trim() }, { merge: true });
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
    await deleteDoc(doc(db, 'colorSchemes', schemeId));
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
