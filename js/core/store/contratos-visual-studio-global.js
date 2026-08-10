/**
 * Fuente única de verdad para la ventana de vigencia y la resolución de
 * prioridad de campañas/pop-ups globales. La importan tanto el saneador
 * server-side (cloudflare/visual-studio-global-core.js) como el runtime
 * público en el navegador (js/core/store/visual-studio-global-runtime.js)
 * para que ambos coincidan siempre en qué campaña/pop-up está activo —
 * antes eran dos copias a mano que además usaban un criterio de desempate
 * distinto (comparación numérica vs. comparación de string).
 */

export function isGlobalStudioActiveWindow(item, now = Date.now()) {
  if (!item?.enabled) return false;
  const start = item.startAt ? new Date(item.startAt).getTime() : -Infinity;
  const end = item.endAt ? new Date(item.endAt).getTime() : Infinity;
  if ((!Number.isFinite(start) && start !== -Infinity) || (!Number.isFinite(end) && end !== Infinity)) return false;
  return now >= start && now <= end;
}

export function pickHighestPriority(items = [], now = Date.now()) {
  return items.filter(item => isGlobalStudioActiveWindow(item, now)).sort((a, b) => {
    const priority = Number(b.priority || 0) - Number(a.priority || 0);
    if (priority) return priority;
    const startA = a.startAt ? new Date(a.startAt).getTime() : 0;
    const startB = b.startAt ? new Date(b.startAt).getTime() : 0;
    return startB - startA;
  })[0] || null;
}
