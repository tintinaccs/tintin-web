/* =============================================================
   TINTIN — Sistema de operaciones del panel admin (interfaz).
   Avisos discretos, cargador de tres etapas, ventana de detalle con
   diagnóstico, exportación, historial local e indicador de estado.
   La lógica (etapas, progreso, estado global, saneamiento) vive en
   nucleo-operaciones.js. Todo el texto se inserta con textContent.
   ============================================================= */
import {
  GLOBAL_LABEL, GLOBAL_STATUS, GLOBAL_SYMBOL, STAGE_LABEL, STAGE_STATUS, STAGE_SYMBOL,
  appendHistory, buildDiagnosticText, completeStage, computeProgress, countUnreviewed,
  createOperation, describeError, diagnosticFileName, failStage, filterHistory,
  finishOperation, nextOperationId, parseHistory, sanitizeText, setStageProgress,
  skipStage, stageWindow, startStage, summarize, toHistoryEntry, warnStage,
} from './nucleo-operaciones.js?v=tintin-20260925-admin-ops-1';

const HISTORY_KEY = 'tintin:admin-ops-history:v1';
const TECHNICAL_ROLES = new Set(['superadmin', 'admin']);
const MAX_TOASTS = 4;
const ERROR_TEXT = /^\s*(?:❌|✕|⛔|error\b|no se pudo|fall[oó]\b|no fue posible)/i;
const WARNING_TEXT = /^\s*(?:⚠|!\s)/;
const FILTERS = [
  ['all', 'Todos'],
  [GLOBAL_STATUS.GREEN, 'Correctos'],
  [GLOBAL_STATUS.YELLOW, 'Advertencias'],
  [GLOBAL_STATUS.RED, 'Errores'],
];

class OperationCancelled extends Error {
  constructor(reason) {
    super(reason || 'Operación cancelada.');
    this.name = 'OperationCancelled';
  }
}

function storage() {
  try { return window.localStorage; } catch { return null; }
}

function readHistory() {
  try { return parseHistory(storage()?.getItem(HISTORY_KEY)); } catch { return []; }
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-PY', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(value));
  } catch { return String(value); }
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function appVersion() {
  const script = document.querySelector('script[src*="js/admin/admin-app.js"]');
  try { return new URL(script?.src || '', location.href).searchParams.get('v') || ''; } catch { return ''; }
}

