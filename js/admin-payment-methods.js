import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  cleanPaymentMultiline,
  cleanPaymentText,
  legacyPaymentMirrors,
  normalizePaymentCatalog,
  normalizePaymentMethod,
  paymentCatalogMap,
  paymentMethodId,
} from './payment-methods-core.js?v=tintin-20260720-payment-crud-1';

const ADMIN_PATH = /(^|\/)admin(?:\.html)?$/i;
const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';
const SETTINGS_REF = doc(db, 'settings', 'general');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureStyle() {
  if (document.getElementById('tt-payment-methods-style')) return;
  const link = document.createElement('link');
  link.id = 'tt-payment-methods-style';
  link.rel = 'stylesheet';
  link.href = 'css/payment-methods.css?v=tintin-20260720-payment-crud-1';
  document.head.appendChild(link);
}

function legacyInputsHtml() {
  return `
    <div hidden aria-hidden="true">
      <input type="checkbox" id="cfg-pay-efectivo" />
      <input type="checkbox" id="cfg-pay-transferencia" />
      <input type="checkbox" id="cfg-pay-pagopark" />
      <textarea id="cfg-bank-ueno"></textarea>
      <textarea id="cfg-bank-atlas"></textarea>
    </div>
  `;
}

function rootHtml() {
  return `${legacyInputsHtml()}
    <div id="tt-payment-admin-root">
      <div class="tt-payment-admin-toolbar">
        <div>
          <strong style="font-size:14px;color:var(--adm-text)">Métodos configurados</strong>
          <div style="font-size:11px;color:var(--adm-muted);margin-top:3px">Los métodos offline creados acá aparecen automáticamente en el checkout.</div>
        </div>
        <button type="button" class="adm-btn adm-btn-primary adm-btn-sm" id="tt-payment-new">+ Nuevo método</button>
      </div>
      <div class="tt-payment-admin-status" id="tt-payment-status" role="status" aria-live="polite">Cargando métodos de pago…</div>
      <div class="tt-payment-admin-list" id="tt-payment-list"></div>
      <div class="tt-payment-admin-editor" id="tt-payment-editor" aria-hidden="true">
        <input type="hidden" id="tt-payment-original-id" />
        <div class="tt-payment-admin-grid">
          <div class="adm-field">
            <label class="adm-label" for="tt-payment-title">Nombre visible</label>
            <input type="text" class="adm-input" id="tt-payment-title" maxlength="100" placeholder="Ej: Transferencia Ueno" />
          </div>
          <div class="adm-field">
            <label class="adm-label" for="tt-payment-id">Identificador</label>
            <input type="text" class="adm-input" id="tt-payment-id" maxlength="40" placeholder="transferencia-ueno" />
          </div>
          <div class="adm-field">
            <label class="adm-label" for="tt-payment-kind">Tipo seguro del pedido</label>
            <select class="adm-select" id="tt-payment-kind">
              <option value="efectivo">Efectivo / contra entrega</option>
              <option value="transferencia">Transferencia / pago coordinado</option>
            </select>
          </div>
          <div class="adm-field">
            <label class="adm-label" for="tt-payment-icon">Ícono</label>
            <input type="text" class="adm-input" id="tt-payment-icon" maxlength="12" placeholder="💵" />
          </div>
          <div class="adm-field tt-payment-admin-span-2">
            <label class="adm-label" for="tt-payment-description">Descripción breve</label>
            <input type="text" class="adm-input" id="tt-payment-description" maxlength="240" placeholder="Texto que se muestra debajo del nombre" />
          </div>
          <div class="adm-field tt-payment-admin-span-2">
            <label class="adm-label" for="tt-payment-instructions">Instrucciones al seleccionar</label>
            <textarea class="adm-input" id="tt-payment-instructions" rows="3" maxlength="1200" placeholder="Podés escribir instrucciones, horarios o cómo enviar el comprobante."></textarea>
          </div>
          <label class="tt-payment-admin-switch">
            <input type="checkbox" id="tt-payment-enabled" checked /> Disponible en Checkout
          </label>
          <div class="adm-field">
            <label class="adm-label" for="tt-payment-order">Orden</label>
            <input type="number" class="adm-input" id="tt-payment-order" min="0" max="99" value="0" />
          </div>
          <div class="adm-field tt-payment-admin-span-2">
            <div class="tt-payment-admin-toolbar" style="margin-bottom:8px">
              <label class="adm-label" style="margin:0">Datos editables</label>
              <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="tt-payment-add-detail">+ Agregar dato</button>
            </div>
            <div class="tt-payment-detail-list" id="tt-payment-detail-list"></div>
            <div style="font-size:11px;color:var(--adm-muted);margin-top:7px">Podés agregar banco, titular, CI/RUC, número de cuenta, alias, tipo de cuenta u otros datos.</div>
          </div>
        </div>
        <div class="tt-payment-admin-form-actions" style="margin-top:16px">
          <button type="button" class="adm-btn adm-btn-primary" id="tt-payment-save">Guardar método</button>
          <button type="button" class="adm-btn adm-btn-outline" id="tt-payment-cancel">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function boot() {
  if (!ADMIN_PATH.test(location.pathname) && !document.getElementById('section-configuracion')) return;
  ensureStyle();
  const oldInput = document.getElementById('cfg-pay-efectivo');
  const card = oldInput?.closest('.adm-card');
  const body = card?.querySelector('.adm-card-body');
  if (!card || !body) return;

  const title = card.querySelector('.adm-card-title');
  if (title) title.textContent = 'Métodos de pago y datos de transferencia';
  body.innerHTML = rootHtml();

  const root = document.getElementById('tt-payment-admin-root');
  const list = document.getElementById('tt-payment-list');
  const editor = document.getElementById('tt-payment-editor');
  const detailList = document.getElementById('tt-payment-detail-list');
  const status = document.getElementById('tt-payment-status');
  const saveButton = document.getElementById('tt-payment-save');
  let methods = [];
  let authorized = false;
  let saving = false;
  let dirty = false;
  let titleGeneratedId = true;

  function setStatus(message, state = '') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function syncLegacyInputs() {
    const mirrors = legacyPaymentMirrors(methods);
    document.getElementById('cfg-pay-efectivo').checked = mirrors.paymentMethods.efectivo;
    document.getElementById('cfg-pay-transferencia').checked = mirrors.paymentMethods.transferencia;
    document.getElementById('cfg-pay-pagopark').checked = false;
    document.getElementById('cfg-bank-ueno').value = mirrors.bankAccounts.ueno;
    document.getElementById('cfg-bank-atlas').value = mirrors.bankAccounts.atlas;
  }

  function itemHtml(method, index) {
    const disabledClass = method.enabled ? '' : ' is-disabled';
    return `
      <div class="tt-payment-admin-item" data-method-id="${escapeHtml(method.id)}">
        <div class="tt-payment-admin-icon" aria-hidden="true">${escapeHtml(method.icon)}</div>
        <div>
          <div class="tt-payment-admin-title">${escapeHtml(method.title)}</div>
          <div class="tt-payment-admin-description">${escapeHtml(method.description || 'Sin descripción')}</div>
          <div class="tt-payment-admin-meta">ID: ${escapeHtml(method.id)} · ${method.kind === 'transferencia' ? 'Transferencia' : 'Efectivo'} · ${method.details.length} dato${method.details.length === 1 ? '' : 's'}</div>
          <span class="tt-payment-admin-badge${disabledClass}">${method.enabled ? 'ACTIVO' : 'DESACTIVADO'}</span>
        </div>
        <div class="tt-payment-admin-actions">
          <button type="button" class="adm-btn adm-btn-sm" data-payment-action="up" ${index === 0 ? 'disabled' : ''} aria-label="Mover arriba">↑</button>
          <button type="button" class="adm-btn adm-btn-sm" data-payment-action="down" ${index === methods.length - 1 ? 'disabled' : ''} aria-label="Mover abajo">↓</button>
          <button type="button" class="adm-btn adm-btn-sm" data-payment-action="toggle">${method.enabled ? 'Desactivar' : 'Activar'}</button>
          <button type="button" class="adm-btn adm-btn-sm" data-payment-action="edit">Editar</button>
          <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-payment-action="delete">Eliminar</button>
        </div>
      </div>
    `;
  }

  function renderList() {
    syncLegacyInputs();
    list.innerHTML = methods.length
      ? methods.map(itemHtml).join('')
      : '<div style="padding:16px;border:1px dashed var(--adm-border);border-radius:12px;color:var(--adm-muted);font-size:12px">No hay métodos configurados. El Checkout mostrará que no hay opciones disponibles.</div>';
  }

  function addDetailRow(detail = {}) {
    const row = document.createElement('div');
    row.className = 'tt-payment-detail-row';
    row.innerHTML = `
      <input type="text" class="adm-input" data-payment-detail-label maxlength="100" placeholder="Etiqueta: Banco, Titular…" value="${escapeHtml(detail.label || '')}" />
      <textarea class="adm-input" data-payment-detail-value maxlength="800" placeholder="Dato o texto completo">${escapeHtml(detail.value || '')}</textarea>
      <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-payment-detail-remove aria-label="Eliminar dato">✕</button>
    `;
    detailList.appendChild(row);
  }

  function editorSnapshot() {
    return JSON.stringify({
      original: document.getElementById('tt-payment-original-id').value,
      id: document.getElementById('tt-payment-id').value,
      title: document.getElementById('tt-payment-title').value,
      kind: document.getElementById('tt-payment-kind').value,
      icon: document.getElementById('tt-payment-icon').value,
      description: document.getElementById('tt-payment-description').value,
      instructions: document.getElementById('tt-payment-instructions').value,
      enabled: document.getElementById('tt-payment-enabled').checked,
      order: document.getElementById('tt-payment-order').value,
      details: [...detailList.querySelectorAll('.tt-payment-detail-row')].map(row => ({
        label: row.querySelector('[data-payment-detail-label]').value,
        value: row.querySelector('[data-payment-detail-value]').value,
      })),
    });
  }

  function markDirty() {
    dirty = true;
  }

  function closeEditor() {
    editor.classList.remove('is-open');
    editor.setAttribute('aria-hidden', 'true');
    detailList.innerHTML = '';
    dirty = false;
    window.AdminUnsaved?.unregister('payment-method-editor');
  }

  function openEditor(method = null) {
    const isNew = !method;
    const value = method || {
      id: '',
      title: '',
      kind: 'efectivo',
      icon: '💵',
      description: '',
      instructions: '',
      enabled: true,
      order: methods.length,
      details: [],
    };
    document.getElementById('tt-payment-original-id').value = method?.id || '';
    document.getElementById('tt-payment-id').value = value.id;
    document.getElementById('tt-payment-title').value = value.title;
    document.getElementById('tt-payment-kind').value = value.kind;
    document.getElementById('tt-payment-icon').value = value.icon;
    document.getElementById('tt-payment-description').value = value.description;
    document.getElementById('tt-payment-instructions').value = value.instructions;
    document.getElementById('tt-payment-enabled').checked = value.enabled;
    document.getElementById('tt-payment-order').value = value.order;
    detailList.innerHTML = '';
    value.details.forEach(addDetailRow);
    titleGeneratedId = isNew;
    dirty = false;
    editor.classList.add('is-open');
    editor.setAttribute('aria-hidden', 'false');
    document.getElementById('tt-payment-title').focus();
    window.AdminUnsaved?.register('payment-method-editor', {
      root: '#tt-payment-editor',
      label: 'Método de pago',
      serialize: editorSnapshot,
      save: saveEditor,
    });
  }

  function readEditor() {
    const rawId = document.getElementById('tt-payment-id').value;
    const id = paymentMethodId(rawId);
    const titleValue = cleanPaymentText(document.getElementById('tt-payment-title').value, 100);
    const details = [...detailList.querySelectorAll('.tt-payment-detail-row')]
      .map((row, index) => ({
        id: `dato-${index + 1}`,
        label: cleanPaymentText(row.querySelector('[data-payment-detail-label]').value, 100),
        value: cleanPaymentMultiline(row.querySelector('[data-payment-detail-value]').value, 800),
      }))
      .filter(detail => detail.label || detail.value);
    return normalizePaymentMethod({
      id,
      title: titleValue,
      kind: document.getElementById('tt-payment-kind').value,
      icon: document.getElementById('tt-payment-icon').value,
      description: document.getElementById('tt-payment-description').value,
      instructions: document.getElementById('tt-payment-instructions').value,
      enabled: document.getElementById('tt-payment-enabled').checked,
      order: Number(document.getElementById('tt-payment-order').value),
      details,
    }, id, methods.length);
  }

  async function persist(nextMethods, successMessage) {
    if (!authorized) throw new Error('Solo Super Admin puede modificar métodos de pago.');
    if (saving) throw new Error('Ya hay un guardado en curso.');
    saving = true;
    saveButton.disabled = true;
    setStatus('Guardando y sincronizando con Checkout…');
    try {
      const ordered = nextMethods
        .map((method, index) => ({ ...method, order: Number.isFinite(Number(method.order)) ? Number(method.order) : index }))
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'es'))
        .map((method, index) => ({ ...method, order: index }));
      const mirrors = legacyPaymentMirrors(ordered);
      await setDoc(SETTINGS_REF, {
        paymentMethodsCatalog: paymentCatalogMap(ordered),
        ...mirrors,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || '',
      }, { merge: true });
      methods = ordered;
      renderList();
      setStatus(successMessage, 'success');
      window.dispatchEvent(new CustomEvent('tintin:payment-methods-saved', { detail: { count: methods.length } }));
      return true;
    } catch (error) {
      setStatus(`No se pudo guardar: ${error.message}`, 'error');
      throw error;
    } finally {
      saving = false;
      saveButton.disabled = false;
    }
  }

  async function saveEditor() {
    const originalId = document.getElementById('tt-payment-original-id').value;
    const method = readEditor();
    if (!method?.id) {
      setStatus('Escribí un identificador válido.', 'error');
      document.getElementById('tt-payment-id').focus();
      return false;
    }
    if (!method.title) {
      setStatus('Escribí el nombre visible del método.', 'error');
      document.getElementById('tt-payment-title').focus();
      return false;
    }
    const duplicate = methods.some(item => item.id === method.id && item.id !== originalId);
    if (duplicate) {
      setStatus('Ya existe un método con ese identificador.', 'error');
      document.getElementById('tt-payment-id').focus();
      return false;
    }
    if (!originalId && methods.length >= 20) {
      setStatus('El máximo es de 20 métodos de pago.', 'error');
      return false;
    }
    const next = methods.filter(item => item.id !== originalId);
    next.push(method);
    await persist(next, originalId ? 'Método actualizado correctamente.' : 'Método creado correctamente.');
    closeEditor();
    window.AdminUnsaved?.markClean('payment-method-editor');
    return true;
  }

  root.addEventListener('input', markDirty);
  root.addEventListener('change', markDirty);

  document.getElementById('tt-payment-title').addEventListener('input', event => {
    if (!titleGeneratedId) return;
    document.getElementById('tt-payment-id').value = paymentMethodId(event.target.value);
  });
  document.getElementById('tt-payment-id').addEventListener('input', () => {
    titleGeneratedId = false;
  });
  document.getElementById('tt-payment-kind').addEventListener('change', event => {
    const icon = document.getElementById('tt-payment-icon');
    if (!icon.value || icon.value === '💵' || icon.value === '🏦') icon.value = event.target.value === 'transferencia' ? '🏦' : '💵';
  });

  document.getElementById('tt-payment-new').addEventListener('click', () => openEditor());
  document.getElementById('tt-payment-add-detail').addEventListener('click', () => {
    if (detailList.children.length >= 24) {
      setStatus('Cada método admite hasta 24 datos.', 'error');
      return;
    }
    addDetailRow();
    detailList.lastElementChild?.querySelector('input')?.focus();
    markDirty();
  });
  detailList.addEventListener('click', event => {
    const button = event.target.closest('[data-payment-detail-remove]');
    if (!button) return;
    button.closest('.tt-payment-detail-row')?.remove();
    markDirty();
  });
  document.getElementById('tt-payment-save').addEventListener('click', () => {
    saveEditor().catch(error => console.error('[admin-payment-methods] No se pudo guardar:', error));
  });
  document.getElementById('tt-payment-cancel').addEventListener('click', () => {
    if (dirty && !window.confirm('¿Descartar los cambios de este método?')) return;
    closeEditor();
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-payment-action]');
    const item = event.target.closest('[data-method-id]');
    if (!button || !item) return;
    const id = item.dataset.methodId;
    const index = methods.findIndex(method => method.id === id);
    if (index < 0) return;
    const action = button.dataset.paymentAction;
    if (action === 'edit') {
      openEditor(methods[index]);
      return;
    }
    if (action === 'delete') {
      if (!window.confirm(`¿Eliminar “${methods[index].title}”? Dejará de aparecer en Checkout.`)) return;
      persist(methods.filter(method => method.id !== id), 'Método eliminado correctamente.').catch(error => console.error('[admin-payment-methods] No se pudo eliminar:', error));
      return;
    }
    if (action === 'toggle') {
      const next = methods.map(method => method.id === id ? { ...method, enabled: !method.enabled } : method);
      persist(next, methods[index].enabled ? 'Método desactivado.' : 'Método activado.').catch(error => console.error('[admin-payment-methods] No se pudo cambiar el estado:', error));
      return;
    }
    if (action === 'up' || action === 'down') {
      const target = action === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= methods.length) return;
      const next = methods.slice();
      [next[index], next[target]] = [next[target], next[index]];
      next.forEach((method, position) => { method.order = position; });
      persist(next, 'Orden actualizado.').catch(error => console.error('[admin-payment-methods] No se pudo ordenar:', error));
    }
  });

  onAuthStateChanged(auth, user => {
    authorized = String(user?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
    document.getElementById('tt-payment-new').disabled = !authorized;
    if (!authorized) setStatus('Solo la cuenta Super Admin puede modificar estos datos.', 'error');
  });

  onSnapshot(SETTINGS_REF, snapshot => {
    if (!snapshot.exists()) return;
    if (saving || dirty) return;
    methods = normalizePaymentCatalog(snapshot.data() || {});
    renderList();
    setStatus(`${methods.length} método${methods.length === 1 ? '' : 's'} sincronizado${methods.length === 1 ? '' : 's'} con Checkout.`, 'success');
  }, error => {
    setStatus(`No se pudieron cargar los métodos: ${error.message}`, 'error');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
