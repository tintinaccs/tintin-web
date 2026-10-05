// =============================================================
// TINTIN — Panel "Pedidos mayoristas" (solo Super Admin)
// =============================================================
// Lista en vivo las cotizaciones (wholesaleQuotes). Super Admin pone el
// precio mayorista de cada línea y la guarda, la aprueba o la rechaza. Las
// escrituras pasan por /api/admin-wholesale: las reglas de Firestore no dejan
// que el navegador toque las cotizaciones directamente.
import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260916-final-polish-2-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1';
import { authenticatedFetch, apiFailureMessage } from '../../core/auth/cliente-api-autenticado.js?v=tintin-20260918-global-session-restore-2-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1';
import { collection, limit, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const STATUS_LABELS = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada' };
const STATUS_TONES = { pendiente: '#b7791f', aprobada: '#2f855a', rechazada: '#c53030', cancelada: '#718096' };
const ERROR_COPY = {
  price_required: 'Para aprobar, poné el precio de todas las líneas.',
  price_invalid: 'Hay un precio inválido: usá números enteros en guaraníes.',
  quote_closed: 'Esta cotización ya fue respondida.',
  stale_quote: 'La cotización cambió en otra pestaña. Se actualizó la vista; revisá y volvé a intentar.',
  quote_not_found: 'La cotización ya no existe.',
  superadmin_required: 'Solo Super Admin puede responder cotizaciones.',
};

const state = { quotes: [], filter: 'pendiente', search: '', openId: '', unsubscribe: null, started: false, busy: false };
let root = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => (value === null || value === undefined || value === '') ? '—' : `Gs. ${Number(value).toLocaleString('es-PY')}`;

function toast(message, duration = 4200) {
  if (typeof window.toast === 'function') return window.toast(message, duration);
  console.info('[Mayoristas]', message);
}

function isSuperAdmin() {
  return String(auth.currentUser?.email || '').trim().toLowerCase() === String(SUPER_ADMIN || '').trim().toLowerCase();
}

function dateText(value) {
  const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });
}

function whatsappLink(quote) {
  const digits = String(quote.whatsapp || '').replace(/\D/g, '');
  if (!digits) return '';
  const text = encodeURIComponent(`Hola ${quote.customerName || ''}! Te escribimos de Tintin por tu cotización mayorista ${quote.quoteNumber}.`);
  return `https://wa.me/${digits}?text=${text}`;
}

function updateBadge() {
  const pending = state.quotes.filter(quote => quote.status === 'pendiente').length;
  const badge = document.getElementById('wholesale-pending-badge');
  if (!badge) return;
  badge.textContent = String(pending);
  badge.hidden = pending === 0;
}

function visibleQuotes() {
  const term = state.search.trim().toLowerCase();
  return state.quotes.filter(quote => (!state.filter || quote.status === state.filter) && (!term || [
    quote.quoteNumber, quote.customerName, quote.businessName, quote.userEmail, quote.whatsapp, quote.city,
  ].some(value => String(value || '').toLowerCase().includes(term))));
}

function shell() {
  root.innerHTML = `
    <div class="adm-card">
      <div class="adm-card-head">
        <div class="adm-card-title">Pedidos mayoristas</div>
        <div style="font-size:13px;color:var(--adm-muted)" data-wholesale-count></div>
      </div>
      <div class="adm-card-body" style="padding:16px 22px 0">
        <p style="margin:0 0 12px;font-size:13px;color:var(--adm-muted);line-height:1.5">
          Las clientas piden cantidades sin pagar. Poné el precio mayorista de cada producto y aprobá o rechazá:
          al aprobar, la cuenta queda como <strong>mayorista aprobada</strong> y le llega una notificación y un correo
          diciendo que una agente la contacta por WhatsApp.
        </p>
        <div class="adm-filter-row">
          <div class="adm-search-wrap" style="margin-bottom:0;flex:2">
            <input type="text" class="adm-input" data-wholesale-search placeholder="Buscar por número, clienta, emprendimiento, WhatsApp…" />
          </div>
          <select class="adm-select" data-wholesale-filter style="flex:1">
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </div>
      <div class="adm-table-wrap" style="margin-top:12px">
        <table class="adm-table">
          <thead><tr><th>Número</th><th>Clienta</th><th>Emprendimiento</th><th>Unidades</th><th>Total mayorista</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
          <tbody data-wholesale-rows><tr><td colspan="8" class="adm-loading"><span class="adm-spinner"></span> Cargando cotizaciones…</td></tr></tbody>
        </table>
      </div>
      <div data-wholesale-detail></div>
    </div>`;
  root.querySelector('[data-wholesale-search]').addEventListener('input', event => { state.search = event.target.value; renderRows(); });
  const filter = root.querySelector('[data-wholesale-filter]');
  filter.value = state.filter;
  filter.addEventListener('change', event => { state.filter = event.target.value; renderRows(); });
  root.querySelector('[data-wholesale-rows]').addEventListener('click', event => {
    const button = event.target.closest('[data-open-quote]');
    if (!button) return;
    state.openId = state.openId === button.dataset.openQuote ? '' : button.dataset.openQuote;
    renderRows();
    renderDetail();
  });
}

