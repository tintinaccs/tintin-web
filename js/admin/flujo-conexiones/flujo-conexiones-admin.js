// =============================================================
// TINTIN ACCESORIOS — Flujo real de decisiones y conexiones (render)
// =============================================================
// Consume datos-flujo-conexiones.js (evidencia estática de código) y, al
// pulsar "Revalidar", superpone una prueba EN VIVO real usando los mismos
// endpoints de solo lectura que ya existen para diagnóstico operativo
// (system-health, admin-runtime-health). No inventa infraestructura de
// monitoreo nueva: reutiliza lo que ya prueba conectividad real sin escribir
// datos. Nada de lo que hace este módulo crea, actualiza ni borra documentos.
import { ESTADOS, GENERATED_AT, NODES, EDGES } from './datos-flujo-conexiones.js?v=tintin-20260918-flow-connections-cache-fix-1';
import { resolveState, isAttentionState } from './estado-flujo.js?v=tintin-20260918-flow-connections-cache-fix-1';
import { buildLiveChecks, buildLiveEdges } from './live-checks.js?v=tintin-20260918-flow-connections-green-evidence-1';
import { auth } from '../../core/firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';

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

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function nodeById(id) {
  return NODES.find(node => node.id === id) || null;
}

function edgeById(id) {
  return EDGES.find(edge => edge.id === id) || null;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
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

  const liveState = { checkedAt: null, byId: {}, byEdgeId: {}, error: '', endpointStatus: {} };

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
          "Revalidar" solo ejecuta lecturas GET de producción (<code>/api/health</code>,
          <code>/api/system-health</code>, <code>/api/admin-runtime-health</code> y los headers de
          <code>/admin.html</code>). Ningún botón de este panel
          crea, actualiza ni elimina pedidos, productos ni datos reales.
        </div>
        <div class="tfc-meta">
          <span>Evidencia de código generada: <strong>${escapeHtml(GENERATED_AT)}</strong></span>
          <span id="tfc-live-timestamp">Sin verificación en vivo todavía.</span>
        </div>
        <div id="tfc-live-error" class="tfc-live-error" hidden></div>
        <div id="tfc-summary" class="tfc-summary" aria-label="Resumen del flujo"></div>
        <div class="tfc-toolbar">
          <input type="search" id="tfc-search" class="adm-select" placeholder="Buscar nodo, conexión, servicio, archivo o estado…">
          <select id="tfc-filter-state" class="adm-select">
            <option value="">Todos los estados</option>
            <option value="__attention">Solo requiere atención</option>
            <option value="__no-green">No verdes</option>
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
  const summaryEl = root.querySelector('#tfc-summary');

  let selectedNodeId = null;
  let selectedEdgeId = null;

  function effectiveState(node) {
    return resolveState(node, liveState.byId[node.id], ESTADOS);
  }

  function effectiveEdgeState(edge) {
    return resolveState(edge, liveState.byEdgeId[edge.id], ESTADOS);
  }

  function searchableEvidence(record) {
    return (record.evidence || []).flatMap(item => [item.file, item.note]).filter(Boolean).join(' ');
  }

  function matchesFilter(record, state, isEdge = false) {
    const term = searchEl.value.trim().toLowerCase();
    const stateFilter = stateFilterEl.value;
    const from = isEdge ? nodeById(record.from)?.label || record.from : '';
    const to = isEdge ? nodeById(record.to)?.label || record.to : '';
    const haystack = [record.id, record.label, record.category, from, to, searchableEvidence(record), state, record.baselineState].filter(Boolean).join(' ').toLowerCase();
    if (term && !haystack.includes(term)) return false;
    if (stateFilter === '__attention' || stateFilter === '__no-green') return isAttentionState(state, ESTADOS);
    if (stateFilter && state !== stateFilter) return false;
    return true;
  }

  function nodeMatchesFilters(node) { return matchesFilter(node, effectiveState(node)); }
  function edgeMatchesFilters(edge) { return matchesFilter(edge, effectiveEdgeState(edge), true); }

  function renderSummary() {
    const nodeStates = NODES.map(effectiveState);
    const edgeStates = EDGES.map(effectiveEdgeState);
    const green = [...nodeStates, ...edgeStates].filter(state => state === ESTADOS.PROD).length;
    const attention = nodeStates.length + edgeStates.length - green;
    const checked = liveState.checkedAt ? `Última revalidación: ${escapeHtml(liveState.checkedAt)}${isStale(liveState.checkedAt) ? ' · STALE / requiere revalidación' : ''}` : 'Sin revalidación live en esta sesión.';
    summaryEl.innerHTML = `<div class="tfc-summary-item"><strong>${NODES.length}</strong><span>nodos</span></div><div class="tfc-summary-item"><strong>${EDGES.length}</strong><span>conexiones</span></div><div class="tfc-summary-item is-green"><strong>${green}</strong><span>verificados</span></div><div class="tfc-summary-item is-attention"><strong>${attention}</strong><span>requieren atención</span></div><div class="tfc-summary-freshness">${checked}</div>`;
  }

  function isStale(checkedAt) {
    const time = Date.parse(checkedAt || '');
    return !Number.isFinite(time) || Date.now() - time > STALE_AFTER_MS;
  }

  function renderLanes() {
    lanesEl.innerHTML = CATEGORY_ORDER.map(category => {
      const nodes = NODES.filter(node => node.category === category && nodeMatchesFilters(node));
      if (!nodes.length) return '';
      const pills = nodes.map(node => {
        const state = effectiveState(node);
        const live = liveState.byId[node.id];
        const liveMark = live ? `<span class="tfc-live-dot" title="${escapeHtml(live.note)}">${live.ok ? '●' : '✕'}</span>` : '';
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
    }).filter(edge => {
      if (selectedNodeId) return true;
      return edgeMatchesFilters(edge);
    }).map(edge => {
      const from = nodeById(edge.from);
      const to = nodeById(edge.to);
      const label = edge.label ? `<span class="tfc-edge-label">${escapeHtml(edge.label)}</span>` : '';
      const state = effectiveEdgeState(edge);
      const live = liveState.byEdgeId[edge.id];
      const active = edge.id === selectedEdgeId ? ' is-selected' : '';
      return `<button type="button" class="tfc-edge-row${active}" data-edge-id="${escapeHtml(edge.id)}">
        <span class="tfc-edge-node">${escapeHtml(from?.label || edge.from)}</span>
        <span class="tfc-edge-arrow">→</span>
        <span class="tfc-edge-node">${escapeHtml(to?.label || edge.to)}</span>
        ${label}
        ${stateBadgeHtml(state)}
        ${live ? `<span class="tfc-edge-live" title="${escapeHtml(live.note)}">${live.ok ? '● live' : '✕ live'}</span>` : ''}
      </button>`;
    });
    edgesEl.innerHTML = rows.join('') || '<p class="tfc-empty">Sin conexiones para este filtro.</p>';
  }

  function renderDetail() {
    const record = selectedNodeId ? nodeById(selectedNodeId) : selectedEdgeId ? edgeById(selectedEdgeId) : null;
    if (!record) { detailEl.hidden = true; detailEl.innerHTML = ''; return; }
    const isEdge = Boolean(selectedEdgeId);
    const live = isEdge ? liveState.byEdgeId[record.id] : liveState.byId[record.id];
    const state = isEdge ? effectiveEdgeState(record) : effectiveState(record);
    const from = isEdge ? nodeById(record.from)?.label || record.from : '';
    const to = isEdge ? nodeById(record.to)?.label || record.to : '';
    const liveHtml = live
      ? `<p class="tfc-detail-live"><strong>Verificación en vivo (${escapeHtml(live.checkedAt || liveState.checkedAt || '')}):</strong> ${live.ok ? 'OK' : 'FALLÓ'} — ${escapeHtml(live.note)} <span class="tfc-evidence-level">${escapeHtml(live.evidenceLevel)}</span></p>`
      : '<p class="tfc-detail-live tfc-detail-live-none">Sin prueba en vivo disponible; el estado mostrado es evidencia de código o contrato.</p>';
    detailEl.hidden = false;
    detailEl.innerHTML = `
      <div class="tfc-detail-head">
        <strong>${escapeHtml(isEdge ? `${from} → ${to}` : record.label)}</strong>
        ${stateBadgeHtml(state)}
        <button type="button" class="tfc-detail-close" id="tfc-detail-close" aria-label="Cerrar">×</button>
      </div>
      ${record.label ? `<p class="tfc-detail-notes">${escapeHtml(record.label)}</p>` : ''}
      <p class="tfc-detail-meta"><strong>Identificador:</strong> <code>${escapeHtml(record.id)}</code> · <strong>Nivel:</strong> ${escapeHtml(live?.evidenceLevel || record.evidenceLevel || 'DOCUMENTATION_ONLY')}</p>
      ${liveHtml}
      ${record.notes ? `<p class="tfc-detail-notes">${escapeHtml(record.notes)}</p>` : ''}
      <ul class="tfc-detail-evidence">${evidenceHtml(record.evidence)}</ul>
    `;
    detailEl.querySelector('#tfc-detail-close').addEventListener('click', () => {
      selectedNodeId = null;
      selectedEdgeId = null;
      renderAll();
    });
  }

  function renderAll() {
    renderSummary();
    renderLanes();
    renderEdges();
    renderDetail();
  }

  lanesEl.addEventListener('click', event => {
    const btn = event.target.closest('[data-node-id]');
    if (!btn) return;
    const id = btn.dataset.nodeId;
    selectedNodeId = selectedNodeId === id ? null : id;
    selectedEdgeId = null;
    renderAll();
  });
  edgesEl.addEventListener('click', event => {
    const row = event.target.closest('[data-edge-id]');
    if (!row) return;
    selectedEdgeId = selectedEdgeId === row.dataset.edgeId ? null : row.dataset.edgeId;
    selectedNodeId = null;
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
      const errors = [];
      const readJson = async (url, options = {}) => {
        try {
          const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
          const body = await response.json().catch(() => null);
          return { status: response.status, ok: response.ok, body };
        } catch (error) {
          return { status: 0, ok: false, body: null, error: error?.message || 'fallo de red' };
        }
      };
      const publicHealth = await readJson('/api/health');
      if (!publicHealth.ok || publicHealth.body?.ok !== true) errors.push(`/api/health respondió ${publicHealth.status || 'sin respuesta'}`);

      let authHeaders = {};
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        authHeaders = { authorization: `Bearer ${idToken}` };
      } else {
        errors.push('No hay una sesión de Super Admin para probes protegidos.');
      }
      const [systemHealth, adminHealth, pageProbe, ...routeProbes] = await Promise.all([
        user ? readJson('/api/system-health', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/admin-runtime-health', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        fetch('/admin.html', { credentials: 'same-origin', cache: 'no-store' }).then(response => ({
          status: response.status,
          csp: Boolean(response.headers.get('content-security-policy')),
        })).catch(error => ({ status: 0, csp: false, error: error?.message || 'fallo de red' })),
        ...[
          ['home', '/'],
          ['login', '/login'],
          ['profile', '/perfil'],
          ['admin', '/admin'],
          ['checkout', '/checkout'],
          ['cart', '/'],
        ].map(async ([key, path]) => {
          try {
            const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
            const body = key === 'cart' ? await response.text() : '';
            return [key, {
              path,
              status: response.status,
              ok: response.ok,
              hasCartDrawer: key === 'cart' && /id=["']cart-drawer["']/.test(body),
            }];
          } catch (error) {
            return [key, { path, status: 0, ok: false, error: error?.message || 'fallo de red' }];
          }
        }),
      ]);
      if (user && (!systemHealth.ok || systemHealth.body?.ok !== true)) errors.push(`/api/system-health respondió ${systemHealth.status || 'sin respuesta'}`);
      if (user && (!adminHealth.ok || adminHealth.body?.ok !== true)) errors.push(`/api/admin-runtime-health respondió ${adminHealth.status || 'sin respuesta'}`);

      const checkedAt = new Date().toISOString();
      const routeProbeMap = Object.fromEntries(routeProbes);
      liveState.checkedAt = checkedAt;
      liveState.endpointStatus = { health: publicHealth.status, systemHealth: systemHealth.status, adminHealth: adminHealth.status, adminPage: pageProbe.status };
      liveState.byId = buildLiveChecks({
        publicHealth,
        systemHealth,
        adminHealth: { ...adminHealth, checks: adminHealth.body?.checks },
        headers: pageProbe,
        routeProbes: routeProbeMap,
      }, checkedAt);
      liveState.byEdgeId = buildLiveEdges({ publicHealth, systemHealth, headers: pageProbe }, checkedAt);
      liveTimestampEl.textContent = `Última verificación en vivo: ${checkedAt} (${Object.keys(liveState.byId).length} nodos y ${Object.keys(liveState.byEdgeId).length} conexiones con probe).`;

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

  // Abrir la sección debe mostrar el estado real de producción sin exigir un
  // segundo clic. Sigue siendo un conjunto de GETs de solo lectura.
  window.setTimeout(() => revalidateBtn.click(), 0);
}
