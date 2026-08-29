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
const MAX_REPLIES = 50;
const MAX_REVIEW_LIKES_PER_PRODUCT = 500;

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

async function opaqueId(uid, productId, kind) {
  const bytes = new TextEncoder().encode(`${kind}:${uid}:${productId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function customerName(profile, email) {
  const first = clean(profile?.firstName || profile?.name || profile?.displayName, 80);
  const last = clean(profile?.lastName, 80);
  return clean([first, last].filter(Boolean).join(' '), 160) ||
    clean(String(email || '').split('@')[0], 120) || 'Clienta Tintin';
}

export function publicCustomerName(realName) {
  const parts = clean(realName, 160).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Clienta Tintin';
  // La vista pública nunca muestra un nombre real: sólo iniciales con una máscara de longitud fija.
  // El nombre completo queda exclusivamente en reviewRecords, accesible para Super Admin.
  return parts.slice(0, 2).map(part => `${Array.from(part)[0]}***`).join(' ');
}

async function readContext(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const [productDoc, userDoc] = await Promise.all([
    firestoreAdminGet(env, `products/${id}`),
    firestoreAdminGet(env, `users/${safeId(user.uid, 'Cuenta')}`),
  ]);
  if (!productDoc) throw new Error('El producto ya no existe');
  const product = decoded(productDoc);
  if (product.active === false) throw new Error('El producto no está disponible');
  const profile = decoded(userDoc) || {};
  if (profile.blocked === true) throw new Error('La cuenta no puede realizar esta acción');
  const realName = customerName(profile, user.email);
  return {
    productId: id,
    productName: clean(product.name || 'Producto', 180),
    imageUrl: clean(product.imageUrl || product.image || '', 1200),
    realName,
    publicName: publicCustomerName(realName),
    photoUrl: clean(profile.photoURL || '', 1200),
  };
}

function reviewPublic(record) {
  return {
    schemaVersion: 3,
    reviewId: record.reviewId,
    productId: record.productId,
    productName: record.productName,
    rating: record.rating,
    comment: record.comment,
    publicName: record.publicName,
    storeLiked: Boolean(record.storeLiked),
    likeCount: Math.max(0, Number(record.likeCount) || 0),
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
    editCount: record.editCount,
    visible: Boolean(record.visible),
    deleted: Boolean(record.deleted),
    likeCount: Math.max(0, Number(record.likeCount) || 0),
  };
}

function ownerReviewMapping(record) {
  return {
    schemaVersion: 2,
    reviewId: record.reviewId,
    productId: record.productId,
    productName: record.productName,
    rating: record.rating,
    comment: record.comment,
    editCount: Number(record.editCount) || 0,
    visible: Boolean(record.visible),
    deleted: Boolean(record.deleted),
    likeCount: Math.max(0, Number(record.likeCount) || 0),
    conversation: reviewPublic(record).conversation,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

async function updateReviewStats(env, productId) {
  const documents = await firestoreAdminList(env, `products/${productId}/reviews`, 300);
  const reviews = documents.map(decoded).filter(Boolean);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  reviews.forEach(review => {
    const rating = Math.max(1, Math.min(5, Number(review.rating) || 0));
    if (!rating) return;
    distribution[rating] += 1;
    total += rating;
  });
  const count = reviews.length;
  await firestoreAdminReplace(env, `productReviewStats/${productId}`, encodeFirestoreFields({
    schemaVersion: 1,
    productId,
    count,
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    distribution,
    updatedAt: new Date(),
  }));
}

async function updateProductLikeStats(env, productId) {
  const documents = await firestoreAdminList(env, 'likeRecords', 1000);
  const count = documents
    .map(decoded)
    .filter(record => record?.productId === productId && record.archived !== true)
    .length;
  await firestoreAdminReplace(env, `productEngagementStats/${productId}`, encodeFirestoreFields({
    schemaVersion: 1,
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

export async function getOwnReview(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const mapping = decoded(await firestoreAdminGet(env, `users/${safeId(user.uid, 'Cuenta')}/reviews/${id}`));
  if (!mapping) return null;
  return ownReviewView(mapping);
}

export async function getOwnFavorite(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const likeId = await opaqueId(user.uid, id, 'favorite');
  return Boolean(await firestoreAdminGet(env, `likeRecords/${likeId}`));
}

export async function getReviewInteractions(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const mapping = decoded(await firestoreAdminGet(env, `users/${safeId(user.uid, 'Cuenta')}/reviewLikeProducts/${id}`));
  return {
    productId: id,
    reviewIds: Array.isArray(mapping?.reviewIds) ? mapping.reviewIds.map(value => clean(value, 180)).filter(Boolean) : [],
  };
}

export async function createReview(env, user, input) {
  const rating = Number(input.rating);
  const comment = clean(input.comment, MAX_COMMENT);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Elegí una puntuación de 1 a 5 estrellas');
  if (comment.length < 3) throw new Error('Escribí un comentario de al menos 3 caracteres');
  const context = await readContext(env, user, input.productId);
  const reviewId = await opaqueId(user.uid, context.productId, 'review');
  const now = new Date();
  const record = {
    schemaVersion: 2, reviewId, ownerUid: user.uid, email: user.email,
    realName: context.realName, publicName: context.publicName,
    actorPhotoUrl: context.photoUrl,
    productId: context.productId, productName: context.productName,
    productImageUrl: context.imageUrl, rating, comment,
    originalRating: rating, originalComment: comment, editCount: 0,
    visible: true, deleted: false, storeLiked: false, likeCount: 0,
    conversation: [], history: [], unread: true, createdAt: now, updatedAt: now,
  };
  const adminNotification = await buildAdminNotificationWrite({
    kind: 'review_created', actorType: 'customer', actorUid: user.uid, actorName: context.realName,
    actorPhotoUrl: context.photoUrl,
    title: `${context.realName} publicó una reseña en ${context.productName}`,
    body: comment, snippet: comment, iconKey: 'review',
    targetUrl: `/product?id=${context.productId}#review-${reviewId}`,
    productId: context.productId, productName: context.productName, productImageUrl: context.imageUrl,
    reviewId, sourceType: 'review', sourceId: reviewId, createdAt: now,
  }, `review_created:${reviewId}`);
  await firestoreAdminCommit(env, [
    { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(record), currentDocument: { exists: false } },
    { path: `products/${context.productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(record)), currentDocument: { exists: false } },
    { path: `users/${safeId(user.uid, 'Cuenta')}/reviews/${context.productId}`, fields: encodeFirestoreFields(ownerReviewMapping(record)), currentDocument: { exists: false } },
    adminNotification.write,
  ]);
  await updateReviewStats(env, context.productId);
  return record;
}

export async function editOwnReview(env, user, input) {
  const productId = safeId(input.productId, 'Producto');
  const reviewId = await opaqueId(user.uid, productId, 'review');
  const privateDoc = await firestoreAdminGet(env, `reviewRecords/${reviewId}`);
  const record = decoded(privateDoc);
  if (!record || record.ownerUid !== user.uid || record.deleted) throw new Error('No se encontró la reseña');
  if (Number(record.editCount) >= 1) throw new Error('Esta reseña ya usó su única edición disponible');
  const rating = Number(input.rating);
  const comment = clean(input.comment, MAX_COMMENT);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Elegí una puntuación de 1 a 5 estrellas');
  if (comment.length < 3) throw new Error('Escribí un comentario de al menos 3 caracteres');
  const now = new Date();
  const updated = {
    ...record, schemaVersion: 2, rating, comment, editCount: 1, unread: true,
    likeCount: Math.max(0, Number(record.likeCount) || 0),
    history: [...(record.history || []), {
      action: 'customer_edit', rating: record.rating, comment: record.comment, changedAt: now, changedBy: 'customer',
    }].slice(-20),
    updatedAt: now,
  };
  const adminNotification = await buildAdminNotificationWrite({
    kind: 'review_edited', actorType: 'customer', actorUid: user.uid, actorName: record.realName,
    actorPhotoUrl: record.actorPhotoUrl,
    title: `${record.realName} editó su reseña en ${record.productName}`,
    body: comment, snippet: comment, iconKey: 'review',
    targetUrl: `/product?id=${productId}#review-${reviewId}`,
    productId, productName: record.productName, productImageUrl: record.productImageUrl,
    reviewId, sourceType: 'review', sourceId: reviewId, createdAt: now,
  }, `review_edited:${reviewId}:1`);
  const writes = [
    { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
    { path: `users/${safeId(user.uid, 'Cuenta')}/reviews/${productId}`, fields: encodeFirestoreFields(ownerReviewMapping(updated)) },
    adminNotification.write,
  ];
  if (record.visible) writes.push({ path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) });
  await firestoreAdminCommit(env, writes);
  if (record.visible) await updateReviewStats(env, productId);
  return updated;
}

