function browserRuntime() {
  'use strict';

  const FLOW_DEFINITIONS = [
    {
      id: 'compra-pedido',
      label: 'Compra y pedido',
      steps: [
        { label: 'Producto y CTA', evidence: ['producto', 'catalogo', 'ui/ux'] },
        { label: 'Carrito V2', evidence: ['carrito', 'comercio'] },
        { label: 'Checkout', evidence: ['checkout'] },
        { label: 'Pedido en Firestore', evidence: ['pedidos', 'firestore'] },
        { label: 'Inventario', evidence: ['inventario'] },
        { label: 'Confirmación y correo', evidence: ['correo', 'resend'] },
      ],
    },
    {
      id: 'cuenta-perfil',
      label: 'Cuenta y perfil',
      steps: [
        { label: 'Login / Firebase Auth', evidence: ['login', 'firebase / firestore'] },
        { label: 'Cuenta canónica', evidence: ['cuenta', 'usuarios', 'roles'] },
        { label: 'Perfil cliente', evidence: ['perfil'] },
        { label: 'Avatar y multimedia', evidence: ['cloudinary', 'multimedia'] },
        { label: 'Ficha de Super Admin', evidence: ['super admin', 'usuarios', 'roles'] },
      ],
    },
    {
      id: 'comunidad-social',
      label: 'Comunidad, reseñas y notificaciones',
      steps: [
        { label: 'UI de producto / reseñas', evidence: ['producto', 'ui/ux'] },
        { label: 'Engagement social', evidence: ['social', 'participacion', 'resenas'] },
        { label: 'Persistencia Firestore', evidence: ['firestore', 'social'] },
        { label: 'Notificaciones internas', evidence: ['notificaciones'] },
        { label: 'Web Push', evidence: ['push'] },
      ],
    },
    {
      id: 'catalogo-stock',
      label: 'Catálogo, stock y sincronización',
      steps: [
        { label: 'CRUD de productos', evidence: ['productos', 'super admin'] },
        { label: 'Inventario canónico', evidence: ['inventario'] },
        { label: 'Google Sheets / sync', evidence: ['google sheets', 'sincronizacion', 'sync'] },
        { label: 'Catálogo público', evidence: ['catalogo', 'producto'] },
        { label: 'Carrito consumidor', evidence: ['carrito'] },
      ],
    },
    {
      id: 'integraciones',
      label: 'Integraciones externas',
      steps: [
        { label: 'Firebase / Firestore', evidence: ['firebase / firestore'] },
        { label: 'Cloudinary', evidence: ['cloudinary'] },
        { label: 'Resend', evidence: ['resend', 'correo'] },
        { label: 'Google Sheets', evidence: ['google sheets'] },
        { label: 'Apps Script', evidence: ['apps script'] },
      ],
    },
    {
      id: 'publicacion',
      label: 'Publicación y experiencia pública',
      steps: [
        { label: 'GitHub / CI', evidence: ['github / ci global', 'github', 'ci global'] },
        { label: 'SEO', evidence: ['seo'] },
        { label: 'Responsive', evidence: ['responsive'] },
        { label: 'Accesibilidad', evidence: ['accesibilidad'] },
        { label: 'Rendimiento', evidence: ['performance', 'rendimiento'] },
        { label: 'Producción', evidence: ['produccion', 'cloudflare'] },
      ],
    },
  ];

  const STATE_LABELS = {
    PASS: 'PASS',
    FAIL: 'FAIL',
    RUNNING: 'EN EJECUCIÓN',
    QUEUED: 'EN COLA',
    SKIPPED: 'OMITIDO',
    NOT_VERIFIED: 'NO VERIFICADO',
    UNKNOWN: 'SIN DATOS',
  };
  const STATE_WEIGHT = {
    FAIL: 70,
    NOT_VERIFIED: 60,
    UNKNOWN: 50,
    RUNNING: 40,
    QUEUED: 30,
    SKIPPED: 20,
    PASS: 10,
  };

  let mounted = false;
  let observer = null;
  let renderTimer = null;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function stateLabel(value) {
    return STATE_LABELS[value] || STATE_LABELS.UNKNOWN;
  }

  function readEvidence(selector, source) {
    return Array.from(document.querySelectorAll(selector)).map(node => {
      const labelNode = node.querySelector('.adm-master-area-title');
      const stateNode = node.querySelector('.adm-master-area-state');
      return {
        label: String(labelNode?.textContent || '').trim(),
        normalized: normalize(labelNode?.textContent || ''),
        state: String(stateNode?.dataset?.state || 'UNKNOWN').toUpperCase(),
        source,
      };
    }).filter(item => item.label);
  }

  function collectEvidence() {
    return [
      ...readEvidence('#master-diagnostic-areas .adm-master-area', 'Diagnóstico Maestro'),
      ...readEvidence('#system-health-areas .adm-master-area', 'Estado del ecosistema'),
    ];
  }

  function matchesEvidence(row, tokens) {
    return tokens.some(token => row.normalized.includes(normalize(token)));
  }

  function worstState(states) {
    if (!states.length) return 'NOT_VERIFIED';
    return states.reduce((worst, next) => {
      const safeNext = STATE_WEIGHT[next] ? next : 'UNKNOWN';
      return STATE_WEIGHT[safeNext] > STATE_WEIGHT[worst] ? safeNext : worst;
    }, 'PASS');
  }

  function deriveStep(step, evidence) {
    const matched = evidence.filter(row => matchesEvidence(row, step.evidence || []));
    if (!matched.length) {
      return {
        label: step.label,
        state: 'NOT_VERIFIED',
        evidence: 'Sin evidencia específica en los diagnósticos actuales',
      };
    }
    const state = worstState(matched.map(item => item.state));
    const sources = [...new Set(matched.map(item => item.label))].slice(0, 3);
    return {
      label: step.label,
      state,
      evidence: sources.join(' · '),
    };
  }

  function deriveFlow(definition, evidence) {
    const steps = definition.steps.map(step => deriveStep(step, evidence));
    const state = worstState(steps.map(step => step.state));
    const firstProblem = steps.find(step => !['PASS', 'SKIPPED'].includes(step.state)) || null;
    return { ...definition, steps, state, firstProblem };
  }

  function overallState(flows) {
    return worstState(flows.map(flow => flow.state));
  }

  function stepMarkup(step, index) {
    return '<div class="adm-master-history-item">'
      + '<span class="adm-master-area-state" data-state="' + escapeHtml(step.state) + '">' + escapeHtml(stateLabel(step.state)) + '</span>'
      + '<strong>' + escapeHtml(String(index + 1) + '. ' + step.label) + '</strong>'
      + '<span>' + escapeHtml(step.evidence) + '</span>'
      + '</div>';
  }

  function flowMarkup(flow) {
    const detail = flow.firstProblem
      ? 'Primer punto a revisar: ' + flow.firstProblem.label + ' (' + stateLabel(flow.firstProblem.state) + ').'
      : 'Cadena completa con evidencia PASS.';
    return '<article class="adm-master-area adm-process-integrity-flow" data-flow="' + escapeHtml(flow.id) + '">'
      + '<div class="adm-master-area-head">'
      + '<div class="adm-master-area-title">' + escapeHtml(flow.label) + '</div>'
      + '<span class="adm-master-area-state" data-state="' + escapeHtml(flow.state) + '">' + escapeHtml(stateLabel(flow.state)) + '</span>'
      + '</div>'
      + '<div class="adm-master-area-detail">' + escapeHtml(detail) + '</div>'
      + '<div class="adm-master-history-list">' + flow.steps.map(stepMarkup).join('') + '</div>'
      + '</article>';
  }

  function cardMarkup() {
    return '<div class="adm-card adm-master-diagnostic-card" id="adm-process-integrity-card">'
      + '<div class="adm-card-head adm-master-diagnostic-head">'
      + '<div><div class="adm-card-title">Integridad de procesos</div>'
      + '<p>Mapa de extremo a extremo: acción → autenticación → lógica/API → autoridad canónica → integraciones → interfaz. Reutiliza las evidencias del Diagnóstico Maestro y Estado del ecosistema; no crea otra fuente de verdad.</p></div>'
      + '<div class="adm-master-actions"><button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="btn-refresh-process-integrity">Actualizar evidencias</button></div>'
      + '</div>'
      + '<div class="adm-card-body">'
      + '<div class="adm-master-state-row"><span class="adm-master-state" id="process-integrity-state" data-state="NOT_VERIFIED">NO VERIFICADO</span>'
      + '<span class="adm-master-freshness" id="process-integrity-summary">Esperando evidencias…</span></div>'
      + '<div class="adm-master-notice notice-info" id="process-integrity-notice">Abrí Diagnóstico para comprobar las cadenas críticas.</div>'
      + '<div class="adm-master-areas" id="process-integrity-flows"></div>'
      + '<details class="adm-master-history"><summary>Cómo interpretar este mapa</summary>'
      + '<div class="adm-master-history-list">'
      + '<div class="adm-master-history-item"><strong>PASS</strong><span>El paso tiene evidencia verde en los diagnósticos canónicos.</span><span>Sin acción</span></div>'
      + '<div class="adm-master-history-item"><strong>FAIL</strong><span>Existe un fallo verificable en el tramo.</span><span>Prioridad alta</span></div>'
      + '<div class="adm-master-history-item"><strong>NO VERIFICADO</strong><span>No hay evidencia suficiente; no se marca como correcto por suposición.</span><span>Revisar</span></div>'
      + '</div></details></div></div>';
  }

  function positionCard(section) {
    const card = document.getElementById('adm-process-integrity-card');
    if (!card) return;
    const health = document.getElementById('adm-system-health-card');
    const master = document.getElementById('adm-master-diagnostic-card');
    const anchor = health || master;
    if (!anchor || anchor.nextElementSibling === card) return;
    anchor.insertAdjacentElement('afterend', card);
  }

  function render() {
    if (!mounted) return;
    const evidence = collectEvidence();
    const flows = FLOW_DEFINITIONS.map(definition => deriveFlow(definition, evidence));
    const state = evidence.length ? overallState(flows) : 'NOT_VERIFIED';
    const stateNode = document.getElementById('process-integrity-state');
    const summary = document.getElementById('process-integrity-summary');
    const notice = document.getElementById('process-integrity-notice');
    const root = document.getElementById('process-integrity-flows');
    if (!stateNode || !summary || !notice || !root) return;

    stateNode.dataset.state = state;
    stateNode.textContent = stateLabel(state);
    root.innerHTML = flows.map(flowMarkup).join('');

    const failed = flows.flatMap(flow => flow.steps.map(step => ({ flow: flow.label, ...step }))).filter(step => step.state === 'FAIL');
    const missing = flows.flatMap(flow => flow.steps).filter(step => ['NOT_VERIFIED', 'UNKNOWN'].includes(step.state));
    const active = flows.flatMap(flow => flow.steps).filter(step => ['RUNNING', 'QUEUED'].includes(step.state));
    summary.textContent = evidence.length
      ? String(evidence.length) + ' evidencias canónicas · ' + String(flows.length) + ' flujos críticos'
      : 'Esperando Diagnóstico Maestro y Estado del ecosistema';

    if (!evidence.length) {
      notice.className = 'adm-master-notice notice-warning';
      notice.textContent = 'Todavía no hay evidencia cargada. Actualizá Diagnóstico Maestro y Estado del ecosistema.';
    } else if (failed.length) {
      notice.className = 'adm-master-notice notice-error';
      notice.textContent = 'Primer fallo verificable: ' + failed[0].flow + ' → ' + failed[0].label + '. Hay ' + String(failed.length) + ' paso(s) con FAIL.';
    } else if (active.length) {
      notice.className = 'adm-master-notice notice-info';
      notice.textContent = 'No hay FAIL confirmado. Hay verificaciones todavía en ejecución o en cola.';
    } else if (missing.length) {
      notice.className = 'adm-master-notice notice-warning';
      notice.textContent = 'No hay FAIL confirmado, pero ' + String(missing.length) + ' paso(s) todavía no tienen evidencia suficiente. No se consideran PASS por suposición.';
    } else {
      notice.className = 'adm-master-notice notice-info';
      notice.textContent = 'Todos los flujos críticos cuentan con evidencia PASS en los diagnósticos canónicos.';
    }
    positionCard(document.getElementById('section-diagnostico'));
  }

  function queueRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 80);
  }

  function mount() {
    const section = document.getElementById('section-diagnostico');
    if (!section) {
      window.setTimeout(mount, 120);
      return;
    }
    if (!document.getElementById('adm-process-integrity-card')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = cardMarkup();
      section.appendChild(wrapper.firstElementChild);
    }
    if (!mounted) {
      document.getElementById('btn-refresh-process-integrity')?.addEventListener('click', () => {
        document.getElementById('btn-refresh-master-diagnostics')?.click();
        document.getElementById('btn-refresh-system-health')?.click();
        window.setTimeout(queueRender, 250);
      });
      observer = new MutationObserver(queueRender);
      observer.observe(section, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-state', 'hidden', 'class'],
      });
      document.addEventListener('click', () => window.setTimeout(queueRender, 0), { passive: true });
      mounted = true;
    }
    positionCard(section);
    queueRender();
  }

  mount();
}

export async function onRequest(context) {
  const method = String(context.request.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD', 'cache-control': 'no-store' },
    });
  }

  const source = `(${browserRuntime.toString()})();`;
  return new Response(method === 'HEAD' ? null : source, {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      'x-tintin-process-integrity': 'diagnostics-derived',
    },
  });
}
