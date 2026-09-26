import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAGNOSIS_KIND, GLOBAL_STATUS, HISTORY_LIMIT, STAGE_STATUS,
  appendHistory, buildDiagnosticText, completeStage, computeProgress, countUnreviewed,
  createOperation, diagnose, diagnosticFileName, failStage, filterHistory, finishOperation,
  nextOperationId, parseHistory, sanitizeText, setStageProgress, stageWindow, startStage,
  summarize, toHistoryEntry, warnStage,
} from '../../js/admin/operaciones/nucleo-operaciones.js';

const at = (seconds = 0) => new Date(Date.UTC(2026, 8, 25, 12, 0, seconds));

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

// Cinco etapas: C y D dependen de B; E depende de D; A es independiente.
function sampleOperation() {
  return createOperation({
    id: 'OP-20260925-000001',
    name: 'Borrado de catálogo',
    now: at(0),
    stages: [
      { id: 'a', label: 'Leer productos', source: 'Firestore' },
      { id: 'b', label: 'Borrar imágenes', destination: 'Cloudinary' },
      { id: 'c', label: 'Borrar documentos', dependsOn: ['b'], destination: 'Firestore' },
      { id: 'd', label: 'Actualizar Sheets', dependsOn: ['b'], destination: 'Google Sheets' },
      { id: 'e', label: 'Enviar aviso', dependsOn: ['d'] },
    ],
  });
}

test('el ID de operación es OP-AAAAMMDD-NNNNNN y correlativo por día', () => {
  const storage = memoryStorage();
  assert.equal(nextOperationId(at(), storage), 'OP-20260925-000001');
  assert.equal(nextOperationId(at(), storage), 'OP-20260925-000002');
  assert.equal(nextOperationId(new Date(2026, 8, 26, 12), storage), 'OP-20260926-000001');
  assert.match(nextOperationId(at(), null), /^OP-20260925-\d{6}$/);
});

test('un error omite solo las etapas que dependen de él, en cascada', () => {
  const op = sampleOperation();
  completeStage(op, 'a', {}, at(1));
  startStage(op, 'b', at(1));
  failStage(op, 'b', { error: { code: 'permission-denied', message: 'Missing or insufficient permissions.' } }, at(3));
  const status = Object.fromEntries(op.stages.map(stage => [stage.id, stage.status]));
  assert.deepEqual(status, { a: 'ok', b: 'error', c: 'skipped', d: 'skipped', e: 'skipped' });
  assert.match(op.stages[4].detail, /depende de "Actualizar Sheets", que no se ejecutó/);
  assert.equal(op.stages[1].durationMs, 2000);
  finishOperation(op, at(4));
  assert.equal(op.status, GLOBAL_STATUS.RED);
  assert.equal(summarize(op).text, '1 de 5 correctos · 1 con error · 3 omitidas');
});

test('una advertencia no detiene a las dependientes y deja el estado en amarillo', () => {
  const op = sampleOperation();
  ['a', 'b', 'c'].forEach(id => completeStage(op, id, {}, at(1)));
  warnStage(op, 'd', { detail: '2 filas no se encontraron en la hoja' }, at(2));
  assert.equal(op.stages[4].status, STAGE_STATUS.PENDING);
  completeStage(op, 'e', {}, at(3));
  finishOperation(op, at(3));
  assert.equal(op.status, GLOBAL_STATUS.YELLOW);
});

test('el progreso es real y 100 % solo significa que terminó', () => {
  const op = sampleOperation();
  assert.equal(computeProgress(op), 0);
  completeStage(op, 'a', {}, at(1));
  startStage(op, 'b', at(1));
  setStageProgress(op, 'b', 5, 10);
  assert.equal(computeProgress(op), 30);
  ['b', 'c', 'd', 'e'].forEach(id => completeStage(op, id, {}, at(2)));
  assert.equal(computeProgress(op), 99, 'sin cerrar la operación nunca llega a 100');
  finishOperation(op, at(2));
  assert.equal(computeProgress(op), 100);
  assert.equal(op.status, GLOBAL_STATUS.GREEN);
});

test('al cerrar, nada se marca correcto sin confirmación de la etapa', () => {
  const op = sampleOperation();
  completeStage(op, 'a', {}, at(1));
  startStage(op, 'b', at(1));
  finishOperation(op, at(2));
  assert.equal(op.stages[1].status, STAGE_STATUS.ERROR);
  assert.equal(op.stages[1].diagnosis[0].kind, DIAGNOSIS_KIND.UNKNOWN);
  assert.equal(op.stages[2].status, STAGE_STATUS.SKIPPED);
  assert.equal(op.status, GLOBAL_STATUS.RED);

  const cancelled = sampleOperation();
  startStage(cancelled, 'a', at(1));
  finishOperation(cancelled, at(2), { cancelled: true, cancelReason: 'Cancelada por el usuario.' });
  assert.equal(cancelled.status, GLOBAL_STATUS.CANCELLED);
  assert.ok(cancelled.stages.every(stage => stage.status === STAGE_STATUS.SKIPPED));
});

