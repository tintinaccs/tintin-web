import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

test('connect-src del CSP permite el origen real de subida a Cloudinary', () => {
  const headers = read('_headers');
  const signer = read('functions/api/cloudinary-sign-upload.js');

  // La URL de subida la construye el servidor (cloudinary-sign-upload.js) y el
  // navegador hace fetch() directo contra ella (biblioteca-multimedia.js). Si
  // el CSP no incluye ese origen exacto en connect-src, la subida de imágenes
  // queda bloqueada en producción — esto ya pasó una vez con api.cloudinary.com
  // faltando mientras solo estaba permitido res.cloudinary.com (que sirve las
  // imágenes ya subidas, no recibe la subida).
  const uploadUrlMatch = signer.match(/uploadUrl:\s*`(https:\/\/[^/`$]+)/);
  assert.ok(uploadUrlMatch, 'no se encontró el origen de uploadUrl en cloudinary-sign-upload.js');
  const uploadOrigin = uploadUrlMatch[1];

  const connectSrcLines = headers
    .split('\n')
    .filter(line => line.includes('Content-Security-Policy:') && line.includes('connect-src'));
  assert.ok(connectSrcLines.length > 0, 'no se encontraron líneas de CSP con connect-src en _headers');
  for (const line of connectSrcLines) {
    assert.ok(
      line.includes(uploadOrigin),
      `connect-src no incluye ${uploadOrigin} (la subida real de imágenes quedaría bloqueada): ${line.slice(0, 200)}`
    );
  }
});
