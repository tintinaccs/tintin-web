import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url);
const shell=fs.readFileSync(new URL('js/components/navigation/compartido/configuracion.js',root),'utf8');
const logoVersion=shell.match(/LOGO_VERSION = '([^']+)'/)[1];
const canonical=`assets-tintin/images/general/logo.png?v=${logoVersion}`;
const versions=JSON.parse(fs.readFileSync(new URL('scripts/cache-version-baseline.json',root),'utf8'));

test('todos los img estáticos del logo consumen el mismo recurso que el shell',()=>{
  let checked=0;
  for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.html'))) {
    const source=fs.readFileSync(new URL(name,root),'utf8');
    for(const match of source.matchAll(/<img\b[^>]*\bsrc=["']([^"']*assets-tintin\/images\/general\/logo\.png[^"']*)["']/g)) {
      assert.equal(match[1].replace(/^\//,''),canonical,`${name} tiene una segunda URL del logo`);checked++;
    }
  }
  assert.ok(checked>10,'el gate debe inspeccionar los consumidores reales');
  const consent=fs.readFileSync(new URL('js/analytics/consentimiento-privacidad.js',root),'utf8');
  assert.ok(consent.includes(`src="${canonical}"`),'privacidad debe reutilizar el logo del shell');
  for(const file of ['css/pages/login/login-maintenance.css','css/theme/superficies-marca-responsive-tintin.css']) {
    const css=fs.readFileSync(new URL(file,root),'utf8');
    assert.ok(css.includes('logo.png?v=tintin-20261004-final-integration-2'),`${file} debe reutilizar la misma URL en background-image`);
    assert.doesNotMatch(css,/logo\.png["']/);
  }
});

test('imports del admin reutilizan URLs versionadas de sus dependencias compartidas',()=>{
  const coreUrl=`shopify-import-core.mjs?v=${versions['js/core/store/shopify-import-core.mjs'].version}`;
  const checkCore=(source,file)=>{
    assert.ok(source.includes(`${coreUrl}'`) || source.includes(`${coreUrl}"`),`${file} debe reutilizar la URL canónica del motor de importación`);
    assert.doesNotMatch(source,/from ['"]\.\/shopify-import-core\.mjs['"]/);
  };
  for(const file of ['js/core/store/shopify-import-identity.mjs','js/core/store/shopify-phase2-pipeline.mjs']) {
    const source=fs.readFileSync(new URL(file,root),'utf8');
    checkCore(source,file);
    assert.throws(()=>checkCore(source.replaceAll(coreUrl,'shopify-import-core.mjs?v=obsolete'),file));
    assert.throws(()=>checkCore(source.replaceAll(coreUrl,'shopify-import-core.mjs'),file));
  }
  for(const file of ['js/admin/notifications/notificaciones-push.js','js/admin/notifications/notificaciones-push-maestro.js']) {
    const source=fs.readFileSync(new URL(file,root),'utf8');
    const dependency=`origen-funciones.js?v=${versions['js/core/firebase/origen-funciones.js'].version}`;
    assert.ok(source.includes(`${dependency}'`) || source.includes(`${dependency}"`),`${file} debe reutilizar la URL canónica de origen-funciones`);
  }
});