test('el diagnóstico distingue hecho, posible causa, causa confirmada y no determinado', () => {
  const known = diagnose({ code: 'permission-denied', message: 'Missing or insufficient permissions.', httpStatus: null });
  assert.deepEqual(known.map(entry => entry.kind), [DIAGNOSIS_KIND.DETECTED, DIAGNOSIS_KIND.POSSIBLE]);
  const unknown = diagnose({ code: '', message: 'Algo raro', httpStatus: null });
  assert.deepEqual(unknown.map(entry => entry.kind), [DIAGNOSIS_KIND.DETECTED, DIAGNOSIS_KIND.UNKNOWN]);
  const confirmed = diagnose({ code: '', message: 'HTTP 409', httpStatus: 409 }, [{ kind: DIAGNOSIS_KIND.CONFIRMED, text: 'El servidor informó que el pedido ya estaba pagado.' }]);
  assert.deepEqual(confirmed.map(entry => entry.kind), [DIAGNOSIS_KIND.DETECTED, DIAGNOSIS_KIND.CONFIRMED]);
});

test('el cargador muestra como máximo tres etapas: anterior, actual y siguiente', () => {
  const op = sampleOperation();
  completeStage(op, 'a', {}, at(1));
  completeStage(op, 'b', {}, at(1));
  startStage(op, 'c', at(1));
  const { previous, current, next } = stageWindow(op);
  assert.deepEqual([previous.id, current.id, next.id], ['b', 'c', 'd']);
  assert.equal(stageWindow(createOperation({ stages: [] })).current, null);
});

test('el saneamiento oculta contraseñas, tokens, cookies, claves y secretos', () => {
  const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJhZmlybWFkYQ';
  // La cabecera PEM se arma por partes: el escáner de secretos del repositorio
  // (auditar-fase-6-seguridad.js) no debe ver una clave privada literal aquí.
  const pem = kind => `-----${kind} ${'PRIVATE'} KEY-----`;
  const raw = [
    'password=hunter22', '"token":"abc.def"', 'Authorization: Bearer ya29.a0AfH6SMB',
    `idToken ${jwt}`, 'cookie: session=xyz', 'AIzaSyA1234567890abcdefghijklmnop',
    `${pem('BEGIN')}\nMIIEv\n${pem('END')}`, 'client_secret: s3cr3t',
  ].join('\n');
  const clean = sanitizeText(raw);
  for (const secret of ['hunter22', 'abc.def', 'ya29.a0AfH6SMB', jwt, 'session=xyz', 'AIzaSyA1234567890', 'MIIEv', 's3cr3t']) {
    assert.ok(!clean.includes(secret), `quedó visible: ${secret}`);
  }
  assert.match(sanitizeText('x'.repeat(50), 10), /^x{10}… \[recortado\]$/);
});

test('la exportación TXT va saneada y con nombre Tintin_Error_<Op>_<fecha>.txt', () => {
  const op = sampleOperation();
  completeStage(op, 'a', {}, at(1));
  startStage(op, 'b', at(1));
  failStage(op, 'b', {
    error: { name: 'FirebaseError', code: 'unauthenticated', message: 'Bearer abc123 rechazado', stack: 'Error\n at x (token=zzz)' },
    received: 'HTTP 401',
  }, at(2));
  finishOperation(op, at(3));
  const text = buildDiagnosticText(op, { page: '/admin', role: 'superadmin', userAgent: 'test' });
  assert.match(text, /^TINTIN SYSTEM DIAGNOSTICS/);
  assert.match(text, /ID de operación: OP-20260925-000001/);
  assert.match(text, /Estado global: ✕ Con errores/);
  assert.match(text, /✕ 2\. Borrar imágenes — Error/);
  assert.match(text, /— 3\. Borrar documentos — Omitida/);
  assert.match(text, /POSIBLE CAUSA: La sesión no es válida/);
  assert.ok(!/abc123|zzz/.test(text), 'el texto exportado no debe incluir tokens');
  assert.equal(diagnosticFileName(op, new Date(2026, 8, 25, 9, 5, 7)), 'Tintin_Error_BorradoDeCatalogo_2026-09-25_09-05-07.txt');
});

test('el historial guarda las últimas 100, sin duplicados, y cuenta lo no revisado', () => {
  let history = [];
  for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
    history = appendHistory(history, { id: `OP-${index}`, status: index % 3 === 0 ? 'red' : 'green', reviewed: index % 3 !== 0, stages: [] });
  }
  assert.equal(history.length, HISTORY_LIMIT);
  assert.equal(history[0].id, `OP-${HISTORY_LIMIT + 4}`);
  history = appendHistory(history, { id: `OP-${HISTORY_LIMIT + 4}`, status: 'yellow', reviewed: false, stages: [] });
  assert.equal(history.filter(item => item.id === `OP-${HISTORY_LIMIT + 4}`).length, 1);
  assert.deepEqual(countUnreviewed(history), { yellow: 1, red: filterHistory(history, 'red').length });

  const op = sampleOperation();
  ['a', 'b', 'c', 'd', 'e'].forEach(id => completeStage(op, id, {}, at(1)));
  finishOperation(op, at(1));
  const entry = toHistoryEntry(op);
  assert.equal(entry.reviewed, true, 'una operación verde no queda pendiente de revisar');
  assert.deepEqual(parseHistory(JSON.stringify([entry, { id: 5 }, null])), [entry]);
  assert.deepEqual(parseHistory('{roto'), []);
});
