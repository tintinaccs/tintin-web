import {
  encodeFirestoreFields,
  firestoreAdminBatchGet,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminList,
  firestoreAdminListAll,
  firestoreAdminMerge,
  firestoreAdminReplace,
} from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit, firestoreAdminDeleteWhere, MAX_ADMIN_BATCH_WRITES } from './firestore-admin-batch.js';
import { adminNotificationPath, buildUserNotificationWrite, userNotificationPath } from './notificaciones-sociales.js';
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
const PURGE_SCAN_LIMIT = 5000;
const DOC_ID = /^[A-Za-z0-9_-]{1,180}$/;

const validId = value => DOC_ID.test(String(value || ''));

async function commitInChunks(env, writes) {
  for (let index = 0; index < writes.length; index += MAX_ADMIN_BATCH_WRITES) {
    await firestoreAdminBatchCommit(env, writes.slice(index, index + MAX_ADMIN_BATCH_WRITES));
  }
}

// Cada grupo es atómico: nunca se parte entre dos commits.
async function commitGroups(env, groups) {
  let batch = [];
  for (const group of groups) {
    if (!group.length) continue;
    if (batch.length + group.length > MAX_ADMIN_BATCH_WRITES) {
      await firestoreAdminBatchCommit(env, batch);
      batch = [];
    }
    batch.push(...group);
  }
  if (batch.length) await firestoreAdminBatchCommit(env, batch);
}

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

