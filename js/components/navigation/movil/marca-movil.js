// La misma marca se renderiza antes de JavaScript y al montar el shell público.
export function renderMobileBrandHeader(pathname, logoSrc) {
  if (/(?:^|\/)(?:checkout|login|admin|admin-images)(?:\.html)?\/?$/i.test(pathname)) return '';
  return `<header id="tt-mobile-brand" class="tt-mobile-brand" data-brand-surface="pink" aria-label="Tintin">
  <a class="tt-mobile-brand-link" href="/" aria-label="Tintin, ir al inicio">
    <span class="tt-mobile-brand-art"><img class="tt-mobile-brand-logo" src="${logoSrc}" alt="Tintin" width="480" height="600" decoding="async"></span>
  </a>
  <svg class="tt-mobile-brand-filters" aria-hidden="true" width="0" height="0" focusable="false"><defs><filter id="tt-mobile-brand-tint" color-interpolation-filters="sRGB"><feFlood class="tt-mobile-brand-ink"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs></svg>
</header>`;
}

let stopPrevious = null;
export function initMobileBrandHeader() {
  stopPrevious?.();
  const header = document.getElementById('tt-mobile-brand');
  if (!header) return;
  let queued = 0;
  let target = null;
  const mobile = matchMedia('(max-width: 767px)');
  const visible = node => !node.closest('[hidden]') && node.getBoundingClientRect().height > 0;
  const observer = new MutationObserver(schedule);
  const update = () => {
    queued = 0;
    if (!mobile.matches) return;
    const next = [...document.querySelectorAll('[data-tt-flow-block]:not(.tt-footer)')].find(visible)
      || [...document.querySelectorAll('#hero,.tt-page-hero,.cat-wrap,.perfil-wrap,.tt-404-wrap,main')].find(visible);
    if (target !== next) {
      observer.disconnect();
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
      observer.observe(document.body, { childList: true });
      if (next) observer.observe(next, { attributes: true, childList: true, attributeFilter: ['style', 'class', 'hidden', 'data-tt-flow-block'] });
      target = next;
    }
    if (!target) return;
    const layer = [...target.children].find(node => node.hasAttribute('data-tt-flow-background'));
    const style = getComputedStyle(layer || target);
    let color = style.backgroundImage.match(/rgba?\([^)]*\)/)?.[0] || style.backgroundColor;
    let channels = color.match(/[\d.]+/g)?.map(Number) || [];
    if (!channels.length || channels[3] === 0) {
      color = 'rgb(253, 236, 242)';
      channels = [253, 236, 242];
    }
    const luminance = channels.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    header.dataset.brandSurface = luminance < .6 ? 'light' : 'pink';
    header.style.setProperty('--tt-mobile-brand-next', color);
  };
  function schedule() {
    if (!queued) queued = requestAnimationFrame(update);
  }
  mobile.addEventListener('change', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('tintin:global-layout-ready', schedule);
  window.addEventListener('tintin:global-visual-studio-ready', schedule);
  window.addEventListener('tintin:color-scheme-ready', schedule);
  update();
  stopPrevious = () => {
    observer.disconnect();
    cancelAnimationFrame(queued);
    mobile.removeEventListener('change', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('tintin:global-layout-ready', schedule);
    window.removeEventListener('tintin:global-visual-studio-ready', schedule);
    window.removeEventListener('tintin:color-scheme-ready', schedule);
  };
}
