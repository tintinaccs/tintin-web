// Misma comparación textual para consultas y datos; no altera sus valores.
export function normalizeAdminSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

// El input permanece estable; sólo se difiere el trabajo de la lista.
export function debounceAdminSearch(callback, delay = 120) {
  let timer;
  const schedule = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; callback(...args); }, delay);
  };
  schedule.cancel = () => { clearTimeout(timer); timer = undefined; };
  return schedule;
}

// Mantiene conectado el input activo: reemplazarlo con innerHTML interrumpe
// composición, cursor y teclado móvil, incluso si luego se restaura el foco.
export function renderAdminSearchMarkup(root, markup, selector = 'input[type="search"][data-filter]') {
  const active = document.activeElement;
  if (!root.contains(active) || !active.matches(selector)) {
    root.innerHTML = markup;
    return;
  }
  const template = document.createElement('template');
  template.innerHTML = markup;
  const next = template.content.querySelector(selector);
  if (!next) { root.innerHTML = markup; return; }
  const path = (node, end) => { const result = []; for (; node !== end; node = node.parentNode) result.push(node); return result; };
  const currentPath = path(active, root), nextPath = path(next, template.content);
  if (currentPath.length !== nextPath.length) { root.innerHTML = markup; return; }
  for (let index = 1; index <= currentPath.length; index++) {
    const parent = currentPath[index] || root, child = currentPath[index - 1];
    const nextParent = nextPath[index] || template.content, nextChild = nextPath[index - 1];
    const siblings = [...nextParent.childNodes], at = siblings.indexOf(nextChild);
    for (const sibling of [...parent.childNodes]) if (sibling !== child) sibling.remove();
    child.before(...siblings.slice(0, at));
    child.after(...siblings.slice(at + 1));
    if (parent !== root) {
      for (const attribute of [...parent.attributes]) if (!nextParent.hasAttribute(attribute.name)) parent.removeAttribute(attribute.name);
      for (const attribute of nextParent.attributes) parent.setAttribute(attribute.name, attribute.value);
    }
  }
}

