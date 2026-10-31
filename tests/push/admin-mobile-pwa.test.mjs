import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('admin-manifest.json','utf8'));
test('las dos rutas privadas comparten instalación, áreas seguras y zoom accesible',()=>{
 for(const page of ['admin.html','admin-images.html']){
  const html=fs.readFileSync(page,'utf8');
  assert.match(html,/<link[^>]+rel="manifest"[^>]+href="admin-manifest.json"/);
  assert.match(html,/name="viewport"[^>]+viewport-fit=cover/);
  assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[",\s])/i);
  assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html,/rel="apple-touch-icon"/);
 }
 assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'any');
 const start=new URL(manifest.start_url,'https://tintin.test');
 assert.equal(start.pathname,'/admin.html');assert.equal(start.searchParams.get('source'),'pwa');
 assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
 for(const icon of manifest.icons){
  const url=new URL(icon.src,'https://tintin.test/');assert.equal(url.origin,'https://tintin.test');
  const bytes=fs.readFileSync('.'+url.pathname);assert.equal(bytes.toString('ascii',1,4),'PNG');
  const [width,height]=icon.sizes.split('x').map(Number);assert.equal(bytes.readUInt32BE(16),width);assert.equal(bytes.readUInt32BE(20),height);
 }
});
test('el worker de notificaciones no almacena documentos ni respuestas privadas offline',()=>{
 const worker=fs.readFileSync('firebase-messaging-sw.js','utf8');
 assert.doesNotMatch(worker,/addEventListener\(\s*['"]fetch['"]|caches\.(?:open|put|add|match)|indexedDB\./);
});
