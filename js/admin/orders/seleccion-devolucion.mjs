export function chooseOrderTrash(orders) {
  return new Promise(resolve => {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Eliminar pedidos y elegir devolución de stock');
    dialog.style.cssText = 'box-sizing:border-box;width:min(720px,calc(100% - 32px));max-width:calc(100% - 32px);max-height:85dvh;overflow:auto;padding:24px;border:1px solid #F8AACA;border-radius:16px;color:#713C53;background:white;font:inherit';
    const title = document.createElement('h2'); title.textContent = 'Mover a Borrados'; title.tabIndex = -1;
    const text = document.createElement('p');
    text.textContent = 'Elegí qué unidades devolver al stock. Los pedidos saldrán de las estadísticas y del historial activo. Los precios del catálogo no cambian y no se envían reembolsos de dinero. Podrás restaurar el pedido; se descontarán únicamente las unidades que ahora devuelvas.';
    dialog.append(title, text);
    const rows = [];
    for (const order of orders) {
      const heading = document.createElement('h3'); heading.textContent = order.orderNumber || order.shortId || order.id; dialog.append(heading);
      const reserved = order.inventoryState === 'reserved' || (!['released', 'unreserved'].includes(order.inventoryState) && !['cancelado', 'rechazado'].includes(order.status));
      for (const [index, item] of (order.items || []).entries()) {
        const label = document.createElement('label'); label.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #eee';
        const name = document.createElement('span'); name.style.flex = '1 1 200px'; name.textContent = `${item.name || item.id}${item.variant ? ` · ${item.variant}` : ''} · comprados: ${item.qty ?? item.quantity}`;
        const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '0'; quantity.max = String(item.qty ?? item.quantity); quantity.step = '1'; quantity.value = '0'; quantity.disabled = !reserved;
        quantity.setAttribute('aria-label', `Unidades a devolver de ${item.name || item.id}`); quantity.style.cssText = 'width:90px;min-height:44px';
        label.append(name, quantity); dialog.append(label); rows.push({ order, index, quantity });
      }
      if (!reserved) { const note = document.createElement('p'); note.textContent = 'Este pedido no tiene stock descontado: no corresponde reponer unidades.'; dialog.append(note); }
    }
    const all = document.createElement('button'); all.type = 'button'; all.className = 'adm-btn'; all.textContent = 'Devolver todas las unidades';
    const none = document.createElement('button'); none.type = 'button'; none.className = 'adm-btn'; none.textContent = 'No devolver stock';
    all.onclick = () => rows.forEach(row => { if (!row.quantity.disabled) row.quantity.value = row.quantity.max; });
    none.onclick = () => rows.forEach(row => { row.quantity.value = '0'; });
    const reasonLabel = document.createElement('label'); reasonLabel.textContent = 'Motivo (opcional)'; reasonLabel.style.cssText = 'display:block;margin:16px 0';
    const reason = document.createElement('textarea'); reason.maxLength = 500; reason.className = 'adm-input'; reason.style.cssText = 'display:block;box-sizing:border-box;width:100%;min-height:72px'; reasonLabel.append(reason);
    const summary = document.createElement('p'); summary.setAttribute('aria-live', 'polite');
    const refresh = () => { summary.textContent = `${orders.length} pedido(s) a Borrados · ${rows.reduce((n, row) => n + Math.max(0, Number(row.quantity.value) || 0), 0)} unidad(es) a devolver.`; };
    dialog.addEventListener('input', refresh); all.addEventListener('click', refresh); none.addEventListener('click', refresh);
    const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'adm-btn adm-btn-danger'; accept.textContent = 'Confirmar y mover a Borrados';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'adm-btn'; cancel.textContent = 'Cancelar';
    let done = false;
    const finish = value => { if (done) return; done = true; dialog.close(); dialog.remove(); previous?.focus?.(); resolve(value); };
    cancel.onclick = () => finish(null); dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    accept.onclick = () => {
      for (const row of rows) if (!row.quantity.checkValidity()) { row.quantity.reportValidity(); return; }
      const selections = Object.fromEntries(orders.map(order => [order.id, { baseChangeId: order.lastChangeId || '',
        returnItems: rows.filter(row => row.order === order).map(row => ({ index: row.index, qty: Number(row.quantity.value) })) }]));
      finish({ reason: reason.value, selections });
    };
    for (const button of [all, none, cancel, accept]) button.style.cssText = 'min-height:44px;max-width:100%;white-space:normal;padding:10px 14px;margin:4px 4px 4px 0;font:inherit';
    dialog.append(all, none, reasonLabel, summary, cancel, accept); document.body.append(dialog); refresh(); dialog.showModal(); title.focus({ preventScroll: true }); dialog.scrollTop = 0;
  });
}
