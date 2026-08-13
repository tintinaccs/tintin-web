import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminList,
  firestoreAdminReplace,
} from './firebase-admin-ligero.js';

const MAX_COMMENT = 1600;
const MAX_REPLY = 1200;
const MAX_REPLIES = 50;

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

function maskWord(word, compact = false) {
  const chars = Array.from(clean(word, 80));
  if (!chars.length) return '';
  if (chars.length <= 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(compact ? 3 : Math.max(3, chars.length - 2))}${chars.at(-1)}`;
}

export function publicCustomerName(realName) {
  return clean(realName, 160).split(/\s+/).filter(Boolean).map((word, index) => maskWord(word, index === 0)).join(' ');
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
  };
}

function reviewPublic(record) {
  return {
    schemaVersion: 1,
    reviewId: record.reviewId,
    productId: record.productId,
    productName: record.productName,
    rating: record.rating,
    comment: record.comment,
    publicName: record.publicName,
    storeLiked: Boolean(record.storeLiked),
    conversation: Array.isArray(record.conversation) ? record.conversation.map(message => ({
      id: clean(message.id, 80),
      authorType: message.authorType === 'store' ? 'store' : 'customer',
      authorName: message.authorType === 'store' ? 'Tintin Accesorios' : record.publicName,
      text: clean(message.text, MAX_REPLY),
      createdAt: message.createdAt,
    })).slice(-MAX_REPLIES) : [],
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
    conversation: reviewPublic(record).conversation,
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

export async function getOwnReview(env, user, productId) {
  const id = safeId(productId, 'Producto');
  const mapping = decoded(await firestoreAdminGet(env, `users/${safeId(user.uid, 'Cuenta')}/reviews/${id}`));
  if (!mapping) return null;
  return ownReviewView(mapping);
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
    schemaVersion: 1, reviewId, ownerUid: user.uid, email: user.email,
    realName: context.realName, publicName: context.publicName,
    productId: context.productId, productName: context.productName,
    productImageUrl: context.imageUrl, rating, comment,
    originalRating: rating, originalComment: comment, editCount: 0,
    visible: true, deleted: false, storeLiked: false,
    conversation: [], history: [], unread: true, createdAt: now, updatedAt: now,
  };
  await firestoreAdminCommit(env, [
    { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(record), currentDocument: { exists: false } },
    { path: `products/${context.productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(record)), currentDocument: { exists: false } },
    { path: `users/${safeId(user.uid, 'Cuenta')}/reviews/${context.productId}`, fields: encodeFirestoreFields({
      schemaVersion: 1, reviewId, productId: context.productId, productName: context.productName,
      rating, comment, editCount: 0, visible: true, deleted: false,
      conversation: [], createdAt: now, updatedAt: now,
    }), currentDocument: { exists: false } },
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
    ...record, rating, comment, editCount: 1, unread: true,
    history: [...(record.history || []), {
      action: 'customer_edit', rating: record.rating, comment: record.comment, changedAt: now, changedBy: 'customer',
    }].slice(-20),
    updatedAt: now,
  };
  const writes = [
    { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
    { path: `users/${safeId(user.uid, 'Cuenta')}/reviews/${productId}`, fields: encodeFirestoreFields({
      schemaVersion: 1, reviewId, productId, productName: record.productName, rating, comment,
      editCount: 1, visible: Boolean(record.visible), deleted: false,
      conversation: reviewPublic(updated).conversation, createdAt: new Date(record.createdAt), updatedAt: now,
    }) },
  ];
  if (record.visible) writes.push({ path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) });
  await firestoreAdminCommit(env, writes);
  if (record.visible) await updateReviewStats(env, productId);
  return updated;
}

export async function addCustomerReply(env, user, input) {
  const productId = safeId(input.productId, 'Producto');
  const reviewId = await opaqueId(user.uid, productId, 'review');
  const privateDoc = await firestoreAdminGet(env, `reviewRecords/${reviewId}`);
  const record = decoded(privateDoc);
  if (!record || record.ownerUid !== user.uid || record.deleted) throw new Error('No se encontró la reseña');
  const text = clean(input.text, MAX_REPLY);
  if (!text) throw new Error('La respuesta está vacía');
  const now = new Date();
  const conversation = [...(record.conversation || []), {
    id: crypto.randomUUID(), authorType: 'customer', actorUid: user.uid,
    actorEmail: user.email, text, createdAt: now,
  }].slice(-MAX_REPLIES);
  const updated = { ...record, conversation, unread: true, updatedAt: now };
  const writes = [
    { path: `reviewRecords/${reviewId}`, fields: encodeFirestoreFields(updated), currentDocument: { updateTime: privateDoc.updateTime } },
    { path: `users/${safeId(user.uid, 'Cuenta')}/reviews/${productId}`, fields: encodeFirestoreFields({
      schemaVersion: 1, reviewId, productId, productName: record.productName, rating: record.rating,
      comment: record.comment, editCount: record.editCount, visible: Boolean(record.visible), deleted: false,
      conversation: reviewPublic(updated).conversation, createdAt: new Date(record.createdAt), updatedAt: now,
    }) },
  ];
  if (record.visible) writes.push({ path: `products/${productId}/reviews/${reviewId}`, fields: encodeFirestoreFields(reviewPublic(updated)) });
  await firestoreAdminCommit(env, writes);
  return updated;
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
    return { selected: false, record: existing };
  }
  const now = new Date();
  const record = {
    schemaVersion: 2, likeId, ownerUid: user.uid, email: user.email,
    realName: context.realName, productId: context.productId,
    productName: context.productName, productImageUrl: context.imageUrl,
    unread: true, createdAt: now, updatedAt: now,
  };
  await firestoreAdminCommit(env, [
    { path: `likeRecords/${likeId}`, fields: encodeFirestoreFields(record), currentDocument: { exists: false } },
    { path: favoritePath, fields: encodeFirestoreFields({
      schemaVersion: 2, productId: context.productId, name: context.productName,
      cat: clean(input.cat, 120), price: Math.max(0, Number(input.price) || 0),
      imageUrl: context.imageUrl, createdAt: now, updatedAt: now,
    }) },
  ]);
  return { selected: true, record };
}

export const engagementClean = clean;
export const engagementDecoded = decoded;
export const engagementReviewPublic = reviewPublic;
export const engagementOwnReviewView = ownReviewView;
export const engagementUpdateReviewStats = updateReviewStats;
export const engagementSafeId = safeId;
