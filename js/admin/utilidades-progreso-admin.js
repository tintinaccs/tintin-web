/* Utilidades compartidas para operaciones masivas del Super Admin.
 * Cada lote es una operación del sistema central: progreso real por
 * elemento, resultado parcial como advertencia, fallo total como error y
 * detalle por elemento en la ventana de diagnóstico. Sin esperas
 * artificiales ni renders completos durante el proceso.
 */
import { runOperation } from './operaciones/sistema-operaciones-admin.js?v=tintin-20260925-admin-ops-1';

const MAX_LISTED_FAILURES = 20;

function itemLabel(item, index) {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  return String(item?.id || item?.uid || `#${index + 1}`);
}

export async function runAdminBulk(items, worker, {
  title = 'Procesando…', concurrency = 3, onProgress, name, module = 'Panel admin', label = itemLabel,
  // Resultados que no son error pero tampoco un cambio (p. ej. ya no existía).
  isSkipped = null, skippedText = 'omitidos',
} = {}) {
  const queue = [...items];
  const total = queue.length;
  const results = [];
  await runOperation({
    name: name || title,
    title,
    module,
    // Quien llama ya informa el resultado final con sus propios números.
    notifySuccess: false,
    stages: [{ id: 'items', label: `Procesar ${total} elemento${total === 1 ? '' : 's'}`, expected: `${total} correctos` }],
    run: async ctx => {
      let cursor = 0;
      let done = 0;
      const report = () => {
        ctx.progress('items', done, total);
        onProgress?.(done, total);
      };
      ctx.start('items');
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

      const failures = [];
      results.forEach((result, index) => { if (result.status === 'rejected') failures.push({ index, error: result.reason }); });
      const skipped = typeof isSkipped === 'function'
        ? results.filter(result => result.status === 'fulfilled' && isSkipped(result.value)).length : 0;
      const okCount = total - failures.length;
      const received = `${okCount - skipped} de ${total} correctos`
        + (skipped ? `; ${skipped} ${skippedText}` : '')
        + (failures.length ? `; ${failures.length} con error` : '');
      if (!failures.length) { ctx.ok('items', { received }); return; }
      const listed = failures.slice(0, MAX_LISTED_FAILURES)
        .map(({ index, error }) => `${label(queue[index], index)}: ${error?.message || error}`);
      if (failures.length > listed.length) listed.push(`… y ${failures.length - listed.length} más`);
      const info = { received, affected: listed.join('\n'), error: failures[0].error };
      if (okCount > 0) ctx.warn('items', info);
      else ctx.fail('items', info);
    },
  });
  return results;
}
