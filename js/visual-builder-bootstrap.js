import { detectContentPageId } from './core/store/esquema-contenido.js?v=tintin-20260815-routes-clean-1';
import { initVisualBuilderRuntime } from './core/store/editor-visual-runtime.js?v=tintin-20260815-routes-clean-1';

const VISUAL_SETTLE_CEILING_MS = 3500;

function responsiveOverridesAreInherited(root) {
  return ['desktop', 'tablet', 'mobile'].every(device => {
    const prefix = `ttVisual${device[0].toUpperCase()}${device.slice(1)}`;
    return root.dataset[`${prefix}Visibility`] === 'inherit'
      && root.dataset[`${prefix}Spacing`] === 'inherit'
      && root.dataset[`${prefix}Width`] === 'inherit'
      && root.dataset[`${prefix}Align`] === 'inherit'
      && root.dataset[`${prefix}Columns`] === 'inherit'
      && root.dataset[`${prefix}ImageFit`] === 'inherit';
  });
}

function isUntouchedLegacySectionStyle(root) {
  return root.dataset.ttVisualSpacing === 'normal'
    && root.dataset.ttVisualWidth === 'contained'
    && root.dataset.ttVisualAlign === 'center'
    && root.dataset.ttVisualRadius === 'none'
    && root.dataset.ttVisualShadow === 'none'
    && root.dataset.ttVisualAnimation === 'none'
    && root.dataset.ttVisualVariant === 'default'
    && root.dataset.ttVisualImageFit === 'cover'
    && !root.style.getPropertyValue('--tt-visual-bg')
    && !root.style.getPropertyValue('--tt-visual-text')
    && !root.style.getPropertyValue('--tt-visual-accent')
    && responsiveOverridesAreInherited(root);
}

function restoreNativeGeometryForUntouchedSections() {
  document.querySelectorAll('[data-tt-visual-section].tt-visual-managed').forEach(root => {
    if (!isUntouchedLegacySectionStyle(root)) return;
    // Las configuraciones antiguas guardaban contained + center aunque nadie
    // hubiera editado la sección. Esos valores no deben reemplazar el layout
    // nativo del HTML/CSS de la página.
    root.removeAttribute('data-tt-visual-spacing');
    root.removeAttribute('data-tt-visual-width');
    root.removeAttribute('data-tt-visual-align');
    root.removeAttribute('data-tt-visual-image-fit');
  });
}

function visualBuilderIsSettled() {
  return ['ready', 'fallback'].includes(document.documentElement.dataset.ttVisualBuilder || '');
}

function waitForVisualBuilderSettlement() {
  if (visualBuilderIsSettled()) return Promise.resolve();
  return new Promise(resolve => {
    let finished = false;
    let timer = 0;
    const observer = new MutationObserver(() => {
      if (visualBuilderIsSettled()) finish();
    });
    const onReady = () => finish();

    function finish() {
      if (finished) return;
      finished = true;
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('tintin:visual-builder-ready', onReady);
      resolve();
    }

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-tt-visual-builder'],
    });
    window.addEventListener('tintin:visual-builder-ready', onReady);
    timer = window.setTimeout(finish, VISUAL_SETTLE_CEILING_MS);
  });
}

(async () => {
  const pageId = detectContentPageId();
  const loader = window.TintinLoader;
  let loaderWaitHeld = false;

  // contenido-sitio.js también puede iniciar el runtime antes que este
  // bootstrap. Escuchar el evento permite esperar esa inicialización ya en
  // curso en lugar de liberar el loader/guard demasiado pronto.
  window.addEventListener('tintin:visual-builder-ready', restoreNativeGeometryForUntouchedSections);
  const settlement = pageId ? waitForVisualBuilderSettlement() : Promise.resolve();

  if (pageId && loader?.beginWait) {
    loader.beginWait();
    loaderWaitHeld = true;
  }

  try {
    if (pageId) {
      await Promise.resolve(initVisualBuilderRuntime(pageId));
      await settlement;
      restoreNativeGeometryForUntouchedSections();
    }
  } catch (error) {
    console.warn('[VisualBuilder] No se pudo completar el arranque visual.', error);
    document.documentElement.dataset.ttVisualBuilder = 'fallback';
  } finally {
    document.documentElement.classList.remove('tt-vb-layout-pending');
    document.getElementById('tt-vb-layout-guard')?.remove();
    if (loaderWaitHeld) loader.endWait?.();
  }
})();
