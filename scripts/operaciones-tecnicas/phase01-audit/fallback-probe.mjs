// Inspect an artifact created by the existing canonical prepare:hosting script.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
const root=process.argv[2];assert.ok(root && path.isAbsolute(root));
const publicRoot=path.join(root,'public');
const document=parse(fs.readFileSync(path.join(publicRoot,'index.html'),'utf8'));
const refs=[];
function walk(node){
 const a=Object.fromEntries((node.attrs||[]).map(x=>[x.name,x.value]));
 if(node.tagName==='script' && a.src)refs.push(a.src);
 if(node.tagName==='link' && /(?:stylesheet|icon|manifest|preload|modulepreload)/.test(a.rel||'') && a.href)refs.push(a.href);
 for(const child of node.childNodes||[])walk(child);
}
walk(document);
const missing=[...new Set(refs.map(x=>new URL(x,'https://fixture.invalid/index.html')).filter(u=>u.origin==='https://fixture.invalid' && !fs.existsSync(path.join(publicRoot,decodeURIComponent(u.pathname)))).map(u=>u.pathname))].sort();
assert.ok(missing.includes('/styles.min.css'));
assert.equal(fs.existsSync(path.join(publicRoot,'tienda.js')),false);
const result={finding:'F03-FALLBACK',artifactSource:'scripts/preparar-hosting.js',consumer:'.github/workflows/desplegar-pages.yml',indexMissingLocalAssets:missing,keyFiles:Object.fromEntries(['tienda.js','styles.min.css','styles.css','site-version.json','firebase-messaging-sw.js','vendor/onnxruntime-web-1.22.0/ort.wasm.bundle.min.mjs'].map(f=>[f,fs.existsSync(path.join(publicRoot,f))])),productionCloudflareAffected:false};
fs.writeFileSync(new URL('../../../docs/agent/evidence/phase01-20261101/fallback-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
