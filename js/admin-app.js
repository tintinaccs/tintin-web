import { auth, db } from "./firebase.js?v=tintin-20260716-cloudinary-fix-1";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, addDoc,
  query, orderBy, limit, where, writeBatch, serverTimestamp, increment, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sendTestCustomerEmail, sendTemplatedEmail, sendBulkTemplatedEmail } from "./email-notify.js?v=tintin-20260716-cloudinary-fix-1";
// El reenvío de correos de pedido usa el mismo camino por Resend que el envío
// automático del checkout (js/checkout-email-bridge.js), no el webhook viejo
// de Apps Script de email-notify.js — evita reenviar por un canal que ya no
// se usa para pedidos reales.
import { sendOrderNotification } from "./resend-order-notify.js?v=tintin-20260717-resend-1";
import { getUserRole, SUPER_ADMIN, ROLE_LABELS, can } from "./roles.js?v=tintin-20260716-cloudinary-fix-1";
import {
  PERMISSION_MODULES, EDITABLE_ROLES, loadRolePermissions, getRolePermissionsCache,
  canDo, saveRolePermissions, buildDefaultRolePermissions
} from "./role-permissions.js?v=tintin-20260716-cloudinary-fix-1";
import { EMAIL_WEBHOOK_URL } from "./email-config.js?v=tintin-20260716-cloudinary-fix-1";
import { getStoreAccessConfig, isAccessAllowed, renderStoreClosedOverlay } from "./store-gate-core.js?v=tintin-20260716-cloudinary-fix-1";
import { normalizeCollectionDoc } from "./collections-store.js?v=tintin-20260716-cloudinary-fix-1";
import { sanitizeImageUrl } from "./image-utils.js?v=tintin-20260716-cloudinary-fix-1";
import { getDocsPaginated } from "./firestore-pagination.js?v=tintin-20260716-cloudinary-fix-1";
import { attachImageUploadWidget } from "./image-upload-widget.js?v=tintin-20260716-cloudinary-fix-1";
import { openMediaLibraryPicker } from "./admin-media-library-ui.js?v=tintin-20260716-cloudinary-fix-1";
import { initSiteDiagnostics } from "./admin-site-diagnostics.js?v=tintin-20260716-cloudinary-fix-1";
import {
  GLOBAL_TOKENS, GLOBAL_CATEGORIES, ADMIN_TOKENS, ADMIN_CATEGORIES,
  GLOBAL_CONTRAST_PAIRS, ADMIN_CONTRAST_PAIRS, DEVICE_BREAKPOINTS,
  findTokenByKey, buildDefaultTokenMap
} from "./color-scheme-catalog.js?v=tintin-20260716-cloudinary-fix-1";
import { contrastRatio, passesWcag } from "./color-contrast-utils.js?v=tintin-20260716-cloudinary-fix-1";
import { attachColorPicker } from "./color-picker-widget.js?v=tintin-20260716-cloudinary-fix-1";

// ---- GLOBALS ----
let currentUser = null;
let currentRole = null;
let allUsers = [];
let allOrders = [];
let adminOrdersUnsubscribe = null;
let adminUsersUnsubscribe = null;
let adminRealtimeReady = { orders: false, users: false };
let statisticsTrafficSessions = [];
let statisticsTrafficHistorySessions = [];
let statisticsRangeDays = 7;
let statisticsTrafficLoadToken = 0;
let dashboardSessionUnsubscribe = null;
let dashboardPresenceUnsubscribe = null;
let dashboardActivityClock = 0;
let dashboardPresenceRestart = 0;
let dashboardActivityDay = '';
let dashboardActivityState = { sessions: [], presence: [] };

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
  editar_coleccion:       '✏️ Editó colección',
  eliminar_coleccion:     '🗑️ Eliminó colección',
  config_correo_pedido:   '⚙️ Cambió correos automáticos de pedido',
  editar_envio:           '🚚 Cambió ciudades de envío',
  editar_permiso:         '🔐 Cambió permiso de rol',
  cambiar_estado_tienda:  '🏬 Cambió estado de la tienda',
  cambiar_acceso_tienda_cerrada: '🔑 Cambió accesos con tienda cerrada'
};

let _allAuditLogs = [];
let _selectedAuditLogs = new Set();
let _auditUnsubscribe = null;

function loadAuditLog() {
  const tbody = document.getElementById('audit-tbody');
  if (_auditUnsubscribe) {
    renderAuditLogTable();
    return;
  }
  tbody.innerHTML = '<tr><td colspan="5" class="adm-loading"><span class="adm-spinner"></span> Cargando...</td></tr>';
  _auditUnsubscribe = onSnapshot(
    query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(200)),
    snapshot => {
      _allAuditLogs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderAuditLogTable();
    },
    error => {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#c62828;padding:24px">Error al cargar la auditoría: ${escapeHtmlAdmin(error.message)}</td></tr>`;
    }
  );
}

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
  const s = String(v ?? '');
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
const navItems = document.querySelectorAll('[data-section]');
const topbarTitle = document.getElementById('adm-topbar-title');

const SECTION_LABELS = {
  dashboard: 'Dashboard',
  estadisticas: 'Estadísticas',
  usuarios: 'Usuarios',
  pedidos: 'Pedidos',
  productos: 'Productos',
  colecciones: 'Colecciones',
  mensajes: 'Mensajes',
  auditoria: 'Auditoría',
  diagnostico: 'Diagnóstico',
  correos: 'Correos',
  configuracion: 'Configuración',
  importar: 'Import / Export',
  contenido: 'Contenido del Sitio',
  // Sin esta entrada el topbar mostraba la clave cruda "permisos" en lugar de
  // un título legible al entrar a Roles y Permisos.
  permisos: 'Roles y Permisos',
  apariencia: 'Apariencia y esquemas de colores'
};

// Secciones sensibles y el permiso que hace falta para entrar — una sola
// fuente de verdad usada tanto para ocultar el botón (sidebar Y tabs mobile,
// que comparten el mismo data-section) como para bloquear el acceso directo
// (consola, hash, o cualquier otro camino que no pase por el botón).
const SECTION_PERMISSION = {
  estadisticas:  'manageSettings',
  usuarios:      'manageUsers',
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
  // Apariencia: cambia el esquema de colores de TODA la plataforma (o del
  // panel) — mismo criterio de sensibilidad que Configuración/Correos.
  apariencia:    'manageSettings',
  // Roles y Permisos: la sección MÁS sensible del panel — poder editarla
  // equivale a poder otorgarse cualquier otro permiso. manageSettings ya la
  // deja fuera del alcance de admin/agent/viewer (solo superadmin la tiene),
  // pero además se blinda con un chequeo de EMAIL exacto más abajo — no
  // alcanza con role==='superadmin' en Firestore, tiene que ser literalmente
  // tintinaccs@gmail.com (pedido explícito de seguridad).
  permisos:      'manageSettings'
};

// Evita el bucle switchSection → replaceState(#x) → hashchange → switchSection.
let admSuppressHashSync = false;

