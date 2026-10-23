import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('el lote distingue sintaxis válida e inválida de CJS y ESM sin ejecutar los archivos', () => {
  const code = `
    import { parseJavaScript } from ${JSON.stringify(new URL('../../scripts/verificar-sintaxis-lote.mjs', import.meta.url).href)};
    for (const [source, file] of [
      ['#!/usr/bin/env node\\nreturn;', 'tool.cjs'],
      ['export const value = await Promise.resolve(1);', 'module.mjs'],
      ['import x from "node:fs"; export { x };', 'auto.js'],
      ['throw new Error("MUST NOT EXECUTE");', 'classic.js']
    ]) parseJavaScript(source, file);
    for (const [source, file] of [
      ['const = ;', 'bad.js'], ['export const value = ;', 'bad.mjs'],
      ['export const value = 1;', 'bad.cjs'], ['export const x=1; export const x=2;', 'duplicate.mjs']
    ]) {
      let failed = false;
      try { parseJavaScript(source, file); } catch { failed = true; }
      if (!failed) throw new Error('Sintaxis inválida aceptada: '+file);
    }
  `;
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
