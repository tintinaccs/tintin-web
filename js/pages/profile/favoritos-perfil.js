import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const money = value => `Gs. ${Math.round(Number(value) || 0).toLocaleString('es-PY')}`;

function render(items) {
  const root = document.getElementById('perfil-favorites-list');
  if (!root) return;
  if (!items.length) {
    root.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px 0;font-size:13px">Todav&iacute;a no guardaste productos. Toc&aacute; el coraz&oacute;n de un producto para verlo ac&aacute;.</div>';
    return;
  }
  root.innerHTML = items.map(item => `<article style="display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
    <img src="${escapeHtml(item.imageUrl || 'assets-tintin/images/placeholder-producto.webp')}" alt="" width="64" height="64" style="width:64px;height:64px;object-fit:cover;border-radius:6px">
    <div><a href="/product?id=${encodeURIComponent(item.productId)}" style="font-weight:800;color:var(--text);text-decoration:none">${escapeHtml(item.name || 'Producto')}</a><div style="font-size:12px;color:var(--pink-dark);margin-top:4px">${money(item.price)}</div></div>
    <button type="button" class="perfil-btn perfil-btn-danger" data-remove-favorite="${escapeHtml(item.productId)}" aria-label="Quitar ${escapeHtml(item.name || 'producto')} de favoritos">Quitar</button>
  </article>`).join('');
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

onAuthStateChanged(auth, async user => {
  if (!user) return;
  await appCheckReady;
  onSnapshot(collection(db, 'users', user.uid, 'favorites'), snapshot => {
    render(snapshot.docs.map(item => item.data()).sort((a,b) => String(a.name).localeCompare(String(b.name), 'es')));
  }, () => render([]));
});