function switchSection(target) {
  const requiredPerm = SECTION_PERMISSION[target];
  if (requiredPerm && !can(currentRole, requiredPerm)) {
    toast('No tenés permiso para ver esta sección');
    target = 'dashboard';
  }
  if (target === 'permisos' && currentUser?.email !== SUPER_ADMIN) {
    toast('Roles y Permisos es exclusivo de tintinaccs@gmail.com');
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
  // después — p. ej. admin-welcome-control.js agrega la sección "Mensaje de
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
  if (target === 'configuracion') loadConfig();
  if (target === 'importar') loadImportar();
  if (target === 'contenido') loadContenido();
  if (target === 'permisos') loadPermisosSection();
  if (target === 'apariencia') loadApariencia();
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
  if (isKnownSection(fromQuery)) return fromQuery;
  const fromHash = (location.hash || '').replace(/^#/, '');
  if (isKnownSection(fromHash)) return fromHash;
  return null;
}
function applyInitialSectionFromUrl() {
  // El deep-link de Contenido (?tab=contenido&page=…&section=…) tiene su propio
  // manejador (handleContentDeepLink) — no se pisa acá.
  if (new URLSearchParams(location.search).get('tab') === 'contenido') return;
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
// de foco/Escape en admin-unsaved-guard.js. Este bloque agrega, de forma
// centralizada y aditiva (sin tocar cada open/close), el mismo nivel para los
// cuatro overlays operativos: cerrar con Escape, bloquear el scroll de fondo
// mientras hay uno abierto, mover el foco adentro al abrir y devolverlo al
// abrir/al cerrar, y atrapar el Tab dentro del overlay superior.
(function setupAdminOverlayA11y() {
  const OVERLAYS = [
    { id: 'order-edit-overlay',   close: () => window.closeOrderEdit && window.closeOrderEdit() },
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
  const leave = async () => { await signOut(auth); window.location.href = 'login.html'; };
  window.AdminUnsaved ? window.AdminUnsaved.requestNavigation(leave) : leave();
};

// ---- LOGOUT ----
document.getElementById('adm-logout').onclick = () => {
  const leave = async () => { await signOut(auth); window.location.href = 'login.html'; };
  window.AdminUnsaved ? window.AdminUnsaved.requestNavigation(leave) : leave();
};

// ======== AUTH GUARD ========
// El loader de marca (js/page-loader.js) cubre la pantalla mientras se
// resuelve esta función, pero además el CSS de <head> mantiene el sidebar,
// la tabbar mobile y .adm-main en visibility:hidden hasta que se agregue
// html.adm-auth-ready — eso solo pasa al final del único camino que
// realmente muestra el panel real (ver más abajo).
function hideOverlay() { window.ttPageReady && window.ttPageReady(); }

onAuthStateChanged(auth, async user => {
  try {
    // El loader de marca se mantiene arriba (no se llama a hideOverlay) en
    // todo camino que termine navegando a otra página. Antes se ocultaba
    // siempre en un finally, así que en conexiones lentas el loader podía
    // desaparecer y dejar ver el panel real (sidebar, secciones) durante el
    // rato en que la navegación todavía no terminaba de cargar el destino.
    if (!user) { window.location.href = 'login.html'; return; }
    currentUser = user;

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
    handleContentDeepLink();
    applyInitialSectionFromUrl();
    document.documentElement.classList.add('adm-auth-ready');
    hideOverlay();
  } catch(e) {
    console.error('[Admin] Auth init error:', e);
    // No se sabe si el usuario es válido: mismo destino seguro que "sin
    // sesión", en vez de dejar el panel real armado detrás del loader.
    window.location.href = 'login.html';
  }
});

function setupUserInfo(user, role) {
  const avatarEl = document.getElementById('adm-avatar');
  if (avatarEl) {
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" alt="" />`;
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
    if (!can(role, perm)) {
      document.querySelectorAll(`[data-section="${section}"]`).forEach(el => {
        el.style.display = 'none';
      });
    }
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
  statisticsSetText('statistics-blocked-users', `${blockedUsers} bloqueado${blockedUsers === 1 ? '' : 's'}`);
  statisticsSetText('statistics-visitors', String(uniqueVisitors));
  statisticsSetText('statistics-sessions', `${statisticsTrafficSessions.length} sesión${statisticsTrafficSessions.length === 1 ? '' : 'es'}`);
  statisticsSetText('statistics-conversion', uniqueVisitors ? `${(validOrders.length / uniqueVisitors * 100).toFixed(1)}%` : '—');
  statisticsSetText('statistics-online', String(activePresence.length));
  statisticsSetText('statistics-active-products', String(activeProducts.length));
  statisticsSetText('statistics-low-stock', `${lowStockProducts} con stock bajo`);

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
    renderGeneralStatistics();
  } catch (error) {
    if (loadToken !== statisticsTrafficLoadToken) return;
    statisticsSetText('statistics-live-status', 'Actividad no disponible');
    statisticsSetText('statistics-data-status', `No se pudo actualizar la actividad: ${error.code || error.message}`);
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
    adminOrdersUnsubscribe = onSnapshot(query(collection(db, 'orders'), limit(10000)), snapshot => {
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
    adminUsersUnsubscribe = onSnapshot(query(collection(db, 'users'), limit(10000)), snapshot => {
      allUsers = snapshot.docs.map(item => ({ uid: item.id, ...item.data() }));
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

  if (sessionsEl) sessionsEl.textContent = dashboardActivityState.sessions.length;
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
  dashboardSessionUnsubscribe = null;
  dashboardPresenceUnsubscribe = null;
  window.clearInterval(dashboardActivityClock);
  window.clearInterval(dashboardPresenceRestart);
  dashboardActivityClock = 0;
  dashboardPresenceRestart = 0;
  dashboardActivityDay = '';
  dashboardActivityState = { sessions: [], presence: [] };
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
      renderDashboardActivityMetrics();
    },
    error => {
      document.getElementById('stat-online-now').textContent = '—';
      document.getElementById('dashboard-live-status').textContent = 'Presencia no disponible';
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

function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!adminRealtimeReady.users) {
    tbody.innerHTML = '<tr><td colspan="7" class="adm-loading"><span class="adm-spinner"></span> Sincronizando usuarios...</td></tr>';
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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px">${emptyMsg}</td></tr>`;
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
        ${u.phone ? `<div>📞 ${escapeHtmlAdmin(u.phone)}</div>` : ''}
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
        <td>${roleSelect}</td>
        <td>${blockedBadge}${blockedDetail}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');
}

// Búsqueda y pestañas Usuarios/Bloqueados — comparten applyUserFilters()
document.getElementById('user-search').oninput = applyUserFilters;
document.querySelectorAll('#section-usuarios .user-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => window.filterUsersByStatus(btn.dataset.userTab));
});

window.updateUserRole = async (uid, role, email) => {
  if (email === SUPER_ADMIN && currentRole !== 'superadmin') {
    toast('No podés cambiar el rol del Super Admin');
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

// Restaurar: si tenía un rol elevado antes del bloqueo, pide confirmación
// explícita para devolvérselo; si no hay historial (o decide no confirmarlo),
// restaura como Cliente por seguridad — tal como pidió Tintin.
window.restoreUser = async (uid) => {
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  let targetRole = 'client';
  const prevRole = u.roleBeforeBlock;
  if (prevRole && prevRole !== 'client') {
    const roleLabel = ROLE_LABELS[prevRole] || prevRole;
    const restoreElevated = confirm(
      `Este usuario tenía el rol "${roleLabel}" antes de bloquearse.\n\n` +
      `Aceptar = restaurar como ${roleLabel}\n` +
      `Cancelar = restaurar como Cliente (opción más segura)`
    );
    targetRole = restoreElevated ? prevRole : 'client';
  }
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
  // Aclaración honesta (Fase E): esto borra la FICHA de Firestore, no la cuenta
  // real de acceso en Firebase Authentication — eso requeriría Cloud Functions
  // con facturación habilitada (Blaze), que este proyecto no usa. Si la persona
  // vuelve a entrar con el mismo correo, se le crea una ficha nueva como Cliente.
  if (!confirm(
    `¿Eliminar el perfil de "${name}" de la base de datos?\n\n` +
    `Esto borra su ficha de Firestore (datos, rol, historial de bloqueo) pero NO elimina su cuenta real de acceso ` +
    `(Firebase Authentication) — eso necesita un backend con Cloud Functions y facturación, que este proyecto no tiene. ` +
    `Si vuelve a entrar con el mismo correo, se le crea una ficha nueva como Cliente.\n\n` +
    `Esta acción no se puede deshacer.`
  )) return;
  try {
    await deleteDoc(doc(db, 'users', uid));
    allUsers = allUsers.filter(u => u.uid !== uid);
    logAudit('eliminar_usuario', 'usuario', uid, name);
    toast('Perfil eliminado de Firestore');
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

// Restaurar masivo siempre vuelve a "Cliente" (nunca intenta adivinar/preguntar
// el rol anterior de cada uno por separado) — es la opción más segura para
// una acción en lote; si hace falta un rol más alto, se reasigna a mano
// después con el cambio de rol individual o masivo.
window.bulkRestoreUsers = async function() {
  if (!_selectedUsers.size) return;
  if (!can(currentRole, 'manageUsers')) { toast('No tenés permiso para restaurar usuarios'); return; }
  const ids = [..._selectedUsers].filter(uid => {
    const u = allUsers.find(x => x.uid === uid);
    return u && u.email !== SUPER_ADMIN && u.blocked;
  });
  if (!ids.length) { toast('No hay usuarios elegibles en la selección'); return; }
  const n = ids.length;
  if (!confirm(`¿Restaurar ${n} usuario(s) como Cliente? (opción más segura para una restauración en lote)`)) return;
  try {
    await batchUpdateChunked(ids, () => ({
      blocked: false, role: 'client', blockedAt: deleteField(), blockedBy: deleteField(),
      blockReason: deleteField(), roleBeforeBlock: deleteField(), updatedAt: serverTimestamp()
    }), 'users');
    ids.forEach(uid => {
      const u = allUsers.find(x => x.uid === uid);
      if (u) { Object.assign(u, { blocked: false, role: 'client' }); delete u.blockedAt; delete u.blockedBy; delete u.blockReason; delete u.roleBeforeBlock; }
    });
    logAudit('restaurar_usuario', 'usuario', '', '', 'Restaurados como Cliente', { bulk: true, count: n });
    toast(`${n} usuario(s) restaurados como Cliente`);
    clearUsersSelection();
    applyUserFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

function userRowsToCsv_(users) {
  const header = ['Nombre', 'Email', 'Rol', 'Estado', 'Teléfono', 'Compras', 'Total gastado'];
  const rows = users.map(u => [
    u.name || '', u.email || '', ROLE_LABELS[u.role] || u.role || '',
    u.blocked ? 'Bloqueado' : 'Activo', u.phone || '', u.purchaseCount || 0, u.totalSpent || 0
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
    const orderArg = inlineArgumentAdmin(o.id);
    const detailId = `order-detail-${o.id}`;
    const detailArg = inlineArgumentAdmin(detailId);
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
      <tr class="adm-order-row" style="cursor:pointer" onclick="window.toggleOrderDetail(${detailArg})">
        <td class="col-select" data-label="Seleccionar" onclick="event.stopPropagation()"><input type="checkbox" class="order-row-check" data-id="${safeOrderId}" onclick="toggleOrderSelect(this)" ${_selectedOrders.has(o.id) ? 'checked' : ''}></td>
        <td data-label="Pedido" style="font-size:11px;color:#777;font-weight:700">#${escapeHtmlAdmin(o.id.slice(-6).toUpperCase())}</td>
        <td data-label="Cliente">
          <strong>${escapeHtmlAdmin(o.userName || '—')}</strong><br>
          <small style="color:#777">${escapeHtmlAdmin(o.userPhone || '')}</small><br>
          <small style="color:#777;font-size:10px">${escapeHtmlAdmin(o.userEmail || '')}</small>
        </td>
        <td data-label="Productos" style="font-size:12px;max-width:160px">${escapeHtmlAdmin(itemsText || '—')}</td>
        <td data-label="Total" style="font-weight:800;color:var(--adm-accent)">${formatPrice(o.total || 0)}</td>
        <td data-label="Estado" onclick="event.stopPropagation()">
          ${orderStatusBadgeHtml(orderStatus)}
          ${canUpdate ? `<br><select class="adm-select" style="width:auto;font-size:10px;padding:2px 6px;margin-top:4px" onchange="window.updateOrderStatus(${orderArg}, this.value)">
            ${orderStatusOptions(orderStatus)}
          </select>` : ''}
        </td>
        <td data-label="Ciudad">${escapeHtmlAdmin(o.shipping?.city || o.city || '—')}</td>
        <td data-label="Pago" onclick="event.stopPropagation()">
          <div style="font-size:11px;color:#666">${escapeHtmlAdmin(o.payment?.method || o.paymentMethod || '—')}</div>
          ${payStatusBadgeHtml(payStatus)}
          ${canUpdatePay ? `<br><select class="adm-select" style="width:auto;font-size:10px;padding:2px 6px;margin-top:4px" onchange="window.updatePayStatus(${orderArg}, this.value)">
            ${payStatusOptions(payStatus)}
          </select>` : ''}
        </td>
        <td data-label="Fecha" style="font-size:12px;color:#aaa">${formatDate(o.createdAt)}</td>
        <td data-label="Notif." onclick="event.stopPropagation()" style="text-align:center">
          ${notifBadge(o.notificationStatus || 'pending')}
          ${o.resendCount ? `<div style="font-size:9px;color:#888;margin-top:2px">Reenviado (${o.resendCount})</div>` : ''}
          ${o.notificationError ? `<div style="font-size:9px;color:#c62828;margin-top:2px" title="${escapeHtmlAdmin(o.notificationError)}">ver error</div>` : ''}
          ${canResend ? `<button type="button" class="adm-btn adm-btn-sm" id="resend-btn-${safeOrderId}" style="margin-top:4px;font-size:9px;padding:3px 8px" onclick="window.resendOrderEmail(${orderArg})" title="Reenviar el correo de este pedido">✉️ Reenviar</button>` : ''}
        </td>
        <td data-label="Editar" onclick="event.stopPropagation()">
          ${canEditFull ? `<button type="button" class="adm-btn adm-btn-sm" onclick="openOrderEdit(${orderArg})" title="Editar pedido completo"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>` : '—'}
        </td>
        <td class="col-actions-sticky" data-label="Eliminar" onclick="event.stopPropagation()">
          ${canDelete ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" onclick="window.deleteOrder(${orderArg})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>` : '—'}
        </td>
      </tr>
      <tr id="${escapeHtmlAdmin(detailId)}" class="adm-order-detail-row" style="display:none">
        <td colspan="12" style="padding:0 14px 12px;background:#fef5f8">
          <div class="adm-order-detail open">
            <div style="font-weight:800;margin-bottom:8px;color:var(--adm-accent)">Detalle del pedido #${escapeHtmlAdmin(o.id.slice(-6).toUpperCase())}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
              <div class="adm-detail-row"><span class="adm-detail-label">Cliente:</span> ${escapeHtmlAdmin(o.userName || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Email:</span> ${escapeHtmlAdmin(o.userEmail || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Teléfono:</span> ${escapeHtmlAdmin(o.userPhone || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Envío:</span> ${escapeHtmlAdmin(o.shipping?.method || o.shippingMethod || '—')} — ${escapeHtmlAdmin(o.shipping?.city || o.city || '')}</div>
              ${o.shipping?.address || o.address ? `<div class="adm-detail-row"><span class="adm-detail-label">Dirección:</span> ${escapeHtmlAdmin(o.shipping?.address || o.address)}</div>` : ''}
              ${o.shipping?.referencia || o.referencia ? `<div class="adm-detail-row"><span class="adm-detail-label">Referencia:</span> ${escapeHtmlAdmin(o.shipping?.referencia || o.referencia)}</div>` : ''}
              <div class="adm-detail-row"><span class="adm-detail-label">Pago:</span> ${escapeHtmlAdmin(o.payment?.method || o.paymentMethod || '—')}</div>
              <div class="adm-detail-row"><span class="adm-detail-label">Estado pago:</span> ${escapeHtmlAdmin(payStatus)}</div>
            </div>
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
                      <div style="color:var(--adm-accent)">${formatPrice(it.price * it.qty)}</div>
                    </div>
                  </div>
                `;
                }).join('')}
              </div>
            </div>
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid #f0d8e0;font-size:13px">
              Subtotal: <strong>${formatPrice(o.subtotal||0)}</strong> &nbsp;|&nbsp;
              Envío: <strong>${o.shippingCost == null ? 'Consultar precio' : formatPrice(o.shippingCost)}</strong> &nbsp;|&nbsp;
              <span style="color:var(--adm-accent);font-weight:900;font-size:15px">TOTAL: ${formatPrice(o.total||0)}</span>
            </div>
            ${o.userPhone ? `
            <div style="margin-top:12px">
              <a href="https://wa.me/${o.userPhone.replace(/\D/g,'')}?text=${encodeURIComponent(waConfirmMessageTemplate.replace(/\{nombre\}/g, o.userName || ''))}" target="_blank" rel="noopener" class="adm-btn adm-btn-sm" style="background:#25D366;color:#fff!important;text-decoration:none;display:inline-flex;align-items:center;gap:6px">💬 Abrir WhatsApp del cliente</a>
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

window.updateOrderStatus = async (orderId, status) => {
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'cambiarEstado')) { toast('No tenés permiso para cambiar el estado de pedidos'); return; }
  const o = allOrders.find(o => o.id === orderId);
  const prevStatus = o?.status || 'pendiente';
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp()
    });
    if (o) o.status = status;
    logAudit('cambiar_estado_pedido', 'pedido', orderId, o?.shortId || orderId,
      `Estado: ${ORDER_STATUS_LABELS[prevStatus] || prevStatus} → ${ORDER_STATUS_LABELS[status] || status}`);
    toast(`Estado actualizado: ${ORDER_STATUS_LABELS[status] || status}`);
    // El <select> ya se actualiza solo (comportamiento nativo del navegador),
    // pero el badge de arriba es un <span> aparte que solo se actualiza si
    // se vuelve a renderizar la fila — sin esto quedaba desactualizado hasta
    // la próxima carga de la sección. applyOrderFilters() en vez de
    // renderOrdersTable(allOrders) directo para no perder un filtro activo.
    applyOrderFilters();
    // Correo automático opcional (Super Admin → Correos → Correos de
    // pedidos) — desactivado por defecto para cada estado nuevo, así que no
    // cambia nada hasta que se active a propósito. Nunca bloquea ni revierte
    // el cambio de estado si el envío falla (fire-and-forget, con su propio
    // try/catch interno).
    if (o) maybeSendOrderStatusEmail_(o, 'status', status);
  } catch(e) {
    // El <select> ya muestra el valor nuevo por su cuenta (comportamiento
    // nativo del navegador) aunque el guardado haya fallado — como allOrders
    // no se tocó, volver a renderizar la tabla lo repone al valor real.
    toast('No se pudo guardar el estado. Probá de nuevo.');
    applyOrderFilters();
  }
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
    if (!result.success) throw new Error(emailErrorMessage_(result.error) || result.error || 'Error desconocido — revisá que js/email-config.js esté configurado');

    await updateDoc(doc(db, 'orders', orderId), {
      resendCount: increment(1),
      lastResendAt: serverTimestamp(),
      notificationStatus: 'sent',
      updatedAt: serverTimestamp()
    });
    o.resendCount = (o.resendCount || 0) + 1;
    o.notificationStatus = 'sent';
    o.lastResendAt = { toDate: () => new Date() };
    logAudit('reenviar_correo_pedido', 'pedido', orderId, o.shortId || orderId, `Reenvío #${o.resendCount}`);
    toast('Correo reenviado correctamente');
    applyOrderFilters();
  } catch (e) {
    toast('Error al reenviar el correo: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✉️ Reenviar'; }
  }
};

window.updatePayStatus = async (orderId, status) => {
  if (!can(currentRole, 'manageOrders') || !roleCanDo('pedidos', 'cambiarPago')) { toast('No tenés permiso para cambiar el estado de pago'); return; }
  const o = allOrders.find(o => o.id === orderId);
  const prevStatus = o?.paymentStatus || o?.payment?.status || 'pendiente';
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      'payment.status': status,
      paymentStatus: status,
      updatedAt: serverTimestamp()
    });
    if (o) { if (o.payment) o.payment.status = status; o.paymentStatus = status; }
    logAudit('cambiar_estado_pago', 'pedido', orderId, o?.shortId || orderId,
      `Estado de pago: ${PAY_STATUS_LABELS[prevStatus] || prevStatus} → ${PAY_STATUS_LABELS[status] || status}`);
    toast(`Estado de pago: ${PAY_STATUS_LABELS[status] || status}`);
    applyOrderFilters();
    if (o) maybeSendOrderStatusEmail_(o, 'payment', status);
  } catch(e) {
    toast('No se pudo guardar el estado de pago. Probá de nuevo.');
    applyOrderFilters();
  }
};

window.deleteOrder = async (orderId) => {
  if (!can(currentRole, 'manageOrdersFull') || !roleCanDo('pedidos', 'eliminar')) { toast('No tenés permiso para eliminar pedidos'); return; }
  if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return;
  try {
    const o = allOrders.find(x => x.id === orderId);
    await deleteDoc(doc(db, 'orders', orderId));
    allOrders = allOrders.filter(o => o.id !== orderId);
    logAudit('eliminar_pedido', 'pedido', orderId, o?.shortId || orderId, `Cliente: ${o?.userName || o?.userEmail || '—'}`);
    toast('Pedido eliminado');
    applyOrderFilters();
  } catch(e) {
    toast('Error al eliminar pedido');
  }
};

let _lastFilteredOrders = [];
function applyOrderFilters() {
  const search = (document.getElementById('order-search')?.value || '').toLowerCase();
  const statusVal = document.getElementById('filter-status')?.value || '';
  const payVal = document.getElementById('filter-pay-status')?.value || '';
  let filtered = allOrders;
  if (statusVal) filtered = filtered.filter(o => o.status === statusVal);
  if (payVal) filtered = filtered.filter(o => (o.payment?.status || o.paymentStatus || 'pendiente') === payVal);
  if (search) filtered = filtered.filter(o =>
    (o.userName||'').toLowerCase().includes(search) ||
    (o.userEmail||'').toLowerCase().includes(search) ||
    (o.userPhone||'').toLowerCase().includes(search) ||
    (o.id||'').toLowerCase().includes(search)
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
document.getElementById('order-search').oninput = applyOrderFilters;

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
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedOrders.add(cb.dataset.id);
    else _selectedOrders.delete(cb.dataset.id);
  });
  updateOrdersBulkToolbar();
};

window.toggleOrderSelect = function(cb) {
  if (cb.checked) _selectedOrders.add(cb.dataset.id);
  else _selectedOrders.delete(cb.dataset.id);
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
    await batchUpdateChunked(ids, () => ({ status, updatedAt: serverTimestamp() }), 'orders');
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
    await batchUpdateChunked(ids, () => ({ 'payment.status': status, paymentStatus: status, updatedAt: serverTimestamp() }), 'orders');
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
  let ok = 0, fail = 0, skipped = 0;
  toast(`Reenviando 0 de ${n}…`, 60000);
  for (let i = 0; i < ids.length; i++) {
    const o = allOrders.find(x => x.id === ids[i]);
    try {
      if (!o) throw new Error('no encontrado');
      // Protección anti-spam: si este pedido puntual se reenvió hace menos
      // de RESEND_COOLDOWN_SECONDS, se omite (no cuenta como fallo) en vez
      // de forzar el reenvío — el tope diario global lo aplica Apps Script.
      if (resendCooldownRemaining_(o) > 0) { skipped++; continue; }
      const orderForEmail = { ...o, createdAt: o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : o.createdAt };
      const result = await sendOrderNotification(ids[i], orderForEmail, true);
      if (!result.success) throw new Error(result.error || 'error desconocido');
      await updateDoc(doc(db, 'orders', ids[i]), {
        resendCount: increment(1), lastResendAt: serverTimestamp(), notificationStatus: 'sent', updatedAt: serverTimestamp()
      });
      o.resendCount = (o.resendCount || 0) + 1;
      o.notificationStatus = 'sent';
      o.lastResendAt = { toDate: () => new Date() };
      ok++;
    } catch (e) { fail++; }
    toast(`Reenviando ${i + 1} de ${n}…`, 60000);
  }
  logAudit('reenviar_correo_pedido', 'pedido', '', '', `${ok} enviados, ${fail} fallaron${skipped ? `, ${skipped} omitidos por cooldown` : ''}`, { bulk: true, count: n });
  const summary = `${ok} correo(s) reenviados` + (fail ? `, ${fail} fallaron` : '') + (skipped ? `, ${skipped} omitidos (cooldown anti-spam)` : '');
  toast(fail || skipped ? summary : `${ok} correo(s) reenviados correctamente`, 6000);
  clearOrdersSelection();
  applyOrderFilters();
};

window.bulkDeleteOrders = async function() {
  if (!_selectedOrders.size) return;
  if (currentRole !== 'superadmin') { toast('Solo Super Admin puede eliminar pedidos en lote'); return; }
  const n = _selectedOrders.size;
  if (!confirm(`¿ELIMINAR DEFINITIVAMENTE ${n} pedido(s)? Esta acción NO se puede deshacer.`)) return;
  const typed = prompt(`Para confirmar, escribí CONFIRMAR (${n} pedidos serán eliminados):`);
  if (typed !== 'CONFIRMAR') { toast('Cancelado — no se escribió CONFIRMAR'); return; }
  try {
    const ids = [..._selectedOrders];
    const CHUNK = 450;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'orders', id)));
      await batch.commit();
    }
    const idSet = new Set(ids);
    allOrders = allOrders.filter(o => !idSet.has(o.id));
    logAudit('eliminar_pedido', 'pedido', '', '', `${n} pedidos eliminados`, { bulk: true, count: n });
    toast(`${n} pedido(s) eliminados definitivamente`);
    clearOrdersSelection();
    applyOrderFilters();
  } catch (e) { toast('Error: ' + e.message); }
};

function orderRowsToCsv_(orders) {
  const header = ['ID', 'Cliente', 'Email', 'Teléfono', 'Ciudad', 'Productos', 'Total', 'Estado', 'Estado de pago', 'Fecha'];
  const rows = orders.map(o => [
    o.id,
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
    'cfg-pay-transferencia', 'cfg-pay-pagopark', 'cfg-bank-ueno', 'cfg-bank-atlas',
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
    const pays = d.paymentMethods || { efectivo: true, transferencia: true, pagopark: false };
    document.getElementById('cfg-pay-efectivo').checked = pays.efectivo !== false;
    document.getElementById('cfg-pay-transferencia').checked = pays.transferencia !== false;
    document.getElementById('cfg-pay-pagopark').checked = !!pays.pagopark;
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
        pagopark:       document.getElementById('cfg-pay-pagopark').checked,
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

    await settingsBatch.commit();
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

// ======== CORREOS (Super Admin) ========
// Módulo completo de correos: dashboard, correos de pedidos configurables,
// correos de prueba, plantillas (CRUD), clientas registradas, promociones
// controladas, historial y configuración. Todo persiste en Firestore
// (emailSettings/emailTemplates/emailLogs/emailCampaigns) — ver
// firestore.rules y functions/EMAIL_SETUP.md.

const EMAIL_SENDER_ADDRESS = 'tintinpedidos@gmail.com'; // fijo por Apps Script — informativo, no editable
const TEST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROMO_BATCH_SIZE = 20;

// {{variable}} protegidas — siempre las calcula el sitio a partir del pedido
// real, del perfil real de la clienta, o de datos ficticios de prueba. El
// Super Admin nunca escribe el valor final a mano en su lugar.
const PROTECTED_VARS = ['clienteNombre','pedidoNumero','productos','total','estadoPedido','metodoEntrega','fechaPedido'];

const ORDER_TYPE_KEYS = [
  'pedido_recibido_clienta','pedido_recibido_tintin','pedido_confirmado','pedido_cancelado',
  'pedido_rechazado','pago_recibido','pedido_listo_retiro','pedido_en_camino','pedido_entregado'
];
const ORDER_TYPE_NAMES = {
  pedido_recibido_clienta: 'Pedido recibido (clienta)',
  pedido_recibido_tintin:  'Pedido recibido (Tintin)',
  pedido_confirmado:       'Pedido confirmado',
  pedido_cancelado:        'Pedido cancelado',
  pedido_rechazado:        'Pedido rechazado',
  pago_recibido:           'Pago recibido',
  pedido_listo_retiro:     'Pedido listo para retirar',
  pedido_en_camino:        'Pedido en camino',
  pedido_entregado:        'Pedido entregado'
};
// Mapea el status/estado de pago real de un pedido (Pedidos) al tipo de
// correo configurable acá — solo estos 6 disparan el nuevo correo automático
// opcional; "recibido" ya funciona desde siempre vía checkout, aparte de esto.
const ORDER_STATUS_TO_TYPE = {
  confirmado: 'pedido_confirmado', cancelado: 'pedido_cancelado', rechazado: 'pedido_rechazado',
  listo_retiro: 'pedido_listo_retiro', en_camino: 'pedido_en_camino', entregado: 'pedido_entregado'
};
const PAY_STATUS_TO_TYPE = { pagado: 'pago_recibido' };

// Contenido inicial de las 15 plantillas — se crean en Firestore la primera
// vez que se abre Correos (ensureTemplatesSeeded_), una sola vez por key.
const TEMPLATE_SEEDS = {
  pedido_recibido_clienta: { name: 'Pedido recibido para clienta', category: 'pedido',
    subject: 'Recibimos tu pedido en Tintin — Pedido #{{pedidoNumero}}',
    greeting: 'Gracias por tu pedido, {{clienteNombre}}.',
    intro: 'Recibimos tu pedido en Tintin Accesorios. Estamos preparando todo con cuidado y te vamos a contactar para confirmar los detalles del envío.',
    closing: 'Gracias por elegirnos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_recibido_tintin: { name: 'Pedido recibido para Tintin', category: 'pedido',
    subject: 'Nuevo pedido recibido en Tintin — Pedido #{{pedidoNumero}}',
    greeting: 'Nuevo pedido de {{clienteNombre}}.',
    intro: 'Se recibió un nuevo pedido en la tienda.',
    closing: 'Revisalo en el panel de administración.', signature: 'Tintin Accesorios', promoText: '',
    buttonText: 'Ver en el panel', buttonUrl: 'https://tintinaccs.github.io/tintin-web/admin.html',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_confirmado: { name: 'Pedido confirmado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} fue confirmado',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} fue confirmado y ya lo estamos preparando.',
    closing: 'Te avisamos en cuanto esté listo.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_cancelado: { name: 'Pedido cancelado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} fue cancelado',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} fue cancelado.',
    closing: 'Si tenés dudas, escribinos y te ayudamos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_rechazado: { name: 'Pedido rechazado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} no pudo procesarse',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'No pudimos procesar tu pedido #{{pedidoNumero}}.',
    closing: 'Escribinos si querés que te ayudemos a resolverlo.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pago_recibido: { name: 'Pago recibido', category: 'pedido',
    subject: 'Recibimos tu pago del pedido #{{pedidoNumero}}',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Confirmamos que recibimos el pago de tu pedido #{{pedidoNumero}}.',
    closing: 'Gracias por tu compra.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_listo_retiro: { name: 'Pedido listo para retirar', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} está listo para retirar',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} ya está listo para que lo retires.',
    closing: 'Te esperamos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_en_camino: { name: 'Pedido en camino', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} está en camino',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} ya está en camino.',
    closing: 'Pronto lo vas a tener en tus manos.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  pedido_entregado: { name: 'Pedido entregado', category: 'pedido',
    subject: 'Tu pedido #{{pedidoNumero}} fue entregado',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Tu pedido #{{pedidoNumero}} fue entregado.',
    closing: 'Gracias por elegirnos, esperamos que lo disfrutes.', signature: 'Tintin Accesorios', promoText: '', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
  promo_general: { name: 'Promoción general', category: 'promo',
    subject: 'Tenemos novedades para vos, {{clienteNombre}}',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Queremos contarte sobre nuestras últimas novedades en Tintin Accesorios.',
    promoText: 'Descubrí los nuevos productos en nuestra tienda.',
    closing: 'Gracias por ser parte de Tintin.', signature: 'Tintin Accesorios',
    buttonText: 'Ver tienda', buttonUrl: 'https://tintinaccs.github.io/tintin-web/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  novedades: { name: 'Novedades', category: 'promo',
    subject: 'Novedades en Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Llegaron productos nuevos a la tienda.',
    promoText: 'Vení a conocerlos.',
    closing: 'Te esperamos.', signature: 'Tintin Accesorios',
    buttonText: 'Ver novedades', buttonUrl: 'https://tintinaccs.github.io/tintin-web/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  promo_dia_amistad: { name: 'Promo Día de la Amistad', category: 'promo',
    subject: 'Feliz Día de la Amistad, {{clienteNombre}}',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'En el Día de la Amistad te dejamos una selección especial de regalos.',
    promoText: 'Encontrá el regalo ideal para esa amiga especial.',
    closing: 'Gracias por elegirnos.', signature: 'Tintin Accesorios',
    buttonText: 'Ver regalos', buttonUrl: 'https://tintinaccs.github.io/tintin-web/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  promo_relojes: { name: 'Promo de relojes', category: 'promo',
    subject: 'Nuevos relojes en Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Llegó una nueva colección de relojes.',
    promoText: 'Conocé los modelos disponibles.',
    closing: 'Te esperamos en la tienda.', signature: 'Tintin Accesorios',
    buttonText: 'Ver relojes', buttonUrl: 'https://tintinaccs.github.io/tintin-web/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  promo_bolsos: { name: 'Promo de bolsos', category: 'promo',
    subject: 'Nuevos bolsos en Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},',
    intro: 'Llegó una nueva colección de bolsos.',
    promoText: 'Conocé los modelos disponibles.',
    closing: 'Te esperamos en la tienda.', signature: 'Tintin Accesorios',
    buttonText: 'Ver bolsos', buttonUrl: 'https://tintinaccs.github.io/tintin-web/',
    brandPhrase: 'Tintin Accesorios', footer: 'Si no querés recibir más promociones, respondé este correo y te sacamos de la lista.' },
  mensaje_libre: { name: 'Mensaje libre', category: 'libre',
    subject: 'Un mensaje de Tintin Accesorios',
    greeting: 'Hola {{clienteNombre}},', intro: '',
    promoText: 'Escribí acá el mensaje que quieras enviar.',
    closing: 'Gracias.', signature: 'Tintin Accesorios', buttonText: '', buttonUrl: '',
    brandPhrase: 'Tintin Accesorios', footer: '' },
};

let emailSettingsCache = null;
let allEmailTemplates = [];
let allEmailLogs = [];
let allEmailCampaigns = [];
let allClientUsers = [];
let emailRealtimeUnsubscribers = [];
let emailModuleStarted = false;
let promoRecipients = [];   // [{email, name}] — destinatarias armadas para Promociones
let cliSelected = new Set(); // emails seleccionados en Clientas registradas
let promoPendingSend = null;
let tplFilterCategory = '';
let tplShowArchived = false;
let tplSearchQuery = '';

function defaultEmailSettings_() {
  const orderTypesEnabled = {};
  ORDER_TYPE_KEYS.forEach(k => { orderTypesEnabled[k] = (k === 'pedido_recibido_clienta' || k === 'pedido_recibido_tintin'); });
  const orderTypeTemplateMap = {};
  ORDER_TYPE_KEYS.forEach(k => { orderTypeTemplateMap[k] = k; });
  return {
    orderEmailsEnabled: true, internalEmailEnabled: true, customerEmailEnabled: true,
    testEmailsEnabled: true, promoEnabled: true,
    senderName: 'Tintin Accesorios', senderEmail: EMAIL_SENDER_ADDRESS, internalEmail: 'tintinaccs@gmail.com',
    signature: 'Tintin Accesorios', footer: '', whatsappNumber: '',
    testDailyLimit: 20, promoDailyLimit: 100, resendDailyLimit: 30,
    orderTypesEnabled, orderTypeTemplateMap
  };
}

// tintinpedidos@gmail.com (o cualquier @gmail.com) es una cuenta de Gmail
// común, no un dominio propio de la tienda — MailApp la usa para enviar
// desde Apps Script (ver functions/EMAIL_SETUP.md). Con ese remitente,
// mandar campañas/promos masivas arriesga que Google marque la cuenta como
// spam o la suspenda; los correos transaccionales de pedidos (uno por vez,
// generados por una acción real de la clienta) son un uso legítimo y no se
// tocan.
function isGmailSender_(senderEmail) {
  return /@gmail\.com\s*$/i.test(String(senderEmail || '').trim());
}

function renderVarsClient_(str, vars) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (m, key) => {
    const v = vars && vars[key];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

function buildPreviewHtml_(t, vars) {
  const v = vars || {};
  const brandPhrase = renderVarsClient_(t.brandPhrase, v);
  const greeting = renderVarsClient_(t.greeting, v);
  const intro = renderVarsClient_(t.intro, v);
  const promoText = renderVarsClient_(t.promoText, v);
  const closing = renderVarsClient_(t.closing, v);
  const signature = renderVarsClient_(t.signature, v) || 'Tintin Accesorios';
  const footer = renderVarsClient_(t.footer, v);
  const buttonText = renderVarsClient_(t.buttonText, v);
  const buttonUrl = t.buttonUrl || '';
  const buttonHtml = (buttonText && buttonUrl)
    ? `<p style="text-align:center;margin:24px 0"><a href="${buttonUrl}" style="background:#b84c72;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block">${buttonText}</a></p>`
    : '';
  const fontBase = new URL('assets-tintin/fonts/', document.baseURI).href;
  const fontCss = `<style>` +
    `@font-face{font-family:Montserrat;font-style:normal;font-weight:100 900;font-display:block;src:url("${fontBase}montserrat-latin-wght-normal.woff2") format("woff2")}` +
    `@font-face{font-family:Montserrat;font-style:italic;font-weight:100 900;font-display:block;src:url("${fontBase}montserrat-latin-wght-italic.woff2") format("woff2")}` +
    `html,body,body *{font-family:Montserrat!important;font-synthesis:none}` +
    `</style>`;
  return `<!DOCTYPE html><html><head>${fontCss}</head><body style="font-family:Montserrat;max-width:600px;margin:auto;background:#ffffff;padding:24px;color:#333">` +
    `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:28px">` +
    (brandPhrase ? `<p style="color:#b84c72;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:0 0 14px">${brandPhrase}</p>` : '') +
    (greeting ? `<h2 style="color:#b84c72;margin:0 0 14px;font-size:18px">${greeting}</h2>` : '') +
    (intro ? `<p style="color:#555;line-height:1.6;margin:0 0 16px;font-size:14px;white-space:pre-line">${intro}</p>` : '') +
    (promoText ? `<p style="color:#333;line-height:1.6;margin:0 0 16px;font-size:14px;white-space:pre-line">${promoText}</p>` : '') +
    buttonHtml +
    (closing ? `<p style="color:#555;line-height:1.6;margin:16px 0 0;font-size:14px;white-space:pre-line">${closing}</p>` : '') +
    `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e5e5">` +
    `<p style="color:#999;font-size:12px;margin:0;white-space:pre-line">${signature}</p>` +
    (footer ? `<p style="color:#bbb;font-size:11px;margin:10px 0 0;white-space:pre-line">${footer}</p>` : '') +
    `</div></div></body></html>`;
}

function fakeTestVariables_() {
  return {
    clienteNombre: 'Cliente de prueba', pedidoNumero: 'TEST123', productos: '1x BAG RUBY',
    total: formatPrice(190000), estadoPedido: 'Pendiente de confirmación', metodoEntrega: 'Delivery',
    fechaPedido: new Date().toLocaleDateString('es-PY')
  };
}

function orderToVariables_(order) {
  return {
    clienteNombre: order.userName || '',
    pedidoNumero: order.shortId || (order.id ? String(order.id).slice(0,8).toUpperCase() : ''),
    productos: (order.items||[]).map(i => `${i.qty}x ${i.name}`).join(', '),
    total: formatPrice(order.total || 0),
    estadoPedido: ORDER_STATUS_LABELS[order.status] || order.status || '',
    metodoEntrega: ({delivery:'Delivery', encomienda:'Encomienda', retiro:'Retiro en tienda'})[order.shipping?.method] || '',
    fechaPedido: formatDate(order.createdAt)
  };
}

function templateContentPayload_(tpl) {
  return {
    subject: tpl.subject || '', greeting: tpl.greeting || '', intro: tpl.intro || '', closing: tpl.closing || '',
    signature: tpl.signature || '', promoText: tpl.promoText || '', buttonText: tpl.buttonText || '',
    buttonUrl: tpl.buttonUrl || '', brandPhrase: tpl.brandPhrase || '', footer: tpl.footer || ''
  };
}

function logStatusBadge_(status) {
  const map = { sent: 'badge-entregado', failed: 'badge-cancelado', partial: 'badge-preparando', pending: 'badge-pendiente' };
  const labels = { sent: 'Enviado', failed: 'Fallido', partial: 'Parcial', pending: 'Pendiente' };
  return `<span class="adm-badge ${map[status] || 'badge-pendiente'}">${labels[status] || status || '—'}</span>`;
}

function templateLabel_(key) {
  if (ORDER_TYPE_NAMES[key]) return ORDER_TYPE_NAMES[key];
  const t = allEmailTemplates.find(t => t.key === key || t.id === key);
  if (t) return t.name;
  if (key === 'promo') return 'Promoción';
  return key || '—';
}

async function getEmailSettingsFresh_() {
  try {
    const snap = await getDoc(doc(db, 'emailSettings', 'main'));
    return snap.exists() ? snap.data() : {};
  } catch (e) { return {}; }
}

async function saveEmailSettingsMerge_(patch) {
  try {
    await setDoc(doc(db, 'emailSettings', 'main'), { ...patch, updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '' }, { merge: true });
    return true;
  } catch (e) {
    toast('Error al guardar: ' + e.message);
    return false;
  }
}

async function ensureTemplatesSeeded_(existing) {
  const existingKeys = new Set(existing.map(t => t.key).filter(Boolean));
  const toCreate = Object.keys(TEMPLATE_SEEDS).filter(k => !existingKeys.has(k));
  for (const key of toCreate) {
    const seed = TEMPLATE_SEEDS[key];
    const content = { subject: seed.subject, greeting: seed.greeting, intro: seed.intro, closing: seed.closing,
      signature: seed.signature, promoText: seed.promoText, buttonText: seed.buttonText, buttonUrl: seed.buttonUrl || '',
      brandPhrase: seed.brandPhrase, footer: seed.footer };
    try {
      await setDoc(doc(db, 'emailTemplates', key), {
        key, name: seed.name, category: seed.category, ...content,
        active: true, archived: false, original: content,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || ''
      });
      existing.push({ id: key, key, name: seed.name, category: seed.category, ...content, active: true, archived: false, original: content });
    } catch (e) {
      console.error('No se pudo crear la plantilla inicial ' + key + ':', e);
    }
  }
  return existing;
}

async function logEmailSend_(entry) {
  // OJO: el timestamp queda fijo en el momento de crear el objeto (una
  // variable capturada), NO como `() => new Date()` — si el closure llamara
  // a `new Date()` en cada lectura, cualquier chequeo que reevalúe
  // `sentAt.toDate()` más tarde (como el cooldown de correos de prueba)
  // vería SIEMPRE "recién enviado", sin importar cuánto tiempo real pasó.
  const sentAtSnapshot = new Date();
  const local = {
    id: 'local-' + Date.now() + Math.random(), sentAt: { toDate: () => sentAtSnapshot },
    isAutomatic: !!entry.isAutomatic, sentBy: currentUser?.email || '', error: entry.error || '',
    orderId: entry.orderId || '', campaignId: entry.campaignId || '', templateKey: entry.templateKey || '',
    // 'pedido' (correo real de un pedido, ej. estado automático) / 'prueba'
    // (Correos de prueba) / 'promo' (Promociones) — separa pedidos reales
    // de pruebas en Historial, en vez de que todo se vea igual.
    category: entry.category || 'pedido',
    type: entry.type || '', recipient: entry.recipient || '', status: entry.status || 'pending',
    variables: entry.variables || null
  };
  allEmailLogs.unshift(local);
  renderCorreosDashboard();
  renderCorreosHistorialTab();
  try {
    await addDoc(collection(db, 'emailLogs'), {
      category: local.category, type: local.type, recipient: local.recipient, status: local.status, templateKey: local.templateKey,
      isAutomatic: local.isAutomatic, sentBy: local.sentBy, error: local.error, orderId: local.orderId,
      campaignId: local.campaignId, variables: local.variables, sentAt: serverTimestamp()
    });
  } catch (e) {
    console.error('No se pudo registrar en emailLogs:', e);
  }
}

// ---- Carga principal del módulo ----
function refreshCorreosClientasFromRealtime() {
  allClientUsers = allUsers
    .filter(user => (user.role || 'client') === 'client')
    .map(user => {
      const theirOrders = allOrders.filter(order =>
        order.userId === user.uid ||
        (order.userEmail && user.email && order.userEmail.toLowerCase() === user.email.toLowerCase())
      );
      let lastPurchase = null;
      theirOrders.forEach(order => {
        const date = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt ? new Date(order.createdAt) : null);
        if (date && (!lastPurchase || date > lastPurchase)) lastPurchase = date;
      });
      return { ...user, orderCount: theirOrders.length, lastPurchase };
    });
  if (!emailModuleStarted) return;
  renderCorreosClientasTab();
  renderCorreosPromocionesTab();
}

function renderCorreosRealtimeViews() {
  if (!emailModuleStarted) return;
  renderCorreosDashboard();
  renderCorreosPedidosTab();
  renderCorreosPruebaTab();
  renderCorreosPlantillasTab();
  renderCorreosHistorialTab();
  renderCorreosConfigTab();
}

function startCorreosRealtimeListeners() {
  if (emailRealtimeUnsubscribers.length) return;
  emailModuleStarted = true;
  emailRealtimeUnsubscribers.push(
    onSnapshot(query(collection(db, 'emailTemplates'), limit(500)), snapshot => {
      allEmailTemplates = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderCorreosRealtimeViews();
    }, error => console.warn('Plantillas de correo no disponibles:', error)),
    onSnapshot(query(collection(db, 'emailLogs'), orderBy('sentAt', 'desc'), limit(300)), snapshot => {
      allEmailLogs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderCorreosRealtimeViews();
    }, error => console.warn('Historial de correos no disponible:', error)),
    onSnapshot(query(collection(db, 'emailCampaigns'), orderBy('createdAt', 'desc'), limit(50)), snapshot => {
      allEmailCampaigns = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderCorreosRealtimeViews();
    }, error => console.warn('Campañas de correo no disponibles:', error)),
    onSnapshot(doc(db, 'emailSettings', 'main'), snapshot => {
      const defaults = defaultEmailSettings_();
      const settings = snapshot.exists() ? snapshot.data() : {};
      emailSettingsCache = Object.assign({}, defaults, settings, {
        orderTypesEnabled: Object.assign({}, defaults.orderTypesEnabled, settings.orderTypesEnabled || {}),
        orderTypeTemplateMap: Object.assign({}, defaults.orderTypeTemplateMap, settings.orderTypeTemplateMap || {})
      });
      renderCorreosRealtimeViews();
    }, error => console.warn('Configuración de correos no disponible:', error))
  );
  refreshCorreosClientasFromRealtime();
}

async function loadCorreos() {
  try {
    const [settings, tplSnap, logsSnap, campSnap] = await Promise.all([
      getEmailSettingsFresh_(),
      getDocsPaginated(collection(db, 'emailTemplates'), { pageSize: 100, maxDocs: 500 }),
      getDocs(query(collection(db, 'emailLogs'), orderBy('sentAt', 'desc'), limit(300))),
      getDocs(query(collection(db, 'emailCampaigns'), orderBy('createdAt', 'desc'), limit(50)))
    ]);
    const defaults = defaultEmailSettings_();
    emailSettingsCache = Object.assign({}, defaults, settings, {
      orderTypesEnabled: Object.assign({}, defaults.orderTypesEnabled, settings.orderTypesEnabled || {}),
      orderTypeTemplateMap: Object.assign({}, defaults.orderTypeTemplateMap, settings.orderTypeTemplateMap || {})
    });
    let templates = tplSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    templates = await ensureTemplatesSeeded_(templates);
    allEmailTemplates = templates;
    // Se reordena también acá (no solo confiar en orderBy de Firestore) por
    // las dudas de que falte el índice compuesto la primera vez — mismo
    // criterio defensivo que ya usa loadOrders() más abajo.
    const byDateDesc_ = (a, b) => (b.sentAt?.toDate?.() || new Date(0)) - (a.sentAt?.toDate?.() || new Date(0));
    allEmailLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byDateDesc_);
    allEmailCampaigns = campSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));

    await loadCorreosClientas();
    renderCorreosDashboard();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPlantillasTab();
    renderCorreosHistorialTab();
    renderCorreosConfigTab();
    startCorreosRealtimeListeners();
  } catch (e) {
    console.error('Error al cargar Correos:', e);
    toast('Error al cargar el módulo Correos: ' + e.message);
  }
}

async function loadCorreosClientas() {
  refreshCorreosClientasFromRealtime();
}

// ---- Dashboard ----
function renderCorreosDashboard() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const logsToday = allEmailLogs.filter(l => { const d = l.sentAt?.toDate?.(); return d && d >= today; });
  const sentToday = logsToday.filter(l => l.status === 'sent').length;
  const failedToday = logsToday.filter(l => l.status === 'failed').length;
  const pendingCampaigns = allEmailCampaigns.filter(c => c.status === 'sending').length;

  const statsEl = document.getElementById('correos-stats');
  if (statsEl) statsEl.innerHTML = [
    { label: 'Enviados hoy', val: sentToday },
    { label: 'Fallidos hoy', val: failedToday },
    { label: 'Pendientes', val: pendingCampaigns },
  ].map(s => `<div class="adm-stat"><div class="adm-stat-val">${s.val}</div><div class="adm-stat-label">${s.label}</div></div>`).join('');

  const s = emailSettingsCache || defaultEmailSettings_();
  const webhookConfigured = typeof EMAIL_WEBHOOK_URL === 'string' && EMAIL_WEBHOOK_URL && !EMAIL_WEBHOOK_URL.includes('PEGAR_');
  const chip = (label, on) => `<div><strong>${label}:</strong> <span class="adm-badge ${on ? 'badge-entregado' : 'badge-cancelado'}">${on ? 'Activado' : 'Desactivado'}</span></div>`;
  const statusEl = document.getElementById('correos-system-status');
  if (statusEl) statusEl.innerHTML =
    `<div><strong>Remitente actual:</strong> ${s.senderEmail || EMAIL_SENDER_ADDRESS}</div>` +
    `<div><strong>Webhook configurado:</strong> <span class="adm-badge ${webhookConfigured ? 'badge-entregado' : 'badge-cancelado'}">${webhookConfigured ? 'Sí' : 'No'}</span></div>` +
    chip('Envío de pedidos', s.orderEmailsEnabled !== false) +
    chip('Envío de pruebas', s.testEmailsEnabled !== false) +
    chip('Envío promocional', s.promoEnabled !== false);

  const tbody = document.getElementById('correos-dash-recent');
  if (tbody) {
    const recent = allEmailLogs.slice(0, 5);
    tbody.innerHTML = recent.length ? recent.map(l => `
      <tr>
        <td data-label="Fecha" style="white-space:nowrap;font-size:12px">${formatDate(l.sentAt)}</td>
        <td data-label="Tipo" style="font-size:12px">${templateLabel_(l.type)}</td>
        <td data-label="Destinatario" style="font-size:12px">${l.recipient || '—'}</td>
        <td data-label="Estado">${logStatusBadge_(l.status)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:24px">Sin envíos todavía</td></tr>';
  }
}

// ---- Correos de pedidos ----
function templatesForCategory_(cat) {
  return allEmailTemplates.filter(t => t.category === cat && !t.archived);
}

function renderCorreosPedidosTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const tbody = document.getElementById('correos-pedidos-tbody');
  if (!tbody) return;
  const options = templatesForCategory_('pedido').concat(templatesForCategory_('libre'));
  tbody.innerHTML = ORDER_TYPE_KEYS.map(key => {
    const enabled = !!(s.orderTypesEnabled && s.orderTypesEnabled[key]);
    const tplKey = (s.orderTypeTemplateMap && s.orderTypeTemplateMap[key]) || key;
    const lastLog = allEmailLogs.find(l => l.type === key);
    const lastSent = lastLog ? `${formatDate(lastLog.sentAt)} · ${lastLog.recipient || ''}` : '—';
    const tplOptionsHtml = options.map(t => `<option value="${t.key || t.id}" ${((t.key || t.id) === tplKey) ? 'selected' : ''}>${t.name}</option>`).join('');
    return `
      <tr>
        <td class="col-select" data-label="Sel."><input type="checkbox" class="cop-row-check" data-key="${key}" onclick="toggleOrderTypeSelect(this)" ${_selectedOrderTypes.has(key) ? 'checked' : ''}></td>
        <td data-label="Tipo">${ORDER_TYPE_NAMES[key]}</td>
        <td data-label="Activo"><label class="adm-toggle" style="width:40px;height:22px"><input type="checkbox" ${enabled ? 'checked' : ''} onchange="window.toggleOrderTypeEnabled('${key}', this.checked)"><span class="adm-toggle-slider"></span></label></td>
        <td data-label="Plantilla"><select class="adm-select" style="width:auto;font-size:12px" onchange="window.setOrderTypeTemplate('${key}', this.value)">${tplOptionsHtml}</select></td>
        <td data-label="Último envío" style="font-size:12px">${lastSent}</td>
        <td data-label="Vista previa"><button class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.previewOrderType('${key}')" type="button">Ver</button></td>
      </tr>
    `;
  }).join('');
  updateOrderTypeBulkToolbar();
}

// ══════════════════════════════════════════════
// CORREOS DE PEDIDOS: SELECCIÓN MÚLTIPLE Y ACTIVAR/DESACTIVAR MASIVO
// ══════════════════════════════════════════════
let _selectedOrderTypes = new Set();

window.toggleSelectAllOrderTypes = function(masterCb) {
  document.querySelectorAll('.cop-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedOrderTypes.add(cb.dataset.key);
    else _selectedOrderTypes.delete(cb.dataset.key);
  });
  updateOrderTypeBulkToolbar();
};

window.toggleOrderTypeSelect = function(cb) {
  if (cb.checked) _selectedOrderTypes.add(cb.dataset.key);
  else _selectedOrderTypes.delete(cb.dataset.key);
  updateOrderTypeBulkToolbar();
};

function updateOrderTypeBulkToolbar() {
  const count = _selectedOrderTypes.size;
  const toolbar = document.getElementById('cop-bulk-toolbar');
  const countEl = document.getElementById('cop-bulk-count');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
}

window.clearOrderTypeSelection = function() {
  _selectedOrderTypes.clear();
  document.querySelectorAll('.cop-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-cop');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateOrderTypeBulkToolbar();
};

// Los dos correos "recibido" son el envío REAL del checkout — si están en la
// selección al desactivar en lote, se avisa explícitamente antes de aplicar
// (mismo riesgo que ya existe al desactivarlos de a uno, pero acá puede pasar
// sin querer si se seleccionaron todas las filas con "Seleccionar todos").
window.bulkSetOrderTypeEnabled = async function(enabled) {
  if (!_selectedOrderTypes.size) return;
  const keys = [..._selectedOrderTypes];
  const n = keys.length;
  const includesReal = keys.includes('pedido_recibido_clienta') || keys.includes('pedido_recibido_tintin');
  let msg = `¿${enabled ? 'Activar' : 'Desactivar'} ${n} tipo(s) de correo?`;
  if (!enabled && includesReal) msg += '\n\n⚠️ La selección incluye "Pedido recibido" — desactivarlo corta el correo REAL que ya manda el checkout.';
  if (!confirm(msg)) return;
  try {
    emailSettingsCache = emailSettingsCache || defaultEmailSettings_();
    keys.forEach(key => { emailSettingsCache.orderTypesEnabled[key] = enabled; });
    await saveEmailSettingsMerge_({ orderTypesEnabled: emailSettingsCache.orderTypesEnabled });
    logAudit('config_correo_pedido', 'correo_pedido', '', '', `${n} tipo(s) → ${enabled ? 'activados' : 'desactivados'}`, { bulk: true, count: n });
    toast(`${n} tipo(s) de correo ${enabled ? 'activados' : 'desactivados'}`);
    clearOrderTypeSelection();
    renderCorreosPedidosTab();
    renderCorreosDashboard();
  } catch (e) { toast('Error: ' + e.message); }
};

window.toggleOrderTypeEnabled = async (key, checked) => {
  emailSettingsCache.orderTypesEnabled[key] = checked;
  await saveEmailSettingsMerge_({ orderTypesEnabled: emailSettingsCache.orderTypesEnabled });
  toast(`${ORDER_TYPE_NAMES[key]}: ${checked ? 'activado' : 'desactivado'}`);
  renderCorreosPedidosTab();
  renderCorreosDashboard();
};
window.setOrderTypeTemplate = async (key, tplKey) => {
  emailSettingsCache.orderTypeTemplateMap[key] = tplKey;
  await saveEmailSettingsMerge_({ orderTypeTemplateMap: emailSettingsCache.orderTypeTemplateMap });
  toast('Plantilla asociada actualizada');
};
window.previewOrderType = (key) => {
  const tplKey = (emailSettingsCache.orderTypeTemplateMap && emailSettingsCache.orderTypeTemplateMap[key]) || key;
  const tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
  if (!tpl) { toast('Plantilla no encontrada'); return; }
  openTplPreview_(tpl, fakeTestVariables_());
};

// ---- Correos de prueba ----
// Cooldown fijo de 2 minutos + límite diario configurable — la lectura de
// emailLogs para calcularlo acá es segura porque Correos es 100% exclusivo
// de Super Admin (nunca lo abre admin/agent), así que allEmailLogs siempre
// está disponible. Apps Script vuelve a exigir lo mismo del lado del
// servidor, así que esto es solo para avisar ANTES de intentar el envío.
const TEST_EMAIL_COOLDOWN_SECONDS = 120;
// Acepta un Timestamp real de Firestore (.toDate()) o un valor ya utilizable
// directamente (Date/ISO string) — mismo criterio dual que ya usa el resto
// del admin para createdAt/lastResendAt en todo el código.
function toJsDate_(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function testEmailGuardStatus_() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const testLogsSent = allEmailLogs.filter(l => (l.category || 'pedido') === 'prueba' && l.status === 'sent');
  const sentToday = testLogsSent.filter(l => { const d = toJsDate_(l.sentAt); return d && d >= todayStart; }).length;
  const lastSent = testLogsSent.reduce((max, l) => { const d = toJsDate_(l.sentAt); return d && (!max || d > max) ? d : max; }, null);
  const cooldownRemaining = lastSent ? Math.max(0, Math.ceil((TEST_EMAIL_COOLDOWN_SECONDS * 1000 - (Date.now() - lastSent.getTime())) / 1000)) : 0;
  const dailyLimit = s.testDailyLimit || 20;
  return { cooldownRemaining, sentToday, dailyLimit, limitReached: sentToday >= dailyLimit };
}
function renderTestEmailLimitInfo_() {
  const el = document.getElementById('test-email-limit-info');
  if (!el) return;
  const g = testEmailGuardStatus_();
  const parts = [`${g.sentToday}/${g.dailyLimit} pruebas enviadas hoy`];
  if (g.cooldownRemaining > 0) parts.push(`próximo envío disponible en ${g.cooldownRemaining}s`);
  el.textContent = parts.join(' · ');
  el.style.color = (g.limitReached || g.cooldownRemaining > 0) ? '#c0392b' : 'var(--adm-muted)';
}

function renderCorreosPruebaTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const toggle = document.getElementById('prueba-enabled-toggle');
  if (toggle) toggle.checked = s.testEmailsEnabled !== false;

  const cliSelect = document.getElementById('prueba-cliente-select');
  if (cliSelect) {
    cliSelect.innerHTML = '<option value="">Elegí una clienta…</option>' +
      allClientUsers.map(c => `<option value="${c.email}">${c.name || c.email} (${c.email})</option>`).join('');
  }

  const tplSelect = document.getElementById('prueba-template-select');
  if (tplSelect) {
    const activeTpls = allEmailTemplates.filter(t => !t.archived);
    tplSelect.innerHTML = activeTpls.map(t => `<option value="${t.key || t.id}" ${((t.key || t.id) === 'pedido_recibido_clienta') ? 'selected' : ''}>${t.name}</option>`).join('');
  }
  renderTestEmailLimitInfo_();
}

document.querySelectorAll('[data-prueba-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-prueba-mode]').forEach(b => b.classList.toggle('active', b === btn));
    const mode = btn.dataset.pruebaMode;
    document.getElementById('prueba-mode-manual').style.display = mode === 'manual' ? '' : 'none';
    document.getElementById('prueba-mode-cliente').style.display = mode === 'cliente' ? '' : 'none';
  });
});

function resolveTestEmailTarget_() {
  const activeBtn = document.querySelector('[data-prueba-mode].active');
  const mode = activeBtn ? activeBtn.dataset.pruebaMode : 'manual';
  if (mode === 'cliente') return document.getElementById('prueba-cliente-select').value.trim();
  return document.getElementById('test-email-input').value.trim();
}

document.getElementById('prueba-enabled-toggle').onchange = async (e) => {
  emailSettingsCache = emailSettingsCache || defaultEmailSettings_();
  emailSettingsCache.testEmailsEnabled = e.target.checked;
  await saveEmailSettingsMerge_({ testEmailsEnabled: e.target.checked });
  toast(`Correos de prueba: ${e.target.checked ? 'activados' : 'desactivados'}`);
};

document.getElementById('btn-test-email').onclick = async () => {
  const resultEl = document.getElementById('test-email-result');
  const btn = document.getElementById('btn-test-email');
  const email = resolveTestEmailTarget_();

  if (emailSettingsCache && emailSettingsCache.testEmailsEnabled === false) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = 'Los envíos de prueba están desactivados en Correos → Configuración.';
    return;
  }
  if (!TEST_EMAIL_RE.test(email)) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = 'Escribí (o elegí) un email con formato válido.';
    return;
  }

  // Protección anti-spam de la cuenta: cooldown de 2 minutos + límite diario
  // configurable — se revisa ANTES de llamar al webhook, para no gastar el
  // envío ni el intento. Apps Script vuelve a exigir lo mismo del lado del
  // servidor (no se puede saltear llamando directo con el secreto).
  const guard = testEmailGuardStatus_();
  if (guard.cooldownRemaining > 0) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = `Esperá ${guard.cooldownRemaining}s antes de enviar otra prueba — cooldown anti-spam de 2 minutos.`;
    return;
  }
  if (guard.limitReached) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = `Se alcanzó el límite diario de correos de prueba (${guard.sentToday}/${guard.dailyLimit}). No se envió nada. Podés subir el límite en Correos → Configuración.`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando…';
  resultEl.style.color = 'var(--adm-muted)';
  resultEl.textContent = '';

  const tplKey = document.getElementById('prueba-template-select').value;
  const isDefaultDesign = tplKey === 'pedido_recibido_clienta';
  try {
    let result;
    const vars = fakeTestVariables_();
    const testDailyLimit = (emailSettingsCache || defaultEmailSettings_()).testDailyLimit || 20;
    if (isDefaultDesign) {
      result = await sendTestCustomerEmail(email);
    } else {
      // isTest:true hace que Apps Script le aplique el MISMO cooldown/tope
      // diario que sendTestCustomerEmail, aunque viaje por sendPromoEmail
      // (la función genérica de un solo destinatario) — si no, elegir
      // cualquier plantilla que no sea "Pedido recibido (clienta)" acá
      // saltearía la protección por completo.
      const tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
      result = await sendTemplatedEmail({ to: email, ...templateContentPayload_(tpl || {}), variables: vars, isTest: true, testDailyLimit });
    }
    if (result && result.success) {
      resultEl.style.color = '#065f46';
      resultEl.textContent = 'Correo de prueba enviado correctamente.';
    } else {
      resultEl.style.color = '#c0392b';
      resultEl.textContent = 'No se pudo enviar el correo de prueba' + (result?.error ? ': ' + (emailErrorMessage_(result.error) || result.error) : '.');
    }
    await logEmailSend_({ category: 'prueba', type: tplKey, recipient: email, status: result?.success ? 'sent' : 'failed', templateKey: tplKey, isAutomatic: false, error: result?.error || '', variables: vars });
  } catch (e) {
    resultEl.style.color = '#c0392b';
    resultEl.textContent = 'No se pudo enviar el correo de prueba: ' + e.message;
    await logEmailSend_({ category: 'prueba', type: tplKey, recipient: email, status: 'failed', templateKey: tplKey, isAutomatic: false, error: e.message });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar prueba';
    renderTestEmailLimitInfo_();
  }
};

document.getElementById('btn-test-preview').onclick = () => {
  const tplKey = document.getElementById('prueba-template-select').value;
  const tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
  if (!tpl) { toast('Elegí una plantilla'); return; }
  openTplPreview_(tpl, fakeTestVariables_());
};

// ---- Vista previa (modal compartido) ----
function openTplPreview_(tpl, vars) {
  const html = buildPreviewHtml_(tpl, vars);
  document.getElementById('tpl-preview-subject').textContent = renderVarsClient_(tpl.subject, vars);
  document.getElementById('tpl-preview-frame').srcdoc = html;
  document.getElementById('tpl-preview-overlay').style.display = '';
}
window.closeTplPreview = () => { document.getElementById('tpl-preview-overlay').style.display = 'none'; };

window.previewTemplateById = (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const overlayOpen = document.getElementById('tpl-edit-overlay').style.display !== 'none' && document.getElementById('tpl-edit-id').value === id;
  const draft = overlayOpen ? {
    ...t,
    subject: document.getElementById('tpl-edit-subject').value,
    greeting: document.getElementById('tpl-edit-greeting').value,
    intro: document.getElementById('tpl-edit-intro').value,
    promoText: document.getElementById('tpl-edit-promo').value,
    closing: document.getElementById('tpl-edit-closing').value,
    signature: document.getElementById('tpl-edit-signature').value,
    buttonText: document.getElementById('tpl-edit-button-text').value,
    buttonUrl: document.getElementById('tpl-edit-button-url').value,
    brandPhrase: document.getElementById('tpl-edit-brand').value,
    footer: document.getElementById('tpl-edit-footer').value,
  } : t;
  openTplPreview_(draft, fakeTestVariables_());
};

// ---- Plantillas (CRUD) ----
function renderCorreosPlantillasTab() {
  let list = allEmailTemplates.slice();
  if (!tplShowArchived) list = list.filter(t => !t.archived);
  if (tplFilterCategory) list = list.filter(t => t.category === tplFilterCategory);
  if (tplSearchQuery) list = list.filter(t => (t.name || '').toLowerCase().includes(tplSearchQuery) || (t.subject || '').toLowerCase().includes(tplSearchQuery));
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const tbody = document.getElementById('tpl-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px">Sin plantillas para mostrar</td></tr>';
    return;
  }
  const visibleIds = new Set(list.map(t => t.id));
  [..._selectedTemplates].forEach(id => { if (!visibleIds.has(id)) _selectedTemplates.delete(id); });
  const CAT_LABELS = { pedido: 'Pedidos', promo: 'Promociones', libre: 'Mensaje libre' };
  tbody.innerHTML = list.map(t => {
    const id = t.id;
    const isCustom = !t.key;
    return `
      <tr style="${t.archived ? 'opacity:.55' : ''}">
        <td class="col-select" data-label="Sel."><input type="checkbox" class="tpl-row-check" data-id="${id}" onclick="toggleTemplateSelect(this)" ${_selectedTemplates.has(id) ? 'checked' : ''}></td>
        <td data-label="Plantilla"><strong>${t.name}</strong><br><small style="color:#aaa">${(t.subject || '').slice(0, 60)}</small></td>
        <td data-label="Categoría"><span class="adm-badge badge-confirmado">${CAT_LABELS[t.category] || t.category}</span></td>
        <td data-label="Activa">${t.active !== false ? '<span class="adm-badge badge-entregado">Activa</span>' : '<span class="adm-badge badge-cancelado">Inactiva</span>'}</td>
        <td data-label="Últ. edición" style="font-size:12px">${formatDate(t.updatedAt)}</td>
        <td data-label="Editado por" style="font-size:12px">${t.updatedBy || '—'}</td>
        <td data-label="Acciones">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.openTplEdit('${id}')" type="button">Editar</button>
            <button class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.previewTemplateById('${id}')" type="button">Vista previa</button>
            <button class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.duplicateTemplate('${id}')" type="button">Duplicar</button>
            <button class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.toggleArchiveTemplate('${id}')" type="button">${t.archived ? 'Reactivar' : 'Archivar'}</button>
            ${isCustom ? `<button class="adm-btn adm-btn-sm adm-btn-danger" onclick="window.deleteTemplate('${id}')" type="button">Eliminar</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  updateTemplatesBulkToolbar();
}

document.getElementById('tpl-search').oninput = (e) => { tplSearchQuery = e.target.value.toLowerCase(); renderCorreosPlantillasTab(); };
document.getElementById('tpl-filter-category').onchange = (e) => { tplFilterCategory = e.target.value; renderCorreosPlantillasTab(); };
document.getElementById('tpl-show-archived').onchange = (e) => { tplShowArchived = e.target.checked; renderCorreosPlantillasTab(); };

// ══════════════════════════════════════════════
// PLANTILLAS: SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS
// ══════════════════════════════════════════════
let _selectedTemplates = new Set();

window.toggleSelectAllTemplates = function(masterCb) {
  document.querySelectorAll('.tpl-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedTemplates.add(cb.dataset.id);
    else _selectedTemplates.delete(cb.dataset.id);
  });
  updateTemplatesBulkToolbar();
};

window.toggleTemplateSelect = function(cb) {
  if (cb.checked) _selectedTemplates.add(cb.dataset.id);
  else _selectedTemplates.delete(cb.dataset.id);
  updateTemplatesBulkToolbar();
};

function updateTemplatesBulkToolbar() {
  const count = _selectedTemplates.size;
  const toolbar = document.getElementById('tpl-bulk-toolbar');
  const countEl = document.getElementById('tpl-bulk-count');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionada${count !== 1 ? 's' : ''}`;
}

window.clearTemplatesSelection = function() {
  _selectedTemplates.clear();
  document.querySelectorAll('.tpl-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-tpl');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateTemplatesBulkToolbar();
};

window.bulkArchiveTemplates = async function(archived) {
  if (!_selectedTemplates.size) return;
  const n = _selectedTemplates.size;
  const label = archived ? 'archivar' : 'reactivar';
  if (!confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} ${n} plantilla(s)?`)) return;
  try {
    const ids = [..._selectedTemplates];
    await batchUpdateChunked(ids, () => ({ archived, updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '' }), 'emailTemplates');
    ids.forEach(id => { const t = allEmailTemplates.find(x => x.id === id); if (t) t.archived = archived; });
    logAudit('plantilla_archivada', 'plantilla', '', '', archived ? 'Archivadas' : 'Reactivadas', { bulk: true, count: n });
    toast(`${n} plantilla(s) ${archived ? 'archivadas' : 'reactivadas'}`);
    clearTemplatesSelection();
    renderCorreosPlantillasTab();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error: ' + e.message); }
};

// Solo elimina las plantillas personalizadas de la selección (las de sistema
// —con `key`— nunca se eliminan, ni de a una ni en lote, solo se archivan).
window.bulkDeleteTemplates = async function() {
  if (!_selectedTemplates.size) return;
  const ids = [..._selectedTemplates].filter(id => { const t = allEmailTemplates.find(x => x.id === id); return t && !t.key; });
  if (!ids.length) { toast('La selección solo tiene plantillas de sistema — esas no se pueden eliminar, solo archivar.'); return; }
  const n = ids.length;
  if (!confirm(`¿ELIMINAR DEFINITIVAMENTE ${n} plantilla(s) personalizada(s)? Esta acción no se puede deshacer.`)) return;
  try {
    const CHUNK = 450;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'emailTemplates', id)));
      await batch.commit();
    }
    const idSet = new Set(ids);
    allEmailTemplates = allEmailTemplates.filter(t => !idSet.has(t.id));
    logAudit('plantilla_eliminada', 'plantilla', '', '', `${n} plantillas eliminadas`, { bulk: true, count: n });
    toast(`${n} plantilla(s) eliminadas definitivamente`);
    clearTemplatesSelection();
    renderCorreosPlantillasTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error: ' + e.message); }
};

window.openTplEdit = (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const isCustom = !t.key;
  document.getElementById('tpl-edit-id').value = id;
  document.getElementById('tpl-edit-name').textContent = t.name ? `— ${t.name}` : '';
  document.getElementById('tpl-edit-name-field').style.display = isCustom ? '' : 'none';
  document.getElementById('tpl-edit-name-input').value = t.name || '';
  document.getElementById('tpl-edit-subject').value = t.subject || '';
  document.getElementById('tpl-edit-greeting').value = t.greeting || '';
  document.getElementById('tpl-edit-intro').value = t.intro || '';
  document.getElementById('tpl-edit-promo').value = t.promoText || '';
  document.getElementById('tpl-edit-closing').value = t.closing || '';
  document.getElementById('tpl-edit-signature').value = t.signature || '';
  document.getElementById('tpl-edit-button-text').value = t.buttonText || '';
  document.getElementById('tpl-edit-button-url').value = t.buttonUrl || '';
  document.getElementById('tpl-edit-brand').value = t.brandPhrase || '';
  document.getElementById('tpl-edit-footer').value = t.footer || '';
  document.getElementById('tpl-edit-active').checked = t.active !== false;
  document.getElementById('tpl-edit-vars-list').innerHTML = PROTECTED_VARS.map(v => `<code style="background:#fff;border:1px solid var(--adm-border);border-radius:6px;padding:2px 6px">{{${v}}}</code>`).join('');
  document.getElementById('tpl-edit-overlay').style.display = '';
  window.AdminUnsaved?.register('email-template-editor', {
    root: '#tpl-edit-overlay',
    active: () => document.getElementById('tpl-edit-overlay')?.style.display !== 'none',
    label: 'la plantilla de correo',
    save: saveTplEdit_,
  });
};
window.closeTplEdit = (force = false) => {
  if (!force && window.AdminUnsaved?.isDirty('email-template-editor')) {
    window.AdminUnsaved.requestNavigation(() => window.closeTplEdit(true), { scopeIds: ['email-template-editor'] });
    return;
  }
  document.getElementById('tpl-edit-overlay').style.display = 'none';
  window.AdminUnsaved?.unregister('email-template-editor');
};

document.getElementById('tpl-edit-preview-btn').onclick = () => {
  window.previewTemplateById(document.getElementById('tpl-edit-id').value);
};

async function saveTplEdit_() {
  const id = document.getElementById('tpl-edit-id').value;
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return false;
  const patch = {
    subject: document.getElementById('tpl-edit-subject').value,
    greeting: document.getElementById('tpl-edit-greeting').value,
    intro: document.getElementById('tpl-edit-intro').value,
    promoText: document.getElementById('tpl-edit-promo').value,
    closing: document.getElementById('tpl-edit-closing').value,
    signature: document.getElementById('tpl-edit-signature').value,
    buttonText: document.getElementById('tpl-edit-button-text').value,
    buttonUrl: document.getElementById('tpl-edit-button-url').value,
    brandPhrase: document.getElementById('tpl-edit-brand').value,
    footer: document.getElementById('tpl-edit-footer').value,
    active: document.getElementById('tpl-edit-active').checked,
    updatedAt: serverTimestamp(), updatedBy: currentUser?.email || ''
  };
  if (!t.key) patch.name = document.getElementById('tpl-edit-name-input').value.trim() || t.name;
  try {
    await updateDoc(doc(db, 'emailTemplates', id), patch);
    Object.assign(t, patch, { updatedAt: new Date() });
    toast('Plantilla guardada');
    window.AdminUnsaved?.markClean('email-template-editor');
    window.closeTplEdit(true);
    renderCorreosPlantillasTab();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPromocionesTab();
    return true;
  } catch (e) {
    toast('Error al guardar la plantilla: ' + e.message);
    return false;
  }
}
document.getElementById('tpl-edit-save-btn').onclick = saveTplEdit_;

document.getElementById('tpl-edit-restore-btn').onclick = async () => {
  const id = document.getElementById('tpl-edit-id').value;
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t || !t.original) { toast('No hay versión original guardada'); return; }
  if (!confirm('¿Restaurar esta plantilla a su versión original? Se pierden los cambios actuales.')) return;
  try {
    const patch = { ...t.original, updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '' };
    await updateDoc(doc(db, 'emailTemplates', id), patch);
    Object.assign(t, patch, { updatedAt: new Date() });
    toast('Plantilla restaurada a su versión original');
    window.openTplEdit(id);
    renderCorreosPlantillasTab();
  } catch (e) { toast('Error al restaurar: ' + e.message); }
};

document.getElementById('btn-tpl-nueva').onclick = async () => {
  const seed = TEMPLATE_SEEDS.mensaje_libre;
  const content = { subject: seed.subject, greeting: seed.greeting, intro: seed.intro, closing: seed.closing,
    signature: seed.signature, promoText: seed.promoText, buttonText: seed.buttonText, buttonUrl: seed.buttonUrl || '',
    brandPhrase: seed.brandPhrase, footer: seed.footer };
  try {
    const ref = await addDoc(collection(db, 'emailTemplates'), {
      key: null, name: 'Mensaje libre (nuevo)', category: 'libre', ...content,
      active: true, archived: false, original: content,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || ''
    });
    allEmailTemplates.push({ id: ref.id, key: null, name: 'Mensaje libre (nuevo)', category: 'libre', ...content, active: true, archived: false, original: content, updatedAt: new Date() });
    toast('Plantilla creada');
    renderCorreosPlantillasTab();
    window.openTplEdit(ref.id);
  } catch (e) { toast('Error al crear la plantilla: ' + e.message); }
};

window.duplicateTemplate = async (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const content = templateContentPayload_(t);
  try {
    const ref = await addDoc(collection(db, 'emailTemplates'), {
      key: null, name: t.name + ' (copia)', category: t.category, ...content,
      active: true, archived: false, original: content,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: currentUser?.email || ''
    });
    allEmailTemplates.push({ id: ref.id, key: null, name: t.name + ' (copia)', category: t.category, ...content, active: true, archived: false, original: content, updatedAt: new Date() });
    logAudit('plantilla_creada', 'plantilla', ref.id, t.name + ' (copia)', `Duplicada de "${t.name}"`);
    toast('Plantilla duplicada');
    renderCorreosPlantillasTab();
  } catch (e) { toast('Error al duplicar: ' + e.message); }
};

window.toggleArchiveTemplate = async (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  const archived = !t.archived;
  try {
    await updateDoc(doc(db, 'emailTemplates', id), { archived, updatedAt: serverTimestamp(), updatedBy: currentUser?.email || '' });
    t.archived = archived;
    logAudit('plantilla_archivada', 'plantilla', id, t.name, archived ? 'Archivada' : 'Reactivada');
    toast(archived ? 'Plantilla archivada' : 'Plantilla reactivada');
    renderCorreosPlantillasTab();
    renderCorreosPedidosTab();
    renderCorreosPruebaTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error: ' + e.message); }
};

window.deleteTemplate = async (id) => {
  const t = allEmailTemplates.find(x => x.id === id);
  if (!t) return;
  if (t.key) { toast('Esta plantilla no se puede eliminar — solo archivar.'); return; }
  if (!confirm(`¿Eliminar definitivamente la plantilla "${t.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteDoc(doc(db, 'emailTemplates', id));
    allEmailTemplates = allEmailTemplates.filter(x => x.id !== id);
    logAudit('plantilla_eliminada', 'plantilla', id, t.name);
    toast('Plantilla eliminada');
    renderCorreosPlantillasTab();
    renderCorreosPromocionesTab();
  } catch (e) { toast('Error al eliminar: ' + e.message); }
};

// ---- Clientas registradas ----
function filteredClients_() {
  const q = (document.getElementById('cli-search').value || '').toLowerCase();
  const filterVal = document.getElementById('cli-filter').value;
  let list = allClientUsers.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
  if (filterVal === 'active') list = list.filter(c => !c.blocked);
  if (filterVal === 'blocked') list = list.filter(c => c.blocked);
  if (filterVal === 'with_orders') list = list.filter(c => c.orderCount > 0);
  if (filterVal === 'without_orders') list = list.filter(c => !c.orderCount);
  return list;
}

function renderCorreosClientasTab() {
  const list = filteredClients_();
  const tbody = document.getElementById('cli-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">Sin clientas para mostrar</td></tr>';
  } else {
    tbody.innerHTML = list.map(c => {
      const checked = cliSelected.has(c.email) ? 'checked' : '';
      const disabledAttr = c.blocked ? 'disabled title="No se puede seleccionar una clienta bloqueada"' : '';
      const optIn = c.marketingOptIn === false ? 'No' : (c.marketingOptIn === true ? 'Sí' : 'No especificado');
      return `
        <tr class="adm-cliente-row">
          <td data-label="Sel."><input type="checkbox" ${checked} ${disabledAttr} onchange="window.toggleClientSelected('${c.email}', this.checked)" /></td>
          <td data-label="Nombre"><strong>${c.name || '—'}</strong></td>
          <td data-label="Email" style="font-size:12px">${c.email || '—'}</td>
          <td data-label="Teléfono" style="font-size:12px">${c.phone || '—'}</td>
          <td data-label="Registro" style="font-size:12px">${c.createdAt ? formatDate(c.createdAt) : '—'}</td>
          <td data-label="Pedidos">${c.orderCount || 0}</td>
          <td data-label="Últ. compra" style="font-size:12px">${c.lastPurchase ? c.lastPurchase.toLocaleDateString('es-PY') : '—'}</td>
          <td data-label="Estado">${c.blocked ? '<span class="adm-badge badge-cancelado">Bloqueada</span>' : '<span class="adm-badge badge-entregado">Activa</span>'}</td>
          <td data-label="Promos" style="font-size:12px">${optIn}</td>
        </tr>
      `;
    }).join('');
  }
  updateClientSelectionCount_();
}

window.toggleClientSelected = (email, checked) => {
  if (checked) cliSelected.add(email); else cliSelected.delete(email);
  updateClientSelectionCount_();
};
function updateClientSelectionCount_() {
  const el = document.getElementById('cli-selected-count');
  if (el) el.textContent = `${cliSelected.size} seleccionadas`;
}

document.getElementById('cli-search').oninput = () => renderCorreosClientasTab();
document.getElementById('cli-filter').onchange = () => renderCorreosClientasTab();
document.getElementById('cli-select-all').onchange = (e) => {
  const list = filteredClients_().filter(c => !c.blocked);
  if (e.target.checked) list.forEach(c => cliSelected.add(c.email));
  else list.forEach(c => cliSelected.delete(c.email));
  renderCorreosClientasTab();
};
document.getElementById('cli-clear-selection').onclick = () => { cliSelected.clear(); renderCorreosClientasTab(); };
document.getElementById('cli-use-in-promo').onclick = () => {
  promoRecipients = Array.from(cliSelected).map(email => {
    const c = allClientUsers.find(x => x.email === email);
    return { email, name: c?.name || '' };
  });
  renderCorreosPromocionesTab();
  toast(`${promoRecipients.length} destinatarias cargadas en Promociones`);
  document.querySelector('[data-correos-tab="promociones"]').click();
};

// ---- Promociones ----
function promoTemplateIds_() { return allEmailTemplates.filter(t => t.category === 'promo').map(t => t.id); }

function renderCorreosPromocionesTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const gmailSender = isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS);
  const toggle = document.getElementById('promo-enabled-toggle');
  if (toggle) { toggle.checked = gmailSender ? false : (s.promoEnabled !== false); toggle.disabled = gmailSender; }

  const tplSelect = document.getElementById('promo-template-select');
  if (tplSelect) {
    const promoTemplates = allEmailTemplates.filter(t => (t.category === 'promo' || t.category === 'libre') && !t.archived && t.active !== false);
    tplSelect.innerHTML = promoTemplates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }
  document.getElementById('promo-gmail-lock-banner').style.display = gmailSender ? '' : 'none';
  ['promo-template-select', 'promo-add-email', 'promo-add-email-btn', 'promo-preview-btn', 'promo-open-confirm-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = gmailSender;
  });
  renderPromoChips_();
}

function renderPromoChips_() {
  const wrap = document.getElementById('promo-recipients-chips');
  if (!wrap) return;
  wrap.innerHTML = promoRecipients.map((r, i) => {
    const c = allClientUsers.find(x => x.email.toLowerCase() === r.email.toLowerCase());
    const blockedClass = c && c.blocked ? ' blocked' : '';
    return `<span class="correos-chip${blockedClass}"><span>${r.name ? r.name + ' — ' : ''}${r.email}${c && c.blocked ? ' (bloqueada)' : ''}</span><button onclick="window.removePromoRecipient(${i})" title="Quitar" type="button">✕</button></span>`;
  }).join('');
  const countEl = document.getElementById('promo-recipients-count');
  if (countEl) countEl.textContent = `${promoRecipients.length} destinatarias`;
}
window.removePromoRecipient = (i) => { promoRecipients.splice(i, 1); renderPromoChips_(); };

document.getElementById('promo-enabled-toggle').onchange = async (e) => {
  const s = emailSettingsCache || defaultEmailSettings_();
  if (isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS)) {
    e.target.checked = false;
    toast('No se puede activar: el remitente actual es una cuenta de Gmail común, reservada para correos transaccionales.');
    return;
  }
  emailSettingsCache = emailSettingsCache || defaultEmailSettings_();
  emailSettingsCache.promoEnabled = e.target.checked;
  await saveEmailSettingsMerge_({ promoEnabled: e.target.checked });
  toast(`Promociones: ${e.target.checked ? 'activadas' : 'desactivadas'}`);
};

document.getElementById('promo-add-email-btn').onclick = () => {
  const input = document.getElementById('promo-add-email');
  const email = input.value.trim();
  if (!TEST_EMAIL_RE.test(email)) { toast('Email con formato inválido'); return; }
  const client = allClientUsers.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (client && client.blocked) { toast('No se puede agregar: esa clienta está bloqueada'); return; }
  if (promoRecipients.some(r => r.email.toLowerCase() === email.toLowerCase())) { toast('Ya está en la lista'); return; }
  promoRecipients.push({ email, name: client?.name || '' });
  input.value = '';
  renderPromoChips_();
};

document.getElementById('promo-preview-btn').onclick = () => {
  const tplId = document.getElementById('promo-template-select').value;
  const t = allEmailTemplates.find(x => x.id === tplId);
  if (!t) { toast('Elegí una plantilla'); return; }
  const first = promoRecipients[0];
  openTplPreview_(t, { ...fakeTestVariables_(), clienteNombre: first?.name || 'Cliente de prueba' });
};

document.getElementById('promo-open-confirm-btn').onclick = async () => {
  const s = emailSettingsCache || defaultEmailSettings_();
  if (isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS)) { toast('Promociones bloqueado: el remitente actual es una cuenta de Gmail común, reservada para correos transaccionales de pedidos.'); return; }
  if (s.promoEnabled === false) { toast('Las promociones están desactivadas en Correos → Configuración'); return; }
  const tplId = document.getElementById('promo-template-select').value;
  const tpl = allEmailTemplates.find(x => x.id === tplId);
  if (!tpl) { toast('Elegí una plantilla promocional'); return; }
  if (!promoRecipients.length) { toast('Agregá al menos una destinataria'); return; }

  const safeRecipients = promoRecipients.filter(r => {
    const c = allClientUsers.find(x => x.email.toLowerCase() === r.email.toLowerCase());
    if (c && c.blocked) return false;
    if (c && c.marketingOptIn === false) return false;
    return true;
  });
  const excludedCount = promoRecipients.length - safeRecipients.length;
  if (!safeRecipients.length) { toast('No hay destinatarias válidas para enviar (revisá bloqueadas / sin consentimiento)'); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sentToday = allEmailLogs.filter(l => {
    const d = l.sentAt?.toDate?.();
    return d && d >= today && l.status === 'sent' && l.type === 'promo';
  }).length;
  const dailyLimit = s.promoDailyLimit || 100;
  const remaining = Math.max(0, dailyLimit - sentToday);
  const warnEl = document.getElementById('promo-confirm-warning');
  const sendBtn = document.getElementById('promo-confirm-send-btn');
  if (safeRecipients.length > remaining) {
    warnEl.style.display = '';
    warnEl.textContent = `Ya se enviaron ${sentToday} promociones hoy — el límite diario es ${dailyLimit}. Con esta lista (${safeRecipients.length}) se superaría el límite. Reducí la lista a ${remaining} o menos, o subí el límite en Configuración.`;
    sendBtn.dataset.blocked = '1';
  } else {
    if (safeRecipients.length > 20) {
      warnEl.style.display = '';
      warnEl.textContent = `Vas a enviar esta promoción a ${safeRecipients.length} destinatarias.`;
    } else {
      warnEl.style.display = 'none';
    }
    sendBtn.dataset.blocked = '';
  }

  document.getElementById('promo-confirm-summary').innerHTML =
    `Plantilla: <strong>${tpl.name}</strong><br>Destinatarias: <strong>${safeRecipients.length}</strong>` +
    (excludedCount ? `<br><span style="color:#c0392b">${excludedCount} excluida(s) automáticamente (bloqueada o sin consentimiento)</span>` : '');
  document.getElementById('promo-confirm-input').value = '';
  sendBtn.disabled = true;
  promoPendingSend = { tpl, recipients: safeRecipients };
  document.getElementById('promo-confirm-overlay').style.display = 'flex';
};

window.closePromoConfirm = () => { document.getElementById('promo-confirm-overlay').style.display = 'none'; promoPendingSend = null; };

document.getElementById('promo-confirm-input').oninput = (e) => {
  const btn = document.getElementById('promo-confirm-send-btn');
  const blocked = btn.dataset.blocked === '1';
  btn.disabled = blocked || e.target.value.trim() !== 'CONFIRMAR';
};

document.getElementById('promo-confirm-send-btn').onclick = async () => {
  if (!promoPendingSend) return;
  const { tpl, recipients } = promoPendingSend;
  document.getElementById('promo-confirm-overlay').style.display = 'none';
  promoPendingSend = null;
  await runPromoCampaign_(tpl, recipients);
};

async function runPromoCampaign_(tpl, recipients) {
  const sendBtn = document.getElementById('promo-open-confirm-btn');
  const resultEl = document.getElementById('promo-result');
  const progressWrap = document.getElementById('promo-progress-wrap');
  const progressBar = document.getElementById('promo-progress-bar');
  const progressText = document.getElementById('promo-progress-text');

  sendBtn.disabled = true;
  progressWrap.style.display = '';
  progressBar.style.width = '0%';
  resultEl.textContent = '';

  let campaignId = null;
  try {
    const ref = await addDoc(collection(db, 'emailCampaigns'), {
      templateKey: tpl.id, templateName: tpl.name,
      recipients: recipients.map(r => r.email),
      status: 'sending', createdBy: currentUser?.email || '', createdAt: serverTimestamp(),
      sentCount: 0, failedCount: 0, results: []
    });
    campaignId = ref.id;
  } catch (e) {
    console.error('No se pudo crear el registro de campaña:', e);
  }

  let sent = 0, failed = 0;
  const allResults = [];
  for (let i = 0; i < recipients.length; i += PROMO_BATCH_SIZE) {
    const batch = recipients.slice(i, i + PROMO_BATCH_SIZE);
    progressText.textContent = `Enviando ${Math.min(i + batch.length, recipients.length)} de ${recipients.length}…`;
    try {
      const resp = await sendBulkTemplatedEmail({
        ...templateContentPayload_(tpl),
        recipients: batch.map(r => ({ to: r.email, variables: { clienteNombre: r.name || '' } }))
      });
      const results = resp.results || batch.map(() => ({ sent: false, error: resp.error || 'sin respuesta' }));
      results.forEach((r, idx) => {
        const recipient = batch[idx];
        const ok = !!r.sent;
        if (ok) sent++; else failed++;
        allResults.push({ email: recipient.email, status: ok ? 'sent' : 'failed', error: r.error || '' });
        logEmailSend_({ category: 'promo', type: 'promo', recipient: recipient.email, status: ok ? 'sent' : 'failed', templateKey: tpl.id, isAutomatic: false, error: r.error || '', campaignId, variables: { clienteNombre: recipient.name || '' } });
      });
    } catch (e) {
      batch.forEach(recipient => {
        failed++;
        allResults.push({ email: recipient.email, status: 'failed', error: e.message });
        logEmailSend_({ category: 'promo', type: 'promo', recipient: recipient.email, status: 'failed', templateKey: tpl.id, isAutomatic: false, error: e.message, campaignId });
      });
    }
    progressBar.style.width = `${Math.round((Math.min(i + batch.length, recipients.length) / recipients.length) * 100)}%`;
    if (campaignId) {
      try { await updateDoc(doc(db, 'emailCampaigns', campaignId), { sentCount: sent, failedCount: failed, results: allResults }); }
      catch (e) { console.error('No se pudo actualizar la campaña:', e); }
    }
  }

  if (campaignId) {
    try { await updateDoc(doc(db, 'emailCampaigns', campaignId), { status: 'completed' }); } catch (e) {}
  }

  progressText.textContent = `Listo: ${sent} enviados, ${failed} fallidos.`;
  resultEl.style.color = failed === 0 ? '#065f46' : (sent === 0 ? '#c0392b' : '#856404');
  resultEl.textContent = failed === 0
    ? `Promoción enviada a ${sent} destinatarias.`
    : `Se enviaron ${sent} de ${recipients.length} — ${failed} fallidas (ver Historial para el detalle).`;

  sendBtn.disabled = false;
  promoRecipients = [];
  renderPromoChips_();
  renderCorreosDashboard();
  renderCorreosHistorialTab();
}

// ---- Historial ----
function categoryBadge_(category) {
  const map = { pedido: ['#dbeafe', '#1e40af', 'Pedido real'], prueba: ['#fff3cd', '#856404', 'Prueba'], promo: ['#ede9fe', '#5b21b6', 'Promoción'] };
  const [bg, color, label] = map[category] || map.pedido;
  return `<span class="adm-badge" style="background:${bg};color:${color}">${label}</span>`;
}

function renderCorreosHistorialTab() {
  const typeSelect = document.getElementById('hist-filter-type');
  if (!typeSelect) return;
  const types = Array.from(new Set(allEmailLogs.map(l => l.type).filter(Boolean)));
  const currentVal = typeSelect.value;
  typeSelect.innerHTML = '<option value="">Todos los tipos</option>' + types.map(t => `<option value="${t}">${templateLabel_(t)}</option>`).join('');
  typeSelect.value = types.includes(currentVal) ? currentVal : '';

  const q = (document.getElementById('hist-search').value || '').toLowerCase();
  const statusVal = document.getElementById('hist-filter-status').value;
  const categoryVal = document.getElementById('hist-filter-category').value;
  const typeVal = document.getElementById('hist-filter-type').value;
  const fromVal = document.getElementById('hist-filter-from').value;
  const toVal = document.getElementById('hist-filter-to').value;

  let list = allEmailLogs.slice();
  if (q) list = list.filter(l => (l.recipient || '').toLowerCase().includes(q));
  if (statusVal) list = list.filter(l => l.status === statusVal);
  if (categoryVal) list = list.filter(l => (l.category || 'pedido') === categoryVal);
  if (typeVal) list = list.filter(l => l.type === typeVal);
  if (fromVal) { const from = new Date(fromVal); list = list.filter(l => { const d = l.sentAt?.toDate?.(); return d && d >= from; }); }
  if (toVal) { const to = new Date(toVal); to.setHours(23, 59, 59, 999); list = list.filter(l => { const d = l.sentAt?.toDate?.(); return d && d <= to; }); }

  const tbody = document.getElementById('hist-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">Sin resultados</td></tr>';
    return;
  }
  const visibleIds = new Set(list.slice(0, 200).map(l => l.id));
  [..._selectedLogs].forEach(id => { if (!visibleIds.has(id)) _selectedLogs.delete(id); });
  tbody.innerHTML = list.slice(0, 200).map(l => `
    <tr class="adm-log-row">
      <td class="col-select" data-label="Sel."><input type="checkbox" class="hist-row-check" data-id="${l.id}" onclick="toggleLogSelect(this)" ${_selectedLogs.has(l.id) ? 'checked' : ''}></td>
      <td data-label="Fecha" style="font-size:12px;white-space:nowrap">${formatDate(l.sentAt)}</td>
      <td data-label="Origen real/prueba">${categoryBadge_(l.category || 'pedido')}</td>
      <td data-label="Tipo" style="font-size:12px">${templateLabel_(l.type)}</td>
      <td data-label="Destinatario" style="font-size:12px">${l.recipient || '—'}</td>
      <td data-label="Estado">${logStatusBadge_(l.status)}</td>
      <td data-label="Enviado por" style="font-size:12px">${l.sentBy || '—'}</td>
      <td data-label="Automático/Manual" style="font-size:12px">${l.isAutomatic ? 'Automático' : 'Manual'}</td>
      <td data-label="Acciones">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.viewLogDetail('${l.id}')" type="button">Ver</button>
          ${l.status === 'failed' ? `<button class="adm-btn adm-btn-sm adm-btn-outline" onclick="window.retryFailedLog('${l.id}')" type="button">Reintentar</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
  updateLogsBulkToolbar();
}

// ══════════════════════════════════════════════
// HISTORIAL: SELECCIÓN MÚLTIPLE — exportar / reintentar fallidos
// ══════════════════════════════════════════════
let _selectedLogs = new Set();

window.toggleSelectAllLogs = function(masterCb) {
  document.querySelectorAll('.hist-row-check').forEach(cb => {
    cb.checked = masterCb.checked;
    if (masterCb.checked) _selectedLogs.add(cb.dataset.id);
    else _selectedLogs.delete(cb.dataset.id);
  });
  updateLogsBulkToolbar();
};

window.toggleLogSelect = function(cb) {
  if (cb.checked) _selectedLogs.add(cb.dataset.id);
  else _selectedLogs.delete(cb.dataset.id);
  updateLogsBulkToolbar();
};

function updateLogsBulkToolbar() {
  const count = _selectedLogs.size;
  const toolbar = document.getElementById('hist-bulk-toolbar');
  const countEl = document.getElementById('hist-bulk-count');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
}

window.clearLogsSelection = function() {
  _selectedLogs.clear();
  document.querySelectorAll('.hist-row-check').forEach(cb => cb.checked = false);
  const master = document.getElementById('check-all-hist');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateLogsBulkToolbar();
};

// Los logs en sí NUNCA se editan/borran (registro inmutable) — "reintentar"
// no toca el log fallido, crea una entrada NUEVA con el resultado del
// reintento, igual que ya hace el reintento individual.
window.bulkRetryFailedLogs = async function() {
  if (!_selectedLogs.size) return;
  const ids = [..._selectedLogs].filter(id => { const l = allEmailLogs.find(x => x.id === id); return l && l.status === 'failed' && l.templateKey; });
  if (!ids.length) { toast('No hay envíos fallidos reintentables en la selección'); return; }
  const n = ids.length;
  if (!confirm(`¿Reintentar ${n} envío(s) fallido(s)?`)) return;
  let ok = 0, fail = 0;
  for (const id of ids) {
    const l = allEmailLogs.find(x => x.id === id);
    try {
      const tpl = allEmailTemplates.find(t => (t.key || t.id) === l.templateKey);
      if (!tpl) throw new Error('plantilla no existe');
      const result = await sendTemplatedEmail({ to: l.recipient, ...templateContentPayload_(tpl), variables: l.variables || {} });
      await logEmailSend_({ category: l.category || 'pedido', type: l.type, recipient: l.recipient, status: result?.success ? 'sent' : 'failed', templateKey: l.templateKey, isAutomatic: false, error: result?.error || '', orderId: l.orderId, variables: l.variables });
      if (result?.success) ok++; else fail++;
    } catch (e) { fail++; }
  }
  toast(fail ? `${ok} reenviados, ${fail} fallaron` : `${ok} reenviados correctamente`);
  clearLogsSelection();
  renderCorreosHistorialTab();
};

const CATEGORY_LABELS_ = { pedido: 'Pedido real', prueba: 'Prueba', promo: 'Promoción' };

function logRowsToCsv_(logs) {
  const header = ['Fecha', 'Origen real/prueba', 'Tipo', 'Destinatario', 'Estado', 'Enviado por', 'Automático/Manual'];
  const rows = logs.map(l => [
    l.sentAt?.toDate ? l.sentAt.toDate().toLocaleString('es-PY') : '',
    CATEGORY_LABELS_[l.category || 'pedido'] || 'Pedido real',
    templateLabel_(l.type), l.recipient || '', l.status || '', l.sentBy || '', l.isAutomatic ? 'Automático' : 'Manual'
  ]);
  return [header, ...rows];
}

window.bulkExportLogs = function() {
  if (!_selectedLogs.size) { toast('No hay envíos seleccionados'); return; }
  const list = allEmailLogs.filter(l => _selectedLogs.has(l.id));
  downloadCsv(`historial_correos_${Date.now()}.csv`, logRowsToCsv_(list));
  toast(`Exportados ${list.length} envío(s) a CSV`);
};

document.getElementById('hist-search').oninput = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-status').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-category').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-type').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-from').onchange = () => renderCorreosHistorialTab();
document.getElementById('hist-filter-to').onchange = () => renderCorreosHistorialTab();

