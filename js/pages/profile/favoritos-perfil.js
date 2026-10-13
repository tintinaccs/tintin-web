import { onAppCheckSnapshot as onSnapshot } from '../../core/firebase/suscripcion-app-check.js?v=tintin-20261012-client-recovery-1-domain-prepared-20261012-6-security-ready-20261013-1';
import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20261012-auth-privacy-1-firebase-js-domain-prepared-20261012-6-security-ready-20261013-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20261012-auth-privacy-1-coordinador-sesion-js-domain-prepared-20261012-6-security-ready-20261013-1';
import { collection} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { fetchPublicCatalogResource } from '../../core/firebase/catalogo-publico-api.js?v=tintin-20260814-edge-catalog-1-first-render-merge-20261010-1';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const money = value => `Gs. ${Math.round(Number(value) || 0).toLocaleString('es-PY')}`;

export function resolveFavoriteProducts(items, products) {
  const current = new Map(products.map(product => [String(product.id), product.data]));
  return items.map(item => {
    const product = current.get(String(item.productId));
    const price = product?.price;
    return { ...item, name: product?.name || item.name, imageUrl: product?.imageUrl || item.imageUrl,
      price: price != null && price !== '' && Number.isFinite(Number(price)) && Number(price) > 0 ? Number(price) : null };
  });
}

function render(items) {
  const root = document.getElementById('perfil-favorites-list');
  if (!root) return;
  if (!items.length) {
    root.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px 0;font-size:13px">Todav&iacute;a no guardaste productos. Toc&aacute; el coraz&oacute;n de un producto para verlo ac&aacute;.</div>';
    return;
  }
  root.innerHTML = items.map(item => `<article style="display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
    <img src="${escapeHtml(item.imageUrl || 'assets-tintin/images/placeholder-producto.webp')}" alt="" width="64" height="64" style="width:64px;height:64px;object-fit:cover;border-radius:6px">
    <div><a href="/product?id=${encodeURIComponent(item.productId)}" style="font-weight:800;color:var(--text);text-decoration:none">${escapeHtml(item.name || 'Producto')}</a><div style="font-size:12px;color:var(--color-text-primary,#713C53);margin-top:4px">${item.price == null ? 'Consultá precio y disponibilidad' : money(item.price)}</div></div>
    <button type="button" class="perfil-btn perfil-btn-danger" data-remove-favorite="${escapeHtml(item.productId)}" aria-label="Quitar ${escapeHtml(item.name || 'producto')} de favoritos">Quitar</button>
  </article>`).join('');
}

function renderError() {
  const root = document.getElementById('perfil-favorites-list');
  if (!root) return;
  root.innerHTML = `<div class="tt-profile-state" role="alert">No pudimos sincronizar tus favoritos.<br><button type="button" class="perfil-btn perfil-btn-outline" id="btn-reintentar-favoritos">Reintentar</button></div>`;
  document.getElementById('btn-reintentar-favoritos')?.addEventListener('click', () => window.location.reload());
}

document.getElementById('perfil-favorites-list')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-remove-favorite]');
  if (!button) return;
  button.disabled = true;
  try {
    const result = await window.TintinFavorites?.toggle(button.dataset.removeFavorite);
    if (result == null) throw new Error('No se pudo actualizar');
  } catch (error) {
    button.disabled = false;
    alert(error.message || 'No se pudo quitar el favorito');
  }
});

let unsubscribe = null;
let generation = 0;

subscribeAuthState(async user => {
  const myGeneration = ++generation;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  const root = document.getElementById('perfil-favorites-list');
  if (root) root.innerHTML = user ? '<div class="tt-profile-state" role="status">Sincronizando favoritos…</div>' : '';
  if (!user) return;
  await appCheckReady;
  if (myGeneration !== generation) return;
  let revision = 0;
  unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'favorites'), async snapshot => {
    if (myGeneration !== generation) return;
    const myRevision = ++revision;
    const items = snapshot.docs.map(item => ({ productId: item.id, ...item.data() }));
    let products = [];
    try { if (items.length) products = await fetchPublicCatalogResource('products'); } catch { /* Nunca mostrar un precio histórico como vigente. */ }
    if (myGeneration !== generation || myRevision !== revision) return;
    render(resolveFavoriteProducts(items, products).sort((a,b) => String(a.name).localeCompare(String(b.name), 'es')));
  }, () => { if (myGeneration === generation) renderError(); });
});
