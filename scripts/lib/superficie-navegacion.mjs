// Se ejecuta en el navegador contra estilos calculados, no contra nombres de tema.
export function navigationPaintState(node) {
  const style = getComputedStyle(node);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  const alpha = color => {
    if (!CSS.supports('color', color)) return 0;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[3] / 255;
  };
  const paintAlpha = surface => {
    if (surface.display === 'none' || surface.visibility !== 'visible') return 0;
    const stops = surface.backgroundImage.match(/\b(?:rgba?|color|oklch|oklab|lab|lch|hsla?|hwb)\([^)]*\)/g) || [];
    const gradient = /gradient\(/.test(surface.backgroundImage) ? Math.max(0, ...stops.map(alpha)) : 0;
    return Math.max(alpha(surface.backgroundColor), gradient) * Number(surface.opacity);
  };
  const box = node.getBoundingClientRect();
  const visible = box.width > 0 && box.height > 0 && style.visibility === 'visible' && style.display !== 'none';
  const ownAlpha = visible ? paintAlpha(style) : 0;
  const before = getComputedStyle(node, '::before');
  // El degradado puede vivir detrás del contenido sin volver blancos los headers.
  const hasBackgroundLayer = visible && style.isolation === 'isolate'
    && !['none', 'normal'].includes(before.content)
    && ['absolute', 'fixed'].includes(before.position)
    && Number(before.zIndex) < 0 && before.pointerEvents === 'none';
  const beforeAlpha = hasBackgroundLayer ? paintAlpha(before) * Number(style.opacity) : 0;
  return {
    painted: ownAlpha >= .8 || beforeAlpha >= .8,
    source: ownAlpha >= .8 ? 'element' : beforeAlpha >= .8 ? 'before' : 'none',
    alpha: Math.round(Math.max(ownAlpha, beforeAlpha) * 1000) / 1000,
  };
}
