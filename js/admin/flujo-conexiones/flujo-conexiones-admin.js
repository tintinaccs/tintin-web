import { readAdminFirestore } from "../auth/lecturas-admin.js?v=tintin-20261004-admin-connections-3-first-render-merge-20261010-1";
// =============================================================
// TINTIN ACCESORIOS — Flujo real de decisiones y conexiones (render)
// =============================================================
// Comprueba automáticamente la evidencia actual con las lecturas de producción
// existentes. Los sellos históricos no deciden colores y no se escriben datos.
import { ESTADOS, GENERATED_AT, NODES, EDGES } from './datos-flujo-conexiones.js?v=tintin-20261010-auto-flow-1';
import { resolveAutomaticState, isAttentionState, liveMarker, shouldShowFlowEdge, createAutomaticMonitor, CHECK_INTERVAL_MS, EVIDENCE_MAX_AGE_MS } from './estado-flujo.js?v=tintin-20261010-auto-flow-1';
import { buildLiveChecks, buildLiveEdges, ciEvidenceProblem } from './live-checks.js?v=tintin-20261010-auto-flow-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1-first-render-merge-20261010-1';
import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { waitForAdminAppCheck } from '../auth/app-check-admin.js?v=tintin-20261004-admin-connections-3';
import { collection, doc, getDocFromServer as getDoc, getDocsFromServer as getDocs, limit, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

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

async function probeRenderedCart(signal) {
  const routeProbe = fetch('/', { credentials: 'same-origin', cache: 'no-store', signal })
    .then(async response => {
      await response.body?.cancel?.();
      return { path: '/', status: response.status, ok: response.ok };
    })
    .catch(error => ({ path: '/', status: 0, ok: false, error: error?.message || 'fallo de red' }));

  const drawerProbe = new Promise(resolve => {
    const frame = document.createElement('iframe');
    let settled = false;
    const cleanup = value => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      observer?.disconnect();
      signal?.removeEventListener('abort', onAbort);
      frame.remove();
      resolve(value);
    };
    const onAbort = () => cleanup(false);
    let observer;
    const timeoutId = window.setTimeout(() => cleanup(false), 10_000);
    // El sitio evita inicializar algunos componentes cuando el documento queda
    // fuera del árbol de renderizado. Lo mantenemos imperceptible y fuera de la
    // pantalla, pero renderizable, para observar el mismo panel que ve un cliente.
    // Con 1×1 px la página reporta innerWidth 0, nunca sale de
    // tt-store-gate-pending y el carrito no llega a montarse: el probe daba
    // rojo aunque el carrito real funcionara. Se usa un viewport de teléfono.
    if (signal?.aborted) { cleanup(false); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:390px;height:844px;opacity:0;pointer-events:none;border:0';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.addEventListener('load', () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      if (doc.getElementById('cart-drawer')) return cleanup(true);
      observer = new MutationObserver(() => {
        if (doc.getElementById('cart-drawer')) cleanup(true);
      });
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    }, { once: true });
    frame.src = `/?tfc-cart-probe=${Date.now()}`;
    document.body.append(frame);
  });

  const [route, hasCartDrawer] = await Promise.all([routeProbe, drawerProbe]);
  return ['cart', { ...route, hasCartDrawer }];
}

async function probeClientFirestoreRead(label, read) {
  try {
    const snapshot = await read();
    return { label, ok: true, status: 200, count: snapshot.size };
  } catch (error) {
    const code = String(error?.code || '');
    const status = /permission-denied|unauthenticated/i.test(code) ? 403 : 0;
    return { label, ok: false, status, authRequired: status === 403, error: code || error?.message || 'fallo de Firestore' };
  }
}