// Eliminar desde Super Admin no es una ocultación. Borra todas las copias
// navegables de la reseña y sus interacciones asociadas; los pedidos no se
// tocan porque son comprobantes comerciales independientes.
export async function adminDeleteReviewPermanently(env, actor, reviewId) {
  const { id, record } = await loadReview(env, reviewId);
  const likes = (await firestoreAdminList(env, 'likeRecords', 3000))
    .map(decoded)
    .filter(item => item && String(item.reviewId || '') === id);
  const writes = [
    { path: `reviewRecords/${id}`, delete: true },
    { path: `users/${safeId(record.ownerUid, 'Cuenta')}/reviews/${id}`, delete: true },
    { path: `products/${safeId(record.productId, 'Producto')}/reviews/${id}`, delete: true },
    ...likes.map(item => ({ path: `likeRecords/${safeId(item.likeId, 'Me gusta')}`, delete: true })),
  ];
  // firestoreAdminCommit acepta hasta 20 escrituras: con más reacciones el
  // troceo anterior (400) fallaba entero. El commit administrativo acepta
  // lotes mayores y trocear conserva la purga completa.
  await commitInChunks(env, writes);
  await updateReviewStats(env, record.productId);
  return { ...record, reviewId: id, deleted: true, permanentlyDeleted: true, lastAdminEmail: actor.email };
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

function reviewTombstoneEvent(record) {
  return {
    type: 'review',
    operation: 'upsert',
    record: {
      reviewId: clean(record.reviewId || record.id, 180),
      deleted: true,
      visible: false,
      unread: false,
      rating: 0,
      comment: '',
      productId: '',
      productName: '',
      realName: '',
      username: '',
      email: '',
      publicName: '',
      createdAt: record.createdAt || new Date(),
      updatedAt: new Date(),
      storeLiked: false,
      conversation: [],
      history: [],
    },
  };
}

const isProductLike = like => !like.targetType || like.targetType === 'product';

// Borra toda la participación social de una cuenta: sus reseñas (con las
// respuestas y reacciones que recibieron), sus respuestas y reacciones en
// hilos ajenos, sus denuncias y los avisos que esa actividad dejó en otras
// bandejas y en el panel. Cada paso es idempotente y lo que permite
// reconstruir el trabajo pendiente se borra al final: si algo falla a mitad,
// reintentar completa la purga sin descontar dos veces.
export async function adminPurgeUserEngagement(env, uid) {
  if (!validId(uid)) throw new Error('Cuenta inválida');
  const [reviewDocs, likeDocs, reportDocs] = await Promise.all([
    firestoreAdminListAll(env, 'reviewRecords', PURGE_SCAN_LIMIT),
    firestoreAdminListAll(env, 'likeRecords', PURGE_SCAN_LIMIT),
    firestoreAdminListAll(env, 'commentReports', PURGE_SCAN_LIMIT),
  ]);
  if ([reviewDocs, likeDocs, reportDocs].some(list => list.length >= PURGE_SCAN_LIMIT)) {
    throw new Error('Hay demasiados registros de participación para purgar la cuenta de forma segura');
  }

  const now = new Date();
  const reviews = reviewDocs
    .map(document => ({ document, record: decoded(document) }))
    .filter(item => item.record && validId(item.record.id));
  const likes = likeDocs.map(decoded).filter(like => like && validId(like.id));
  const reports = reportDocs.map(decoded).filter(report => report && validId(report.id));
  const reviewById = new Map(reviews.map(item => [item.record.id, item.record]));
  const messageId = message => clean(message?.replyId || message?.id, 180);
  const conversationOf = record => (Array.isArray(record.conversation) ? record.conversation : []);

  const replyAuthors = new Map();
  const ownReviewIds = new Set();
  const ownThreadReplyIds = new Set();
  const removedReplyIds = new Set();
  const deletedReplies = [];
  for (const { record } of reviews) {
    if (clean(record.ownerUid, 180) === uid) ownReviewIds.add(record.id);
  }
  for (const { record } of reviews) {
    for (const message of conversationOf(record)) {
      const replyId = messageId(message);
      if (!replyId) continue;
      replyAuthors.set(replyId, clean(message.actorUid, 180));
      if (ownReviewIds.has(record.id)) {
        ownThreadReplyIds.add(replyId);
        deletedReplies.push({ record, message });
      } else if (clean(message.actorUid, 180) === uid) {
        removedReplyIds.add(replyId);
        deletedReplies.push({ record, message });
      }
    }
  }

  const likesToDelete = likes.filter(like =>
    clean(like.ownerUid, 180) === uid
    || clean(like.targetOwnerUid, 180) === uid
    || ownReviewIds.has(clean(like.reviewId, 180))
    || removedReplyIds.has(clean(like.replyId, 180))
  );
  const deletedCommentIds = new Set([...ownReviewIds, ...ownThreadReplyIds, ...removedReplyIds]);
  const reportsToDelete = reports.filter(report =>
    clean(report.reporterUid, 180) === uid
    || clean(report.reportedAuthorUid, 180) === uid
    || ownReviewIds.has(clean(report.threadRootId, 180))
    || deletedCommentIds.has(clean(report.commentId, 180))
  );

  // A) Avisos en bandejas ajenas y en el panel, denuncias y listas de
  // "Me gusta" de otras cuentas. Va primero porque se deriva de los
  // registros que los pasos siguientes borran.
  const noticePaths = new Set();
  const adminKeys = new Set();
  const userNotice = async (recipient, key) => {
    const target = clean(recipient, 180);
    if (!target || target === uid || !validId(target)) return;
    noticePaths.add(await userNotificationPath(target, key));
  };
  for (const reviewId of ownReviewIds) {
    adminKeys.add(`review_created:${reviewId}`);
    adminKeys.add(`store_review_created:${reviewId}`);
  }
  for (const { record, message } of deletedReplies) {
    const replyId = messageId(message);
    const author = clean(message.actorUid, 180);
    const participants = new Set([record.ownerUid, ...conversationOf(record).map(item => item?.actorUid)].map(value => clean(value, 180)));
    for (const participant of participants) {
      if (participant && participant !== author) await userNotice(participant, `review_reply:${record.id}:${replyId}:${participant}`);
    }
    await userNotice(record.ownerUid, `review_reply:${record.id}:${replyId}`);
    await userNotice(record.ownerUid, `store_review_reply:${record.id}:${replyId}`);
    adminKeys.add(`review_reply:${record.id}:${replyId}`);
    adminKeys.add(`store_review_reply:${record.id}:${replyId}`);
  }
  const likerMappings = new Map();
  for (const like of likesToDelete) {
    const liker = clean(like.ownerUid, 180);
    const reviewId = clean(like.reviewId, 180);
    const replyId = clean(like.replyId, 180);
    const type = clean(like.targetType || 'product', 40);
    if (type === 'review' && reviewId) {
      const owner = clean(like.targetOwnerUid, 180) || clean(reviewById.get(reviewId)?.ownerUid, 180);
      await userNotice(owner, `review_like:${reviewId}:${liker}:${owner}`);
      await userNotice(owner, `review_like:${reviewId}:${liker}`);
      adminKeys.add(`review_like:${reviewId}:${liker}`);
      adminKeys.add(`store_review_like:${reviewId}:${liker}`);
    } else if (type === 'reply' && replyId) {
      const owner = clean(like.targetOwnerUid, 180) || replyAuthors.get(replyId) || '';
      await userNotice(owner, `reply_like:${replyId}:${liker}:${owner}`);
      await userNotice(owner, `reply_like:${replyId}:${liker}`);
      adminKeys.add(`reply_like:${replyId}:${liker}`);
      adminKeys.add(`store_reply_like:${replyId}:${liker}`);
    } else {
      adminKeys.add(`product_like:${like.id}`);
      adminKeys.add(`store_product_like:${like.id}`);
    }
    // La lista de "Me gusta" de otra cuenta no debe seguir apuntando a
    // contenido que deja de existir. La propia se borra con la cuenta.
    const productId = clean(like.productId, 180);
    if ((type === 'review' || type === 'reply') && liker && liker !== uid && validId(liker) && validId(productId)) {
      const path = `users/${liker}/reviewLikeProducts/${productId}`;
      const entry = likerMappings.get(path) || { reviewIds: new Set(), replyIds: new Set() };
      if (type === 'review') entry.reviewIds.add(reviewId);
      else entry.replyIds.add(replyId);
      likerMappings.set(path, entry);
    }
  }
  for (const report of reportsToDelete) adminKeys.add(`comment_reported:${report.id}`);
  for (const key of adminKeys) noticePaths.add(await adminNotificationPath(key));
  noticePaths.delete('');
  await commitInChunks(env, [
    ...[...noticePaths].map(path => ({ path, delete: true })),
    ...reportsToDelete.map(report => ({ path: `commentReports/${report.id}`, delete: true })),
  ]);
  // Avisos del panel sin clave determinística (alta, ingresos, etc.).
  const adminNotices = await firestoreAdminDeleteWhere(env, 'adminNotifications', 'actorUid', uid)
    + await firestoreAdminDeleteWhere(env, 'adminNotifications', 'targetOwnerUid', uid);

  const mappingPaths = [...likerMappings.keys()];
  const mappingWrites = [];
  for (let index = 0; index < mappingPaths.length; index += 100) {
    const documents = await firestoreAdminBatchGet(env, mappingPaths.slice(index, index + 100));
    for (const document of documents) {
      const path = String(document?.name || '').split('/documents/')[1] || '';
      const entry = likerMappings.get(path);
      const current = decoded(document);
      if (!entry || !current) continue;
      const reviewIds = Array.isArray(current.reviewIds) ? current.reviewIds : [];
      const replyIds = Array.isArray(current.replyIds) ? current.replyIds : [];
      const nextReviewIds = reviewIds.filter(value => !entry.reviewIds.has(value));
      const nextReplyIds = replyIds.filter(value => !entry.replyIds.has(value));
      if (nextReviewIds.length === reviewIds.length && nextReplyIds.length === replyIds.length) continue;
      mappingWrites.push({
        path,
        fields: encodeFirestoreFields({
          schemaVersion: 2,
          productId: clean(current.productId || path.split('/').pop(), 180),
          reviewIds: nextReviewIds,
          replyIds: nextReplyIds,
          updatedAt: now,
        }),
        currentDocument: { updateTime: document.updateTime },
      });
    }
  }
  await commitInChunks(env, mappingWrites);

  const handledLikes = new Set();
  const likeDelete = like => {
    handledLikes.add(like.id);
    return { path: `likeRecords/${like.id}`, delete: true };
  };

  // B) Hilos ajenos: se quitan sus respuestas y se descuentan sus "Me gusta".
  // Primero las reacciones a sus respuestas (las respuestas siguen ahí si hay
  // que reintentar); después, por reseña y de forma atómica, la reseña
  // actualizada junto con el borrado de sus propias reacciones.
  await commitInChunks(env, likesToDelete
    .filter(like => removedReplyIds.has(clean(like.replyId, 180)))
    .map(likeDelete));
  const groups = [];
  const sheetEvents = [];
  let repliesRemoved = 0;
  for (const { document, record } of reviews) {
    if (ownReviewIds.has(record.id)) continue;
    const ownLikes = likesToDelete.filter(like =>
      !handledLikes.has(like.id) && clean(like.ownerUid, 180) === uid && clean(like.reviewId, 180) === record.id
      && (like.targetType === 'review' || like.targetType === 'reply'));
    const conversation = conversationOf(record);
    const mentionsUid = conversation.some(message =>
      clean(message?.replyToUserId, 180) === uid || clean(message?.targetOwnerUid, 180) === uid);
    const removes = conversation.some(message => removedReplyIds.has(messageId(message)));
    if (!ownLikes.length && !mentionsUid && !removes) continue;

    const replyLikeCounts = new Map();
    ownLikes.filter(like => like.targetType === 'reply').forEach(like => {
      const replyId = clean(like.replyId, 180);
      replyLikeCounts.set(replyId, (replyLikeCounts.get(replyId) || 0) + 1);
    });
    const reviewLikes = ownLikes.filter(like => like.targetType === 'review').length;
    const nextConversation = conversation
      .filter(message => !removedReplyIds.has(messageId(message)))
      .map(message => {
        const next = { ...message };
        const discount = replyLikeCounts.get(messageId(message)) || 0;
        if (discount) next.likeCount = Math.max(0, (Number(message.likeCount) || 0) - discount);
        if (clean(next.replyToUserId, 180) === uid) next.replyToUserId = '';
        if (clean(next.targetOwnerUid, 180) === uid) next.targetOwnerUid = '';
        return next;
      });
    repliesRemoved += conversation.length - nextConversation.length;
    const { id: _id, ...base } = record;
    const updated = {
      ...base,
      reviewId: record.id,
      conversation: nextConversation,
      likeCount: Math.max(0, (Number(record.likeCount) || 0) - reviewLikes),
      updatedAt: now,
    };
    const group = [{
      path: `reviewRecords/${record.id}`,
      fields: encodeFirestoreFields(updated),
      currentDocument: { updateTime: document.updateTime },
    }];
    if (validId(updated.ownerUid)) {
      group.push({ path: `users/${updated.ownerUid}/reviews/${record.id}`, fields: encodeFirestoreFields(mapping(updated)) });
    }
    if (validId(updated.productId)) {
      const publicPath = `products/${updated.productId}/reviews/${record.id}`;
      group.push(updated.visible && !updated.deleted
        ? { path: publicPath, fields: encodeFirestoreFields(reviewPublic(updated)) }
        : { path: publicPath, delete: true });
    }
    group.push(...ownLikes.map(likeDelete));
    groups.push(group);
    sheetEvents.push({ type: 'review', operation: 'upsert', record: updated });
  }
  await commitGroups(env, groups);

  // C) Sus reseñas: primero las copias navegables y las reacciones, después
  // las estadísticas y por último el registro, que es lo que permite
  // retomar la purga si algo falla antes.
  const ownRecords = reviews.filter(({ record }) => ownReviewIds.has(record.id)).map(({ record }) => record);
  const ownWrites = [];
  const reviewProducts = new Set();
  for (const record of ownRecords) {
    ownWrites.push({ path: `users/${uid}/reviews/${record.id}`, delete: true });
    if (validId(record.productId)) {
      ownWrites.push({ path: `products/${record.productId}/reviews/${record.id}`, delete: true });
      reviewProducts.add(record.productId);
    }
  }
  ownWrites.push(...likesToDelete
    .filter(like => !handledLikes.has(like.id) && ownReviewIds.has(clean(like.reviewId, 180)))
    .map(likeDelete));
  await commitInChunks(env, ownWrites);
  // Por producto: estadística y después sus registros. Si la solicitud se
  // corta, el reintento ya no repite los productos terminados.
  const recordDelete = record => ({ path: `reviewRecords/${record.id}`, delete: true });
  for (const productId of reviewProducts) {
    await updateReviewStats(env, productId);
    await commitInChunks(env, ownRecords.filter(record => record.productId === productId).map(recordDelete));
  }
  await commitInChunks(env, ownRecords.filter(record => !reviewProducts.has(record.productId)).map(recordDelete));
  sheetEvents.push(...ownRecords.map(reviewTombstoneEvent));

  // D) Sus "Me gusta" a productos, con el contador del producto en el mismo
  // commit para que no quede desfasado.
  const productGroups = new Map();
  for (const like of likesToDelete) {
    if (handledLikes.has(like.id) || !isProductLike(like) || !validId(like.productId)) continue;
    const list = productGroups.get(like.productId) || [];
    list.push(like);
    productGroups.set(like.productId, list);
  }
  const purgedIds = new Set(likesToDelete.map(like => like.id));
  const likeGroups = [];
  for (const [productId, productLikes] of productGroups) {
    const likeCount = likes.filter(like =>
      !purgedIds.has(like.id) && like.productId === productId && like.archived !== true && isProductLike(like)).length;
    likeGroups.push([
      ...productLikes.map(likeDelete),
      {
        path: `productEngagementStats/${productId}`,
        fields: encodeFirestoreFields({ schemaVersion: 2, productId, likeCount, updatedAt: now }),
      },
    ]);
  }
  await commitGroups(env, likeGroups);

  // E) Reacciones huérfanas que no encajaron en los pasos anteriores.
  await commitInChunks(env, likesToDelete.filter(like => !handledLikes.has(like.id)).map(likeDelete));
  sheetEvents.push(...likesToDelete.map(like => ({ type: 'like', operation: 'delete', record: { likeId: like.id } })));

  return {
    reviewsDeleted: ownRecords.length,
    repliesRemoved,
    likesDeleted: likesToDelete.length,
    reportsDeleted: reportsToDelete.length,
    notificationsDeleted: noticePaths.size + adminNotices,
    sheetEvents,
  };
}
