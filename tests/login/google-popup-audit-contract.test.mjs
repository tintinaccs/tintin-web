import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = fs.readFileSync(path.join(root, 'scripts/auditar-acceso-aislamiento.js'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'js/core/auth/espera-popup-google.mjs'), 'utf8');
const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');

function audit(overrides = {}) {
  const reader = Object.create(fs);
  reader.readFileSync = (file, ...args) => {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    return Object.hasOwn(overrides, relative) ? overrides[relative] : fs.readFileSync(file, ...args);
  };
  try {
    vm.runInNewContext(script, {
      __dirname: path.join(root, 'scripts'),
      require: name => name === 'fs' ? reader : name === 'path' ? path : assert.fail('Dependencia no prevista'),
      console: { log() {}, error() {} },
      process: { exit(code) { throw Object.assign(new Error('audit exit'), { auditExitCode: code }); } },
    });
    return 0;
  } catch(error) {
    if (Number.isInteger(error.auditExitCode)) return error.auditExitCode;
    throw error;
  }
}

test('el contrato acepta la confirmación del SDK con límite y limpieza', () => {
  assert.equal(audit(), 0);
});

test('el contrato rechaza reintroducir el sondeo prematuro o quitar la limpieza', () => {
  assert.equal(audit({'js/core/auth/espera-popup-google.mjs': helper + '\nhost.setInterval(() => popup?.closed, 250);'}), 1);
  assert.equal(audit({'js/core/auth/espera-popup-google.mjs': helper.replace('host.clearTimeout(deadline);', '')}), 1);
  assert.equal(audit({'js/core/auth/espera-popup-google.mjs': helper.replaceAll('host.open = originalOpen;', '')}), 1);
});

test('el contrato sigue rechazando un redirect después de cualquier error', () => {
  const broad = login.replace("['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(popupError?.code)", 'true');
  assert.notEqual(broad, login);
  assert.equal(audit({'login.html': broad}), 1);
});
