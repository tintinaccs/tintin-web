import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVisualBuilderError,
  loadPage,
  onRequest,
} from '../../functions/api/visual-builder.js';

test('si falla solo el historial, el editor sigue cargando estado y contenido', async () => {
  const access = {
    async get() { return null; },
    async list() { throw new Error('Firestore LIST falló (503)'); },
  };

  const page = await loadPage({}, 'index', { access, requestId: 'vb-test' });
  assert.equal(page.state.pageId, 'index');
  assert.equal(page.state.version, 0);
  assert.equal(page.draft, null);
  assert.deepEqual(page.history, []);
  assert.equal(page.warnings.length, 1);
  assert.equal(page.warnings[0].code, 'history_unavailable');
  assert.ok(page.content && typeof page.content === 'object');
});

test('errores de backend, sesión y autorización reciben códigos HTTP útiles', () => {
  assert.deepEqual(
    classifyVisualBuilderError(new Error('FIREBASE_SERVICE_ACCOUNT_KEY no está configurada')),
    { status: 503, code: 'backend_unavailable', message: 'El backend del editor no está disponible. Revisá el estado del Admin y volvé a intentar.' }
  );
  assert.deepEqual(
    classifyVisualBuilderError(new Error('La sesión venció; volvé a iniciar sesión')),
    { status: 401, code: 'authentication_required', message: 'Tu sesión venció o no está disponible. Volvé a iniciar sesión.' }
  );
  assert.deepEqual(
    classifyVisualBuilderError(new Error('Solo el Super Admin puede administrar imágenes')),
    { status: 403, code: 'forbidden', message: 'La cuenta actual no tiene acceso de Super Admin.' }
  );
  assert.deepEqual(
    classifyVisualBuilderError(new Error('boom')),
    { status: 500, code: 'visual_builder_internal', message: 'El editor encontró un error interno.' }
  );
});

test('el endpoint privado rechaza una petición sin sesión con referencia trazable', async () => {
  const request = new Request('https://tintinaccesorios.pages.dev/api/visual-builder?page=index', {
    method: 'GET',
    headers: { origin: 'https://tintinaccesorios.pages.dev' },
  });
  const response = await onRequest({ request, env: {} });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'authentication_required');
  assert.match(payload.requestId, /^vb-/);
  assert.match(payload.error, /Ref\. vb-/);
});
