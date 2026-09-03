/* =============================================================
   TINTIN — Ficha de usuario (helper de solo lectura)

   La autoridad de Usuarios vive en js/admin/admin-app.js:
   - único listener en tiempo real de users
   - filtros, roles, bloqueo/restauración, eliminación y acciones masivas
   - estado compartido con Dashboard / Estadísticas / Correos

   Este módulo NO mantiene un segundo listener y NO escribe users. Solo agrega
   "Ver ficha" a las filas ya renderizadas por admin-app.js y carga el detalle
   solicitado bajo demanda.
   ============================================================= */

import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { SUPER_ADMIN, ROLE_LABELS } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { ASSIGNABLE_ROLES } from '../../core/auth/contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';

if (!window.TintinAdminUserFichaBooted) {
  window.TintinAdminUserFichaBooted = true;

  const text = value => String(value == null ? '' : value);
  const lower = value => text(value).toLocaleLowerCase('es');
  const canonicalRole = user => lower(user?.email) === SUPER_ADMIN
    ? 'superadmin'
    : (ASSIGNABLE_ROLES.includes(user?.role) ? user.role : 'client');

  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = value;
    return node;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
  }

  function formatPrice(value) {
    return `Gs. ${(Number(value) || 0).toLocaleString('es-PY')}`;
  }

  function field(label, value) {
    const wrap = el('div', 'ficha-field');
    wrap.append(el('div', 'ficha-field-label', label), el('div', 'ficha-field-value', value || '—'));
    return wrap;
  }

  function section(title) {
    const wrapper = el('div', 'ficha-section');
    wrapper.appendChild(el('div', 'ficha-section-title', title));
    const grid = el('div', 'ficha-grid');
    wrapper.appendChild(grid);
    return { wrapper, grid };
  }

  function showError(message) {
    const body = document.getElementById('client-ficha-body');
    if (!body) return;
    body.replaceChildren(el('div', 'adm-empty', message));
  }

  async function loadUser(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) throw new Error('La ficha de esta cuenta ya no existe.');
    return { uid: snap.id, ...snap.data() };
  }

  async function loadOrders(uid) {
    const snap = await getDocs(query(collection(db, 'orders'), where('userId', '==', uid), limit(100)));
    return snap.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
  }

  async function loadAudit(uid) {
    const snap = await getDocs(query(collection(db, 'auditLog'), where('targetId', '==', uid), limit(50)));
    return snap.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)))
      .slice(0, 10);
  }

  async function openClientFicha(uid) {
    const overlay = document.getElementById('client-ficha-overlay');
    const body = document.getElementById('client-ficha-body');
    if (!overlay || !body) return;
    if (!auth.currentUser || lower(auth.currentUser.email) !== SUPER_ADMIN) return;

    body.replaceChildren(el('div', 'adm-loading', 'Cargando ficha…'));
    overlay.style.display = 'block';

    try {
      const user = await loadUser(uid);
      const [ordersResult, auditResult] = await Promise.allSettled([loadOrders(uid), loadAudit(uid)]);
      const orders = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
      const logs = auditResult.status === 'fulfilled' ? auditResult.value : [];

      const identity = section('Identidad');
      identity.grid.append(
        field('Nombre', user.name),
        field('@username', user.username ? `@${user.username}` : ''),
        field('Customer ID', user.customerId || `CUS_${user.uid}`),
        field('UID', user.uid),
        field('Rol', ROLE_LABELS[canonicalRole(user)] || canonicalRole(user)),
        field('Cuenta creada', formatDate(user.createdAt)),
        field('Estado de perfil', user.profileStatus || '—'),
      );

      const contact = section('Contacto');
      contact.grid.append(
        field('Email', user.email),
        field('Teléfono', user.phone),
        field('Cédula', user.checkoutDefaults?.ci || user.ci),
        field('Ubicación', user.address || user.savedLocation?.name),
        field('Fecha de nacimiento', user.dob),
      );

      const commercial = section('Comercial');
      commercial.grid.append(
        field('Total gastado', formatPrice(user.totalSpent)),
        field('Compras registradas', String(user.purchaseCount || 0)),
      );
      if (text(user.internalNotes)) {
        const notes = el('div', 'ficha-field');
        notes.append(el('div', 'ficha-field-label', 'Notas internas'), el('div', 'ficha-field-value', user.internalNotes));
        commercial.wrapper.appendChild(notes);
      }

      const security = section('Seguridad y acceso');
      security.grid.append(
        field('Estado', user.blocked ? `Bloqueado (${user.blockReason || 'sin motivo'})` : 'Activo'),
        field('Cambio de @username usado', user.usernameChangedAt ? 'Sí' : 'No'),
        field('Última actividad', formatDate(user.lastLogin)),
        field('Rol anterior', user.roleBeforeBlock ? (ROLE_LABELS[user.roleBeforeBlock] || user.roleBeforeBlock) : '—'),
      );

      const completed = new Set(['entregado']);
      const cancelled = new Set(['cancelado', 'rechazado']);
      const pendingCount = orders.filter(order => !completed.has(order.status) && !cancelled.has(order.status)).length;
      const completedCount = orders.filter(order => completed.has(order.status)).length;
      const cancelledCount = orders.filter(order => cancelled.has(order.status)).length;
      const lastCi = orders.find(order => order.ci)?.ci;

      const ordersSection = section(`Pedidos (${orders.length})`);
      ordersSection.grid.append(
        field('Pendientes', String(pendingCount)),
        field('Completados', String(completedCount)),
        field('Cancelados', String(cancelledCount)),
        field('Cédula (última encomienda)', lastCi),
      );
      const ordersList = el('div', 'ficha-orders-list');
      orders.slice(0, 10).forEach(order => {
        const row = el('div', 'ficha-order-row');
        row.append(
          el('span', '', `#${text(order.id).slice(-6).toUpperCase()} · ${formatDate(order.createdAt)}`),
          el('span', 'adm-badge', order.status || 'Pendiente'),
          el('span', '', formatPrice(order.total)),
        );
        ordersList.appendChild(row);
      });
      if (!orders.length) ordersList.appendChild(el('div', '', ordersResult.status === 'rejected' ? 'Pedidos no disponibles' : 'Sin pedidos registrados'));
      ordersSection.wrapper.appendChild(ordersList);

      const auditSection = section('Auditoría reciente');
      const auditList = el('div', 'ficha-orders-list');
      logs.forEach(log => {
        const row = el('div', 'ficha-order-row');
        row.append(
          el('span', '', formatDate(log.createdAt)),
          el('span', '', log.action || '—'),
          el('span', '', log.details || '—'),
        );
        auditList.appendChild(row);
      });
      if (!logs.length) auditList.appendChild(el('div', '', auditResult.status === 'rejected' ? 'Auditoría no disponible' : 'Sin acciones registradas sobre esta cuenta'));
      auditSection.wrapper.appendChild(auditList);

      body.replaceChildren(identity.wrapper, contact.wrapper, commercial.wrapper, ordersSection.wrapper, security.wrapper, auditSection.wrapper);
    } catch (error) {
      showError(error?.message || 'No se pudo cargar la ficha de la cuenta.');
    }
  }

  function closeClientFicha() {
    const overlay = document.getElementById('client-ficha-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function enhanceRows() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody || !auth.currentUser || lower(auth.currentUser.email) !== SUPER_ADMIN) return;
    tbody.querySelectorAll('tr').forEach(row => {
      const uid = row.querySelector('.user-row-check[data-id]')?.dataset.id;
      if (!uid) return;
      const actionsCell = row.lastElementChild;
      if (!actionsCell || actionsCell.querySelector('[data-user-ficha]')) return;
      const button = el('button', 'adm-btn adm-btn-sm adm-btn-outline', 'Ver ficha');
      button.type = 'button';
      button.dataset.userFicha = uid;
      button.addEventListener('click', () => openClientFicha(uid));
      const actionsWrap = actionsCell.querySelector('div');
      if (actionsWrap) actionsWrap.prepend(button);
      else actionsCell.prepend(button);
    });
  }

  function injectStyles() {
    if (document.getElementById('user-ficha-styles')) return;
    const style = document.createElement('style');
    style.id = 'user-ficha-styles';
    style.textContent = `
      .ficha-section-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--adm-primary);margin-bottom:10px}
      .ficha-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .ficha-field-label{font-size:11px;color:#888;margin-bottom:2px}
      .ficha-field-value{font-size:13px;color:#222;font-weight:600;word-break:break-word}
      .ficha-orders-list{margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .ficha-order-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#444;padding:8px 10px;background:#f7f7f8;border-radius:8px}
      @media(max-width:640px){.ficha-grid{grid-template-columns:1fr}.ficha-order-row{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function bootForSuperAdmin(user) {
    if (!user || lower(user.email) !== SUPER_ADMIN) return;
    injectStyles();
    enhanceRows();
    const tbody = document.getElementById('users-tbody');
    if (tbody) new MutationObserver(enhanceRows).observe(tbody, { childList: true, subtree: true });
  }

  window.openClientFichaByUid = openClientFicha;
  window.closeClientFicha = closeClientFicha;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => onAuthStateChanged(auth, bootForSuperAdmin), { once: true });
  } else {
    onAuthStateChanged(auth, bootForSuperAdmin);
  }
}
