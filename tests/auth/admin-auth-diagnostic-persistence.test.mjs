import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');

const admin = read('js/admin/admin-app.js');
const rules = read('firestore.rules');

const classifySource = admin.match(/function classifyAdminSessionFailure\(authReason, handoffPending\) \{[\s\S]*?\n\}/)?.[0];
const classifyAdminSessionFailure = classifySource
  ? new Function(`${classifySource}; return classifyAdminSessionFailure;`)()
  : null;

test('Solo un fallo real de restauración se guarda en Firestore', () => {
  assert.ok(classifyAdminSessionFailure, 'classifyAdminSessionFailure debe existir en admin-app.js');
  // Visitante sin sesión o sesión cerrada en otra pestaña: no es un fallo.
  assert.equal(classifyAdminSessionFailure('AUTHORITATIVE_EMPTY', false), null);
  assert.equal(classifyAdminSessionFailure('AUTH_REVOKED_OR_SIGNED_OUT', false), null);
  assert.equal(classifyAdminSessionFailure('EXPLICIT_LOGOUT', false), null);
  assert.equal(classifyAdminSessionFailure(undefined, false), null);
  // login.html dejó handoff y la sesión no apareció.
  assert.equal(classifyAdminSessionFailure('AUTHORITATIVE_EMPTY', true), 'handoff-recovery-timeout');
  assert.equal(classifyAdminSessionFailure('AUTH_RESTORE_FALLBACK', true), 'handoff-restore-error');
  // Firebase no pudo leer la sesión guardada.
  assert.equal(classifyAdminSessionFailure('AUTH_RESTORE_FALLBACK', false), 'auth-restore-fallback');
});

test('El guard lee el handoff antes de esperar y guarda solo con motivo clasificado', () => {
  const guard = admin.match(/if \(snapshot\.status === AUTH_STATES\.UNKNOWN\) \{[\s\S]*?recordAuthDiagnostic\('AUTH_USER_AVAILABLE'/)?.[0];
  assert.ok(guard, 'no se encontró el guard de sesión de admin');
  const unknownBranch = guard.slice(0, guard.indexOf('let user = snapshot.user;'));
  assert.doesNotMatch(unknownBranch, /persistAuthDiagnosticFailure/);
  assert.match(
    guard,
    /const handoffPending = !user && Boolean\(readAuthHandoff\(\)\?\.uid\);\s*(?:\/\/[^\n]*\n\s*)*if \(!user\) \{\s*user = await recoverAdminUserFromHandoff\(\);/
  );
  assert.match(
    guard,
    /const failureReason = classifyAdminSessionFailure\(snapshot\.reason, handoffPending\);\s*if \(failureReason\) persistAuthDiagnosticFailure\(failureReason\);/
  );
  assert.equal(admin.match(/persistAuthDiagnosticFailure\(/g)?.length, 2, 'una definición y una sola llamada');
});

test('firestore.rules acepta exactamente los motivos y la fuente que produce el cliente', () => {
  const enumMatch = rules.match(/data\.reason in \[([^\]]*)\]/);
  assert.ok(enumMatch, 'la regla debe limitar reason a una lista fija');
  const allowed = [...enumMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]).sort();
  // Los motivos del cliente son los literales en minúsculas de la función.
  const produced = [...classifySource.matchAll(/'([a-z0-9-]+)'/g)].map(match => match[1]);
  assert.deepEqual(allowed, [...new Set(produced)].sort());
  assert.match(rules, /data\.source == 'admin-guard'/);
  assert.match(admin, /source: 'admin-guard',\s*route:/);
  assert.match(rules, /match \/authDiagnosticFailures\/\{eventId\} \{\s*allow read: if isSuperAdmin\(\);\s*allow create: if !isBlockedUser\(\) && authDiagnosticFailureIsValid\(\);\s*allow update, delete: if false;/);
});
