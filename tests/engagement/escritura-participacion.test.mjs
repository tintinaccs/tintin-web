// Escritura real de "me gusta" y reseñas.
// Ejecuta el código de producción (cloudflare/participacion-clientes.js y
// firebase-admin-ligero.js) contra un Firestore REST en memoria: las mismas
// peticiones, precondiciones y commits atómicos que salen hacia Google.
// El panel Flujo/Conexiones sólo acepta el Repository audit como evidencia de
// esta escritura porque esta prueba corre dentro de `npm run test:engagement`.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  createReview,
  getOwnFavorite,
  getProductLikeStats,
  toggleFavorite,
} from '../../cloudflare/participacion-clientes.js';
import { decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

const PROJECT = 'test-project';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const NAME_PREFIX = `projects/${PROJECT}/databases/(default)/documents/`;
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const ENV = {
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: PROJECT,
    client_email: `test@${PROJECT}.iam.gserviceaccount.com`,
    private_key: privateKey,
  }),
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Firestore REST mínimo: GET, LIST, PATCH y commit atómico con precondiciones. */
function fakeFirestore(seed = {}) {
  const store = new Map();
  const commits = [];
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2026, 9, 6, 12, 0, clock += 1)).toISOString();
  const put = (path, fields) => store.set(path, { fields, updateTime: stamp() });
  Object.entries(seed).forEach(([path, data]) => put(path, encodeFirestoreFields(data)));
  const view = path => ({ name: NAME_PREFIX + path, fields: store.get(path).fields, updateTime: store.get(path).updateTime });

  async function handle(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || 'GET').toUpperCase();
    if (url.href === 'https://oauth2.googleapis.com/token') return json({ access_token: 'test-only-access-token', expires_in: 3600 });
    if (!url.href.startsWith(DOCS)) throw new Error(`Petición de red inesperada: ${url.href}`);
    const path = decodeURIComponent(url.pathname.slice(new URL(DOCS).pathname.length + 1));

    if (path === ':commit' || url.pathname.endsWith('/documents:commit')) {
      const body = JSON.parse(init.body);
      commits.push(body.writes);
      const target = write => String(write.update?.name || write.delete).slice(NAME_PREFIX.length);
      const conflict = body.writes.some(write => {
        const existing = store.get(target(write));
        const pre = write.currentDocument || {};
        if ('exists' in pre && Boolean(existing) !== pre.exists) return true;
        return 'updateTime' in pre && existing?.updateTime !== pre.updateTime;
      });
      if (conflict) return json({ error: { status: 'FAILED_PRECONDITION' } }, 400);
      const writeResults = body.writes.map(write => {
        if (write.delete) { store.delete(target(write)); return {}; }
        const existing = store.get(target(write));
        const mask = write.updateMask?.fieldPaths;
        const fields = mask ? { ...(existing?.fields || {}), ...Object.fromEntries(mask.map(key => [key, write.update.fields[key]])) } : (write.update.fields || {});
        put(target(write), fields);
        return { updateTime: store.get(target(write)).updateTime };
      });
      return json({ writeResults });
    }
    if (method === 'PATCH') {
      const mask = url.searchParams.getAll('updateMask.fieldPaths');
      const incoming = JSON.parse(init.body).fields || {};
      put(path, mask.length ? { ...(store.get(path)?.fields || {}), ...Object.fromEntries(mask.map(key => [key, incoming[key]])) } : incoming);
      return json(view(path));
    }
    if (method === 'GET' && path.split('/').length % 2 === 1) {
      const prefix = `${path}/`;
      const documents = [...store.keys()].filter(key => key.startsWith(prefix) && !key.slice(prefix.length).includes('/')).map(view);
      return json({ documents });
    }
    if (method === 'GET') return store.has(path) ? json(view(path)) : json({ error: { status: 'NOT_FOUND' } }, 404);
    throw new Error(`Operación Firestore no soportada en la prueba: ${method} ${path}`);
  }

  return {
    commits,
    handle,
    paths: prefix => [...store.keys()].filter(key => key.startsWith(prefix)).sort(),
    read: path => (store.has(path) ? decodeFirestoreFields(store.get(path).fields) : null),
  };
}

