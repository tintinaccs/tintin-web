/* =============================================================
   TINTIN — Cupones de envío gratis (solo Super Admin)
   Colección: coupons/{CODIGO}. Las reglas de Firestore exigen super admin y
   impiden tocar usedCount; los usos los suma únicamente el servidor al crear
   un pedido (couponRedemptions guarda el conteo por cliente).
   ============================================================= */

import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { waitForAdminAppCheck } from '../auth/app-check-admin.js?v=tintin-20261004-admin-connections-3';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1';
import { isSuperAdmin } from '../../core/auth/identidad-super-admin.js?v=tintin-20260916-superadmin-identity-2';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const ROOT_ID = 'tt-coupons-admin-root';
const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;
let coupons = [];
let unsubscribe = null;
let editing = null; // null = lista, {} = nuevo, {code} = edición

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateOnly = value => (/^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '');
const limitLabel = value => (Number(value) > 0 ? String(value) : 'Sin límite');

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  const section = document.getElementById('section-configuracion');
  if (!section) return null;
  root = document.createElement('div');
  root.id = ROOT_ID;
  section.appendChild(root);
  return root;
}

function setMessage(text, isError = false) {
  const el = document.getElementById('tt-coupons-msg');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? 'var(--adm-danger, #b3261e)' : 'var(--adm-muted)';
}

function renderList(root) {
  const rows = coupons.map(coupon => `<tr>
    <td style="padding:9px"><strong>${esc(coupon.code)}</strong>${coupon.description ? `<div style="color:var(--adm-muted);font-size:11.5px">${esc(coupon.description)}</div>` : ''}</td>
    <td style="padding:9px">${coupon.active ? 'Activo' : 'Pausado'}</td>
    <td style="padding:9px">${esc(dateOnly(coupon.startsAt) || '—')} → ${esc(dateOnly(coupon.endsAt) || '—')}</td>
    <td style="padding:9px">${Number(coupon.usedCount || 0)} / ${esc(limitLabel(coupon.maxUses))}</td>
    <td style="padding:9px">${esc(limitLabel(coupon.maxUsesPerCustomer))}</td>
    <td style="padding:9px;white-space:nowrap">
      <button type="button" class="adm-btn adm-btn-sm" data-coupon-edit="${esc(coupon.code)}">Editar</button>
      <button type="button" class="adm-btn adm-btn-sm" data-coupon-toggle="${esc(coupon.code)}">${coupon.active ? 'Pausar' : 'Activar'}</button>
      <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-coupon-delete="${esc(coupon.code)}">Eliminar</button>
    </td></tr>`).join('');
  root.innerHTML = `<div class="adm-card">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
      <div class="adm-card-title">Cupones de envío gratis</div>
      <button type="button" class="adm-btn adm-btn-primary" id="tt-coupons-new">+ Nuevo cupón</button>
    </div>
    <p style="color:var(--adm-muted);font-size:12.5px;margin:6px 0 12px">Quitan el costo de envío de pedidos con delivery. Los límites y las fechas se validan en el servidor al crear el pedido.</p>
    <p id="tt-coupons-msg" role="status" aria-live="polite" style="font-size:12.5px;margin:0 0 8px"></p>
    <div style="overflow:auto;border:1px solid var(--adm-border);border-radius:10px"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:640px"><thead><tr>
      <th style="text-align:left;padding:9px">Código</th><th style="text-align:left;padding:9px">Estado</th><th style="text-align:left;padding:9px">Vigencia</th><th style="text-align:left;padding:9px">Usos / máx.</th><th style="text-align:left;padding:9px">Por cliente</th><th style="padding:9px"></th>
    </tr></thead><tbody>${rows || '<tr><td colspan="6" style="padding:14px;color:var(--adm-muted)">Todavía no hay cupones.</td></tr>'}</tbody></table></div>
  </div>`;
  root.querySelector('#tt-coupons-new')?.addEventListener('click', () => { editing = {}; render(); });
  root.querySelectorAll('[data-coupon-edit]').forEach(btn => btn.addEventListener('click', () => {
    editing = coupons.find(c => c.code === btn.dataset.couponEdit) || null;
    render();
  }));
  root.querySelectorAll('[data-coupon-toggle]').forEach(btn => btn.addEventListener('click', () => toggle(btn.dataset.couponToggle)));
  root.querySelectorAll('[data-coupon-delete]').forEach(btn => btn.addEventListener('click', () => remove(btn.dataset.couponDelete)));
}

