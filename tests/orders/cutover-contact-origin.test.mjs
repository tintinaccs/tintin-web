import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('el generador canónico cambia el seguimiento de WhatsApp en cutover y rollback', async()=>{
  const root=await mkdtemp(join(tmpdir(),'tintin-origin-contact-'));
  try {
    for(const directory of ['scripts','config','cloudflare'])await mkdir(join(root,directory));
    await copyFile(resolve('scripts/sincronizar-origen-publico.js'),join(root,'scripts/sincronizar-origen-publico.js'));
    await copyFile(resolve('cloudflare/contactos-pedido.mjs'),join(root,'cloudflare/contactos-pedido.mjs'));
    const fixture={userName:'QA',userPhone:'0981123456',shippingMethod:'retiro'};
    for(const [index,origin]of ['https://tintinaccesorios.pages.dev','https://tintinaccs.com','https://tintinaccesorios.pages.dev'].entries()){
      await writeFile(join(root,'config/public-site.json'),JSON.stringify({origin,firebaseAuthDomain:new URL(origin).hostname}));
      execFileSync(process.execPath,[join(root,'scripts/sincronizar-origen-publico.js')],{cwd:root,stdio:'pipe'});
      const module=await import(pathToFileURL(join(root,'cloudflare/contactos-pedido.mjs')).href+'?round='+index);
      const message=new URL(module.orderContactLinks(fixture,'fixture-id').customer).searchParams.get('text');
      assert.ok(message.includes(origin+'/perfil#pedido-fixture-id'));
      const other=origin.includes('pages.dev')?'https://tintinaccs.com':'https://tintinaccesorios.pages.dev';
      assert.ok(!message.includes(other));
      execFileSync(process.execPath,[join(root,'scripts/sincronizar-origen-publico.js'),'--check'],{cwd:root,stdio:'pipe'});
    }
  } finally {await rm(root,{recursive:true,force:true});}
});
