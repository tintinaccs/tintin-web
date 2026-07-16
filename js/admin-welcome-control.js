/* =============================================================
   TINTIN — Super Admin: Mensaje de bienvenida
   =============================================================
   Módulo independiente para configurar el tutorial/mensajes de bienvenida.
   Se inserta solo en admin.html y solo para la cuenta Super Admin real.
   ============================================================= */

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN } from './roles.js';
import {
  defaultWelcomeSteps,
  normalizeWelcomeConfig,
  normalizeWelcomeStep
} from './welcome-config.js';

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
    st.textContent = `#section-welcome{display:none}.adm-section.active#section-welcome{display:block}.tt-welcome-admin-grid{display:grid;grid-template-columns:1fr;gap:18px}.tt-welcome-admin-card{background:#fff;border:1px solid rgba(184,76,114,.12);border-radius:22px;box-shadow:0 14px 38px rgba(139,38,66,.08);padding:20px}.tt-welcome-admin-title{font-size:20px;font-weight:900;color:#2B2B2B;margin:0}.tt-welcome-admin-sub{font-size:13px;color:#2B2B2B;margin:6px 0 0;line-height:1.55}.tt-welcome-admin-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.tt-welcome-admin-field{display:flex;flex-direction:column;gap:7px}.tt-welcome-admin-field label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#2B2B2B}.tt-welcome-admin-field input,.tt-welcome-admin-field textarea{width:100%;border:1.5px solid rgba(184,76,114,.18);border-radius:14px;padding:11px 12px;font-family:inherit;font-size:13px;outline:none;background:#fffdfd;color:#2B2B2B;box-sizing:border-box}.tt-welcome-admin-field textarea{min-height:86px;resize:vertical}.tt-welcome-admin-field input:focus,.tt-welcome-admin-field textarea:focus{border-color:#AD3F67;box-shadow:0 0 0 3px rgba(212,106,138,.10)}.tt-welcome-admin-switches{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.tt-welcome-pill{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border-radius:999px;background:#fff3f7;border:1px solid rgba(184,76,114,.15);font-size:12px;font-weight:800;color:#2B2B2B}.tt-welcome-pill input{accent-color:#AD3F67}.tt-welcome-step-card{border:1px solid rgba(184,76,114,.13);border-radius:18px;padding:14px;background:linear-gradient(180deg,#fff,#fff8fb);display:grid;gap:12px}.tt-welcome-step-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.tt-welcome-step-badge{font-size:11px;font-weight:900;color:#2B2B2B;text-transform:uppercase;letter-spacing:.08em}.tt-welcome-step-actions{display:flex;gap:8px;flex-wrap:wrap}.tt-welcome-btn{min-height:44px;border:0;border-radius:999px;padding:10px 14px;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer;background:#f8e8ef;color:#2B2B2B}.tt-welcome-btn.primary{background:#AD3F67;color:#fff;box-shadow:0 10px 24px rgba(212,106,138,.20)}.tt-welcome-btn.danger{background:#fff0f0;color:#2B2B2B}.tt-welcome-btn.dark{background:#2B2B2B;color:#fff}.tt-welcome-btn:disabled{opacity:.55;cursor:not-allowed}.tt-welcome-admin-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:18px}.tt-welcome-empty{text-align:center;color:#2B2B2B;padding:22px;border:1px dashed rgba(184,76,114,.25);border-radius:18px;background:#fff8fb}.tt-welcome-preview-note{font-size:12px;line-height:1.6;color:#2B2B2B;background:#fff6f9;border-left:4px solid #AD3F67;padding:12px 14px;border-radius:14px;margin-top:12px}@media(max-width:820px){.tt-welcome-admin-row{grid-template-columns:1fr}.tt-welcome-admin-card{padding:16px;border-radius:18px}.tt-welcome-step-head{align-items:flex-start;flex-direction:column}.tt-welcome-admin-actions{flex-direction:column}.tt-welcome-btn{width:100%}}`;
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
      btn.innerHTML = '<span class="adm-nav-icon">💌</span> Mensaje bienvenida';
      const config = document.getElementById('nav-config');
      nav.insertBefore(btn, config || null);
    }
    const tabs = document.getElementById('adm-mobile-tabs');
    if (tabs && !document.getElementById('mtab-welcome')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'adm-mobile-tab';
      btn.id = 'mtab-welcome';
      btn.dataset.section = 'welcome';
      btn.innerHTML = '<span class="adm-nav-icon">💌</span>Bienvenida';
      const config = document.getElementById('mtab-config');
      tabs.insertBefore(btn, config || null);
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
    document.querySelectorAll('.adm-nav-item,.adm-mobile-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('section-welcome')?.classList.add('active');
    document.getElementById('nav-welcome')?.classList.add('active');
    document.getElementById('mtab-welcome')?.classList.add('active');
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
    const snapshot = await getDocs(collection(db, 'users'));
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

  function renderStep(step, index) {
    return `<div class="tt-welcome-step-card" data-id="${escapeHtml(step.id)}"><div class="tt-welcome-step-head"><div class="tt-welcome-step-badge">Mensaje ${index + 1}</div><div class="tt-welcome-step-actions"><button type="button" class="tt-welcome-btn" data-action="up" ${index === 0 ? 'disabled' : ''}>Subir</button><button type="button" class="tt-welcome-btn" data-action="down" ${index === state.steps.length - 1 ? 'disabled' : ''}>Bajar</button><button type="button" class="tt-welcome-btn danger" data-action="delete">Eliminar</button></div></div><div class="tt-welcome-admin-row"><div class="tt-welcome-admin-field"><label>Icono</label><input data-field="icon" value="${escapeHtml(step.icon)}" maxlength="8"></div><div class="tt-welcome-admin-field"><label>Botón</label><input data-field="cta" value="${escapeHtml(step.cta)}" maxlength="40"></div></div><div class="tt-welcome-admin-field"><label>Título</label><input data-field="title" value="${escapeHtml(step.title)}" maxlength="90"></div><div class="tt-welcome-admin-field"><label>Texto</label><textarea data-field="text" maxlength="420">${escapeHtml(step.text)}</textarea></div><label class="tt-welcome-pill"><input type="checkbox" data-field="active" ${step.active !== false ? 'checked' : ''}> Mostrar este mensaje</label></div>`;
  }

  function render() {
    const section = document.getElementById('section-welcome');
    if (!section) return;
    section.innerHTML = `<div class="tt-welcome-admin-grid"><div class="tt-welcome-admin-card"><h2 class="tt-welcome-admin-title">Mensaje de bienvenida</h2><p class="tt-welcome-admin-sub">Configurá los mensajes que ve una clienta nueva cuando inicia sesión por primera vez y llega a la página principal.</p><div class="tt-welcome-preview-note">La prueba se abre como Super Admin, pero muestra exactamente la experiencia de bienvenida como si fueras una usuaria nueva.</div><div class="tt-welcome-admin-row" style="margin-top:16px"><div class="tt-welcome-admin-field"><label>Título general</label><input id="welcome-title" value="${escapeHtml(state.title)}"></div><div class="tt-welcome-admin-field"><label>Subtítulo</label><input id="welcome-subtitle" value="${escapeHtml(state.subtitle)}"></div></div><div class="tt-welcome-admin-switches"><label class="tt-welcome-pill"><input type="checkbox" id="welcome-enabled" ${state.enabled ? 'checked' : ''}> Activar bienvenida para usuarios nuevos</label><label class="tt-welcome-pill"><input type="checkbox" id="welcome-preview-enabled" ${state.previewEnabled ? 'checked' : ''}> Permitir prueba Super Admin</label></div></div><div class="tt-welcome-admin-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px"><div><h3 class="tt-welcome-admin-title" style="font-size:17px">Mensajes</h3><p class="tt-welcome-admin-sub">Podés agregar, editar, ordenar o eliminar mensajes.</p></div><button type="button" class="tt-welcome-btn primary" id="welcome-add">+ Agregar mensaje</button></div><div id="welcome-steps">${state.steps.length ? state.steps.map(renderStep).join('') : '<div class="tt-welcome-empty">Todavía no hay mensajes. Agregá el primero.</div>'}</div><div class="tt-welcome-admin-actions"><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-welcome-btn" id="welcome-reset">Restaurar mensajes base</button><button type="button" class="tt-welcome-btn danger" id="welcome-reset-users">Reactivar para clientas</button></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-welcome-btn dark" id="welcome-test">Probar como nuevo usuario</button><button type="button" class="tt-welcome-btn primary" id="welcome-save">Guardar cambios</button></div></div></div></div>`;
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
        window.location.href = 'index.html?welcomePreview=1&t=' + Date.now();
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
        if (action === 'delete') { if (!confirm('¿Eliminar este mensaje?')) return; state.steps.splice(idx, 1); }
        if (action === 'up' && idx > 0) [state.steps[idx - 1], state.steps[idx]] = [state.steps[idx], state.steps[idx - 1]];
        if (action === 'down' && idx < state.steps.length - 1) [state.steps[idx + 1], state.steps[idx]] = [state.steps[idx], state.steps[idx + 1]];
        render();
      });
    });
  }

  async function boot(user) {
    if (!user || user.email !== SUPER_ADMIN) return;
    injectStyles(); ensureNav(); ensureSection(); wireNavigation();
    try { await loadConfig(); render(); }
    catch (e) { console.error('[admin-welcome-control] No se pudo cargar configuración:', e); const section = document.getElementById('section-welcome'); if (section) section.innerHTML = '<div class="adm-empty">No se pudo cargar el módulo de bienvenida.</div>'; }
  }

  onAuthStateChanged(auth, user => boot(user));
})();