function renderRows() {
  const tbody = root?.querySelector('[data-wholesale-rows]');
  if (!tbody) return;
  const rows = visibleQuotes();
  const count = root.querySelector('[data-wholesale-count]');
  if (count) count.textContent = `${rows.length} de ${state.quotes.length}`;
  tbody.innerHTML = rows.length ? rows.map(quote => `
    <tr${quote.id === state.openId ? ' style="background:var(--adm-hover,rgba(0,0,0,.03))"' : ''}>
      <td><strong>${escapeHtml(quote.quoteNumber)}</strong></td>
      <td>${escapeHtml(quote.customerName)}<div style="font-size:12px;color:var(--adm-muted)">${escapeHtml(quote.userEmail)}</div></td>
      <td>${escapeHtml(quote.businessName)}<div style="font-size:12px;color:var(--adm-muted)">${escapeHtml(quote.city || '')}</div></td>
      <td>${Number(quote.itemCount) || 0}</td>
      <td>${money(quote.total)}</td>
      <td><span style="font-weight:700;color:${STATUS_TONES[quote.status] || 'inherit'}">${escapeHtml(STATUS_LABELS[quote.status] || quote.status)}</span></td>
      <td>${escapeHtml(dateText(quote.createdAt))}</td>
      <td><button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-open-quote="${escapeHtml(quote.id)}">${quote.id === state.openId ? 'Cerrar' : 'Ver'}</button></td>
    </tr>`).join('') : '<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--adm-muted)">No hay cotizaciones en esta vista.</td></tr>';
}

