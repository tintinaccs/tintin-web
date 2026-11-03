/** Decisión explícita por operación; cerrar o volver nunca confirma cambios. */
let activeDialog = null;

export function chooseCancellationStock(order, status) {
  if (activeDialog?.isConnected) return Promise.resolve(null);
  return new Promise(resolve => {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'cancel-stock-title');
    dialog.setAttribute('aria-describedby', 'cancel-stock-description');
    dialog.style.cssText = 'box-sizing:border-box;width:min(560px,calc(100% - 32px));max-height:85dvh;overflow:auto;overflow-wrap:anywhere;padding:24px;border:1px solid var(--admin-color-border,#F8AACA);border-radius:16px;color:var(--admin-color-text-primary,#222222);background:var(--admin-color-background-surface,#fff);font-family:Montserrat;font-size:16px;line-height:1.5';
    const title = document.createElement('h2'); title.id = 'cancel-stock-title'; title.tabIndex = -1;
    title.textContent = status === 'rechazado' ? 'Rechazar pedido: elegí el stock' : 'Cancelar pedido: elegí el stock';
    const description = document.createElement('p'); description.id = 'cancel-stock-description';
    description.textContent = `Pedido ${order.orderNumber || order.shortId || order.id}. ¿Querés devolver al stock las unidades descontadas de este pedido o mantenerlas fuera del stock disponible? Esta acción no registra ni envía un reembolso de dinero.`;
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px';
    let done = false;
    const finish = value => { if (done) return; done = true; if (activeDialog === dialog) activeDialog = null; dialog.close(); dialog.remove(); previous?.focus?.(); resolve(value); };
    for (const [value, label] of [['release', 'Confirmar y devolver stock'], ['keep', 'Confirmar sin devolver stock'], [null, 'Volver sin cambios']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'adm-btn';
      button.textContent = label; button.dataset.stockDecision = value || 'back';
      button.style.cssText = 'min-height:44px;max-width:100%;white-space:normal;font:inherit;padding:10px 14px';
      button.addEventListener('click', () => finish(value)); actions.append(button);
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.append(title, description, actions); document.body.append(dialog); dialog.showModal(); activeDialog = dialog; title.focus({ preventScroll: true });
  });
}
