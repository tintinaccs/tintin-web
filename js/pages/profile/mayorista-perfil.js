// =============================================================
// TINTIN — "Compras por mayor" en el perfil
// =============================================================
// La clienta arma una cotización (productos + cantidades) y la envía a
// Tintin sin pagar. Ve en vivo el estado de sus cotizaciones y, cuando Tintin
// la aprueba, los precios mayoristas y el aviso de que la contactan por
// WhatsApp. El navegador solo propone productos y cantidades: precios y
// estado mayorista los decide el servidor (/api/wholesale-quote).
import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { AUTH_STATES, getSessionUser, subscribeSession } from '../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1-first-render-merge-20261010-1';
import { authenticatedFetch, apiFailureMessage } from '../../core/auth/cliente-api-autenticado.js?v=tintin-20260918-global-session-restore-2-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1-first-render-merge-20261010-1';
import { withDeadline } from '../../core/auth/estado-perfil-sesion.mjs?v=tintin-20261010-registration-name-2';
import { collection, limit, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const MAX_LINES = 60;
const NETWORK_DEADLINE_MS = 15000;
let catalogRequest = null;
const STATUS_COPY = {
  pendiente: ['En revisión', '#b7791f'],
  aprobada: ['Confirmada', '#2f855a'],
  rechazada: ['No aprobada', '#c53030'],
  cancelada: ['Cancelada', '#718096'],
};
const ERROR_COPY = {
  empty_quote: 'Agregá al menos un producto.',
  too_many_lines: `Podés pedir hasta ${MAX_LINES} productos distintos por cotización.`,
  invalid_line: 'Revisá las cantidades: tienen que ser números enteros mayores a cero.',
  business_name_required: 'Contanos el nombre de tu emprendimiento.',
  whatsapp_invalid: 'Ingresá un número de WhatsApp válido (con código de área).',
  product_not_found: 'Uno de los productos ya no está disponible. Quitalo y volvé a enviar.',
  product_inactive: 'Uno de los productos ya no está disponible. Quitalo y volvé a enviar.',
  profile_required: 'Completá tus datos de perfil antes de cotizar.',
  account_blocked: 'Tu cuenta no puede enviar cotizaciones. Escribinos por WhatsApp.',
  authentication_required: 'Tu sesión venció. Volvé a ingresar y reintentá.',
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => (value === null || value === undefined) ? '—' : `Gs. ${Number(value).toLocaleString('es-PY')}`;

const state = {
  user: null,
  catalog: null,
  lines: [],
  quotes: [],
  requestId: '',
  sending: false,
  unsubscribe: null,
  generation: 0,
  submission: null,
};

function newRequestId() {
  const random = (crypto.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, '');
  return `wq_${random}`.slice(0, 60);
}

function dateText(value) {
  const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

async function loadCatalog() {
  if (state.catalog) return state.catalog;
  if (catalogRequest) return catalogRequest;
  const controller = new AbortController();
  catalogRequest = withDeadline((async () => {
    const response = await fetch('/api/public-catalog?resource=products', { headers: { accept: 'application/json' }, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true || !Array.isArray(body.items)) throw new Error('catalog_unavailable');
    const catalog = body.items
      .map(item => ({
        id: item.id,
        name: String(item.data?.name || item.data?.title || '').trim(),
        price: Number(item.data?.price) || 0,
        image: String(item.data?.imageUrl || item.data?.image || '').trim(),
      }))
      .filter(item => item.id && item.name);
    return catalog;
  })(), NETWORK_DEADLINE_MS).then(catalog => {
    state.catalog = catalog;
    return catalog;
  }).finally(() => {
    controller.abort();
    catalogRequest = null;
  });
  return catalogRequest;
}

function root() {
  return document.getElementById('perfil-wholesale-root');
}

function render() {
  const container = root();
  if (!container) return;
  container.innerHTML = `
    <p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:var(--text-muted)">
      ¿Tenés un emprendimiento y querés revender nuestros productos? Armá tu pedido con las cantidades que necesitás y
      envialo como <strong>cotización</strong>: no se cobra nada. Tintin te responde con los precios mayoristas y,
      si la aceptamos, una agente te escribe por WhatsApp para coordinar.
    </p>
    <form data-wholesale-form novalidate>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <label style="font-size:12px;font-weight:600">Emprendimiento
          <input class="perfil-input" name="businessName" maxlength="120" placeholder="Nombre de tu tienda" required></label>
        <label style="font-size:12px;font-weight:600">WhatsApp
          <input class="perfil-input" name="whatsapp" inputmode="tel" maxlength="30" placeholder="0912 345 678" required></label>
        <label style="font-size:12px;font-weight:600">Ciudad
          <input class="perfil-input" name="city" maxlength="120" placeholder="Ej: Luque"></label>
      </div>
      <label style="display:block;margin-top:12px;font-size:12px;font-weight:600">Agregar productos
        <input class="perfil-input" data-wholesale-search autocomplete="off" placeholder="Buscá por nombre…"></label>
      <div data-wholesale-results role="listbox" style="display:grid;gap:6px;margin-top:6px"></div>
      <div data-wholesale-lines style="margin-top:12px"></div>
      <label style="display:block;margin-top:12px;font-size:12px;font-weight:600">Notas (opcional)
        <textarea class="perfil-input" name="notes" rows="2" maxlength="1000" placeholder="Colores, fechas, lo que necesites aclarar"></textarea></label>
      <p data-wholesale-message role="status" aria-live="polite" style="margin:10px 0 0;font-size:13px"></p>
      <button type="submit" class="perfil-btn perfil-btn-primary" style="margin-top:10px">Enviar cotización</button>
    </form>
    <div style="margin-top:20px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Mis cotizaciones</div>
      <div data-wholesale-quotes>${quotesHtml()}</div>
    </div>`;
  renderLines();
  bindForm(container);
}

function quotesHtml() {
  if (!state.quotes.length) return '<p style="margin:0;font-size:13px;color:var(--text-muted)">Todavía no enviaste cotizaciones.</p>';
  return state.quotes.map(quote => {
    const [label, tone] = STATUS_COPY[quote.status] || [quote.status, 'inherit'];
    const items = Array.isArray(quote.items) ? quote.items : [];
    const priced = quote.status === 'aprobada';
    return `
      <details style="border:1px solid var(--border,#eee);border-radius:12px;padding:10px 12px;margin-bottom:8px">
        <summary style="cursor:pointer;display:flex;justify-content:space-between;gap:10px;font-size:13px">
          <span><strong>${escapeHtml(quote.quoteNumber)}</strong> · ${escapeHtml(dateText(quote.createdAt))} · ${Number(quote.itemCount) || 0} unidades</span>
          <span style="font-weight:700;color:${tone}">${escapeHtml(label)}</span>
        </summary>
        <ul style="margin:10px 0 0;padding-left:18px;font-size:13px;line-height:1.6">
          ${items.map(item => `<li>${escapeHtml(item.name)}${item.variant ? ` (${escapeHtml(item.variant)})` : ''} × ${Number(item.qty) || 0}${priced ? ` — ${money(item.unitPrice)} c/u` : ''}</li>`).join('')}
        </ul>
        ${priced ? `<p style="margin:8px 0 0;font-size:13px"><strong>Total mayorista: ${money(quote.total)}</strong></p>
          <p style="margin:6px 0 0;font-size:12.5px;color:var(--text-muted)">Una agente te escribe por WhatsApp para coordinar el pago y la entrega.</p>` : ''}
        ${quote.adminNote && quote.status !== 'pendiente' ? `<p style="margin:6px 0 0;font-size:12.5px"><strong>Nota de Tintin:</strong> ${escapeHtml(quote.adminNote)}</p>` : ''}
      </details>`;
  }).join('');
}

function renderLines() {
  const container = root()?.querySelector('[data-wholesale-lines]');
  if (!container) return;
  container.innerHTML = state.lines.length ? state.lines.map((line, index) => `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border,#eee)">
      <span style="flex:1 1 160px;font-size:13px;font-weight:600">${escapeHtml(line.name)}</span>
      <input class="perfil-input" style="flex:1 1 120px;max-width:180px" data-line-variant="${index}" maxlength="120" placeholder="Color / medida" value="${escapeHtml(line.variant)}">
      <input class="perfil-input" style="width:90px" type="number" min="1" max="9999" step="1" inputmode="numeric" data-line-qty="${index}" value="${line.qty}" aria-label="Cantidad de ${escapeHtml(line.name)}">
      <button type="button" class="perfil-btn" data-line-remove="${index}" aria-label="Quitar ${escapeHtml(line.name)}">Quitar</button>
    </div>`).join('') : '<p style="margin:0;font-size:13px;color:var(--text-muted)">Todavía no agregaste productos.</p>';
}

function renderResults(term) {
  const results = root()?.querySelector('[data-wholesale-results]');
  if (!results) return;
  const needle = term.trim().toLowerCase();
  if (needle.length < 2 || !state.catalog) { results.innerHTML = ''; return; }
  const matches = state.catalog.filter(item => item.name.toLowerCase().includes(needle)).slice(0, 8);
  results.innerHTML = matches.length ? matches.map(item => `
    <button type="button" role="option" class="perfil-btn" data-add-product="${escapeHtml(item.id)}" style="display:flex;align-items:center;gap:10px;text-align:left;justify-content:flex-start">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" width="36" height="36" loading="lazy" style="border-radius:8px;object-fit:cover">` : ''}
      <span style="flex:1">${escapeHtml(item.name)}</span>
      <span style="font-size:12px;color:var(--text-muted)">${money(item.price)} minorista</span>
    </button>`).join('') : '<p style="margin:0;font-size:13px;color:var(--text-muted)">No encontramos productos con ese nombre.</p>';
}

function message(text, tone = 'muted') {
  const el = root()?.querySelector('[data-wholesale-message]');
  if (!el) return;
  el.textContent = text;
  el.style.color = tone === 'error' ? '#c53030' : tone === 'ok' ? '#2f855a' : 'var(--text-muted)';
}

function bindForm(container) {
  const form = container.querySelector('[data-wholesale-form]');
  const search = container.querySelector('[data-wholesale-search]');
  search.addEventListener('focus', () => {
    const generation = state.generation;
    loadCatalog().catch(() => {
      if (generation === state.generation) message('No pudimos cargar el catálogo. Probá de nuevo en un momento.', 'error');
    });
  }, { once: true });
  search.addEventListener('input', async () => {
    const generation = state.generation;
    try { await loadCatalog(); } catch {
      if (generation === state.generation) message('No pudimos cargar los productos. Volvé a buscar para reintentar.', 'error');
      return;
    }
    if (generation !== state.generation) return;
    message('');
    renderResults(search.value);
  });
  container.querySelector('[data-wholesale-results]').addEventListener('click', event => {
    const button = event.target.closest('[data-add-product]');
    if (!button) return;
    const product = state.catalog?.find(item => item.id === button.dataset.addProduct);
    if (!product) return;
    if (state.lines.length >= MAX_LINES) { message(ERROR_COPY.too_many_lines, 'error'); return; }
    const existing = state.lines.find(line => line.id === product.id && !line.variant);
    if (existing) existing.qty = Math.min(9999, existing.qty + 10);
    else state.lines.push({ id: product.id, name: product.name, qty: 10, variant: '' });
    search.value = '';
    renderResults('');
    renderLines();
    message('');
  });
  container.querySelector('[data-wholesale-lines]').addEventListener('input', event => {
    const qty = event.target.closest('[data-line-qty]');
    const variant = event.target.closest('[data-line-variant]');
    if (qty) state.lines[Number(qty.dataset.lineQty)].qty = Math.floor(Number(qty.value) || 0);
    if (variant) state.lines[Number(variant.dataset.lineVariant)].variant = variant.value;
  });
  container.querySelector('[data-wholesale-lines]').addEventListener('click', event => {
    const remove = event.target.closest('[data-line-remove]');
    if (!remove) return;
    state.lines.splice(Number(remove.dataset.lineRemove), 1);
    renderLines();
  });
  form.addEventListener('submit', event => { event.preventDefault(); void submit(form); });
}

async function submit(form) {
  if (state.sending) return;
  if (!state.user) { message(ERROR_COPY.authentication_required, 'error'); return; }
  if (!state.lines.length) { message(ERROR_COPY.empty_quote, 'error'); return; }
  if (state.lines.some(line => !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 9999)) { message(ERROR_COPY.invalid_line, 'error'); return; }
  const data = new FormData(form);
  state.requestId ||= newRequestId();
  state.sending = true;
  const generation = state.generation;
  const controller = new AbortController();
  state.submission = controller;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  message('Enviando tu cotización…');
  try {
    const { response, body } = await withDeadline((async () => {
      const response = await authenticatedFetch('/api/wholesale-quote', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId: state.requestId,
          businessName: String(data.get('businessName') || ''),
          whatsapp: String(data.get('whatsapp') || ''),
          city: String(data.get('city') || ''),
          notes: String(data.get('notes') || ''),
          items: state.lines.map(line => ({ id: line.id, qty: line.qty, variant: line.variant.trim() })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      return { response, body };
    })(), NETWORK_DEADLINE_MS);
    if (generation !== state.generation) return;
    if (!response.ok || body.ok !== true) {
      message(ERROR_COPY[body.error] || apiFailureMessage(response, 'No pudimos enviar la cotización. Probá de nuevo.'), 'error');
      return;
    }
    state.lines = [];
    state.requestId = '';
    form.reset();
    renderLines();
    message(`¡Listo! Recibimos tu cotización ${body.quoteNumber || ''}. Te avisamos cuando tengamos los precios.`, 'ok');
  } catch (error) {
    if (generation !== state.generation) return;
    message(error?.code === 'auth/missing-user' ? ERROR_COPY.authentication_required : 'No pudimos enviar la cotización. Revisá tu conexión.', 'error');
  } finally {
    controller.abort();
    if (generation === state.generation) {
      state.sending = false;
      state.submission = null;
    }
    button.disabled = false;
  }
}

function watchQuotes(user) {
  state.unsubscribe?.();
  state.unsubscribe = null;
  state.quotes = [];
  if (!user) return;
  const generation = state.generation;
  const quotesQuery = query(collection(db, 'wholesaleQuotes'), where('userId', '==', user.uid), limit(50));
  state.unsubscribe = onSnapshot(quotesQuery, snapshot => {
    if (generation !== state.generation) return;
    state.quotes = snapshot.docs
      .map(document => ({ id: document.id, ...document.data() }))
      .sort((a, b) => String(b.quoteNumber || '').localeCompare(String(a.quoteNumber || '')));
    const list = root()?.querySelector('[data-wholesale-quotes]');
    if (list) list.innerHTML = quotesHtml();
  }, error => console.warn('[Mayoristas] No se pudieron leer tus cotizaciones:', error));
}

function start() {
  const card = document.getElementById('perfil-wholesale-card');
  if (!card || !root()) return;
  subscribeSession(snapshot => {
    if (snapshot.status === AUTH_STATES.RESTORING || snapshot.status === AUTH_STATES.UNKNOWN) return;
    const user = snapshot.user || null;
    if (user?.uid === state.user?.uid) return;
    state.generation += 1;
    state.submission?.abort();
    state.submission = null;
    state.lines = [];
    state.requestId = '';
    state.sending = false;
    watchQuotes(null);
    state.user = user;
    card.hidden = !user;
    if (!user) return;
    render();
    const generation = state.generation;
    void Promise.resolve(appCheckReady).catch(() => false).then(() => {
      if (generation === state.generation && getSessionUser()?.uid === user.uid) watchQuotes(user);
    });
  });

}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
