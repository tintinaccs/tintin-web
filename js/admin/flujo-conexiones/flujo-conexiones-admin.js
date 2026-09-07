// =============================================================
// TINTIN ACCESORIOS — Flujo real de decisiones y conexiones (render)
// =============================================================
// Consume datos-flujo-conexiones.js (evidencia estática de código) y, al
// pulsar "Revalidar", superpone una prueba EN VIVO real usando los mismos
// endpoints de solo lectura que ya existen para diagnóstico operativo
// (system-health, admin-runtime-health). No inventa infraestructura de
// monitoreo nueva: reutiliza lo que ya prueba conectividad real sin escribir
// datos. Nada de lo que hace este módulo crea, actualiza ni borra documentos.
import { ESTADOS, GENERATED_AT, NODES, EDGES } from './datos-flujo-conexiones.js';
import { auth } from '../../core/firebase/firebase.js?v=tintin-20260907-appcheck-token-2';

const CATEGORY_LABELS = {
  entrada: 'Entrada',
  auth: 'Autenticación',
  sesion: 'Sesión',
  datos: 'Datos',
  rol: 'Rol',
  perfil: 'Perfil',
  destino: 'Destino',
  infra: 'Infraestructura',
  'servicio-externo': 'Servicios externos',
  dominio: 'Dominio de negocio',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function slug(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function nodeById(id) {
  return NODES.find(node => node.id === id) || null;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// Mapa de nodos que sí tienen una prueba en vivo real disponible hoy, y cómo
// leer esa prueba desde las dos respuestas de salud existentes. Un nodo que
// no aparece acá se queda con su estado de evidencia de código — no se
// inventa una verificación en vivo que no existe.
function buildLiveChecks(systemHealth, adminHealth) {
  const out = {};
  const setFrom = (id, ok, note) => { if (ok !== null) out[id] = { ok, note }; };

  if (adminHealth && adminHealth.checks) {
    const c = adminHealth.checks;
    setFrom('productos', c.products?.ok ?? null, 'admin-runtime-health: lectura products');
    setFrom('inventario', c.productInventory?.ok ?? null, 'admin-runtime-health: lectura productInventory');
    setFrom('pedidos', c.orders?.ok ?? null, 'admin-runtime-health: lectura orders');
    setFrom('users-uid', c.users?.ok ?? null, 'admin-runtime-health: lectura users');
    setFrom('comentarios', c.reviews?.ok ?? null, 'admin-runtime-health: lectura reviewRecords');
    setFrom('likes', c.likes?.ok ?? null, 'admin-runtime-health: lectura likeRecords');
    setFrom('correos', c.emailLogs?.ok ?? null, 'admin-runtime-health: lectura emailLogs');
  }
  if (systemHealth) {
    setFrom('firestore', systemHealth.integrations?.firebase ?? null, 'system-health: runtime admin (Firestore) responde');
    setFrom('firestore-fuente-verdad', systemHealth.integrations?.firebase ?? null, 'system-health: runtime admin (Firestore) responde');
    setFrom('apps-script', systemHealth.integrations?.appsScript?.reachable ?? null,
      `system-health: Apps Script ${systemHealth.integrations?.appsScript?.reachable ? 'alcanzable' : 'no alcanzable'} (protocolo ${systemHealth.integrations?.appsScript?.protocolOk ? 'reconocido' : 'no confirmado'})`);
    setFrom('google-sheets', systemHealth.integrations?.sheets ?? null, 'system-health: guardas de sincronización con Sheets configuradas y respondiendo');
    if (systemHealth.deployment?.commitSha) {
      setFrom('deployments', true, `system-health: commit desplegado ${systemHealth.deployment.commitSha.slice(0, 10)} (${systemHealth.deployment.branch || 'branch desconocida'})`);
    }
  }
  return out;
}

function stateBadgeHtml(state) {
  return `<span class="tfc-pill-state tfc-state-${slug(state)}">${escapeHtml(state)}</span>`;
}

function evidenceHtml(evidence) {
  if (!evidence || !evidence.length) return '<li class="tfc-evidence-empty">Sin evidencia registrada.</li>';
  return evidence.map(ev => {
    const loc = ev.line ? `${ev.file}:${ev.line}` : ev.file;
    const note = ev.note ? ` — ${escapeHtml(ev.note)}` : '';
    return `<li><code>${escapeHtml(loc)}</code>${note}</li>`;
  }).join('');
}

export function initConnectionsFlow({ role } = {}) {
  const root = document.getElementById('section-flujo-conexiones');
  if (!root || root.dataset.tfcMounted === '1') return;
  root.dataset.tfcMounted = '1';

  const liveState = { checkedAt: null, byId: {}, error: '' };

  root.innerHTML = `
    <div class="adm-card tfc-card">
      <div class="adm-card-head tfc-head">
        <div>
          <div class="adm-card-title">Flujo real de decisiones y conexiones</div>
          <p>Muestra únicamente conexiones que existen hoy en el código, la configuración y los servicios — nunca un diseño ideal. Lo desconectado, incompleto o sin confirmar se marca así.</p>
        </div>
        <button type="button" class="adm-btn adm-btn-primary" id="tfc-btn-revalidate">Revalidar en vivo</button>
      </div>
      <div class="adm-card-body">
        <div class="adm-diagnostic-safety" role="note">
          <strong>Modo de solo lectura.</strong>
          "Revalidar" solo ejecuta llamadas GET a endpoints de diagnóstico que ya existen
          (<code>/api/system-health</code>, <code>/api/admin-runtime-health</code>). Ningún botón de este panel
          crea, actualiza ni elimina pedidos, productos ni datos reales.
        </div>
        <div class="tfc-meta">
          <span>Evidencia de código generada: <strong>${escapeHtml(GENERATED_AT)}</strong></span>
          <span id="tfc-live-timestamp">Sin verificación en vivo todavía.</span>
        </div>
        <div id="tfc-live-error" class="tfc-live-error" hidden></div>
        <div class="tfc-toolbar">
          <input type="search" id="tfc-search" class="adm-select" placeholder="Buscar nodo por nombre…">
          <select id="tfc-filter-state" class="adm-select">
            <option value="">Todos los estados</option>
            ${Object.values(ESTADOS).map(state => `<option value="${escapeHtml(state)}">${escapeHtml(state)}</option>`).join('')}
          </select>
        </div>
        <div class="tfc-legend">
          ${Object.values(ESTADOS).map(state => `<span class="tfc-legend-item">${stateBadgeHtml(state)}</span>`).join('')}
        </div>
        <div id="tfc-lanes" class="tfc-lanes"></div>
        <div class="tfc-detail" id="tfc-detail" hidden></div>
        <div class="tfc-edges-head">Conexiones (${EDGES.length})</div>
        <div id="tfc-edges" class="tfc-edges"></div>
      </div>
    </div>
  `;

  const lanesEl = root.querySelector('#tfc-lanes');
  const edgesEl = root.querySelector('#tfc-edges');
  const detailEl = root.querySelector('#tfc-detail');
  const searchEl = root.querySelector('#tfc-search');
  const stateFilterEl = root.querySelector('#tfc-filter-state');
  const liveTimestampEl = root.querySelector('#tfc-live-timestamp');
  const liveErrorEl = root.querySelector('#tfc-live-error');

  let selectedNodeId = null;

  function effectiveState(node) {
    const live = liveState.byId[node.id];
    if (!live) return node.state;
    return live.ok ? ESTADOS.PROD : ESTADOS.ERROR;
  }

  function nodeMatchesFilters(node) {
    const term = searchEl.value.trim().toLowerCase();
    const stateFilter = stateFilterEl.value;
    if (term && !node.label.toLowerCase().includes(term)) return false;
    if (stateFilter && effectiveState(node) !== stateFilter) return false;
    return true;
  }

  function renderLanes() {
    lanesEl.innerHTML = CATEGORY_ORDER.map(category => {
      const nodes = NODES.filter(node => node.category === category && nodeMatchesFilters(node));
      if (!nodes.length) return '';
      const pills = nodes.map(node => {
        const state = effectiveState(node);
        const live = liveState.byId[node.id];
        const liveMark = live ? `<span class="tfc-live-dot" title="Verificado en vivo">${live.ok ? '●' : '✕'}</span>` : '';
        const active = node.id === selectedNodeId ? ' tfc-pill-active' : '';
        return `<button type="button" class="tfc-pill tfc-state-${slug(state)}${active}" data-node-id="${escapeHtml(node.id)}">${liveMark}${escapeHtml(node.label)}</button>`;
      }).join('');
      return `<div class="tfc-lane"><div class="tfc-lane-title">${escapeHtml(CATEGORY_LABELS[category])}</div><div class="tfc-lane-pills">${pills}</div></div>`;
    }).join('') || '<p class="tfc-empty">Ningún nodo coincide con el filtro actual.</p>';
  }

  function renderEdges() {
    const visibleIds = new Set(NODES.filter(nodeMatchesFilters).map(node => node.id));
    const rows = EDGES.filter(edge => {
      if (selectedNodeId) return edge.from === selectedNodeId || edge.to === selectedNodeId;
      return visibleIds.has(edge.from) || visibleIds.has(edge.to);
    }).map(edge => {
      const from = nodeById(edge.from);
      const to = nodeById(edge.to);
      const label = edge.label ? `<span class="tfc-edge-label">${escapeHtml(edge.label)}</span>` : '';
      return `<div class="tfc-edge-row">
        <span class="tfc-edge-node">${escapeHtml(from?.label || edge.from)}</span>
        <span class="tfc-edge-arrow">→</span>
        <span class="tfc-edge-node">${escapeHtml(to?.label || edge.to)}</span>
        ${label}
        ${stateBadgeHtml(edge.state)}
      </div>`;
    });
    edgesEl.innerHTML = rows.join('') || '<p class="tfc-empty">Sin conexiones para este filtro.</p>';
  }

  function renderDetail() {
    if (!selectedNodeId) { detailEl.hidden = true; detailEl.innerHTML = ''; return; }
    const node = nodeById(selectedNodeId);
    if (!node) { detailEl.hidden = true; return; }
    const live = liveState.byId[node.id];
    const liveHtml = live
      ? `<p class="tfc-detail-live"><strong>Verificación en vivo (${escapeHtml(liveState.checkedAt || '')}):</strong> ${live.ok ? 'OK' : 'FALLÓ'} — ${escapeHtml(live.note)}</p>`
      : '<p class="tfc-detail-live tfc-detail-live-none">Sin prueba en vivo disponible para este nodo; el estado mostrado es evidencia de código.</p>';
    detailEl.hidden = false;
    detailEl.innerHTML = `
      <div class="tfc-detail-head">
        <strong>${escapeHtml(node.label)}</strong>
        ${stateBadgeHtml(effectiveState(node))}
        <button type="button" class="tfc-detail-close" id="tfc-detail-close" aria-label="Cerrar">×</button>
      </div>
      ${node.notes ? `<p class="tfc-detail-notes">${escapeHtml(node.notes)}</p>` : ''}
      ${liveHtml}
      <ul class="tfc-detail-evidence">${evidenceHtml(node.evidence)}</ul>
    `;
    detailEl.querySelector('#tfc-detail-close').addEventListener('click', () => {
      selectedNodeId = null;
      renderAll();
    });
  }

  function renderAll() {
    renderLanes();
    renderEdges();
    renderDetail();
  }

  lanesEl.addEventListener('click', event => {
    const btn = event.target.closest('[data-node-id]');
    if (!btn) return;
    const id = btn.dataset.nodeId;
    selectedNodeId = selectedNodeId === id ? null : id;
    renderAll();
  });
  searchEl.addEventListener('input', renderAll);
  stateFilterEl.addEventListener('change', renderAll);

  const revalidateBtn = root.querySelector('#tfc-btn-revalidate');
  revalidateBtn.addEventListener('click', async () => {
    revalidateBtn.disabled = true;
    revalidateBtn.textContent = 'Revalidando…';
    liveErrorEl.hidden = true;
    liveErrorEl.textContent = '';
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('La sesión de Super Admin no está disponible.');
      const idToken = await user.getIdToken();
      const headers = { authorization: `Bearer ${idToken}` };
      const [systemHealthRes, adminHealthRes] = await Promise.allSettled([
        fetch('/api/system-health', { credentials: 'same-origin', headers }),
        fetch('/api/admin-runtime-health', { credentials: 'same-origin', headers }),
      ]);
      let systemHealth = null;
      let adminHealth = null;
      const errors = [];

      if (systemHealthRes.status === 'fulfilled') {
        const body = await systemHealthRes.value.json().catch(() => null);
        if (body?.ok) systemHealth = body.report;
        else errors.push(body?.error || `system-health respondió ${systemHealthRes.value.status}`);
      } else {
        errors.push(`system-health: ${systemHealthRes.reason?.message || 'fallo de red'}`);
      }

      if (adminHealthRes.status === 'fulfilled') {
        const body = await adminHealthRes.value.json().catch(() => null);
        if (body) adminHealth = body;
        if (body?.ok === false && body?.error) errors.push(body.error);
      } else {
        errors.push(`admin-runtime-health: ${adminHealthRes.reason?.message || 'fallo de red'}`);
      }

      liveState.byId = buildLiveChecks(systemHealth, adminHealth);
      liveState.checkedAt = new Date().toLocaleString('es-AR');
      liveTimestampEl.textContent = `Última verificación en vivo: ${liveState.checkedAt} (${Object.keys(liveState.byId).length} nodos con prueba real).`;

      if (errors.length) {
        liveErrorEl.hidden = false;
        liveErrorEl.textContent = `Algunas pruebas no se pudieron confirmar: ${errors.join(' · ')}`;
      }
    } catch (error) {
      liveErrorEl.hidden = false;
      liveErrorEl.textContent = `No se pudo revalidar: ${error?.message || error}`;
    } finally {
      revalidateBtn.disabled = false;
      revalidateBtn.textContent = 'Revalidar en vivo';
      renderAll();
    }
  });

  renderAll();
}
