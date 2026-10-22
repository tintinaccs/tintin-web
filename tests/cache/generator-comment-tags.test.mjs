import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('el generador renueva imports y scripts sin reescribir comentarios de perfil', () => {
  const source = fs.readFileSync(new URL('../../scripts/sincronizar-inicio-navegacion-publica.js', import.meta.url), 'utf8');
  const code = source.match(/function versionProfileGate\(html\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(code);
  const render = vm.runInNewContext(`const PROFILE_GATE_VERSION = 'new-version'; ${code}; versionProfileGate;`);
  const comment = '// js/pages/profile/control-acceso-perfil.js?v=old-version explica el guardia';
  assert.equal(render(comment), comment);
  for (const prefix of ['js/', './js/', '/js/']) {
    const url = `${prefix}pages/profile/control-acceso-perfil.js`;
    assert.equal(render(`import { guard } from "${url}?v=old-version";`), `import { guard } from "${url}?v=new-version";`);
    assert.equal(render(`<script src="${url}"></script>`), `<script src="${url}?v=new-version"></script>`);
  }
});
