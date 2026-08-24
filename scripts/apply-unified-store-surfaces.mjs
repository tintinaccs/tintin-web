import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const selfPath = fileURLToPath(import.meta.url);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text, 'utf8');

function replaceExact(rel, oldValue, newValue, expected = 1) {
  const text = read(rel);
  const actual = text.split(oldValue).length - 1;
  if (actual !== expected) throw new Error(`${rel}: esperado ${expected}, encontradas ${actual}: ${oldValue.slice(0, 120)}`);
  write(rel, text.replace(oldValue, newValue));
  console.log(`OK ${rel}`);
}

function run(command, args = []) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: process.env, shell: false });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} terminó con código ${result.status}`);
}

// El contrato actual importa la política por su nombre real. La auditoría seguía
// buscando el nombre histórico "catalog-merchandising-policy", aunque el store
// ya conserva timestamps y llama sortCatalogProducts() antes de publicar.
replaceExact(
  'scripts/auditar-unificada-tienda-logica.js',
  "  /catalog-merchandising-policy/.test(productsStore) &&",
  "  /politica-exhibicion-catalogo\\.js/.test(productsStore) &&"
);

// Contacto: el fallback HTML debe coincidir con el contenido editable y con el
// runtime dinámico; no debe prometer una respuesta en minutos ni congelar un
// horario que la configuración pública puede cambiar.
replaceExact(
  'contact.html',
  '            La forma más rápida de recibir atención es escribirnos directo por WhatsApp. Respondemos en minutos y te ayudamos a elegir el accesorio perfecto.',
  '            La forma más rápida de recibir atención es escribirnos directo por WhatsApp.'
);
replaceExact(
  'contact.html',
  '                Lunes a Sábado, 8:00 — 20:00 hs',
  '                Consultá nuestros horarios actuales por WhatsApp'
);

// El backend del Visual Builder debe aceptar aliases históricos como entrada,
// pero persistir siempre la URL pública limpia. Así Apariencia no vuelve a
// introducir catalogo.html/product.html/collections.html en contenido nuevo.
replaceExact(
  'cloudflare/visual-builder-core.js',
  "const SAFE_HREF = /^(?:index|about|nosotros|catalogo|collections|product|checkout|login|perfil|contact|envios|preguntas-frecuentes|cambios-devoluciones|terminos|privacidad)\\.html(?:[?#][A-Za-z0-9_=&%.-]*)?$/i;",
  "const SAFE_HREF = /^\\/?(?:index|about|nosotros|catalogo|collections|product|checkout|login|perfil|contact|envios|preguntas-frecuentes|cambios-devoluciones|terminos|privacidad)(?:\\.html)?(?:[?#][A-Za-z0-9_=&%.,+~:@\\/-]*)?$/i;"
);
replaceExact(
  'cloudflare/visual-builder-core.js',
  `export function safeVisualHref(value, fallback = 'catalogo.html') {
  const href = String(value || '').trim();
  if (SAFE_HREF.test(href)) return href;
  if (/^https:\\/\\/[A-Za-z0-9.-]+(?::\\d+)?(?:\\/[A-Za-z0-9_~:/?#\\[\\]@!$&'()*+,;=%.-]*)?$/i.test(href)) return href;
  return fallback;
}`,
  `export function safeVisualHref(value, fallback = '/catalogo') {
  const href = String(value || '').trim();
  if (SAFE_HREF.test(href)) {
    const match = href.match(/^\\/?(index|about|nosotros|catalogo|collections|product|checkout|login|perfil|contact|envios|preguntas-frecuentes|cambios-devoluciones|terminos|privacidad)(?:\\.html)?([?#][A-Za-z0-9_=&%.,+~:@\\/-]*)?$/i);
    const page = String(match?.[1] || 'catalogo').toLowerCase();
    const suffix = match?.[2] || '';
    const route = page === 'index' ? '/' : page === 'nosotros' ? '/about' : \`/\${page}\`;
    return \`\${route}\${suffix}\`;
  }
  if (/^https:\\/\\/[A-Za-z0-9.-]+(?::\\d+)?(?:\\/[A-Za-z0-9_~:/?#\\[\\]@!$&'()*+,;=%.-]*)?$/i.test(href)) return href;
  return fallback;
}`
);

// Las pruebas del contrato server-side todavía fijaban el alias .html como
// salida. Ahora deben exigir normalización limpia y conservar la seguridad.
replaceExact(
  'tests/visual-builder/visual-builder-core.test.mjs',
  "  assert.equal(blocks[0].href, 'catalogo.html');",
  "  assert.equal(blocks[0].href, '/catalogo');"
);
replaceExact(
  'tests/visual-builder/visual-builder-core.test.mjs',
  "  assert.equal(safeVisualHref('catalogo.html?cat=relojes'), 'catalogo.html?cat=relojes');\n  assert.equal(safeVisualHref('javascript:alert(1)'), 'catalogo.html');",
  "  assert.equal(safeVisualHref('catalogo.html?cat=relojes'), '/catalogo?cat=relojes');\n  assert.equal(safeVisualHref('/product?id=abc'), '/product?id=abc');\n  assert.equal(safeVisualHref('collections.html'), '/collections');\n  assert.equal(safeVisualHref('javascript:alert(1)'), '/catalogo');"
);
replaceExact(
  'tests/visual-builder/visual-builder-core.test.mjs',
  "  assert.equal(clean.hero.primaryHref, 'catalogo.html');",
  "  assert.equal(clean.hero.primaryHref, '/catalogo');"
);

// Extender la auditoría de contenido que el primer aplicador ya actualizó.
{
  const rel = 'scripts/auditar-contenido-fase-6.js';
  let text = read(rel);
  const oldFiles = "  about: read('about.html'),\n};";
  const newFiles = "  about: read('about.html'),\n  contactPage: read('contact.html'),\n  contactMaintenance: read('js/pages/institutional/mantenimiento-contacto.js'),\n  visualBuilderCore: read('cloudflare/visual-builder-core.js'),\n};";
  if ((text.split(oldFiles).length - 1) !== 1) throw new Error('auditor de contenido: bloque about inesperado');
  text = text.replace(oldFiles, newFiles);

  const marker = 'if (failures) {\n';
  const guard = String.raw`
check(
  'Contacto usa fallbacks coherentes con Apariencia y configuración pública',
  files.contactPage.includes('La forma más rápida de recibir atención es escribirnos directo por WhatsApp.') &&
    !files.contactPage.includes('Respondemos en minutos') &&
    files.contactPage.includes('Consultá nuestros horarios actuales por WhatsApp') &&
    files.schema.includes('La forma más rápida de recibir atención es escribirnos directo por WhatsApp.') &&
    files.contactMaintenance.includes("schedule: 'Consultá nuestros horarios actuales por WhatsApp'"),
  'El HTML inicial no debe contradecir el contenido editable ni prometer un horario/tiempo de respuesta fijo'
);

check(
  'Visual Builder server-side normaliza enlaces internos a rutas limpias',
  files.visualBuilderCore.includes("fallback = '/catalogo'") &&
    files.visualBuilderCore.includes("page === 'nosotros' ? '/about'") &&
    files.visualBuilderCore.includes("page === 'index' ? '/'") &&
    !files.visualBuilderCore.includes("fallback = 'catalogo.html'"),
  'El backend de Apariencia debe aceptar aliases legados sin volver a guardarlos como URLs públicas'
);

`;
  if ((text.split(marker).length - 1) !== 1) throw new Error('auditor de contenido: marcador final inesperado');
  write(rel, text.replace(marker, guard + marker));
}

// Verificar primero las causas que motivaron esta pasada.
run(process.execPath, ['scripts/auditar-unificada-tienda-logica.js']);
run(process.execPath, ['scripts/auditar-contenido-fase-6.js']);
run(process.execPath, ['--test', 'tests/visual-builder/visual-builder-core.test.mjs']);

// El script temporal no debe entrar al fingerprint final.
fs.unlinkSync(selfPath);
run('npm', ['run', 'cache-versioning:write']);
run('npm', ['run', 'build:pages']);
run('npm', ['run', 'audit:content']);
run('npm', ['run', 'audit:phase11']);
run('npm', ['run', 'audit:page-loading']);
run('npm', ['run', 'audit:secure-orders']);

// El workflow oficial lo elimina después de ejecutar este archivo.
fs.writeFileSync(selfPath, '// removed by workflow after validated application\n', 'utf8');
console.log('\nAuditor, Contacto y rutas server-side del Visual Builder alineados y validados.');
