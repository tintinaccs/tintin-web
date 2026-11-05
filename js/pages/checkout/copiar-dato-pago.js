// Botón "Copiar" de los datos de pago del checkout.
// extraerDatoParaCopiar decide qué texto se copia: si el dato trae una línea
// "Alias ...: valor" se copia solo el valor (lo que se pega en la app del banco);
// si no, se copia el texto completo tal como lo configuró la tienda.
export function extraerDatoParaCopiar(value) {
  const text = String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
  const line = text.split('\n').find(item => /^\s*alias[^:]*:\s*\S/i.test(item));
  if (!line) return text;
  let alias = line.slice(line.indexOf(':') + 1).trim();
  const note = alias.match(/\(([^)]*)\)\s*$/);
  if (note) {
    alias = alias.slice(0, note.index).trim();
    // "(Sin Guión)": el alias real se escribe sin guiones ni espacios.
    if (/sin\s+gui[oó]n/i.test(note[1])) alias = alias.replace(/[-\s]/g, '');
  }
  return alias || text;
}

export async function copiarTexto(text, doc = document, nav = navigator) {
  const value = String(text == null ? '' : text);
  if (!value) return false;
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Sin permiso del portapapeles: se intenta el método clásico.
  }
  const area = doc.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
  doc.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, value.length);
  let ok = false;
  try { ok = doc.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
}
