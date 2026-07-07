/* =============================================================
   TINTIN — Control Super Admin: Activar / Desactivar tienda
   =============================================================
   Se carga desde js/store-gate.js solamente en páginas admin.
   No reemplaza el panel: lo refuerza con un botón explícito, estado real,
   feedback y sincronización en vivo desde Firestore.
   ============================================================= */

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, setDoc, onSnapshot, serverTimestamp, addDoc, collection
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN } from './roles.js';

const settingsRef = doc(db, 'settings', 'general');
let currentUser = auth.currentUser || null;
let currentStoreOpen = true;
let saving = false;
let uiReady = false;
let els = {};

function toast(message, duration = 3000) {
  const el = document.getElementById('adm-toast');
  if (!el) { console.log('[Tintin Admin]', message); return; }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._ttTimer);
  el._ttTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function isSuperAdmin() {
  return currentUser?.email === SUPER_ADMIN;
}

function waitForConfigDom() {
  return new Promise(resolve => {
    const tryFind = () => {
      const checkbox = document.getElementById('cfg-store-open');
      const saveBtn = document.getElementById('btn-save-config');
      if (checkbox && saveBtn) { resolve({ checkbox, saveBtn }); return true; }
      return false;
    };
    if (tryFind()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (tryFind() || attempts > 120) clearInterval(timer);
    }, 100);
  });
}

function ensureUiShell(checkbox, saveBtn) {
  if (uiReady) return;
  const wrap = checkbox.closest('.adm-toggle-wrap') || checkbox.parentElement;
  const host = document.createElement('div');
  host.id = 'cfg-store-superadmin-control';
  host.style.cssText = 'margin-top:14px;padding:14px 16px;border:1.5px solid var(--adm-border);border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
  host.innerHTML = `
    <div style="min-width:220px;flex:1">
      <div id="cfg-store-status-badge" class="adm-badge" style="margin-bottom:6px">—</div>
      <div id="cfg-store-status-text" style="font-size:13px;color:var(--adm-muted);line-height:1.55">Leyendo estado real de la tienda…</div>
    </div>
    <button type="button" id="cfg-store-action" class="adm-btn adm-btn-primary" style="min-width:190px">Cargando…</button>
  `;
  wrap.insertAdjacentElement('afterend', host);

  els = {
    checkbox,
    saveBtn,
    actionBtn: host.querySelector('#cfg-store-action'),
    badge: host.querySelector('#cfg-store-status-badge'),
    text: host.querySelector('#cfg-store-status-text')
  };

  els.actionBtn.addEventListener('click', () => {
    const dirty = els.checkbox.checked !== currentStoreOpen;
    const targetOpen = dirty ? els.checkbox.checked : !currentStoreOpen;
    saveStoreState(targetOpen);
  });

  els.checkbox.addEventListener('change', () => renderState(currentStoreOpen, { dirty: true }));

  // Refuerzo: si usa el botón general "Guardar toda la configuración", este
  // módulo guarda también el estado real del switch. Así no hay dos verdades.
  els.saveBtn.addEventListener('click', () => {
    if (!isSuperAdmin()) return;
    if (els.checkbox.checked !== currentStoreOpen) saveStoreState(els.checkbox.checked);
  }, true);

  uiReady = true;
}

