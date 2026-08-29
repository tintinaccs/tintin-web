import {
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminList,
  firestoreAdminMerge,
  firestoreAdminReplace,
} from './firebase-admin-ligero.js';
import { buildUserNotificationWrite } from './notificaciones-sociales.js';
import {
  engagementClean as clean,
  engagementDecoded as decoded,
  engagementReviewPublic as reviewPublic,
  engagementSafeId as safeId,
  engagementUpdateReviewStats as updateReviewStats,
} from './participacion-clientes.js';

const MAX_COMMENT = 1600;
const MAX_REPLY = 1200;
const MAX_ADMIN_NOTE = 1600;
const MAX_ADMIN_TAGS = 8;

function mapping(record) {
  return {
    schemaVersion: 4,
    reviewId: record.reviewId,
    productId: record.productId,
    productName: record.productName,
    rating: record.rating,
    comment: record.comment,
    visible: Boolean(record.visible),
    deleted: Boolean(record.deleted),
    likeCount: Math.max(0, Number(record.likeCount) || 0),
    conversation: reviewPublic(record).conversation,
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

async function saveReview(env, document, record, extraWrites = []) {
  const writes = [
    {
      path: `reviewRecords/${record.reviewId}`,
      fields: encodeFirestoreFields(record),
      currentDocument: { updateTime: document.updateTime },
    },
    {
      path: `users/${safeId(record.ownerUid, 'Cuenta')}/reviews/${safeId(record.reviewId, 'Reseña')}`,
      fields: encodeFirestoreFields(mapping(record)),
    },
  ];
  const publicPath = `products/${safeId(record.productId, 'Producto')}/reviews/${record.reviewId}`;
  if (record.visible && !record.deleted) writes.push({ path: publicPath, fields: encodeFirestoreFields(reviewPublic(record)) });
  else writes.push({ path: publicPath, delete: true });
  writes.push(...extraWrites);
  await firestoreAdminCommit(env, writes);
  await updateReviewStats(env, record.productId);
  return record;
}

async function refreshProductLikeStats(env, productId) {
  if (!productId) return 0;
  const records = (await firestoreAdminList(env, 'likeRecords', 3000)).map(decoded).filter(Boolean);
  const count = records.filter(record =>
    record.productId === productId && record.archived !== true && (!record.targetType || record.targetType === 'product')
  ).length;
  await firestoreAdminReplace(env, `productEngagementStats/${safeId(productId, 'Producto')}`, encodeFirestoreFields({
    schemaVersion: 2,
    productId,
    likeCount: count,
    updatedAt: new Date(),
  }));
  return count;
}

const adminTags = input => {
  const raw = Array.isArray(input) ? input : [];
  const seen = new Set();
  const result = [];
  for (const value of raw) {
    const tag = clean(value, 48);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_ADMIN_TAGS) break;
  }
  return result;
};

export async function adminReviewAction(env, actor, input) {
  const { document, record } = await loadReview(env, input.reviewId);
  const now = new Date();
  const action = clean(input.action, 60);
  const history = [...(record.history || [])];
  const extraWrites = [];
  let updated = {
    ...record,
    schemaVersion: 4,
    likeCount: Math.max(0, Number(record.likeCount) || 0),
    updatedAt: now,
    lastAdminEmail: actor.email,
  };

  if (action === 'reviewVisibility') {
    updated.visible = Boolean(input.visible);
    updated.deleted = false;
    history.push({ action: updated.visible ? 'published' : 'hidden', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewLike') {
    updated.storeLiked = Boolean(input.liked);
    history.push({ action: updated.storeLiked ? 'store_liked' : 'store_unliked', changedAt: now, changedBy: actor.email });
    if (updated.storeLiked && record.ownerUid !== actor.uid) {
      const notification = await buildUserNotificationWrite(record.ownerUid, {
        kind: 'store_review_like', actorType: 'store', actorUid: actor.uid, actorName: 'Tintin Accesorios',
        title: 'A Tintin le gustó tu reseña',
        body: clean(record.comment, 420), snippet: clean(record.comment, 260), iconKey: 'heart',
        targetUrl: `/product?id=${record.productId}#review-${record.reviewId}`,
        targetType: 'review', targetId: record.reviewId,
        productId: record.productId, productName: record.productName, productImageUrl: record.productImageUrl,
        reviewId: record.reviewId, sourceType: 'review', sourceId: record.reviewId, createdAt: now,
      }, `store_review_like:${record.reviewId}`);
      extraWrites.push(notification.write);
    } else if (updated.storeLiked && record.ownerUid === actor.uid) {
      const notification = await buildUserNotificationWrite(record.ownerUid, {
        kind: 'store_review_like_self', actorType: 'store', actorUid: actor.uid, actorName: 'Tintin Accesorios',
        title: 'Marcaste Me gusta en tu reseña desde Tintin',
        body: clean(record.comment, 420), snippet: clean(record.comment, 260), iconKey: 'heart',
        targetUrl: `/product?id=${record.productId}#review-${record.reviewId}`,
        targetType: 'review', targetId: record.reviewId,
        productId: record.productId, productName: record.productName, productImageUrl: record.productImageUrl,
        reviewId: record.reviewId, sourceType: 'review', sourceId: record.reviewId, createdAt: now,
      }, `store_review_like_self:${record.reviewId}`);
      extraWrites.push(notification.write);
    }
  } else if (action === 'reviewReply') {
    const text = clean(input.text, MAX_REPLY);
    if (!text) throw new Error('La respuesta está vacía');
    const replyId = safeId(crypto.randomUUID(), 'Respuesta');
    updated.conversation = [...(record.conversation || []), {
      id: replyId,
      replyId,
      authorType: 'store',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRealName: 'Tintin Accesorios',
      actorUsername: 'tintin',
      actorPublicName: 'Tintin Accesorios',
      actorPhotoUrl: '',
      text,
      likeCount: 0,
      createdAt: now,
    }].slice(-80);
    updated.unread = false;
    history.push({ action: 'store_reply', replyId, text, changedAt: now, changedBy: actor.email });
    if (record.ownerUid !== actor.uid) {
      const notification = await buildUserNotificationWrite(record.ownerUid, {
        kind: 'store_review_reply', actorType: 'store', actorUid: actor.uid, actorName: 'Tintin Accesorios',
        title: 'Tintin respondió a tu reseña',
        body: text, snippet: text, iconKey: 'comment',
        targetUrl: `/product?id=${record.productId}#reply-${replyId}`,
        targetType: 'reply', targetId: replyId,
        productId: record.productId, productName: record.productName, productImageUrl: record.productImageUrl,
        reviewId: record.reviewId, replyId, sourceType: 'reply', sourceId: replyId, createdAt: now,
      }, `store_review_reply:${record.reviewId}:${replyId}`);
      extraWrites.push(notification.write);
    } else {
      const notification = await buildUserNotificationWrite(record.ownerUid, {
        kind: 'store_review_reply_self', actorType: 'store', actorUid: actor.uid, actorName: 'Tintin Accesorios',
        title: 'Respondiste tu reseña desde Tintin',
        body: text, snippet: text, iconKey: 'comment',
        targetUrl: `/product?id=${record.productId}#reply-${replyId}`,
        targetType: 'reply', targetId: replyId,
        productId: record.productId, productName: record.productName, productImageUrl: record.productImageUrl,
        reviewId: record.reviewId, replyId, sourceType: 'reply', sourceId: replyId, createdAt: now,
      }, `store_review_reply_self:${record.reviewId}:${replyId}`);
      extraWrites.push(notification.write);
    }
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
    updated.adminArchived = false;
    history.push({ action: 'deleted', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewRestore') {
    updated.deleted = false;
    updated.visible = true;
    history.push({ action: 'restored', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewSeen') {
    updated.unread = false;
  } else if (action === 'reviewUnread') {
    updated.unread = true;
  } else if (action === 'reviewArchive') {
    updated.adminArchived = Boolean(input.archived);
    history.push({ action: updated.adminArchived ? 'archived' : 'unarchived', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewPin') {
    updated.adminPinned = Boolean(input.pinned);
    history.push({ action: updated.adminPinned ? 'pinned' : 'unpinned', changedAt: now, changedBy: actor.email });
  } else if (action === 'reviewMeta') {
    updated.adminNote = clean(input.note, MAX_ADMIN_NOTE);
    updated.adminTags = adminTags(input.tags);
    history.push({ action: 'admin_meta', changedAt: now, changedBy: actor.email });
  } else {
    throw new Error('Acción de reseña no permitida');
  }
  updated.history = history.slice(-50);
  return saveReview(env, document, updated, extraWrites);
}

async function loadLike(env, likeId) {
  const id = safeId(likeId, 'Me gusta');
  const document = await firestoreAdminGet(env, `likeRecords/${id}`);
  const record = decoded(document);
  if (!record) throw new Error('No se encontró el Me gusta');
  return { id, document, record };
}

export async function adminLikeAction(env, actor, input) {
  const { id, record } = await loadLike(env, input.likeId);
  const action = clean(input.action, 60);
  const now = new Date();
  const patch = { updatedAt: now, lastAdminEmail: actor.email };

  if (action === 'likeSeen') patch.unread = false;
  else if (action === 'likeUnread') patch.unread = true;
  else if (action === 'likeArchive') {
    patch.archived = Boolean(input.archived);
    patch.archivedAt = patch.archived ? now : null;
  } else if (action === 'likeNote') patch.adminNote = clean(input.note, MAX_ADMIN_NOTE);
  else throw new Error('Acción de Me gusta no permitida');

  await firestoreAdminMerge(env, `likeRecords/${id}`, encodeFirestoreFields(patch));
  return { ...record, ...patch };
}

export async function markLikeSeen(env, likeId) {
  return adminLikeAction(env, { email: 'system' }, { action: 'likeSeen', likeId });
}

function interactionMappingWrite(mappingDoc, record, targetType, targetId) {
  if (!record.ownerUid || !record.productId) return null;
  const current = decoded(mappingDoc) || {};
  const reviewIds = Array.isArray(current.reviewIds) ? current.reviewIds.filter(value => value !== targetId) : [];
  const replyIds = Array.isArray(current.replyIds) ? current.replyIds.filter(value => value !== targetId) : [];
  return {
    path: `users/${safeId(record.ownerUid, 'Cuenta')}/reviewLikeProducts/${safeId(record.productId, 'Producto')}`,
    fields: encodeFirestoreFields({
      schemaVersion: 2,
      productId: record.productId,
      reviewIds: targetType === 'review' ? reviewIds : (Array.isArray(current.reviewIds) ? current.reviewIds : []),
      replyIds: targetType === 'reply' ? replyIds : (Array.isArray(current.replyIds) ? current.replyIds : []),
      updatedAt: new Date(),
    }),
    currentDocument: mappingDoc ? { updateTime: mappingDoc.updateTime } : { exists: false },
  };
}

export async function adminDeleteLike(env, actor, likeId) {
  const { id, record } = await loadLike(env, likeId);
  const targetType = clean(record.targetType || 'product', 40);
  const now = new Date();

  if (targetType === 'review' && record.reviewId) {
    const { document, record: review } = await loadReview(env, record.reviewId);
    const mappingPath = record.ownerUid && record.productId
      ? `users/${safeId(record.ownerUid, 'Cuenta')}/reviewLikeProducts/${safeId(record.productId, 'Producto')}`
      : '';
    const mappingDoc = mappingPath ? await firestoreAdminGet(env, mappingPath) : null;
    const updated = { ...review, likeCount: Math.max(0, Number(review.likeCount) || 0) - 1, updatedAt: now };
    const extra = [{ path: `likeRecords/${id}`, delete: true }];
    const mapWrite = interactionMappingWrite(mappingDoc, record, 'review', record.reviewId);
    if (mapWrite) extra.push(mapWrite);
    await saveReview(env, document, updated, extra);
  } else if (targetType === 'reply' && record.reviewId && record.replyId) {
    const { document, record: review } = await loadReview(env, record.reviewId);
    const conversation = [...(review.conversation || [])];
    const index = conversation.findIndex(message => String(message.replyId || message.id || '') === record.replyId);
    if (index >= 0) conversation[index] = { ...conversation[index], likeCount: Math.max(0, Number(conversation[index].likeCount) || 0) - 1 };
    const mappingPath = record.ownerUid && record.productId
      ? `users/${safeId(record.ownerUid, 'Cuenta')}/reviewLikeProducts/${safeId(record.productId, 'Producto')}`
      : '';
    const mappingDoc = mappingPath ? await firestoreAdminGet(env, mappingPath) : null;
    const updated = { ...review, conversation, updatedAt: now };
    const extra = [{ path: `likeRecords/${id}`, delete: true }];
    const mapWrite = interactionMappingWrite(mappingDoc, record, 'reply', record.replyId);
    if (mapWrite) extra.push(mapWrite);
    await saveReview(env, document, updated, extra);
  } else {
    const writes = [{ path: `likeRecords/${id}`, delete: true }];
    if (record.ownerUid && record.productId) {
      writes.push({ path: `users/${safeId(record.ownerUid, 'Cuenta')}/favorites/${safeId(record.productId, 'Producto')}`, delete: true });
    }
    await firestoreAdminCommit(env, writes);
    if (record.productId) await refreshProductLikeStats(env, record.productId);
  }

  return { ...record, deleted: true, lastAdminEmail: actor.email, updatedAt: now };
}