window.viewLogDetail = (id) => {
  const l = allEmailLogs.find(x => x.id === id);
  if (!l) return;
  alert(
    `Origen: ${CATEGORY_LABELS_[l.category || 'pedido'] || 'Pedido real'}\nTipo: ${templateLabel_(l.type)}\nDestinatario: ${l.recipient || '—'}\nEstado: ${l.status}\n` +
    `Enviado por: ${l.sentBy || '—'}\nAutomático/Manual: ${l.isAutomatic ? 'Automático' : 'Manual'}\n` +
    `Pedido relacionado: ${l.orderId || '—'}\n` + (l.error ? `Error: ${l.error}` : 'Sin errores')
  );
};

window.retryFailedLog = async (id) => {
  const l = allEmailLogs.find(x => x.id === id);
  if (!l) { toast('No se puede reintentar este envío'); return; }
  // Los correos de pedido (pedido_nuevo/reenvio_pedido) no tienen templateKey:
  // se arman desde el pedido real, no desde una plantilla. Reintentarlos usa
  // el mismo camino que el botón "Reenviar" del módulo Pedidos.
  if (l.orderId && (l.type === 'pedido_nuevo' || l.type === 'reenvio_pedido')) {
    await window.resendOrderEmail(l.orderId);
    return;
  }
  if (!l.templateKey) { toast('No se puede reintentar este envío'); return; }
  const tpl = allEmailTemplates.find(t => (t.key || t.id) === l.templateKey);
  if (!tpl) { toast('La plantilla original ya no existe'); return; }
  try {
    const result = await sendTemplatedEmail({ to: l.recipient, ...templateContentPayload_(tpl), variables: l.variables || {} });
    await logEmailSend_({ category: l.category || 'pedido', type: l.type, recipient: l.recipient, status: result?.success ? 'sent' : 'failed', templateKey: l.templateKey, isAutomatic: false, error: result?.error || '', orderId: l.orderId, variables: l.variables });
    toast(result?.success ? 'Reenviado correctamente' : 'Falló el reintento');
  } catch (e) {
    toast('Error al reintentar: ' + e.message);
  }
};

