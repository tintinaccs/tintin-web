import { detectContentPageId } from './core/store/esquema-contenido.js?v=tintin-20260815-routes-clean-1';
import { initVisualBuilderRuntime } from './core/store/editor-visual-runtime.js?v=tintin-20260815-routes-clean-1';

(async () => {
  const pageId = detectContentPageId();
  const loader = window.TintinLoader;
  let loaderWaitHeld = false;

  if (pageId && loader?.beginWait) {
    loader.beginWait();
    loaderWaitHeld = true;
  }

  try {
    if (pageId) await initVisualBuilderRuntime(pageId);
  } catch (error) {
    console.warn('[VisualBuilder] No se pudo completar el arranque visual.', error);
    document.documentElement.dataset.ttVisualBuilder = 'fallback';
  } finally {
    document.documentElement.classList.remove('tt-vb-layout-pending');
    document.getElementById('tt-vb-layout-guard')?.remove();
    if (loaderWaitHeld) loader.endWait?.();
  }
})();
