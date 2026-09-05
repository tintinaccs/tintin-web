const root = document.getElementById('decision-flow-admin-root');
const LAYOUT_KEY = 'tintin.decision-flow.access.layout.v1';

const nodes = [
  { id: 'entrada', x: 32, y: 100, title: 'Entrada de acceso', text: 'Email, username o Google', ref: 'login.html' },
  { id: 'resolver', x: 280, y: 100, title: 'Resolver identidad', text: 'OTP / Google → Firebase Auth', ref: 'functions/api/email-otp-send.js' },
  { id: 'perfil', x: 530, y: 60, title: 'Firestore: users/{uid}', text: 'Fuente de verdad: perfil, estado y rol', ref: 'js/core/store/perfil-usuario.js' },
  { id: 'completo', x: 790, y: 20, title: '¿Perfil completo?', text: 'Nombre, teléfono, ubicación, username y nacimiento', ref: 'configuracion-inicial-perfil.mjs' },
  { id: 'ultimos', x: 1040, y: 0, title: 'Últimos datos', text: 'Solo campos faltantes; guarda en Firestore', ref: 'configuracion-inicial-perfil.mjs' },
  { id: 'rol', x: 790, y: 205, title: '¿Rol interno?', text: 'superadmin/admin/agent/viewer', ref: 'login.html' },
  { id: 'admin', x: 1040, y: 180, title: 'Super Panel Admin', text: 'Vista y edición gobernada de Firestore', ref: 'admin.html' },
  { id: 'inicio', x: 1040, y: 350, title: 'Página principal', text: 'Cliente activo; la sesión continúa', ref: 'login.html' }
];
const edges = [
  ['entrada', 'resolver', 'credencial'], ['resolver', 'perfil', 'uid'], ['perfil', 'completo', 'perfil'],
  ['completo', 'ultimos', 'no'], ['ultimos', 'perfil', 'guardar'], ['completo', 'rol', 'sí'],
  ['rol', 'admin', 'sí'], ['rol', 'inicio', 'no']
];

function esc(value) { const e = document.createElement('span'); e.textContent = value; return e.innerHTML; }
function getLayout() { try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); } catch { return {}; } }
function saveLayout(layout) { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); }
function activeNodes() { const layout = getLayout(); return nodes.map(node => ({ ...node, ...(layout[node.id] || {}) })); }

function draw() {
  if (!root) return;
  const current = activeNodes();
  const byId = new Map(current.map(node => [node.id, node]));
  root.innerHTML = `
    <section class="df-card">
      <header class="df-head"><div><p class="df-eyebrow">Fuente verificada · Firestore</p><h2>Flujos de decisión</h2><p>Este mapa se genera contra referencias reales del repositorio. Sheets no decide acceso; el Panel Admin visualiza o edita Firestore bajo permisos.</p></div><div class="df-actions"><button type="button" class="adm-btn adm-btn-outline adm-btn-sm" id="df-reset">Restablecer orden</button><a class="adm-btn adm-btn-primary adm-btn-sm" href="#estudio-codigo">Proponer cambio de código</a></div></header>
      <div class="df-tabs" role="tablist"><button class="active" type="button" role="tab" aria-selected="true">Acceso y perfil</button><button type="button" role="tab" disabled>Productos · próximo</button><button type="button" role="tab" disabled>Checkout · próximo</button><button type="button" role="tab" disabled>Contenido · próximo</button></div>
      <div class="df-legend"><span><i class="df-dot df-dot-code"></i> Conexión verificada en código</span><span><i class="df-dot df-dot-data"></i> Dato Firestore</span><span>Arrastrá las píldoras para ordenar tu vista. Eso no cambia las reglas.</span></div>
      <div class="df-canvas-wrap"><div class="df-canvas" id="df-canvas" aria-label="Flujo real de acceso y perfil"><svg class="df-edges" viewBox="0 0 1260 490" aria-hidden="true"><defs><marker id="df-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z"/></marker></defs>${edges.map(([from,to,label]) => { const a=byId.get(from), b=byId.get(to); const x1=a.x+184, y1=a.y+40, x2=b.x, y2=b.y+40; return `<path d="M ${x1} ${y1} C ${x1+45} ${y1}, ${x2-45} ${y2}, ${x2} ${y2}" marker-end="url(#df-arrow)"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2-7}">${esc(label)}</text>`; }).join('')}</svg>${current.map(node => `<article class="df-node ${node.id === 'perfil' ? 'df-node-data' : ''}" data-node="${node.id}" tabindex="0" style="left:${node.x}px;top:${node.y}px"><strong>${esc(node.title)}</strong><span>${esc(node.text)}</span><small>${esc(node.ref)}</small></article>`).join('')}</div></div>
      <footer class="df-foot"><strong>Regla de seguridad:</strong> una flecha no puede habilitar ni deshabilitar OTP, perfil, roles o pagos. Para cambiar una condición se abre una propuesta en el Editor de Código; luego CI vuelve a verificar este mapa.</footer>
    </section>`;
  bindDrag();
  root.querySelector('#df-reset')?.addEventListener('click', () => { localStorage.removeItem(LAYOUT_KEY); draw(); });
}

function bindDrag() {
  const canvas = root.querySelector('#df-canvas');
  if (!canvas) return;
  root.querySelectorAll('.df-node').forEach(el => {
    let pointer = null;
    el.addEventListener('pointerdown', event => { pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: el.offsetLeft, top: el.offsetTop }; el.setPointerCapture(pointer.id); el.classList.add('dragging'); });
    el.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const left = Math.max(0, Math.min(1070, pointer.left + event.clientX - pointer.x));
      const top = Math.max(0, Math.min(400, pointer.top + event.clientY - pointer.y));
      el.style.left = `${left}px`; el.style.top = `${top}px`;
    });
    const finish = () => { if (!pointer) return; const layout = getLayout(); layout[el.dataset.node] = { x: el.offsetLeft, y: el.offsetTop }; saveLayout(layout); pointer = null; el.classList.remove('dragging'); draw(); };
    el.addEventListener('pointerup', finish); el.addEventListener('pointercancel', finish);
  });
}

window.TintinDecisionFlowsRefresh = draw;
draw();
