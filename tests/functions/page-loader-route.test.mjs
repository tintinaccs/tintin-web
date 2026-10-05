import test from 'node:test';
import assert from 'node:assert/strict';

import { lightenHtml } from '../../functions/[page].js';

test('las rutas limpias conservan el loader con una URL absoluta', () => {
  const html = '<head><script src="js/cargador-pagina.js?v=route-fixture-1-repair-20261005-1"></script></head>';
  const output = lightenHtml(html);

  assert.match(output, /src="\/js\/cargador-pagina\.js\?v=route-fixture-1&tt-lightweight=1"/);
  assert.doesNotMatch(output, /src="js\/cargador-pagina/);
});
