/* =============================================================
   TINTIN — Super Admin: Mensaje de bienvenida
   =============================================================
   Módulo independiente para configurar el tutorial/mensajes de bienvenida.
   Se inserta solo en admin.html y solo para la cuenta Super Admin real.
   ============================================================= */

import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-3';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, doc, getDoc, setDoc, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { getDocsPaginated } from '../../core/firebase/paginacion-firestore.js?v=tintin-20260716-cloudinary-fix-1';
import {
  defaultWelcomeSteps,
  normalizeWelcomeConfig,
  normalizeWelcomeStep
} from '../../components/welcome/configuracion-bienvenida.js?v=tintin-20260812-welcome-media-1';

const REF = doc(db, 'settings', 'welcomeTutorial');

(function () {
  'use strict';
  if (window.TintinAdminWelcomeControlBooted) return;
  window.TintinAdminWelcomeControlBooted = true;

  const isAdminPage = /(^|\/)admin\.html$/i.test(location.pathname) || location.pathname.endsWith('/admin');
  if (!isAdminPage) return;

  let state = {
    enabled: true,
    previewEnabled: true,
    title: 'Mensaje de bienvenida',
    subtitle: 'Tu primera guía Tintin',
    steps: defaultWelcomeSteps()
  };

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function uid() {
    return 'welcome-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function cleanStep(step = {}, index = 0) {
    return normalizeWelcomeStep({ ...step, id: step.id || uid() }, index);
  }

  function normalizeConfig(data = {}) {
    const normalized = normalizeWelcomeConfig(data);
    return { ...normalized, steps: normalized.steps.map(cleanStep) };
  }

  function toast(msg, duration = 2800) {
    const el = document.getElementById('adm-toast');
    if (!el) { console.log('[Welcome]', msg); return; }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._ttWelcomeTimer);
    el._ttWelcomeTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function injectStyles() {
    if (document.getElementById('tt-admin-welcome-style')) return;
    const st = document.createElement('style');
    st.id = 'tt-admin-welcome-style';
    st.textContent = `#section-welcome{display:none}.adm-section.active#section-welcome{display:block}.tt-welcome-admin-grid{display:grid;grid-template-columns:1fr;gap:18px;align-items:start}.tt-welcome-admin-main,.tt-welcome-admin-side{display:grid;gap:18px;min-width:0}.tt-welcome-admin-card{background:#fff;border:1px solid rgba(184,76,114,.12);border-radius:22px;box-shadow:0 14px 38px rgba(139,38,66,.08);padding:20px}.tt-welcome-admin-title{font-size:20px;font-weight:900;color:#2B2B2B;margin:0}.tt-welcome-admin-sub{font-size:13px;color:#2B2B2B;margin:6px 0 0;line-height:1.55}.tt-welcome-admin-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.tt-welcome-admin-field{display:flex;flex-direction:column;gap:7px;position:relative}.tt-welcome-admin-field label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#2B2B2B}.tt-welcome-admin-field input,.tt-welcome-admin-field textarea{width:100%;border:1.5px solid rgba(184,76,114,.18);border-radius:14px;padding:11px 12px;font-family:Montserrat;font-size:13px;outline:none;background:#fffdfd;color:#2B2B2B;box-sizing:border-box}.tt-welcome-admin-field textarea{min-height:86px;resize:vertical}.tt-welcome-admin-field input:focus,.tt-welcome-admin-field textarea:focus{border-color:#AD3F67;box-shadow:0 0 0 3px rgba(212,106,138,.10)}.tt-welcome-counter{align-self:flex-end;font-size:10px;font-weight:700;color:#a98b95}.tt-welcome-image-row{display:flex;align-items:center;gap:10px}.tt-welcome-image-row input{flex:1}.tt-welcome-image-thumb{width:40px;height:40px;border-radius:10px;object-fit:cover;border:1.5px solid rgba(184,76,114,.18);flex-shrink:0}.tt-welcome-admin-switches{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.tt-welcome-pill{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border-radius:999px;background:#fff3f7;border:1px solid rgba(184,76,114,.15);font-size:12px;font-weight:800;color:#2B2B2B}.tt-welcome-pill input{accent-color:#AD3F67}.tt-welcome-step-card{border:1px solid rgba(184,76,114,.13);border-radius:18px;padding:14px;background:linear-gradient(180deg,#fff,#fff8fb);display:grid;gap:12px;transition:opacity .15s ease,border-color .15s ease}.tt-welcome-step-card.dragging{opacity:.4}.tt-welcome-step-card.drag-over{border-color:#AD3F67;box-shadow:0 0 0 2px rgba(173,63,103,.2) inset}.tt-welcome-step-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.tt-welcome-step-drag{cursor:grab;font-size:16px;color:#c07d94;padding:4px 6px;line-height:1;user-select:none}.tt-welcome-step-badge{font-size:11px;font-weight:900;color:#2B2B2B;text-transform:uppercase;letter-spacing:.08em;margin-right:auto}.tt-welcome-step-actions{display:flex;gap:8px;flex-wrap:wrap}.tt-welcome-btn{min-height:44px;border:0;border-radius:999px;padding:10px 14px;font-family:Montserrat;font-size:12px;font-weight:900;cursor:pointer;background:#f8e8ef;color:#2B2B2B}.tt-welcome-btn.primary{background:#AD3F67;color:#fff;box-shadow:0 10px 24px rgba(212,106,138,.20)}.tt-welcome-btn.danger{background:#fff0f0;color:#2B2B2B}.tt-welcome-btn.dark{background:#2B2B2B;color:#fff}.tt-welcome-btn:disabled{opacity:.55;cursor:not-allowed}.tt-welcome-admin-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:18px}.tt-welcome-empty{text-align:center;color:#2B2B2B;padding:22px;border:1px dashed rgba(184,76,114,.25);border-radius:18px;background:#fff8fb}.tt-welcome-preview-note{font-size:12px;line-height:1.6;color:#2B2B2B;background:#fff6f9;border-left:4px solid #AD3F67;padding:12px 14px;border-radius:14px;margin-top:12px}.tt-welcome-preview-card{position:sticky;top:20px}.tt-welcome-mini-card{border-radius:22px;overflow:hidden;border:1.5px solid rgba(255,182,200,.8);box-shadow:0 14px 40px rgba(139,38,66,.16)}.tt-welcome-mini-top{background:linear-gradient(135deg,#F6B7C8,#FDECF2);padding:20px 18px 14px;text-align:center}.tt-welcome-mini-icon{width:56px;height:56px;border-radius:50%;background:#fff;display:grid;place-items:center;margin:0 auto 10px;font-size:28px;box-shadow:0 8px 22px rgba(212,106,138,.18);overflow:hidden}.tt-welcome-mini-icon.has-image{font-size:0}.tt-welcome-mini-icon-img{width:100%;height:100%;object-fit:cover;border-radius:50%}.tt-welcome-mini-icon-fallback{width:100%;height:100%;display:grid;place-items:center;font-size:28px}.tt-welcome-mini-title{font-family:Montserrat;font-size:22px;line-height:1.1;margin:0;color:#2B2B2B;font-weight:800}.tt-welcome-mini-sub{margin:6px auto 0;color:#2B2B2B;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.tt-welcome-mini-body{padding:18px;background:#fff}.tt-welcome-mini-steptitle{font-size:15px;font-weight:900;color:#2B2B2B;margin:0 0 6px;text-align:center}.tt-welcome-mini-text{font-size:13px;line-height:1.6;color:#7B6F72;text-align:center;margin:0}.tt-welcome-mini-dots{display:flex;justify-content:center;gap:6px;margin:16px 0 0}.tt-welcome-mini-dot{width:6px;height:6px;border-radius:999px;background:#FAD6DF}.tt-welcome-mini-dot.active{width:18px;background:#AD3F67}.tt-welcome-mini-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}.tt-welcome-mini-btn{min-height:36px;border:0;border-radius:999px;padding:8px 14px;font-family:Montserrat;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;background:#FDECF2;color:#2B2B2B}.tt-welcome-mini-btn-primary{background:#AD3F67;color:#fff}.tt-welcome-mini-btn:disabled{opacity:.4;cursor:not-allowed}.tt-welcome-mini-caption{font-size:11px;color:#a98b95;text-align:center;margin:10px 0 0}@media(min-width:1100px){.tt-welcome-admin-grid{grid-template-columns:1fr 380px}}@media(max-width:820px){.tt-welcome-admin-row{grid-template-columns:1fr}.tt-welcome-admin-card{padding:16px;border-radius:18px}.tt-welcome-step-head{align-items:flex-start;flex-direction:column}.tt-welcome-admin-actions{flex-direction:column}.tt-welcome-btn{width:100%}}`;
    document.head.appendChild(st);
  }

  function ensureNav() {
    const nav = document.getElementById('adm-nav');
    if (nav && !document.getElementById('nav-welcome')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'adm-nav-item';
      btn.id = 'nav-welcome';
      btn.dataset.section = 'welcome';
      btn.innerHTML = '<span class="adm-nav-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6l9 7 9-7"/></svg></span> Mensaje bienvenida';
      const config = document.getElementById('nav-config');
      nav.insertBefore(btn, config?.parentElement === nav ? config : null);
    }
    const tabs = document.getElementById('adm-mobile-tabs');
    if (tabs && !document.getElementById('mtab-welcome')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'adm-mobile-tab';
      btn.id = 'mtab-welcome';
      btn.dataset.section = 'welcome';
      btn.innerHTML = '<span class="adm-nav-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6l9 7 9-7"/></svg></span>Bienvenida';
      const config = document.getElementById('mtab-config');
      tabs.insertBefore(btn, config?.parentElement === tabs ? config : null);
    }
  }

  function ensureSection() {
    const content = document.querySelector('.adm-content');
    if (!content || document.getElementById('section-welcome')) return;
    const section = document.createElement('div');
    section.className = 'adm-section';
    section.id = 'section-welcome';
    section.innerHTML = '<div class="adm-loading"><span class="adm-spinner"></span> Cargando módulo...</div>';
    content.appendChild(section);
  }

  function openSection() {
    document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.adm-nav-item,.adm-mobile-tab').forEach(b => {
      b.classList.remove('active');
      b.removeAttribute('aria-current');
    });
    document.getElementById('section-welcome')?.classList.add('active');
    ['nav-welcome', 'mtab-welcome'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('active'); el.setAttribute('aria-current', 'page'); }
    });
    const title = document.getElementById('adm-topbar-title');
    if (title) title.textContent = 'Mensaje de bienvenida';
    document.getElementById('adm-sidebar')?.classList.remove('open');
    document.getElementById('adm-overlay')?.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function wireNavigation() {
    ['nav-welcome', 'mtab-welcome'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._ttWelcomeWired) {
        el._ttWelcomeWired = true;
        el.addEventListener('click', e => {
          e.preventDefault();
          window.AdminUnsaved
            ? window.AdminUnsaved.requestNavigation(openSection)
            : openSection();
        });
      }
    });
  }

  async function loadConfig() {
    const snap = await getDoc(REF);
    state = normalizeConfig(snap.exists() ? snap.data() : {});
  }

  async function saveConfig() {
    state.title = document.getElementById('welcome-title')?.value?.trim() || 'Mensaje de bienvenida';
    state.subtitle = document.getElementById('welcome-subtitle')?.value?.trim() || 'Tu primera guía Tintin';
    state.enabled = !!document.getElementById('welcome-enabled')?.checked;
    state.previewEnabled = !!document.getElementById('welcome-preview-enabled')?.checked;
    state.steps = [...document.querySelectorAll('.tt-welcome-step-card')].map((card, index) => cleanStep({
      id: card.dataset.id,
      icon: card.querySelector('[data-field="icon"]')?.value,
      image: card.querySelector('[data-field="image"]')?.value,
      title: card.querySelector('[data-field="title"]')?.value,
      text: card.querySelector('[data-field="text"]')?.value,
      cta: card.querySelector('[data-field="cta"]')?.value,
      active: card.querySelector('[data-field="active"]')?.checked
    }, index));
    if (state.enabled && !state.steps.some(step => step.active)) {
      toast('Activá al menos un mensaje antes de guardar.', 4200);
      return false;
    }
    await setDoc(REF, { ...state, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || 'superadmin' }, { merge: true });
    toast('Mensaje de bienvenida guardado');
    window.AdminUnsaved?.markClean('welcome-config');
    return true;
  }

  async function resetWelcomeForClients() {
    if (!confirm('¿Mostrar nuevamente la bienvenida a todas las clientas? Se aplicará en su próximo ingreso a la página principal.')) return;
    const snapshot = await getDocsPaginated(collection(db, 'users'), {
      pageSize: 500,
      maxDocs: 20000
    });
    if (snapshot.truncated) {
      toast('Hay más de 20.000 usuarios. Reactivá la bienvenida por segmentos para evitar una operación demasiado grande.');
      return;
    }
    const clients = snapshot.docs.filter(item => (item.data().role || 'client') === 'client');
    for (let offset = 0; offset < clients.length; offset += 450) {
      const batch = writeBatch(db);
      clients.slice(offset, offset + 450).forEach(item => {
        batch.update(item.ref, {
          onboardingCompleted: false,
          onboardingCompletedAt: null,
          welcomeTutorialSeen: false,
          welcomeTutorialPending: true,
          welcomeTutorialCompletedAt: null,
          welcomeTutorialClosedReason: '',
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
    toast(`Bienvenida reactivada para ${clients.length} clienta${clients.length === 1 ? '' : 's'}`);
  }

  function counter(value, max) {
    return `<span class="tt-welcome-counter" data-counter-for="${max}">${String(value || '').length}/${max}</span>`;
  }

  function renderStep(step, index) {
    const thumbVisible = step.image ? 'block' : 'none';
    return `<div class="tt-welcome-step-card" data-id="${escapeHtml(step.id)}" draggable="true"><div class="tt-welcome-step-head"><div class="tt-welcome-step-drag" draggable="true" title="Arrastrá para reordenar" aria-hidden="true">⠿</div><div class="tt-welcome-step-badge">Mensaje ${index + 1}</div><div class="tt-welcome-step-actions"><button type="button" class="tt-welcome-btn" data-action="up" ${index === 0 ? 'disabled' : ''} aria-label="Subir mensaje">Subir</button><button type="button" class="tt-welcome-btn" data-action="down" ${index === state.steps.length - 1 ? 'disabled' : ''} aria-label="Bajar mensaje">Bajar</button><button type="button" class="tt-welcome-btn" data-action="duplicate" aria-label="Duplicar mensaje">Duplicar</button><button type="button" class="tt-welcome-btn danger" data-action="delete" aria-label="Eliminar mensaje">Eliminar</button></div></div><div class="tt-welcome-admin-row"><div class="tt-welcome-admin-field"><label>Icono (emoji)</label><input data-field="icon" value="${escapeHtml(step.icon)}" maxlength="8">${counter(step.icon, 8)}</div><div class="tt-welcome-admin-field"><label>Botón</label><input data-field="cta" value="${escapeHtml(step.cta)}" maxlength="40">${counter(step.cta, 40)}</div></div><div class="tt-welcome-admin-field"><label>Imagen del paso (opcional, reemplaza el emoji)</label><div class="tt-welcome-image-row"><input data-field="image" value="${escapeHtml(step.image || '')}" placeholder="https://..." inputmode="url"><img class="tt-welcome-image-thumb" data-thumb style="display:${thumbVisible}" src="${escapeHtml(step.image || '')}" alt="" onerror="this.style.display='none'"></div></div><div class="tt-welcome-admin-field"><label>Título</label><input data-field="title" value="${escapeHtml(step.title)}" maxlength="90">${counter(step.title, 90)}</div><div class="tt-welcome-admin-field"><label>Texto</label><textarea data-field="text" maxlength="420">${escapeHtml(step.text)}</textarea>${counter(step.text, 420)}</div><label class="tt-welcome-pill"><input type="checkbox" data-field="active" ${step.active !== false ? 'checked' : ''}> Mostrar este mensaje</label></div>`;
  }

  let previewIndex = 0;

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function renderMiniPreview() {
    const activeSteps = state.steps.filter(s => s.active !== false);
    if (!activeSteps.length) {
      return '<div class="tt-welcome-empty">Activá al menos un mensaje para ver la vista previa.</div>';
    }
    if (previewIndex >= activeSteps.length) previewIndex = 0;
    const step = activeSteps[previewIndex];
    const last = previewIndex === activeSteps.length - 1;
    const iconHtml = step.image
      ? `<img src="${escapeAttr(step.image)}" alt="" class="tt-welcome-mini-icon-img" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="tt-welcome-mini-icon-fallback" style="display:none">${escapeHtml(step.icon || '🌸')}</span>`
      : escapeHtml(step.icon || '🌸');
    return `
      <div class="tt-welcome-mini-card">
        <div class="tt-welcome-mini-top">
          <div class="tt-welcome-mini-icon${step.image ? ' has-image' : ''}">${iconHtml}</div>
          <h4 class="tt-welcome-mini-title">${escapeHtml(state.title)}</h4>
          <div class="tt-welcome-mini-sub">${escapeHtml(state.subtitle)}</div>
        </div>
        <div class="tt-welcome-mini-body">
          <h5 class="tt-welcome-mini-steptitle">${escapeHtml(step.title)}</h5>
          <p class="tt-welcome-mini-text">${escapeHtml(step.text)}</p>
          <div class="tt-welcome-mini-dots">${activeSteps.map((_, i) => `<span class="tt-welcome-mini-dot${i === previewIndex ? ' active' : ''}"></span>`).join('')}</div>
          <div class="tt-welcome-mini-actions">
            <button type="button" class="tt-welcome-mini-btn" data-preview-nav="prev" ${previewIndex === 0 ? 'disabled' : ''}>Atrás</button>
            <button type="button" class="tt-welcome-mini-btn tt-welcome-mini-btn-primary" data-preview-nav="next">${last ? 'Finalizar' : (escapeHtml(step.cta) || 'Siguiente')}</button>
          </div>
        </div>
      </div>
      <p class="tt-welcome-mini-caption">Paso ${previewIndex + 1} de ${activeSteps.length} — así lo ve una clienta nueva. Se actualiza mientras escribís.</p>`;
  }

  function updateLivePreview() {
    const holder = document.getElementById('welcome-live-preview');
    if (holder) holder.innerHTML = renderMiniPreview();
  }

  function render() {
    const section = document.getElementById('section-welcome');
    if (!section) return;
    previewIndex = 0;
    section.innerHTML = `<div class="tt-welcome-admin-grid"><div class="tt-welcome-admin-main"><div class="tt-welcome-admin-card"><h2 class="tt-welcome-admin-title">Mensaje de bienvenida</h2><p class="tt-welcome-admin-sub">Configurá los mensajes que ve una clienta nueva cuando inicia sesión por primera vez y llega a la página principal.</p><div class="tt-welcome-preview-note">La prueba de "Probar como nuevo usuario" abre el sitio real como Super Admin y muestra exactamente la experiencia de bienvenida. La vista previa de la derecha es una simulación rápida para editar sin salir de esta página.</div><div class="tt-welcome-admin-row" style="margin-top:16px"><div class="tt-welcome-admin-field"><label>Título general</label><input id="welcome-title" value="${escapeHtml(state.title)}" maxlength="90">${counter(state.title, 90)}</div><div class="tt-welcome-admin-field"><label>Subtítulo</label><input id="welcome-subtitle" value="${escapeHtml(state.subtitle)}" maxlength="90">${counter(state.subtitle, 90)}</div></div><div class="tt-welcome-admin-switches"><label class="tt-welcome-pill"><input type="checkbox" id="welcome-enabled" ${state.enabled ? 'checked' : ''}> Activar bienvenida para usuarios nuevos</label><label class="tt-welcome-pill"><input type="checkbox" id="welcome-preview-enabled" ${state.previewEnabled ? 'checked' : ''}> Permitir prueba Super Admin</label></div></div><div class="tt-welcome-admin-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px"><div><h3 class="tt-welcome-admin-title" style="font-size:17px">Mensajes</h3><p class="tt-welcome-admin-sub">Agregá, editá, duplicá, arrastrá para reordenar o eliminá mensajes.</p></div><button type="button" class="tt-welcome-btn primary" id="welcome-add">+ Agregar mensaje</button></div><div id="welcome-steps">${state.steps.length ? state.steps.map(renderStep).join('') : '<div class="tt-welcome-empty">Todavía no hay mensajes. Agregá el primero.</div>'}</div><div class="tt-welcome-admin-actions"><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-welcome-btn" id="welcome-reset">Restaurar mensajes base</button><button type="button" class="tt-welcome-btn danger" id="welcome-reset-users">Reactivar para clientas</button></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-welcome-btn dark" id="welcome-test">Probar como nuevo usuario</button><button type="button" class="tt-welcome-btn primary" id="welcome-save">Guardar cambios</button></div></div></div></div><div class="tt-welcome-admin-side"><div class="tt-welcome-admin-card tt-welcome-preview-card"><h3 class="tt-welcome-admin-title" style="font-size:15px;margin-bottom:12px">Vista previa en vivo</h3><div id="welcome-live-preview">${renderMiniPreview()}</div></div></div></div>`;
    wireCrud();
    if (!window.AdminUnsaved?.has('welcome-config')) {
      window.AdminUnsaved?.register('welcome-config', {
        root: section,
        active: () => section.classList.contains('active'),
        label: 'Mensaje de bienvenida',
        save: saveConfig,
      });
    }
  }

  function syncStateFromDom() {
    state.steps = [...document.querySelectorAll('.tt-welcome-step-card')].map((card, index) => cleanStep({
      id: card.dataset.id,
      icon: card.querySelector('[data-field="icon"]')?.value,
      image: card.querySelector('[data-field="image"]')?.value,
      title: card.querySelector('[data-field="title"]')?.value,
      text: card.querySelector('[data-field="text"]')?.value,
      cta: card.querySelector('[data-field="cta"]')?.value,
      active: card.querySelector('[data-field="active"]')?.checked
    }, index));
    state.title = document.getElementById('welcome-title')?.value || state.title;
    state.subtitle = document.getElementById('welcome-subtitle')?.value || state.subtitle;
    state.enabled = !!document.getElementById('welcome-enabled')?.checked;
    state.previewEnabled = !!document.getElementById('welcome-preview-enabled')?.checked;
  }

  function wireCrud() {
    document.getElementById('welcome-add')?.addEventListener('click', () => { syncStateFromDom(); state.steps.push(cleanStep({ id: uid(), icon: '💗', title: 'Nuevo mensaje', text: 'Escribí acá el texto de bienvenida.', cta: 'Siguiente', active: true }, state.steps.length)); render(); });
    document.getElementById('welcome-reset')?.addEventListener('click', () => { if (!confirm('¿Restaurar los mensajes base?')) return; state.steps = defaultWelcomeSteps(); render(); });
    document.getElementById('welcome-reset-users')?.addEventListener('click', async () => {
      const button = document.getElementById('welcome-reset-users');
      const originalText = button?.textContent || 'Reactivar para clientas';
      if (button) { button.disabled = true; button.textContent = 'Reactivando...'; }
      try { await resetWelcomeForClients(); }
      catch (error) { console.error(error); toast('No se pudo reactivar la bienvenida.', 4200); }
      finally { if (button) { button.disabled = false; button.textContent = originalText; } }
    });
    document.getElementById('welcome-save')?.addEventListener('click', async () => { try { await saveConfig(); } catch (e) { console.error(e); toast('No se pudo guardar. Revisá permisos o reglas.', 5200); } });
    document.getElementById('welcome-test')?.addEventListener('click', async () => {
      try {
        syncStateFromDom();
        if (!state.previewEnabled) {
          toast('Activá “Permitir prueba Super Admin” para abrir la vista previa.', 4200);
          return;
        }
        if (!await saveConfig()) return;
        sessionStorage.setItem('tt_welcome_preview_superadmin', '1');
        localStorage.setItem('tt_welcome_preview_superadmin', '1');
        window.location.href = '/?welcomePreview=1&t=' + Date.now();
      } catch (e) {
        console.error(e);
        toast('No se pudo preparar la prueba.', 4200);
      }
    });
    document.querySelectorAll('.tt-welcome-step-card [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncStateFromDom();
        const card = btn.closest('.tt-welcome-step-card');
        const idx = state.steps.findIndex(s => s.id === card?.dataset.id);
        const action = btn.dataset.action;
        if (idx < 0) return;
        if (action === 'delete') { if (!confirm('¿Eliminar este mensaje?')) return; state.steps.splice(idx, 1); }
        if (action === 'up' && idx > 0) [state.steps[idx - 1], state.steps[idx]] = [state.steps[idx], state.steps[idx - 1]];
        if (action === 'down' && idx < state.steps.length - 1) [state.steps[idx + 1], state.steps[idx]] = [state.steps[idx], state.steps[idx + 1]];
        if (action === 'duplicate') {
          const copy = cleanStep({ ...state.steps[idx], id: uid(), title: `${state.steps[idx].title} (copia)` }, idx + 1);
          state.steps.splice(idx + 1, 0, copy);
        }
        render();
      });
    });

    const section = document.getElementById('section-welcome');

    // Vista previa en vivo: se actualiza leyendo el DOM directamente
    // (syncStateFromDom no toca inputs), así que nunca pierde el foco ni la
    // posición del cursor mientras escribís, a diferencia de llamar render().
    section?.addEventListener('input', event => {
      const field = event.target;
      if (field.matches('.tt-welcome-step-card [data-field="image"]')) {
        const thumb = field.parentElement?.querySelector('[data-thumb]');
        if (thumb) {
          const url = field.value.trim();
          thumb.src = url;
          thumb.style.display = url ? 'block' : 'none';
        }
      }
      const counterEl = field.parentElement?.querySelector('.tt-welcome-counter');
      if (counterEl && field.hasAttribute('maxlength')) {
        counterEl.textContent = `${field.value.length}/${field.getAttribute('maxlength')}`;
      }
      syncStateFromDom();
      updateLivePreview();
    });
    section?.addEventListener('change', event => {
      if (event.target.matches('.tt-welcome-step-card [data-field="active"]')) {
        syncStateFromDom();
        updateLivePreview();
      }
    });

    document.getElementById('welcome-live-preview')?.addEventListener('click', event => {
      const nav = event.target.closest('[data-preview-nav]');
      if (!nav) return;
      const activeCount = state.steps.filter(s => s.active !== false).length;
      if (!activeCount) return;
      if (nav.dataset.previewNav === 'prev') previewIndex = Math.max(0, previewIndex - 1);
      else previewIndex = (previewIndex + 1) % activeCount;
      updateLivePreview();
    });

    // Reordenar arrastrando la manija ⠿ (o cualquier parte de la cabecera de
    // la tarjeta). Subir/Bajar quedan como alternativa accesible por teclado
    // y para quien no pueda usar drag-and-drop.
    let dragId = null;
    document.querySelectorAll('.tt-welcome-step-card').forEach(card => {
      card.addEventListener('dragstart', event => {
        dragId = card.dataset.id;
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragId = null; });
      card.addEventListener('dragover', event => {
        event.preventDefault();
        if (!dragId || dragId === card.dataset.id) return;
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', event => {
        event.preventDefault();
        card.classList.remove('drag-over');
        if (!dragId || dragId === card.dataset.id) return;
        syncStateFromDom();
        const from = state.steps.findIndex(s => s.id === dragId);
        const to = state.steps.findIndex(s => s.id === card.dataset.id);
        if (from < 0 || to < 0) return;
        const [moved] = state.steps.splice(from, 1);
        state.steps.splice(to, 0, moved);
        render();
      });
    });
  }

  async function boot(user) {
    if (!user || String(user.email || '').toLowerCase() !== SUPER_ADMIN) return;
    injectStyles(); ensureNav(); ensureSection(); wireNavigation();
    try { await loadConfig(); render(); }
    catch (e) { console.error('[admin-welcome-control] No se pudo cargar configuración:', e); const section = document.getElementById('section-welcome'); if (section) section.innerHTML = '<div class="adm-empty">No se pudo cargar el módulo de bienvenida.</div>'; }
  }

  onAuthStateChanged(auth, user => boot(user));
})();
