// =============================================================
// TINTIN ACCESORIOS — Encomienda: agencia o puerta
// =============================================================
// Retirar en la agencia y que se lo lleven a la puerta no son el mismo envío
// y no necesitan los mismos datos: uno se coordina con la transportadora, el
// otro necesita el punto exacto en el mapa igual que el delivery de la zona
// central. Por eso se pregunta antes de pedir la dirección.
//
// El modo NO cambia el costo: el precio de la encomienda sigue siendo el que
// esté configurado para esa ciudad en el panel (o "a consultar" si no hay).
//
// Vive en su propio módulo, sin importar Firebase, para poder verificarlo
// sin depender del resto del checkout.

export const ENCOMIENDA_MODES = { AGENCIA: 'agencia', PUERTA: 'puerta' };

const AGENCIA_NOTE =
  'La agencia y la transportadora las coordinamos por WhatsApp después de confirmar el pedido, según tu zona.';

/**
 * Qué mostrar y qué pedir para cada modo. Devolverlo como dato (en vez de
 * tocar el DOM acá adentro) permite comprobar la decisión sin navegador.
 */
export function encomiendaFieldPlan(mode) {
  if (mode === ENCOMIENDA_MODES.AGENCIA) {
    return { note: AGENCIA_NOTE, showAddress: false, showReference: false, showMap: false };
  }
  if (mode === ENCOMIENDA_MODES.PUERTA) {
    return { note: '', showAddress: true, showReference: true, showMap: true };
  }
  // Sin elegir: no se piden datos que quizá no correspondan.
  return { note: '', showAddress: false, showReference: false, showMap: false };
}

/** Qué falta para poder continuar. `null` = está todo. */
export function encomiendaValidationError(mode, { mapLocation, locationName, address } = {}) {
  if (!mode) return 'Elegí si retirás en la agencia o si te lo llevamos a la puerta.';
  if (mode === ENCOMIENDA_MODES.AGENCIA) return null;

  if (!mapLocation) return 'Marcá en el mapa dónde te lo entregamos (buscándolo o tocando el mapa).';
  if (!String(locationName || '').trim()) return 'Ponele un nombre a tu ubicación (ej: Mi casa) para continuar.';
  if (!String(address || '').trim()) return 'Ingresá tu dirección de entrega.';
  return null;
}

/** Etiqueta para el resumen, el panel y los correos. */
export function encomiendaModeLabel(mode) {
  if (mode === ENCOMIENDA_MODES.AGENCIA) return 'retiro en agencia';
  if (mode === ENCOMIENDA_MODES.PUERTA) return 'entrega en puerta';
  return '';
}

/**
 * Conecta los dos botones con el resto del paso de envío.
 *
 * @param {object} elements  Nodos del checkout (botones, aviso, campos, mapa).
 * @param {(mode: string) => void} onChange  Se llama con el modo elegido.
 * @returns {{ setMode: (mode) => void, getMode: () => string }}
 */
export function attachEncomiendaModes(elements, onChange) {
  const { agenciaButton, puertaButton, noteElement, addressField, referenceField, mapWrap } = elements;
  let current = '';

  const render = mode => {
    const plan = encomiendaFieldPlan(mode);

    agenciaButton?.classList.toggle('is-active', mode === ENCOMIENDA_MODES.AGENCIA);
    puertaButton?.classList.toggle('is-active', mode === ENCOMIENDA_MODES.PUERTA);
    agenciaButton?.setAttribute('aria-checked', mode === ENCOMIENDA_MODES.AGENCIA ? 'true' : 'false');
    puertaButton?.setAttribute('aria-checked', mode === ENCOMIENDA_MODES.PUERTA ? 'true' : 'false');

    if (noteElement) {
      noteElement.textContent = plan.note;
      noteElement.style.display = plan.note ? '' : 'none';
    }
    if (addressField) addressField.style.display = plan.showAddress ? 'block' : 'none';
    if (referenceField) referenceField.style.display = plan.showReference ? 'block' : 'none';
    if (mapWrap) mapWrap.classList.toggle('show', plan.showMap);
  };

  const setMode = mode => {
    current = mode;
    render(mode);
    if (typeof onChange === 'function') onChange(mode);
  };

  agenciaButton?.addEventListener('click', () => setMode(ENCOMIENDA_MODES.AGENCIA));
  puertaButton?.addEventListener('click', () => setMode(ENCOMIENDA_MODES.PUERTA));
  render('');

  return { setMode, getMode: () => current };
}
