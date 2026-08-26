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
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  getDocs,
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
  const COMPLETED_STATUSES = new Set(['entregado']);
  const CANCELLED_STATUSES = new Set(['cancelado', 'rechazado']);

  function formatPrice(value) {
    const n = Number(value) || 0;
    return `Gs. ${n.toLocaleString('es-PY')}`;
  }

  async function loadClientOrders(uid) {
    const q = query(collection(db, 'orders'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
  }

  function ficaField(label, value) {
    const wrap = el('div', 'ficha-field');
    wrap.appendChild(el('div', 'ficha-field-label', label));
    wrap.appendChild(el('div', 'ficha-field-value', value || '—'));
    return wrap;
  }

  function ficaSection(title) {
    const section = el('div', 'ficha-section');
    section.appendChild(el('div', 'ficha-section-title', title));
    const grid = el('div', 'ficha-grid');
    section.appendChild(grid);
    return { section, grid };
  }

  async function openClientFicha(user) {
    const overlay = document.getElementById('client-ficha-overlay');
    const body = document.getElementById('client-ficha-body');
    if (!overlay || !body) return;
    body.replaceChildren(el('div', 'adm-loading', 'Cargando ficha…'));
    overlay.style.display = 'block';

    const identidad = ficaSection('Identidad');
    identidad.grid.append(
      ficaField('Nombre', user.name),
      ficaField('@username', user.username ? `@${user.username}` : ''),
      ficaField('Customer ID', user.customerId || `CUS_${user.uid}`),
      ficaField('Rol', ROLE_LABELS[canonicalRole(user)] || canonicalRole(user)),
      ficaField('Cuenta creada', formatDate(user.createdAt)),
      ficaField('Estado de perfil', user.profileStatus || '—'),
    );

    const contacto = ficaSection('Contacto');
    contacto.grid.append(
      ficaField('Email', user.email),
      ficaField('Teléfono', user.phone),
      ficaField('Ubicación', user.address || user.savedLocation?.name),
      ficaField('Fecha de nacimiento', user.dob),
    );

    const seguridad = ficaSection('Seguridad y acceso');
    seguridad.grid.append(
      ficaField('Estado', user.blocked ? `Bloqueado (${user.blockReason || 'sin motivo'})` : 'Activo'),
      ficaField('Cambio de @username usado', user.usernameChangedAt ? 'Sí' : 'No'),
    );

    let orders = [];
    try {
      orders = await loadClientOrders(user.uid);
    } catch (error) {
      orders = [];
    }
    const pendientes = orders.filter(o => !COMPLETED_STATUSES.has(o.status) && !CANCELLED_STATUSES.has(o.status)).length;
    const completados = orders.filter(o => COMPLETED_STATUSES.has(o.status)).length;
    const cancelados = orders.filter(o => CANCELLED_STATUSES.has(o.status)).length;
    const ultimaCi = orders.find(o => o.ci)?.ci;

    const pedidos = ficaSection(`Pedidos (${orders.length})`);
    pedidos.grid.append(
      ficaField('Pendientes', String(pendientes)),
      ficaField('Completados', String(completados)),
      ficaField('Cancelados', String(cancelados)),
      ficaField('Cédula (última encomienda)', ultimaCi),
    );
    const ordersList = el('div', 'ficha-orders-list');
    orders.slice(0, 10).forEach(order => {
      const row = el('div', 'ficha-order-row');
      row.appendChild(el('span', '', `#${text(order.id).slice(-6).toUpperCase()} · ${formatDate(order.createdAt)}`));
      row.appendChild(el('span', 'adm-badge', ORDER_STATUS_LABELS[order.status] || order.status || 'Pendiente'));
      row.appendChild(el('span', '', formatPrice(order.total)));
      ordersList.appendChild(row);
    });
    if (!orders.length) ordersList.appendChild(el('div', '', 'Sin pedidos registrados'));
    pedidos.section.appendChild(ordersList);

    const auditoria = ficaSection('Auditoría reciente');
    const auditList = el('div', 'ficha-orders-list');
    const relatedLogs = state.logs.filter(log => log.targetId === user.uid).slice(0, 10);
    relatedLogs.forEach(log => {
      const row = el('div', 'ficha-order-row');
      row.appendChild(el('span', '', formatDate(log.createdAt)));
      row.appendChild(el('span', '', log.action || '—'));
      row.appendChild(el('span', '', log.details || '—'));
      auditList.appendChild(row);
    });
    if (!relatedLogs.length) auditList.appendChild(el('div', '', 'Sin acciones registradas sobre esta cuenta'));
    auditoria.section.appendChild(auditList);

    body.replaceChildren(identidad.section, contacto.section, pedidos.section, seguridad.section, auditoria.section);
  }

  function closeClientFicha() {
    const overlay = document.getElementById('client-ficha-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  window.closeClientFicha = closeClientFicha;

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
      return lower(user.name).includes(state.search) || lower(user.email).includes(state.search);
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
      if (ensureSuperAdmin()) {
        const wrap = el('div', 'phase8-actions');
        wrap.appendChild(actionButton('Ver ficha', 'adm-btn adm-btn-sm adm-btn-outline', () => openClientFicha(user)));
        if (!protectedUser) {
          wrap.appendChild(user.blocked
            ? actionButton('Restaurar', 'adm-btn adm-btn-sm adm-btn-outline', () => restoreOne(user))
            : actionButton('Bloquear', 'adm-btn adm-btn-sm adm-btn-outline', () => blockOne(user)));
          wrap.appendChild(actionButton('Eliminar ficha', 'adm-btn adm-btn-sm adm-btn-danger', () => deleteOne(user)));
        }
        actionsCell.appendChild(wrap);
      } else {
        actionsCell.textContent = protectedUser ? 'Cuenta protegida' : '—';
      }

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
      .phase8-actions{display:flex;gap:6px;flex-wrap:wrap}.phase8-block-detail{margin-top:6px;font-size:11px;color:#777;line-height:1.55;max-width:260px}.phase8-role-select{min-width:120px}.adm-toast.phase8-error{background:#a52828!important}
      #section-auditoria .adm-table td{white-space:normal;vertical-align:top}.phase8-protected-note{font-size:11px;color:#777}
      .ficha-section-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--adm-primary);margin-bottom:10px}
      .ficha-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .ficha-field-label{font-size:11px;color:#888;margin-bottom:2px}
      .ficha-field-value{font-size:13px;color:#222;font-weight:600;word-break:break-word}
      .ficha-orders-list{margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .ficha-order-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#444;padding:8px 10px;background:#f7f7f8;border-radius:8px}
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
    onAuthStateChanged(auth, user => {
      state.user = user;
      if (!user || lower(user.email) !== SUPER_ADMIN) return;
      startListeners();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
