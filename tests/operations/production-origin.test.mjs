import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveProductionOrigins } from '../../scripts/lib/origen-produccion.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const canonical = 'https://tintinaccs.com';
const operational = 'https://tintinaccesorios.pages.dev';
const config = { origin: canonical, operationalOrigin: operational };

test('las sondas usan Pages y la metadata conserva el dominio canónico antes del corte', () => {
  assert.deepEqual(resolveProductionOrigins(config), { origin: operational, canonicalOrigin: canonical });
  assert.deepEqual(resolveProductionOrigins({ origin: canonical }), { origin: canonical, canonicalOrigin: canonical });
  assert.deepEqual(resolveProductionOrigins({ ...config, operationalOrigin: canonical }), { origin: canonical, canonicalOrigin: canonical });
});

test('un destino explícito de sonda no modifica el canonical esperado', () => {
  assert.deepEqual(resolveProductionOrigins(config, { TINTIN_PUBLIC_ORIGIN: 'https://preview.pages.dev' }), { origin: 'https://preview.pages.dev', canonicalOrigin: canonical });
  assert.equal(resolveProductionOrigins(config, { TINTIN_PUBLIC_ORIGIN: canonical, TINTIN_OPERATIONAL_ORIGIN: operational }).origin, operational);
});

test('la configuración de producción rechaza esquemas inseguros, rutas y credenciales', () => {
  for (const origin of ['http://tintinaccs.com', 'https://tintinaccs.com/api', 'https://user:password@tintinaccs.com', 'https://tintinaccs.com?other=host']) {
    assert.throws(() => resolveProductionOrigins({ origin }));
    assert.throws(() => resolveProductionOrigins({ ...config, operationalOrigin: origin }));
  }
});

function withConfig(data, fn) {
  const cwd = mkdtempSync(resolve(tmpdir(), 'tintin-production-origin-'));
  try {
    mkdirSync(resolve(cwd, 'config'));
    writeFileSync(resolve(cwd, 'config/public-site.json'), JSON.stringify(data));
    return fn(cwd);
  } finally {
    assert.ok(cwd.startsWith(resolve(tmpdir(), 'tintin-production-origin-')), 'Limpieza fuera del directorio temporal esperado.');
    rmSync(cwd, { recursive: true, force: true });
  }
}

for (const [script, report] of [['auditar-produccion-salud.mjs', 'phase11-production-health.json'], ['produccion-smoke-fase-12.mjs', 'phase12-production-smoke.json']]) {
  for (const wrongCanonical of [false, true]) {
    test(`${script}: consulta sólo Pages y ${wrongCanonical ? 'rechaza metadata de otro host' : 'exige metadata canónica de apex'}`, () => {
      withConfig(config, cwd => {
        const result = spawnSync(process.execPath, ['--import', pathToFileURL(resolve(root, 'tests/operations/fixtures/production-monitor-fetch.mjs')).href, resolve(root, 'scripts', script)], {
          cwd, encoding: 'utf8', env: { ...process.env, TINTIN_PUBLIC_ORIGIN: '', TINTIN_OPERATIONAL_ORIGIN: '', TINTIN_MONITOR_FIXTURE_CANONICAL: wrongCanonical ? operational : canonical, TINTIN_MONITOR_FIXTURE_OPERATIONAL: operational },
        });
        assert.equal(result.status, wrongCanonical ? 1 : 0, result.stderr);
        const data = JSON.parse(readFileSync(resolve(cwd, 'artifacts', report), 'utf8'));
        assert.equal(data.origin, operational);
        assert.equal(data.canonicalOrigin, canonical);
        assert.equal(data.ok, !wrongCanonical);
        if (wrongCanonical) assert.match(result.stderr, /canonical|sitemap/i);
      });
    });
  }
}
