import test from 'node:test';
import assert from 'node:assert/strict';

import { lightenHtml } from '../../functions/[page].js';

test('las rutas limpias conservan el loader con una URL absoluta', () => {
  const html = '<head><script src="js/cargador-pagina.js?v=global-shell"></script></head>';
  const output = lightenHtml(html);

  assert.match(output, /src="\/js\/cargador-pagina\.js\?v=global-shell"/);
  assert.doesNotMatch(output, /src="js\/cargador-pagina/);
});