async function withFirestore(seed, run) {
  const firestore = fakeFirestore(seed);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = firestore.handle;
  try {
    return await run(firestore);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const SEED = {
  'products/aros1': { name: 'Aros Luna', price: 50000, active: true, imageUrl: 'https://res.cloudinary.com/tintin/aros.webp' },
  'products/oculto': { name: 'Producto pausado', price: 1000, active: false },
  'users/clienta1': { firstName: 'Ana', lastName: 'Gómez', username: 'anag', blocked: false },
  'users/bloqueada1': { firstName: 'Eva', blocked: true },
};
const CLIENTA = { uid: 'clienta1', email: 'ana@example.com' };
const SUPER = { uid: 'super1', email: 'tintinaccs@gmail.com' };
const committedPaths = writes => writes.map(write => String(write.update?.name || write.delete).slice(NAME_PREFIX.length));

test('un "me gusta" se guarda en un commit atómico: registro privado, favorito de la clienta y aviso al admin', async () => {
  await withFirestore(SEED, async firestore => {
    const result = await toggleFavorite(ENV, CLIENTA, { productId: 'aros1', cat: 'aros', price: 50000 });
    assert.equal(result.selected, true);
    assert.equal(result.alreadyLiked, false);
    assert.equal(result.likeCount, 1);

    const [first] = firestore.commits;
    const paths = committedPaths(first);
    const likePath = `likeRecords/${result.record.likeId}`;
    assert.equal(paths[0], likePath);
    assert.equal(paths[1], 'users/clienta1/favorites/aros1');
    assert.match(paths[2], /^adminNotifications\//);
    assert.deepEqual(first[0].currentDocument, { exists: false }, 'el registro no puede pisar uno existente');

    const record = firestore.read(likePath);
    assert.equal(record.ownerUid, 'clienta1');
    assert.equal(record.productId, 'aros1');
    assert.equal(record.targetType, 'product');
    assert.ok(Number.isFinite(Date.parse(record.createdAt)), 'createdAt real: es lo que lee el panel');
    assert.equal(firestore.read('users/clienta1/favorites/aros1').productId, 'aros1');
    assert.equal(firestore.read('productEngagementStats/aros1').likeCount, 1);
    assert.deepEqual(await getProductLikeStats(ENV, 'aros1'), { productId: 'aros1', likeCount: 1 });
    assert.equal(await getOwnFavorite(ENV, CLIENTA, 'aros1'), true);
    assert.equal(await getOwnFavorite(ENV, CLIENTA, 'oculto'), false);
  });
});

test('repetir el "me gusta" es idempotente: no crea un segundo registro ni cambia el contador', async () => {
  await withFirestore(SEED, async firestore => {
    const first = await toggleFavorite(ENV, CLIENTA, { productId: 'aros1' });
    const likeCommits = () => firestore.commits.filter(writes => committedPaths(writes).some(path => path.startsWith('likeRecords/'))).length;
    assert.equal(likeCommits(), 1);
    const again = await toggleFavorite(ENV, CLIENTA, { productId: 'aros1' });
    assert.equal(again.alreadyLiked, true);
    assert.equal(again.likeCount, 1);
    assert.equal(again.record.likeId, first.record.likeId);
    assert.equal(likeCommits(), 1);
    assert.equal(firestore.paths('likeRecords/').length, 1);
  });
});

test('producto inexistente o pausado y cuenta bloqueada no escriben nada', async () => {
  await withFirestore(SEED, async firestore => {
    await assert.rejects(toggleFavorite(ENV, CLIENTA, { productId: 'no-existe' }), /ya no existe/);
    await assert.rejects(toggleFavorite(ENV, CLIENTA, { productId: 'oculto' }), /no está disponible/);
    await assert.rejects(toggleFavorite(ENV, { uid: 'bloqueada1', email: 'eva@example.com' }, { productId: 'aros1' }), /no puede realizar/);
    await assert.rejects(createReview(ENV, { uid: 'bloqueada1', email: 'eva@example.com' }, { productId: 'aros1', rating: 5, comment: 'Muy lindos' }), /no puede realizar/);
    await assert.rejects(toggleFavorite(ENV, CLIENTA, { productId: '../users/x' }), /inválido/);
    assert.equal(firestore.commits.length, 0);
    assert.deepEqual(firestore.paths('likeRecords/'), []);
    assert.deepEqual(firestore.paths('reviewRecords/'), []);
  });
});

test('una reseña de clienta se guarda privada y pendiente de aprobación, con su límite y el aviso al admin', async () => {
  await withFirestore(SEED, async firestore => {
    const review = await createReview(ENV, CLIENTA, { productId: 'aros1', rating: 5, comment: 'Hermosos, llegaron rápido.' });
    assert.equal(review.rating, 5);
    assert.equal(review.visible, false, 'moderación previa: no se publica sola');
    assert.equal(review.rateLimit.unlimited, false);

    const [writes] = firestore.commits;
    const paths = committedPaths(writes);
    assert.equal(paths[0], `reviewRecords/${review.reviewId}`);
    assert.ok(paths.includes(`users/clienta1/reviews/${review.reviewId}`));
    assert.ok(paths.includes('users/clienta1/socialLimits/reviews'));
    assert.ok(paths.some(path => path.startsWith('adminNotifications/')));
    assert.ok(!paths.some(path => path.startsWith('products/')), 'nada público hasta que el admin la apruebe');
    assert.deepEqual(writes[0].currentDocument, { exists: false });

    const stored = firestore.read(`reviewRecords/${review.reviewId}`);
    assert.equal(stored.comment, 'Hermosos, llegaron rápido.');
    assert.equal(stored.ownerUid, 'clienta1');
    assert.equal(stored.authorType, 'customer');
    assert.ok(Number.isFinite(Date.parse(stored.createdAt)));
    assert.deepEqual(firestore.paths('products/aros1/reviews/'), []);
  });
});

test('una reseña inválida no llega a Firestore y la de la tienda se publica en el mismo commit', async () => {
  await withFirestore(SEED, async firestore => {
    await assert.rejects(createReview(ENV, CLIENTA, { productId: 'aros1', rating: 0, comment: 'Sin puntaje' }), /1 a 5 estrellas/);
    await assert.rejects(createReview(ENV, CLIENTA, { productId: 'aros1', rating: 6, comment: 'Fuera de rango' }), /1 a 5 estrellas/);
    await assert.rejects(createReview(ENV, CLIENTA, { productId: 'aros1', rating: 4, comment: 'ok' }), /al menos 3 caracteres/);
    assert.equal(firestore.commits.length, 0);

    const store = await createReview(ENV, SUPER, { productId: 'aros1', rating: 5, comment: 'Reseña de la tienda' });
    assert.equal(store.visible, true);
    assert.equal(store.rateLimit.unlimited, true);
    const paths = committedPaths(firestore.commits[0]);
    assert.ok(paths.includes(`reviewRecords/${store.reviewId}`));
    assert.ok(paths.includes(`products/aros1/reviews/${store.reviewId}`));
    assert.ok(!paths.includes('users/super1/socialLimits/reviews'));
    assert.equal(firestore.read(`products/aros1/reviews/${store.reviewId}`).rating, 5);
  });
});

test('si Firestore rechaza el commit, la operación falla y no queda ningún registro', async () => {
  await withFirestore(SEED, async firestore => {
    const realHandle = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => (String(input).endsWith('/documents:commit')
      ? json({ error: { status: 'UNAVAILABLE' } }, 503)
      : realHandle(input, init));
    await assert.rejects(toggleFavorite(ENV, CLIENTA, { productId: 'aros1' }), error => error.code === 'firestore_commit_failed' && error.status === 502);
    await assert.rejects(createReview(ENV, CLIENTA, { productId: 'aros1', rating: 5, comment: 'No debería guardarse' }), error => error.code === 'firestore_commit_failed');
    assert.deepEqual(firestore.paths('likeRecords/'), []);
    assert.deepEqual(firestore.paths('reviewRecords/'), []);
  });
});
