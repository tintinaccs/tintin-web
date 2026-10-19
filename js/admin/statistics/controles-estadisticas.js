import { auth } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { authenticatedFetch } from '../../core/auth/cliente-api-autenticado.js?v=tintin-20261017-domain-cutover-1';
import { RESETTABLE_STATISTICS, statisticsSince } from './modelo-reinicios.mjs?v=tintin-20261019-revenue-start-1';

let state = { resets: {}, lastChangeId: '' }, owner = '', ready = false, loading = false, rerender;
export function filterStatisticsRows(metric, rows, timeOf) { return statisticsSince(rows, metric, state.resets, timeOf); }
async function request(body) {
  const response = await authenticatedFetch('/api/admin-commerce-controls', body ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  } : { method: 'GET' });
  const data = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(data.error || 'No se pudieron actualizar las estadísticas.');
  return data.result;
}
async function load() {
  const uid = auth.currentUser?.uid;
  if (!uid || loading) return;
  loading = true;
  try {
    const result = await request();
    if (auth.currentUser?.uid !== uid) return;
    owner = uid; state = result; ready = true; rerender?.();
  } catch (error) {
    const status = document.getElementById('statistics-data-status');
    if (status) status.textContent = `${error.message} Volvé a abrir Estadísticas para reintentar.`;
  } finally { loading = false; }
}
function selectMetrics() {
  return new Promise(resolve => {
    const previous = document.activeElement, dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Reiniciar estadísticas');
    dialog.style.cssText = 'box-sizing:border-box;width:min(600px,calc(100% - 32px));max-width:calc(100% - 32px);max-height:85dvh;overflow:auto;padding:24px;border:1px solid #F8AACA;border-radius:16px;color:#713C53;background:white;font-family:Montserrat;font-size:inherit;line-height:inherit;';
    const heading = document.createElement('h2'); heading.textContent = 'Reiniciar contadores'; heading.tabIndex = -1;
    const explanation = document.createElement('p'); explanation.textContent = 'Elegí los indicadores y si deben contar desde ahora o desde las 00:00 de hoy en Paraguay. La segunda opción conserva las operaciones reales de hoy. Se conservan pedidos, importes originales, clientes e inventario. Usuarios activos, catálogo y presencia muestran su estado real.';
    dialog.append(heading, explanation);
    const boxes = Object.entries(RESETTABLE_STATISTICS).map(([key, title]) => {
      const label = document.createElement('label'); label.style.cssText = 'display:flex;gap:12px;align-items:center;min-height:44px';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = key; label.append(checkbox, document.createTextNode(title)); dialog.append(label); return checkbox;
    });
    const all = document.createElement('button'); all.className = 'adm-btn'; all.textContent = 'Seleccionar todos'; all.onclick = () => boxes.forEach(box => { box.checked = true; });
    const cancel = document.createElement('button'); cancel.className = 'adm-btn'; cancel.textContent = 'Cancelar';
    const accept = document.createElement('button'); accept.className = 'adm-btn adm-btn-danger'; accept.textContent = 'Reiniciar seleccionados';
    const today = document.createElement('button'); today.className = 'adm-btn'; today.textContent = 'Contar desde el inicio de hoy (Paraguay)';
    const history = document.createElement('button'); history.className = 'adm-btn'; history.textContent = 'Volver al cálculo histórico de los seleccionados';
    let done = false;
    const finish = value => { if (done) return; done = true; dialog.close(); dialog.remove(); previous?.focus?.(); resolve(value); };
    cancel.onclick = () => finish(null); dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); });
    const choose = mode => { const metrics = boxes.filter(box => box.checked).map(box => box.value); if (metrics.length) finish({ metrics, mode }); else boxes[0].focus(); };
    accept.onclick = () => choose('reset'); history.onclick = () => choose('history');
    today.onclick = () => choose('today');
    for (const button of [all, cancel, history, today, accept]) button.style.cssText = 'min-height:44px;max-width:100%;white-space:normal;padding:10px 14px;margin:4px 4px 4px 0;font-family:Montserrat;font-size:inherit;line-height:inherit;';
    dialog.append(all, cancel, history, today, accept); document.body.append(dialog); dialog.showModal(); heading.focus({ preventScroll: true }); dialog.scrollTop = 0;
  });
}
export function ensureStatisticsControls(render, runOperation) {
  rerender = render;
  const uid = auth.currentUser?.uid || '';
  if (uid !== owner) { ready = false; state = { resets: {}, lastChangeId: '' }; }
  const toolbar = document.querySelector('.adm-statistics-toolbar');
  if (toolbar && !document.getElementById('statistics-reset-controls')) {
    const button = document.createElement('button'); button.id = 'statistics-reset-controls'; button.className = 'adm-btn'; button.textContent = 'Reiniciar contadores';
    button.onclick = async () => {
      if (!ready || owner !== auth.currentUser?.uid) return;
      const selection = await selectMetrics(); if (!selection) return;
      const { metrics, mode } = selection;
      const changeId = `stats_${crypto.randomUUID().replaceAll('-', '')}`;
      await runOperation({ title: mode === 'history' ? 'Restaurar cálculo histórico seleccionado' : mode === 'today' ? 'Contar estadísticas desde las 00:00 de hoy en Paraguay' : 'Reiniciar estadísticas seleccionadas', name: metrics.map(key => RESETTABLE_STATISTICS[key]).join(', '), module: 'estadisticas', dangerous: true,
        action: async ctx => {
          ctx.start('crud');
          const result = await request({ action: 'resetStatistics', metrics, mode, changeId, baseChangeId: state.lastChangeId || '' });
          if (owner !== auth.currentUser?.uid) throw new Error('La sesión cambió. Volvé a ingresar.');
          state = result; render(); ctx.ok('crud'); return { reset: mode !== 'history', restoredHistory: mode === 'history', metrics };
        } });
    };
    toolbar.append(button);
    window.addEventListener('tintin:site-content-updated', () => { if (auth.currentUser?.uid === owner) load(); });
  }
  if (!ready && !loading && uid) load();
  return ready && owner === uid;
}