function createSystem() {
  const state = {
    role: '',
    history: readHistory(),
    active: [],
    retries: new Map(),
    toastRoot: null,
    loader: null,
    dialog: null,
    indicator: null,
    renderQueued: false,
    filter: 'all',
    lastAnnounced: '',
  };

  const technical = () => TECHNICAL_ROLES.has(state.role);

  function saveHistory() {
    try { storage()?.setItem(HISTORY_KEY, JSON.stringify(state.history)); }
    catch (error) { console.warn('[operaciones] No se pudo guardar el historial local:', error?.message || error); }
  }

  /* ---------- Avisos ---------- */

  function ensureToastRoot() {
    if (state.toastRoot?.isConnected) return state.toastRoot;
    const root = el('div', 'tt-ops-toasts');
    root.id = 'tt-ops-toasts';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-label', 'Avisos del panel');
    document.body.appendChild(root);
    state.toastRoot = root;
    return root;
  }

  function removeToast(toast) {
    window.clearTimeout(toast._ttTimer);
    toast.remove();
  }

  function armToast(toast, duration) {
    window.clearTimeout(toast._ttTimer);
    if (duration > 0) toast._ttTimer = window.setTimeout(() => removeToast(toast), duration);
  }

  /**
   * Aviso discreto abajo a la derecha. El tipo explícito manda; sin tipo,
   * un texto que empieza como error se muestra como error y el resto como
   * información. Nunca se marca un éxito que quien llama no declaró.
   */
  function notify(message, options = {}) {
    const opts = typeof options === 'number' ? { duration: options } : (options || {});
    const text = sanitizeText(message, 600).trim();
    if (!text || !document.body) return null;
    const type = ['success', 'info', 'warning', 'error'].includes(opts.type) ? opts.type
      : ERROR_TEXT.test(text) ? 'error'
        : WARNING_TEXT.test(text) ? 'warning' : 'info';
    // Un error o advertencia nunca dura menos que su tiempo base aunque quien
    // llama pida menos: si desaparece antes de leerse, el problema queda oculto.
    const baseDuration = type === 'error' ? 8000 : type === 'warning' ? 6000 : 3600;
    const duration = !Number.isFinite(opts.duration) ? baseDuration
      : type === 'error' || type === 'warning' ? Math.max(baseDuration, opts.duration)
        : Math.max(1500, opts.duration);
    const root = ensureToastRoot();
    const existing = [...root.children].find(item => item.dataset.text === text && item.dataset.type === type);
    if (existing) { armToast(existing, duration); return existing; }

    const toast = el('div', `tt-ops-toast tt-ops-toast--${type}`);
    toast.dataset.text = text;
    toast.dataset.type = type;
    if (type === 'error') toast.setAttribute('role', 'alert');
    const symbol = el('span', 'tt-ops-toast__symbol', { success: '✓', info: 'i', warning: '!', error: '✕' }[type]);
    symbol.setAttribute('aria-hidden', 'true');
    const body = el('p', 'tt-ops-toast__text', text);
    const close = el('button', 'tt-ops-toast__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar aviso');
    close.addEventListener('click', () => removeToast(toast));
    toast.append(symbol, body, close);
    if (opts.operationId) {
      const open = el('button', 'tt-ops-toast__link', 'Ver detalle');
      open.type = 'button';
      open.addEventListener('click', () => { removeToast(toast); openOperation(opts.operationId); });
      body.append(' ', open);
    }
    // El tiempo se detiene mientras la persona lee o usa el teclado sobre el aviso.
    toast.addEventListener('mouseenter', () => window.clearTimeout(toast._ttTimer));
    toast.addEventListener('focusin', () => window.clearTimeout(toast._ttTimer));
    toast.addEventListener('mouseleave', () => armToast(toast, 2500));
    toast.addEventListener('focusout', () => armToast(toast, 2500));
    root.appendChild(toast);
    while (root.children.length > MAX_TOASTS) removeToast(root.firstElementChild);
    armToast(toast, duration);
    return toast;
  }

  /* ---------- Cargador de tres etapas ---------- */

  function ensureLoader() {
    if (state.loader?.root.isConnected) return state.loader;
    const root = el('div', 'tt-ops-loader');
    root.id = 'tt-ops-loader';
    root.setAttribute('role', 'region');
    root.hidden = true;
    root.setAttribute('aria-label', 'Progreso de la operación');
    const head = el('div', 'tt-ops-loader__head');
    const title = el('strong', 'tt-ops-loader__title');
    const percent = el('span', 'tt-ops-loader__percent');
    head.append(title, percent);
    const bar = el('div', 'tt-ops-loader__bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const fill = el('i');
    bar.append(fill);
    const list = el('ol', 'tt-ops-loader__stages');
    const live = el('p', 'tt-ops-sr-only');
    live.setAttribute('aria-live', 'polite');
    const extra = el('p', 'tt-ops-loader__extra');
    root.append(head, bar, list, extra, live);
    document.body.appendChild(root);
    state.loader = { root, title, percent, bar, fill, list, live, extra };
    return state.loader;
  }

  function stageItem(stage, position) {
    const item = el('li', `tt-ops-stage tt-ops-stage--${stage.status} tt-ops-stage--${position}`);
    const symbol = el('span', 'tt-ops-stage__symbol', STAGE_SYMBOL[stage.status]);
    symbol.setAttribute('aria-hidden', 'true');
    let label = stage.label;
    if (stage.status === STAGE_STATUS.RUNNING && stage.progress?.total > 0) label += ` · ${stage.progress.done}/${stage.progress.total}`;
    const text = el('span', 'tt-ops-stage__label', label);
    const status = el('span', 'tt-ops-sr-only', ` (${STAGE_LABEL[stage.status]})`);
    item.append(symbol, text, status);
    return item;
  }

  function renderLoader() {
    state.renderQueued = false;
    const operation = state.active[state.active.length - 1];
    const loader = ensureLoader();
    if (!operation) { loader.root.hidden = true; return; }
    const progress = computeProgress(operation);
    const { previous, current, next } = stageWindow(operation);
    loader.root.hidden = false;
    loader.title.textContent = operation.title;
    loader.percent.textContent = `${progress}%`;
    loader.fill.style.width = `${progress}%`;
    loader.bar.setAttribute('aria-valuenow', String(progress));
    loader.bar.setAttribute('aria-valuetext', `${progress}% · ${current ? current.label : ''}`);
    loader.list.replaceChildren(...[
      previous && stageItem(previous, 'previous'),
      current && stageItem(current, 'current'),
      next && stageItem(next, 'next'),
    ].filter(Boolean));
    loader.extra.textContent = state.active.length > 1 ? `${state.active.length - 1} operación(es) más en curso.` : '';
    const announce = current ? `${operation.title}: ${current.label}` : '';
    if (announce && announce !== state.lastAnnounced) {
      state.lastAnnounced = announce;
      loader.live.textContent = announce;
    }
  }

  function queueRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    const schedule = window.requestAnimationFrame || (fn => window.setTimeout(fn, 16));
    schedule(renderLoader);
  }

  /* ---------- Ventana de detalle e historial ---------- */

  function ensureDialog() {
    if (state.dialog?.isConnected) return state.dialog;
    const dialog = el('dialog', 'tt-ops-dialog');
    dialog.id = 'tt-ops-dialog';
    dialog.setAttribute('aria-labelledby', 'tt-ops-dialog-title');
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
    state.dialog = dialog;
    return dialog;
  }

  function showDialog(dialog) {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function field(list, label, value) {
    const text = sanitizeText(value, 1500);
    if (!text) return;
    const row = el('div', 'tt-ops-field');
    row.append(el('dt', '', label), el('dd', '', text));
    list.append(row);
  }

  function stageDetails(stage, index) {
    const details = el('details', `tt-ops-detail tt-ops-detail--${stage.status}`);
    if (stage.status === STAGE_STATUS.ERROR || stage.status === STAGE_STATUS.WARNING) details.open = true;
    const summary = el('summary');
    const symbol = el('span', `tt-ops-chip tt-ops-chip--${stage.status}`, STAGE_SYMBOL[stage.status]);
    symbol.setAttribute('aria-hidden', 'true');
    summary.append(symbol, el('span', 'tt-ops-detail__label', `${index + 1}. ${stage.label}`),
      el('span', 'tt-ops-detail__state', `${STAGE_LABEL[stage.status]} · ${formatDuration(stage.durationMs)}`));
    details.append(summary);
    const list = el('dl', 'tt-ops-fields');
    field(list, 'Qué se hizo', stage.detail);
    field(list, 'Afectados', stage.affected);
    if (technical()) {
      field(list, 'Origen', stage.source);
      field(list, 'Destino', stage.destination);
      field(list, 'Esperado', stage.expected);
      field(list, 'Recibido', stage.received);
      field(list, 'Depende de', stage.dependsOn.join(', '));
      field(list, 'Inicio', formatDate(stage.startedAt));
      field(list, 'Código', [stage.error?.code, stage.error?.httpStatus ? `HTTP ${stage.error.httpStatus}` : ''].filter(Boolean).join(' · '));
      field(list, 'Endpoint', stage.error?.endpoint);
      field(list, 'Error original', stage.error ? `${stage.error.name}: ${stage.error.message}` : '');
    }
    stage.diagnosis.forEach(entry => field(list, entry.kind, entry.text));
    if (list.children.length) details.append(list);
    if (technical() && stage.error?.stack) {
      const pre = el('pre', 'tt-ops-stack', stage.error.stack);
      details.append(pre);
    }
    return details;
  }

  function environment() {
    let timeZone = '';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
    return {
      page: location.pathname,
      role: state.role || 'desconocido',
      userAgent: navigator.userAgent,
      language: navigator.language,
      timeZone,
      viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      appVersion: appVersion(),
      generatedAt: new Date().toISOString(),
      online: navigator.onLine,
    };
  }

  function download(operation) {
    const text = buildDiagnosticText(operation, environment());
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a');
    link.href = url;
    link.download = diagnosticFileName(operation, new Date());
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function findOperation(id) {
    return state.active.find(item => item.id === id) || state.history.find(item => item.id === id) || null;
  }

  function markReviewed(id) {
    const entry = state.history.find(item => item.id === id);
    if (!entry || entry.reviewed) return;
    entry.reviewed = true;
    saveHistory();
    renderIndicator();
  }

  function button(label, className, onClick) {
    const node = el('button', `tt-ops-button ${className}`, label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  function openOperation(operationOrId) {
    const operation = typeof operationOrId === 'string' ? findOperation(operationOrId) : operationOrId;
    if (!operation) { notify('No se encontró esa operación en el historial de este navegador.', { type: 'warning' }); return; }
    const dialog = ensureDialog();
    const summary = summarize(operation);
    const status = operation.status;
    const header = el('header', `tt-ops-dialog__head tt-ops-dialog__head--${status}`);
    const badge = el('span', `tt-ops-chip tt-ops-chip--${status} tt-ops-chip--large`, GLOBAL_SYMBOL[status] || '');
    badge.setAttribute('aria-hidden', 'true');
    const titles = el('div', 'tt-ops-dialog__titles');
    const title = el('h2', '', operation.title);
    title.id = 'tt-ops-dialog-title';
    titles.append(title, el('p', 'tt-ops-dialog__state', `${GLOBAL_LABEL[status] || status} · ${summary.text}`));
    titles.append(el('p', 'tt-ops-dialog__meta', `${operation.id} · ${formatDate(operation.startedAt)}${operation.retryOf ? ` · reintento de ${operation.retryOf}` : ''}`));
    header.append(badge, titles);

    const body = el('div', 'tt-ops-dialog__body');
    if (operation.error) {
      const general = el('p', 'tt-ops-dialog__error', technical()
        ? `${operation.error.name}: ${operation.error.message}`
        : 'La operación no pudo completarse. Si el problema continúa, avisá a un administrador.');
      body.append(general);
    }
    operation.stages.forEach((stage, index) => body.append(stageDetails(stage, index)));
    const message = el('p', 'tt-ops-dialog__message');
    message.setAttribute('role', 'status');
    body.append(message);

    const footer = el('footer', 'tt-ops-dialog__actions');
    if (technical()) footer.append(button('Descargar detalle', 'tt-ops-button--secondary', () => download(operation)));
    const retry = state.retries.get(operation.id);
    if (retry && status !== GLOBAL_STATUS.GREEN && status !== GLOBAL_STATUS.RUNNING) {
      const retryButton = button('Reintentar', 'tt-ops-button--secondary', async () => {
        retryButton.disabled = true;
        message.textContent = operation.dangerous ? 'Comprobando el estado actual antes de reintentar…' : '';
        try {
          if (operation.dangerous && typeof retry.checkBeforeRetry === 'function') {
            const check = await retry.checkBeforeRetry(operation);
            if (!check?.ok) {
              message.textContent = check?.message || 'No es seguro reintentar: el estado actual cambió.';
              retryButton.disabled = false;
              return;
            }
          }
          state.retries.delete(operation.id);
          dialog.close();
          await retry.retry(operation);
        } catch (error) {
          message.textContent = `No se pudo reintentar: ${describeError(error)?.message || 'error desconocido'}`;
          retryButton.disabled = false;
        }
      });
      footer.append(retryButton);
    }
    if (state.history.length) footer.append(button('Historial', 'tt-ops-button--secondary', () => openHistory()));
    const accept = button('Aceptar', 'tt-ops-button--primary', () => dialog.close());
    footer.append(accept);

    dialog.replaceChildren(header, body, footer);
    markReviewed(operation.id);
    showDialog(dialog);
    accept.focus();
  }

  function historyItem(entry) {
    const item = el('li');
    const open = el('button', `tt-ops-history__item tt-ops-history__item--${entry.status}`);
    open.type = 'button';
    const badge = el('span', `tt-ops-chip tt-ops-chip--${entry.status}`, GLOBAL_SYMBOL[entry.status] || '');
    badge.setAttribute('aria-hidden', 'true');
    const text = el('span', 'tt-ops-history__text');
    text.append(el('strong', '', entry.title), el('span', '', `${GLOBAL_LABEL[entry.status] || entry.status} · ${summarize(entry).text}`),
      el('span', 'tt-ops-history__meta', `${entry.id} · ${formatDate(entry.startedAt)}`));
    if (!entry.reviewed) text.append(el('span', 'tt-ops-history__new', 'Sin revisar'));
    open.append(badge, text);
    open.addEventListener('click', () => openOperation(entry.id));
    item.append(open);
    return item;
  }

  function openHistory() {
    const dialog = ensureDialog();
    const header = el('header', 'tt-ops-dialog__head');
    const titles = el('div', 'tt-ops-dialog__titles');
    const title = el('h2', '', 'Historial de operaciones');
    title.id = 'tt-ops-dialog-title';
    titles.append(title, el('p', 'tt-ops-dialog__meta', `Últimas ${state.history.length} ejecuciones en este navegador (máximo 100).`));
    header.append(titles);

    const body = el('div', 'tt-ops-dialog__body');
    const filters = el('div', 'tt-ops-filters');
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Filtrar historial');
    const list = el('ol', 'tt-ops-history');
    const renderList = () => {
      const entries = filterHistory(state.history, state.filter);
      list.replaceChildren(...(entries.length ? entries.map(historyItem) : [el('li', 'tt-ops-history__empty', 'No hay operaciones con este filtro.')]));
      [...filters.children].forEach(node => node.setAttribute('aria-pressed', String(node.dataset.filter === state.filter)));
    };
    FILTERS.forEach(([value, label]) => {
      const count = filterHistory(state.history, value).length;
      const filter = button(`${label} (${count})`, 'tt-ops-filter', () => { state.filter = value; renderList(); });
      filter.dataset.filter = value;
      filters.append(filter);
    });
    body.append(filters, list);
    renderList();

    const footer = el('footer', 'tt-ops-dialog__actions');
    const accept = button('Cerrar', 'tt-ops-button--primary', () => dialog.close());
    footer.append(accept);
    dialog.replaceChildren(header, body, footer);
    showDialog(dialog);
    accept.focus();
  }

  /* ---------- Indicador ---------- */

  function ensureIndicator() {
    if (state.indicator?.isConnected) return state.indicator;
    const actions = document.querySelector('.adm-topbar-actions');
    if (!actions) return null;
    const indicator = el('button', 'tt-ops-indicator');
    indicator.type = 'button';
    indicator.id = 'tt-ops-indicator';
    indicator.addEventListener('click', () => {
      const pending = state.history.find(item => !item.reviewed && item.status === GLOBAL_STATUS.RED)
        || state.history.find(item => !item.reviewed && item.status === GLOBAL_STATUS.YELLOW);
      if (pending) openOperation(pending.id);
      else openHistory();
    });
    actions.prepend(indicator);
    state.indicator = indicator;
    return indicator;
  }

  function renderIndicator() {
    const indicator = ensureIndicator();
    if (!indicator) return;
    const { yellow, red } = countUnreviewed(state.history);
    const running = state.active.length;
    const status = red ? 'red' : yellow ? 'yellow' : running ? 'running' : 'green';
    indicator.dataset.status = status;
    const parts = [];
    if (running) parts.push(['running', `⟳ ${running}`]);
    if (red) parts.push(['red', `✕ ${red}`]);
    if (yellow) parts.push(['yellow', `! ${yellow}`]);
    if (!parts.length) parts.push(['green', '✓']);
    const label = el('span', 'tt-ops-indicator__label', 'Operaciones');
    indicator.replaceChildren(label, ...parts.map(([kind, text]) => el('span', `tt-ops-indicator__count tt-ops-indicator__count--${kind}`, text)));
    const description = [
      running ? `${running} en curso` : '',
      red ? `${red} con error sin revisar` : '',
      yellow ? `${yellow} con advertencia sin revisar` : '',
    ].filter(Boolean).join(', ') || 'Sin errores ni advertencias pendientes';
    indicator.setAttribute('aria-label', `Operaciones del panel: ${description}. Abrir detalle.`);
    indicator.title = `${description}. Cuenta las operaciones hechas desde este navegador.`;
  }

  /* ---------- Ejecución ---------- */

  function record(operation) {
    if (operation.status === GLOBAL_STATUS.CANCELLED) return;
    state.history = appendHistory(state.history, toHistoryEntry(operation));
    saveHistory();
  }

  /**
   * Ejecuta una operación por etapas. `run(ctx)` informa cada etapa con
   * ctx.start/ok/warn/fail/skip/progress; un error no capturado marca como
   * fallidas las etapas en curso. Verde avisa de forma discreta; amarillo o
   * rojo abren la ventana de detalle. Nada se marca correcto sin que la
   * etapa lo confirme.
   */
  async function runOperation(config = {}) {
    const operation = createOperation({
      id: nextOperationId(new Date(), storage()),
      name: config.name,
      title: config.title,
      module: config.module,
      dangerous: config.dangerous,
      stages: config.stages,
      retryOf: config.retryOf || null,
      now: new Date(),
    });
    const update = () => { queueRender(); renderIndicator(); };
    let retryAllowed = true;
    const ctx = {
      operation,
      start: id => { startStage(operation, id); update(); },
      ok: (id, info) => { completeStage(operation, id, info); update(); },
      warn: (id, info) => { warnStage(operation, id, info); update(); },
      fail: (id, info) => { failStage(operation, id, info); update(); },
      skip: (id, reason) => { skipStage(operation, id, reason); update(); },
      progress: (id, done, total) => { setStageProgress(operation, id, done, total); queueRender(); },
      cancel: reason => { throw new OperationCancelled(reason); },
      // Para fallos que un reintento no puede resolver: no se ofrece el botón.
      disableRetry: () => { retryAllowed = false; },
    };
    state.active.push(operation);
    update();
    let value;
    let cancelled = null;
    try {
      value = await config.run(ctx);
    } catch (error) {
      if (error instanceof OperationCancelled) cancelled = error;
      else {
        const running = operation.stages.filter(stage => stage.status === STAGE_STATUS.RUNNING);
        if (running.length) running.forEach(stage => failStage(operation, stage.id, { error }));
        else operation.error = describeError(error);
        console.error(`[operaciones] ${operation.id} ${operation.name}:`, error);
      }
    }
    finishOperation(operation, new Date(), cancelled ? { cancelled: true, cancelReason: cancelled.message } : {});
    state.active = state.active.filter(item => item !== operation);
    queueRender();
    record(operation);
    if (retryAllowed && typeof config.retry === 'function' && operation.status !== GLOBAL_STATUS.GREEN && !cancelled) {
      state.retries.set(operation.id, { retry: config.retry, checkBeforeRetry: config.checkBeforeRetry });
    }
    renderIndicator();
    if (operation.status === GLOBAL_STATUS.GREEN) {
      // notifySuccess:false cuando quien llama ya informa el resultado con sus propios números.
      if (config.notifySuccess !== false) notify(config.successMessage || `${operation.title}: completado.`, { type: 'success' });
    } else if (operation.status === GLOBAL_STATUS.YELLOW || operation.status === GLOBAL_STATUS.RED) {
      openOperation(operation);
    }
    return { status: operation.status, operation, value };
  }

  function setViewerRole(role) {
    state.role = String(role || '').toLowerCase();
    renderIndicator();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderIndicator, { once: true });
  else renderIndicator();

  return { notify, runOperation, openOperation, openHistory, setViewerRole };
}

// Una sola instancia aunque el módulo se importe con distintas URLs.
const system = window.TintinAdminOps || (window.TintinAdminOps = createSystem());

if (!window.toast || !window.toast.__tintinOps) {
  const toast = (message, options) => system.notify(message, options);
  toast.__tintinOps = true;
  window.toast = toast;
}

export const notify = (message, options) => system.notify(message, options);
export const runOperation = config => system.runOperation(config);
export const openOperation = operation => system.openOperation(operation);
export const openOperationsHistory = () => system.openHistory();
export const setOperationsViewerRole = role => system.setViewerRole(role);
export { GLOBAL_STATUS, STAGE_STATUS };
