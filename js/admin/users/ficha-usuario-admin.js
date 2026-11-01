import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20261030-home-history-5';
import { ordersForView, orderDisplayCode } from '../../orders/pedidos-prueba.mjs?v=tintin-20261020-orders-clean-2';
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

import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20261022-avatar-inicial-1';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { SUPER_ADMIN, ROLE_LABELS } from '../../core/auth/roles.js?v=tintin-20261017-domain-cutover-1';
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
    return ordersForView(snap.docs.map(item => ({ id: item.id, ...item.data() })), window.TintinAdminOrders?.includesTestOrders?.())
      .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
  }

  async function loadAudit(uid) {
    const snap = await getDocs(query(collection(db, 'auditLog'), where('targetId', '==', uid), limit(50)));
    return snap.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)))
      .slice(0, 10);
  }

  let requestVersion = 0;
  function profilePhoto(user, large = false) {
    const initials = text(user.name || user.email || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const avatar = el('span', large ? 'ficha-avatar ficha-avatar-large' : 'ficha-avatar', initials || '?');
    const url = sanitizeImageUrl(user.photoURL || '');
    if (url) {
      const img = el('img');
      img.alt = `Foto de ${user.name || 'usuario'}`;
      img.src = url;
      img.addEventListener('error', () => avatar.replaceChildren(document.createTextNode(initials || '?')), { once: true });
      avatar.replaceChildren(img);
    }
    return avatar;
  }
  function openPhoto(user) {
    const dialog = el('dialog', 'ficha-photo-dialog');
    dialog.setAttribute('aria-label', `Foto de perfil de ${user.name || 'usuario'}`);
    const close = el('button', 'adm-btn', '× Cerrar');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    dialog.append(close, profilePhoto(user, true), el('p', '', user.name || user.email || 'Usuario sin foto'));
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }

  async function openClientFicha(uid) {
    const overlay = document.getElementById('client-ficha-overlay');
    const body = document.getElementById('client-ficha-body');
    if (!overlay || !body) return false;
    if (!auth.currentUser || lower(auth.currentUser.email) !== SUPER_ADMIN) return false;
    const ownerUid = auth.currentUser.uid;
    const version = ++requestVersion;
    delete body.dataset.ttEnhanced;

    body.replaceChildren(el('div', 'adm-loading', 'Cargando ficha…'));
    overlay.style.display = 'block';

    try {
      let user = await loadUser(uid);
      const [ordersResult, auditResult] = await Promise.allSettled([loadOrders(uid), loadAudit(uid)]);
      const orders = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
      // Las cifras de la ficha siguen la fuente completa del panel, no cachés históricas del perfil.
      if(window.TintinAdminOrders?.ready?.()) {
        const {calculateOrderStats}=await import('../../core/store/estadisticas-pedidos.js?v=tintin-20261020-orders-clean-2');
        let snapshot;const stop=window.TintinAdminOrders.subscribe(value=>{snapshot=value;});stop();
        const accountOrders=(snapshot?.orders||[]).filter(order=>order.userId===uid || (user.email && String(order.userEmail||'').toLowerCase()===String(user.email).toLowerCase()));
        user={...user,...calculateOrderStats(accountOrders,{includeTestOrders:snapshot?.includeTestOrders===true})};
      }
      const logs = auditResult.status === 'fulfilled' ? auditResult.value : [];
      if (auth.currentUser?.uid !== ownerUid || version !== requestVersion) return false;

      const header = el('div', 'ficha-profile');
      const photo = el('button', 'ficha-photo-button');
      photo.type = 'button';
      photo.setAttribute('aria-label', 'Ampliar foto de perfil');
      photo.append(profilePhoto(user));
      photo.addEventListener('click', () => openPhoto(user));
      const summary = el('div');
      summary.append(el('h2', '', user.name || user.email || 'Usuario'), el('p', '', ROLE_LABELS[canonicalRole(user)] || canonicalRole(user)), el('span', `adm-badge ${user.blocked || user.deleted || user.profileStatus === 'deleted' ? 'badge-cancelado' : 'badge-entregado'}`, user.deleted || user.profileStatus === 'deleted' ? 'Eliminado' : user.blocked ? 'Bloqueado' : 'Activo'));
      header.append(photo, summary);
      const identity = section('Identidad');
      identity.grid.append(
        field('Nombre', user.name),
        field('@username', user.username || user.userName ? `@${user.username || user.userName}` : ''),
        field('Customer ID', user.customerId || `CUS_${user.uid}`),
        field('UID', user.uid),
        field('Rol', ROLE_LABELS[canonicalRole(user)] || canonicalRole(user)),
        field('Cuenta creada', formatDate(user.createdAt)),
        field('Estado de perfil', user.profileStatus || '—'),
      );

      const contact = section('Contacto');
      const savedLocation = user.savedLocation || {};
      contact.grid.append(
        field('Email', user.email),
        field('Teléfono', user.phone || user.phoneNumber || user.whatsapp || user.whatsappNumber),
        field('Cédula', user.checkoutDefaults?.ci || user.ci),
        field('Ubicación', user.address || savedLocation.address || savedLocation.name || user.locationName),
        field('Coordenadas', Number.isFinite(Number(savedLocation.lat)) && Number.isFinite(Number(savedLocation.lng))
          ? `${Number(savedLocation.lat).toFixed(6)}, ${Number(savedLocation.lng).toFixed(6)}` : ''),
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
          el('span', '', `#${orderDisplayCode(order)} · ${formatDate(order.createdAt)}`),
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

      body.replaceChildren(header, identity.wrapper, contact.wrapper, commercial.wrapper, ordersSection.wrapper, security.wrapper, auditSection.wrapper);
      return true;
    } catch (error) {
      if (version !== requestVersion) return false;
      showError(error?.message || 'No se pudo cargar la ficha de la cuenta.');
      return false;
    }
  }

  function closeClientFicha() {
    const overlay = document.getElementById('client-ficha-overlay');
    ++requestVersion;
    if (overlay) overlay.style.display = 'none';
    document.querySelector('.ficha-photo-dialog')?.close();
  }

  let rowSequence = 0;

  function enhanceRows() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody || !auth.currentUser || lower(auth.currentUser.email) !== SUPER_ADMIN) return;
    tbody.querySelectorAll('tr').forEach(row => {
      const uid = row.dataset.userUid || row.querySelector('.user-row-check[data-id]')?.dataset.id;
      if (!uid) return;
      if (!row.dataset.fichaReady) {
        row.dataset.fichaReady = 'true';
        row.tabIndex = 0;
        row.setAttribute('aria-label', 'Abrir ficha de usuario');
        row.style.cursor = 'pointer';
        row.addEventListener('click', event => {
          if (!event.target.closest('button,input,select,textarea,a,label')) openClientFicha(uid);
        });
        row.addEventListener('keydown', event => {
          if (event.target === row && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openClientFicha(uid); }
        });
      }
      const actionsCell = row.lastElementChild;
      if (!actionsCell || actionsCell.querySelector('[data-user-ficha]')) return;
      const name = row.cells[2]?.querySelector('strong');
      if (name) {
        const link = el('button', 'tt-admin-user-name', name.textContent);
        link.type = 'button';
        link.addEventListener('click', () => openClientFicha(uid));
        name.replaceWith(link);
      }
      const button = el('button', 'adm-btn adm-btn-sm adm-btn-outline tt-admin-user-open', 'Ver ficha');
      button.type = 'button';
      button.dataset.userFicha = uid;
      button.addEventListener('click', () => openClientFicha(uid));
      const actionsWrap = actionsCell.querySelector('div') || actionsCell;
      const originalActions = [...actionsCell.querySelectorAll('button')];
      actionsWrap.prepend(button);
      row.classList.add('tt-admin-user-card');

      const menu = el('div', 'tt-admin-user-menu');
      const toggle = el('button', 'adm-btn adm-btn-sm adm-btn-outline tt-admin-user-menu-toggle', '⋯');
      toggle.type = 'button';
      toggle.setAttribute('aria-label', 'Acciones del usuario');
      toggle.setAttribute('aria-expanded', 'false');
      const panel = el('div', 'tt-admin-user-menu-panel');
      panel.id = `tt-user-actions-${++rowSequence}`;
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-label', 'Información y acciones del usuario');
      toggle.setAttribute('aria-controls', panel.id);
      function closeMenu(restoreFocus = false) {
        menu.dataset.open = 'false';
        toggle.setAttribute('aria-expanded', 'false');
        if (restoreFocus) toggle.focus({preventScroll:true});
      }
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        menu.dataset.open = String(expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      menu.addEventListener('keydown', event => {
        if (event.key === 'Escape' && menu.dataset.open === 'true') {
          event.preventDefault(); event.stopPropagation(); closeMenu(true);
        }
      });
      for (const action of originalActions) {
        action.classList.add('tt-admin-user-secondary-action');
        panel.append(action);
      }
      const details = el('button', 'adm-btn adm-btn-sm adm-btn-outline tt-admin-user-details', 'Mostrar más datos');
      details.type = 'button';
      details.setAttribute('aria-expanded', 'false');
      const extraCells = [row.cells[4], row.cells[7], row.cells[8]].filter(Boolean);
      for (const cell of extraCells) cell.id ||= `tt-user-extra-${++rowSequence}`;
      details.setAttribute('aria-controls', extraCells.map(cell => cell.id).join(' '));
      details.addEventListener('click', () => {
        const expanded = details.getAttribute('aria-expanded') !== 'true';
        details.setAttribute('aria-expanded', String(expanded));
        details.textContent = expanded ? 'Ocultar datos adicionales' : 'Mostrar más datos';
        row.dataset.extra = String(expanded);
        closeMenu(true);
      });
      panel.append(details);
      menu.append(toggle, panel);
      actionsWrap.append(menu);
    });
  }

  document.addEventListener('click', event => {
    for (const menu of document.querySelectorAll('.tt-admin-user-menu[data-open="true"]')) {
      if (menu.contains(event.target)) continue;
      menu.dataset.open = 'false';
      menu.querySelector('.tt-admin-user-menu-toggle')?.setAttribute('aria-expanded', 'false');
    }
  });

  function injectStyles() {
    if (document.getElementById('user-ficha-styles')) return;
    const style = document.createElement('style');
    style.id = 'user-ficha-styles';
    style.textContent = `
      #client-ficha-overlay{overscroll-behavior:contain}
      #client-ficha-overlay > div > div:first-child{position:sticky;top:-24px;background:var(--adm-card);z-index:1}
      #client-ficha-overlay .adm-icon-close{min-width:44px;min-height:44px}
      .ficha-profile{display:flex;align-items:center;gap:18px;flex-wrap:wrap;overflow-wrap:anywhere}
      .ficha-profile h2{margin:0;font-size:20px}
      .ficha-photo-button{border:0;background:none;padding:0;cursor:zoom-in;border-radius:50%}
      .ficha-avatar{display:flex;align-items:center;justify-content:center;width:96px;height:96px;border-radius:50%;background:var(--admin-color-background-sidebar-active);color:var(--adm-text);font-size:32px;font-weight:800;overflow:hidden}
      .ficha-avatar img{width:100%;height:100%;object-fit:cover}
      .ficha-photo-dialog{width:min(90vw,720px);max-height:90dvh;box-sizing:border-box;border:0;border-radius:18px;padding:16px;overflow:auto;background:var(--adm-card);color:var(--adm-text);text-align:center;overflow-wrap:anywhere}
      .ficha-photo-dialog::backdrop{background:rgba(0,0,0,.75)}
      .ficha-photo-dialog > button{display:block;margin:0 0 16px auto;min-height:44px}
      .ficha-avatar-large{width:100%;height:min(60dvh,620px);border-radius:12px;font-size:clamp(64px,20vw,180px)}
      .ficha-avatar-large img{object-fit:contain}
      .ficha-section-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--adm-primary);margin-bottom:10px}
      .ficha-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .ficha-field-label{font-size:11px;color:var(--adm-muted);margin-bottom:2px}
      .ficha-field-value{font-size:13px;color:var(--adm-text);font-weight:600;word-break:break-word}
      .ficha-orders-list{margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .ficha-order-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--adm-text);padding:8px 10px;background:var(--adm-bg);border-radius:8px}
      @media(max-width:640px){.ficha-grid{grid-template-columns:1fr}.ficha-order-row{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function bootForSuperAdmin(user) {
    if (!user || lower(user.email) !== SUPER_ADMIN) return;
    injectStyles();
    const overlay = document.getElementById('client-ficha-overlay');
    if (overlay && !overlay.dataset.dismissReady) {
      overlay.dataset.dismissReady = 'true';
      overlay.querySelector('.adm-icon-close')?.addEventListener('click', closeClientFicha);
      overlay.addEventListener('click', event => { if (event.target === overlay) closeClientFicha(); });
    }
    enhanceRows();
    const tbody = document.getElementById('users-tbody');
    if (tbody) new MutationObserver(enhanceRows).observe(tbody, { childList: true, subtree: true });
  }

  window.openClientFichaByUid = openClientFicha;
  window.dispatchEvent(new Event('tintin:admin-ficha-source'));
  window.closeClientFicha = closeClientFicha;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => subscribeAuthState(bootForSuperAdmin), { once: true });
  } else {
    subscribeAuthState(bootForSuperAdmin);
  }
}
