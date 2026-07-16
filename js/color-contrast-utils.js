/**
 * TINTIN — Utilidades de contraste WCAG, compartidas por el módulo de
 * Apariencia (Super Admin) para el chequeo automático de contraste.
 * Misma fórmula de luminancia relativa usada en la auditoría de contraste
 * de toda la plataforma (script.js/scanner de esa fase) — un solo lugar,
 * sin reimplementar la matemática dos veces.
 */

function parseColor(input) {
  if (!input) return null;
  const s = String(input).trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split('').map(c => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = m[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16), a: 1 };
  }
  m = s.match(/^#([0-9a-f]{8})$/i);
  if (m) {
    const n = m[1];
    return {
      r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16),
      a: parseInt(n.slice(6, 8), 16) / 255,
    };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    const color = { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    if ([color.r, color.g, color.b].some(value => value < 0 || value > 255) || color.a < 0 || color.a > 1) return null;
    return color;
  }
  m = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    const saturation = +m[2];
    const lightness = +m[3];
    const alpha = m[4] !== undefined ? +m[4] : 1;
    if (saturation < 0 || saturation > 100 || lightness < 0 || lightness > 100 || alpha < 0 || alpha > 1) return null;
    const { r, g, b } = hslToRgb(+m[1], saturation, lightness);
    return { r, g, b, a: alpha };
  }
  return null;
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function relativeLuminance({ r, g, b }) {
  const chan = v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** Compone `fg` (puede tener alpha) sobre `bg` (se asume opaco). */
function compositeOver(fg, bg) {
  if (fg.a >= 1) return fg;
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/**
 * Ratio de contraste WCAG entre dos colores (strings en cualquier formato
 * soportado por parseColor). Si `fg` tiene transparencia, se compone sobre
 * `bg` antes de calcular — así un texto semitransparente se evalúa como se
 * ve realmente, no como si fuera opaco.
 */
export function contrastRatio(fgStr, bgStr) {
  const fgRaw = parseColor(fgStr);
  const bgRaw = parseColor(bgStr);
  if (!fgRaw || !bgRaw) return null;
  const bg = { ...bgRaw, a: 1 };
  const fg = compositeOver(fgRaw, bg);
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** level: 'normal' (4.5:1), 'large' (3:1) o 'ui' (3:1, íconos/bordes/controles). */
export function passesWcag(ratio, level = 'normal') {
  if (ratio == null) return null;
  const min = level === 'normal' ? 4.5 : 3;
  return ratio >= min;
}

export function isValidColor(input) {
  return parseColor(input) !== null;
}

export { parseColor, hslToRgb, relativeLuminance };
