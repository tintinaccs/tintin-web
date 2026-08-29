/* =============================================================
   TINTIN — Super Admin: Cupones y descuentos
   =============================================================
   Módulo independiente para el CRUD de cupones (coupons/{CODE}).
   Se inserta solo en admin.html y solo para la cuenta Super Admin real,
   igual que el resto de los módulos de configuración (mensaje de
   bienvenida, apariencia, etc).
   ============================================================= */

import { auth } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';

(function () {
  'use strict';
  if (window.TintinAdminCouponsBooted) return;
  window.TintinAdminCouponsBooted = true;

  const isAdminPage = /(^|\/)admin\.html$/i.test(location.pathname) || location.pathname.endsWith('/admin');
  if (!isAdminPage) return;

  let coupons = [];
  let editingCode = null;

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function formatPrice(value) {
    return 'Gs. ' + Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatDate(value) {
    if (!value) return 'Sin vencimiento';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin vencimiento' : date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function toast(msg, duration = 3200) {
    const el = document.getElementById('adm-toast');
    if (!el) { console.log('[Cupones]', msg); return; }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._ttCouponsTimer);
    el._ttCouponsTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  async function api(input) {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no disponible');
    const token = await user.getIdToken();
    const response = await fetch('/api/admin-coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo completar la acción.');
    return result;
  }

  function injectStyles() {
    if (document.getElementById('tt-admin-coupons-style')) return;
    const st = document.createElement('style');
    st.id = 'tt-admin-coupons-style';
    st.textContent = `#section-cupones{display:none}.adm-section.active#section-cupones{display:block}.tt-cp-card{background:#fff;border:1px solid rgba(184,76,114,.12);border-radius:22px;box-shadow:0 14px 38px rgba(139,38,66,.08);padding:20px;margin-bottom:18px}.tt-cp-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}.tt-cp-title{font-size:18px;font-weight:900;color:#2B2B2B;margin:0}.tt-cp-sub{font-size:13px;color:#7B6F72;margin:6px 0 0}.tt-cp-btn{min-height:40px;border:0;border-radius:999px;padding:9px 16px;font-family:Montserrat;font-size:12px;font-weight:900;cursor:pointer;background:#f8e8ef;color:#2B2B2B}.tt-cp-btn.primary{background:#AD3F67;color:#fff;box-shadow:0 10px 24px rgba(212,106,138,.20)}.tt-cp-btn.danger{background:#fff0f0;color:#c0392b}.tt-cp-btn:disabled{opacity:.55;cursor:not-allowed}.tt-cp-table-wrap{overflow-x:auto}.tt-cp-table{width:100%;border-collapse:collapse;font-size:13px}.tt-cp-table th{text-align:left;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#7B6F72;padding:8px 10px;border-bottom:1px solid rgba(184,76,114,.14)}.tt-cp-table td{padding:10px;border-bottom:1px solid rgba(184,76,114,.08);vertical-align:middle}.tt-cp-code{font-weight:900;letter-spacing:.02em}.tt-cp-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800}.tt-cp-badge.active{background:#e8f5e9;color:#2e7d32}.tt-cp-badge.inactive{background:#f1f1f1;color:#777}.tt-cp-badge.expired{background:#fff0f0;color:#c0392b}.tt-cp-row-actions{display:flex;gap:8px;flex-wrap:wrap}.tt-cp-empty{text-align:center;color:#7B6F72;padding:28px}.tt-cp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.tt-cp-field{display:flex;flex-direction:column;gap:6px}.tt-cp-field label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#2B2B2B}.tt-cp-field input,.tt-cp-field select{width:100%;border:1.5px solid rgba(184,76,114,.18);border-radius:12px;padding:10px 12px;font-family:Montserrat;font-size:13px;outline:none;background:#fffdfd;color:#2B2B2B;box-sizing:border-box}.tt-cp-field input:focus,.tt-cp-field select:focus{border-color:#AD3F67;box-shadow:0 0 0 3px rgba(212,106,138,.10)}.tt-cp-field input:disabled{background:#f4f4f4;color:#999}.tt-cp-hint{font-size:11px;color:#a98b95}.tt-cp-switch-row{display:flex;align-items:center;gap:8px;padding-top:22px}.tt-cp-error{color:#c0392b;font-size:13px;margin-top:12px;padding:10px;background:#fff5f5;border-radius:8px}.tt-cp-actions-bar{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}@media(max-width:820px){.tt-cp-form-grid{grid-template-columns:1fr}.tt-cp-head{align-items:flex-start;flex-direction:column}}`;
    document.head.appendChild(st);
  }

  function ensureNav() {
    const nav = document.getElementById('adm-nav');
    if (nav && !document.getElementById('nav-cupones')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'adm-nav-item';
      btn.id = 'nav-cupones';
      btn.dataset.section = 'cupones';
      btn.innerHTML = '<span class="adm-nav-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H6a2 2 0 00-2 2v3a2 2 0 010 4v3a2 2 0 002 2h3a2 2 0 014 0h3a2 2 0 002-2v-3a2 2 0 010-4V7a2 2 0 00-2-2h-3a2 2 0 01-4 0z"/></svg></span> Cupones';
      const config = document.getElementById('nav-config');
      nav.insertBefore(btn, config?.parentElement === nav ? config : null);
    }
    const tabs = document.getElementById('adm-mobile-tabs');
    if (tabs && !document.getElementById('mtab-cupones')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'adm-mobile-tab';
      btn.id = 'mtab-cupones';
      btn.dataset.section = 'cupones';
      btn.innerHTML = '<span class="adm-nav-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H6a2 2 0 00-2 2v3a2 2 0 010 4v3a2 2 0 002 2h3a2 2 0 014 0h3a2 2 0 002-2v-3a2 2 0 010-4V7a2 2 0 00-2-2h-3a2 2 0 01-4 0z"/></svg></span>Cupones';
      const config = document.getElementById('mtab-config');
      tabs.insertBefore(btn, config?.parentElement === tabs ? config : null);
    }
  }

  function ensureSection() {
    const content = document.querySelector('.adm-content');
    if (!content || document.getElementById('section-cupones')) return;
    const section = document.createElement('div');
    section.className = 'adm-section';
    section.id = 'section-cupones';
    section.innerHTML = '<div class="adm-loading"><span class="adm-spinner"></span> Cargando módulo...</div>';
    content.appendChild(section);
  }

  function openSection() {
    document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.adm-nav-item,.adm-mobile-tab').forEach(b => {
      b.classList.remove('active');
      b.removeAttribute('aria-current');
    });
    document.getElementById('section-cupones')?.classList.add('active');
    ['nav-cupones', 'mtab-cupones'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('active'); el.setAttribute('aria-current', 'page'); }
    });
    const title = document.getElementById('adm-topbar-title');
    if (title) title.textContent = 'Cupones';
    document.getElementById('adm-sidebar')?.classList.remove('open');
    document.getElementById('adm-overlay')?.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function wireNavigation() {
    ['nav-cupones', 'mtab-cupones'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._ttCouponsWired) {
        el._ttCouponsWired = true;
        el.addEventListener('click', e => {
          e.preventDefault();
          window.AdminUnsaved
            ? window.AdminUnsaved.requestNavigation(openSection)
            : openSection();
        });
      }
    });
  }

  async function loadCoupons() {
    const result = await api({ action: 'list' });
    coupons = Array.isArray(result.items) ? result.items : [];
  }

  function couponStatus(coupon) {
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return { label: 'Vencido', tone: 'expired' };
    if (!coupon.active) return { label: 'Inactivo', tone: 'inactive' };
    return { label: 'Activo', tone: 'active' };
  }

  function valueLabel(coupon) {
    return coupon.type === 'percent' ? `${coupon.value}%` : formatPrice(coupon.value);
  }

  function usesLabel(coupon) {
    const used = Number(coupon.usedCount || 0);
    return coupon.maxUses ? `${used} / ${coupon.maxUses}` : `${used} (sin límite)`;
  }

  function renderRow(coupon) {
    const status = couponStatus(coupon);
    return `<tr data-code="${escapeHtml(coupon.code)}">
      <td class="tt-cp-code">${escapeHtml(coupon.code)}</td>
      <td>${coupon.type === 'percent' ? 'Porcentaje' : 'Monto fijo'}</td>
      <td>${escapeHtml(valueLabel(coupon))}</td>
      <td>${coupon.minPurchase ? formatPrice(coupon.minPurchase) : '—'}</td>
      <td>${usesLabel(coupon)}</td>
      <td>${formatDate(coupon.expiresAt)}</td>
      <td><span class="tt-cp-badge ${status.tone}">${status.label}</span></td>
      <td><div class="tt-cp-row-actions">
        <button type="button" class="tt-cp-btn" data-action="edit">Editar</button>
        <button type="button" class="tt-cp-btn" data-action="toggle">${coupon.active ? 'Desactivar' : 'Activar'}</button>
        <button type="button" class="tt-cp-btn danger" data-action="delete">Eliminar</button>
      </div></td>
    </tr>`;
  }

  function renderList() {
    const section = document.getElementById('section-cupones');
    if (!section) return;
    section.innerHTML = `
      <div class="tt-cp-card">
        <div class="tt-cp-head">
          <div>
            <h2 class="tt-cp-title">Cupones y descuentos</h2>
            <p class="tt-cp-sub">Códigos de descuento aplicables en el checkout. El servidor valida y descuenta el uso al confirmar cada pedido.</p>
          </div>
          <button type="button" class="tt-cp-btn primary" id="cp-new">+ Nuevo cupón</button>
        </div>
        <div class="tt-cp-table-wrap">
          ${coupons.length ? `<table class="tt-cp-table"><thead><tr>
            <th>Código</th><th>Tipo</th><th>Valor</th><th>Compra mín.</th><th>Usos</th><th>Vence</th><th>Estado</th><th>Acciones</th>
          </tr></thead><tbody>${coupons.map(renderRow).join('')}</tbody></table>`
            : '<div class="tt-cp-empty">Todavía no hay cupones. Creá el primero con "+ Nuevo cupón".</div>'}
        </div>
      </div>`;
    wireList();
  }

  function renderForm(coupon = null) {
    editingCode = coupon?.code || null;
    const section = document.getElementById('section-cupones');
    if (!section) return;
    section.innerHTML = `
      <div class="tt-cp-card">
        <div class="tt-cp-head">
          <h2 class="tt-cp-title">${coupon ? `Editar cupón ${escapeHtml(coupon.code)}` : 'Nuevo cupón'}</h2>
          <button type="button" class="tt-cp-btn" id="cp-back">← Volver</button>
        </div>
        <div class="tt-cp-form-grid">
          <div class="tt-cp-field">
            <label>Código *</label>
            <input id="cp-code" value="${escapeHtml(coupon?.code || '')}" maxlength="40" placeholder="Ej: VERANO20" ${coupon ? 'disabled' : ''}>
            <span class="tt-cp-hint">3 a 40 caracteres: letras, números, "-" o "_". No se puede cambiar luego de creado.</span>
          </div>
          <div class="tt-cp-field">
            <label>Tipo de descuento *</label>
            <select id="cp-type">
              <option value="percent" ${coupon?.type !== 'fixed' ? 'selected' : ''}>Porcentaje</option>
              <option value="fixed" ${coupon?.type === 'fixed' ? 'selected' : ''}>Monto fijo (Gs.)</option>
            </select>
          </div>
          <div class="tt-cp-field">
            <label id="cp-value-label">Valor *</label>
            <input id="cp-value" type="number" min="0" step="any" value="${coupon?.value ?? ''}" placeholder="Ej: 20">
          </div>
          <div class="tt-cp-field">
            <label>Compra mínima (Gs.)</label>
            <input id="cp-min" type="number" min="0" step="1" value="${coupon?.minPurchase ?? ''}" placeholder="0 = sin mínimo">
          </div>
          <div class="tt-cp-field">
            <label>Límite de usos</label>
            <input id="cp-max-uses" type="number" min="1" step="1" value="${coupon?.maxUses ?? ''}" placeholder="Vacío = sin límite">
          </div>
          <div class="tt-cp-field">
            <label>Vencimiento</label>
            <input id="cp-expires" type="date" value="${coupon?.expiresAt ? String(coupon.expiresAt).slice(0, 10) : ''}">
          </div>
          <div class="tt-cp-switch-row">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
              <input id="cp-active" type="checkbox" ${coupon?.active !== false ? 'checked' : ''}> Activo
            </label>
          </div>
        </div>
        <div id="cp-form-error" class="tt-cp-error" style="display:none"></div>
        <div class="tt-cp-actions-bar">
          <button type="button" class="tt-cp-btn primary" id="cp-save">Guardar cupón</button>
          <button type="button" class="tt-cp-btn" id="cp-cancel">Cancelar</button>
        </div>
      </div>`;
    wireForm();
  }

  function showFormError(msg) {
    const el = document.getElementById('cp-form-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function wireForm() {
    document.getElementById('cp-back')?.addEventListener('click', renderList);
    document.getElementById('cp-cancel')?.addEventListener('click', renderList);
    document.getElementById('cp-save')?.addEventListener('click', async () => {
      const button = document.getElementById('cp-save');
      const input = {
        code: document.getElementById('cp-code')?.value || '',
        type: document.getElementById('cp-type')?.value || 'percent',
        value: document.getElementById('cp-value')?.value,
        minPurchase: document.getElementById('cp-min')?.value,
        maxUses: document.getElementById('cp-max-uses')?.value,
        expiresAt: document.getElementById('cp-expires')?.value,
        active: !!document.getElementById('cp-active')?.checked,
      };
      button.disabled = true;
      button.textContent = 'Guardando...';
      try {
        await api({ action: editingCode ? 'update' : 'create', ...input });
        toast(editingCode ? 'Cupón actualizado' : 'Cupón creado');
        await loadCoupons();
        renderList();
      } catch (error) {
        showFormError(error.message || 'No se pudo guardar el cupón.');
        button.disabled = false;
        button.textContent = 'Guardar cupón';
      }
    });
  }

  function wireList() {
    document.getElementById('cp-new')?.addEventListener('click', () => renderForm());
    document.querySelectorAll('.tt-cp-table [data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('tr');
        const code = row?.dataset.code;
        const coupon = coupons.find(c => c.code === code);
        if (!coupon) return;
        const action = btn.dataset.action;
        if (action === 'edit') { renderForm(coupon); return; }
        if (action === 'toggle') {
          try {
            await api({ action: 'update', ...coupon, active: !coupon.active });
            toast(coupon.active ? 'Cupón desactivado' : 'Cupón activado');
            await loadCoupons();
            renderList();
          } catch (error) { toast(error.message || 'No se pudo actualizar el cupón.', 4200); }
          return;
        }
        if (action === 'delete') {
          if (!confirm(`¿Eliminar el cupón ${coupon.code}? Esta acción no se puede deshacer.`)) return;
          try {
            await api({ action: 'delete', code: coupon.code });
            toast('Cupón eliminado');
            await loadCoupons();
            renderList();
          } catch (error) { toast(error.message || 'No se pudo eliminar el cupón.', 4200); }
        }
      });
    });
  }

  async function boot(user) {
    if (!user || String(user.email || '').toLowerCase() !== SUPER_ADMIN) return;
    injectStyles(); ensureNav(); ensureSection(); wireNavigation();
    try { await loadCoupons(); renderList(); }
    catch (error) {
      console.error('[admin-coupons] No se pudo cargar cupones:', error);
      const section = document.getElementById('section-cupones');
      if (section) section.innerHTML = '<div class="adm-empty">No se pudo cargar el módulo de cupones.</div>';
    }
  }

  onAuthStateChanged(auth, user => boot(user));
})();