// ---- Configuración de correos ----
function renderCorreosConfigTab() {
  const s = emailSettingsCache || defaultEmailSettings_();
  const gmailSender = isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS);
  document.getElementById('cec-order-enabled').checked = s.orderEmailsEnabled !== false;
  document.getElementById('cec-internal-enabled').checked = s.internalEmailEnabled !== false;
  document.getElementById('cec-customer-enabled').checked = s.customerEmailEnabled !== false;
  document.getElementById('cec-test-enabled').checked = s.testEmailsEnabled !== false;
  const promoToggle = document.getElementById('cec-promo-enabled');
  promoToggle.checked = gmailSender ? false : (s.promoEnabled !== false);
  promoToggle.disabled = gmailSender;
  document.getElementById('cec-sender-name').value = s.senderName || 'Tintin Accesorios';
  document.getElementById('cec-sender-email').value = s.senderEmail || EMAIL_SENDER_ADDRESS;
  document.getElementById('cec-internal-email').value = s.internalEmail || 'tintinaccs@gmail.com';
  document.getElementById('cec-whatsapp').value = s.whatsappNumber || '';
  document.getElementById('cec-signature').value = s.signature || '';
  document.getElementById('cec-footer').value = s.footer || '';
  document.getElementById('cec-test-limit').value = s.testDailyLimit || 20;
  document.getElementById('cec-resend-limit').value = s.resendDailyLimit || 30;
  document.getElementById('cec-promo-limit').value = s.promoDailyLimit || 100;
  const alertEl = document.getElementById('cec-gmail-sender-alert');
  alertEl.style.display = gmailSender ? '' : 'none';
  if (gmailSender) document.getElementById('cec-gmail-sender-name').textContent = s.senderEmail || EMAIL_SENDER_ADDRESS;
  window.AdminUnsaved?.register('email-config', {
    root: '#correos-panel-config',
    active: () => document.getElementById('section-correos')?.classList.contains('active'),
    label: 'Configuración de correos',
    save: () => {
      const waiting = window.AdminUnsaved.waitForEvent('tintin:admin-email-config-saved', 'tintin:admin-email-config-save-failed');
      document.getElementById('btn-save-correos-config').click();
      return waiting;
    },
  });
}