function renderDetail() {
  const container = root?.querySelector('[data-wholesale-detail]');
  if (!container) return;
  const quote = state.quotes.find(item => item.id === state.openId);
  if (!quote) { container.innerHTML = ''; return; }
  const editable = quote.status === 'pendiente';
  const items = Array.isArray(quote.items) ? quote.items : [];
  const link = whatsappLink(quote);
  container.innerHTML = `
    <div style="padding:18px 22px 22px;border-top:1px solid var(--adm-border,#eee)">
      <div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:16px;font-weight:700">${escapeHtml(quote.quoteNumber)} · ${escapeHtml(quote.businessName)}</div>
          <div style="font-size:13px;color:var(--adm-muted);margin-top:4px">${escapeHtml(quote.customerName)} · ${escapeHtml(quote.userEmail)} · WhatsApp ${escapeHtml(quote.whatsapp)}${quote.city ? ` · ${escapeHtml(quote.city)}` : ''}</div>
          ${quote.notes ? `<div style="font-size:13px;margin-top:8px;white-space:pre-wrap"><strong>Nota de la clienta:</strong> ${escapeHtml(quote.notes)}</div>` : ''}
        </div>
        ${link ? `<a class="adm-btn adm-btn-sm" href="${escapeHtml(link)}" target="_blank" rel="noopener">Escribir por WhatsApp</a>` : ''}
      </div>
      <div class="adm-table-wrap" style="margin-top:14px">
        <table class="adm-table">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio minorista</th><th>Precio mayorista c/u</th><th>Subtotal</th></tr></thead>
          <tbody>${items.map((item, index) => `
            <tr>
              <td>${escapeHtml(item.name)}${item.variant ? ` <span style="color:var(--adm-muted)">(${escapeHtml(item.variant)})</span>` : ''}</td>
              <td>${Number(item.qty) || 0}</td>
              <td>${money(item.retailUnitPrice)}</td>
              <td>${editable
                ? `<input type="number" min="0" step="1" inputmode="numeric" class="adm-input" style="max-width:150px" data-price-line="${index}" value="${item.unitPrice ?? ''}" placeholder="Gs." />`
                : money(item.unitPrice)}</td>
              <td data-line-total="${index}">${money(item.lineTotal)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:18px;margin-top:10px;font-size:14px">
        <span style="color:var(--adm-muted)">Referencia minorista: ${money(quote.retailReferenceTotal)}</span>
        <strong data-quote-total>Total mayorista: ${money(quote.total)}</strong>
      </div>
      <label style="display:block;margin-top:14px;font-size:13px;font-weight:600">Nota para la clienta (opcional, sale en el correo)
        <textarea class="adm-input" data-admin-note rows="2" maxlength="1000" style="margin-top:6px;width:100%" ${editable ? '' : 'disabled'}>${escapeHtml(quote.adminNote || '')}</textarea>
      </label>
      ${editable ? `
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:14px">
        <button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-decision="guardar">Guardar precios</button>
        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-decision="rechazar">Rechazar</button>
        <button type="button" class="adm-btn adm-btn-sm" data-decision="aprobar">Aprobar cotización</button>
      </div>` : `<p style="margin:14px 0 0;font-size:13px;color:var(--adm-muted)">Respondida ${escapeHtml(dateText(quote.respondedAt))}${quote.respondedBy ? ` por ${escapeHtml(quote.respondedBy)}` : ''}.</p>`}
    </div>`;
  container.dataset.renderedRevision = String(quote.revision || 1);
  container.querySelectorAll('[data-price-line]').forEach(input => input.addEventListener('input', () => previewTotals(container, items)));
  container.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', () => respond(quote, button.dataset.decision, container)));
}

function readPrices(container, items) {
  return items.map((_, index) => {
    const raw = container.querySelector(`[data-price-line="${index}"]`)?.value.trim() ?? '';
    return raw === '' ? null : Number(raw);
  });
}

function previewTotals(container, items) {
  let total = 0;
  let priced = 0;
  readPrices(container, items).forEach((price, index) => {
    const cell = container.querySelector(`[data-line-total="${index}"]`);
    const valid = Number.isSafeInteger(price) && price >= 0;
    if (cell) cell.textContent = valid ? money(price * items[index].qty) : '—';
    if (valid) { total += price * items[index].qty; priced += 1; }
  });
  const totalEl = container.querySelector('[data-quote-total]');
  if (totalEl) totalEl.textContent = `Total mayorista: ${priced ? money(total) : '—'}`;
}

async function respond(quote, decision, container) {
  if (state.busy) return;
  const items = Array.isArray(quote.items) ? quote.items : [];
  if (decision === 'aprobar' && !confirm(`¿Aprobar ${quote.quoteNumber}? La clienta recibe la confirmación y queda como mayorista aprobada.`)) return;
  if (decision === 'rechazar' && !confirm(`¿Rechazar ${quote.quoteNumber}? La clienta recibe el aviso con tu nota.`)) return;
  state.busy = true;
  container.querySelectorAll('[data-decision]').forEach(button => { button.disabled = true; });
  try {
    const response = await authenticatedFetch('/api/admin-wholesale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quoteId: quote.id,
        decision,
        prices: decision === 'rechazar' ? undefined : readPrices(container, items),
        adminNote: container.querySelector('[data-admin-note]')?.value || '',
        expectedRevision: Number(quote.revision || 1),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) {
      toast(ERROR_COPY[body.error] || apiFailureMessage(response, 'No se pudo guardar la cotización.'));
      return;
    }
    toast(decision === 'aprobar' ? `Cotización ${quote.quoteNumber} aprobada y avisada.`
      : decision === 'rechazar' ? `Cotización ${quote.quoteNumber} rechazada.` : 'Precios guardados.');
  } catch (error) {
    toast(error?.message || 'No se pudo guardar la cotización.');
  } finally {
    state.busy = false;
    container.querySelectorAll('[data-decision]').forEach(button => { button.disabled = false; });
  }
}

function subscribe() {
  if (state.unsubscribe) return;
  const quotesQuery = query(collection(db, 'wholesaleQuotes'), orderBy('createdAt', 'desc'), limit(300));
  state.unsubscribe = onSnapshot(quotesQuery, snapshot => {
    state.quotes = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    updateBadge();
    renderRows();
    // No se re-dibuja el detalle mientras se escriben precios: solo si cambió de estado o desapareció.
    const open = state.quotes.find(quote => quote.id === state.openId);
    const container = root?.querySelector('[data-wholesale-detail]');
    if (!open || container?.dataset.renderedRevision !== String(open.revision || 1)) renderDetail();
  }, error => {
    console.warn('[Mayoristas] No se pudieron leer las cotizaciones:', error);
    const tbody = root?.querySelector('[data-wholesale-rows]');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="padding:24px;text-align:center;color:#c53030">No se pudieron cargar las cotizaciones. Recargá el panel.</td></tr>';
  });
}

/** Se llama una vez con la sesión de Super Admin confirmada. */
export function initWholesaleAdmin() {
  if (state.started || !isSuperAdmin()) return;
  root = document.getElementById('section-mayoristas');
  if (!root) return;
  state.started = true;
  shell();
  subscribe();
  window.TintinWholesaleAdminRefresh = () => { renderRows(); renderDetail(); };
}
