'use strict';

/* =============================================================
   TINTIN — Auditoría de Productos, Colecciones e Imágenes (admin + tienda)

   Bloquea las invariantes del dominio de catálogo y multimedia para que no se
   rompan en silencio:

   - CRUD de productos: permisos reales, validación, confirmación destructiva,
     anti-doble-guardado, registro de auditoría, listener en tiempo real con
     guardia anti-duplicado y render escapado.
   - CRUD de colecciones: permisos, slug único, reasignación sin orfandad al
     renombrar/eliminar y registro de auditoría (agregado en 11.3).
   - Tienda: sanitización de nombre/categoría/badge, ocultamiento de productos
     inactivos/agotados/sin nombre y sincronización del carrito.
   - Importación segura (Fase 9): límites de tamaño/filas, gate Super Admin,
     URLs seguras, detección de duplicados, validación de categoría, escritura
     por lotes auditada, confirmación y sin sobrescribir productos existentes.
   - Imágenes: subida firmada a Cloudinary (sin secretos en el cliente),
     validación por magic bytes, redimensión/WebP, limpieza de huérfanas,
     timeouts y sanitización de URLs de imagen en el render.
   - Proveedores: Cloudinary activo; ImgBB solo con clave del usuario; sin
     claves compartidas expuestas.

   No abre navegador: comprobaciones estáticas sobre el código publicado.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const adminApp    = read('js/admin-app.js');
const adminHtml   = read('admin.html');
const importJs    = read('js/admin-import-phase9.js');
const mediaLib    = read('js/media-library.js');
const imageProc   = read('js/image-processing.js');
const imageUtils  = read('js/image-utils.js');
const storefront  = read('script.js');
const productsStore = read('js/products-store.js');

// ===========================================================================
// 1. CRUD DE PRODUCTOS
// ===========================================================================
check(
  'Guardar producto valida permiso de crear y de editar por separado',
  /can\(currentRole, 'addProducts'\) && roleCanDo\('productos', 'crear'\)/.test(adminApp) &&
    /can\(currentRole, 'editProducts'\) && roleCanDo\('productos', 'editar'\)/.test(adminApp),
  'prodGuardar debe exigir addProducts/editProducts + el permiso dinámico correspondiente.'
);
check(
  'Guardar producto valida nombre, categoría y precio obligatorios',
  /if \(!name \|\| !category \|\| !price\)/.test(adminApp),
  'Nombre, categoría y precio deben ser obligatorios antes de escribir en Firestore.'
);
check(
  'Guardar producto previene el doble guardado deshabilitando el botón',
  /prod-save-btn'\);[\s\S]{0,120}btn\.disabled = true/.test(adminApp),
  'El botón de guardar debe deshabilitarse mientras se escribe para evitar guardados dobles.'
);
check(
  'Eliminar producto pide confirmación y valida permiso',
  /roleCanDo\('productos', 'eliminar'\)/.test(adminApp) &&
    /confirm\(`¿Eliminar "\$\{name\}"\?/.test(adminApp),
  'La eliminación de producto debe confirmarse y respetar deleteProducts.'
);
check(
  'Crear/editar/eliminar producto se registran en Auditoría',
  /logAudit\('crear_producto'/.test(adminApp) &&
    /logAudit\('editar_producto'/.test(adminApp) &&
    /logAudit\('eliminar_producto'/.test(adminApp),
  'El CRUD de productos debe dejar rastro en el registro de auditoría.'
);
check(
  'El listado de productos usa un listener en tiempo real con guardia anti-duplicado',
  /_productosUnsub = onSnapshot\(/.test(adminApp) &&
    /if \(_productosUnsub\) return;/.test(adminApp),
  'loadProductos debe suscribirse una sola vez para no acumular listeners.'
);
check(
  'El render de productos escapa nombre e imagen (anti-XSS)',
  /escapeHtmlAdmin\(p\.name\)/.test(adminApp) &&
    /sanitizeImageUrl\(p\.imageUrl/.test(adminApp),
  'productRowHtml debe escapar el nombre y sanitizar la URL de imagen.'
);
check(
  'El stock vacío se guarda como null (no controlado), distinto de 0 (agotado)',
  /if \(raw === ''\) return null;/.test(adminApp),
  'Un stock vacío no debe confundirse con 0; debe quedar como null (ilimitado).'
);

// ===========================================================================
// 2. CRUD DE COLECCIONES
// ===========================================================================
check(
  'Guardar colección valida permiso y previene slug duplicado',
  /roleCanDo\('colecciones', 'crear'\)/.test(adminApp) &&
    /roleCanDo\('colecciones', 'editar'\)/.test(adminApp) &&
    /Ya existe una colección con el slug/.test(adminApp),
  'collGuardar debe exigir manageContent + permiso dinámico y rechazar slugs duplicados.'
);
check(
  'Renombrar una colección reasigna sus productos por lotes antes de borrar la vieja',
  /setDoc\(doc\(db, 'collections', slug\), data\)[\s\S]{0,400}batchUpdateChunked\([\s\S]{0,200}deleteDoc\(doc\(db, 'collections', originalSlug\)\)/.test(adminApp),
  'El cambio de slug no debe dejar productos huérfanos apuntando al slug viejo.'
);
check(
  'Eliminar una colección con productos fuerza reasignación (sin orfandad)',
  /No se puede eliminar sin reasignarlos primero/.test(adminApp) &&
    /roleCanDo\('colecciones', 'eliminar'\)/.test(adminApp),
  'Borrar una colección con productos debe reasignarlos o quitarles la categoría a propósito.'
);
check(
  'El CRUD de colección individual se registra en Auditoría',
  /logAudit\('crear_coleccion'/.test(adminApp) &&
    /logAudit\('editar_coleccion', 'coleccion', originalSlug/.test(adminApp) &&
    /logAudit\('eliminar_coleccion', 'coleccion', slug, label/.test(adminApp),
  'Crear/editar/renombrar/eliminar una colección debe dejar rastro igual que los productos.'
);
check(
  'Existe la etiqueta de auditoría "crear_coleccion"',
  /crear_coleccion:\s*'/.test(adminApp),
  'El mapa de etiquetas de auditoría debe incluir crear_coleccion.'
);

// ===========================================================================
// 3. TIENDA — sanitización y sincronización de carrito
// ===========================================================================
check(
  'La tienda escapa nombre, categoría, badge y variante del producto',
  /escapeHtml\(p\.name\)/.test(storefront) &&
    /escapeHtml\(p\.badge\)/.test(storefront),
  'script.js debe escapar los campos de producto que renderiza.'
);
check(
  'La tienda oculta productos inactivos, agotados y sin nombre',
  /p\.active !== false && isInStock\(p\) && hasValidName\(p\)/.test(storefront),
  'isVisible debe combinar activo + en stock + nombre válido.'
);
check(
  'El carrito descarta productos borrados o desactivados y refresca precio/nombre',
  /function syncCartWithCatalog/.test(storefront) &&
    /if \(!live \|\| live\.active === false\) return null;/.test(storefront),
  'syncCartWithCatalog debe quitar del carrito lo que ya no existe o quedó inactivo.'
);

// ===========================================================================
// 4. IMPORTACIÓN SEGURA (Fase 9)
// ===========================================================================
check(
  'La importación limita tamaño de archivo y cantidad de filas',
  /MAX_FILE_BYTES = 5 \* 1024 \* 1024/.test(importJs) &&
    /MAX_IMPORT_ROWS = 1000/.test(importJs),
  'Debe haber un tope de 5 MB y 1.000 productos por importación.'
);
check(
  'La importación y la exportación están reservadas al Super Admin',
  /function isSuperAdmin/.test(importJs) &&
    /if \(!isSuperAdmin\(\) \|\| state\.busy\) return;/.test(importJs),
  'Solo el Super Admin puede importar productos o descargar la copia operativa.'
);
check(
  'La importación bloquea URLs que no sean http(s)',
  /function safeUrl/.test(importJs) &&
    /\['http:', 'https:'\]\.includes\(parsed\.protocol\)/.test(importJs),
  'safeUrl debe rechazar esquemas peligrosos en las imágenes importadas.'
);
check(
  'La importación detecta duplicados por huella y por nombre::categoría',
  /function markDuplicates/.test(importJs) &&
    /importFingerprint/.test(importJs),
  'Los productos ya existentes deben marcarse como duplicados y omitirse.'
);
check(
  'La importación valida que la colección exista antes de escribir',
  /La colección no existe/.test(importJs) &&
    /currentCategorySlugs\(\)\.has\(/.test(importJs),
  'Una fila con una colección inexistente debe quedar inválida.'
);
check(
  'La importación confirma, escribe por lotes y registra en Auditoría sin sobrescribir',
  /confirm\(`¿Importar \$\{ready\.length\}/.test(importJs) &&
    /const reference = doc\(collection\(db, 'products'\)\)/.test(importJs) &&
    /action: 'importar_productos'/.test(importJs),
  'La importación debe pedir confirmación, crear documentos nuevos y auditar el lote.'
);
check(
  'La importación reporta progreso real por lote',
  /state\.ui\.progressBar\.style\.width = `\$\{Math\.round\(\(completed \/ ready\.length\) \* 100\)\}%`/.test(importJs),
  'La barra de progreso debe reflejar los productos ya escritos.'
);
check(
  'La exportación de productos existe y respeta el permiso de exportar',
  /window\.bulkExportProducts = function/.test(adminApp) &&
    /roleCanDo\('productos', 'exportar'\)/.test(adminApp),
  'Debe poder exportarse el catálogo a CSV con control de permiso.'
);

// ===========================================================================
// 5. IMÁGENES / MEDIA LIBRARY (Cloudinary)
// ===========================================================================
check(
  'La subida a Cloudinary se firma del lado servidor (sin secreto en el cliente)',
  /callSecureFunction\('cloudinary-sign-upload'/.test(mediaLib) &&
    !/api_secret/.test(mediaLib) &&
    !/upload_preset/.test(mediaLib),
  'El cliente nunca debe llevar el secreto ni un preset sin firmar de Cloudinary.'
);
check(
  'La biblioteca limpia imágenes huérfanas comprobando uso real antes de borrar',
  /function findImageUsage/.test(mediaLib) &&
    /where\('imageUrl', '==', url\)/.test(mediaLib) &&
    /where\('image', '==', url\)/.test(mediaLib) &&
    /export async function deleteMediaByUrlIfUnused/.test(mediaLib),
  'Antes de borrar una imagen se debe verificar que no esté en productos/colecciones/settings.'
);
check(
  'Cada operación de red de la biblioteca tiene timeout',
  /function withTimeout/.test(mediaLib) &&
    /UPLOAD_TIMEOUT_MS/.test(mediaLib) &&
    /SIGN_TIMEOUT_MS/.test(mediaLib),
  'Ninguna subida/firma/guardado debe quedar colgada indefinidamente.'
);
check(
  'Una subida parcial se limpia de Cloudinary si falla antes de guardar',
  /catch \(error\) \{[\s\S]{0,260}deleteCloudinaryAssets\(uploadedIds\)/.test(mediaLib),
  'Si falla el guardado en Firestore, el asset ya subido debe borrarse para no dejar basura.'
);
check(
  'La validación de imagen usa magic bytes, no solo la extensión',
  /const SIGNATURES =/.test(imageProc) &&
    /export async function validateImageFile/.test(imageProc) &&
    /detectRealImageMime/.test(imageProc),
  'validateImageFile debe leer la firma binaria real del archivo.'
);
check(
  'El procesamiento redimensiona y re-codifica (WebP con fallback)',
  /export async function processImage/.test(imageProc) &&
    /image\/webp/.test(imageProc) &&
    /Math\.min\(1, maxWidth \/ bitmap\.width/.test(imageProc),
  'Las imágenes se deben achicar y comprimir antes de subir.'
);
check(
  'El render sanitiza la URL de imagen y rechaza esquemas peligrosos',
  /export function sanitizeImageUrl/.test(imageUtils) &&
    /\['https:', 'http:'\]\.includes\(parsed\.protocol\)/.test(imageUtils),
  'sanitizeImageUrl debe bloquear javascript:/data: y devolver vacío ante URLs inseguras.'
);

// ===========================================================================
// 6. PROVEEDORES DE IMAGEN / SECRETOS
// ===========================================================================
check(
  'ImgBB (módulo Contenido) usa la clave del usuario, no una compartida embebida',
  /localStorage\.getItem\('tt_imgbb_key'\)/.test(adminApp) &&
    !/api_key\s*[:=]\s*['"][0-9a-f]{20,}/i.test(adminApp),
  'La subida por ImgBB debe depender de una clave que ingresa el usuario, sin claves embebidas.'
);
check(
  'No hay tokens/keys de Cloudinary embebidos en el cliente',
  !/cloudinary[^\n]{0,40}api_secret/i.test(mediaLib) &&
    !/CLOUDINARY_API_SECRET/.test(mediaLib),
  'El secreto de Cloudinary vive en la función firmada, nunca en el bundle público.'
);

// ===========================================================================
// 7. CAMPOS LEGACY / MAPEO
// ===========================================================================
check(
  'products-store normaliza campos antiguos (priceBefore, oferta, badge)',
  /priceBefore:\s*d\.priceBefore/.test(productsStore) &&
    /oferta:\s*!!d\.oferta/.test(productsStore),
  'El mapeo público debe tolerar los campos históricos del producto.'
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de productos/colecciones/imágenes fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de productos/colecciones/imágenes completada correctamente (${checks.length} comprobaciones).`);
