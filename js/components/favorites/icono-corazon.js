// Ícono de corazón compartido (favoritos / me gusta). Usa currentColor y
// tamaño 1em para heredar el color y font-size del botón existente sin
// tocar el CSS de cada superficie.
export const HEART_PATH_D = 'M12 21s-6.716-4.35-9.428-8.485C.79 9.702 1.5 6.06 4.5 4.5 7.03 3.18 9.79 4.06 12 6.5c2.21-2.44 4.97-3.32 7.5-2C22.5 6.06 23.21 9.702 21.428 12.515 18.716 16.65 12 21 12 21z';

export function heartIconMarkup(filled) {
  return filled
    ? `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false"><path d="${HEART_PATH_D}"/></svg>`
    : `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="${HEART_PATH_D}"/></svg>`;
}