export async function addCustomerReply(env, user, input) {
  const productId = safeId(input.productId, 'Producto');
  const reviewId = safeId(input.reviewId, 'Reseña');
  const context = await readContext(env, user, productId);
  const privateDoc = await firestoreAdminGet(env, `reviewRecords/${reviewId}`);
  const record = decoded(privateDoc);
  if (!record || record.productId !== productId || record.deleted || !record.visible) throw new Error('No se encontró la reseña');
  const text = clean(input.text, MAX_REPLY);
  if (!text) throw new Error('La respuesta está vacía');
  const now = new Date();
  const messageId = crypto.randomUUID();
  const conversation = [...(record.conversation || []), {
    id: messageId, authorType: 'customer', actorUid: user.uid,
    actorEmail: user.email, actorPublicName: context.publicName, text, createdAt: now,
  }].slice(-MAX_REPLIES);
  const updated = { ...record, schemaVersion: 2, conversation, unread: true, updatedAt: now };
  const adminNotification = await buildAdminNotificationWrite({
    kind: 'review_reply', actorType: 'customer', actorUid: user.uid, actorName: context.realName,
    actorPhotoUrl: context.photoUrl,
    title: `${context.realName} respondió en ${record.productName}`,
    body: text, snippet: text, iconKey: 'comment',
    targetUrl: `/product?id=${productId}#review-${reviewId}`,
    productId, productName: record.productName, productImageUrl: record.productImageUrl,
    reviewId, sourceType: 'review', sourceId: reviewId, createdAt: now,
  }, `review_reply:${reviewId}:${messageId}`);
  const writes = [
    { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
    { path: `users/${safeId(record.ownerUid, 'Cuenta propietaria')}/reviews/${productId}`, fields: encodeFirestoreFields(ownerReviewMapping(updated)) },
    { path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) },
    adminNotification.write,
  ];
  if (record.ownerUid !== user.uid) {
    const ownerNotification = await buildUserNotificationWrite(record.ownerUid, {
      kind: 'review_reply', actorType: 'customer', actorUid: user.uid, actorName: context.publicName,
      title: `${context.publicName} respondió a tu reseña`,
      body: text, snippet: text, iconKey: 'comment',
      targetUrl: `/product?id=${productId}#review-${reviewId}`,
      productId, productName: record.productName, productImageUrl: record.productImageUrl,
      reviewId, sourceType: 'review', sourceId: reviewId, createdAt: now,
    }, `review_reply:${reviewId}:${messageId}`);
    writes.push(ownerNotification.write);
  }
  await firestoreAdminCommit(env, writes);
  return updated;
}

