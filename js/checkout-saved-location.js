// =============================================================
// TINTIN ACCESORIOS — "¿Seguís acá?" para la ubicación guardada
// =============================================================
// Quien ya compró tiene su ubicación guardada en el perfil. Volver a
// buscarla y marcarla en cada compra es trabajo repetido, pero usarla sin
// avisar tampoco sirve: la gente se muda, o el pedido va a otro lado.
//
// El punto medio es confirmarla de un toque. Se muestra la ubicación guardada
// sobre el mapa —para que se vea dónde es, no sólo su nombre— con dos
// caminos: seguir con esa, o marcar otra.
//
// Sin Firebase adentro, para poder verificarlo sin el resto del checkout.

/**
 * ¿Hay una ubicación guardada que valga la pena confirmar?
 *
 * El checkout necesita coordenadas para entregar, y el nombre para que la
 * confirmación signifique algo ("Mi casa" y no un par de números).
 */
export function isConfirmableLocation(saved) {
  return Boolean(
    saved &&
    typeof saved.lat === 'number' && Number.isFinite(saved.lat) &&
    typeof saved.lng === 'number' && Number.isFinite(saved.lng) &&
    String(saved.name || '').trim()
  );
}

/** Texto de la tarjeta de confirmación. */
export function confirmPrompt(saved) {
  if (!isConfirmableLocation(saved)) return null;
  const name = String(saved.name).trim();
  const address = String(saved.address || '').trim();
  return {
    title: '¿Te lo llevamos acá?',
    name,
    address,
    // El detalle se muestra sólo si aporta algo distinto del nombre.
    detail: address && address.toLowerCase() !== name.toLowerCase() ? address : '',
  };
}

/**
 * Conecta la tarjeta de confirmación.
 *
 * @param {object} elements
 * @param {object} saved                 Ubicación guardada del perfil.
 * @param {() => void} onConfirm         La acepta tal cual.
 * @param {() => void} onChange          Quiere marcar otra.
 * @returns {{ isConfirmed: () => boolean, reset: () => void }}
 */
export function attachSavedLocationConfirm(elements, saved, { onConfirm, onChange } = {}) {
  const { card, titleEl, nameEl, detailEl, confirmButton, changeButton } = elements;
  const prompt = confirmPrompt(saved);
  let confirmed = false;

  const hide = () => { if (card) card.style.display = 'none'; };

  if (!prompt) {
    hide();
    return { isConfirmed: () => false, reset: hide };
  }

  if (titleEl) titleEl.textContent = prompt.title;
  if (nameEl) nameEl.textContent = `📍 ${prompt.name}`;
  if (detailEl) {
    detailEl.textContent = prompt.detail;
    detailEl.style.display = prompt.detail ? '' : 'none';
  }
  if (card) card.style.display = '';

  confirmButton?.addEventListener('click', () => {
    confirmed = true;
    hide();
    if (typeof onConfirm === 'function') onConfirm(saved);
  });

  changeButton?.addEventListener('click', () => {
    confirmed = false;
    hide();
    if (typeof onChange === 'function') onChange();
  });

  return { isConfirmed: () => confirmed, reset: hide };
}
