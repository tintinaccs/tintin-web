// =============================================================
// TINTIN ACCESORIOS — Flujo real de decisiones y conexiones (render)
// =============================================================
// Consume datos-flujo-conexiones.js (evidencia estática de código) y, al
// pulsar "Revalidar", superpone una prueba EN VIVO real usando los mismos
// endpoints de solo lectura que ya existen para diagnóstico operativo
// (system-health, admin-runtime-health). No inventa infraestructura de
// monitoreo nueva: reutiliza lo que ya prueba conectividad real sin escribir
// datos. La única escritura es "Sellar verdes", que guarda sólo los sellos
// del propio panel en settings/flowSeals (nunca pedidos, productos ni cuentas).
import { ESTADOS, GENERATED_AT, NODES, EDGES } from './datos-flujo-conexiones.js?v=tintin-20261003-profile-route-1';
import { resolveState, isAttentionState, liveMarker, shouldShowFlowEdge } from './estado-flujo.js?v=tintin-20260929-partial-live-markers-1';
import { buildLiveChecks, buildLiveEdges } from './live-checks.js?v=tintin-20261003-profile-route-1';
import { recordFiles, fingerprint, checkSeal, applySeal, buildSeal, shaMapFromManifest } from './sellos-flujo.js?v=tintin-20261001-sellos-1';
import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { waitForAdminAppCheck } from '../auth/app-check-admin.js?v=tintin-20260924-admin-appcheck-gate-1-auth-popup-resolver-1-launch-20260926-1-admin-ready-20261002-1';
import { collection, doc, getDoc, getDocs, limit, query, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

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
const NODES_BY_ID = Object.fromEntries(NODES.map(node => [node.id, node]));
// Sellos en verde: settings/* es sólo del Super Admin en firestore.rules.
const SEALS_DOC = ['settings', 'flowSeals'];

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

async function probeRenderedCart() {
  const routeProbe = fetch('/', { credentials: 'same-origin', cache: 'no-store' })
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
      frame.remove();
      resolve(value);
    };
    let observer;
    const timeoutId = window.setTimeout(() => cleanup(false), 10_000);
    // El sitio evita inicializar algunos componentes cuando el documento queda
    // fuera del árbol de renderizado. Lo mantenemos imperceptible y fuera de la
    // pantalla, pero renderizable, para observar el mismo panel que ve un cliente.
    // Con 1×1 px la página reporta innerWidth 0, nunca sale de
    // tt-store-gate-pending y el carrito no llega a montarse: el probe daba
    // rojo aunque el carrito real funcionara. Se usa un viewport de teléfono.
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
    };
  }
  // Hay que esperar las lecturas: devolver promesas sin resolver hacía
  // que `favorites.ok` / `notifications.ok` fueran siempre undefined y el flujo
  // reportara "no confirmado" aunque las Rules permitieran la lectura.
  const [favorites, notifications, cart] = await Promise.all([
    probeClientFirestoreRead('Favoritos', () => getDocs(query(
      collection(db, 'users', user.uid, 'favorites'), limit(1),
    ))),
    probeClientFirestoreRead('Notificaciones', () => getDocs(query(
      collection(db, 'adminNotifications'), limit(1),
    ))),
    probeClientFirestoreRead('Carrito', () => getDocs(query(
      collection(db, 'users', user.uid, 'cart'), limit(1),
    ))),
  ]);
  return { favorites, notifications, cart };
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
    tokenResult = await user.getIdTokenResult(true);
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
  const sealState = { loaded: false, shaByPath: {}, entries: {}, error: '' };

  root.innerHTML = `
    <div class="adm-card tfc-card">
      <div class="adm-card-head tfc-head">
        <div>
          <div class="adm-card-title">Flujo real de decisiones y conexiones</div>
          <p>Muestra únicamente conexiones que existen hoy en el código, la configuración y los servicios — nunca un diseño ideal. Lo desconectado, incompleto o sin confirmar se marca así.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="adm-btn adm-btn-primary" id="tfc-btn-revalidate">Revalidar en vivo</button>
          <button type="button" class="adm-btn adm-btn-outline" id="tfc-btn-seal" title="Fija en verde lo que hoy está verde. Si después cambia su código, vuelve a amarillo hasta que lo vuelvas a sellar.">🔒 Sellar verdes</button>
        </div>
      </div>
      <div class="adm-card-body">
        <div class="adm-diagnostic-safety" role="note">
          <strong>Modo de solo lectura.</strong>
          "Revalidar" solo ejecuta lecturas GET de producción (<code>/api/health</code>,
          <code>/api/system-health</code>, <code>/api/admin-runtime-health</code>, los endpoints de lectura
          de participación y los headers de <code>/admin.html</code>). También hace dos lecturas mínimas con
          el SDK de Firestore para comprobar Rules ya desplegadas y carga temporalmente la portada aislada
          para comprobar el panel de carrito ya renderizado. Ningún botón de este panel invoca una mutación de negocio ni
          crea, actualiza ni elimina pedidos, productos ni datos reales. El único que guarda algo es
          "Sellar verdes", y sólo guarda los sellos de este panel.
        </div>
        <div class="tfc-meta">
          <span>Evidencia de código generada: <strong>${escapeHtml(GENERATED_AT)}</strong></span>
          <span id="tfc-live-timestamp">Sin verificación en vivo todavía.</span>
          <span id="tfc-seal-status">Cargando sellos…</span>
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
  const sealStatusEl = root.querySelector('#tfc-seal-status');
  const sealBtn = root.querySelector('#tfc-btn-seal');

  let selectedNodeId = null;
  let selectedEdgeId = null;

  function sealCheckFor(record) {
    if (!sealState.loaded) return null;
    const seal = sealState.entries[record.id];
    if (!seal) return null;
    return checkSeal(seal, fingerprint(recordFiles(record, NODES_BY_ID), sealState.shaByPath));
  }

  // Estado sólo por evidencia en vivo/código, sin el candado (para sellar).
  function liveOnlyState(record, isEdge = false) {
    return resolveState(record, isEdge ? liveState.byEdgeId[record.id] : liveState.byId[record.id], ESTADOS);
  }

  function effectiveState(node) {
    const live = liveState.byId[node.id];
    return applySeal(resolveState(node, live, ESTADOS), sealCheckFor(node), live, ESTADOS);
  }

  function effectiveEdgeState(edge) {
    const live = liveState.byEdgeId[edge.id];
    return applySeal(resolveState(edge, live, ESTADOS), sealCheckFor(edge), live, ESTADOS);
  }

  function sealHtml(record) {
    const check = sealCheckFor(record);
    if (!check) return '<p class="tfc-detail-live tfc-detail-live-none">Sin sello: el color depende de la revalidación en vivo.</p>';
    const when = escapeHtml(check.sealedAt ? check.sealedAt.replace('T', ' ').slice(0, 16) : '');
    if (check.intact) return `<p class="tfc-detail-live"><strong>🔒 Sellado en verde</strong> el ${when}${check.sealedBy ? ` por ${escapeHtml(check.sealedBy)}` : ''}. Su código no cambió desde entonces.</p>`;
    return `<p class="tfc-detail-live"><strong>⚠ Cambió desde el sello</strong> (${when}). Archivos tocados: ${check.changed.map(file => `<code>${escapeHtml(file)}</code>`).join(', ')}. Revalidá y, si queda verde, volvé a sellar.</p>`;
  }

  function renderSealStatus() {
    if (sealState.error) { sealStatusEl.textContent = `Sellos no disponibles: ${sealState.error}`; return; }
    if (!sealState.loaded) { sealStatusEl.textContent = 'Cargando sellos…'; return; }
    const records = [...NODES, ...EDGES];
    const checks = records.map(sealCheckFor).filter(Boolean);
    const broken = checks.filter(check => !check.intact).length;
    sealStatusEl.textContent = `Sellados en verde: ${checks.length - broken}${broken ? ` · ${broken} cambiaron desde el sello (amarillo)` : ''}`;
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
        const marker = liveMarker(live, state, ESTADOS);
        const liveMark = marker ? `<span class="tfc-live-dot is-${marker.kind}" title="${escapeHtml(live.note)}" aria-label="Evidencia ${marker.label}">${marker.symbol}</span>` : '';
        const active = node.id === selectedNodeId ? ' tfc-pill-active' : '';
        return `<button type="button" class="tfc-pill tfc-state-${slug(state)}${active}" data-node-id="${escapeHtml(node.id)}">${liveMark}${escapeHtml(node.label)}</button>`;
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
      return `<button type="button" class="tfc-edge-row${active}" data-edge-id="${escapeHtml(edge.id)}">
        <span class="tfc-edge-node">${escapeHtml(from?.label || edge.from)}</span>
        <span class="tfc-edge-arrow">→</span>
        <span class="tfc-edge-node">${escapeHtml(to?.label || edge.to)}</span>
        ${label}
        ${stateBadgeHtml(state)}
        ${marker ? `<span class="tfc-edge-live is-${marker.kind}" title="${escapeHtml(live.note)}">${marker.symbol} ${marker.label}</span>` : ''}
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
      ? `<p class="tfc-detail-live"><strong>Verificación en vivo (${escapeHtml(live.checkedAt || liveState.checkedAt || '')}):</strong> ${live.pending ? 'EN CURSO / SIN CONFIRMAR' : live.ok ? 'OK' : 'FALLÓ'} — ${escapeHtml(live.note)} <span class="tfc-evidence-level">${escapeHtml(live.evidenceLevel)}</span></p>`
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
      ${sealHtml(record)}
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
    if (selectedNodeId && !nodeMatchesFilters(nodeById(selectedNodeId))) selectedNodeId = null;
    if (selectedEdgeId && !edgeMatchesFilters(edgeById(selectedEdgeId))) selectedEdgeId = null;
    renderSummary();
    renderSealStatus();
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
      const [systemHealth, adminHealth, masterDiagnostics, favoriteApi, notificationApi, firestoreRules, engagementStats, sessionProbe, pageProbe, ...routeProbes] = await Promise.all([
        user ? readJson('/api/system-health', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/admin-runtime-health', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/master-diagnostics', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/engagement?action=ownFavorite&productId=__tfc_health_probe__', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        user ? readJson('/api/notifications?action=health', { headers: authHeaders }) : Promise.resolve({ status: 401, ok: false, body: { code: 'authentication_required' } }),
        probeClientFirestoreRules(user),
        probeEngagementStats(user),
        probeCurrentSession(user, role),
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
        ].map(async ([key, path]) => {
          try {
            const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
            return [key, {
              path,
              status: response.status,
              ok: response.ok,
            }];
          } catch (error) {
            return [key, { path, status: 0, ok: false, error: error?.message || 'fallo de red' }];
          }
        }),
        probeRenderedCart(),
      ]);
      if (user && (!systemHealth.ok || systemHealth.body?.ok !== true)) errors.push(`/api/system-health respondió ${systemHealth.status || 'sin respuesta'}`);
      if (user && (!adminHealth.ok || adminHealth.body?.ok !== true)) errors.push(`/api/admin-runtime-health respondió ${adminHealth.status || 'sin respuesta'}`);

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
        protectedProbes: { favoriteApi, notificationApi, firestoreRules, engagementStats },
        sessionProbe,
        currentEvidence: masterDiagnostics.body?.currentEvidence,
      }, checkedAt);
      liveState.byEdgeId = buildLiveEdges({ publicHealth, systemHealth, headers: pageProbe, protectedProbes: { favoriteApi, notificationApi, firestoreRules, engagementStats }, sessionProbe, currentEvidence: masterDiagnostics.body?.currentEvidence }, checkedAt);
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

  sealBtn.addEventListener('click', async () => {
    if (!liveState.checkedAt) { window.alert('Primero revalidá en vivo: sólo se sella lo que hoy está verde.'); return; }
    if (!sealState.loaded) { window.alert('Los sellos todavía no cargaron. Probá de nuevo en unos segundos.'); return; }
    const sealedAt = new Date().toISOString();
    const sealedBy = auth.currentUser?.email || '';
    const entries = {};
    for (const node of NODES) if (liveOnlyState(node) === ESTADOS.PROD) entries[node.id] = buildSeal(recordFiles(node, NODES_BY_ID), sealState.shaByPath, { sealedAt, sealedBy });
    for (const edge of EDGES) if (liveOnlyState(edge, true) === ESTADOS.PROD) entries[edge.id] = buildSeal(recordFiles(edge, NODES_BY_ID), sealState.shaByPath, { sealedAt, sealedBy });
    const count = Object.keys(entries).length;
    if (!count) { window.alert('No hay nada en verde para sellar.'); return; }
    if (!window.confirm(`Se van a sellar ${count} nodo(s)/conexión(es) en verde.\n\nSi después cambia el código de alguno, va a volver a amarillo hasta que lo revalides y lo vuelvas a sellar.`)) return;
    sealBtn.disabled = true;
    try {
      await setDoc(doc(db, ...SEALS_DOC), { entries, updatedAt: sealedAt, updatedBy: sealedBy }, { merge: true });
      sealState.entries = { ...sealState.entries, ...entries };
      renderAll();
    } catch (error) {
      window.alert(`No se pudieron guardar los sellos: ${error?.message || error}`);
    } finally {
      sealBtn.disabled = false;
    }
  });

  // Huella actual de cada archivo (se regenera en cada build) + sellos guardados.
  Promise.all([
    fetch('/diagnostic-manifest.json', { credentials: 'same-origin', cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`manifiesto ${response.status}`);
      return response.json();
    }),
    getDoc(doc(db, ...SEALS_DOC)),
  ]).then(([manifest, snapshot]) => {
    sealState.shaByPath = shaMapFromManifest(manifest);
    const data = snapshot.exists() ? snapshot.data() : {};
    sealState.entries = data && typeof data.entries === 'object' && data.entries ? data.entries : {};
    sealState.loaded = true;
  }).catch(error => {
    sealState.error = error?.message || String(error);
  }).finally(renderAll);

  renderAll();

  // Abrir la sección debe mostrar el estado real de producción sin exigir un
  // segundo clic. Sigue siendo un conjunto de GETs de solo lectura.
  window.setTimeout(() => revalidateBtn.click(), 0);
}
