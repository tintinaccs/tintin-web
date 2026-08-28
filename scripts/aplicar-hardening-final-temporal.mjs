import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }

function replaceOnce(path, before, after, label) {
  const content = read(path);
  if (content.includes(after)) {
    console.log(`SKIP ${label}: ya aplicado`);
    return;
  }
  if (!content.includes(before)) throw new Error(`No se encontró el patrón esperado: ${label}`);
  write(path, content.replace(before, after));
  console.log(`OK ${label}`);
}

replaceOnce(
  'apps-script/ProductosUnificados.gs',
`  history.insertRowBefore(TINTIN_SYNC_HISTORY_FIRST_ROW);
  history.getRange(TINTIN_SYNC_HISTORY_FIRST_ROW, 1, 1, width).setValues([values]);
  var firstExcessRow = TINTIN_SYNC_HISTORY_FIRST_ROW + TINTIN_SYNC_HISTORY_MAX_ROWS;
  if (history.getLastRow() >= firstExcessRow) {
    history.deleteRows(firstExcessRow, history.getLastRow() - firstExcessRow + 1);
  }`,
`  // insertRowBefore/deleteRows desplazan filas. Un lock evita que dos onEdit
  // concurrentes calculen límites incompatibles y pierdan el registro.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('No se pudo obtener el lock de Historial sync.');
  try {
    history.insertRowBefore(TINTIN_SYNC_HISTORY_FIRST_ROW);
    history.getRange(TINTIN_SYNC_HISTORY_FIRST_ROW, 1, 1, width).setValues([values]);
    var firstExcessRow = TINTIN_SYNC_HISTORY_FIRST_ROW + TINTIN_SYNC_HISTORY_MAX_ROWS;
    if (history.getLastRow() >= firstExcessRow) {
      history.deleteRows(firstExcessRow, history.getLastRow() - firstExcessRow + 1);
    }
  } finally {
    lock.releaseLock();
  }`,
  'lock Historial sync'
);

replaceOnce(
  'apps-script/AdminParity.gs',
`    sheet.getRange(row, 2).setFormula('=IFERROR(VLOOKUP(A' + row + ',Productos!$A$7:$F$1000,2,FALSE),"")');
    sheet.getRange(row, 5).setFormula('=IFERROR(VLOOKUP(A' + row + ',Productos!$A$7:$F$1000,6,FALSE),"")');`,
`    // Rango abierto: no se corta en la fila 1000. Separadores compatibles con es_PY.
    sheet.getRange(row, 2).setFormula('=IFERROR(VLOOKUP(A' + row + ';Productos!$A$7:$F;2;FALSE);"")');
    sheet.getRange(row, 5).setFormula('=IFERROR(VLOOKUP(A' + row + ';Productos!$A$7:$F;6;FALSE);"")');`,
  'VLOOKUP dinámico Nuevo pedido web'
);

replaceOnce(
  'functions/product.js',
`const CLOUDINARY_TINTIN_TRANSFORM = /^f_auto,q_auto,c_limit,w_\\d+,dpr_auto\\//;`,
`const CLOUDINARY_TINTIN_TRANSFORM = /^f_auto,q_auto,c_limit,w_\\d+,dpr_auto\\//;
const PRODUCT_METADATA_CEILING_MS = 1400;`,
  'techo metadata producto'
);

replaceOnce(
  'functions/product.js',
`export async function onRequest(context) {`,
`/**
 * La metadata server-side mejora SEO y previews, pero no puede bloquear la ficha.
 * Si OAuth/Firestore tarda demasiado se entrega el HTML base y el runtime cliente
 * continúa cargando el producto normalmente.
 */
export function resolveProductMetadataWithin(promise, ceilingMs = PRODUCT_METADATA_CEILING_MS) {
  const limit = Math.max(100, Number(ceilingMs) || PRODUCT_METADATA_CEILING_MS);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('product_metadata_timeout'));
    }, limit);
    Promise.resolve(promise).then(
      value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function onRequest(context) {`,
  'helper timeout metadata producto'
);

replaceOnce(
  'functions/product.js',
`  const asset = await env.ASSETS.fetch(request);
  if (request.method === 'HEAD') return asset;`,
`  // La URL pública permanece /product?id=... pero el binding de assets recibe
  // el archivo físico explícito. Así no dependemos de una segunda resolución
  // pretty-URL dentro de la propia Pages Function.
  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/product.html';
  const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  if (request.method === 'HEAD') return asset;`,
  'asset físico de /product'
);

replaceOnce(
  'functions/product.js',
`    const document = await firestoreAdminGet(env, \`products/${id}\`);`,
`    const document = await resolveProductMetadataWithin(
      firestoreAdminGet(env, \`products/${id}\`)
    );`,
  'timeout aplicado a Firestore producto'
);

replaceOnce(
  'functions/product.js',
`  } catch (error) {
    console.error('[product-meta] no se pudo renderizar metadata:', error?.message || error);
    return asset;
  }`,
`  } catch (error) {
    const reason = error?.message || error;
    if (reason === 'product_metadata_timeout') {
      console.warn('[product-meta] metadata omitida por tiempo máximo; se entrega la ficha base.');
    } else {
      console.error('[product-meta] no se pudo renderizar metadata:', reason);
    }
    return asset;
  }`,
  'fallback metadata producto'
);

replaceOnce(
  'js/pages/product/productos-relacionados.js',
`const TT_PUBLIC_PRODUCT_URL = 'https://tintinaccesorios.pages.dev/product.html';`,
`const TT_PUBLIC_PRODUCT_URL = 'https://tintinaccesorios.pages.dev/product';`,
  'canonical runtime /product'
);

const seoPath = 'tests/seo/phase11-seo.spec.js';
let seo = read(seoPath);
if (!seo.includes("metadata de producto no puede bloquear indefinidamente")) {
  const marker = `test('superficies privadas y auxiliares permanecen noindex'`;
  const addition = `test('metadata de producto no puede bloquear indefinidamente la respuesta HTML', async () => {
  const { resolveProductMetadataWithin } = await import('../../functions/product.js');
  const started = Date.now();
  await expect(resolveProductMetadataWithin(new Promise(() => {}), 120)).rejects.toThrow('product_metadata_timeout');
  expect(Date.now() - started).toBeLessThan(800);
});

test('ruta limpia de producto con id siempre entrega el documento navegable', async ({ page }) => {
  const response = await page.goto('/product?id=route-probe-inexistente', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page.locator('#product-detail')).toHaveCount(1);
  await expect(page.locator('#product-loading')).toHaveCount(1);
  expect(new URL(page.url()).pathname).toBe('/product');
  expect(new URL(page.url()).searchParams.get('id')).toBe('route-probe-inexistente');
});

`;
  if (!seo.includes(marker)) throw new Error('No se encontró marcador SEO');
  seo = seo.replace(marker, addition + marker);
  write(seoPath, seo);
  console.log('OK regresiones SEO/ruta producto');
} else {
  console.log('SKIP regresiones SEO/ruta producto: ya aplicadas');
}

console.log('Hardening temporal aplicado correctamente.');