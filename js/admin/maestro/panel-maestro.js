import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import {
  BASE_ADMIN_SECTIONS,
  MAESTRO_MODULES,
  capabilityLabel
} from './registro-maestro.js?v=tintin-20260831-superadmin-maestro-1';

(function () {
  'use strict';
  if (window.TintinSuperAdminMaestroBooted) return;
  window.TintinSuperAdminMaestroBooted = true;

  const isAdminRoute = /(^|\/)admin(?:\.html)?$/i.test(location.pathname.replace(/\/$/, ''));
  if (!isAdminRoute) return;

  const VERSION = 'tintin-20260831-superadmin-maestro-1';
  const CAP_COLUMNS = [
    ['create', 'C'], ['read', 'R'], ['update', 'U'], ['archive', 'Arch.'],
    ['delete', 'D'], ['search', 'Buscar'], ['export', 'Exportar'],
    ['sync', 'Sync'], ['audit', 'Auditar'], ['permissions', 'Permisos']
  ];
  let latestChecks = [];

  function isSuperAdmin(user = auth.currentUser) {
    return String(user?.email || '').trim().toLowerCase() === String(SUPER_ADMIN || '').trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function toast(message, duration = 3600) {
    const el = document.getElementById('adm-toast');
    if (!el) { console.info('[Maestro]', message); return; }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._ttMaestroTimer);
    el._ttMaestroTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function injectStyles() {
    if (document.getElementById('tt-superadmin-maestro-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-superadmin-maestro-style';
    style.textContent = `
      #section-maestro{display:none}.adm-section.active#section-maestro{display:block}
      .tt-maestro-shell{display:grid;gap:18px}.tt-maestro-hero{padding:24px;border-radius:24px;background:linear-gradient(135deg,#fff4f8,#fff);border:1px solid rgba(173,63,103,.16);box-shadow:0 18px 50px rgba(139,38,66,.08)}
      .tt-maestro-eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#AD3F67}.tt-maestro-hero h1{margin:6px 0 8px;font-size:30px;line-height:1.08}.tt-maestro-hero p{margin:0;color:var(--adm-muted);line-height:1.6;max-width:920px}
      .tt-maestro-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}.tt-maestro-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.tt-maestro-kpi{background:#fff;border:1px solid var(--adm-border);border-radius:18px;padding:16px}.tt-maestro-kpi span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--adm-muted);font-weight:800}.tt-maestro-kpi strong{display:block;font-size:26px;margin-top:6px}.tt-maestro-kpi small{display:block;color:var(--adm-muted);margin-top:3px;line-height:1.35}
      .tt-maestro-status{display:flex;align-items:center;gap:8px;font-weight:800}.tt-maestro-dot{width:10px;height:10px;border-radius:50%;background:#2e7d32}.tt-maestro-status.warn .tt-maestro-dot{background:#bf7200}.tt-maestro-status.fail .tt-maestro-dot{background:#b3261e}
      .tt-maestro-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.5fr);gap:16px}.tt-maestro-card{background:#fff;border:1px solid var(--adm-border);border-radius:20px;overflow:hidden}.tt-maestro-card-head{padding:16px 18px;border-bottom:1px solid var(--adm-border);display:flex;justify-content:space-between;gap:12px;align-items:center}.tt-maestro-card-head h2{font-size:16px;margin:0}.tt-maestro-card-body{padding:16px 18px}.tt-maestro-health{display:grid;gap:9px}.tt-maestro-check{display:grid;grid-template-columns:22px 1fr;gap:9px;align-items:start;padding:10px 11px;border:1px solid var(--adm-border);border-radius:13px}.tt-maestro-check-icon{font-weight:900}.tt-maestro-check strong{display:block;font-size:12px}.tt-maestro-check small{display:block;color:var(--adm-muted);line-height:1.45;margin-top:2px}.tt-maestro-check[data-ok="true"] .tt-maestro-check-icon{color:#2e7d32}.tt-maestro-check[data-ok="false"] .tt-maestro-check-icon{color:#b3261e}
      .tt-maestro-search{width:100%;max-width:330px}.tt-maestro-table-wrap{overflow:auto}.tt-maestro-table{width:100%;border-collapse:collapse;min-width:1120px;font-size:12px}.tt-maestro-table th,.tt-maestro-table td{padding:10px 9px;border-bottom:1px solid var(--adm-border);text-align:center;vertical-align:middle}.tt-maestro-table th:first-child,.tt-maestro-table td:first-child{text-align:left;position:sticky;left:0;background:#fff;z-index:1;min-width:220px}.tt-maestro-module-name{font-weight:900}.tt-maestro-module-policy{font-size:10px;color:var(--adm-muted);margin-top:3px}.tt-maestro-cap{display:inline-flex;align-items:center;justify-content:center;min-width:26px;min-height:24px;padding:3px 7px;border-radius:999px;background:#f5f5f5;font-size:10px;font-weight:800}.tt-maestro-cap.yes{background:#eaf7ed;color:#216e39}.tt-maestro-cap.guarded{background:#fff4dc;color:#8a5a00}.tt-maestro-cap.no{color:#8e8e8e}.tt-maestro-open{white-space:nowrap}
      .tt-maestro-policy{display:grid;gap:10px}.tt-maestro-policy-item{padding:11px 12px;border-radius:13px;background:#fff8fb;border:1px solid rgba(173,63,103,.12);font-size:12px;line-height:1.5}.tt-maestro-policy-item strong{display:block;margin-bottom:2px}.tt-maestro-footer-note{font-size:11px;color:var(--adm-muted);line-height:1.55}
      @media(max-width:1050px){.tt-maestro-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.tt-maestro-grid{grid-template-columns:1fr}}
      @media(max-width:600px){.tt-maestro-hero{padding:18px;border-radius:18px}.tt-maestro-hero h1{font-size:24px}.tt-maestro-kpis{grid-template-columns:1fr}.tt-maestro-actions .adm-btn{width:100%}.tt-maestro-card-head{align-items:flex-start;flex-direction:column}.tt-maestro-search{max-width:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureNavigation() {
    const nav = document.getElementById('adm-nav');
    if (nav && !document.getElementById('nav-maestro')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'nav-maestro';
      button.className = 'adm-nav-item';
      button.dataset.section = 'maestro';
      button.innerHTML = '<span class="adm-nav-icon" aria-hidden="true">◆</span> Maestro';
      nav.insertBefore(button, nav.firstElementChild);
    }
    const tabs = document.getElementById('adm-mobile-tabs');
    if (tabs && !document.getElementById('mtab-maestro')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'mtab-maestro';
      button.className = 'adm-mobile-tab';
      button.dataset.section = 'maestro';
      button.innerHTML = '<span class="adm-nav-icon" aria-hidden="true">◆</span>Maestro';
      tabs.insertBefore(button, tabs.firstElementChild);
    }
  }

  function ensureSection() {
    const content = document.querySelector('.adm-content');
    if (!content || document.getElementById('section-maestro')) return;
    const section = document.createElement('div');
    section.id = 'section-maestro';
    section.className = 'adm-section';
    section.setAttribute('aria-label', 'Panel Maestro del Super Admin');
    content.insertBefore(section, content.firstElementChild);
  }

  function activateMaestro() {
    document.querySelectorAll('.adm-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.adm-nav-item,.adm-mobile-tab').forEach(button => {
      button.classList.remove('active');
      button.removeAttribute('aria-current');
    });
    document.getElementById('section-maestro')?.classList.add('active');
    ['nav-maestro', 'mtab-maestro'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add('active');
        element.setAttribute('aria-current', 'page');
      }
    });
    const title = document.getElementById('adm-topbar-title');
    if (title) title.textContent = 'Maestro';
    document.getElementById('adm-sidebar')?.classList.remove('open');
    document.getElementById('adm-overlay')?.classList.remove('show');
    runAndRenderChecks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function nativeTrigger(section) {
    return document.querySelector(`#adm-nav [data-section="${CSS.escape(section)}"]`) ||
      document.querySelector(`#adm-mobile-tabs [data-section="${CSS.escape(section)}"]`);
  }

  function openModule(module) {
    if (!module) return false;
    if (module.id === 'maestro') { activateMaestro(); return true; }
    if (module.surface === 'external') {
      location.assign(module.quickAction?.url || '/admin-images');
      return true;
    }
    const trigger = nativeTrigger(module.section);
    if (trigger) { trigger.click(); return true; }
    toast(`El módulo ${module.label} todavía no está montado.`, 4600);
    return false;
  }

  function getPath(path) {
    return String(path || '').split('.').filter(Boolean).reduce((value, key) => value?.[key], window);
  }

  async function waitForAction(resolve, timeoutMs = 3500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = resolve();
      if (value) return value;
      await new Promise(r => setTimeout(r, 80));
    }
    return null;
  }

  async function runQuickAction(module) {
    const action = module?.quickAction;
    if (!action) { openModule(module); return; }
    if (action.type === 'url') { location.assign(action.url); return; }
    openModule(module);
    if (action.type === 'selector') {
      const element = await waitForAction(() => document.querySelector(action.selector));
      if (!element) throw new Error(`No apareció la acción “${action.label}”.`);
      element.click();
      return;
    }
    if (action.type === 'global') {
      const fn = await waitForAction(() => getPath(action.path));
      if (typeof fn !== 'function') throw new Error(`No está disponible ${action.path}.`);
      await fn();
    }
  }

  function discoverSections(rootSelector) {
    return [...new Set([...document.querySelectorAll(`${rootSelector} [data-section]`)]
      .map(element => element.dataset.section)
      .filter(Boolean))];
  }

  function runtimeChecks() {
    const desktop = discoverSections('#adm-nav').filter(id => id !== 'maestro');
    const mobile = discoverSections('#adm-mobile-tabs').filter(id => id !== 'maestro');
    const registryIds = new Set(MAESTRO_MODULES.map(item => item.id));
    const basePresent = BASE_ADMIN_SECTIONS.filter(id => document.getElementById(`section-${id}`));
    const missingRegistry = [...new Set([...desktop, ...mobile])].filter(id => !registryIds.has(id));
    const navOnlyDesktop = desktop.filter(id => !mobile.includes(id));
    const navOnlyMobile = mobile.filter(id => !desktop.includes(id));

    return [
      {
        id: 'auth',
        label: 'Super Admin autenticado y panel liberado',
        ok: isSuperAdmin() && document.documentElement.classList.contains('adm-auth-ready'),
        detail: 'Maestro solo se monta para el email Super Admin real y después del guard de autenticación.'
      },
      {
        id: 'registry',
        label: 'Todos los módulos de navegación están clasificados',
        ok: missingRegistry.length === 0,
        detail: missingRegistry.length ? `Sin registro: ${missingRegistry.join(', ')}` : `${registryIds.size} superficies registradas en Maestro.`
      },
      {
        id: 'sections',
        label: 'Las secciones base existen en el DOM',
        ok: basePresent.length === BASE_ADMIN_SECTIONS.length,
        detail: `${basePresent.length}/${BASE_ADMIN_SECTIONS.length} secciones base presentes.`
      },
      {
        id: 'nav-parity',
        label: 'Sidebar y navegación móvil están sincronizados',
        ok: navOnlyDesktop.length === 0 && navOnlyMobile.length === 0,
        detail: navOnlyDesktop.length || navOnlyMobile.length
          ? `Solo desktop: ${navOnlyDesktop.join(', ') || '—'} · solo mobile: ${navOnlyMobile.join(', ') || '—'}`
          : `${desktop.length} destinos en paridad.`
      },
      {
        id: 'orders',
        label: 'Pedidos tiene CRUD protegido y ciclo de inventario',
        ok: Boolean(document.getElementById('section-pedidos') && window.TintinOrderAdmin && window.TintinInventoryIntegrity),
        detail: 'Alta manual, edición, papelera/restauración y reconciliación de inventario.'
      },
      {
        id: 'products',
        label: 'Productos expone CRUD, búsqueda y exportación',
        ok: ['btn-nuevo-producto', 'prod-save-btn', 'bulk-delete-btn', 'prod-export-all-btn'].every(id => document.getElementById(id)),
        detail: 'Crear, editar, activar/desactivar, eliminar protegido, stock, precio y exportar.'
      },
      {
        id: 'collections',
        label: 'Colecciones expone CRUD y ciclo de visibilidad',
        ok: ['btn-nueva-coleccion', 'coll-save-btn', 'coll-bulk-delete-btn'].every(id => document.getElementById(id)),
        detail: 'Crear, editar, ocultar/activar, ordenar, asignar productos y eliminar protegido.'
      },
      {
        id: 'users',
        label: 'Usuarios usa ciclo seguro, no hard-delete',
        ok: ['users-bulk-block-btn', 'users-bulk-restore-btn', 'users-tbody'].every(id => document.getElementById(id)),
        detail: 'Roles, bloqueo, restauración y exportación sin fabricar ni borrar identidades de Auth.'
      },
      {
        id: 'audit',
        label: 'Auditoría permanece inmutable y exportable',
        ok: Boolean(document.getElementById('section-auditoria') && document.getElementById('audit-tbody')),
        detail: 'Trazabilidad de cambios sin botones Maestro de edición o borrado.'
      },
      {
        id: 'diagnostic',
        label: 'Diagnóstico integral de solo lectura disponible',
        ok: Boolean(document.getElementById('btn-run-site-diagnostics')),
        detail: 'Permite revisar el ecosistema sin mutar datos reales.'
      },
      {
        id: 'settings',
        label: 'Configuración global y estado de tienda disponibles',
        ok: Boolean(document.getElementById('cfg-store-open') && document.getElementById('section-configuracion')),
        detail: 'Estado, navegación, contacto, envíos, pagos y demás configuración operativa.'
      },
      {
        id: 'unsaved',
        label: 'Protección contra cambios sin guardar activa',
        ok: Boolean(window.AdminUnsaved),
        detail: 'Las navegaciones sensibles respetan el guard de cambios pendientes.'
      }
    ];
  }

  function scoreChecks(checks) {
    const pass = checks.filter(item => item.ok).length;
    return { pass, total: checks.length, percent: checks.length ? Math.round(pass / checks.length * 100) : 0 };
  }

  function capClass(value) {
    return value === 'yes' ? 'yes' : value === 'guarded' ? 'guarded' : 'no';
  }

  function moduleRows(filter = '') {
    const needle = String(filter || '').trim().toLowerCase();
    return MAESTRO_MODULES
      .filter(module => !needle || `${module.label} ${module.id} ${module.policy} ${module.description}`.toLowerCase().includes(needle))
      .map(module => {
        const cells = CAP_COLUMNS.map(([key]) => {
          const value = module.capabilities[key];
          return `<td><span class="tt-maestro-cap ${capClass(value)}" title="${escapeHtml(capabilityLabel(value))}">${escapeHtml(capabilityLabel(value))}</span></td>`;
        }).join('');
        const quick = module.quickAction
          ? `<button type="button" class="adm-btn adm-btn-sm adm-btn-primary" data-maestro-quick="${escapeHtml(module.id)}">${escapeHtml(module.quickAction.label)}</button>`
          : '';
        return `<tr data-maestro-row="${escapeHtml(module.id)}"><td><div class="tt-maestro-module-name">${escapeHtml(module.label)}</div><div class="tt-maestro-module-policy">${escapeHtml(module.policy)} · ${escapeHtml(module.description)}</div></td>${cells}<td><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="adm-btn adm-btn-sm tt-maestro-open" data-maestro-open="${escapeHtml(module.id)}">Abrir</button>${quick}</div></td></tr>`;
      }).join('');
  }

  function healthMarkup(checks) {
    return checks.map(item => `<div class="tt-maestro-check" data-ok="${item.ok}"><div class="tt-maestro-check-icon">${item.ok ? '✓' : '!'}</div><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div></div>`).join('');
  }

  function fullCrudCount() {
    return MAESTRO_MODULES.filter(module => ['crud', 'crud-protected', 'content-crud', 'asset-crud'].includes(module.policy)).length;
  }

  function protectedCount() {
    return MAESTRO_MODULES.filter(module => Object.values(module.capabilities).includes('guarded')).length;
  }

  function renderShell() {
    const section = document.getElementById('section-maestro');
    if (!section) return;
    const checks = runtimeChecks();
    latestChecks = checks;
    const score = scoreChecks(checks);
    section.innerHTML = `
      <div class="tt-maestro-shell" data-maestro-version="${VERSION}">
        <section class="tt-maestro-hero">
          <div class="tt-maestro-eyebrow">Super Admin · Control total verificable</div>
          <h1>Maestro</h1>
          <p>Inventario único de módulos, capacidades CRUD, protecciones, sincronización y salud del ecosistema. Maestro no escribe directamente en Firestore: todas las mutaciones siguen pasando por los módulos y contratos existentes.</p>
          <div class="tt-maestro-actions">
            <button type="button" class="adm-btn adm-btn-primary" id="maestro-run-checks">Comprobar ahora</button>
            <button type="button" class="adm-btn" id="maestro-open-diagnostic">Diagnóstico integral</button>
            <button type="button" class="adm-btn" id="maestro-export">Exportar matriz JSON</button>
          </div>
        </section>
        <div class="tt-maestro-kpis">
          <article class="tt-maestro-kpi"><span>Estado Maestro</span><strong>${score.percent}%</strong><small>${score.pass}/${score.total} comprobaciones runtime correctas</small></article>
          <article class="tt-maestro-kpi"><span>Superficies gobernadas</span><strong>${MAESTRO_MODULES.length}</strong><small>Base + dinámicas + Imágenes + Maestro</small></article>
          <article class="tt-maestro-kpi"><span>CRUD / contenido</span><strong>${fullCrudCount()}</strong><small>Módulos con ciclo de entidad completo</small></article>
          <article class="tt-maestro-kpi"><span>Operaciones protegidas</span><strong>${protectedCount()}</strong><small>Módulos con borrado/cambio sensible guardado</small></article>
        </div>
        <div class="tt-maestro-grid">
          <section class="tt-maestro-card">
            <div class="tt-maestro-card-head"><h2>Salud del Super Admin</h2><div class="tt-maestro-status ${score.percent === 100 ? '' : score.percent >= 85 ? 'warn' : 'fail'}"><span class="tt-maestro-dot"></span>${score.percent === 100 ? 'Correcto' : 'Revisar'}</div></div>
            <div class="tt-maestro-card-body"><div class="tt-maestro-health" id="maestro-health">${healthMarkup(checks)}</div></div>
          </section>
          <aside class="tt-maestro-card">
            <div class="tt-maestro-card-head"><h2>Política de seguridad</h2></div>
            <div class="tt-maestro-card-body tt-maestro-policy">
              <div class="tt-maestro-policy-item"><strong>Pedidos</strong>Papelera + restauración + inventario. El hard-delete final permanece protegido.</div>
              <div class="tt-maestro-policy-item"><strong>Usuarios</strong>Bloquear/restaurar y roles; no crear identidades falsas ni borrarlas desde Maestro.</div>
              <div class="tt-maestro-policy-item"><strong>Auditoría</strong>Solo lectura/búsqueda/exportación. Nunca editar ni borrar trazabilidad.</div>
              <div class="tt-maestro-policy-item"><strong>Producción</strong>Las comprobaciones del panel son de lectura. Las mutaciones solo se disparan cuando vos elegís una acción CRUD concreta.</div>
            </div>
          </aside>
        </div>
        <section class="tt-maestro-card">
          <div class="tt-maestro-card-head"><div><h2>Matriz de capacidades</h2><div class="tt-maestro-footer-note">C/R/U/D = Crear / Leer / Actualizar / Eliminar. “Protegido” significa que exige permisos, confirmación, ciclo de vida o contrato específico.</div></div><input id="maestro-filter" class="adm-input tt-maestro-search" type="search" placeholder="Buscar módulo o capacidad…"></div>
          <div class="tt-maestro-table-wrap"><table class="tt-maestro-table"><thead><tr><th>Módulo</th>${CAP_COLUMNS.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')}<th>Acciones</th></tr></thead><tbody id="maestro-modules-body">${moduleRows()}</tbody></table></div>
        </section>
        <div class="tt-maestro-footer-note">Cobertura automática: cualquier nueva sección agregada a la navegación que no exista en el registro Maestro debe hacer fallar la auditoría de CI. Versión ${VERSION}.</div>
      </div>`;
    wireSectionControls();
  }

  function runAndRenderChecks() {
    latestChecks = runtimeChecks();
    const score = scoreChecks(latestChecks);
    const health = document.getElementById('maestro-health');
    if (health) health.innerHTML = healthMarkup(latestChecks);
    const kpis = document.querySelectorAll('#section-maestro .tt-maestro-kpi strong');
    if (kpis[0]) kpis[0].textContent = `${score.percent}%`;
    const status = document.querySelector('#section-maestro .tt-maestro-status');
    if (status) {
      status.className = `tt-maestro-status ${score.percent === 100 ? '' : score.percent >= 85 ? 'warn' : 'fail'}`;
      status.innerHTML = `<span class="tt-maestro-dot"></span>${score.percent === 100 ? 'Correcto' : 'Revisar'}`;
    }
    return score;
  }

  function exportMatrix() {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      version: VERSION,
      checks: latestChecks.length ? latestChecks : runtimeChecks(),
      modules: MAESTRO_MODULES
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tintin-superadmin-maestro-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast('Matriz Maestro exportada.');
  }

  function wireSectionControls() {
    const section = document.getElementById('section-maestro');
    if (!section || section.dataset.maestroWired === '1') return;
    section.dataset.maestroWired = '1';
    section.addEventListener('click', async event => {
      const open = event.target.closest('[data-maestro-open]');
      if (open) {
        const module = MAESTRO_MODULES.find(item => item.id === open.dataset.maestroOpen);
        openModule(module);
        return;
      }
      const quick = event.target.closest('[data-maestro-quick]');
      if (quick) {
        const module = MAESTRO_MODULES.find(item => item.id === quick.dataset.maestroQuick);
        try { await runQuickAction(module); }
        catch (error) { console.error('[Maestro] acción rápida:', error); toast(error?.message || 'No se pudo ejecutar la acción.', 5600); }
      }
    });
    document.getElementById('maestro-run-checks')?.addEventListener('click', () => {
      const score = runAndRenderChecks();
      toast(score.percent === 100 ? 'Maestro: todas las comprobaciones runtime están correctas.' : `Maestro: ${score.pass}/${score.total} comprobaciones correctas.`);
    });
    document.getElementById('maestro-export')?.addEventListener('click', exportMatrix);
    document.getElementById('maestro-open-diagnostic')?.addEventListener('click', async () => {
      const module = MAESTRO_MODULES.find(item => item.id === 'diagnostico');
      try { await runQuickAction(module); }
      catch (error) { toast(error?.message || 'No se pudo abrir el diagnóstico.', 5200); }
    });
    document.getElementById('maestro-filter')?.addEventListener('input', event => {
      const tbody = document.getElementById('maestro-modules-body');
      if (tbody) tbody.innerHTML = moduleRows(event.target.value);
    });
  }

  function wireNavigation() {
    ['nav-maestro', 'mtab-maestro'].forEach(id => {
      const button = document.getElementById(id);
      if (!button || button.dataset.maestroWired === '1') return;
      button.dataset.maestroWired = '1';
      button.addEventListener('click', event => {
        event.preventDefault();
        if (!isSuperAdmin()) return;
        window.AdminUnsaved?.requestNavigation
          ? window.AdminUnsaved.requestNavigation(activateMaestro)
          : activateMaestro();
      });
    });
  }

  async function waitForAdminDom(timeoutMs = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (document.getElementById('adm-nav') && document.getElementById('adm-mobile-tabs') && document.querySelector('.adm-content')) return true;
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    return false;
  }

  async function mount(user) {
    if (!isSuperAdmin(user)) return;
    if (!await waitForAdminDom()) {
      console.error('[Maestro] No se encontró la estructura del Super Admin.');
      return;
    }
    injectStyles();
    ensureNavigation();
    ensureSection();
    wireNavigation();
    renderShell();
    document.documentElement.dataset.ttSuperadminMaestroReady = '1';
    document.dispatchEvent(new CustomEvent('tintin:superadmin-maestro-ready', { detail: { version: VERSION } }));
  }

  window.TintinSuperAdminMaestro = Object.freeze({
    version: VERSION,
    modules: MAESTRO_MODULES,
    runChecks: runtimeChecks,
    open: activateMaestro
  });

  onAuthStateChanged(auth, user => {
    if (isSuperAdmin(user)) mount(user).catch(error => console.error('[Maestro] mount:', error));
  });
})();