export async function toggleReviewLike(env, user, input) {
  const productId = safeId(input.productId, 'Producto');
  const reviewId = safeId(input.reviewId, 'Reseña');
  const context = await readContext(env, user, productId);
  const privateDoc = await firestoreAdminGet(env, `reviewRecords/${reviewId}`);
  const record = decoded(privateDoc);
  if (!record || record.productId !== productId || record.deleted || !record.visible) throw new Error('No se encontró la reseña');

  const uid = safeId(user.uid, 'Cuenta');
  const mappingPath = `users/${uid}/reviewLikeProducts/${productId}`;
  const mappingDoc = await firestoreAdminGet(env, mappingPath);
  const mapping = decoded(mappingDoc) || {};
  const currentIds = Array.isArray(mapping.reviewIds) ? mapping.reviewIds.map(value => clean(value, 180)).filter(Boolean) : [];
  const selected = currentIds.includes(reviewId);
  const nextIds = selected
    ? currentIds.filter(value => value !== reviewId)
    : [...new Set([...currentIds, reviewId])].slice(-MAX_REVIEW_LIKES_PER_PRODUCT);
  const now = new Date();
  const updated = {
    ...record,
    schemaVersion: 2,
    likeCount: Math.max(0, (Number(record.likeCount) || 0) + (selected ? -1 : 1)),
    updatedAt: now,
  };
  const writes = [
    { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
    { path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) },
    { path: `users/${safeId(record.ownerUid, 'Cuenta propietaria')}/reviews/${productId}`, fields: encodeFirestoreFields(ownerReviewMapping(updated)) },
    {
      path: mappingPath,
      fields: encodeFirestoreFields({ schemaVersion: 1, productId, reviewIds: nextIds, updatedAt: now }),
      currentDocument: mappingDoc ? { updateTime: mappingDoc.updateTime } : { exists: false },
    },
  ];

  if (!selected) {
    const adminNotification = await buildAdminNotificationWrite({
      kind: 'review_like', actorType: 'customer', actorUid: user.uid, actorName: context.realName,
      actorPhotoUrl: context.photoUrl,
      title: `${context.realName} indicó que le gusta una reseña de ${record.productName}`,
      body: record.comment, snippet: record.comment, iconKey: 'heart',
      targetUrl: `/product?id=${productId}#review-${reviewId}`,
      productId, productName: record.productName, productImageUrl: record.productImageUrl,
      reviewId, sourceType: 'review', sourceId: reviewId, createdAt: now,
    }, `review_like:${reviewId}:${uid}:${now.getTime()}`);
    writes.push(adminNotification.write);
    if (record.ownerUid !== user.uid) {
      const ownerNotification = await buildUserNotificationWrite(record.ownerUid, {
        kind: 'review_like', actorType: 'customer', actorUid: user.uid, actorName: context.publicName,
        title: `${context.publicName} indicó que le gusta tu reseña`,
        body: record.comment, snippet: record.comment, iconKey: 'heart',
        targetUrl: `/product?id=${productId}#review-${reviewId}`,
        productId, productName: record.productName, productImageUrl: record.productImageUrl,
        reviewId, sourceType: 'review', sourceId: reviewId, createdAt: now,
      }, `review_like:${reviewId}:${uid}:${now.getTime()}`);
      writes.push(ownerNotification.write);
    }
  }

  await firestoreAdminCommit(env, writes);
  return { selected: !selected, likeCount: updated.likeCount, review: updated };
}