async function probeClientFirestoreRules(user) {
  if (!user || !await waitForAdminAppCheck(12000)) {
    const unavailable = { ok: false, status: 0, authRequired: true, error: 'App Check o sesión no disponible' };
    return {
      favorites: { label: 'Favoritos', ...unavailable },
      notifications: { label: 'Notificaciones', ...unavailable },
      cart: { label: 'Carrito', ...unavailable },
      products: { label: 'Productos', ...unavailable },
      orders: { label: 'Pedidos', ...unavailable },
    };
  }
  // Hay que esperar las lecturas: devolver promesas sin resolver hacía
  // que `favorites.ok` / `notifications.ok` fueran siempre undefined y el flujo
  // reportara "no confirmado" aunque las Rules permitieran la lectura.
  // Productos y pedidos se leen igual que los lee el panel (una fila, sin
  // modificar nada): prueban que esta sesión llega a esos datos por las Rules
  // desplegadas. Sólo se usa el resultado ok/denegado, nunca el contenido.
  const [favorites, notifications, cart, products, orders] = await Promise.all([
    probeClientFirestoreRead('Favoritos', () => getDocs(query(
      collection(db, 'users', user.uid, 'favorites'), limit(1),
    ))),
    probeClientFirestoreRead('Notificaciones', () => getDocs(query(
      collection(db, 'adminNotifications'), limit(1),
    ))),
    probeClientFirestoreRead('Carrito', () => getDocs(query(
      collection(db, 'users', user.uid, 'cart'), limit(1),
    ))),
    probeClientFirestoreRead('Productos', () => getDocs(query(
      collection(db, 'products'), limit(1),
    ))),
    probeClientFirestoreRead('Pedidos', () => getDocs(query(
      collection(db, 'orders'), limit(1),
    ))),
  ]);
  return { favorites, notifications, cart, products, orders };
}

