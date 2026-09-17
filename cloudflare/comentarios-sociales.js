import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminList,
} from './firebase-admin-ligero.js';
import { buildAdminNotificationWrite, dispatchAdminNotificationPush } from './notificaciones-sociales.js';

const MAX_DETAILS = 600;
const MAX_REPORTS = 300;
const REPORT_REASONS = new Set(['spam', 'offensive', 'harassment', 'inappropriate', 'misleading', 'other']);
const REPORT_STATUSES = new Set(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']);

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

const decoded = document => document ? { id: String(document.name || '').split('/').pop(), ...decodeFirestoreFields(document.fields || {}) } : null;

async function hashId(seed) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(seed)));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

function reportReason(value) {
  const reason = clean(value, 40).toLowerCase();
  if (!REPORT_REASONS.has(reason)) throw new Error('Motivo de denuncia inválido');
  return reason;
}

function reportStatus(value) {
  const status = clean(value, 20).toUpperCase();
  if (!REPORT_STATUSES.has(status)) throw new Error('Estado de denuncia inválido');
  return status;
}

async function loadTarget(env, productId, commentId, threadRootId) {
  const rootId = safeId(threadRootId || commentId, 'Hilo');
  const root = decoded(await firestoreAdminGet(env, `reviewRecords/${rootId}`));
  if (!root || root.productId !== productId || root.deleted || root.visible === false) throw new Error('No se encontró el comentario');
  if (commentId === root.reviewId) {
    return { root, targetType: 'comment', text: root.comment, reportedAuthorUid: root.ownerUid, reportedAuthorName: root.realName };
  }
  const reply = (Array.isArray(root.conversation) ? root.conversation : [])
    .find(item => clean(item?.replyId || item?.id, 180) === commentId);
  if (!reply) throw new Error('No se encontró la respuesta');
  return {
    root,
    targetType: 'reply',
    text: reply.text,
    reportedAuthorUid: clean(reply.actorUid, 180),
    reportedAuthorName: clean(reply.actorRealName || reply.actorPublicName || 'Usuario Tintin', 160),
  };
}

export async function createCommentReport(env, reporter, input) {
  const productId = safeId(input.productId, 'Producto');
  const commentId = safeId(input.commentId || input.reviewId, 'Comentario');
  const target = await loadTarget(env, productId, commentId, input.threadRootId || input.reviewId);
  const reporterUid = safeId(reporter.uid, 'Denunciante');
  if (target.reportedAuthorUid && target.reportedAuthorUid === reporterUid) {
    throw Object.assign(new Error('No podés denunciar tu propio comentario'), { status: 403, code: 'social/self-report' });
  }
  const reason = reportReason(input.reason);
  const details = clean(input.details, MAX_DETAILS);
  if (reason === 'other' && details.length < 3) throw new Error('Agregá un detalle para el motivo “otro”');
  const reportId = await hashId(`comment-report:${reporterUid}:${commentId}`);
  const path = `commentReports/${reportId}`;
  const existing = decoded(await firestoreAdminGet(env, path));
  if (existing) return { created: false, alreadyReported: true, report: publicReportResult(existing) };
  const now = new Date();
  const report = {
    schemaVersion: 1,
    reportId,
    commentId,
    productId,
    threadRootId: target.root.reviewId,
    targetType: target.targetType,
    reporterUid,
    reportedAuthorUid: target.reportedAuthorUid || '',
    reportedAuthorName: target.reportedAuthorName || '',
    reason,
    details,
    commentText: clean(target.text, 1200),
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
  };
  const adminNotification = await buildAdminNotificationWrite({
    kind: 'comment_reported',
    eventType: 'COMMENT_REPORTED',
    eventId: `comment.reported:${reportId}`,
    actorType: 'customer',
    actorUid: reporterUid,
    actorName: 'Una cuenta',
    title: 'Nueva denuncia de comentario',
    body: `Motivo: ${reason}. Revisá el hilo antes de moderar.`,
    snippet: clean(target.text, 260),
    iconKey: 'flag',
    targetUrl: `/admin.html#section-resenas?report=${reportId}`,
    targetType: target.targetType,
    targetId: commentId,
    productId,
    productName: target.root.productName,
    reviewId: target.root.reviewId,
    replyId: target.targetType === 'reply' ? commentId : '',
    sourceType: 'comment_report',
    sourceId: reportId,
    createdAt: now,
  }, `comment_reported:${reportId}`);
  try {
    await firestoreAdminCommit(env, [
      { path, fields: encodeFirestoreFields(report), currentDocument: { exists: false } },
      adminNotification.write,
    ]);
  } catch (error) {
    if (error?.code === 'version_conflict') {
      const current = decoded(await firestoreAdminGet(env, path));
      if (current) return { created: false, alreadyReported: true, report: publicReportResult(current) };
    }
    throw error;
  }
  await dispatchAdminNotificationPush(env, adminNotification).catch(error => {
    console.warn('[comments] No se pudo enviar el push de denuncia:', error);
  });
  return { created: true, alreadyReported: false, report: publicReportResult(report) };
}

function publicReportResult(report) {
  return {
    reportId: report.reportId,
    commentId: report.commentId,
    threadRootId: report.threadRootId,
    productId: report.productId,
    reason: report.reason,
    status: report.status,
    createdAt: report.createdAt,
  };
}

export async function listCommentReports(env, filters = {}) {
  const term = clean(filters.search, 160).toLowerCase();
  const status = filters.status ? reportStatus(filters.status) : '';
  const documents = await firestoreAdminList(env, 'commentReports', MAX_REPORTS);
  return documents.map(decoded).filter(Boolean).filter(report => {
    if (status && report.status !== status) return false;
    if (!term) return true;
    return [report.reportId, report.commentId, report.productId, report.reason, report.commentText]
      .some(value => String(value || '').toLowerCase().includes(term));
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function updateCommentReport(env, actor, input) {
  const reportId = safeId(input.reportId, 'Denuncia');
  const document = await firestoreAdminGet(env, `commentReports/${reportId}`);
  const report = decoded(document);
  if (!report) throw new Error('No se encontró la denuncia');
  const status = reportStatus(input.status);
  const updated = {
    status,
    resolutionNote: clean(input.resolutionNote, 600),
    resolvedByUid: actor.uid,
    updatedAt: new Date(),
  };
  const current = document.updateTime ? { updateTime: document.updateTime } : undefined;
  await firestoreAdminCommit(env, [{
    path: `commentReports/${reportId}`,
    fields: encodeFirestoreFields(updated),
    ...(current ? { currentDocument: current } : {}),
  }]);
  return { ...report, ...updated };
}

export const commentReportReasons = [...REPORT_REASONS];
export const commentReportStatuses = [...REPORT_STATUSES];