function renderState(open, opts = {}) {
  if (!uiReady) return;
  const allowed = isSuperAdmin();
  const dirty = opts.dirty && els.checkbox.checked !== open;

  if (!dirty) els.checkbox.checked = open;
  els.checkbox.disabled = !allowed || saving;
  els.actionBtn.disabled = !allowed || saving;

  if (saving) {
    els.actionBtn.textContent = 'Guardando…';
    els.text.textContent = 'Actualizando el estado global de la tienda en Firestore…';
    return;
  }

  if (!allowed) {
    els.badge.textContent = 'Solo Super Admin';
    els.badge.style.background = '#fef3c7';
    els.badge.style.color = '#92400e';
    els.text.textContent = 'Solo tintinaccs@gmail.com puede activar o desactivar la tienda.';
    els.actionBtn.textContent = 'Sin permiso';
    return;
  }

  if (dirty) {
    const desired = els.checkbox.checked;
    els.badge.textContent = 'Cambio pendiente';
    els.badge.style.background = '#fff3e0';
    els.badge.style.color = '#e65100';
    els.text.textContent = desired
      ? 'El switch está en Activar, pero todavía falta guardar el cambio global.'
      : 'El switch está en Desactivar, pero todavía falta guardar el cambio global.';
    els.actionBtn.textContent = desired ? 'Guardar activación' : 'Guardar desactivación';
    els.actionBtn.className = desired ? 'adm-btn adm-btn-primary' : 'adm-btn adm-btn-danger';
    return;
  }

  if (open) {
    els.badge.textContent = 'Tienda activa';
    els.badge.style.background = '#d1fae5';
    els.badge.style.color = '#065f46';
    els.text.textContent = 'La tienda está visible para visitantes, clientas y navegación pública en desktop, tablet y mobile.';
    els.actionBtn.textContent = 'Desactivar tienda';
    els.actionBtn.className = 'adm-btn adm-btn-danger';
  } else {
    els.badge.textContent = 'Tienda desactivada';
    els.badge.style.background = '#fee2e2';
    els.badge.style.color = '#991b1b';
    els.text.textContent = 'La web pública está bloqueada. Solo Super Admin puede entrar para administrar y reactivar.';
    els.actionBtn.textContent = 'Activar tienda';
    els.actionBtn.className = 'adm-btn adm-btn-primary';
  }
}

async function logStoreAudit(targetOpen) {
  try {
    await addDoc(collection(db, 'auditLog'), {
      action: 'cambiar_estado_tienda',
      targetType: 'settings',
      targetId: 'settings/general',
      targetLabel: 'Estado de la tienda',
      details: targetOpen ? 'Tienda activada' : 'Tienda desactivada',
      bulk: false,
      bulkCount: 0,
      actorEmail: currentUser?.email || '',
      actorRole: 'superadmin',
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('[admin-store-control] No se pudo registrar auditoría:', e);
  }
}

async function saveStoreState(targetOpen) {
  if (!isSuperAdmin()) { toast('Solo Super Admin puede cambiar el estado de la tienda'); return; }
  if (saving) return;
  if (!targetOpen) {
    const ok = confirm('¿Desactivar la tienda ahora?\n\nVisitantes, clientas y roles no autorizados dejarán de ver la web pública en desktop, tablet y mobile. Solo Super Admin podrá entrar para reactivarla.');
    if (!ok) { renderState(currentStoreOpen); return; }
  }
  saving = true;
  renderState(currentStoreOpen);
  try {
    await setDoc(settingsRef, {
      storeOpen: !!targetOpen,
      tiendaActiva: !!targetOpen,
      storeStatusUpdatedAt: serverTimestamp(),
      storeStatusUpdatedBy: currentUser?.email || SUPER_ADMIN
    }, { merge: true });
    currentStoreOpen = !!targetOpen;
    await logStoreAudit(targetOpen);
    toast(targetOpen ? 'Tienda activada correctamente' : 'Tienda desactivada correctamente');
    window.TintinStoreGate?.refresh?.();
  } catch (e) {
    toast('No se pudo guardar el estado de la tienda: ' + e.message, 5000);
  } finally {
    saving = false;
    renderState(currentStoreOpen);
  }
}

async function boot() {
  const { checkbox, saveBtn } = await waitForConfigDom();
  if (!checkbox || !saveBtn) return;
  ensureUiShell(checkbox, saveBtn);
  onAuthStateChanged(auth, user => {
    currentUser = user || null;
    renderState(currentStoreOpen);
  });
  onSnapshot(settingsRef, snap => {
    const data = snap.exists() ? snap.data() : {};
    currentStoreOpen = data.storeOpen !== false;
    renderState(currentStoreOpen);
  }, e => {
    toast('Error al sincronizar estado de tienda: ' + e.message, 5000);
  });
}

boot();
