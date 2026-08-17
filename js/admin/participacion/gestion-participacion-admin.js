import { auth, db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, doc, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const SUPER_ADMIN = 'tintinaccs@gmail.com';
let user = null;
let reviews = [];
let likes = [];
let usersByUid = new Map();
let quickReplies = ['Gracias por compartir tu experiencia.', 'Nos alegra mucho que te haya gustado.', 'Gracias por avisarnos. Te escribiremos para ayudarte.'];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const asDate = value => value?.toDate?.() || (value ? new Date(value) : null);
const formatDate = value => {
  const date = asDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('es-PY') : 'Sin fecha';
};

async function api(input) {
  const token = await user.getIdToken();
  const response = await fetch('/api/admin-engagement', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo guardar el cambio');
  return result;
}

function avatarMarkup(ownerUid, fallbackName) {
  const record = usersByUid.get(String(ownerUid || ''));
  const initial = (String(record?.name || fallbackName || '?').trim()[0] || '?').toUpperCase();
  if (record?.photoURL) {
    return `<img class="adm-engagement-avatar" src="${escapeHtml(record.photoURL)}" alt="" loading="lazy" width="36" height="36">`;
  }
  return `<span class="adm-engagement-avatar adm-engagement-avatar-fallback" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

function viewProfile(ownerUid, email) {
  const record = usersByUid.get(String(ownerUid || ''));
  const query = record?.email || email || '';
  window.location.hash = '#usuarios';
  window.setTimeout(() => {
    const search = document.getElementById('user-search');
    if (!search) return;
    search.value = query;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.focus();
  }, 0);
}

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-view-profile]');
  if (!trigger) return;
  event.preventDefault();
  viewProfile(trigger.dataset.ownerUid, trigger.dataset.email);
});

function setBadge(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

function reviewCard(review) {
  const state = review.deleted ? 'Eliminada' : review.visible ? 'Visible' : 'Oculta';
  const history = Array.isArray(review.history) ? review.history : [];
  const conversation = Array.isArray(review.conversation) ? review.conversation : [];
  return `<article class="adm-engagement-card" data-review-id="${escapeHtml(review.reviewId)}">
    <div class="adm-engagement-head">${avatarMarkup(review.ownerUid, review.realName)}<div><strong>${escapeHtml(review.realName || 'Sin nombre')}</strong><div class="adm-engagement-meta">${escapeHtml(review.email)} · ${escapeHtml(review.productName)} · ${formatDate(review.createdAt)}</div></div><span class="adm-engagement-state">${state}${review.unread ? ' · Nueva' : ''}</span></div>
    <div><strong>${'&#9733;'.repeat(Number(review.rating) || 0)}</strong> <span class="adm-engagement-meta">${review.rating}/5</span></div>
    <p class="adm-engagement-comment">${escapeHtml(review.comment)}</p>
    ${review.editCount ? `<div class="adm-engagement-history">Editada por la clienta. Versi&oacute;n anterior: ${escapeHtml(review.originalComment || history.find(item => item.action === 'customer_edit')?.comment || 'registrada en historial')}.</div>` : ''}
    ${conversation.length ? `<div class="adm-engagement-conversation">${conversation.map(item => `<div><strong>${item.authorType === 'store' ? 'Tintin Accesorios' : escapeHtml(review.realName || 'Clienta')}:</strong> ${escapeHtml(item.text)} <span class="adm-engagement-meta">${formatDate(item.createdAt)}</span></div>`).join('')}</div>` : ''}
    <div class="adm-engagement-links">
      <a class="adm-btn adm-btn-sm adm-btn-outline" href="/product?id=${encodeURIComponent(review.productId)}#review-${encodeURIComponent(review.reviewId)}" target="_blank" rel="noopener">Ver publicaci&oacute;n</a>
      <button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-view-profile data-owner-uid="${escapeHtml(review.ownerUid || '')}" data-email="${escapeHtml(review.email || '')}">Ver perfil</button>
    </div>
    <div class="adm-engagement-actions">
      ${review.deleted ? '<button class="adm-btn adm-btn-sm" data-action="reviewRestore">Restaurar</button>' : `<button class="adm-btn adm-btn-sm" data-action="reviewVisibility" data-visible="${!review.visible}">${review.visible ? 'Ocultar' : 'Publicar'}</button><button class="adm-btn adm-btn-sm" data-action="reviewLike" data-liked="${!review.storeLiked}">${review.storeLiked ? 'Quitar Me gusta' : 'Me gusta'}</button><button class="adm-btn adm-btn-sm" data-action="reviewEdit">Editar</button><button class="adm-btn adm-btn-sm adm-btn-danger" data-action="reviewDelete">Eliminar</button>`}
    </div>
    ${review.deleted ? '' : `<div class="adm-engagement-reply"><input class="adm-input" data-reply-input placeholder="Responder como Tintin Accesorios"><select class="adm-select" data-quick><option value="">Respuesta r&aacute;pida</option>${quickReplies.map(text => `<option value="${escapeHtml(text)}">${escapeHtml(text)}</option>`).join('')}</select><button class="adm-btn adm-btn-primary adm-btn-sm" data-action="reviewReply">Responder</button></div>`}
  </article>`;
}

function renderReviews() {
  const root = document.getElementById('reviews-admin-list');
  if (!root) return;
  const term = (document.getElementById('reviews-search')?.value || '').toLowerCase();
  const filter = document.getElementById('reviews-filter')?.value || 'all';
  const visible = reviews.filter(review => {
    if (filter === 'visible' && (!review.visible || review.deleted)) return false;
    if (filter === 'hidden' && (review.visible || review.deleted)) return false;
    if (filter === 'deleted' && !review.deleted) return false;
    return !term || [review.realName, review.email, review.productName, review.comment].some(value => String(value || '').toLowerCase().includes(term));
  });
  root.innerHTML = visible.length ? visible.map(reviewCard).join('') : '<p class="adm-engagement-empty">No hay rese&ntilde;as para este filtro.</p>';
}

function likeCard(item) {
  return `<article class="adm-engagement-card" data-like-id="${escapeHtml(item.likeId)}">
    <div class="adm-engagement-head">${avatarMarkup(item.ownerUid, item.realName)}<div><strong>${escapeHtml(item.realName || 'Sin nombre')}</strong><div class="adm-engagement-meta">${escapeHtml(item.email)} · ${formatDate(item.createdAt)}</div></div>${item.unread ? '<span class="adm-engagement-state">Nuevo</span>' : ''}</div>
    <div><strong>${escapeHtml(item.productName)}</strong></div>
    <div class="adm-engagement-links">
      <a class="adm-btn adm-btn-sm adm-btn-outline" href="/product?id=${encodeURIComponent(item.productId)}" target="_blank" rel="noopener">Ver producto</a>
      <button type="button" class="adm-btn adm-btn-sm adm-btn-outline" data-view-profile data-owner-uid="${escapeHtml(item.ownerUid || '')}" data-email="${escapeHtml(item.email || '')}">Ver perfil</button>
      <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-action="likeDelete">Eliminar</button>
    </div>
  </article>`;
}

function renderLikes() {
  const root = document.getElementById('likes-admin-list');
  if (!root) return;
  const term = (document.getElementById('likes-search')?.value || '').toLowerCase();
  const filtered = likes.filter(item => !term || [item.realName, item.email, item.productName].some(value => String(value || '').toLowerCase().includes(term)));
  root.innerHTML = filtered.length ? filtered.map(likeCard).join('') : '<p class="adm-engagement-empty">No hay productos marcados con Me gusta.</p>';
}

document.getElementById('likes-admin-list')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-action="likeDelete"]');
  if (!button) return;
  const card = button.closest('[data-like-id]');
  const item = likes.find(entry => entry.likeId === card?.dataset.likeId);
  if (!item) return;
  if (!confirm('¿Eliminar este Me gusta? Se quitará también de los favoritos de la clienta.')) return;
  button.disabled = true;
  try { await api({ action: 'likeDelete', likeId: item.likeId }); } catch (error) { alert(error.message); } finally { button.disabled = false; }
});

async function markCurrentSeen(type) {
  const items = (type === 'reviews' ? reviews : likes).filter(item => item.unread).slice(0, 50);
  await Promise.allSettled(items.map(item => api(type === 'reviews' ? { action: 'reviewSeen', reviewId: item.reviewId } : { action: 'likeSeen', likeId: item.likeId })));
}

document.getElementById('reviews-admin-list')?.addEventListener('change', event => {
  if (event.target.matches('[data-quick]')) event.target.closest('article').querySelector('[data-reply-input]').value = event.target.value;
});
document.getElementById('reviews-admin-list')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const card = button.closest('[data-review-id]');
  const review = reviews.find(item => item.reviewId === card?.dataset.reviewId);
  if (!review) return;
  const input = { action: button.dataset.action, reviewId: review.reviewId };
  if (input.action === 'reviewVisibility') input.visible = button.dataset.visible === 'true';
  if (input.action === 'reviewLike') input.liked = button.dataset.liked === 'true';
  if (input.action === 'reviewReply') input.text = card.querySelector('[data-reply-input]').value.trim();
  if (input.action === 'reviewEdit') {
    const comment = prompt('Comentario corregido:', review.comment);
    if (comment === null) return;
    const rating = prompt('Puntuaci\u00f3n de 1 a 5:', String(review.rating));
    if (rating === null) return;
    input.comment = comment; input.rating = Number(rating);
  }
  if (input.action === 'reviewDelete' && !confirm('¿Eliminar esta rese\u00f1a? Podr\u00e1s restaurarla desde el filtro Eliminadas.')) return;
  button.disabled = true;
  try { await api(input); } catch (error) { alert(error.message); } finally { button.disabled = false; }
});

['reviews-search','reviews-filter'].forEach(id => document.getElementById(id)?.addEventListener('input', renderReviews));
document.getElementById('likes-search')?.addEventListener('input', renderLikes);
document.querySelectorAll('[data-section="resenas"]').forEach(button => button.addEventListener('click', () => markCurrentSeen('reviews')));
document.querySelectorAll('[data-section="me-gusta"]').forEach(button => button.addEventListener('click', () => markCurrentSeen('likes')));
document.getElementById('save-review-quick-replies')?.addEventListener('click', async () => {
  quickReplies = document.getElementById('review-quick-replies').value.split('\n').map(value => value.trim().slice(0, 240)).filter(Boolean).slice(0, 20);
  await setDoc(doc(db, 'settings', 'reviewQuickReplies'), { items: quickReplies }, { merge: true });
  renderReviews();
});

onAuthStateChanged(auth, async current => {
  if (current?.email?.toLowerCase() !== SUPER_ADMIN) return;
  user = current;
  await appCheckReady;
  onSnapshot(collection(db, 'users'), snapshot => {
    usersByUid = new Map(snapshot.docs.map(item => [item.id, item.data()]));
    renderReviews();
    renderLikes();
  });
  onSnapshot(collection(db, 'reviewRecords'), snapshot => {
    reviews = snapshot.docs.map(item => item.data()).sort((a,b) => asDate(b.createdAt) - asDate(a.createdAt));
    setBadge('reviews-unread-badge', reviews.filter(item => item.unread).length);
    renderReviews();
  });
  onSnapshot(collection(db, 'likeRecords'), snapshot => {
    likes = snapshot.docs.map(item => item.data()).sort((a,b) => asDate(b.createdAt) - asDate(a.createdAt));
    setBadge('likes-unread-badge', likes.filter(item => item.unread).length);
    renderLikes();
  });
  onSnapshot(doc(db, 'settings', 'reviewQuickReplies'), snapshot => {
    if (Array.isArray(snapshot.data()?.items)) quickReplies = snapshot.data().items;
    const field = document.getElementById('review-quick-replies');
    if (field && document.activeElement !== field) field.value = quickReplies.join('\n');
    renderReviews();
  });
});
