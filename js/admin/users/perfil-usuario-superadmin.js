/* TINTIN — Vista integral de usuario para Super Admin.
 * Este módulo NO crea listeners ni mutaciones de users: reutiliza la ficha
 * de solo lectura y las acciones canónicas de admin-app.js. */

const STYLE_ID = 'tt-superadmin-user-profile-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #users-tbody td{vertical-align:middle}
    #users-tbody td:nth-child(3),#users-tbody [data-user-email]{overflow-wrap:anywhere;word-break:break-word;min-width:150px}
    #users-tbody td:last-child>div{display:flex!important;flex-wrap:wrap!important;gap:6px!important;align-items:center!important}
    #client-ficha-overlay>div{width:min(920px,calc(100vw - 24px))!important;max-width:920px!important}
    #client-ficha-body{padding:18px!important;gap:14px!important}
    .tt-admin-user-tabs{display:flex;gap:6px;overflow-x:auto;padding:6px;background:#fff7fa;border:1px solid #edd6df;border-radius:13px;position:sticky;top:0;z-index:2;scrollbar-width:none}
    .tt-admin-user-tabs::-webkit-scrollbar{display:none}
    .tt-admin-user-tab{border:0;background:transparent;border-radius:9px;padding:9px 12px;white-space:nowrap;font:700 11px/1 Montserrat;color:#705e65;cursor:pointer}
    .tt-admin-user-tab[aria-selected="true"]{background:#f8dfe8;color:#8b2642}
    .tt-admin-user-panel[hidden]{display:none!important}
    .tt-admin-user-panel{display:flex;flex-direction:column;gap:14px}
    .tt-admin-user-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 14px;background:#faf7f8;border:1px solid #eee1e6;border-radius:12px}
    .tt-admin-user-tools-note{font-size:11px;color:#7b6a71;flex:1;min-width:220px;line-height:1.45}
    @media(max-width:680px){
      #client-ficha-overlay{padding:8px!important}
      #client-ficha-body{padding:12px!important}
      .ficha-order-row{align-items:flex-start!important}
    }
  `;
  document.head.appendChild(style);
}

function normalizeTitle(section) {
  return section.querySelector('.ficha-section-title')?.textContent?.trim().toLocaleLowerCase('es') || '';
}

function buildProfileTabs() {
  const body = document.getElementById('client-ficha-body');
  if (!body || body.dataset.ttEnhanced === '1') return;
  const sections = [...body.querySelectorAll(':scope > .ficha-section')];
  if (sections.length < 2) return;
  body.dataset.ttEnhanced = '1';

  const tools = document.createElement('div');
  tools.className = 'tt-admin-user-tools';
  tools.innerHTML = `
    <span class="tt-admin-user-tools-note">La ficha usa la misma autoridad <strong>users</strong> que el panel. Los cambios de rol, bloqueo, restauración o eliminación se realizan desde la fila canónica de Usuarios para no duplicar escrituras.</span>
    <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" data-tt-focus-canonical-user>Ir a gestión del usuario</button>`;

  const tabs = document.createElement('nav');
  tabs.className = 'tt-admin-user-tabs';
  tabs.setAttribute('aria-label', 'Secciones de la ficha del usuario');

  const host = document.createElement('div');
  const groups = [
    { id: 'resumen', label: 'Resumen', match: title => /identidad|contacto|comercial/.test(title) },
    { id: 'pedidos', label: 'Pedidos', match: title => /pedidos/.test(title) },
    { id: 'seguridad', label: 'Seguridad', match: title => /seguridad|acceso/.test(title) },
    { id: 'auditoria', label: 'Auditoría', match: title => /auditor/.test(title) },
  ];

  const panels = new Map();
  groups.forEach((group, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tt-admin-user-tab';
    button.dataset.ttAdminUserTab = group.id;
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    button.textContent = group.label;
    tabs.appendChild(button);

    const panel = document.createElement('section');
    panel.className = 'tt-admin-user-panel';
    panel.dataset.ttAdminUserPanel = group.id;
    panel.hidden = index !== 0;
    panels.set(group.id, panel);
    host.appendChild(panel);
  });

  sections.forEach(section => {
    const title = normalizeTitle(section);
    const group = groups.find(item => item.match(title)) || groups[0];
    panels.get(group.id)?.appendChild(section);
  });

  body.replaceChildren(tools, tabs, host);

  tabs.addEventListener('click', event => {
    const button = event.target.closest?.('[data-tt-admin-user-tab]');
    if (!button) return;
    const id = button.dataset.ttAdminUserTab;
    panels.forEach((panel, key) => { panel.hidden = key !== id; });
    tabs.querySelectorAll('[data-tt-admin-user-tab]').forEach(tab => tab.setAttribute('aria-selected', tab === button ? 'true' : 'false'));
  });

  tools.querySelector('[data-tt-focus-canonical-user]')?.addEventListener('click', () => {
    const uidField = [...body.querySelectorAll('.ficha-field')].find(field => field.querySelector('.ficha-field-label')?.textContent?.trim() === 'UID');
    const uid = uidField?.querySelector('.ficha-field-value')?.textContent?.trim();
    window.closeClientFicha?.();
    document.querySelector('[data-section="usuarios"]')?.click();
    window.setTimeout(() => {
      const row = uid ? document.querySelector(`.user-row-check[data-id="${CSS.escape(uid)}"]`)?.closest('tr') : null;
      if (row) {
        row.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        row.classList.add('adm-notification-focus');
        window.setTimeout(() => row.classList.remove('adm-notification-focus'), 1800);
      }
    }, 220);
  });
}

function cleanEpochDates(root = document) {
  const invalid = /(?:31[\/. -]12[\/. -]1969|01[\/. -]01[\/. -]1970|Dec(?:ember)?\s+31,?\s+1969)/i;
  root.querySelectorAll('time,[data-updated-at],.adm-updated,.adm-last-update').forEach(node => {
    if (invalid.test(node.textContent || '')) node.textContent = 'Sin actualización registrada';
  });
}

function boot() {
  ensureStyles();
  const body = document.getElementById('client-ficha-body');
  if (body) {
    new MutationObserver(() => {
      if (!body.dataset.ttEnhanced) buildProfileTabs();
      cleanEpochDates(body);
    }).observe(body, { childList: true, subtree: true, characterData: true });
  }
  const adminRoot = document.querySelector('.adm-main') || document.body;
  new MutationObserver(() => cleanEpochDates(adminRoot)).observe(adminRoot, { childList: true, subtree: true, characterData: true });
  cleanEpochDates(adminRoot);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
