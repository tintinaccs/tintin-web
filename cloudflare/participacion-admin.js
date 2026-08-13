import {
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminMerge,
} from './firebase-admin-ligero.js';
import {
  engagementClean as clean,
  engagementDecoded as decoded,
  engagementReviewPublic as reviewPublic,
  engagementSafeId as safeId,
  engagementUpdateReviewStats as updateReviewStats,
} from './participacion-clientes.js';

const MAX_COMMENT = 1600;
const MAX_REPLY = 1200;

function mapping(record) {
  return {
    schemaVersion: 1,
    reviewId: record.reviewId,
    productId: record.productId,
    productName: record.productName,
    rating: record.rating,
    comment: record.comment,
    editCount: record.editCount,
    visible: Boolean(record.visible),
    deleted: Boolean(record.deleted),
    conversation: record.conversation || [],
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

async function loadReview(env, reviewId) {
  const id = safeId(reviewId, 'Reseña');
  const document = await firestoreAdminGet(env, `reviewRecords/${id}`);
  const record = decoded(document);
  if (!record) throw new Error('No se encontró la reseña');
  return { id, document, record };
}

async function saveReview(env, document, record) {
  const writes = [
    {
      path: `reviewRecords/${record.reviewId}`,
      fields: encodeFirestoreFields(record),
      currentDocument: { updateTime: document.updateTime },
    },
    {
      path: `users/${safeId(record.ownerUid, 'Cuenta')}/reviews/${safeId(record.productId, 'Producto')}`,
      fields: encodeFirestoreFields(mapping(record)),
    },
  ];
  const publicPath = `products/${safeId(record.productId, 'Producto')}/reviews/${record.reviewId}`;
  if (record.visible && !record.deleted) writes.push({ path: publicPath, fields: encodeFirestoreFields(reviewPublic(record)) });
  else writes.push({ path: publicPath, delete: true });
  await firestoreAdminCommit(env, writes);
  await updateReviewStats(env, record.productId);
  return record;
}

export async function adminReviewAction(env, actor, input) {
  const { document, record } = await loadReview(env, input.reviewId);
  const now = new Date();
  const action = clean(input.action, 60);
  const history = [...(record.history || [])];
  let updated = { ...record, updatedAt: now, lastAdminEmail: actor.email };

  if (action === 'reviewVisibility') {
    updated.visible = Boolean(input.visible);
    updated.deleted = false;
    history.push({ action: updated.visible ? 'published' : 'hidden', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewLike') {
    updated.storeLiked = Boolean(input.liked);
    history.push({ action: updated.storeLiked ? 'store_liked' : 'store_unliked', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewReply') {
    const text = clean(input.text, MAX_REPLY);
    if (!text) throw new Error('La respuesta está vacía');
    updated.conversation = [...(record.conversation || []), {
      id: crypto.randomUUID(), authorType: 'store', actorUid: actor.uid,
      actorEmail: actor.email, text, createdAt: now,
    }].slice(-50);
    history.push({ action: 'store_reply', text, changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewEdit') {
    const rating = Number(input.rating);
    const comment = clean(input.comment, MAX_COMMENT);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('La puntuación debe estar entre 1 y 5');
    if (comment.length < 3) throw new Error('El comentario es demasiado corto');
    history.push({ action: 'admin_edit', rating: record.rating, comment: record.comment, changedAt: now, changedBy: actor.email });
    updated.rating = rating;
    updated.comment = comment;
  } else if (action === 'reviewDelete') {
    updated.deleted = true;
    updated.visible = false;
    history.push({ action: 'deleted', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewRestore') {
    updated.deleted = false;
    updated.visible = true;
    history.push({ action: 'restored', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewSeen') {
    updated.unread = false;
  } else {
    throw new Error('Acción de reseña no permitida');
  }
  updated.history = history.slice(-50);
  return saveReview(env, document, updated);
}

export async function markLikeSeen(env, likeId) {
  const id = safeId(likeId, 'Me gusta');
  const document = await firestoreAdminGet(env, `likeRecords/${id}`);
  if (!document) return null;
  const updated = { ...decoded(document), unread: false, updatedAt: new Date() };
  await firestoreAdminMerge(env, `likeRecords/${id}`, encodeFirestoreFields({ unread: false, updatedAt: updated.updatedAt }));
  return updated;
}