export async function toggleFavorite(env, user, input) {
  const context = await readContext(env, user, input.productId);
  const likeId = await opaqueId(user.uid, context.productId, 'favorite');
  const existing = decoded(await firestoreAdminGet(env, `likeRecords/${likeId}`));
  const favoritePath = `users/${safeId(user.uid, 'Cuenta')}/favorites/${context.productId}`;
  if (existing) {
    await firestoreAdminCommit(env, [
      { path: `likeRecords/${likeId}`, delete: true },
      { path: favoritePath, delete: true },
    ]);
    const likeCount = await updateProductLikeStats(env, context.productId);
    return { selected: false, likeCount, record: existing };
  }
  const now = new Date();
  const record = {
    schemaVersion: 2, likeId, ownerUid: user.uid, email: user.email,
    realName: context.realName, productId: context.productId,
    productName: context.productName, productImageUrl: context.imageUrl,
    unread: true, createdAt: now, updatedAt: now,
  };
  const adminNotification = await buildAdminNotificationWrite({
    kind: 'product_like', actorType: 'customer', actorUid: user.uid, actorName: context.realName,
    actorPhotoUrl: context.photoUrl,
    title: `${context.realName} indicó que le gusta ${context.productName}`,
    body: `Nuevo Me gusta en ${context.productName}.`, iconKey: 'heart',
    targetUrl: `/product?id=${context.productId}`,
    productId: context.productId, productName: context.productName, productImageUrl: context.imageUrl,
    sourceType: 'favorite', sourceId: likeId, createdAt: now,
  }, `product_like:${likeId}`);
  await firestoreAdminCommit(env, [
    { path: `likeRecords/${likeId}`, fields: encodeFirestoreFields(record), currentDocument: { exists: false } },
    { path: favoritePath, fields: encodeFirestoreFields({
      schemaVersion: 2, productId: context.productId, name: context.productName,
      cat: clean(input.cat, 120), price: Math.max(0, Number(input.price) || 0),
      imageUrl: context.imageUrl, createdAt: now, updatedAt: now,
    }) },
    adminNotification.write,
  ]);
  const likeCount = await updateProductLikeStats(env, context.productId);
  return { selected: true, likeCount, record };
}

export const engagementClean = clean;
export const engagementDecoded = decoded;
export const engagementReviewPublic = reviewPublic;
export const engagementOwnReviewView = ownReviewView;
export const engagementUpdateReviewStats = updateReviewStats;
export const engagementSafeId = safeId;
