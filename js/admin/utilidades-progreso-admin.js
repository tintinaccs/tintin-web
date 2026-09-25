/* Utilidades compartidas para operaciones masivas del Super Admin.
 * Mantiene la interfaz viva mientras se procesan lotes y nunca bloquea el
 * hilo principal con esperas artificiales o renders completos.
 */
let progressRoot = null;

function ensureProgressRoot() {
  if (progressRoot?.isConnected) return progressRoot;
  progressRoot = document.createElement('section');
  progressRoot.id = 'tt-admin-bulk-progress';
  progressRoot.setAttribute('role', 'status');
  progressRoot.setAttribute('aria-live', 'polite');
  progressRoot.hidden = true;
  progressRoot.innerHTML = `
    <div class="tt-admin-bulk-progress__head"><strong data-progress-title></strong><span data-progress-count></span></div>
    <div class="tt-admin-bulk-progress__track"><i data-progress-fill></i></div>
    <p data-progress-detail></p>`;
  document.body.appendChild(progressRoot);
  return progressRoot;
}

export function updateAdminBulkProgress(title, done, total, detail = '') {
  const root = ensureProgressRoot();
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeDone = Math.min(safeTotal, Math.max(0, Number(done) || 0));
  root.hidden = false;
  root.querySelector('[data-progress-title]').textContent = title || 'Procesando…';
  root.querySelector('[data-progress-count]').textContent = safeTotal ? `${safeDone}/${safeTotal}` : '';
  root.querySelector('[data-progress-fill]').style.width = safeTotal ? `${Math.round((safeDone / safeTotal) * 100)}%` : '24%';
  root.querySelector('[data-progress-detail]').textContent = detail || 'La página sigue disponible mientras se confirma cada operación.';
}

export function finishAdminBulkProgress(detail = '') {
  if (!progressRoot?.isConnected) return;
  if (detail) progressRoot.querySelector('[data-progress-detail]').textContent = detail;
  window.setTimeout(() => { if (progressRoot) progressRoot.hidden = true; }, detail ? 900 : 0);
}

export async function runAdminBulk(items, worker, {
  title = 'Procesando…', concurrency = 3, onProgress,
} = {}) {
  const queue = [...items];
  const total = queue.length;
  let cursor = 0;
  let done = 0;
  const results = [];
  const report = () => {
    updateAdminBulkProgress(title, done, total);
    onProgress?.(done, total);
  };
  report();
  const consume = async () => {
    while (cursor < total) {
      const index = cursor++;
      try { results[index] = { status: 'fulfilled', value: await worker(queue[index], index) }; }
      catch (error) { results[index] = { status: 'rejected', reason: error }; }
      done += 1;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, total)) }, consume));
  finishAdminBulkProgress('Operación finalizada. Actualizando los datos confirmados…');
  return results;
}

