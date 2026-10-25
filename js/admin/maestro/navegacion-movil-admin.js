const mobileTabs = document.getElementById('adm-mobile-tabs');
// Safari cambia el viewport visible al desplazar sus barras o abrir el teclado.
// Mantener la navegación en su borde inferior, sin depender de un alto anterior.
let viewportFrame;
function syncMobileViewport() {
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty('--tt-admin-viewport-bottom', `${viewport ? viewport.offsetTop + viewport.height : innerHeight}px`);
  });
}
window.visualViewport?.addEventListener('resize', syncMobileViewport, {passive:true});
window.visualViewport?.addEventListener('scroll', syncMobileViewport, {passive:true});
window.addEventListener('resize', syncMobileViewport, {passive:true});
window.addEventListener('pageshow', syncMobileViewport);
syncMobileViewport();
const mobileMoreToggle = document.getElementById('adm-mobile-more-toggle');
const mobileMoreSheet = document.getElementById('adm-mobile-more-sheet');
const mobileMoreBackdrop = document.getElementById('adm-mobile-more-backdrop');
const mobileMoreClose = document.getElementById('adm-mobile-more-close');
const mobileMoreGrid = document.getElementById('adm-mobile-more-grid');

function moveSecondaryMobileTab(node) {
  if (!(node instanceof Element) || !node.matches('.adm-mobile-tab')) return;
  if (node.hasAttribute('data-mobile-primary') || node === mobileMoreToggle) return;
  mobileMoreGrid?.appendChild(node);
}

if (mobileTabs && mobileMoreGrid) {
  [...mobileTabs.querySelectorAll('.adm-mobile-tab')].forEach(moveSecondaryMobileTab);
  new MutationObserver(records => {
    records.flatMap(record => [...record.addedNodes]).forEach(moveSecondaryMobileTab);
  }).observe(mobileTabs, { childList: true });
}

function setMobileMore(open, restoreFocus = false) {
  if (!mobileMoreToggle || !mobileMoreSheet || !mobileMoreBackdrop) return;
  if (open && (!matchMedia('(max-width: 540px)').matches || !document.documentElement.classList.contains('adm-auth-ready'))) return;
  mobileMoreSheet.hidden = !open;
  mobileMoreBackdrop.hidden = !open;
  mobileMoreToggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('adm-mobile-more-open', open);
  if (open) {
    lockBackground();
    mobileMoreClose?.focus({ preventScroll: true });
  } else {
    unlockBackground();
    if (restoreFocus) mobileMoreToggle.focus({ preventScroll: true });
  }
}

export function closeMobileMore(restoreFocus = false) {
  setMobileMore(false, restoreFocus);
}

mobileMoreToggle?.addEventListener('click', () => {
  setMobileMore(mobileMoreToggle.getAttribute('aria-expanded') !== 'true');
});
mobileMoreClose?.addEventListener('click', () => closeMobileMore(true));
mobileMoreBackdrop?.addEventListener('click', () => closeMobileMore(true));
// Antes de la guardia de enlaces (captura en document): cerrar y liberar
// el fondo incluso si la guardia detiene la navegación a Imágenes.
window.addEventListener('click', event => {
  if (event.target instanceof Element && event.target.closest('#adm-mobile-more-grid .adm-mobile-tab')) closeMobileMore(true);
}, true);
const inertState = new Map();
// El sidebar conserva su propia autoridad inert según el breakpoint.
function lockBackground() {
  if (inertState.size) return;
  for (const node of document.querySelectorAll('.adm-main,#adm-mobile-tabs')) {
    inertState.set(node, node.inert);
    node.inert = true;
  }
}
function unlockBackground() {
  for (const [node, inert] of inertState) node.inert = inert;
  inertState.clear();
}

// Captura antes del sidebar: Escape pertenece al diálogo que está abierto.
window.addEventListener('keydown', event => {
  if (mobileMoreSheet?.hidden !== false) return;
  if (event.key === 'Tab') {
    const items = [...mobileMoreSheet.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !mobileMoreSheet.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !mobileMoreSheet.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }
  if (event.key === 'Escape' && mobileMoreToggle?.getAttribute('aria-expanded') === 'true') {
    event.preventDefault();
    event.stopPropagation();
    closeMobileMore(true);
  }
}, true);


// La rotación no debe dejar el escritorio bloqueado por un menú móvil oculto.
matchMedia('(max-width: 540px)').addEventListener('change', event => {
  if (!event.matches) closeMobileMore();
});
new MutationObserver(() => {
  if (!document.documentElement.classList.contains('adm-auth-ready')) closeMobileMore();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
