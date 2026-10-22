import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../../functions/pages/[slug].js';

const request = new Request('https://tintinaccs.com/pages/guia');
const fixture = { title:'Guía', contentHtml:'<p>Elegí tu accesorio.</p>', template:'standard', metaDescription:'Descripción para buscadores' };
async function render(patch = {}) {
  const response = await renderPage({...fixture,...patch},request);
  const html = await response.text();
  return {response,html,revision:html.match(/name="tintin-page-revision" content="([a-f0-9]{64})"/)?.[1]};
}

test('página personalizada comparte el aviso y se revalida en cada entrada',async()=>{
  const first=await render(),repeat=await render();
  assert.match(first.revision,/^[a-f0-9]{64}$/);
  assert.equal(first.revision,repeat.revision);
  assert.equal(first.response.headers.get('cache-control'),'no-cache, must-revalidate');
  assert.match(first.html,/<script type="module" src="\/js\/quality\/vigilancia-version\.js\?v=/);
});

test('sólo cambia la revisión por contenido, título o plantilla visibles',async()=>{
  const first=await render();
  for(const patch of [{metaDescription:'Otro SEO'},{updatedAt:'otro'},{stock:0},{internalNotes:'no públicas'}]) assert.equal((await render(patch)).revision,first.revision);
  for(const patch of [{title:'Nueva guía'},{contentHtml:'<p>Otro contenido visible.</p>'},{template:'editorial'}]) assert.notEqual((await render(patch)).revision,first.revision);
});

test('el único script de la respuesta es el controlador confiable, nunca el contenido editado',async()=>{
  const {html}=await render({title:'<img src=x onerror=bad()>',contentHtml:'<script>bad()</script><p onclick="bad()">Contenido</p><iframe srcdoc="bad"></iframe>'});
  assert.equal((html.match(/<script\b/g)||[]).length,1);
  assert.doesNotMatch(html,/onclick=|srcdoc=|onerror=bad\(\)>/);
  assert.match(html,/&lt;img/);
  assert.match(html,/<p>Contenido<\/p>/);
});

test('HEAD conserva las cabeceras y no transmite el documento',async()=>{
  const response=await renderPage(fixture,new Request(request.url,{method:'HEAD'}));
  assert.equal(response.status,200);
  assert.equal(await response.text(),'');
  assert.equal(response.headers.get('cache-control'),'no-cache, must-revalidate');
});
