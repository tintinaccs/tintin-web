/**
 * Fuente única de verdad para los tipos de bloque y las opciones de estilo
 * del Visual Builder. La importan tanto el saneador server-side
 * (cloudflare/visual-builder-core.js) como el runtime público en el
 * navegador (js/core/store/editor-visual-runtime.js) para que el
 * whitelist que valida el servidor sea exactamente el mismo que el que
 * valida el cliente — nunca dos listas copiadas a mano que puedan
 * desincronizarse con una edición futura.
 */

export const VISUAL_BLOCK_TYPES = Object.freeze([
  'banner', 'text', 'products', 'gallery', 'promotion', 'button', 'section', 'collections',
  'testimonial', 'video', 'faq', 'columns', 'divider', 'spacer', 'marquee', 'features', 'countdown',
]);

export const VISUAL_STYLE_OPTIONS = Object.freeze({
  spacing: ['flush', 'compact', 'normal', 'roomy', 'dramatic'],
  width: ['narrow', 'contained', 'wide', 'full'],
  align: ['left', 'center', 'right'],
  radius: ['none', 'small', 'medium', 'large', 'pill'],
  shadow: ['none', 'soft', 'medium', 'large', 'floating'],
  animation: ['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'pop', 'reveal'],
  variant: ['default', 'minimal', 'editorial', 'cards', 'carousel', 'mosaic', 'split', 'spotlight', 'glass', 'outline', 'bar'],
  imageFit: ['cover', 'contain'],
  visibility: ['inherit', 'show', 'hide'],
  columns: ['inherit', '1', '2', '3', '4', '5', '6'],
});
