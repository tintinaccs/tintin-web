import {
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/**
 * Lee una colección en páginas acotadas y conserva una forma compatible con
 * QuerySnapshot. El máximo evita exportaciones o tareas administrativas sin
 * límite de memoria y lecturas.
 */
export async function getDocsPaginated(collectionRef, {
  pageSize = 250,
  maxDocs = 20000
} = {}) {
  const safePageSize = Math.max(1, Math.min(500, Number(pageSize) || 250));
  const safeMaxDocs = Math.max(safePageSize, Number(maxDocs) || 20000);
  const docs = [];
  let cursor = null;

  while (docs.length < safeMaxDocs) {
    const remaining = safeMaxDocs - docs.length;
    const constraints = [
      orderBy(documentId()),
      limit(Math.min(safePageSize, remaining))
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const snapshot = await getDocs(query(collectionRef, ...constraints));
    docs.push(...snapshot.docs);
    if (snapshot.size < Math.min(safePageSize, remaining)) break;
    cursor = snapshot.docs.at(-1);
    if (!cursor) break;
  }

  let truncated = false;
  if (docs.length >= safeMaxDocs && cursor) {
    const overflowProbe = await getDocs(query(
      collectionRef,
      orderBy(documentId()),
      startAfter(cursor),
      limit(1)
    ));
    truncated = !overflowProbe.empty;
  }

  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    truncated,
    pageSize: safePageSize,
    maxDocs: safeMaxDocs
  };
}
