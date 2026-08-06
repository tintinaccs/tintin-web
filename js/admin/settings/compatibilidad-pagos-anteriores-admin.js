const ADMIN_PATH = /(^|\/)admin(?:\.html)?$/i;

if (ADMIN_PATH.test(location.pathname) || document.getElementById('section-configuracion')) {
  const original = {
    efectivo: document.getElementById('cfg-pay-efectivo'),
    transferencia: document.getElementById('cfg-pay-transferencia'),
    pagopark: document.getElementById('cfg-pay-pagopark'),
    ueno: document.getElementById('cfg-bank-ueno'),
    atlas: document.getElementById('cfg-bank-atlas'),
  };
  const state = {
    efectivo: original.efectivo?.checked !== false,
    transferencia: original.transferencia?.checked !== false,
    pagopark: original.pagopark?.checked === true,
    ueno: original.ueno?.value || '',
    atlas: original.atlas?.value || '',
  };

  let restored = false;
  let observer;
  const restore = () => {
    if (restored) return;
    const efectivo = document.getElementById('cfg-pay-efectivo');
    const transferencia = document.getElementById('cfg-pay-transferencia');
    const pagopark = document.getElementById('cfg-pay-pagopark');
    const ueno = document.getElementById('cfg-bank-ueno');
    const atlas = document.getElementById('cfg-bank-atlas');
    if (efectivo && efectivo !== original.efectivo) efectivo.checked = state.efectivo;
    if (transferencia && transferencia !== original.transferencia) transferencia.checked = state.transferencia;
    if (pagopark && pagopark !== original.pagopark) pagopark.checked = state.pagopark;
    if (ueno && ueno !== original.ueno && !ueno.value) ueno.value = state.ueno;
    if (atlas && atlas !== original.atlas && !atlas.value) atlas.value = state.atlas;
    if (efectivo && efectivo !== original.efectivo) {
      restored = true;
      observer?.disconnect();
    }
  };

  observer = new MutationObserver(restore);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 10000);
  document.addEventListener('DOMContentLoaded', restore, { once: true });
}