document.getElementById('btn-save-correos-config').onclick = async () => {
  const s = emailSettingsCache || defaultEmailSettings_();
  const gmailSender = isGmailSender_(s.senderEmail || EMAIL_SENDER_ADDRESS);
  const patch = {
    orderEmailsEnabled: document.getElementById('cec-order-enabled').checked,
    internalEmailEnabled: document.getElementById('cec-internal-enabled').checked,
    customerEmailEnabled: document.getElementById('cec-customer-enabled').checked,
    testEmailsEnabled: document.getElementById('cec-test-enabled').checked,
    // Con remitente Gmail común, Promociones queda forzado a apagado sin
    // importar lo que diga el checkbox (que además está disabled en el DOM)
    // — protege el dato guardado aunque alguien lo togglee desde la consola.
    promoEnabled: gmailSender ? false : document.getElementById('cec-promo-enabled').checked,
    senderName: document.getElementById('cec-sender-name').value.trim() || 'Tintin Accesorios',
    internalEmail: document.getElementById('cec-internal-email').value.trim() || 'tintinaccs@gmail.com',
    whatsappNumber: document.getElementById('cec-whatsapp').value.trim(),
    signature: document.getElementById('cec-signature').value,
    footer: document.getElementById('cec-footer').value,
    testDailyLimit: Number(document.getElementById('cec-test-limit').value) || 20,
    resendDailyLimit: Number(document.getElementById('cec-resend-limit').value) || 30,
    promoDailyLimit: Number(document.getElementById('cec-promo-limit').value) || 100,
  };
  try {
    emailSettingsCache = Object.assign(emailSettingsCache || defaultEmailSettings_(), patch);
    const saved = await saveEmailSettingsMerge_(patch);
    if (!saved) throw new Error('No se pudo guardar la configuración de correos.');
    toast('Configuración de correos guardada');
    renderCorreosDashboard();
    renderCorreosConfigTab();
    window.AdminUnsaved?.markClean('email-config');
    window.dispatchEvent(new Event('tintin:admin-email-config-saved'));
  } catch (error) {
    window.dispatchEvent(new Event('tintin:admin-email-config-save-failed'));
    throw error;
  }
};

// ---- Tabs del módulo Correos ----
document.querySelectorAll('#correos-tabs .correos-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const switchNow = () => {
      document.querySelectorAll('#correos-tabs .correos-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.correos-panel').forEach(p => p.classList.toggle('active', p.id === `correos-panel-${btn.dataset.correosTab}`));
    };
    if (window.AdminUnsaved?.isDirty('email-config')) {
      window.AdminUnsaved.requestNavigation(switchNow, { scopeIds: ['email-config'] });
    } else {
      switchNow();
    }
  });
});

// ---- Disparo automático desde Pedidos (updateOrderStatus/updatePayStatus) ----
async function maybeSendOrderStatusEmail_(order, kind, value) {
  try {
    const key = kind === 'payment' ? PAY_STATUS_TO_TYPE[value] : ORDER_STATUS_TO_TYPE[value];
    if (!key || !order || !order.userEmail) return;
    const settings = emailSettingsCache || await getEmailSettingsFresh_();
    if (settings.orderEmailsEnabled === false) return;
    if (!(settings.orderTypesEnabled && settings.orderTypesEnabled[key])) return;
    const tplKey = (settings.orderTypeTemplateMap && settings.orderTypeTemplateMap[key]) || key;
    let tpl = allEmailTemplates.find(t => (t.key || t.id) === tplKey);
    if (!tpl) {
      const snap = await getDoc(doc(db, 'emailTemplates', tplKey));
      if (snap.exists()) tpl = { id: snap.id, ...snap.data() };
    }
    if (!tpl || tpl.active === false) return;
    const variables = orderToVariables_(order);
    const result = await sendTemplatedEmail({ to: order.userEmail, ...templateContentPayload_(tpl), variables });
    await logEmailSend_({ category: 'pedido', type: key, recipient: order.userEmail, status: result?.success ? 'sent' : 'failed', templateKey: tplKey, isAutomatic: true, error: result?.error || '', orderId: order.id, variables });
  } catch (e) {
    console.error('[correos] auto-send falló (no bloquea el cambio de estado):', e);
  }
}

