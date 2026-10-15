/* Superficies de página completas: una sola secuencia incluso entre wrappers. */
(() => {
  'use strict';
  const selector = 'body > section:not([role="dialog"]), main > section:not([role="dialog"]), [role="main"] > section:not([role="dialog"]), .cat-wrap > section, .cat-layout, .tt-footer, .tt-visual-block, .login-page, .ck-body, .perfil-wrap, .tt-404-wrap, .adm-content > .adm-section';
  let queued = false;
  const measured = new WeakSet();
  const appliedStyles = new WeakMap();
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  const set = (node, property, value, priority = '') => {
    if (node.style.getPropertyValue(property) !== value || node.style.getPropertyPriority(property) !== priority) node.style.setProperty(property, value, priority);
  };
  function blocks() {
    const visible = node => {
      if (node.closest('.perfil-wrap') && !node.matches('.perfil-wrap')) return false;
      if (node.closest('[role="dialog"], [aria-modal="true"], .tt-privacy-consent, .tt-drawer, .adm-sidebar')) return false;
      if (node.hidden || node.closest('[hidden]')) return false;
      const style = getComputedStyle(node);
      return !['fixed', 'sticky'].includes(style.position) && style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().height > 0;
    };
    const primary = [...document.querySelectorAll(selector)].filter(visible);
    const fallbacks = [...document.querySelectorAll('main')].filter(node => visible(node) && !primary.some(child => node !== child && node.contains(child)));
    const candidates = [...new Set([...primary, ...fallbacks])];
    const list = candidates.filter(node => !node.matches('main, .perfil-wrap, .login-page, .ck-body, .tt-404-wrap') || !candidates.some(child => node !== child && node.contains(child)));
    return list.filter(node => !list.some(parent => parent !== node && parent.contains(node))).sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  }
  function refresh() {
    queued = false;
    const list = blocks();
    // Completar las lecturas antes de escribir estilos: evita un layout por sección.
    const rects = list.map(node => node.getBoundingClientRect());
    const positions = list.map(node => getComputedStyle(node).position);
    const width = document.documentElement.clientWidth;
    list.forEach((node, index) => {
      node.dataset.ttFlowBlock = index % 2 ? 'pink' : 'light';
      const rect = rects[index];
      const before = index ? Math.max(0, Math.min(256, rect.top - rects[index - 1].bottom)) / 2 : 0;
      const after = index < list.length - 1 ? Math.max(0, Math.min(256, rects[index + 1].top - rect.bottom)) / 2 : 0;
      set(node, '--tt-section-background', index % 2 ? 'var(--tt-flow-pink)' : 'var(--tt-flow-light)');
      set(node, '--tt-section-start', index ? 'var(--tt-flow-join)' : 'var(--tt-section-background)');
      set(node, '--tt-section-end', index < list.length - 1 ? 'var(--tt-flow-join)' : 'var(--tt-section-background)');
      set(node, '--tt-flow-before', `${before}px`);
      set(node, '--tt-flow-after', `${after}px`);
      set(node, '--tt-flow-left', `${-rect.left}px`);
      set(node, '--tt-flow-width', `${width}px`);
      set(node, 'background', 'none', 'important');
      set(node, 'border-radius', '0px', 'important');
      set(node, 'box-shadow', 'none', 'important');
      set(node, 'border', '0px none', 'important');
      if (positions[index] === 'static') set(node, 'position', 'relative');
      let layer = [...node.children].find(child => child.hasAttribute('data-tt-flow-background'));
      if (!layer) {
        layer = document.createElement('div');
        layer.dataset.ttFlowBackground = '';
        layer.setAttribute('aria-hidden', 'true');
        node.prepend(layer);
      }
      appliedStyles.set(node, node.getAttribute('style'));
      if (!measured.has(node)) { measured.add(node); resize?.observe(node); }
    });
    document.querySelectorAll('[data-tt-flow-block]').forEach(node => {
      if (list.includes(node)) return;
      delete node.dataset.ttFlowBlock;
      [...node.children].find(child => child.hasAttribute('data-tt-flow-background'))?.remove();
    });
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }
  function start() {
    refresh();
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList'
        ? [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && !node.hasAttribute('data-tt-flow-background'))
        : !(record.attributeName === 'style' && appliedStyles.get(record.target) === record.target.getAttribute('style'))
          && record.target.matches(`${selector}, body, main, .cat-wrap`))) schedule();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    window.addEventListener('resize', schedule, { passive: true });
    window.TintinSectionFlow = Object.freeze({ refresh: schedule });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
