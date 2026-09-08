import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';
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

onAuthStateChanged(auth, async user => {
  const myGeneration = ++generation;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (!user) return;
  await appCheckReady;
  if (myGeneration !== generation) return;
  unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'favorites'), snapshot => {
    if (myGeneration !== generation) return;
    render(snapshot.docs.map(item => item.data()).sort((a,b) => String(a.name).localeCompare(String(b.name), 'es')));
  }, () => { if (myGeneration === generation) renderError(); });
});