// ======== ENVÍOS: ciudades (CRUD real, con lista en tiempo real) ========
let shipCities  = { delivery: [], encomienda: [] };
let shipEditing = { delivery: null, encomienda: null }; // índice en edición, o null = alta nueva
// Ciudades identificadas por nombre (no por índice, que cambia al borrar/reordenar).
let _selectedShipCities = { delivery: new Set(), encomienda: new Set() };

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
      <input type="checkbox" class="ship-${type}-check" data-name="${c.name}" onclick="toggleShipCitySelect('${type}', this)" ${_selectedShipCities[type].has(c.name) ? 'checked' : ''}>
      <span style="font-weight:600;flex:1">${c.name}</span>
      <span style="font-size:12px;color:${c.price == null ? 'var(--gold-hover)' : 'var(--adm-muted)'}">${c.price == null ? 'Consultar precio' : formatPrice(c.price)}</span>
      <button type="button" class="adm-btn" data-ship-edit="${type}:${i}" style="padding:4px 10px;font-size:11px">Editar</button>
      <button type="button" class="adm-btn" data-ship-del="${type}:${i}" style="padding:4px 10px;font-size:11px;color:#c0392b">Eliminar</button>
    </div>
  `).join('');
  updateShipBulkToolbar(type);
}

window.toggleShipCitySelect = function(type, cb) {
  if (cb.checked) _selectedShipCities[type].add(cb.dataset.name);
  else _selectedShipCities[type].delete(cb.dataset.name);
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
  await setDoc(doc(db, 'settings', 'general'), {
    deliveryCities:   shipCities.delivery,
    encomiendaCities: shipCities.encomienda,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function resetShipForm(type) {
  document.getElementById(`ship-${type}-name`).value = '';
  document.getElementById(`ship-${type}-price`).value = '';
  document.getElementById(`ship-${type}-add`).textContent = 'Agregar';
  document.getElementById(`ship-${type}-cancel`).style.display = 'none';
  shipEditing[type] = null;
}

['delivery', 'encomienda'].forEach(type => {
  document.getElementById(`ship-${type}-add`).onclick = async () => {
    const nameInput  = document.getElementById(`ship-${type}-name`);
    const priceInput = document.getElementById(`ship-${type}-price`);
    const name = nameInput.value.trim();
    if (!name) { toast('Ingresá el nombre de la ciudad'); return; }
    const priceRaw = priceInput.value.trim();
    const price = priceRaw === '' ? null : (parseInt(priceRaw) || 0);
    const idx = shipEditing[type];
    const dupIdx = shipCities[type].findIndex((c, i) => c.name.toLowerCase() === name.toLowerCase() && i !== idx);
    if (dupIdx !== -1) { toast('Esa ciudad ya está cargada'); return; }

    const prevList = shipCities[type].slice();
    if (idx != null) shipCities[type][idx] = { name, price };
    else shipCities[type].push({ name, price });

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

// Tiempo real: si se edita desde otra pestaña/dispositivo, la lista se refresca sola
onSnapshot(doc(db, 'settings', 'general'), snap => {
  if (!snap.exists()) return;
  const d = snap.data();
  shipCities.delivery   = Array.isArray(d.deliveryCities)   ? d.deliveryCities   : [];
  shipCities.encomienda = Array.isArray(d.encomiendaCities) ? d.encomiendaCities : [];
  renderShipList('delivery');
  renderShipList('encomienda');

  // "Abrir WhatsApp Business" en Mensajes — única fuente: whatsappNumber de
  // Configuración. No se toca acá ningún link de "escribirle a esta clienta"
  // (esos usan el teléfono de cada pedido, no el de la tienda).
  const waLink = document.getElementById('mensajes-wa-link');
  const digits = String(d.whatsappNumber || '').replace(/\D/g, '');
  if (waLink && digits) waLink.href = 'https://wa.me/' + digits;

  if (d.waConfirmMessage) waConfirmMessageTemplate = d.waConfirmMessage;
});

// Pestañas Delivery / Encomienda dentro de Envíos
document.querySelectorAll('.ship-tab-btn').forEach(btn => {
  btn.onclick = () => {
    const type = btn.dataset.shipTab;
    document.querySelectorAll('.ship-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.ship-tab-panel').forEach(p => p.classList.toggle('active', p.id === `ship-panel-${type}`));
  };
});

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
let _productosUnsub = null;

// Live listener: any create/edit/delete/activate/deactivate — from this session
// or another admin's — updates the table immediately, no manual refresh needed.
function loadProductos() {
  document.getElementById('prod-loading').style.display = '';
  document.getElementById('prod-table-wrap').style.display = 'none';
  document.getElementById('prod-empty').style.display = 'none';
  if (_productosUnsub) return; // listener already active, just re-show current data
  _productosUnsub = onSnapshot(
    query(collection(db, 'products'), orderBy('name')),
    snap => {
      _allProducts = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      applyProductFilters();
      renderGeneralStatistics();
    },
    e => {
      document.getElementById('prod-loading').textContent = 'Error al cargar productos.';
      console.error(e);
    }
  );
}

function productRowHtml(p) {
  const isSelected = _selectedProducts.has(p._docId);
  const safeDocId = escapeHtmlAdmin(p._docId);
  const docIdArg = inlineArgumentAdmin(p._docId);
  const nameArg = inlineArgumentAdmin(p.name || '');
  const imageUrl = sanitizeImageUrl(p.imageUrl || '');
  const fmt = n => 'Gs. ' + Number(n).toLocaleString('es-PY');
  const canEditProd = can(currentRole, 'editProducts') && roleCanDo('productos', 'editar');
  const canToggleProd = can(currentRole, 'editProducts') && roleCanDo('productos', 'activarDesactivar');
  const canDeleteProd = can(currentRole, 'deleteProducts') && roleCanDo('productos', 'eliminar');
  return `
    <tr style="border-top:1px solid var(--adm-border);transition:background .15s;background:${isSelected ? 'var(--adm-bg)' : ''}" onmouseover="this.style.background='var(--adm-bg)'" onmouseout="this.style.background='${isSelected ? 'var(--adm-bg)' : ''}'">
      <td style="padding:10px 16px;text-align:center">
        <input type="checkbox" class="prod-row-check" data-id="${safeDocId}" ${isSelected ? 'checked' : ''} onclick="toggleProductSelect(this)" style="cursor:pointer;width:15px;height:15px">
      </td>
      <td style="padding:10px 16px">
        ${imageUrl
          ? `<img src="${escapeHtmlAdmin(imageUrl)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--adm-border)">`
          : `<div style="width:48px;height:48px;background:#fce4ec;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8a0b4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`}
      </td>
      <td style="padding:10px 16px;font-weight:600;max-width:200px">${p.name && p.name.trim() ? escapeHtmlAdmin(p.name) : '<span style="color:#c62828;background:#fce4ec;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800">⚠ SIN NOMBRE — revisar/eliminar</span>'}</td>
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
          ${canEditProd ? `<button type="button" class="adm-btn adm-btn-sm" onclick="prodEditar(${docIdArg})" title="Editar producto"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>` : ''}
          ${canToggleProd ? `<button type="button" class="adm-btn adm-btn-sm" style="background:${p.active !== false ? '#fff3e0' : '#e8f5e9'};color:${p.active !== false ? '#bf360c' : '#2e7d32'}" onclick="prodToggleActive(${docIdArg}, ${p.active !== false})" title="${p.active !== false ? 'Desactivar — ocultar de la tienda' : 'Activar — mostrar en la tienda'}">${p.active !== false ? 'Desactivar' : 'Activar'}</button>` : ''}
          ${canDeleteProd ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" onclick="prodEliminar(${docIdArg},${nameArg})" title="Eliminar definitivamente"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Eliminar</button>` : ''}
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
    const c = _allCollections.find(x => x.slug === slug);
    return c ? (c.name || slug) : (slug || 'Sin categoría');
  };
  const groups = new Map();
  list.forEach(p => {
    const key = p.category || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const oa = _allCollections.find(c => c.slug === a)?.order ?? 999;
    const ob = _allCollections.find(c => c.slug === b)?.order ?? 999;
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
  const q = (document.getElementById('prod-search')?.value || '').toLowerCase();
  const cat = document.getElementById('prod-filter-cat')?.value || '';
  let result = _allProducts;
  if (q === 'sin nombre' || q === 'sin-nombre') {
    result = result.filter(p => !p.name || !p.name.trim());
  } else if (q) {
    result = result.filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.category||'').toLowerCase().includes(q) ||
      (p.collection||'').toLowerCase().includes(q) ||
      (p.tags||[]).join(' ').toLowerCase().includes(q)
    );
  }
  if (cat) result = result.filter(p => (p.category||'') === cat);
  if (!q && !cat) renderProductosGrouped(result);
  else renderProductosTable(result);

  // Keep the collection products workspace live if it's currently open
  if (_collProductsSlug && document.getElementById('coll-products-card').style.display !== 'none') renderCollCurrentList();
  if (document.getElementById('coll-picker-card').style.display !== 'none') renderCollPicker();
  updateBulkToolbar();
}
document.getElementById('prod-search').addEventListener('input', applyProductFilters);
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
      if (hiddenInput) hiddenInput.value = url || '';
    },
  });
  _formImageWidgets.set(containerId, controller);
}

function serializeProductForm() {
  return {
    name: document.getElementById('prod-name').value,
    category: document.getElementById('prod-category').value,
    price: document.getElementById('prod-price').value,
    priceBefore: document.getElementById('prod-price-before').value,
    stock: document.getElementById('prod-stock').value,
    imageUrl: document.getElementById('prod-imageUrl').value,
    description: document.getElementById('prod-description').value,
    tags: document.getElementById('prod-tags').value,
    variants: document.getElementById('prod-variants-text').value,
    badge: document.getElementById('prod-badge').value,
    collection: document.getElementById('prod-collection').value,
    active: document.getElementById('prod-active').checked,
    oferta: document.getElementById('prod-oferta').checked,
    destacado: document.getElementById('prod-destacado').checked,
  };
}

window.prodNuevo = function() {
  UnsavedGuard.confirmLeave(_prodNuevoNow);
};

function _prodNuevoNow() {
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-form-title').textContent = 'Nuevo producto';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-category').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-price-before').value = '';
  document.getElementById('prod-stock').value = '';
  document.getElementById('prod-imageUrl').value = '';
  mountFormImageWidget('prod-image-widget', 'prod-imageUrl', {
    label: 'Imagen principal',
    hint: 'Se muestra en la grilla y la ficha del producto',
  });
  document.getElementById('prod-description').value = '';
  document.getElementById('prod-tags').value = '';
  document.getElementById('prod-variants-text').value = '';
  document.getElementById('prod-badge').value = '';
  document.getElementById('prod-collection').value = '';
  document.getElementById('prod-active').checked = true;
  document.getElementById('prod-oferta').checked = false;
  document.getElementById('prod-destacado').checked = false;
  document.getElementById('prod-form-error').style.display = 'none';
  document.getElementById('prod-list-card').style.display = 'none';
  document.getElementById('prod-form-card').style.display = '';
  UnsavedGuard.track(serializeProductForm, prodGuardar);
}

window.prodEditar = function(docId) {
  UnsavedGuard.confirmLeave(() => _prodEditarNow(docId));
};

function _prodEditarNow(docId) {
  const p = _allProducts.find(x => x._docId === docId);
  if (!p) return;
  document.getElementById('prod-id').value = docId;
  document.getElementById('prod-form-title').textContent = 'Editar producto';
  document.getElementById('prod-name').value = p.name || '';
  document.getElementById('prod-category').value = p.category || '';
  document.getElementById('prod-price').value = p.price || '';
  document.getElementById('prod-price-before').value = p.priceBefore || '';
  document.getElementById('prod-stock').value = p.stock ?? '';
  document.getElementById('prod-imageUrl').value = p.imageUrl || '';
  mountFormImageWidget('prod-image-widget', 'prod-imageUrl', {
    value: p.imageUrl || '',
    label: 'Imagen principal',
    hint: 'Se muestra en la grilla y la ficha del producto',
  });
  document.getElementById('prod-description').value = p.description || '';
  document.getElementById('prod-badge').value = p.badge || '';
  document.getElementById('prod-collection').value = p.collection || '';
  document.getElementById('prod-tags').value = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
  // Variants: convert object/array to readable text
  let variantsText = '';
  if (p.variants) {
    if (Array.isArray(p.variants)) {
      variantsText = p.variants.map(v => Object.entries(v).filter(([k]) => k !== 'price' && k !== 'sku' && k !== 'imageUrl').map(([k,val]) => `${k}: ${val}`).join(', ')).join('\n');
    } else if (typeof p.variants === 'object') {
      variantsText = Object.entries(p.variants).flatMap(([k, vals]) => Array.isArray(vals) ? vals.map(v => `${k}: ${v}`) : [`${k}: ${vals}`]).join('\n');
    }
  }
  document.getElementById('prod-variants-text').value = variantsText;
  document.getElementById('prod-active').checked = p.active !== false;
  document.getElementById('prod-oferta').checked = !!p.oferta;
  document.getElementById('prod-destacado').checked = !!p.destacado;
  document.getElementById('prod-form-error').style.display = 'none';
  document.getElementById('prod-list-card').style.display = 'none';
  document.getElementById('prod-form-card').style.display = '';
  UnsavedGuard.track(serializeProductForm, prodGuardar);
}

function _prodCloseForm() {
  document.getElementById('prod-form-card').style.display = 'none';
  document.getElementById('prod-list-card').style.display = '';
}
window.prodCancelForm = function() {
  UnsavedGuard.confirmLeave(_prodCloseForm);
};

async function prodGuardar() {
  const errEl = document.getElementById('prod-form-error');
  const _isEdit = !!document.getElementById('prod-id').value;
  const _permOk = _isEdit
    ? (can(currentRole, 'editProducts') && roleCanDo('productos', 'editar'))
    : (can(currentRole, 'addProducts') && roleCanDo('productos', 'crear'));
  if (!_permOk) {
    errEl.textContent = _isEdit ? 'No tenés permiso para editar productos.' : 'No tenés permiso para crear productos.';
    errEl.style.display = '';
    return false;
  }
  const name = document.getElementById('prod-name').value.trim();
  const category = document.getElementById('prod-category').value;
  const price = parseInt(document.getElementById('prod-price').value);

  if (!name || !category || !price) {
    errEl.textContent = 'Nombre, categoría y precio son obligatorios.';
    errEl.style.display = '';
    return false;
  }
  errEl.style.display = 'none';

  const btn = document.getElementById('prod-save-btn');
  btn.textContent = 'Guardando…'; btn.disabled = true;

  // Parse variants from text: "Color: Rojo\nColor: Dorado" → {Color: ['Rojo','Dorado']}
  const variantsRaw = document.getElementById('prod-variants-text').value.trim();
  let variantsParsed = null;
  if (variantsRaw) {
    const vObj = {};
    variantsRaw.split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!key || !val) return;
      if (!vObj[key]) vObj[key] = [];
      if (!vObj[key].includes(val)) vObj[key].push(val);
    });
    if (Object.keys(vObj).length) variantsParsed = vObj;
  }

  const tagsRaw = document.getElementById('prod-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const priceBefore = parseInt(document.getElementById('prod-price-before').value) || null;
  const badge = document.getElementById('prod-badge').value || null;

  const collection_ = document.getElementById('prod-collection').value.trim() || null;

  const data = {
    name,
    category,
    collection: collection_,
    price,
    priceBefore,
    // Vacío = stock no controlado/ilimitado (el storefront ya lo trata así,
    // ver script.js) — no lo confundimos con "0" (agotado de verdad), que
    // solo se guarda si la vendedora lo escribe a propósito.
    stock: (() => {
      const raw = document.getElementById('prod-stock').value.trim();
      if (raw === '') return null;
      const n = parseInt(raw);
      return Number.isNaN(n) ? null : n;
    })(),
    imageUrl: document.getElementById('prod-imageUrl').value.trim() || null,
    description: document.getElementById('prod-description').value.trim() || '',
    tags,
    badge,
    active: document.getElementById('prod-active').checked,
    oferta: document.getElementById('prod-oferta').checked,
    destacado: document.getElementById('prod-destacado').checked,
    ...(variantsParsed ? { variants: variantsParsed } : {}),
    updatedAt: serverTimestamp(),
  };

  try {
    const docId = document.getElementById('prod-id').value;
    if (docId) {
      const oldProd = _allProducts.find(p => p._docId === docId);
      await updateDoc(doc(db, 'products', docId), data);
      const changes = [];
      if (oldProd && Number(oldProd.stock || 0) !== Number(data.stock || 0)) {
        changes.push(`Stock: ${oldProd.stock ?? 0} → ${data.stock}`);
      }
      if (oldProd && Number(oldProd.price || 0) !== Number(data.price || 0)) {
        changes.push(`Precio: ${oldProd.price ?? 0} → ${data.price}`);
      }
      if (oldProd && (oldProd.active !== false) !== data.active) {
        changes.push(`Activo: ${oldProd.active !== false} → ${data.active}`);
      }
      logAudit('editar_producto', 'producto', docId, name, changes.join(' · ') || 'Datos actualizados');
      toast('Producto actualizado');
    } else {
      data.createdAt = serverTimestamp();
      const newRef = doc(collection(db, 'products'));
      await setDoc(newRef, data);
      logAudit('crear_producto', 'producto', newRef.id, name, `Precio: ${data.price} · Stock: ${data.stock}`);
      toast('Producto creado');
    }
    UnsavedGuard.clear();
    _prodCloseForm();
    loadProductos();
    return true;
  } catch(e) {
    errEl.textContent = 'Error al guardar: ' + e.message;
    errEl.style.display = '';
    return false;
  } finally {
    btn.textContent = 'Guardar producto'; btn.disabled = false;
  }
}

window.prodToggleActive = async (docId, currentlyActive) => {
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'activarDesactivar')) { toast('No tenés permiso para activar/desactivar productos'); return; }
  try {
    await updateDoc(doc(db, 'products', docId), { active: !currentlyActive, updatedAt: serverTimestamp() });
    const p = _allProducts.find(x => x._docId === docId);
    if (p) p.active = !currentlyActive;
    toast(currentlyActive ? 'Producto desactivado' : 'Producto activado');
    renderProductosTable(_allProducts);
  } catch(e) {
    toast('Error: ' + e.message);
  }
};

async function prodEliminar(docId, name) {
  if (!can(currentRole, 'deleteProducts') || !roleCanDo('productos', 'eliminar')) { toast('No tenés permiso para eliminar productos'); return; }
  if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteDoc(doc(db, 'products', docId));
    logAudit('eliminar_producto', 'producto', docId, name, 'Producto eliminado');
    toast('Producto eliminado');
    loadProductos();
  } catch(e) {
    toast('Error al eliminar: ' + e.message);
  }
}
// Fix (Fase 2): estaban declaradas solo en el scope del módulo, pero el HTML
// las llama desde onclick="..." inline — eso solo puede resolver identificadores
// en window, así que sin esto, "Guardar producto" y "Eliminar" tiraban
// "ReferenceError: ... is not defined" y no hacían nada (bug preexistente,
// encontrado al conectar el registro de auditoría de productos de esta fase).
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

function collSlugify(s) {
  return (s || '')
    .toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// No orderBy() in the query itself: a doc missing the `order` field would
// silently drop out of an orderBy('order') query in Firestore — every
// collection doc is fetched unconditionally, then sorted client-side
// (normalizeCollectionDoc gives every doc a safe default order).
function loadColecciones() {
  document.getElementById('coll-loading').style.display = '';
  document.getElementById('coll-grid-wrap').style.display = 'none';
  document.getElementById('coll-empty').style.display = 'none';
  if (_collectionsUnsub) { renderColeccionesGrid(applyCollFilter(_allCollections)); return; }
  _collectionsUnsub = onSnapshot(
    collection(db, 'collections'),
    snap => {
      _allCollections = snap.docs
        .map(d => normalizeCollectionDoc(d.id, d.data()))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
      renderColeccionesGrid(applyCollFilter(_allCollections));
      syncCategorySelects();
      renderGeneralStatistics();
    },
    e => {
      document.getElementById('coll-loading').textContent = 'Error al cargar colecciones: ' + e.message;
      console.error('[colecciones] listener failed:', e);
      toast('No se pudieron cargar las colecciones: ' + e.message);
    }
  );
}

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
    const current = sel.value;
    // Keep only the placeholder option (always the first, never dynamic)
    [...sel.options].slice(1).forEach(o => o.remove());
    _allCollections
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.slug;
        opt.textContent = c.name + (c.visible === false ? ' (oculta)' : '');
        sel.appendChild(opt);
      });
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  });
}

function applyCollFilter(list) {
  const q = (document.getElementById('coll-search')?.value || '').toLowerCase();
  if (!q) return list;
  return list.filter(c => (c.name||'').toLowerCase().includes(q) || (c.slug||'').toLowerCase().includes(q));
}
document.getElementById('coll-search').addEventListener('input', () => renderColeccionesGrid(applyCollFilter(_allCollections)));

// ══════════════════════════════════════════════
// COLECCIONES: SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS
// ══════════════════════════════════════════════
let _selectedCollections = new Set();

window.toggleCollectionSelect = function(cb) {
  if (cb.checked) _selectedCollections.add(cb.dataset.slug);
  else _selectedCollections.delete(cb.dataset.slug);
  updateCollBulkToolbar();
};

