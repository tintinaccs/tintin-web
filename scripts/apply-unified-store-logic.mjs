import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const selfPath = fileURLToPath(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(path.join(ROOT, rel), text, 'utf8');
}

function replaceExact(rel, oldValue, newValue, expected = 1) {
  const text = read(rel);
  const actual = text.split(oldValue).length - 1;
  if (actual !== expected) {
    throw new Error(`${rel}: esperado ${expected} coincidencia(s), encontradas ${actual}: ${oldValue.slice(0, 120)}`);
  }
  write(rel, text.replace(oldValue, newValue));
  console.log(`OK ${rel}`);
}

function run(command, args = []) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} terminó con código ${result.status}`);
  }
}

// 1) Catálogo y Visual Builder: las superficies dinámicas deben usar las rutas públicas limpias.
replaceExact(
  'catalogo.html',
  '    const productHref = `product.html?id=${encodeURIComponent(String(p.id))}`;',
  '    const productHref = `/product?id=${encodeURIComponent(String(p.id))}`;'
);

replaceExact(
  'js/core/store/editor-visual-runtime.js',
  `function safeHref(value) {
  const href = String(value || '').trim();
  if (/^(?:index|about|nosotros|catalogo|collections|product|checkout|login|perfil|contact|envios|preguntas-frecuentes|cambios-devoluciones|terminos|privacidad)\\.html(?:[?#][A-Za-z0-9_=&%.-]*)?$/i.test(href)) return href;
  if (/^https:\\/\\//i.test(href)) return href;
  return 'catalogo.html';
}`,
  `function safeHref(value) {
  const href = String(value || '').trim();
  if (/^https:\\/\\//i.test(href)) return href;
  const match = href.match(/^\\/?(index|about|nosotros|catalogo|collections|product|checkout|login|perfil|contact|envios|preguntas-frecuentes|cambios-devoluciones|terminos|privacidad)(?:\\.html)?([?#][A-Za-z0-9_=&%.,+~:@\\/-]*)?$/i);
  if (!match) return '/catalogo';
  const page = match[1].toLowerCase();
  const suffix = match[2] || '';
  const route = page === 'index' ? '/' : page === 'nosotros' ? '/about' : \`/\${page}\`;
  return \`\${route}\${suffix}\`;
}`
);
replaceExact(
  'js/core/store/editor-visual-runtime.js',
  "    const link = el('a', 'tt-visual-product-card'); link.href = `product.html?id=${encodeURIComponent(String(product.id || ''))}`;",
  "    const link = el('a', 'tt-visual-product-card'); link.href = `/product?id=${encodeURIComponent(String(product.id || ''))}`;"
);
replaceExact(
  'js/core/store/editor-visual-runtime.js',
  "    const link = el('a', '', label); link.href = label === 'Ver colecciones' ? 'collections.html' : `/catalogo?cat=${encodeURIComponent(label)}`; root.appendChild(link);",
  "    const link = el('a', '', label); link.href = label === 'Ver colecciones' ? '/collections' : `/catalogo?cat=${encodeURIComponent(label)}`; root.appendChild(link);"
);

// 2) Los canonical/OG dinámicos no deben volver a aliases .html.
replaceExact(
  'js/pages/catalog/mantenimiento-catalogo.js',
  '    const page = `${base}catalogo.html`;',
  '    const page = `${base}catalogo`;'
);
replaceExact(
  'js/pages/collections/mantenimiento-colecciones.js',
  '    const page = `${base}collections.html`;',
  '    const page = `${base}collections`;'
);

// 3) Política de envíos: el HTML publicado debe coincidir con el contrato editable.
replaceExact(
  'envios.html',
  '      <p>Todos los pedidos se preparan en el mismo día si son realizados antes de las 11:00 hs. Pedidos posteriores se preparan al día siguiente hábil.</p>',
  '      <p>Los pedidos se preparan según disponibilidad y horario de confirmación.</p>'
);

// 4) Ficha de producto: especificar la modalidad real de retiro.
replaceExact(
  'product.html',
  '      <div class="tinben-card" data-title="Retiro disponible">',
  '      <div class="tinben-card" data-title="Retiro en San Lorenzo">'
);
replaceExact(
  'product.html',
  '        <p class="tinben-card-title">Retiro disponible</p>',
  '        <p class="tinben-card-title">Retiro en San Lorenzo</p>'
);
replaceExact(
  'product.html',
  '        <p class="tinben-card-text">Podés retirar tu pedido desde nuestra ubicación.</p>',
  '        <p class="tinben-card-text">Podés retirar tu pedido sin costo en San Lorenzo, coordinando previamente.</p>'
);

// 5) Términos: los métodos de pago son configurables y se muestran en checkout.
replaceExact(
  'terminos.html',
  '      <p>Un pedido queda confirmado cuando lo enviás desde el checkout con tu cuenta verificada. Los métodos de pago disponibles (efectivo contra entrega, transferencia bancaria) se muestran en el paso de pago del checkout — pueden variar según lo que la tienda tenga habilitado en cada momento.</p>',
  '      <p>Un pedido queda confirmado cuando lo enviás desde el checkout con tu cuenta verificada. Los métodos de pago disponibles se muestran en el paso de pago del checkout y pueden variar según lo que la tienda tenga habilitado en cada momento.</p>'
);

// 6) Inicio: evitar cutoffs operativos fijos, medios de pago fijos y claims absolutos globales.
for (const rel of ['index.html', 'js/core/store/esquema-contenido.js']) {
  replaceExact(rel, 'Envío mismo día', 'Entregas coordinadas');
  replaceExact(rel, 'Pedidos antes de las 11 hs, Zona Central', 'Según zona, método y disponibilidad');
  replaceExact(rel, 'No se oxida ni decolora', 'Resistente y pensado para uso diario');
  replaceExact(rel, 'Transferencia o efectivo', 'Métodos disponibles en checkout');
}

// 7) Nosotros: HTML y default editable deben expresar la misma política de envío.
replaceExact(
  'about.html',
  '          Trabajamos con envío el mismo día para pedidos antes de las 11 hs en zona central, y hacemos envíos a todo el país.',
  '          Realizamos envíos en Zona Central y a todo el país.'
);

// 8) Comentario técnico del origen oficial; se mantiene la compatibilidad runtime con hosts históricos.
replaceExact(
  'js/core/firebase/origen-funciones.js',
  `// El sitio se publica en GitHub Pages (ver robots.txt, sitemap.xml y los
// canonical de cada página), pero las funciones /api/* (Cloudinary, geo,
// email) corren en Cloudflare Pages. Un fetch a una ruta relativa como
// "/api/order-email" funciona en Cloudflare (mismo origen) pero da 404 en
// github.io o netlify.app. Este módulo centraliza esa detección para que
// cada llamador no tenga que reinventarla (y olvidarla, como pasaba antes).`,
  `// El sitio y las funciones /api/* se publican oficialmente en Cloudflare
// Pages. Los dominios históricos de GitHub Pages/Netlify pueden aparecer en
// previews o enlaces antiguos; allí una ruta relativa como /api/order-email
// no existe y debe usar el origen oficial de respaldo. Este módulo centraliza
// esa compatibilidad para que cada llamador no tenga que reinventarla.`
);

// 9) Guardas para impedir que las incongruencias reaparezcan desde Apariencia o mantenimiento.
{
  const rel = 'scripts/auditar-contenido-fase-6.js';
  let text = read(rel);
  const oldFiles = "  orderEmail: read('functions/api/order-email.js'),\n};";
  const newFiles = "  orderEmail: read('functions/api/order-email.js'),\n  catalog: read('catalogo.html'),\n  visualRuntime: read('js/core/store/editor-visual-runtime.js'),\n  catalogMaintenance: read('js/pages/catalog/mantenimiento-catalogo.js'),\n  collectionsMaintenance: read('js/pages/collections/mantenimiento-colecciones.js'),\n  functionOrigin: read('js/core/firebase/origen-funciones.js'),\n  productPage: read('product.html'),\n  terms: read('terminos.html'),\n  home: read('index.html'),\n  about: read('about.html'),\n};";
  if ((text.split(oldFiles).length - 1) !== 1) throw new Error('auditar-contenido-fase-6.js: bloque files inesperado');
  text = text.replace(oldFiles, newFiles);

  const marker = 'if (failures) {\n';
  const guards = String.raw`
check(
  'Catálogo y Visual Builder publican rutas limpias de producto y colecciones',
  files.catalog.includes('const productHref = \`/product?id=\${encodeURIComponent(String(p.id))}\`;') &&
    files.visualRuntime.includes('link.href = \`/product?id=\${encodeURIComponent') &&
    files.visualRuntime.includes("? '/collections' : \`/catalogo?cat=") &&
    files.visualRuntime.includes("if (!match) return '/catalogo';") &&
    !files.catalog.includes('const productHref = \`product.html?id=') &&
    !files.visualRuntime.includes('link.href = \`product.html?id=') &&
    !files.visualRuntime.includes("return 'catalogo.html'"),
  'Las superficies dinámicas no deben reintroducir aliases .html'
);

check(
  'Canonical dinámicos de catálogo y colecciones permanecen limpios',
  files.catalogMaintenance.includes('const page = \`\${base}catalogo\`;') &&
    files.collectionsMaintenance.includes('const page = \`\${base}collections\`;') &&
    !files.catalogMaintenance.includes('\`\${base}catalogo.html\`') &&
    !files.collectionsMaintenance.includes('\`\${base}collections.html\`'),
  'Los mantenimientos no deben sobrescribir canonical limpios'
);

check(
  'Envíos mantiene preparación sin cutoff fijo y consistente con el esquema editable',
  files.shipping.includes('Los pedidos se preparan según disponibilidad y horario de confirmación.') &&
    files.schema.includes('Los pedidos se preparan según disponibilidad y horario de confirmación.') &&
    !files.shipping.includes('antes de las 11:00 hs'),
  'HTML y defaults de Apariencia deben expresar la misma política'
);

check(
  'Producto identifica el retiro en San Lorenzo',
  files.productPage.includes('data-title="Retiro en San Lorenzo"') &&
    files.productPage.includes('Podés retirar tu pedido sin costo en San Lorenzo, coordinando previamente.'),
  'La ficha debe coincidir con checkout y política de envíos'
);

check(
  'Términos obtiene los métodos de pago del checkout vigente',
  files.terms.includes('Los métodos de pago disponibles se muestran en el paso de pago del checkout') &&
    !files.terms.includes('Los métodos de pago disponibles (efectivo contra entrega, transferencia bancaria)'),
  'No debe quedar una lista parcial hardcodeada'
);

check(
  'Inicio evita promesas operativas fijas y claims absolutos globales',
  files.home.includes('Entregas coordinadas') &&
    files.home.includes('Según zona, método y disponibilidad') &&
    files.home.includes('Resistente y pensado para uso diario') &&
    files.home.includes('Métodos disponibles en checkout') &&
    files.schema.includes('Entregas coordinadas') &&
    files.schema.includes('Métodos disponibles en checkout') &&
    !files.home.includes('Pedidos antes de las 11 hs, Zona Central') &&
    !files.home.includes('No se oxida ni decolora') &&
    !files.home.includes('Transferencia o efectivo'),
  'Contenido visible y defaults deben permanecer alineados con la operación configurable'
);

check(
  'Nosotros no publica un cutoff distinto al default editable',
  files.about.includes('Realizamos envíos en Zona Central y a todo el país.') &&
    files.schema.includes('Realizamos envíos en Zona Central y a todo el país.') &&
    !files.about.includes('pedidos antes de las 11 hs'),
  'HTML y Apariencia deben conservar el mismo texto operativo'
);

check(
  'Origen de funciones documenta Cloudflare Pages como publicación oficial',
  files.functionOrigin.includes('se publican oficialmente en Cloudflare') &&
    !files.functionOrigin.includes('El sitio se publica en GitHub Pages'),
  'La documentación interna debe reflejar la arquitectura vigente'
);

`;
  if ((text.split(marker).length - 1) !== 1) throw new Error('auditar-contenido-fase-6.js: marcador final inesperado');
  write(rel, text.replace(marker, guards + marker));
}

// Validación local previa a generar artefactos.
run(process.execPath, ['--check', 'js/core/store/editor-visual-runtime.js']);
run(process.execPath, ['--check', 'js/pages/catalog/mantenimiento-catalogo.js']);
run(process.execPath, ['--check', 'js/pages/collections/mantenimiento-colecciones.js']);
run(process.execPath, ['--check', 'js/core/firebase/origen-funciones.js']);
run(process.execPath, ['--check', 'scripts/auditar-contenido-fase-6.js']);
run(process.execPath, ['scripts/auditar-contenido-fase-6.js']);

// Instalar dependencias antes de retirar el script del árbol que será fingerprinted.
run('npm', ['ci']);

// El workflow oficial elimina este archivo después. Durante build/diagnostics debe estar ausente.
fs.unlinkSync(selfPath);

run('npm', ['run', 'cache-versioning:write']);
run('npm', ['run', 'build:pages']);
run('npm', ['run', 'audit:content']);
run('npm', ['run', 'audit:phase11']);
run('npm', ['run', 'audit:page-loading']);
run('npm', ['run', 'audit:secure-orders']);

// Placeholder para que el `rm` del workflow oficial sea idempotente y el archivo no llegue al commit.
fs.writeFileSync(selfPath, '// removed by workflow after validated application\n', 'utf8');
console.log('\nCorrección integral residual aplicada y validada.');
