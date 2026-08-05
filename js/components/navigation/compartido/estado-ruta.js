export function currentPage(pathname = window.location.pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const file = (parts.pop() || 'index').toLowerCase().replace(/\.html$/, '');
  if (!file || file === 'index' || file === 'tintin-web') return 'home';
  if (file === 'about' || file === 'nosotros') return 'about';
  if (file === 'contact') return 'contact';
  if (['catalogo', 'collections', 'product'].includes(file)) return 'shop';
  if (file === 'checkout') return 'cart';
  if (['login', 'perfil'].includes(file)) return 'account';
  return 'other';
}

function setCurrentState(control, active) {
  if (!control) return;
  control.classList.toggle('active', active);
  if (active) control.setAttribute('aria-current', 'page');
  else control.removeAttribute('aria-current');
}

export function applyActiveState(root = document) {
  const page = currentPage();

  root.querySelectorAll('[data-shell-route]').forEach(control => {
    setCurrentState(control, control.dataset.shellRoute === page);
  });

  setCurrentState(root.getElementById('btn-tienda'), page === 'shop');
  setCurrentState(root.getElementById('btn-tablet-tienda'), page === 'shop');

  [
    ['btn-cart', 'cart'],
    ['btn-cart-tablet', 'cart'],
    ['btn-cuenta', 'account'],
    ['btn-cuenta-tablet', 'account'],
  ].forEach(([id, route]) => setCurrentState(root.getElementById(id), page === route));

  root.querySelectorAll('[data-shell-tab]').forEach(control => {
    setCurrentState(control, control.dataset.shellTab === page);
  });
}
