/* =============================================================
   TINTIN — Fase 8: usuarios, auditoría y permisos

   Reemplaza únicamente las tablas de Usuarios y Auditoría del panel.
   - render seguro con nodos DOM (sin innerHTML con datos de clientas)
   - Super Admin protegido por email oficial
   - roles canónicos
   - cambios de usuario + registro de auditoría en el mismo batch
   - listeners en tiempo real
   ============================================================= */

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN, ROLE_LABELS } from './roles.js';

if (!window.TintinAdminUsersPhase8Booted) {
  window.TintinAdminUsersPhase8Booted = true;

  const ALLOWED_ROLES = ['admin', 'agent', 'viewer', 'client'];
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
    if (!confirm(`¿Restaurar a ${user.name || user.email} como Cliente?`)) return;
    try {
      await commitUserAction([
        { uid: user.uid, data: {
          blocked: false,
          role: 'client',
          blockedAt: null,
          blockedBy: '',
          blockReason: '',
          roleBeforeBlock: '',
          updatedAt: serverTimestamp(),
        } }
      ], auditPayload('restaurar_usuario', user, 'Restaurado como Cliente'));
      toast('Usuario restaurado como Cliente');
    } catch (error) {
      toast(error.message || 'No se pudo restaurar', true);
    }
  }

  async function deleteOne(user) {
    if (isSuperRecord(user)) return toast('El perfil del Super Admin no se puede eliminar', true);
    if (!confirm(`¿Eliminar la ficha de ${user.name || user.email} de Firestore?\n\nLa cuenta de Firebase Authentication seguirá existiendo.`)) return;
    try {
      await commitUserAction([
        { uid: user.uid, delete: true }
      ], auditPayload('eliminar_usuario', user, 'Eliminó la ficha de Firestore; Auth no fue eliminada'));
      toast('Ficha eliminada y acción auditada');
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
      if (ensureSuperAdmin() && !protectedUser) {
        const wrap = el('div', 'phase8-actions');
        wrap.appendChild(user.blocked
          ? actionButton('Restaurar', 'adm-btn adm-btn-sm adm-btn-outline', () => restoreOne(user))
          : actionButton('Bloquear', 'adm-btn adm-btn-sm adm-btn-outline', () => blockOne(user)));
        wrap.appendChild(actionButton('Eliminar ficha', 'adm-btn adm-btn-sm adm-btn-danger', () => deleteOne(user)));
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
      if (!confirm(`¿Restaurar ${eligible.length} usuario(s) como Cliente?`)) return;
      changes = eligible.map(user => ({ uid: user.uid, data: {
        blocked: false,
        role: 'client',
        blockedAt: null,
        blockedBy: '',
        blockReason: '',
        roleBeforeBlock: '',
        updatedAt: serverTimestamp(),
      } }));
      action = 'restaurar_usuario';
      details = 'Restauración masiva como Cliente';
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
    `;
    document.head.appendChild(style);
  }

  function startListeners() {
    state.stopUsers?.();
    state.stopLogs?.();
    state.stopUsers = onSnapshot(collection(db, 'users'), snapshot => {
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