function renderForm(root) {
  const isNew = !editing.code;
  const c = editing;
  root.innerHTML = `<div class="adm-card">
    <div class="adm-card-title">${isNew ? 'Nuevo cupón' : `Editar cupón ${esc(c.code)}`}</div>
    <form id="tt-coupons-form" style="display:grid;gap:12px;max-width:520px;margin-top:10px" novalidate>
      <label>Código<input class="adm-input" id="tt-coupon-code" maxlength="32" value="${esc(c.code || '')}" ${isNew ? '' : 'disabled'} placeholder="Ej: ENVIOGRATIS" style="text-transform:uppercase"></label>
      <label>Descripción (opcional)<input class="adm-input" id="tt-coupon-description" maxlength="200" value="${esc(c.description || '')}"></label>
      <label>Válido desde (opcional)<input class="adm-input" type="date" id="tt-coupon-starts" value="${esc(dateOnly(c.startsAt))}"></label>
      <label>Válido hasta (opcional)<input class="adm-input" type="date" id="tt-coupon-ends" value="${esc(dateOnly(c.endsAt))}"></label>
      <label>Usos máximos en total (0 = sin límite)<input class="adm-input" type="number" min="0" max="1000000" step="1" id="tt-coupon-max" value="${Number(c.maxUses || 0)}"></label>
      <label>Usos máximos por cliente (0 = sin límite)<input class="adm-input" type="number" min="0" max="1000" step="1" id="tt-coupon-max-customer" value="${Number(c.maxUsesPerCustomer || 0)}"></label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="tt-coupon-active" ${c.active !== false ? 'checked' : ''}> Activo</label>
      <p id="tt-coupons-msg" role="status" aria-live="polite" style="font-size:12.5px;margin:0"></p>
      <div style="display:flex;gap:8px"><button type="submit" class="adm-btn adm-btn-primary">Guardar</button><button type="button" class="adm-btn" id="tt-coupons-cancel">Cancelar</button></div>
    </form></div>`;
  root.querySelector('#tt-coupons-cancel')?.addEventListener('click', () => { editing = null; render(); });
  root.querySelector('#tt-coupons-form')?.addEventListener('submit', event => { event.preventDefault(); void save(isNew); });
}

function render() {
  const root = ensureRoot();
  if (!root) return;
  if (!isSuperAdmin(auth.currentUser)) { root.innerHTML = ''; return; }
  if (editing) renderForm(root); else renderList(root);
}

function intField(id, max) {
  const value = Number(document.getElementById(id)?.value || 0);
  return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

async function save(isNew) {
  const code = (editing.code || document.getElementById('tt-coupon-code')?.value || '').trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return setMessage('El código debe tener 3 a 32 caracteres: letras, números, guion o guion bajo.', true);
  if (isNew && coupons.some(c => c.code === code)) return setMessage('Ya existe un cupón con ese código.', true);
  const maxUses = intField('tt-coupon-max', 1000000);
  const maxUsesPerCustomer = intField('tt-coupon-max-customer', 1000);
  if (maxUses === null || maxUsesPerCustomer === null) return setMessage('Los límites deben ser números enteros iguales o mayores a 0.', true);
  const startsAt = document.getElementById('tt-coupon-starts')?.value || null;
  const endsAt = document.getElementById('tt-coupon-ends')?.value || null;
  if (startsAt && endsAt && endsAt < startsAt) return setMessage('La fecha final no puede ser anterior a la inicial.', true);
  const actor = String(auth.currentUser?.email || '').toLowerCase();
  const data = {
    code,
    type: 'free_shipping',
    active: document.getElementById('tt-coupon-active')?.checked === true,
    description: String(document.getElementById('tt-coupon-description')?.value || '').trim().slice(0, 200),
    startsAt,
    endsAt,
    maxUses,
    maxUsesPerCustomer,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };
  try {
    if (isNew) await setDoc(doc(db, 'coupons', code), { ...data, usedCount: 0, createdAt: serverTimestamp(), createdBy: actor });
    else await updateDoc(doc(db, 'coupons', code), data);
    editing = null;
    render();
    setMessage(`Cupón ${code} guardado.`);
  } catch (error) {
    setMessage(error?.code === 'permission-denied' ? 'No tenés permiso para guardar cupones (¿reglas sin publicar?).' : 'No se pudo guardar el cupón. Intentá de nuevo.', true);
  }
}

async function toggle(code) {
  const coupon = coupons.find(c => c.code === code);
  if (!coupon) return;
  try {
    await updateDoc(doc(db, 'coupons', code), { active: !coupon.active, updatedAt: serverTimestamp(), updatedBy: String(auth.currentUser?.email || '').toLowerCase() });
  } catch {
    setMessage('No se pudo cambiar el estado del cupón.', true);
  }
}

async function remove(code) {
  if (!window.confirm(`¿Eliminar el cupón ${code}? Los pedidos que ya lo usaron conservan su descuento.`)) return;
  try {
    await deleteDoc(doc(db, 'coupons', code));
  } catch {
    setMessage('No se pudo eliminar el cupón.', true);
  }
}

async function start() {
  if (unsubscribe || !isSuperAdmin(auth.currentUser)) return;
  if (!await waitForAdminAppCheck(12000) || !isSuperAdmin(auth.currentUser) || unsubscribe) return;
  unsubscribe = onSnapshot(
    collection(db, 'coupons'),
    snapshot => {
      coupons = snapshot.docs.map(d => ({ code: d.id, ...d.data() })).sort((a, b) => a.code.localeCompare(b.code));
      if (!editing) render();
    },
    () => { coupons = []; if (!editing) { render(); setMessage('No se pudieron leer los cupones.', true); } },
  );
}

function stop() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  coupons = [];
  editing = null;
  document.getElementById(ROOT_ID)?.replaceChildren();
}

subscribeAuthState(() => {
  if (isSuperAdmin(auth.currentUser)) void start(); else stop();
});