// Comprueba únicamente la lectura de estadísticas públicas de engagement para
// un producto existente. Son GETs sin mutación: no dejan likes/reseñas de prueba.
async function probeEngagementStats(user) {
  const unavailable = { ok: false, status: 0, error: 'sin sesión o App Check' };
  if (!user || !await waitForAdminAppCheck(12000)) return { likes: unavailable, reviews: unavailable };
  try {
    const products = await getDocs(query(collection(db, 'products'), limit(1)));
    const productId = products.docs[0]?.id;
    if (!productId) {
      const noProduct = { ok: false, status: 0, error: 'no hay producto para probar engagement' };
      return { likes: noProduct, reviews: noProduct };
    }
    const readStats = async action => {
      try {
        const response = await fetch(`/api/engagement?action=${action}&productId=${encodeURIComponent(productId)}`, {
          credentials: 'same-origin', cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        const shapeOk = action === 'productLikes'
          ? payload?.productId === productId && Number.isFinite(Number(payload?.likeCount))
          : payload?.stats && typeof payload.stats === 'object';
        return { ok: response.ok && payload?.ok === true && shapeOk, status: response.status };
      } catch {
        return { ok: false, status: 0 };
      }
    };
    const [likes, reviews] = await Promise.all([readStats('productLikes'), readStats('reviewStats')]);
    return { likes, reviews };
  } catch {
    const unreadable = { ok: false, status: 0, error: 'no se pudo leer un producto para el probe' };
    return { likes: unreadable, reviews: unreadable };
  }
}

// Último registro real de "me gusta" y de reseñas. firestore.rules niega toda
// escritura de cliente en likeRecords/reviewRecords: sólo /api/engagement las
// escribe, así que un documento ahí es una escritura real de la API en
// producción. Es una lectura de una fila con la sesión del Super Admin; del
// documento sólo se usa su fecha, nunca los datos de la clienta.
async function probeEngagementRecords(user) {
  const unavailable = { ok: false, status: 0, authRequired: true, exists: false, lastAt: '', error: 'sin sesión o App Check' };
  if (!user || !await waitForAdminAppCheck(12000)) return { likes: unavailable, reviews: unavailable };
  const latest = async collectionId => {
    try {
      const snapshot = await getDocs(query(collection(db, collectionId), orderBy('createdAt', 'desc'), limit(1)));
      const createdAt = snapshot.docs[0]?.data()?.createdAt;
      const date = typeof createdAt?.toDate === 'function' ? createdAt.toDate() : new Date(createdAt || '');
      const lastAt = snapshot.empty || Number.isNaN(date.getTime()) ? '' : date.toISOString();
      return { ok: true, status: 200, exists: !snapshot.empty, lastAt };
    } catch (error) {
      const code = String(error?.code || '');
      const status = /permission-denied|unauthenticated/i.test(code) ? 403 : 0;
      return { ok: false, status, authRequired: status === 403, exists: false, lastAt: '', error: code || error?.message || 'fallo de Firestore' };
    }
  };
  const [likes, reviews] = await Promise.all([latest('likeRecords'), latest('reviewRecords')]);
  return { likes, reviews };
}

// GET diagnóstico: no envía secretos ni escribe productos. El estado del
// guard se consulta sin provocar rechazos HTTP esperados en la consola.
async function probeSheetsWebhook() {
  try {
    const response = await fetch('/api/sheets-products-webhook', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const body = await response.json().catch(() => null);
    return { status: response.status, revision: body?.revision || '', authState: body?.authState || '' };
  } catch (error) {
    return { status: 0, revision: '', authState: '', error: error?.message || 'fallo de red' };
  }
}

// Comprueba únicamente la identidad que ya está autenticada en este panel.
// No inicia un proveedor, no renueva el perfil ni escribe en Firestore: sirve
// para distinguir una sesión/rol/perfil realmente disponibles de evidencia
// estática que antes quedaba amarilla aunque el Super Admin estuviera usando
// el panel con normalidad.
async function probeCurrentSession(user, role) {
  if (!user) {
    return { authenticated: false, token: false, role: false, profile: false, status: 401, authRequired: true };
  }

  let tokenResult;
  try {
    tokenResult = await user.getIdTokenResult();
  } catch (error) {
    const code = String(error?.code || '');
    return {
      authenticated: true,
      token: false,
      role: role === 'superadmin',
      profile: false,
      status: /unauthenticated/i.test(code) ? 401 : 0,
      authRequired: true,
      error: code || error?.message || 'no se pudo renovar el token de la sesión actual',
    };
  }

  const emailClaim = String(tokenResult?.claims?.email || '').trim().toLowerCase();
  const projectClaim = String(tokenResult?.claims?.aud || '').trim();
  const identityClaimsOk =
    emailClaim === String(user.email || '').trim().toLowerCase() &&
    projectClaim === 'tintin-accesorios';

  try {
    const profile = await getDoc(doc(db, 'users', user.uid));
    return {
      authenticated: true,
      token: identityClaimsOk,
      role: role === 'superadmin',
      profile: profile.exists(),
      emailClaim: emailClaim === String(user.email || '').trim().toLowerCase(),
      projectClaim: projectClaim === 'tintin-accesorios',
      status: 200,
    };
  } catch (error) {
    const code = String(error?.code || '');
    const status = /permission-denied|unauthenticated/i.test(code) ? 403 : 0;
    return {
      authenticated: true,
      token: identityClaimsOk,
      role: role === 'superadmin',
      profile: false,
      emailClaim: emailClaim === String(user.email || '').trim().toLowerCase(),
      projectClaim: projectClaim === 'tintin-accesorios',
      status,
      authRequired: status === 403,
      firestoreError: code || error?.message || 'no se pudo leer el perfil actual',
    };
  }
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
        <span id="tfc-monitor-status" role="status" aria-live="polite">Comprobación automática activa</span>
      </div>
      <div class="adm-card-body">
        <div id="tfc-revalidation-progress" class="tfc-revalidation-progress" hidden>
          <p id="tfc-revalidation-status" role="status" aria-live="polite"></p>
          <progress id="tfc-revalidation-bar" max="100" value="0" aria-label="Avance de la revalidación"></progress>
        </div>
        <div class="adm-diagnostic-safety" role="note">
          <strong>Monitoreo automático.</strong> Los colores se actualizan según las comprobaciones actuales,
          sin confirmaciones manuales. Verde: verificado; amarillo: pendiente o sin evidencia suficiente;
          rojo: fallo; naranja: parcialmente verificado. Sólo se realizan lecturas de producción.
        </div>
        <div class="tfc-meta">
          <span>Evidencia de código generada: <strong>${escapeHtml(GENERATED_AT)}</strong></span>
          <span id="tfc-live-timestamp">Comprobando conexiones…</span>
        </div>
        <div id="tfc-live-error" class="tfc-live-error" role="status" hidden><span id="tfc-live-error-text"></span></div>
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
  const monitorStatusEl = root.querySelector('#tfc-monitor-status');

  let selectedNodeId = null;
  let selectedEdgeId = null;

  function effectiveState(node) {
    return resolveAutomaticState(node, liveState.byId[node.id], ESTADOS, {
      maxAgeMs: EVIDENCE_MAX_AGE_MS, available: navigator.onLine !== false,
    });
  }

  function effectiveEdgeState(edge) {
    return resolveAutomaticState(edge, liveState.byEdgeId[edge.id], ESTADOS, {
      maxAgeMs: EVIDENCE_MAX_AGE_MS, available: navigator.onLine !== false,
    });
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
    const checked = liveState.checkedAt ? `Última comprobación: ${escapeHtml(liveState.checkedAt)}${isStale(liveState.checkedAt) ? ' · Evidencia vencida; comprobación automática pendiente' : ''}` : 'Comprobación automática en curso.';
    summaryEl.innerHTML = `<div class="tfc-summary-item"><strong>${NODES.length}</strong><span>nodos</span></div><div class="tfc-summary-item"><strong>${EDGES.length}</strong><span>conexiones</span></div><div class="tfc-summary-item is-green"><strong>${green}</strong><span>verificados</span></div><div class="tfc-summary-item is-attention"><strong>${attention}</strong><span>requieren atención</span></div><div class="tfc-summary-freshness">${checked}</div>`;
  }

  function isStale(checkedAt) {
    const time = Date.parse(checkedAt || '');
    return !Number.isFinite(time) || Date.now() - time >= EVIDENCE_MAX_AGE_MS;
  }

  function renderLanes() {
    lanesEl.innerHTML = CATEGORY_ORDER.map(category => {
      const nodes = NODES.filter(node => node.category === category && nodeMatchesFilters(node));
      if (!nodes.length) return '';
      const pills = nodes.map(node => {
        const state = effectiveState(node);
        const live = liveState.byId[node.id];
        const marker = liveMarker(live, state, ESTADOS);
        const liveMark = marker ? `<span class="tfc-live-dot is-${marker.kind}" title="${escapeHtml(live.note)}" aria-label="Evidencia ${marker.label}">${marker.symbol}</span>` : '';
        const active = node.id === selectedNodeId ? ' tfc-pill-active' : '';
        return `<a href="#tfc-detail" class="tfc-pill tfc-state-${slug(state)}${active}" data-node-id="${escapeHtml(node.id)}">${liveMark}${escapeHtml(node.label)}</a>`;
      }).join('');
      return `<div class="tfc-lane"><div class="tfc-lane-title">${escapeHtml(CATEGORY_LABELS[category])}</div><div class="tfc-lane-pills">${pills}</div></div>`;
    }).join('') || '<p class="tfc-empty">Ningún nodo coincide con el filtro actual.</p>';
  }

  function renderEdges() {
    const visibleIds = new Set(NODES.filter(nodeMatchesFilters).map(node => node.id));
    const hasExplicitFilter = Boolean(stateFilterEl.value || searchEl.value.trim());
    const rows = EDGES.filter(edge => shouldShowFlowEdge(edge, {
      selectedNodeId,
      visibleNodeIds: visibleIds,
      hasExplicitFilter,
      matchesEdge: edgeMatchesFilters,
    })).map(edge => {
      const from = nodeById(edge.from);
      const to = nodeById(edge.to);
      const label = edge.label ? `<span class="tfc-edge-label">${escapeHtml(edge.label)}</span>` : '';
      const state = effectiveEdgeState(edge);
      const live = liveState.byEdgeId[edge.id];
      const marker = liveMarker(live, state, ESTADOS);
      const active = edge.id === selectedEdgeId ? ' is-selected' : '';
      return `<a href="#tfc-detail" class="tfc-edge-row${active}" data-edge-id="${escapeHtml(edge.id)}">
        <span class="tfc-edge-node">${escapeHtml(from?.label || edge.from)}</span>
        <span class="tfc-edge-arrow">→</span>
        <span class="tfc-edge-node">${escapeHtml(to?.label || edge.to)}</span>
        ${label}
        ${stateBadgeHtml(state)}
        ${marker ? `<span class="tfc-edge-live is-${marker.kind}" title="${escapeHtml(live.note)}">${marker.symbol} ${marker.label}</span>` : ''}
      </a>`;
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
      ? `<p class="tfc-detail-live"><strong>Verificación en vivo (${escapeHtml(live.checkedAt || liveState.checkedAt || '')}):</strong> ${live.pending ? 'EN CURSO / SIN CONFIRMAR' : live.ok ? 'OK' : 'FALLÓ'} — ${escapeHtml(live.note)} <span class="tfc-evidence-level">${escapeHtml(live.evidenceLevel)}</span></p>`
      : '<p class="tfc-detail-live tfc-detail-live-none">Sin prueba en vivo disponible; el estado mostrado es evidencia de código o contrato.</p>';
    detailEl.hidden = false;
    detailEl.innerHTML = `
      <div class="tfc-detail-head">
        <strong>${escapeHtml(isEdge ? `${from} → ${to}` : record.label)}</strong>
        ${stateBadgeHtml(state)}
      </div>
      ${record.label ? `<p class="tfc-detail-notes">${escapeHtml(record.label)}</p>` : ''}
      <p class="tfc-detail-meta"><strong>Identificador:</strong> <code>${escapeHtml(record.id)}</code> · <strong>Nivel:</strong> ${escapeHtml(live?.evidenceLevel || record.evidenceLevel || 'DOCUMENTATION_ONLY')}</p>
      ${liveHtml}
      ${record.notes ? `<p class="tfc-detail-notes">${escapeHtml(record.notes)}</p>` : ''}
      <ul class="tfc-detail-evidence">${evidenceHtml(record.evidence)}</ul>
    `;

  }

  function renderAll() {
    const focused = document.activeElement?.closest('[data-node-id], [data-edge-id]');
    const focusedKey = focused && root.contains(focused) ?
      focused.dataset.nodeId ? ['node', focused.dataset.nodeId] : ['edge', focused.dataset.edgeId] : null;
    if (selectedNodeId && !nodeMatchesFilters(nodeById(selectedNodeId))) selectedNodeId = null;
    if (selectedEdgeId && !edgeMatchesFilters(edgeById(selectedEdgeId))) selectedEdgeId = null;
    renderSummary();
    renderLanes();
    renderEdges();
    renderDetail();
    if (focusedKey) root.querySelector(`[data-${focusedKey[0]}-id="${CSS.escape(focusedKey[1])}"]`)?.focus({ preventScroll: true });
  }

  lanesEl.addEventListener('click', event => {
    const btn = event.target.closest('[data-node-id]');
    if (!btn) return;
    event.preventDefault();
    const id = btn.dataset.nodeId;
    selectedNodeId = selectedNodeId === id ? null : id;
    selectedEdgeId = null;
    renderAll();
  });
  edgesEl.addEventListener('click', event => {
    const row = event.target.closest('[data-edge-id]');
    if (!row) return;
    event.preventDefault();
    selectedEdgeId = selectedEdgeId === row.dataset.edgeId ? null : row.dataset.edgeId;
    selectedNodeId = null;
    renderAll();
  });
  searchEl.addEventListener('input', renderAll);
  stateFilterEl.addEventListener('change', renderAll);

  const liveErrorTextEl = root.querySelector("#tfc-live-error-text");
  const progressPanel = root.querySelector('#tfc-revalidation-progress');
  const progressStatus = root.querySelector('#tfc-revalidation-status');
  const progressBar = root.querySelector('#tfc-revalidation-bar');
  async function revalidate(signal) {
    if (signal.aborted) return;
    progressPanel.hidden = false;
    root.setAttribute('aria-busy', 'true');
    let percentage = 0;
    let progressActive = true;
    const showProgress = (value, label) => {
      if (!progressActive || signal.aborted) return;
      percentage = value;
      progressBar.value = value;
      progressStatus.textContent = `${label} · ${value}%`;
    };
    showProgress(0, 'Comprobando salud de producción');
    liveErrorEl.hidden = true;
    liveErrorTextEl.textContent = '';
    try {
      const errors = [];
      const readJson = async (url, options = {}) => {
        try {
          const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, signal: AbortSignal.any([signal, options.signal || AbortSignal.timeout(15000)]) });
          const body = await response.json().catch(() => null);
          return { status: response.status, ok: response.ok, body };
        } catch (error) {
          return { status: 0, ok: false, body: null, error: error?.message || 'fallo de red' };
        }
      };
      const publicHealth = await readJson('/api/health');
      showProgress(5, 'Verificando sesión y seguridad');
      if (!publicHealth.ok || publicHealth.body?.ok !== true) errors.push(`/api/health respondió ${publicHealth.status || 'sin respuesta'}`);

      let authHeaders = {};
      const user = auth.currentUser;
      if (user) {
        if (!await waitForAdminAppCheck(12000)) throw new Error('La verificación de seguridad está pendiente. Tu sesión sigue activa; podés reintentar.');
        const idToken = await user.getIdToken();
        authHeaders = { authorization: `Bearer ${idToken}` };
      } else {
        errors.push('No hay una sesión de Super Admin para probes protegidos.');
      }
      if (signal.aborted) return;
      showProgress(10, 'Comprobando conexiones');
      const checks = [
        user ? readJson('/api/system-health', { headers: authHeaders, signal: AbortSignal.timeout(30000) }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/admin-runtime-health', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/master-diagnostics', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/engagement?action=ownFavorite&productId=__tfc_health_probe__', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/notifications?action=health', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        probeClientFirestoreRules(user),
        probeEngagementStats(user),
        probeEngagementRecords(user),
        user ? probeSheetsWebhook() : Promise.resolve(null),
        probeCurrentSession(user, role),
        fetch('/admin.html', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) }).then(response => ({
          status: response.status,
          csp: Boolean(response.headers.get('content-security-policy')),
        })).catch(error => ({ status: 0, csp: false, error: error?.message || 'fallo de red' })),
        ...[
          ['home', '/'],
          ['login', '/login'],
          ['profile', '/perfil'],
          ['admin', '/admin'],
          ['checkout', '/checkout'],
        ].map(async ([key, path]) => {
          try {
            const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
            return [key, {
              path,
              status: response.status,
              ok: response.ok,
            }];
          } catch (error) {
            return [key, { path, status: 0, ok: false, error: error?.message || 'fallo de red' }];
          }
        }),
        probeRenderedCart(signal),
      ];
      let completed = 0;
      const [systemHealth, adminHealth, masterDiagnostics, favoriteApi, notificationApi, firestoreRules, engagementStats, engagementRecords, sheetsWebhook, sessionProbe, pageProbe, ...routeProbes] = await Promise.all(checks.map(check => Promise.resolve(check).finally(() => {
        completed += 1;
        showProgress(10 + Math.floor(85 * completed / checks.length), `Comprobaciones terminadas: ${completed} de ${checks.length}`);
      })));
      if (signal.aborted) return;
      if (user && (!systemHealth.ok || systemHealth.body?.ok !== true)) errors.push(`/api/system-health respondió ${systemHealth.status || 'sin respuesta'}`);
      if (user && (!adminHealth.ok || adminHealth.body?.ok !== true)) errors.push(`/api/admin-runtime-health respondió ${adminHealth.status || 'sin respuesta'}`);
      const ciProblem = user ? ciEvidenceProblem(masterDiagnostics) : '';
      if (ciProblem) errors.push(ciProblem);

      const checkedAt = new Date().toISOString();
      const routeProbeMap = Object.fromEntries(routeProbes);
      liveState.checkedAt = checkedAt;
      liveState.endpointStatus = { health: publicHealth.status, systemHealth: systemHealth.status, adminHealth: adminHealth.status, masterDiagnostics: masterDiagnostics.status, favoriteApi: favoriteApi.status, notificationApi: notificationApi.status, adminPage: pageProbe.status };
      liveState.byId = buildLiveChecks({
        publicHealth,
        systemHealth,
        adminHealth: { ...adminHealth, checks: adminHealth.body?.checks },
        headers: pageProbe,
        routeProbes: routeProbeMap,
        protectedProbes: { favoriteApi, notificationApi, firestoreRules, engagementStats, engagementRecords, sheetsWebhook },
        sessionProbe,
        currentEvidence: masterDiagnostics.body?.currentEvidence,
      }, checkedAt);
      liveState.byEdgeId = buildLiveEdges({ publicHealth, systemHealth, headers: pageProbe, protectedProbes: { favoriteApi, notificationApi, firestoreRules, engagementStats, engagementRecords, sheetsWebhook }, sessionProbe, currentEvidence: masterDiagnostics.body?.currentEvidence }, checkedAt);
      liveTimestampEl.textContent = `Última verificación en vivo: ${checkedAt} (${Object.keys(liveState.byId).length} nodos y ${Object.keys(liveState.byEdgeId).length} conexiones con probe).`;

      if (errors.length) {
        liveErrorEl.hidden = false;
        liveErrorTextEl.textContent = `Algunas pruebas no se pudieron confirmar: ${errors.join(' · ')}`;
      }
      showProgress(100, errors.length ? 'Revalidación finalizada con avisos' : 'Revalidación finalizada');
    } catch (error) {
      if (signal.aborted) return;
      liveState.checkedAt = null;
      liveState.byId = {};
      liveState.byEdgeId = {};
      showProgress(percentage, 'Comprobación interrumpida; reintento automático');
      liveErrorEl.hidden = false;
      liveErrorTextEl.textContent = `No se pudo comprobar: ${error?.message || error}. Se reintentará automáticamente.`;
    } finally {
      progressActive = false;
      if (!signal.aborted) {
        root.setAttribute('aria-busy', 'false');
        renderAll();
      }
    }
  }


  const monitor = createAutomaticMonitor({
    check: revalidate,
    isActive: () => root.isConnected && !root.hidden && root.getClientRects().length > 0 &&
      document.visibilityState !== 'hidden' && navigator.onLine !== false && Boolean(auth.currentUser),
    onError(error) {
      liveState.checkedAt = null;
      liveState.byId = {};
      liveState.byEdgeId = {};
      root.setAttribute('aria-busy', 'false');
      liveErrorEl.hidden = false;
      liveErrorTextEl.textContent = error.message;
      renderAll();
    },
    onStatus(status) {
      if (!root.isConnected) { dispose(); return; }
      monitorStatusEl.textContent = navigator.onLine === false ? 'Sin conexión; reconexión automática' :
        !auth.currentUser ? 'Sesión de Administración pendiente' :
        status === 'checking' ? 'Comprobando conexiones automáticamente…' :
        status === 'paused' ? 'Monitoreo pausado mientras la vista está oculta' :
        `Monitoreo activo · nueva comprobación en ${CHECK_INTERVAL_MS / 1000} s`;
      if (status !== 'checking') root.setAttribute('aria-busy', 'false');
      renderAll();
    },
  });

  function synchronizeMonitor() {
    if (!root.isConnected) { dispose(); return; }
    monitor.refresh();
    renderAll();
  }
  const observer = new MutationObserver(synchronizeMonitor);
  observer.observe(root, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  if (root.parentElement) observer.observe(root.parentElement, { childList: true });
  document.addEventListener('visibilitychange', synchronizeMonitor);
  window.addEventListener('online', synchronizeMonitor);
  window.addEventListener('offline', synchronizeMonitor);
  window.addEventListener('pageshow', synchronizeMonitor);
  const pauseMonitor = () => monitor.pause();
  window.addEventListener('pagehide', pauseMonitor);
  let sessionUid = auth.currentUser?.uid || '';
  const unsubscribeAuth = subscribeAuthState(user => {
    const nextUid = user?.uid || '';
    if (sessionUid === nextUid) return;
    sessionUid = nextUid;
    liveState.checkedAt = null;
    liveState.byId = {};
    liveState.byEdgeId = {};
    monitor.restart();
  });
  function dispose() {
    monitor.dispose();
    observer.disconnect();
    unsubscribeAuth();
    document.removeEventListener('visibilitychange', synchronizeMonitor);
    for (const type of ['online', 'offline', 'pageshow']) window.removeEventListener(type, synchronizeMonitor);
    window.removeEventListener('pagehide', pauseMonitor);
    delete root.dataset.tfcMounted;
  }
  synchronizeMonitor();
}
