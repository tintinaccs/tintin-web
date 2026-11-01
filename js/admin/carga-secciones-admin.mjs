// La navegación decide el acceso antes de llamar a este cargador. Volver a
// comprobarlo tras la descarga evita inicializar una sección si cambió sesión.
export function createAdminSectionLoader({ sections, canLoad, document }) {
  const pending = new Map();
  const ready = new Set();
  return async function loadSection(name) {
    if (!sections[name] || !canLoad(name)) return false;
    if (ready.has(name)) return true;
    if (pending.has(name)) return pending.get(name);
    const section = document.getElementById(`section-${name}`);
    section?.querySelector('.adm-module-loading')?.remove();
    const controls = [...(section?.children || [])].map(node => [node, node.inert]);
    controls.forEach(([node]) => { node.inert = true; });
    const status = document.createElement('div');
    status.className = 'adm-module-loading';
    status.setAttribute('role', 'status');
    status.textContent = 'Cargando sección…';
    section?.prepend(status);
    section?.setAttribute('aria-busy', 'true');
    const task = (async () => {
      try {
        const module = await Promise.resolve().then(() => sections[name].load());
        if (!canLoad(name)) return false;
        await sections[name].init?.(module);
        ready.add(name);
        return true;
      } catch (error) {
        status.textContent = 'No se pudo cargar esta sección. ';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'adm-btn adm-btn-outline';
        retry.textContent = 'Reintentar';
        retry.addEventListener('click', () => { status.remove(); void loadSection(name); }, { once: true });
        status.append(retry);
        console.error('[Admin] No se pudo cargar la sección:', name, error);
        return false;
      } finally {
        pending.delete(name);
        section?.removeAttribute('aria-busy');
        controls.forEach(([node, inert]) => { node.inert = inert; });
        if (ready.has(name) || !canLoad(name)) status.remove();
      }
    })();
    pending.set(name, task);
    return task;
  };
}
