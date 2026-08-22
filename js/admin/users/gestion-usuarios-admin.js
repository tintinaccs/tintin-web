/* =============================================================
   TINTIN — Fase 8: usuarios, auditoría y permisos

   Reemplaza únicamente las tablas de Usuarios y Auditoría del panel.
   - render seguro con nodos DOM (sin innerHTML con datos de clientas)
   - Super Admin protegido por email oficial
   - roles canónicos
   - cambios de usuario + registro de auditoría en el mismo batch
   - listeners en tiempo real
   ============================================================= */

import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { SUPER_ADMIN, ROLE_LABELS } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { ASSIGNABLE_ROLES } from '../../core/auth/contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';

if (!window.TintinAdminUsersPhase8Booted) {
  window.TintinAdminUsersPhase8Booted = true;

  const ALLOWED_ROLES = ASSIGNABLE_ROLES;
  const state = {
    user: null,
    users: [],
    logs: [],
    tab: 'active',
    selected: new Set(),
    search: '',
    stopUsers: null,
    stopLogs: null,
    profileRequest: 0,
  };

  const text = value => String(value == null ? '' : value);
  const lower = value => text(value).toLocaleLowerCase('es');
  const isSuperRecord = record => lower(record?.email) === SUPER_ADMIN;
  const canonicalRole = record => isSuperRecord(record)
    ? 'superadmin'
    : (ALLOWED_ROLES.includes(record?.role) ? record.role : 'client');

  function el(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = value;
    return node;
  }

  function toast(message, error = false) {
    const existing = document.getElementById('adm-toast');
    if (!existing) return;
    existing.textContent = message;
    existing.classList.toggle('phase8-error', error);
    existing.classList.add('show');
    clearTimeout(existing._phase8Timer);
    existing._phase8Timer = setTimeout(() => existing.classList.remove('show'), 3200);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-PY', {
      dateStyle: 'short', timeStyle: 'medium'
    }).format(date);
  }

  function timeValue(value) {
    if (!value) return 0;
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function formatMoney(value) {
    return `Gs. ${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('es-PY')}`;
  }

  function displayLocation(user) {
    const direct = text(user?.address || '').trim();
    if (direct) return direct;
    const location = user?.savedLocation;
    if (typeof location === 'string' && location.trim()) return location.trim();
    if (location && typeof location === 'object') {
      return text(location.address || location.name || location.label || '').trim() || '—';
    }
    return '—';
  }

  function auditPayload(action, target, details = '', meta = {}) {
    return {
      action,
      targetType: 'usuario',
      targetId: target?.uid || '',
      targetLabel: target?.name || target?.email || '',
      details: text(details).slice(0, 1200),
      bulk: Boolean(meta.bulk),
      bulkCount: Number(meta.count || 0),
      actorEmail: state.user?.email || '',
      actorRole: 'superadmin',
      phase: 8,
      createdAt: serverTimestamp(),
    };
  }

  function ensureSuperAdmin() {
    return Boolean(state.user && lower(state.user.email) === SUPER_ADMIN);
  }

  async function commitUserAction(changes, audit) {
    if (!ensureSuperAdmin()) throw new Error('Solo Super Admin puede gestionar usuarios.');
    const batch = writeBatch(db);
    changes.forEach(change => {
      const ref = doc(db, 'users', change.uid);
      if (change.delete) batch.delete(ref);
      else batch.update(ref, change.data);
    });
    batch.set(doc(collection(db, 'auditLog')), audit);
    await batch.commit();
  }

  async function commitAccountStatus(user, action, reason = '') {
    if (!ensureSuperAdmin()) throw new Error('Solo Super Admin puede gestionar usuarios.');
    const token = await state.user.getIdToken();
    const response = await fetch('/api/admin-delete-user', {
      method: 'POST',
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, action, reason })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'No se pudo actualizar la cuenta.');
    return result;
  }

  function filteredUsers() {
    return state.users.filter(user => {
      const blocked = user.blocked === true;
      if (state.tab === 'blocked' ? !blocked : blocked) return false;
      if (!state.search) return true;
      return [user.name, user.email, user.phone, user.username, user.ci, user.customerId, user.uid]
        .some(value => lower(value).includes(state.search));
    });
  }

  function updateBulkBar() {
    const bar = document.getElementById('users-bulk-toolbar');
    const count = document.getElementById('users-bulk-count');
    if (count) count.textContent = `${state.selected.size} seleccionado${state.selected.size === 1 ? '' : 's'}`;
    if (bar) bar.classList.toggle('show', ensureSuperAdmin() && state.selected.size > 0);
    const block = document.getElementById('users-bulk-block-btn');
    const restore = document.getElementById('users-bulk-restore-btn');
    if (block) block.style.display = state.tab === 'blocked' ? 'none' : '';
    if (restore) restore.style.display = state.tab === 'blocked' ? '' : 'none';
  }

  function avatarFor(user) {
    const wrap = el('div', 'adm-tbl-avatar');
    const initial = (text(user.name || user.email || '?').trim()[0] || '?').toUpperCase();
    wrap.textContent = initial;
    return wrap;
  }

  function roleSelect(user) {
    if (isSuperRecord(user)) {
      return el('span', 'adm-badge role-superadmin', 'Super Admin');
    }
    if (!ensureSuperAdmin() || user.blocked) {
      return el('span', `adm-badge role-${canonicalRole(user)}`, ROLE_LABELS[canonicalRole(user)] || 'Cliente');
    }
    const select = el('select', 'adm-select phase8-role-select');
    select.setAttribute('aria-label', `Rol de ${user.name || user.email}`);
    ALLOWED_ROLES.forEach(role => {
      const option = el('option', '', ROLE_LABELS[role] || role);
      option.value = role;
      option.selected = canonicalRole(user) === role;
      select.appendChild(option);
    });
    select.addEventListener('change', async () => {
      const nextRole = select.value;
      const previous = canonicalRole(user);
      if (!ALLOWED_ROLES.includes(nextRole) || nextRole === previous) return;
      if (!confirm(`¿Cambiar a ${ROLE_LABELS[nextRole]} el rol de ${user.name || user.email}?`)) {
        select.value = previous;
        return;
      }
      select.disabled = true;
      try {
        await commitUserAction([
          { uid: user.uid, data: { role: nextRole, updatedAt: serverTimestamp() } }
        ], auditPayload('cambiar_rol', user, `Rol: ${ROLE_LABELS[previous]} → ${ROLE_LABELS[nextRole]}`));
        toast('Rol actualizado y auditado');
      } catch (error) {
        select.value = previous;
        toast(error.message || 'No se pudo cambiar el rol', true);
      } finally {
        select.disabled = false;
      }
    });
    return select;
  }

  function actionButton(label, className, handler) {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function ensureProfileDrawer() {
    let overlay = document.getElementById('phase8-user-profile-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'phase8-user-profile-overlay';
    overlay.className = 'phase8-user-profile-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'phase8-user-profile-title');

    const panel = document.createElement('section');
    panel.className = 'phase8-user-profile-panel';
    const head = el('div', 'phase8-user-profile-head');
    const title = el('div', '', 'Ficha completa del cliente');
    title.id = 'phase8-user-profile-title';
    const close = actionButton('Cerrar', 'adm-btn adm-btn-sm adm-btn-outline', closeUserProfile);
    head.append(title, close);
    const body = el('div', 'phase8-user-profile-body');
    body.id = 'phase8-user-profile-body';
    panel.append(head, body);
    overlay.appendChild(panel);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeUserProfile();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeUserProfile() {
    state.profileRequest += 1;
    const overlay = document.getElementById('phase8-user-profile-overlay');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove('phase8-profile-open');
  }

  function profileField(label, value, { mono = false } = {}) {
    const item = el('div', 'phase8-profile-field');
    item.appendChild(el('span', 'phase8-profile-field-label', label));
    const content = el('strong', mono ? 'phase8-profile-mono' : '', value || '—');
    item.appendChild(content);
    return item;
  }

  function orderLabel(order) {
    return text(order.orderNumber || order.shortId || order.id || '').trim() || 'Pedido';
  }

  async function loadUserOrders(user) {
    const queries = [
      query(collection(db, 'orders'), where('userId', '==', user.uid), limit(200)),
    ];
    if (user.customerId) {
      queries.push(query(collection(db, 'orders'), where('customerId', '==', user.customerId), limit(200)));
    }
    if (user.email) {
      // Compatibilidad únicamente para pedidos históricos previos al customerId.
      queries.push(query(collection(db, 'orders'), where('userEmail', '==', user.email), limit(200)));
    }
    const results = await Promise.all(queries.map(item => getDocs(item)));
    const merged = new Map();
    results.forEach(snapshot => snapshot.docs.forEach(item => merged.set(item.id, { id: item.id, ...item.data() })));
    return [...merged.values()].sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
  }

  function renderFullProfile(user, orders) {
    const body = document.getElementById('phase8-user-profile-body');
    if (!body) return;
    body.replaceChildren();

    const header = el('div', 'phase8-profile-hero');
    header.appendChild(avatarFor(user));
    const heroText = el('div');
    heroText.appendChild(el('h3', '', user.name || 'Sin nombre'));
    heroText.appendChild(el('p', '', user.username ? `@${user.username}` : 'Sin @username'));
    header.appendChild(heroText);
    header.appendChild(el('span', `adm-badge ${user.blocked ? 'badge-cancelado' : 'badge-entregado'}`, user.blocked ? 'Bloqueado' : 'Activo'));
    body.appendChild(header);

    const identity = el('section', 'phase8-profile-section');
    identity.appendChild(el('h4', '', 'Identidad'));
    const identityGrid = el('div', 'phase8-profile-grid');
    identityGrid.append(
      profileField('Customer ID', user.customerId || `CUS_${user.uid}`, { mono: true }),
      profileField('Firebase UID', user.uid, { mono: true }),
      profileField('@Username', user.username ? `@${user.username}` : 'Sin registrar'),
      profileField('Cédula', user.ci || 'Sin registrar'),
      profileField('Estado de perfil', user.profileStatus || 'legacy'),
      profileField('Versión de identidad', text(user.identityVersion || 1))
    );
    identity.appendChild(identityGrid);
    body.appendChild(identity);

    const contact = el('section', 'phase8-profile-section');
    contact.appendChild(el('h4', '', 'Contacto y ubicación'));
    const contactGrid = el('div', 'phase8-profile-grid');
    contactGrid.append(
      profileField('Email', user.email || '—'),
      profileField('Teléfono', user.phone || '—'),
      profileField('Ubicación / dirección', displayLocation(user)),
      profileField('Método de acceso', Array.isArray(user.authMethods) ? user.authMethods.join(', ') : (user.lastAuthMethod || user.provider || '—'))
    );
    contact.appendChild(contactGrid);
    body.appendChild(contact);

    const account = el('section', 'phase8-profile-section');
    account.appendChild(el('h4', '', 'Cuenta y seguridad'));
    const accountGrid = el('div', 'phase8-profile-grid');
    accountGrid.append(
      profileField('Rol', ROLE_LABELS[canonicalRole(user)] || canonicalRole(user)),
      profileField('Creada', formatDate(user.createdAt)),
      profileField('Último acceso', formatDate(user.lastLogin)),
      profileField('Última actualización', formatDate(user.updatedAt)),
      profileField('Cambio de @ usado', Number(user.usernameChangeCount || 0) >= 1 ? 'Sí' : 'No'),
      profileField('Bloqueo', user.blocked ? (user.blockReason || 'Bloqueada') : 'No')
    );
    account.appendChild(accountGrid);
    body.appendChild(account);

    const ordersSection = el('section', 'phase8-profile-section');
    ordersSection.appendChild(el('h4', '', 'Pedidos vinculados'));
    const completed = orders.filter(order => lower(order.status) === 'entregado').length;
    const cancelled = orders.filter(order => ['cancelado', 'rechazado'].includes(lower(order.status))).length;
    const pending = Math.max(0, orders.length - completed - cancelled);
    const total = orders.reduce((sum, order) => sum + Math.max(0, Number(order.total) || 0), 0);
    const summary = el('div', 'phase8-profile-order-summary');
    [
      ['Total', orders.length],
      ['Pendientes', pending],
      ['Completados', completed],
      ['Cancelados', cancelled],
      ['Importe histórico', formatMoney(total)],
    ].forEach(([label, value]) => {
      const card = el('div', 'phase8-profile-stat');
      card.append(el('span', '', label), el('strong', '', text(value)));
      summary.appendChild(card);
    });
    ordersSection.appendChild(summary);

    const list = el('div', 'phase8-profile-orders');
    if (!orders.length) {
      list.appendChild(el('p', 'phase8-profile-empty', 'No encontramos pedidos vinculados a esta identidad.'));
    } else {
      orders.slice(0, 30).forEach(order => {
        const row = el('div', 'phase8-profile-order');
        const main = el('div');
        main.appendChild(el('strong', '', orderLabel(order)));
        main.appendChild(el('span', '', `${formatDate(order.createdAt)} · ${text(order.status || 'pendiente')}`));
        const totalNode = el('strong', '', formatMoney(order.total));
        row.append(main, totalNode);
        list.appendChild(row);
      });
      if (orders.length > 30) list.appendChild(el('p', 'phase8-profile-empty', `Mostrando los 30 pedidos más recientes de ${orders.length}.`));
    }
    ordersSection.appendChild(list);
    body.appendChild(ordersSection);
  }

  async function openUserProfile(user) {
    if (!ensureSuperAdmin()) return toast('Solo Super Admin puede abrir la ficha completa.', true);
    const overlay = ensureProfileDrawer();
    const body = document.getElementById('phase8-user-profile-body');
    const requestId = ++state.profileRequest;
    overlay.hidden = false;
    document.body.classList.add('phase8-profile-open');
    if (body) {
      body.replaceChildren();
      body.appendChild(el('div', 'phase8-profile-loading', 'Cargando identidad y pedidos vinculados…'));
    }
    try {
      const orders = await loadUserOrders(user);
      if (requestId !== state.profileRequest) return;
      renderFullProfile(user, orders);
    } catch (error) {
      if (requestId !== state.profileRequest || !body) return;
      body.replaceChildren();
      body.appendChild(el('div', 'phase8-profile-error', `No se pudo cargar la ficha completa: ${text(error?.message || 'error desconocido')}`));
    }
  }

  async function blockOne(user) {
    if (isSuperRecord(user)) return toast('El Super Admin está protegido', true);
    const reason = prompt('Motivo del bloqueo (opcional):', '');
    if (reason === null) return;
    if (!confirm(`¿Bloquear a ${user.name || user.email}? Perderá el acceso operativo y no podrá comprar.`)) return;
    try {
      await commitUserAction([
        { uid: user.uid, data: {
          blocked: true,
          blockedAt: serverTimestamp(),
          blockedBy: state.user.email,
          blockReason: text(reason).slice(0, 500),
          roleBeforeBlock: canonicalRole(user),
          role: 'client',
          updatedAt: serverTimestamp(),
        } }
      ], auditPayload('bloquear_usuario', user, reason ? `Motivo: ${reason}` : 'Sin motivo especificado'));
      toast('Usuario bloqueado y auditado');
    } catch (error) {
      toast(error.message || 'No se pudo bloquear', true);
    }
  }

  async function restoreOne(user) {
    if (user.deleted === true || user.profileStatus === 'deleted') {
      if (!confirm(`¿Reactivar la identidad histórica de ${user.name || user.email} como Cliente?`)) return;
      try {
        await commitAccountStatus(user, 'reactivate', 'Reactivación desde Super Admin');
        toast('Cuenta reactivada y auditada');
      } catch (error) {
        toast(error.message || 'No se pudo reactivar', true);
      }
      return;
    }
    const restoredRole = ALLOWED_ROLES.includes(user.roleBeforeBlock) ? user.roleBeforeBlock : 'client';
    if (!confirm(`¿Restaurar a ${user.name || user.email} como ${ROLE_LABELS[restoredRole] || restoredRole}?`)) return;
    try {
      await commitUserAction([
        { uid: user.uid, data: {
          blocked: false,
          role: restoredRole,
          blockedAt: null,
          blockedBy: '',
          blockReason: '',
          roleBeforeBlock: '',
          updatedAt: serverTimestamp(),
        } }
      ], auditPayload('restaurar_usuario', user, `Rol anterior restaurado: ${ROLE_LABELS[restoredRole] || restoredRole}`));
      toast(`Usuario restaurado como ${ROLE_LABELS[restoredRole] || restoredRole}`);
    } catch (error) {
      toast(error.message || 'No se pudo restaurar', true);
    }
  }

  async function deleteOne(user) {
    if (isSuperRecord(user)) return toast('El perfil del Super Admin no se puede eliminar', true);
    const reason = prompt('Motivo de la eliminación (queda en auditoría):', '') ?? null;
    if (reason === null) return;
    if (!confirm(`¿Eliminar la cuenta de ${user.name || user.email}?\n\nSe revocará el acceso y se liberará el teléfono, pero se conservarán customerId, email, pedidos y auditoría como identidad histórica. Super Admin podrá reactivarla.`)) return;
    try {
      await commitAccountStatus(user, 'softDelete', reason);
      toast('Acceso revocado; identidad histórica conservada y auditada');
    } catch (error) {
      toast(error.message || 'No se pudo eliminar', true);
    }
  }

  function renderUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.replaceChildren();
    const users = filteredUsers();
    const blockedCount = state.users.filter(user => user.blocked === true).length;
    const badge = document.getElementById('users-blocked-count');
    if (badge) badge.textContent = blockedCount ? `(${blockedCount})` : '';

    if (!users.length) {
      const row = document.createElement('tr');
      const cell = el('td', '', state.tab === 'blocked' ? 'No hay usuarios bloqueados' : 'No hay usuarios activos');
      cell.colSpan = 7;
      cell.style.cssText = 'text-align:center;color:#888;padding:28px';
      row.appendChild(cell);
      tbody.appendChild(row);
      updateBulkBar();
      return;
    }

    users.forEach(user => {
      const row = document.createElement('tr');
      const protectedUser = isSuperRecord(user);

      const selectCell = document.createElement('td');
      selectCell.className = 'col-select';
      if (!protectedUser && ensureSuperAdmin()) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'user-row-check';
        checkbox.checked = state.selected.has(user.uid);
        checkbox.addEventListener('change', () => {
          checkbox.checked ? state.selected.add(user.uid) : state.selected.delete(user.uid);
          updateBulkBar();
        });
        selectCell.appendChild(checkbox);
      }

      const avatarCell = document.createElement('td');
      avatarCell.appendChild(avatarFor(user));
      const nameCell = document.createElement('td');
      const strong = el('strong', '', user.name || '—');
      nameCell.appendChild(strong);
      if (user.username) nameCell.appendChild(el('div', 'phase8-username-inline', `@${user.username}`));
      const emailCell = el('td', '', user.email || '—');
      emailCell.style.cssText = 'font-size:12px;color:#666';
      const roleCell = document.createElement('td');
      roleCell.appendChild(roleSelect(user));
      const statusCell = document.createElement('td');
      statusCell.appendChild(el('span', `adm-badge ${user.blocked ? 'badge-cancelado' : 'badge-entregado'}`, user.blocked ? 'Bloqueado' : 'Activo'));
      if (user.blocked) {
        const detail = el('div', 'phase8-block-detail');
        [
          user.blockReason ? `Motivo: ${user.blockReason}` : 'Motivo: sin especificar',
          user.blockedBy ? `Por: ${user.blockedBy}` : '',
          user.blockedAt ? `Fecha: ${formatDate(user.blockedAt)}` : '',
          user.roleBeforeBlock ? `Rol anterior: ${ROLE_LABELS[user.roleBeforeBlock] || user.roleBeforeBlock}` : '',
        ].filter(Boolean).forEach(line => detail.appendChild(el('div', '', line)));
        statusCell.appendChild(detail);
      }

      const actionsCell = document.createElement('td');
      const wrap = el('div', 'phase8-actions');
      if (ensureSuperAdmin()) {
        wrap.appendChild(actionButton('Ver ficha', 'adm-btn adm-btn-sm adm-btn-outline', () => openUserProfile(user)));
      }
      if (ensureSuperAdmin() && !protectedUser) {
        wrap.appendChild(user.blocked
          ? actionButton('Restaurar', 'adm-btn adm-btn-sm adm-btn-outline', () => restoreOne(user))
          : actionButton('Bloquear', 'adm-btn adm-btn-sm adm-btn-outline', () => blockOne(user)));
        wrap.appendChild(actionButton('Eliminar ficha', 'adm-btn adm-btn-sm adm-btn-danger', () => deleteOne(user)));
      } else if (protectedUser) {
        wrap.appendChild(el('span', 'phase8-protected-note', 'Cuenta protegida'));
      }
      actionsCell.appendChild(wrap);

      row.append(selectCell, avatarCell, nameCell, emailCell, roleCell, statusCell, actionsCell);
      tbody.appendChild(row);
    });
    updateBulkBar();
  }

  async function bulkAction(type) {
    const selectedUsers = state.users.filter(user => state.selected.has(user.uid) && !isSuperRecord(user));
    if (!selectedUsers.length) return toast('No hay usuarios elegibles seleccionados', true);

    let changes = [];
    let action = '';
    let details = '';
    if (type === 'role') {
      const role = document.getElementById('users-bulk-role')?.value;
      if (!ALLOWED_ROLES.includes(role)) return toast('Elegí un rol válido', true);
      const eligible = selectedUsers.filter(user => !user.blocked);
      if (!eligible.length) return toast('Los bloqueados deben restaurarse primero', true);
      if (!confirm(`¿Cambiar ${eligible.length} usuario(s) a ${ROLE_LABELS[role]}?`)) return;
      changes = eligible.map(user => ({ uid: user.uid, data: { role, updatedAt: serverTimestamp() } }));
      action = 'cambiar_rol';
      details = `Rol masivo → ${ROLE_LABELS[role]}`;
    } else if (type === 'block') {
      const eligible = selectedUsers.filter(user => !user.blocked);
      if (!eligible.length) return toast('No hay usuarios activos seleccionados', true);
      const reason = prompt('Motivo del bloqueo masivo (opcional):', '');
      if (reason === null) return;
      if (!confirm(`¿Bloquear ${eligible.length} usuario(s)?`)) return;
      changes = eligible.map(user => ({ uid: user.uid, data: {
        blocked: true,
        blockedAt: serverTimestamp(),
        blockedBy: state.user.email,
        blockReason: text(reason).slice(0, 500),
        roleBeforeBlock: canonicalRole(user),
        role: 'client',
        updatedAt: serverTimestamp(),
      } }));
      action = 'bloquear_usuario';
      details = reason ? `Motivo: ${reason}` : 'Sin motivo especificado';
    } else if (type === 'restore') {
      const eligible = selectedUsers.filter(user => user.blocked);
      if (!eligible.length) return toast('No hay usuarios bloqueados seleccionados', true);
      if (!confirm(`¿Restaurar ${eligible.length} usuario(s) con su rol anterior?`)) return;
      changes = eligible.map(user => ({ uid: user.uid, data: {
        blocked: false,
        role: ALLOWED_ROLES.includes(user.roleBeforeBlock) ? user.roleBeforeBlock : 'client',
        blockedAt: null,
        blockedBy: '',
        blockReason: '',
        roleBeforeBlock: '',
        updatedAt: serverTimestamp(),
      } }));
      action = 'restaurar_usuario';
      details = 'Restauración masiva con rol anterior';
    }

    try {
      const MAX = 450;
      for (let index = 0; index < changes.length; index += MAX) {
        const chunk = changes.slice(index, index + MAX);
        await commitUserAction(chunk, auditPayload(action, null, details, { bulk: true, count: chunk.length }));
      }
      state.selected.clear();
      toast(`${changes.length} usuario(s) actualizados y auditados`);
      renderUsers();
    } catch (error) {
      toast(error.message || 'No se pudo completar la acción masiva', true);
    }
  }

  function renderAudit() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;
    tbody.replaceChildren();
    if (!state.logs.length) {
      const row = document.createElement('tr');
      const cell = el('td', '', 'Todavía no hay acciones registradas');
      cell.colSpan = 5;
      cell.style.cssText = 'text-align:center;color:#888;padding:28px';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }
    state.logs.forEach(log => {
      const row = document.createElement('tr');
      const values = [
        formatDate(log.createdAt),
        log.actorEmail || '—',
        log.action || '—',
        log.targetLabel || log.targetId || '—',
        `${log.details || ''}${log.bulk ? ` · Lote: ${log.bulkCount || 0}` : ''}` || '—',
      ];
      values.forEach(value => row.appendChild(el('td', '', value)));
      tbody.appendChild(row);
    });
  }

  function bindLegacyControls() {
    const search = document.getElementById('user-search');
    if (search) {
      search.placeholder = 'Buscar por nombre, email, @, teléfono, cédula o ID…';
      search.oninput = () => {
        state.search = lower(search.value.trim());
        renderUsers();
      };
    }
    document.querySelectorAll('#section-usuarios .user-tab-btn').forEach(button => {
      button.onclick = () => {
        state.tab = button.dataset.userTab === 'blocked' ? 'blocked' : 'active';
        state.selected.clear();
        document.querySelectorAll('#section-usuarios .user-tab-btn').forEach(item => item.classList.toggle('active', item === button));
        renderUsers();
      };
    });
    const master = document.getElementById('check-all-users');
    if (master) {
      master.removeAttribute('onclick');
      master.onchange = () => {
        filteredUsers().filter(user => !isSuperRecord(user)).forEach(user => {
          master.checked ? state.selected.add(user.uid) : state.selected.delete(user.uid);
        });
        renderUsers();
      };
    }

    window.bulkChangeUserRole = () => bulkAction('role');
    window.bulkBlockUsers = () => bulkAction('block');
    window.bulkRestoreUsers = () => bulkAction('restore');
    window.clearUsersSelection = () => {
      state.selected.clear();
      if (master) master.checked = false;
      renderUsers();
    };
  }

  function injectStyles() {
    if (document.getElementById('phase8-users-styles')) return;
    const style = document.createElement('style');
    style.id = 'phase8-users-styles';
    style.textContent = `
      .phase8-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.phase8-block-detail{margin-top:6px;font-size:11px;color:#777;line-height:1.55;max-width:260px}.phase8-role-select{min-width:120px}.adm-toast.phase8-error{background:#a52828!important}
      #section-auditoria .adm-table td{white-space:normal;vertical-align:top}.phase8-protected-note,.phase8-username-inline{font-size:11px;color:#777}.phase8-username-inline{margin-top:3px;color:var(--adm-accent);font-weight:700}
      body.phase8-profile-open{overflow:hidden}.phase8-user-profile-overlay{position:fixed;inset:0;z-index:5000;background:rgba(29,19,23,.52);display:flex;justify-content:flex-end}.phase8-user-profile-overlay[hidden]{display:none}.phase8-user-profile-panel{width:min(720px,100%);height:100%;background:var(--adm-bg,#fff);box-shadow:-18px 0 48px rgba(0,0,0,.18);overflow:auto}.phase8-user-profile-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--adm-border);background:var(--adm-bg,#fff);font-weight:850}.phase8-user-profile-body{padding:22px}.phase8-profile-loading,.phase8-profile-error,.phase8-profile-empty{padding:18px;border-radius:12px;background:#fff7fa;color:var(--adm-muted);font-size:12px;line-height:1.6}.phase8-profile-error{color:#9b243e;background:#fff0f3}.phase8-profile-hero{display:flex;align-items:center;gap:12px;margin-bottom:18px}.phase8-profile-hero h3{margin:0 0 3px;font-size:19px}.phase8-profile-hero p{margin:0;color:var(--adm-muted);font-size:12px}.phase8-profile-hero>.adm-badge{margin-left:auto}.phase8-profile-section{border:1px solid var(--adm-border);border-radius:14px;padding:16px;margin-top:14px;background:#fff}.phase8-profile-section h4{margin:0 0 12px;font-size:13px;color:var(--adm-primary);text-transform:uppercase;letter-spacing:.04em}.phase8-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.phase8-profile-field{padding:10px 12px;border-radius:10px;background:#fff7fa;min-width:0}.phase8-profile-field-label{display:block;font-size:10px;font-weight:750;color:var(--adm-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}.phase8-profile-field strong{display:block;font-size:12px;overflow-wrap:anywhere}.phase8-profile-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.phase8-profile-order-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:12px}.phase8-profile-stat{padding:10px;border-radius:10px;background:#fff7fa;text-align:center}.phase8-profile-stat span{display:block;font-size:9px;text-transform:uppercase;color:var(--adm-muted);font-weight:750}.phase8-profile-stat strong{display:block;margin-top:4px;font-size:12px}.phase8-profile-orders{display:flex;flex-direction:column;gap:7px;max-height:360px;overflow:auto}.phase8-profile-order{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--adm-border);border-radius:10px}.phase8-profile-order>div{min-width:0}.phase8-profile-order span{display:block;margin-top:3px;font-size:10px;color:var(--adm-muted)}
      @media(max-width:700px){.phase8-profile-grid{grid-template-columns:1fr}.phase8-profile-order-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.phase8-user-profile-body{padding:14px}.phase8-profile-hero{align-items:flex-start;flex-wrap:wrap}.phase8-profile-hero>.adm-badge{margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function startListeners() {
    state.stopUsers?.();
    state.stopLogs?.();
    state.stopUsers = onSnapshot(query(collection(db, 'users'), limit(10000)), snapshot => {
      state.users = snapshot.docs.map(item => ({ uid: item.id, ...item.data() }));
      renderUsers();
    }, error => toast(`No se pudieron cargar los usuarios: ${error.message}`, true));

    state.stopLogs = onSnapshot(
      query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(300)),
      snapshot => {
        state.logs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        renderAudit();
      },
      error => toast(`No se pudo cargar la auditoría: ${error.message}`, true)
    );
  }

  function boot() {
    injectStyles();
    bindLegacyControls();
    ensureProfileDrawer();
    onAuthStateChanged(auth, user => {
      state.user = user;
      if (!user || lower(user.email) !== SUPER_ADMIN) return;
      startListeners();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
