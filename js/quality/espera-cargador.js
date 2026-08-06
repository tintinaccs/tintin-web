// Espera a que #tt-loader (pantalla de carga a pantalla completa,
// z-index:2147483000) termine de ocultarse antes de resolver. Sin esto,
// overlays bloqueantes como "tienda cerrada" o "cuenta bloqueada"
// (z-index:100000) que se disparan desde un listener en vivo de Firestore
// pueden insertarse en el DOM mientras el loader todavía está arriba,
// quedando invisibles y sin poder tocarse durante varios segundos en una
// conexión lenta. Mismo patrón (evento + MutationObserver + timeout de
// seguridad) que usa el runtime único de bienvenida para esperar el splash.
export function waitForLoaderHidden() {
  return new Promise(resolve => {
    const loader = document.getElementById('tt-loader');
    if (!loader || loader.classList.contains('tt-out')) { resolve(); return; }

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      document.removeEventListener('tintin:page-ready', finish);
      observer.disconnect();
      clearTimeout(timer);
    };

    document.addEventListener('tintin:page-ready', finish, { once: true });
    const observer = new MutationObserver(() => {
      const l = document.getElementById('tt-loader');
      if (!l || l.classList.contains('tt-out')) finish();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // Nunca bloquear un overlay real (tienda cerrada / cuenta bloqueada) más
    // de lo que el propio loader tardaría en su peor caso.
    const timer = setTimeout(finish, 4300);
  });
}
