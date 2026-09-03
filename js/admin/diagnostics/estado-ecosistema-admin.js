import { auth } from '../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-3';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const HEALTH_URL = '/api/system-health';
let mounted = false;
let loaded = false;
let loading = false;
let observer = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function state(value) {
  return value === true ? 'PASS' : value === false ? 'FAIL' : 'NOT_VERIFIED';
}

function label(value) {
  if (value === 'PASS') return 'PASS';
  if (value === 'FAIL') return 'FAIL';
  return 'NO VERIFICADO';
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function shortSha(value) {
  const sha = String(value || '');
  return sha ? sha.slice(0, 10) : '—';
}

function formatAgeMs(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '—';
  const minutes = Math.floor(value / 60000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function item(labelText, value, detail = '') {
  const itemState = state(value);
  return `
    <article class="adm-master-area adm-system-health-item">
      <div class="adm-master-area-head">
        <div class="adm-master-area-title">${escapeHtml(labelText)}</div>
        <span class="adm-master-area-state" data-state="${itemState}">${label(itemState)}</span>
      </div>
      ${detail ? `<div class="adm-master-area-detail">${escapeHtml(detail)}</div>` : ''}
    </article>`;
}

function markup() {
  return `
    <div class="adm-card adm-master-diagnostic-card" id="adm-system-health-card">
      <div class="adm-card-head adm-master-diagnostic-head">
        <div>
          <div class="adm-card-title">Estado del ecosistema</div>
          <p>Disponibilidad operativa de las autoridades reales de Tintin. No muestra datos de clientas, credenciales ni secretos; ejecuta probes mínimos y no destructivos.</p>
        </div>
        <div class="adm-master-actions">
          <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="btn-refresh-system-health">Actualizar estado</button>
        </div>
      </div>
      <div class="adm-card-body">
        <div class="adm-master-state-row">
          <span class="adm-master-state" id="system-health-state" data-state="NOT_VERIFIED">NO VERIFICADO</span>
          <span class="adm-master-freshness" id="system-health-checked">Abrí Diagnóstico para comprobar el sistema.</span>
        </div>
        <div class="adm-master-notice notice-info" id="system-health-notice">El estado operativo se consulta solo cuando abrís esta sección o pulsás Actualizar estado.</div>
        <div class="adm-master-meta" id="system-health-meta" hidden></div>
        <div class="adm-master-areas" id="system-health-areas"></div>
        <details class="adm-master-history" id="system-health-authorities" hidden>
          <summary>Autoridades y espejos canónicos</summary>
          <div class="adm-master-history-list" id="system-health-authorities-list"></div>
        </details>
      </div>
    </div>`;
}

function isVisible(section) {
  if (!section || section.hidden) return false;
  const style = window.getComputedStyle(section);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function setOverall(nextState, checkedAt = '') {
  const node = document.getElementById('system-health-state');
  const checked = document.getElementById('system-health-checked');
  if (node) {
    node.dataset.state = nextState;
    node.textContent = label(nextState);
  }
  if (checked) checked.textContent = checkedAt ? `Comprobado ${formatDate(checkedAt)}` : 'Sin comprobación reciente';
}

function renderMeta(payload) {
  const node = document.getElementById('system-health-meta');
  if (!node) return;
  const deployment = payload?.deployment || {};
  const sync = payload?.integrations?.appsScript?.summary || {};
  const syncAvailable = sync.available === true;
  const queue = payload?.integrations?.catalogSheetQueue || null;
  node.hidden = false;
  node.innerHTML = `
    <div class="adm-master-meta-item"><span>Commit desplegado</span><strong title="${escapeHtml(deployment.commitSha || '')}">${escapeHtml(shortSha(deployment.commitSha))}</strong></div>
    <div class="adm-master-meta-item"><span>Rama</span><strong>${escapeHtml(deployment.branch || '—')}</strong></div>
    <div class="adm-master-meta-item"><span>Último sync</span><strong>${escapeHtml(syncAvailable && sync.lastAt ? `${sync.lastStatus || '—'} · ${formatDate(sync.lastAt)}` : 'no verificado')}</strong></div>
    <div class="adm-master-meta-item"><span>Errores sync 24 h</span><strong>${escapeHtml(syncAvailable && Number.isFinite(Number(sync.errors24h)) ? Number(sync.errors24h) : '—')}</strong></div>
    <div class="adm-master-meta-item"><span>Cola Sheets pendiente</span><strong>${escapeHtml(queue ? `${Number(queue.pendingCount ?? 0)} (dead-letter: ${Number(queue.deadLetterCount ?? 0)})` : 'no verificado')}</strong></div>
    <div class="adm-master-meta-item"><span>Tarea más antigua en cola</span><strong>${escapeHtml(queue ? formatAgeMs(queue.oldestPendingAgeMs) : '—')}</strong></div>
    <div class="adm-master-meta-item"><span>Último éxito de cola</span><strong>${escapeHtml(queue?.lastSuccessAt ? formatDate(queue.lastSuccessAt) : 'no verificado')}</strong></div>`;
}

function renderAuthorities(authorities = {}) {
  const root = document.getElementById('system-health-authorities');
  const list = document.getElementById('system-health-authorities-list');
  if (!root || !list) return;
  const entries = Object.entries(authorities || {});
  root.hidden = entries.length === 0;
  list.innerHTML = entries.map(([domain, config]) => `
    <div class="adm-master-history-item">
      <strong>${escapeHtml(domain)}</strong>
      <span>${escapeHtml(config?.authority || '—')}</span>
      <span>${escapeHtml(config?.mirror ? `${config.mode} · ${config.mirror}` : config?.mode || '')}</span>
    </div>`).join('');
}

function render(payload) {
  const admin = payload?.admin || {};
  const integrations = payload?.integrations || {};
  const appsScript = integrations?.appsScript || {};
  const areas = document.getElementById('system-health-areas');
  if (!areas) return;

  const rows = [
    ['Firebase / Firestore', integrations.firebase, 'Cuenta de servicio y lectura del runtime administrativo'],
    ['Productos', admin.products, 'Firestore products'],
    ['Inventario', admin.productInventory, 'Firestore productInventory'],
    ['Colecciones', admin.collections, 'Firestore collections'],
    ['Pedidos', admin.orders, 'Firestore orders'],
    ['Usuarios', admin.users, 'Firebase Auth + Firestore users'],
    ['Auditoría', admin.auditLog, 'Firestore auditLog'],
    ['Configuración global', admin.settings, 'Firestore settings/general'],
    ['Contenido del sitio', admin.siteContent, 'Firestore site_content'],
    ['Visual Builder', admin.visualBuilder, 'Páginas, borradores e historial'],
    ['Resend', integrations.resend, 'Configuración privada de correo presente'],
    ['Cloudinary', integrations.cloudinary, 'Configuración privada de multimedia presente'],
    ['Google Sheets', integrations.sheets, 'Secreto del puente + protocolo de Apps Script verificado'],
    ['Apps Script', appsScript.protocolOk, appsScript.protocolOk
      ? `Protocolo ${appsScript.revision || 'actual'} · ${Number(appsScript.ms || 0)} ms`
      : `Estado ${appsScript.code || 'no_verificado'} · HTTP ${appsScript.httpStatus || 0}`],
  ];
  areas.innerHTML = rows.map(([name, value, detail]) => item(name, value, detail)).join('');
  setOverall(payload?.ok === true ? 'PASS' : 'FAIL', payload?.checkedAt || '');
  renderMeta(payload);
  renderAuthorities(payload?.authorities || {});

  const notice = document.getElementById('system-health-notice');
  if (notice) {
    const failures = rows.filter(([, value]) => value !== true).map(([name]) => name);
    const sync = appsScript.summary || {};
    const syncSuffix = sync.available === true && Number(sync.errors24h || 0) > 0
      ? ` Historial sync registra ${Number(sync.errors24h)} error(es) en las últimas 24 h.`
      : sync.available === true && Number(sync.syncing24h || 0) > 0
        ? ` Hay ${Number(sync.syncing24h)} registro(s) SYNCING en las últimas 24 h para revisar.`
        : '';
    notice.className = `adm-master-notice ${payload?.ok === true ? 'notice-info' : 'notice-error'}`;
    notice.textContent = payload?.ok === true
      ? `Las autoridades operativas y el puente de sincronización respondieron correctamente.${syncSuffix}`
      : `Hay componentes que requieren revisión: ${failures.join(', ') || 'estado general'}.${syncSuffix}`;
  }
}

async function authorizedFetch(forceToken = false) {
  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== String(SUPER_ADMIN).toLowerCase()) {
    throw new Error('La sesión de Super Admin no está disponible.');
  }
  const idToken = await user.getIdToken(forceToken);
  return fetch(HEALTH_URL, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { authorization: `Bearer ${idToken}` },
  });
}

async function load() {
  if (loading) return;
  loading = true;
  const button = document.getElementById('btn-refresh-system-health');
  if (button) {
    button.disabled = true;
    button.textContent = 'Comprobando…';
  }
  try {
    let response = await authorizedFetch(false);
    if (response.status === 401) response = await authorizedFetch(true);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true || !payload?.report) {
      throw new Error(payload?.error || 'El endpoint de estado no devolvió el contrato esperado.');
    }
    render(payload.report);
    loaded = true;
  } catch (error) {
    console.error('[Estado ecosistema]', error);
    setOverall('NOT_VERIFIED');
    const notice = document.getElementById('system-health-notice');
    if (notice) {
      notice.className = 'adm-master-notice notice-error';
      notice.textContent = error?.message || 'No se pudo comprobar el estado operativo del ecosistema.';
    }
  } finally {
    loading = false;
    if (button) {
      button.disabled = false;
      button.textContent = 'Actualizar estado';
    }
  }
}

function maybeLoad(section) {
  if (!loaded && isVisible(section)) load();
}

function mount() {
  if (mounted) return;
  const section = document.getElementById('section-diagnostico');
  if (!section) {
    window.setTimeout(mount, 120);
    return;
  }
  if (!document.getElementById('adm-system-health-card')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = markup().trim();
    const master = section.querySelector('#adm-master-diagnostic-card');
    if (master?.nextSibling) master.parentNode.insertBefore(wrapper.firstElementChild, master.nextSibling);
    else section.prepend(wrapper.firstElementChild);
  }
  document.getElementById('btn-refresh-system-health')?.addEventListener('click', load);
  observer?.disconnect();
  observer = new MutationObserver(() => maybeLoad(section));
  observer.observe(section, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  document.addEventListener('click', () => window.setTimeout(() => maybeLoad(section), 0), { passive: true });
  mounted = true;
  maybeLoad(section);
}

onAuthStateChanged(auth, user => {
  if (!user || String(user.email || '').toLowerCase() !== String(SUPER_ADMIN).toLowerCase()) return;
  mount();
});
