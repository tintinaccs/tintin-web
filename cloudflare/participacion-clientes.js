import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminList,
  firestoreAdminReplace,
} from './firebase-admin-ligero.js';
import {
  buildAdminNotificationWrite,
  buildUserNotificationWrite,
} from './notificaciones-sociales.js';

const MAX_COMMENT = 1600;
const MAX_REPLY = 1200;
const MAX_REPLIES = 80;
const MAX_REVIEW_LIKES_PER_PRODUCT = 800;
const CUSTOMER_REVIEW_BATCH_LIMIT = 10;
const CUSTOMER_REVIEW_COOLDOWN_MS = 30 * 60 * 1000;
const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';
const MAX_COMMIT_RETRIES = 3;

const clean = (value, max = 180) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const safeId = (value, label = 'Identificador') => {
  const result = clean(value, 180);
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(result)) throw new Error(`${label} inválido`);
  return result;
};

const docId = document => String(document?.name || '').split('/').pop();
const decoded = document => document ? { id: docId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
const isSuperAdminUser = user => clean(user?.email, 254).toLowerCase() === SUPER_ADMIN_EMAIL;
const dateMillis = value => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};

async function opaqueId(...parts) {
  const bytes = new TextEncoder().encode(parts.map(part => String(part ?? '')).join(':'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function customerName(profile, email) {
  const first = clean(profile?.firstName || profile?.name || profile?.displayName, 80);
  const last = clean(profile?.lastName, 80);
  return clean([first, last].filter(Boolean).join(' '), 160) ||
    clean(String(email || '').split('@')[0], 120) || 'Clienta Tintin';
}

function customerUsername(profile, email) {
  return clean(profile?.username || profile?.userName || String(email || '').split('@')[0], 80);
}

export function publicCustomerName(realName) {
  const parts = clean(realName, 160).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Clienta Tintin';
  return parts.slice(0, 2).map(part => `${Array.from(part)[0]}***`).join(' ');
}

async function readContext(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const uid = safeId(user.uid, 'Cuenta');
  const [productDoc, userDoc] = await Promise.all([
    firestoreAdminGet(env, `products/${id}`),
    firestoreAdminGet(env, `users/${uid}`),
  ]);
  if (!productDoc) throw new Error('El producto ya no existe');
  const product = decoded(productDoc);
  if (product.active === false) throw new Error('El producto no está disponible');
  const profile = decoded(userDoc) || {};
  if (profile.blocked === true) throw new Error('La cuenta no puede realizar esta acción');
  const realName = customerName(profile, user.email);
  const admin = isSuperAdminUser(user);
  return {
    productId: id,
    productName: clean(product.name || 'Producto', 180),
    imageUrl: clean(product.imageUrl || product.image || '', 1200),
    realName,
    username: customerUsername(profile, user.email),
    publicName: admin ? 'Tintin Accesorios' : publicCustomerName(realName),
    photoUrl: clean(profile.photoURL || profile.photoUrl || '', 1200),
    isSuperAdmin: admin,
  };
}

function publicReply(message) {
  const replyId = clean(message?.replyId || message?.id, 180);
  if (!replyId) return null;
  return {
    replyId,
    id: replyId,
    authorType: message?.authorType === 'store' ? 'store' : 'customer',
    publicName: clean(message?.actorPublicName || message?.publicName || (message?.authorType === 'store' ? 'Tintin Accesorios' : 'Clienta Tintin'), 160),
    publicPhotoUrl: clean(message?.actorPhotoUrl || message?.publicPhotoUrl, 1200),
    text: clean(message?.text, MAX_REPLY),
    likeCount: Math.max(0, Number(message?.likeCount) || 0),
    createdAt: message?.createdAt || new Date(),
  };
}

function reviewPublic(record) {
  return {
    schemaVersion: 4,
    reviewId: record.reviewId,
    productId: record.productId,
    productName: record.productName,
    rating: record.rating,
    comment: record.comment,
    publicName: record.publicName,
    publicPhotoUrl: clean(record.actorPhotoUrl, 1200),
    storeLiked: Boolean(record.storeLiked),
    likeCount: Math.max(0, Number(record.likeCount) || 0),
    conversation: (Array.isArray(record.conversation) ? record.conversation : []).map(publicReply).filter(Boolean),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function ownReviewView(record) {
  if (!record) return null;
  return {
    reviewId: record.reviewId,
    productId: record.productId,
    rating: record.rating,
    comment: record.comment,
    visible: Boolean(record.visible),
    deleted: Boolean(record.deleted),
    likeCount: Math.max(0, Number(record.likeCount) || 0),
    createdAt: record.createdAt,
  };
}

function ownerReviewMapping(record) {
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

function rateLimitError(retryAfterMs) {
  const error = new Error('Llegaste al límite de 10 comentarios. Podés volver a comentar en 30 minutos.');
  error.status = 429;
  error.code = 'social/review-rate-limit';
  error.retryAfterMs = Math.max(1000, Math.ceil(Number(retryAfterMs) || CUSTOMER_REVIEW_COOLDOWN_MS));
  return error;
}

function nextReviewLimitState(limitRecord, now) {
  const blockedUntilMs = dateMillis(limitRecord?.blockedUntil);
  if (blockedUntilMs > now.getTime()) throw rateLimitError(blockedUntilMs - now.getTime());
  const expired = blockedUntilMs > 0 && blockedUntilMs <= now.getTime();
  const currentCount = expired ? 0 : Math.max(0, Math.min(CUSTOMER_REVIEW_BATCH_LIMIT, Number(limitRecord?.count) || 0));
  const count = currentCount + 1;
  const blockedUntil = count >= CUSTOMER_REVIEW_BATCH_LIMIT
    ? new Date(now.getTime() + CUSTOMER_REVIEW_COOLDOWN_MS)
    : null;
  return {
    schemaVersion: 1,
    count,
    blockedUntil,
    lastCommentAt: now,
    updatedAt: now,
  };
}

async function updateReviewStats(env, productId) {
  const documents = await firestoreAdminList(env, `products/${productId}/reviews`, 1000);
  const reviews = documents.map(decoded).filter(review => review && review.deleted !== true && review.visible !== false);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let count = 0;
  reviews.forEach(review => {
    const rating = Number(review.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    distribution[rating] += 1;
    total += rating;
    count += 1;
  });
  const stats = {
    schemaVersion: 2,
    productId,
    count,
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    distribution,
    updatedAt: new Date(),
  };
  await firestoreAdminReplace(env, `productReviewStats/${productId}`, encodeFirestoreFields(stats));
  return stats;
}

async function updateProductLikeStats(env, productId) {
  const documents = await firestoreAdminList(env, 'likeRecords', 3000);
  const count = documents
    .map(decoded)
    .filter(record => record?.productId === productId && record.archived !== true && (!record.targetType || record.targetType === 'product'))
    .length;
  await firestoreAdminReplace(env, `productEngagementStats/${productId}`, encodeFirestoreFields({
    schemaVersion: 2,
    productId,
    likeCount: count,
    updatedAt: new Date(),
  }));
  return count;
}

export async function getProductLikeStats(env, productId) {
  const id = safeId(productId, 'Producto');
  const existing = decoded(await firestoreAdminGet(env, `productEngagementStats/${id}`));
  return { productId: id, likeCount: existing ? Math.max(0, Number(existing.likeCount) || 0) : await updateProductLikeStats(env, id) };
}

export async function getProductReviewStats(env, productId) {
  const id = safeId(productId, 'Producto');
  const existing = decoded(await firestoreAdminGet(env, `productReviewStats/${id}`));
  if (!existing) return updateReviewStats(env, id);
  const distribution = existing.distribution && typeof existing.distribution === 'object'
    ? existing.distribution
    : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  return {
    productId: id,
    count: Math.max(0, Number(existing.count) || 0),
    average: Math.max(0, Math.min(5, Number(existing.average) || 0)),
    distribution: {
      1: Math.max(0, Number(distribution[1] ?? distribution['1']) || 0),
      2: Math.max(0, Number(distribution[2] ?? distribution['2']) || 0),
      3: Math.max(0, Number(distribution[3] ?? distribution['3']) || 0),
      4: Math.max(0, Number(distribution[4] ?? distribution['4']) || 0),
      5: Math.max(0, Number(distribution[5] ?? distribution['5']) || 0),
    },
  };
}

export async function getOwnReview(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const uid = safeId(user.uid, 'Cuenta');
  const documents = await firestoreAdminList(env, `users/${uid}/reviews`, 200);
  const records = documents
    .map(decoded)
    .filter(record => record?.productId === id && record.deleted !== true)
    .sort((a, b) => dateMillis(b.createdAt) - dateMillis(a.createdAt));
  return ownReviewView(records[0] || null);
}

export async function getOwnFavorite(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const likeId = await opaqueId('favorite', user.uid, id);
  const legacyLikeId = await opaqueId(user.uid, id, 'favorite');
  return Boolean(
    await firestoreAdminGet(env, `likeRecords/${likeId}`) ||
    await firestoreAdminGet(env, `likeRecords/${legacyLikeId}`)
  );
}

export async function getReviewInteractions(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const mapping = decoded(await firestoreAdminGet(env, `users/${safeId(user.uid, 'Cuenta')}/reviewLikeProducts/${id}`));
  return {
    productId: id,
    reviewIds: Array.isArray(mapping?.reviewIds) ? mapping.reviewIds.map(value => clean(value, 180)).filter(Boolean) : [],
    replyIds: Array.isArray(mapping?.replyIds) ? mapping.replyIds.map(value => clean(value, 180)).filter(Boolean) : [],
  };
}

export async function createReview(env, user, input) {
  const rating = Number(input.rating);
  const comment = clean(input.comment, MAX_COMMENT);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Elegí una puntuación de 1 a 5 estrellas');
  if (comment.length < 3) throw new Error('Escribí un comentario de al menos 3 caracteres');
  const context = await readContext(env, user, input.productId);
  const uid = safeId(user.uid, 'Cuenta');
  const limitPath = `users/${uid}/socialLimits/reviews`;

  for (let attempt = 0; attempt < MAX_COMMIT_RETRIES; attempt += 1) {
    const now = new Date();
    const limitDoc = context.isSuperAdmin ? null : await firestoreAdminGet(env, limitPath);
    const limitRecord = decoded(limitDoc) || {};
    const nextLimit = context.isSuperAdmin ? null : nextReviewLimitState(limitRecord, now);
    const reviewId = await opaqueId('review', uid, context.productId, now.getTime(), crypto.randomUUID());
    const record = {
      schemaVersion: 4,
      reviewId,
      ownerUid: uid,
      email: clean(user.email, 254).toLowerCase(),
      realName: context.realName,
      username: context.username,
      publicName: context.publicName,
      actorPhotoUrl: context.photoUrl,
      authorType: context.isSuperAdmin ? 'store' : 'customer',
      productId: context.productId,
      productName: context.productName,
      productImageUrl: context.imageUrl,
      rating,
      comment,
      visible: true,
      deleted: false,
      storeLiked: false,
      likeCount: 0,
      conversation: [],
      history: [],
      unread: !context.isSuperAdmin,
      createdAt: now,
      updatedAt: now,
    };

    const writes = [
      { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(record), currentDocument: { exists: false } },
      { path: `products/${context.productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(record)), currentDocument: { exists: false } },
      { path: `users/${uid}/reviews/${reviewId}`, fields: encodeFirestoreFields(ownerReviewMapping(record)), currentDocument: { exists: false } },
    ];

    if (!context.isSuperAdmin) {
      writes.push({
        path: limitPath,
        fields: encodeFirestoreFields(nextLimit),
        currentDocument: limitDoc ? { updateTime: limitDoc.updateTime } : { exists: false },
      });
      const adminNotification = await buildAdminNotificationWrite({
        kind: 'review_created',
        actorType: 'customer',
        actorUid: uid,
        actorName: context.realName,
        actorUsername: context.username,
        actorPhotoUrl: context.photoUrl,
        title: `${context.realName} publicó una reseña en ${context.productName}`,
        body: comment,
        snippet: comment,
        iconKey: 'review',
        targetUrl: `/product?id=${context.productId}#review-${reviewId}`,
        targetType: 'review',
        targetId: reviewId,
        productId: context.productId,
        productName: context.productName,
        productImageUrl: context.imageUrl,
        reviewId,
        sourceType: 'review',
        sourceId: reviewId,
        createdAt: now,
      }, `review_created:${reviewId}`);
      writes.push(adminNotification.write);
    }

    try {
      await firestoreAdminCommit(env, writes);
      await updateReviewStats(env, context.productId);
      return {
        ...record,
        rateLimit: context.isSuperAdmin ? { unlimited: true } : {
          unlimited: false,
          count: nextLimit.count,
          blockedUntil: nextLimit.blockedUntil,
        },
      };
    } catch (error) {
      if (error?.code === 'version_conflict' && attempt + 1 < MAX_COMMIT_RETRIES) continue;
      throw error;
    }
  }
  throw Object.assign(new Error('No se pudo publicar el comentario por un conflicto de concurrencia.'), { status: 409, code: 'version_conflict' });
}

export async function editOwnReview() {
  const error = new Error('Los comentarios publicados no pueden editarse desde una cuenta cliente.');
  error.status = 403;
  error.code = 'social/customer-edit-disabled';
  throw error;
}

export async function addCustomerReply(env, user, input) {
  const productId = safeId(input.productId, 'Producto');
  const reviewId = safeId(input.reviewId, 'Reseña');
  const context = await readContext(env, user, productId);
  const uid = safeId(user.uid, 'Cuenta');
  const text = clean(input.text, MAX_REPLY);
  if (!text) throw new Error('La respuesta está vacía');

  for (let attempt = 0; attempt < MAX_COMMIT_RETRIES; attempt += 1) {
    const privateDoc = await firestoreAdminGet(env, `reviewRecords/${reviewId}`);
    const record = decoded(privateDoc);
    if (!record || record.productId !== productId || record.deleted || !record.visible) throw new Error('No se encontró la reseña');
    const now = new Date();
    const replyId = safeId(crypto.randomUUID(), 'Respuesta');
    const reply = {
      replyId,
      id: replyId,
      authorType: context.isSuperAdmin ? 'store' : 'customer',
      actorUid: uid,
      actorEmail: clean(user.email, 254).toLowerCase(),
      actorRealName: context.realName,
      actorUsername: context.username,
      actorPublicName: context.publicName,
      actorPhotoUrl: context.photoUrl,
      text,
      likeCount: 0,
      createdAt: now,
    };
    const conversation = [...(Array.isArray(record.conversation) ? record.conversation : []), reply].slice(-MAX_REPLIES);
    const updated = { ...record, schemaVersion: 4, conversation, unread: context.isSuperAdmin ? record.unread === true : true, updatedAt: now };
    const writes = [
      { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
      { path: `users/${safeId(record.ownerUid, 'Cuenta propietaria')}/reviews/${reviewId}`, fields: encodeFirestoreFields(ownerReviewMapping(updated)) },
      { path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) },
    ];

    if (!context.isSuperAdmin) {
      const adminNotification = await buildAdminNotificationWrite({
        kind: 'review_reply', actorType: 'customer', actorUid: uid, actorName: context.realName,
        actorUsername: context.username, actorPhotoUrl: context.photoUrl,
        title: `${context.realName} respondió en ${record.productName}`,
        body: text, snippet: text, iconKey: 'comment',
        targetUrl: `/product?id=${productId}#reply-${replyId}`,
        targetType: 'reply', targetId: replyId, targetOwnerUid: record.ownerUid,
        targetOwnerName: record.realName, productId, productName: record.productName,
        productImageUrl: record.productImageUrl, reviewId, replyId,
        sourceType: 'reply', sourceId: replyId, createdAt: now,
      }, `review_reply:${reviewId}:${replyId}`);
      writes.push(adminNotification.write);
    }

    if (record.ownerUid !== uid) {
      const ownerNotification = await buildUserNotificationWrite(record.ownerUid, {
        kind: 'review_reply',
        actorType: context.isSuperAdmin ? 'store' : 'customer',
        actorUid: uid,
        actorName: context.isSuperAdmin ? 'Tintin Accesorios' : context.publicName,
        actorPhotoUrl: context.photoUrl,
        title: context.isSuperAdmin ? 'Tintin respondió a tu reseña' : `${context.publicName} respondió a tu reseña`,
        body: text, snippet: text, iconKey: 'comment',
        targetUrl: `/product?id=${productId}#reply-${replyId}`,
        targetType: 'reply', targetId: replyId, productId, productName: record.productName,
        productImageUrl: record.productImageUrl, reviewId, replyId,
        sourceType: 'reply', sourceId: replyId, createdAt: now,
      }, `review_reply:${reviewId}:${replyId}`);
      writes.push(ownerNotification.write);
    }

    try {
      await firestoreAdminCommit(env, writes);
      return { review: updated, reply };
    } catch (error) {
      if (error?.code === 'version_conflict' && attempt + 1 < MAX_COMMIT_RETRIES) continue;
      throw error;
    }
  }
  throw Object.assign(new Error('No se pudo publicar la respuesta por un conflicto de concurrencia.'), { status: 409, code: 'version_conflict' });
}

function addInteractionId(mapping, key, value) {
  const values = Array.isArray(mapping?.[key]) ? mapping[key].map(item => clean(item, 180)).filter(Boolean) : [];
  return [...new Set([...values, value])].slice(-MAX_REVIEW_LIKES_PER_PRODUCT);
}

export async function toggleReviewLike(env, user, input) {
  const productId = safeId(input.productId, 'Producto');
  const reviewId = safeId(input.reviewId, 'Reseña');
  const context = await readContext(env, user, productId);
  const uid = safeId(user.uid, 'Cuenta');
  const likeId = await opaqueId('review_like', uid, reviewId);
  const existingLike = decoded(await firestoreAdminGet(env, `likeRecords/${likeId}`));
  if (existingLike) {
    const record = decoded(await firestoreAdminGet(env, `reviewRecords/${reviewId}`));
    return { selected: true, alreadyLiked: true, likeCount: Math.max(0, Number(record?.likeCount) || 0), review: record };
  }

  for (let attempt = 0; attempt < MAX_COMMIT_RETRIES; attempt += 1) {
    const [privateDoc, mappingDoc, likeDoc] = await Promise.all([
      firestoreAdminGet(env, `reviewRecords/${reviewId}`),
      firestoreAdminGet(env, `users/${uid}/reviewLikeProducts/${productId}`),
      firestoreAdminGet(env, `likeRecords/${likeId}`),
    ]);
    if (likeDoc) {
      const current = decoded(privateDoc);
      return { selected: true, alreadyLiked: true, likeCount: Math.max(0, Number(current?.likeCount) || 0), review: current };
    }
    const record = decoded(privateDoc);
    if (!record || record.productId !== productId || record.deleted || !record.visible) throw new Error('No se encontró la reseña');
    const mapping = decoded(mappingDoc) || {};
    const now = new Date();
    const updated = { ...record, schemaVersion: 4, likeCount: Math.max(0, Number(record.likeCount) || 0) + 1, updatedAt: now };
    const likeRecord = {
      schemaVersion: 3,
      likeId,
      targetType: 'review', targetId: reviewId, reviewId,
      targetOwnerUid: record.ownerUid, targetOwnerName: record.realName,
      targetSnippet: clean(record.comment, 260),
      ownerUid: uid, email: clean(user.email, 254).toLowerCase(), realName: context.realName,
      username: context.username, publicName: context.publicName, actorPhotoUrl: context.photoUrl,
      productId, productName: record.productName, productImageUrl: record.productImageUrl,
      unread: !context.isSuperAdmin, createdAt: now, updatedAt: now,
    };
    const writes = [
      { path: `likeRecords/${likeId}`, fields: encodeFirestoreFields(likeRecord), currentDocument: { exists: false } },
      { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
      { path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) },
      { path: `users/${safeId(record.ownerUid, 'Cuenta propietaria')}/reviews/${reviewId}`, fields: encodeFirestoreFields(ownerReviewMapping(updated)) },
      {
        path: `users/${uid}/reviewLikeProducts/${productId}`,
        fields: encodeFirestoreFields({
          schemaVersion: 2, productId,
          reviewIds: addInteractionId(mapping, 'reviewIds', reviewId),
          replyIds: Array.isArray(mapping.replyIds) ? mapping.replyIds : [],
          updatedAt: now,
        }),
        currentDocument: mappingDoc ? { updateTime: mappingDoc.updateTime } : { exists: false },
      },
    ];

    if (!context.isSuperAdmin) {
      const adminNotification = await buildAdminNotificationWrite({
        kind: 'review_like', actorType: 'customer', actorUid: uid, actorName: context.realName,
        actorUsername: context.username, actorPhotoUrl: context.photoUrl,
        title: `${context.realName} dio Me gusta al comentario de ${record.realName} en ${record.productName}`,
        body: record.comment, snippet: record.comment, iconKey: 'heart',
        targetUrl: `/product?id=${productId}#review-${reviewId}`,
        targetType: 'review', targetId: reviewId, targetOwnerUid: record.ownerUid,
        targetOwnerName: record.realName, productId, productName: record.productName,
        productImageUrl: record.productImageUrl, reviewId,
        sourceType: 'review_like', sourceId: likeId, createdAt: now,
      }, `review_like:${reviewId}:${uid}`);
      writes.push(adminNotification.write);
    }

    if (record.ownerUid !== uid && record.ownerUid) {
      const ownerNotification = await buildUserNotificationWrite(record.ownerUid, {
        kind: 'review_like', actorType: context.isSuperAdmin ? 'store' : 'customer', actorUid: uid,
        actorName: context.isSuperAdmin ? 'Tintin Accesorios' : context.publicName,
        actorPhotoUrl: context.photoUrl,
        title: context.isSuperAdmin ? 'A Tintin le gustó tu reseña' : `${context.publicName} dio Me gusta a tu reseña`,
        body: record.comment, snippet: record.comment, iconKey: 'heart',
        targetUrl: `/product?id=${productId}#review-${reviewId}`,
        targetType: 'review', targetId: reviewId, productId, productName: record.productName,
        productImageUrl: record.productImageUrl, reviewId,
        sourceType: 'review_like', sourceId: likeId, createdAt: now,
      }, `review_like:${reviewId}:${uid}`);
      writes.push(ownerNotification.write);
    }

    try {
      await firestoreAdminCommit(env, writes);
      return { selected: true, alreadyLiked: false, likeCount: updated.likeCount, review: updated, record: likeRecord };
    } catch (error) {
      if (error?.code === 'version_conflict' && attempt + 1 < MAX_COMMIT_RETRIES) continue;
      throw error;
    }
  }
  throw Object.assign(new Error('No se pudo guardar el Me gusta por un conflicto de concurrencia.'), { status: 409, code: 'version_conflict' });
}

export async function likeReply(env, user, input) {
  const productId = safeId(input.productId, 'Producto');
  const reviewId = safeId(input.reviewId, 'Reseña');
  const replyId = safeId(input.replyId, 'Respuesta');
  const context = await readContext(env, user, productId);
  const uid = safeId(user.uid, 'Cuenta');
  const likeId = await opaqueId('reply_like', uid, reviewId, replyId);

  for (let attempt = 0; attempt < MAX_COMMIT_RETRIES; attempt += 1) {
    const [privateDoc, mappingDoc, likeDoc] = await Promise.all([
      firestoreAdminGet(env, `reviewRecords/${reviewId}`),
      firestoreAdminGet(env, `users/${uid}/reviewLikeProducts/${productId}`),
      firestoreAdminGet(env, `likeRecords/${likeId}`),
    ]);
    const record = decoded(privateDoc);
    if (!record || record.productId !== productId || record.deleted || !record.visible) throw new Error('No se encontró la reseña');
    const conversation = Array.isArray(record.conversation) ? [...record.conversation] : [];
    const replyIndex = conversation.findIndex(message => clean(message?.replyId || message?.id, 180) === replyId);
    if (replyIndex < 0) throw new Error('No se encontró la respuesta');
    const currentReply = conversation[replyIndex] || {};
    if (likeDoc) {
      return { selected: true, alreadyLiked: true, likeCount: Math.max(0, Number(currentReply.likeCount) || 0), replyId };
    }
    const mapping = decoded(mappingDoc) || {};
    const now = new Date();
    const updatedReply = { ...currentReply, replyId, id: replyId, likeCount: Math.max(0, Number(currentReply.likeCount) || 0) + 1 };
    conversation[replyIndex] = updatedReply;
    const updated = { ...record, schemaVersion: 4, conversation, updatedAt: now };
    const replyOwnerUid = clean(currentReply.actorUid, 180);
    const replyOwnerName = clean(currentReply.actorRealName || currentReply.actorPublicName || (currentReply.authorType === 'store' ? 'Tintin Accesorios' : 'Clienta Tintin'), 160);
    const likeRecord = {
      schemaVersion: 3,
      likeId,
      targetType: 'reply', targetId: replyId, reviewId, replyId,
      targetOwnerUid: replyOwnerUid, targetOwnerName: replyOwnerName,
      targetSnippet: clean(currentReply.text, 260),
      ownerUid: uid, email: clean(user.email, 254).toLowerCase(), realName: context.realName,
      username: context.username, publicName: context.publicName, actorPhotoUrl: context.photoUrl,
      productId, productName: record.productName, productImageUrl: record.productImageUrl,
      unread: !context.isSuperAdmin, createdAt: now, updatedAt: now,
    };
    const writes = [
      { path: `likeRecords/${likeId}`, fields: encodeFirestoreFields(likeRecord), currentDocument: { exists: false } },
      { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
      { path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) },
      { path: `users/${safeId(record.ownerUid, 'Cuenta propietaria')}/reviews/${reviewId}`, fields: encodeFirestoreFields(ownerReviewMapping(updated)) },
      {
        path: `users/${uid}/reviewLikeProducts/${productId}`,
        fields: encodeFirestoreFields({
          schemaVersion: 2, productId,
          reviewIds: Array.isArray(mapping.reviewIds) ? mapping.reviewIds : [],
          replyIds: addInteractionId(mapping, 'replyIds', replyId),
          updatedAt: now,
        }),
        currentDocument: mappingDoc ? { updateTime: mappingDoc.updateTime } : { exists: false },
      },
    ];

    if (!context.isSuperAdmin) {
      const targetLabel = currentReply.authorType === 'store' ? 'la respuesta de Tintin' : `la respuesta de ${replyOwnerName}`;
      const adminNotification = await buildAdminNotificationWrite({
        kind: 'reply_like', actorType: 'customer', actorUid: uid, actorName: context.realName,
        actorUsername: context.username, actorPhotoUrl: context.photoUrl,
        title: `${context.realName} dio Me gusta a ${targetLabel} en ${record.productName}`,
        body: currentReply.text, snippet: currentReply.text, iconKey: 'heart',
        targetUrl: `/product?id=${productId}#reply-${replyId}`,
        targetType: 'reply', targetId: replyId, targetOwnerUid: replyOwnerUid,
        targetOwnerName: replyOwnerName, productId, productName: record.productName,
        productImageUrl: record.productImageUrl, reviewId, replyId,
        sourceType: 'reply_like', sourceId: likeId, createdAt: now,
      }, `reply_like:${replyId}:${uid}`);
      writes.push(adminNotification.write);
    }

    if (replyOwnerUid && replyOwnerUid !== uid && currentReply.authorType !== 'store') {
      const ownerNotification = await buildUserNotificationWrite(replyOwnerUid, {
        kind: 'reply_like', actorType: context.isSuperAdmin ? 'store' : 'customer', actorUid: uid,
        actorName: context.isSuperAdmin ? 'Tintin Accesorios' : context.publicName,
        actorPhotoUrl: context.photoUrl,
        title: context.isSuperAdmin ? 'A Tintin le gustó tu respuesta' : `${context.publicName} dio Me gusta a tu respuesta`,
        body: currentReply.text, snippet: currentReply.text, iconKey: 'heart',
        targetUrl: `/product?id=${productId}#reply-${replyId}`,
        targetType: 'reply', targetId: replyId, productId, productName: record.productName,
        productImageUrl: record.productImageUrl, reviewId, replyId,
        sourceType: 'reply_like', sourceId: likeId, createdAt: now,
      }, `reply_like:${replyId}:${uid}`);
      writes.push(ownerNotification.write);
    }

    try {
      await firestoreAdminCommit(env, writes);
      return { selected: true, alreadyLiked: false, likeCount: updatedReply.likeCount, replyId, review: updated, record: likeRecord };
    } catch (error) {
      if (error?.code === 'version_conflict' && attempt + 1 < MAX_COMMIT_RETRIES) continue;
      throw error;
    }
  }
  throw Object.assign(new Error('No se pudo guardar el Me gusta de la respuesta.'), { status: 409, code: 'version_conflict' });
}

export async function toggleFavorite(env, user, input) {
  const context = await readContext(env, user, input.productId);
  const uid = safeId(user.uid, 'Cuenta');
  const legacyLikeId = await opaqueId(uid, context.productId, 'favorite');
  const modernLikeId = await opaqueId('favorite', uid, context.productId);
  const [legacyDoc, modernDoc] = await Promise.all([
    firestoreAdminGet(env, `likeRecords/${legacyLikeId}`),
    firestoreAdminGet(env, `likeRecords/${modernLikeId}`),
  ]);
  const existingDoc = modernDoc || legacyDoc;
  if (existingDoc) {
    const existing = decoded(existingDoc);
    const likeCount = await updateProductLikeStats(env, context.productId);
    return { selected: true, alreadyLiked: true, likeCount, record: existing };
  }

  const likeId = modernLikeId;
  const now = new Date();
  const favoritePath = `users/${uid}/favorites/${context.productId}`;
  const record = {
    schemaVersion: 3,
    likeId,
    targetType: 'product', targetId: context.productId,
    ownerUid: uid, email: clean(user.email, 254).toLowerCase(), realName: context.realName,
    username: context.username, publicName: context.publicName, actorPhotoUrl: context.photoUrl,
    productId: context.productId, productName: context.productName, productImageUrl: context.imageUrl,
    unread: !context.isSuperAdmin, createdAt: now, updatedAt: now,
  };
  const writes = [
    { path: `likeRecords/${likeId}`, fields: encodeFirestoreFields(record), currentDocument: { exists: false } },
    { path: favoritePath, fields: encodeFirestoreFields({
      schemaVersion: 3, productId: context.productId, name: context.productName,
      cat: clean(input.cat, 120), price: Math.max(0, Number(input.price) || 0),
      imageUrl: context.imageUrl, createdAt: now, updatedAt: now,
    }) },
  ];
  if (!context.isSuperAdmin) {
    const adminNotification = await buildAdminNotificationWrite({
      kind: 'product_like', actorType: 'customer', actorUid: uid, actorName: context.realName,
      actorUsername: context.username, actorPhotoUrl: context.photoUrl,
      title: `${context.realName} dio Me gusta a ${context.productName}`,
      body: `Nuevo Me gusta en ${context.productName}.`, iconKey: 'heart',
      targetUrl: `/product?id=${context.productId}`,
      targetType: 'product', targetId: context.productId,
      productId: context.productId, productName: context.productName, productImageUrl: context.imageUrl,
      sourceType: 'product_like', sourceId: likeId, createdAt: now,
    }, `product_like:${likeId}`);
    writes.push(adminNotification.write);
  }
  try {
    await firestoreAdminCommit(env, writes);
  } catch (error) {
    if (error?.code === 'version_conflict') {
      const likeCount = await updateProductLikeStats(env, context.productId);
      return { selected: true, alreadyLiked: true, likeCount, record };
    }
    throw error;
  }
  const likeCount = await updateProductLikeStats(env, context.productId);
  return { selected: true, alreadyLiked: false, likeCount, record };
}

export const engagementClean = clean;
export const engagementDecoded = decoded;
export const engagementReviewPublic = reviewPublic;
export const engagementOwnReviewView = ownReviewView;
export const engagementUpdateReviewStats = updateReviewStats;
export const engagementSafeId = safeId;
export const engagementIsSuperAdmin = isSuperAdminUser;