function updateCollBulkToolbar() {
  const count = _selectedCollections.size;
  const toolbar = document.getElementById('coll-bulk-toolbar');
  const countEl = document.getElementById('coll-bulk-count');
  const delBtn = document.getElementById('coll-bulk-delete-btn');
  if (toolbar) toolbar.classList.toggle('show', count > 0);
  if (countEl) countEl.textContent = `${count} seleccionada${count !== 1 ? 's' : ''}`;
  if (delBtn) delBtn.style.display = (can(currentRole, 'deleteCollections') && roleCanDo('colecciones', 'eliminar')) ? '' : 'none';
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
  if (!can(currentRole, 'deleteCollections') || !roleCanDo('colecciones', 'eliminar')) { toast('No tenés permiso para eliminar colecciones'); return; }
  const slugs = [..._selectedCollections];
  const empty = [], withProducts = [];
  slugs.forEach(slug => {
    const count = _allProducts.filter(p => (p.category || '') === slug).length;
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
      empty.slice(i, i + CHUNK).forEach(slug => batch.delete(doc(db, 'collections', slug)));
      await batch.commit();
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
    _allProducts.filter(p => (p.category || '') === c.slug).length
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
    const count = _allProducts.filter(p => (p.category || '') === c.slug).length;
    const safeSlug = escapeHtmlAdmin(c.slug);
    const slugArg = inlineArgumentAdmin(c.slug);
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
          <button type="button" class="adm-btn adm-btn-sm" onclick="collVerProductos(${slugArg})">Ver productos</button>
          ${(can(currentRole, 'manageContent') && roleCanDo('colecciones', 'editar')) ? `<button type="button" class="adm-btn adm-btn-sm" onclick="collEditar(${slugArg})">Editar</button>` : ''}
          ${(can(currentRole, 'deleteCollections') && roleCanDo('colecciones', 'eliminar')) ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" onclick="collEliminar(${slugArg}, ${count})">Eliminar</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('') + unmanaged.map(u => {
    const safeSlug = escapeHtmlAdmin(u.slug);
    const slugArg = inlineArgumentAdmin(u.slug);
    return `
    <div class="adm-card" style="margin:0;overflow:hidden;border:1.5px dashed #e8a0b4">
      <div style="height:120px;background:#fff3e0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#bf360c">SIN GESTIONAR</div>
      <div style="padding:14px">
        <div style="font-weight:800;font-size:14px">${safeSlug}</div>
        <div style="color:var(--adm-muted);font-size:11px;margin-bottom:8px">Categoría usada en productos, sin colección creada</div>
        <div style="font-size:12px;font-weight:700;color:var(--adm-primary);margin-bottom:12px">${u.count} producto${u.count===1?'':'s'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="adm-btn adm-btn-sm" onclick="collVerProductos(${slugArg})">Ver productos</button>
          <button type="button" class="adm-btn adm-btn-primary adm-btn-sm" onclick="collCrearDesdeCategoria(${slugArg})">Crear colección</button>
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
  const items = _allProducts.filter(p => (p.category || '') === _collProductsSlug);
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
        <button type="button" class="adm-btn adm-btn-sm" style="padding:2px 8px" ${(!inStockRow || i === 0) ? 'disabled' : ''} onclick="collMoveProduct('${p._docId}', -1)" title="Mover arriba">↑</button>
        <button type="button" class="adm-btn adm-btn-sm" style="padding:2px 8px" ${(!inStockRow || i === inStock.length - 1) ? 'disabled' : ''} onclick="collMoveProduct('${p._docId}', 1)" title="Mover abajo">↓</button>
      </div>
      ${p.imageUrl
        ? `<img src="${p.imageUrl}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--adm-border);flex-shrink:0">`
        : `<div style="width:44px;height:44px;background:#fce4ec;border-radius:6px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name || '(sin nombre)'}</div>
        <div style="font-size:11px;color:var(--adm-muted)">${fmt(p.price)} · ${p.stock != null ? p.stock + ' en stock' : 'stock no definido'}</div>
      </div>
      ${!inStockRow ? `<span style="font-size:10px;font-weight:800;background:#fce4ec;color:#c62828;padding:2px 8px;border-radius:20px;flex-shrink:0">SIN STOCK</span>` : ''}
      <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0;background:${p.active !== false ? '#e8f5e9' : '#fce4ec'};color:${p.active !== false ? '#2e7d32' : '#c62828'}">
        ${p.active !== false ? 'Activo' : 'Inactivo'}
      </span>
      ${(can(currentRole, 'editProducts') && roleCanDo('productos', 'activarDesactivar')) ? `<button type="button" class="adm-btn adm-btn-sm" style="flex-shrink:0;background:${p.active !== false ? '#fff3e0' : '#e8f5e9'};color:${p.active !== false ? '#bf360c' : '#2e7d32'}" onclick="collToggleActive('${p._docId}', ${p.active !== false})" title="${p.active !== false ? 'Desactivar — ocultar de la tienda' : 'Activar — mostrar en la tienda'}">${p.active !== false ? 'Desactivar' : 'Activar'}</button>` : ''}
      ${(can(currentRole, 'manageContent') && roleCanDo('colecciones', 'editar')) ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-danger" style="flex-shrink:0" onclick="collRemoveFromCollection('${p._docId}')" title="Quitar de esta colección">✕ Quitar</button>` : ''}
    </div>`;
  }).join('');
}

window.collMoveProduct = async function(docId, direction) {
  if (!can(currentRole, 'manageContent') || !roleCanDo('colecciones', 'editar')) { toast('No tenés permiso para editar el orden de la colección'); return; }
  const items = _allProducts.filter(p => (p.category || '') === _collProductsSlug && _collInStock(p));
  const sorted = items.sort((a, b) => (a.collectionOrder ?? 9999) - (b.collectionOrder ?? 9999) || (a.name||'').localeCompare(b.name||'', 'es'));
  const idx = sorted.findIndex(p => p._docId === docId);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
  // Normalize order values 0..n-1, then swap the two affected items
  sorted.forEach((p, i) => { p.collectionOrder = i; });
  const a = sorted[idx], b = sorted[swapIdx];
  [a.collectionOrder, b.collectionOrder] = [b.collectionOrder, a.collectionOrder];
  try {
    const batch = writeBatch(db);
    sorted.forEach(p => batch.update(doc(db, 'products', p._docId), { collectionOrder: p.collectionOrder }));
    await batch.commit();
  } catch (e) {
    toast('No se pudo reordenar: ' + e.message);
  }
};

window.collRemoveFromCollection = async function(docId) {
  if (!can(currentRole, 'manageContent') || !roleCanDo('colecciones', 'editar')) { toast('No tenés permiso para editar colecciones'); return; }
  const p = _allProducts.find(x => x._docId === docId);
  if (!confirm(`¿Quitar "${p?.name || 'este producto'}" de la colección?`)) return;
  try {
    await updateDoc(doc(db, 'products', docId), { category: '', updatedAt: serverTimestamp() });
    toast('Producto quitado de la colección');
  } catch (e) {
    toast('Error: ' + e.message);
  }
};

window.collToggleActive = async function(docId, currentlyActive) {
  if (!can(currentRole, 'editProducts') || !roleCanDo('productos', 'activarDesactivar')) { toast('No tenés permiso para activar/desactivar productos'); return; }
  try {
    await updateDoc(doc(db, 'products', docId), { active: !currentlyActive, updatedAt: serverTimestamp() });
    const p = _allProducts.find(x => x._docId === docId);
    if (p) p.active = !currentlyActive;
    toast(currentlyActive ? 'Producto desactivado' : 'Producto activado');
    renderCollCurrentList();
    renderProductosTable(_allProducts);
  } catch (e) {
    toast('Error: ' + e.message);
  }
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
  const q = (document.getElementById('coll-picker-search').value || '').toLowerCase().trim();
  const filtered = q
    ? _allProducts.filter(p => (p.name || '').toLowerCase().includes(q))
    : _allProducts;

  document.getElementById('coll-picker-list').innerHTML = filtered.map(p => {
    const checked = _collPickerSelected.has(p._docId);
    const currentColl = p.category ? (_allCollections.find(c => c.slug === p.category)?.name || p.category) : '—';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 16px;border-top:1px solid var(--adm-border)">
      <input type="checkbox" data-picker-id="${p._docId}" ${checked ? 'checked' : ''} onclick="collPickerToggleOne(this)" style="width:16px;height:16px;cursor:pointer;flex-shrink:0">
      ${p.imageUrl
        ? `<img src="${p.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">`
        : `<div style="width:40px;height:40px;background:#fce4ec;border-radius:6px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name || '(sin nombre)'}</div>
        <div style="font-size:11px;color:var(--adm-muted)">Gs. ${Number(p.price||0).toLocaleString('es-PY')} · ${p.stock != null && p.stock <= 0 ? 'Sin stock' : 'Con stock'}</div>
      </div>
      <div style="font-size:11px;color:var(--adm-muted);flex-shrink:0">${currentColl}</div>
    </div>`;
  }).join('');
  updatePickerSelCount();
}
document.getElementById('coll-picker-search').addEventListener('input', renderCollPicker);

function updatePickerSelCount() {
  document.getElementById('coll-picker-sel-count').textContent = `${_collPickerSelected.size} seleccionados`;
  const q = (document.getElementById('coll-picker-search').value || '').toLowerCase().trim();
  const filtered = q ? _allProducts.filter(p => (p.name || '').toLowerCase().includes(q)) : _allProducts;
  document.getElementById('coll-picker-select-all').checked = filtered.length > 0 && filtered.every(p => _collPickerSelected.has(p._docId));
}

window.collPickerToggleOne = function(input) {
  const id = input.dataset.pickerId;
  if (input.checked) _collPickerSelected.add(id);
  else _collPickerSelected.delete(id);
  updatePickerSelCount();
};

window.collPickerToggleAll = function(checkbox) {
  const q = (document.getElementById('coll-picker-search').value || '').toLowerCase().trim();
  const filtered = q ? _allProducts.filter(p => (p.name || '').toLowerCase().includes(q)) : _allProducts;
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
    await batch.commit();
  }
}

window.collPickerAddSelected = async function() {
  if (!_collPickerSelected.size) { toast('Seleccioná al menos un producto'); return; }
  try {
    const ids = [..._collPickerSelected];
    await batchUpdateChunked(ids, () => ({ category: _collProductsSlug, updatedAt: serverTimestamp() }));
    toast(`${ids.length} producto(s) agregados a la colección`);
    collClosePicker();
  } catch (e) {
    toast('Error al agregar: ' + e.message);
  }
};

window.collGuardar = async function() {
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
  const slug = collSlugify(document.getElementById('coll-slug').value);
  const description = document.getElementById('coll-description').value.trim();
  const image = document.getElementById('coll-image').value.trim();
  const order = parseInt(document.getElementById('coll-order').value) || 0;
  const visible = document.getElementById('coll-visible').checked;

  if (!name || !slug) {
    errEl.textContent = 'Completá nombre y slug.';
    errEl.style.display = '';
    return false;
  }
  const dup = _allCollections.find(c => c.slug === slug && c.slug !== originalSlug);
  if (dup) {
    errEl.textContent = `Ya existe una colección con el slug "${slug}". Elegí otro.`;
    errEl.style.display = '';
    return false;
  }

  const btn = document.getElementById('coll-save-btn');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    const data = { name, description, image, order, visible, updatedAt: serverTimestamp() };
    if (originalSlug && originalSlug !== slug) {
      // Slug changed: create new doc, move products over, delete old doc
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'collections', slug), data);
      const affected = _allProducts.filter(p => (p.category || '') === originalSlug);
      if (affected.length) {
        // Chunked (max 450/batch, Firestore hard-caps a batch at 500 writes)
        // so a slug rename never silently fails on a collection with 500+ products.
        await batchUpdateChunked(affected.map(p => p._docId), () => ({ category: slug, updatedAt: serverTimestamp() }));
      }
      await deleteDoc(doc(db, 'collections', originalSlug));
      toast(`Colección renombrada — ${affected.length} producto(s) actualizados`);
    } else if (originalSlug) {
      await updateDoc(doc(db, 'collections', originalSlug), data);
      toast('Colección actualizada');
    } else {
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'collections', slug), data);
      toast('Colección creada');
    }
    UnsavedGuard.clear();
    _collCloseForm();
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
    if (targetSlug && !_allCollections.some(x => x.slug === targetSlug)) {
      toast(`"${targetSlug}" no es una colección existente. Cancelado — no se movió ningún producto.`);
      return;
    }
    if (!confirm(`¿Mover ${count} producto(s) de "${label}" a "${targetSlug || '(sin colección)'}" y luego eliminar "${label}"?`)) return;
    try {
      const affected = _allProducts.filter(p => (p.category || '') === slug);
      // Chunked (max 450/batch) so reassigning 500+ products never silently
      // fails on Firestore's 500-write batch cap.
      await batchUpdateChunked(affected.map(p => p._docId), () => ({ category: targetSlug, updatedAt: serverTimestamp() }));
      await deleteDoc(doc(db, 'collections', slug));
      toast(`${affected.length} producto(s) movidos y "${label}" eliminada`);
    } catch (e) {
      toast('Error al eliminar: ' + e.message);
    }
    return;
  }

  if (!confirm(`¿Eliminar la colección "${label}"? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteDoc(doc(db, 'collections', slug));
    toast('Colección eliminada');
  } catch (e) {
    toast('Error al eliminar: ' + e.message);
  }
};

window.collImportarDefaults = async function() {
  if (!confirm('Esto crea las 12 colecciones actuales en la base de datos para que puedas administrarlas (renombrar, ocultar, reordenar, agregar imagen). ¿Continuar?')) return;
  const DEFAULTS = [
    ['relojes','Relojes'], ['bolsos','Bags'], ['aros','Aros'], ['collares','Collares'],
    ['pulseras','Pulseras'], ['anillos','Anillos'], ['tobilleras','Tobilleras'],
    ['brazaletes','Brazaletes'], ['earcuff','Earcuff'], ['armcuff','Armcuff'],
    ['gafas','Gafas'], ['joyeros','Joyeros'],
  ];
  try {
    const batch = writeBatch(db);
    DEFAULTS.forEach(([slug, name], i) => {
      batch.set(doc(db, 'collections', slug), {
        name, description: '', image: '', order: i, visible: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
    toast('Colecciones importadas');
  } catch (e) {
    toast('Error al importar: ' + e.message);
  }
};

// Load collections when section is shown
document.querySelectorAll('[data-section="colecciones"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!_collectionsUnsub) loadColecciones();
  });
});

// ======== IMPORT / EXPORT ========
let csvProductos = [];
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
      const productos = (o.items || []).map(i => `${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''}`).join('; ');
      const metodo = SHIP_LABELS[o.shipping?.method] || o.shipping?.method || '—';
      const ciudadZona = [o.shipping?.city, o.shipping?.zone].filter(Boolean).join(' / ') || '—';
      rows.push([
        o.shortId || d.id.slice(0, 8).toUpperCase(),
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
    toast(`${snap.size} pedidos exportados`);
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
    const raw = document.getElementById('import-json').value.trim();
    const result = document.getElementById('import-result');
    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) throw new Error('Debe ser un array JSON');
      let ok = 0;
      for (const item of items) {
        if (!item.name || !item.category || !item.price) continue;
        await addDoc(collection(db, 'products'), {
          name:        item.name,
          category:    item.category,
          price:       Number(item.price),
          imageUrl:    item.imageUrl || '',
          stock:       Number(item.stock) || 0,
          active:      item.active !== false,
          description: item.description || '',
          createdAt:   serverTimestamp(),
          createdBy:   currentUser?.email || 'import',
        });
        ok++;
      }
      result.innerHTML = `<span style="color:green">${ok} productos importados correctamente</span>`;
      toast(`${ok} productos importados`);
    } catch(e) {
      result.innerHTML = `<span style="color:#e57">Error: ${e.message}</span>`;
    }
  };

  // ── CSV DE SHOPIFY
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

  function parsearCSV(texto) {
    const lineas = texto.split('\n');
    if (lineas.length < 2) return [];
    const headers = lineas[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const col = name => headers.indexOf(name);
    const iHandle=col('handle'),iTitle=col('title'),iType=col('type'),iTags=col('tags'),
          iStatus=col('status'),iPrice=col('variant price'),iCompare=col('variant compare at price'),
          iStock=col('variant inventory qty'),iImg=col('image src'),iImgPos=col('image position'),
          iVariantImg=col('variant image'),iImgUrl=col('imageurl'),iImage=col('image'),
          iFoto=col('foto'),iImagen=col('imagen'),
          iOpt1N=col('option1 name'),iOpt1V=col('option1 value'),
          iOpt2N=col('option2 name'),iOpt2V=col('option2 value'),
          iOpt3N=col('option3 name'),iOpt3V=col('option3 value'),
          iVariantSku=col('variant sku');
    const iDesc = col('body (html)') >= 0 ? col('body (html)') : col('body html');
    function stripHtml(html) { return (html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
    const productos = new Map();
    for (let i = 1; i < lineas.length; i++) {
      const linea = lineas[i];
      if (!linea.trim()) continue;
      const cols = [];
      let inQuote = false, cell = '';
      for (let c = 0; c < linea.length; c++) {
        const ch = linea[c];
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { cols.push(cell.trim()); cell = ''; continue; }
        cell += ch;
      }
      cols.push(cell.trim());
      const handle = cols[iHandle] || '';
      if (!handle) continue;
      const title=cols[iTitle]||'',type=cols[iType]||'',tags=cols[iTags]||'',
            status=cols[iStatus]||'active',price=parsearPrecio(cols[iPrice]),
            compare=parsearPrecio(cols[iCompare]),stock=parseInt(cols[iStock])||0,
            img=cols[iImg]||(iVariantImg>=0?cols[iVariantImg]:'')||(iImgUrl>=0?cols[iImgUrl]:'')||(iImage>=0?cols[iImage]:'')||(iFoto>=0?cols[iFoto]:'')||(iImagen>=0?cols[iImagen]:'')||'',
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
        <td>${p.imageUrl ? `<img src="${p.imageUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'" />` : '<div style="width:48px;height:48px;background:#fce4ec;border-radius:6px"></div>'}</td>
        <td style="font-weight:700;max-width:200px;word-break:break-word">${p.name}</td>
        <td>
          <select class="adm-select" style="padding:4px 8px;font-size:12px;border-radius:20px;width:auto"
                  onchange="csvProductos[${i}].category = this.value">
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
    for (let i=0; i<list.length; i++) {
      const p = list[i];
      const pct = Math.round(((i+1)/list.length)*100);
      progressBar.style.width=pct+'%';
      progressLbl.textContent=`Importando ${i+1} de ${list.length}: ${p.name}`;
      try {
        await addDoc(collection(db,'products'), {
          name:        p.name,
          category:    p.category,
          price:       p.price,
          priceBefore: p.priceBefore||null,
          stock:       p.stock,
          imageUrl:    p.imageUrl,
          imagesExtra: p.imagesExtra||[],
          description: p.description||'',
          variants:    p.variants?.length ? p.variants : [],
          tags:        p.tags||[],
          active:      p.active,
          oferta:      false,
          createdAt:   serverTimestamp(),
          createdBy:   currentUser?.email||'import',
          source:      'shopify-csv',
        });
        ok++;
      } catch(e) { errores++; console.error('Error importando:', p.name, e); }
    }
    btn.disabled=false; btnSel.disabled=false; progress.style.display='none';
    if (ok>0) {
      result.innerHTML=`<span style="color:green">${ok} productos importados correctamente${errores>0?` (${errores} con error)`:''}</span>`;
      toast(`${ok} productos importados de Shopify`);
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

// ======== CONTENIDO DEL SITIO ========
let contCurrentPage = 'index';
let contSavedData = {};
let contExtraPages = [];
let _contenidoInited = false;

const CONT_SCHEMA = {
  index: {
    label: 'Página Principal', url: 'index.html',
    sections: {
      hero: {
        label: 'Hero Principal', icon: 'hero',
        fields: [
          { key:'eyebrow', label:'Texto eyebrow', type:'text', def:'Bienvenidas a TINTIN' },
          { key:'title', label:'Título grande (H1)', type:'text', def:'TINTIN' },
          { key:'subtitle', label:'Subtítulo', type:'text', def:'Brillo, estilo y mucha personalidad' },
          { key:'btnText', label:'Texto del botón', type:'text', def:'¿Quiénes somos? →' },
          { key:'btnHref', label:'URL del botón', type:'url', def:'about.html' },
          { key:'_note', label:'Las imágenes del Hero se administran en Contenido → Imágenes / Banners (admin-images.html), no acá.', type:'note' },
        ]
      },
      trust: {
        label: 'Barra de Confianza', icon: 'trust',
        fields: [
          { key:'visible', label:'Mostrar esta sección en el sitio', type:'checkbox', def:true },
          { key:'items', label:'Ítems (4 bloques)', type:'array',
            itemFields: [
              { key:'label', label:'Título', type:'text' },
              { key:'desc', label:'Descripción', type:'text' },
            ],
            def: [
              { label:'Envío mismo día', desc:'Pedidos antes de las 11 hs, Zona Central' },
              { label:'Acero inoxidable', desc:'No se oxida ni decolora' },
              { label:'Pago seguro', desc:'Transferencia o efectivo' },
              { label:'Atención personalizada', desc:'Te ayudamos por WhatsApp' },
            ]
          }
        ]
      },
      editorial_bag: {
        label: 'Editorial — Bags', icon: 'bags',
        fields: [
          { key:'visible', label:'Mostrar esta sección en el sitio', type:'checkbox', def:true },
          { key:'eyebrow', label:'Eyebrow', type:'text', def:'Colección BAG' },
          { key:'title', label:'Título', type:'text', def:'El complemento\nque lo cambia todo' },
          { key:'body', label:'Texto', type:'textarea', def:'' },
          { key:'btnText', label:'Texto botón', type:'text', def:'¡Lo quiero ya!' },
          { key:'btnHref', label:'URL botón', type:'url', def:'catalogo.html?cat=bolsos' },
          { key:'_note', label:'La imagen de esta sección se administra en Contenido → Imágenes / Banners (admin-images.html), no acá.', type:'note' },
        ]
      },
      editorial_relojes: {
        label: 'Editorial — Relojes', icon: '⌚',
        fields: [
          { key:'visible', label:'Mostrar esta sección en el sitio', type:'checkbox', def:true },
          { key:'eyebrow', label:'Eyebrow', type:'text', def:'Nueva colección' },
          { key:'title', label:'Título', type:'text', def:'El reloj del que\ntodas se enamoran' },
          { key:'body', label:'Texto', type:'textarea', def:'' },
          { key:'btnText', label:'Texto botón', type:'text', def:'Ver relojes' },
          { key:'btnHref', label:'URL botón', type:'url', def:'catalogo.html?cat=relojes' },
          { key:'_note', label:'La imagen de esta sección se administra en Contenido → Imágenes / Banners (admin-images.html), no acá.', type:'note' },
        ]
      },
      footer: {
        label: 'Footer', icon: 'footer',
        fields: [
          { key:'copy', label:'Texto copyright', type:'text', def:'© 2024–2026 TINTIN ACCESORIOS' },
          { key:'waText', label:'Botón WhatsApp texto', type:'text', def:'Contactanos por WhatsApp' },
          // El número de WhatsApp se configura en Configuración → WhatsApp,
          // única fuente para todo el sitio — ya no se edita por página. El
          // logo del footer es texto (wordmark "TINTIN"), no imagen — es
          // así a propósito, distinto del logo del header.
        ]
      }
    }
  },
  nosotros: {
    label: 'Nosotros', url: 'about.html',
    sections: {
      hero: {
        label: 'Hero Nosotros', icon: 'hero',
        fields: [
          { key:'title', label:'Título principal', type:'text', def:'Somos más que accesorios' },
          { key:'desc', label:'Descripción', type:'textarea', def:'' },
        ]
      },
      historia: {
        label: 'Nuestra Historia', icon: 'story',
        fields: [
          { key:'eyebrow', label:'Eyebrow', type:'text', def:'Desde San Lorenzo' },
          { key:'title', label:'Título', type:'text', def:'Nuestra historia' },
        ]
      }
    }
  },
  catalogo: {
    label: 'Catálogo', url: 'catalogo.html',
    sections: {
      header: {
        label: 'Encabezado del catálogo', icon: 'catalog',
        fields: [
          { key:'title', label:'Título', type:'text', def:'Nuestro Catálogo' },
          { key:'eyebrow', label:'Eyebrow', type:'text', def:'Toda la colección' },
          { key:'desc', label:'Descripción', type:'textarea', def:'' },
        ]
      }
    }
  },
  collections: {
    label: 'Colecciones', url: 'collections.html',
    sections: {
      header: {
        label: 'Encabezado de Colecciones', icon: 'catalog',
        fields: [
          { key:'title', label:'Título', type:'text', def:'NUESTRAS COLECCIONES' },
          { key:'desc', label:'Subtítulo', type:'textarea', def:'' },
        ]
      }
    }
  },
  contact: {
    label: 'Contacto', url: 'contact.html',
    sections: {
      header: {
        label: 'Encabezado de Contacto', icon: 'page',
        fields: [
          { key:'title', label:'Título', type:'text', def:'¿Dudas o consultas?' },
          { key:'desc', label:'Subtítulo', type:'textarea', def:'' },
        ]
      }
    }
  },
  faq: {
    label: 'Preguntas Frecuentes', url: 'preguntas-frecuentes.html',
    sections: {
      header: {
        label: 'Encabezado de FAQ', icon: 'page',
        fields: [
          { key:'title', label:'Título', type:'text', def:'Preguntas Frecuentes 💬' },
          { key:'desc', label:'Subtítulo', type:'textarea', def:'' },
        ]
      }
    }
  },
  cambios: {
    label: 'Cambios y Devoluciones', url: 'cambios-devoluciones.html',
    sections: {
      header: {
        label: 'Encabezado de Cambios y Devoluciones', icon: 'page',
        fields: [
          { key:'title', label:'Título', type:'text', def:'Cambios y Devoluciones 🔄' },
          { key:'desc', label:'Subtítulo', type:'textarea', def:'' },
        ]
      }
    }
  },
  envios: {
    label: 'Política de Envíos', url: 'envios.html',
    sections: {
      header: {
        label: 'Encabezado de Envíos', icon: 'page',
        fields: [
          { key:'title', label:'Título', type:'text', def:'Política de Envíos 🚚' },
          { key:'desc', label:'Subtítulo', type:'textarea', def:'' },
          { key:'_note', label:'Las ciudades y costos de envío se administran en Configuración → Envíos, no acá.', type:'note' },
        ]
      }
    }
  }
};

async function contLoadPage(pageId) {
  try {
    const snap = await getDoc(doc(db, 'site_content', pageId));
    contSavedData[pageId] = snap.exists() ? snap.data() : {};
  } catch(e) {
    contSavedData[pageId] = {};
  }
  // Migración puntual: el eyebrow del Hero de home dejó de incluir "· Paraguay".
  // Si el valor guardado es exactamente el texto viejo, se corrige acá (una
  // sola vez, valor exacto → valor exacto) sin tocar ningún otro campo.
  if (pageId === 'index' && contSavedData[pageId]?.hero?.eyebrow === 'Bienvenidas a TINTIN · Paraguay') {
    const migratedHero = { ...contSavedData[pageId].hero, eyebrow: 'Bienvenidas a TINTIN' };
    contSavedData[pageId].hero = migratedHero;
    contSaveSection(pageId, 'hero', migratedHero).catch(() => {});
  }
}

async function contSaveSection(pageId, sectionId, data) {
  const docRef = doc(db, 'site_content', pageId);
  try {
    await setDoc(docRef, { [sectionId]: data }, { merge: true });
    if (!contSavedData[pageId]) contSavedData[pageId] = {};
    contSavedData[pageId][sectionId] = data;
    return true;
  } catch(e) {
    console.error('Error guardando:', e);
    return false;
  }
}

function contRenderField(field, value) {
  if (field.type === 'note') {
    return `<div class="cont-field-note" style="background:#fef5f8;border:1px solid #f0d8e0;border-radius:10px;padding:10px 14px;font-size:12px;color:#b84c72;margin-bottom:12px">${field.label}</div>`;
  }
  const id = `cont-f-${field.key}-${Math.random().toString(36).slice(2,8)}`;
  let html = `<div class="cont-field" data-fkey="${field.key}">`;
  html += `<label class="cont-label" for="${id}">${field.label}</label>`;
  if (field.type === 'text' || field.type === 'url') {
    html += `<input id="${id}" class="cont-input" type="text" value="${(value ?? field.def ?? '').replace(/"/g,'&quot;')}" placeholder="${field.def||''}" data-fkey="${field.key}" />`;
  } else if (field.type === 'textarea') {
    html += `<textarea id="${id}" class="cont-textarea" placeholder="${field.def||''}" data-fkey="${field.key}">${value ?? field.def ?? ''}</textarea>`;
  } else if (field.type === 'image') {
    const imgVal = value ?? field.def ?? '';
    const uid = id + '-upload';
    html += `
      <div class="cont-img-wrap">
        <input id="${id}" class="cont-input" type="text" value="${imgVal.replace(/"/g,'&quot;')}" placeholder="https://... o subí una imagen" data-fkey="${field.key}" />
        <label class="adm-btn adm-btn-primary adm-btn-sm" title="Subir imagen" style="cursor:pointer;white-space:nowrap;position:relative;overflow:hidden">
          Subir
          <input type="file" accept="image/*" style="position:absolute;opacity:0;width:0;height:0;overflow:hidden" onchange="contUploadImage(this, '${id}')" />
        </label>
        <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" onclick="document.getElementById('${id}').value='';document.getElementById('${id}').dispatchEvent(new Event('input'))" title="Borrar URL">✕</button>
      </div>
      <div class="cont-upload-progress" id="${uid}-progress" style="display:none">
        <div class="cont-upload-bar-wrap"><div class="cont-upload-bar" id="${uid}-bar"></div></div>
        <span class="cont-upload-pct" id="${uid}-pct">0%</span>
      </div>
      <img class="cont-img-preview ${imgVal ? 'show' : ''}" src="${imgVal||''}" alt="preview" data-preview-for="${id}" id="${uid}-preview" />
    `;
  } else if (field.type === 'array') {
    html += contRenderArrayField(field, value ?? field.def ?? [], id);
  } else if (field.type === 'checkbox') {
    const checked = (value ?? field.def) !== false;
    html = `<div class="cont-field" data-fkey="${field.key}">
      <label class="cont-label" style="display:flex;align-items:center;gap:8px;cursor:pointer" for="${id}">
        <input id="${id}" type="checkbox" class="tt-mini-switch" role="switch" data-fkey="${field.key}" data-fcheckbox="1" ${checked ? 'checked' : ''} />
        ${field.label}
      </label>
    </div>`;
    return html;
  }
  html += `</div>`;
  return html;
}

function contRenderArrayField(field, items, baseId) {
  let html = `<div class="cont-array-container" data-fkey="${field.key}" data-array-field>`;
  items.forEach((item, i) => { html += contRenderArrayItem(field, item, i); });
  html += `<button type="button" class="adm-btn adm-btn-outline adm-btn-sm" style="margin-top:8px" onclick="contAddArrayItem(this, '${JSON.stringify(field.itemFields).replace(/'/g,'&#39;').replace(/"/g,'&quot;')}')">+ Agregar ítem</button>`;
  html += `</div>`;
  return html;
}

function contRenderArrayItem(field, item, index) {
  let html = `<div class="cont-array-item">
    <div class="cont-array-item-head">
      <span class="cont-array-item-label">Ítem ${index + 1}</span>
      <button type="button" class="cont-array-del" onclick="this.closest('.cont-array-item').remove();this.closest('.cont-section').classList.add('dirty')" title="Eliminar">×</button>
    </div>`;
  field.itemFields.forEach(subf => {
    html += `<div class="cont-field" data-fkey="${subf.key}">
      <label class="cont-label">${subf.label}</label>
      <input class="cont-input" type="text" value="${(item[subf.key]??'').replace(/"/g,'&quot;')}" placeholder="${subf.def||''}" data-fkey="${subf.key}" />
    </div>`;
  });
  html += `</div>`;
  return html;
}

window.contAddArrayItem = function(btn, fieldJson) {
  const container = btn.closest('.cont-array-container');
  const itemFields = JSON.parse(fieldJson.replace(/&quot;/g,'"'));
  const existing = container.querySelectorAll('.cont-array-item').length;
  const html = contRenderArrayItem({ itemFields }, {}, existing);
  btn.insertAdjacentHTML('beforebegin', html);
  container.closest('.cont-section').classList.add('dirty');
};

function contExtractFieldValue(fieldEl, field) {
  if (field.type === 'array') {
    const container = fieldEl.querySelector('[data-array-field]');
    if (!container) return field.def ?? [];
    const items = [];
    container.querySelectorAll('.cont-array-item').forEach(itemEl => {
      const obj = {};
      field.itemFields.forEach(sf => {
        const inp = itemEl.querySelector(`[data-fkey="${sf.key}"]`);
        if (inp) obj[sf.key] = inp.value;
      });
      items.push(obj);
    });
    return items;
  }
  if (field.type === 'checkbox') {
    const inp = fieldEl.querySelector(`[data-fkey="${field.key}"]`);
    return inp ? inp.checked : (field.def !== false);
  }
  const inp = fieldEl.querySelector(`[data-fkey="${field.key}"]`);
  return inp ? inp.value : (field.def ?? '');
}

function contRenderSection(pageId, sectionId, schema, savedValues) {
  const sv = savedValues?.[sectionId] ?? {};
  const flist = Array.isArray(schema.fields) ? schema.fields : Object.values(schema.fields ?? {});
  let html = `<div class="cont-section" data-section="${sectionId}" data-page="${pageId}">
    <div class="cont-section-head" onclick="contToggleSection(this)">
      <div class="cont-section-title">
        <span class="cont-section-icon">${schema.icon || 'page'}</span>
        ${schema.label}
        <span class="cont-dirty-dot"></span>
      </div>
      <span class="cont-section-chevron">▼</span>
    </div>
    <div class="cont-section-body">`;
  flist.forEach(field => { html += contRenderField(field, sv[field.key]); });
  const pageUrl = CONT_SCHEMA[pageId]?.url || contExtraPages.find(p=>p.id===pageId)?.url || '#';
  const canEditCont = can(currentRole, 'manageContent') && (roleCanDo('contenido', 'editarTextos') || roleCanDo('contenido', 'activarDesactivarSecciones'));
  html += `
      <div class="cont-section-actions">
        ${canEditCont ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm" onclick="contSaveSectionBtn(this, '${pageId}', '${sectionId}')">Guardar sección</button>
        <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" onclick="contRestoreSection(this, '${pageId}', '${sectionId}')">↩ Restaurar defaults</button>` : ''}
        <a href="${pageUrl}" target="_blank" class="adm-btn adm-btn-outline adm-btn-sm">Ver en sitio</a>
      </div>
    </div>
  </div>`;
  return html;
}

async function contRenderPage(pageId) {
  const loadingEl  = document.getElementById('cont-loading');
  const sectionsEl = document.getElementById('cont-sections');
  loadingEl.style.display = 'block';
  sectionsEl.style.display = 'none';
  if (!contSavedData[pageId]) await contLoadPage(pageId);
  let pageSchema = CONT_SCHEMA[pageId] || contExtraPages.find(p=>p.id===pageId);
  sectionsEl.innerHTML = '';
  if (pageSchema) {
    Object.entries(pageSchema.sections).forEach(([sectionId, sSchema]) => {
      sectionsEl.innerHTML += contRenderSection(pageId, sectionId, sSchema, contSavedData[pageId]);
    });
  } else {
    sectionsEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--adm-muted)">No hay secciones configuradas para esta página.</div>`;
  }
  sectionsEl.querySelectorAll('.cont-input, .cont-textarea').forEach(inp => {
    inp.addEventListener('input', () => {
      const section = inp.closest('.cont-section');
      if (section) {
        section.classList.add('dirty');
        section.querySelector('.cont-dirty-dot').style.display = 'inline-block';
      }
      const prevImg = document.querySelector(`[data-preview-for="${inp.id}"]`);
      if (prevImg) { prevImg.src = inp.value; prevImg.classList.toggle('show', !!inp.value); }
    });
  });
  sectionsEl.querySelectorAll('[data-fcheckbox]').forEach(inp => {
    inp.addEventListener('change', () => {
      const section = inp.closest('.cont-section');
      if (section) {
        section.classList.add('dirty');
        section.querySelector('.cont-dirty-dot').style.display = 'inline-block';
      }
    });
  });
  loadingEl.style.display = 'none';
  sectionsEl.style.display = 'block';
  sectionsEl.querySelectorAll('.cont-section').forEach(sectionEl => {
    const sectionId = sectionEl.dataset.section;
    const scopeId = `content:${pageId}:${sectionId}`;
    window.AdminUnsaved?.register(scopeId, {
      root: sectionEl,
      active: () => contCurrentPage === pageId && document.getElementById('section-contenido')?.classList.contains('active'),
      label: `Contenido · ${pageSchema?.label || pageId} · ${sectionId}`,
      save: async () => {
        const button = sectionEl.querySelector('.cont-section-actions .adm-btn-primary');
        return button ? window.contSaveSectionBtn(button, pageId, sectionId) : false;
      },
    });
  });
}

window.contUploadImage = async function(fileInput, inputId) {
  const file = fileInput.files[0];
  if (!file) return;
  const apiKey = localStorage.getItem('tt_imgbb_key');
  if (!apiKey) {
    const banner = document.getElementById('imgbb-banner');
    banner.style.display = 'flex';
    banner.scrollIntoView({ behavior:'smooth', block:'center' });
    toast('Primero ingresá tu API key de ImgBB (ver banner amarillo)');
    return;
  }
  const uid = inputId + '-upload';
  const progressWrap = document.getElementById(uid+'-progress');
  const bar = document.getElementById(uid+'-bar');
  const pct = document.getElementById(uid+'-pct');
  const urlInput = document.getElementById(inputId);
  const preview  = document.getElementById(uid+'-preview');
  progressWrap.style.display = 'flex'; bar.style.width='10%'; pct.textContent='Leyendo…';
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    bar.style.width='30%'; pct.textContent='Subiendo…';
    const form = new FormData();
    form.append('key', apiKey);
    form.append('image', base64);
    form.append('name', file.name.replace(/[^a-zA-Z0-9._-]/g,'_'));
    const res = await fetch('https://api.imgbb.com/1/upload', { method:'POST', body:form });
    bar.style.width='85%';
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message ?? 'ImgBB rechazó la imagen');
    const url = json.data.url;
    bar.style.width='100%'; pct.textContent='100%';
    urlInput.value = url;
    if (preview) { preview.src=url; preview.classList.add('show'); }
    urlInput.dispatchEvent(new Event('input'));
    setTimeout(() => { progressWrap.style.display='none'; }, 700);
    toast('Imagen subida correctamente');
  } catch(err) {
    progressWrap.style.display='none';
    let msg = err.message ?? String(err);
    if (msg.includes('Failed to fetch')) msg = 'Sin conexión o API key inválida.';
    toast('Error al subir: ' + msg);
  }
};

window.contToggleSection = function(head) {
  head.classList.toggle('open');
  head.nextElementSibling.classList.toggle('open');
};

window.contSaveSectionBtn = async function(btn, pageId, sectionId) {
  // Contenido guarda texto y checkboxes de sección (ej. "mostrar banner") con
  // la MISMA función — el código no separa "editar textos" de "activar/
  // desactivar secciones" en dos acciones distintas, así que el gate cubre
  // ambos permisos del catálogo (con cualquiera de los dos habilitado alcanza).
  if (!can(currentRole, 'manageContent') || !(roleCanDo('contenido', 'editarTextos') || roleCanDo('contenido', 'activarDesactivarSecciones'))) {
    toast('No tenés permiso para editar contenido');
    return;
  }
  const sectionEl = btn.closest('.cont-section');
  const schema = CONT_SCHEMA[pageId]?.sections?.[sectionId] || contExtraPages.find(p=>p.id===pageId)?.sections?.[sectionId];
  if (!schema) return;
  const flist = Array.isArray(schema.fields) ? schema.fields : Object.values(schema.fields ?? {});
  const data = {};
  flist.forEach(field => {
    const fieldEl = sectionEl.querySelector(`.cont-field[data-fkey="${field.key}"]`);
    if (!fieldEl) return;
    data[field.key] = contExtractFieldValue(fieldEl, field);
  });
  btn.textContent='⏳ Guardando...'; btn.disabled=true;
  const ok = await contSaveSection(pageId, sectionId, data);
  btn.disabled=false; btn.textContent='Guardar sección';
  if (ok) {
    sectionEl.classList.remove('dirty'); sectionEl.classList.add('saved');
    sectionEl.querySelector('.cont-dirty-dot').style.display='none';
    setTimeout(()=>sectionEl.classList.remove('saved'), 2000);
    window.AdminUnsaved?.markClean(`content:${pageId}:${sectionId}`);
    toast('Sección guardada — los cambios ya son visibles en el sitio');
  } else {
    toast('Error al guardar la sección');
  }
  return Boolean(ok);
};

window.contRestoreSection = function(btn, pageId, sectionId) {
  if (!confirm('¿Restaurar los valores por defecto de esta sección? Se perderán los cambios no guardados.')) return;
  const sectionEl = btn.closest('.cont-section');
  const schema = CONT_SCHEMA[pageId]?.sections?.[sectionId];
  if (!schema) return;
  const flist = Array.isArray(schema.fields) ? schema.fields : Object.values(schema.fields ?? {});
  flist.forEach(field => {
    if (field.type === 'array') return;
    const inp = sectionEl.querySelector(`[data-fkey="${field.key}"]`);
    if (inp && (inp.tagName==='INPUT'||inp.tagName==='TEXTAREA')) {
      inp.value = field.def ?? '';
      inp.dispatchEvent(new Event('input'));
    }
  });
};

document.addEventListener('click', async e => {
  if (e.target && e.target.id === 'cont-save-all') {
    const pageId = contCurrentPage;
    const schema = CONT_SCHEMA[pageId];
    if (!schema) return;
    e.target.textContent='⏳ Guardando...'; e.target.disabled=true;
    let saved=0;
    for (const [sectionId] of Object.entries(schema.sections)) {
      const btn = document.querySelector(`.cont-section[data-section="${sectionId}"] .cont-section-actions button`);
      if (btn) { await contSaveSectionBtn(btn, pageId, sectionId); saved++; }
    }
    e.target.textContent='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:5px;vertical-align:-2px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar todo'; e.target.disabled=false;
    toast(`${saved} secciones guardadas`);
  }
});

async function contRenderTabs() {
  const tabsEl = document.getElementById('cont-page-tabs');
  try {
    const snap = await getDoc(doc(db,'site_content','_registry'));
    if (snap.exists() && snap.data().extraPages) contExtraPages = snap.data().extraPages;
  } catch(e) {}
  const allPages = [
    ...Object.entries(CONT_SCHEMA).map(([id,s])=>({ id, label:s.label })),
    ...contExtraPages.map(p=>({ id:p.id, label:p.label })),
  ];
  tabsEl.innerHTML = allPages.map(p => `
    <button type="button" class="cont-page-tab ${p.id===contCurrentPage?'active':''}" data-pageid="${p.id}" onclick="contSwitchPage('${p.id}')">${p.label}</button>
  `).join('');
}

window.contSwitchPage = async function(pageId) {
  const switchNow = async () => {
    contCurrentPage = pageId;
    document.querySelectorAll('.cont-page-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.pageid === pageId);
    });
    await contRenderPage(pageId);
  };
  const currentScopes = window.AdminUnsaved?.dirtyScopes().filter(id => id.startsWith(`content:${contCurrentPage}:`)) || [];
  if (currentScopes.length) {
    window.AdminUnsaved.requestNavigation(switchNow, { scopeIds: currentScopes });
  } else {
    await switchNow();
  }
};

document.addEventListener('click', async e => {
  if (e.target && e.target.id === 'cont-add-page') {
    const label = prompt('Nombre de la nueva página (ej: Blog, Contacto):');
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-');
    const url = prompt(`URL del archivo HTML (ej: ${id}.html):`, `${id}.html`) || `${id}.html`;
    contExtraPages.push({
      id, label:label, url,
      sections: { general: { label:'Contenido general', icon:'page', fields:[
        { key:'image1', label:'Imagen 1', type:'image', def:'' },
        { key:'image2', label:'Imagen 2', type:'image', def:'' },
        { key:'title', label:'Título', type:'text', def:'' },
        { key:'desc', label:'Texto', type:'textarea', def:'' },
      ]}}
    });
    try {
      await setDoc(doc(db,'site_content','_registry'), { extraPages:contExtraPages }, { merge:true });
      toast(`Página "${label}" agregada`);
      await contRenderTabs();
      await contSwitchPage(id);
    } catch(e) {
      toast('Error al guardar la página: '+e.message);
    }
  }
});

async function loadContenido() {
  if (!_contenidoInited) {
    _contenidoInited = true;
    contCurrentPage = 'index';
    contSavedData = {};
    const banner = document.getElementById('imgbb-banner');
    if (banner) {
      const hasKey = !!localStorage.getItem('tt_imgbb_key');
      banner.style.display = hasKey ? 'none' : 'flex';
    }
  }
  await contRenderTabs();
  await contRenderPage(contCurrentPage);
}

// Deep link from the public site's "✏️ editar" badge (js/edit-badge.js):
// admin.html?tab=contenido&page=<id>&section=<id> — jumps straight to that
// page/section in Contenido and highlights it.
async function handleContentDeepLink() {
  const params = new URLSearchParams(location.search);
  if (params.get('tab') !== 'contenido') return;
  const targetPage = params.get('page');
  const targetSection = params.get('section');
  switchSection('contenido');
  if (!targetPage) return;
  await loadContenido();
  if (targetPage !== contCurrentPage) await contSwitchPage(targetPage);
  if (!targetSection) return;
  const el = document.querySelector(`.cont-section[data-section="${targetSection}"]`);
  if (!el) return;
  const head = el.querySelector('.cont-section-head');
  const body = el.querySelector('.cont-section-body');
  if (head && body && !body.classList.contains('open')) { head.classList.add('open'); body.classList.add('open'); }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('cont-section-highlight');
  setTimeout(() => el.classList.remove('cont-section-highlight'), 2200);
}


// ══════════════════════════════════════════════
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

window.openOrderEdit = function(orderId) {
  const o = allOrders.find(x => x.id === orderId);
  if (!o) return;
  _editingOrder = JSON.parse(JSON.stringify(o)); // deep copy

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
      (oeMapLoc.name ? `<strong>${oeMapLoc.name}</strong><br>` : '') +
      `<a href="${mapUrl}" target="_blank" rel="noopener">Ver en Google Maps →</a>`;
  } else {
    oeMapWrap.style.display = 'none';
  }
  document.getElementById('oe-ship-method').value = o.shipping?.method || o.shippingMethod || 'delivery';
  document.getElementById('oe-pay-method').value = o.payment?.method || o.paymentMethod || 'efectivo';
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
  window.AdminUnsaved?.unregister('order-editor');
};

function renderOeItems() {
  const items = _editingOrder?.items || [];
  const el = document.getElementById('oe-items');
  const fmt = n => 'Gs. ' + Math.round(n).toLocaleString('es-PY');
  el.innerHTML = items.map((it, idx) => `
    <div style="display:flex;align-items:center;gap:10px;background:var(--adm-bg);border-radius:8px;padding:8px 12px" id="oe-item-${idx}">
      ${(it.imgUrl||it.imageUrl) ? `<img src="${it.imgUrl||it.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">` : `<div style="width:40px;height:40px;background:#fce4ec;border-radius:6px;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8a0b4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`}
      <div style="flex:1;font-size:13px;font-weight:600">${it.name||'—'}${it.variant ? `<div style="font-size:11px;font-weight:400;color:var(--adm-muted)">${it.variant}</div>` : ''}</div>
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
    await updateDoc(doc(db, 'orders', orderId), updateData);
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
      <span style="font-weight:700;color:${ok ? 'var(--admin-color-success-text)' : 'var(--admin-color-error-text)'}">${ratio ? ratio.toFixed(2) : '?'}:1 ${ok ? '✓' : `✗ (mín ${min}:1)`}</span>
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
