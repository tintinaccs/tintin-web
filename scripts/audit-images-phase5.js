const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  utils: read('js/image-utils.js'),
  images: read('js/images.js'),
  resolver: read('js/image-resolver.js'),
  runtime: read('js/images-phase5.js'),
  admin: read('js/admin-images-phase5.js'),
  adminHtml: read('admin-images.html'),
  uploadWidget: read('js/image-upload-widget.js'),
  processing: read('js/image-processing.js'),
  mediaLibrary: read('js/media-library.js'),
  products: read('js/products-store.js'),
  ui: read('js/ui-quality.js'),
  readme: read('assets-tintin/images/README-IMAGENES.md'),
  packageJson: read('package.json'),
};

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`OK  ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

check(
  'Las URLs se validan en una utilidad compartida',
  files.utils.includes("!['https:', 'http:'].includes(parsed.protocol)") &&
    files.utils.includes('FORBIDDEN_URL_CHARS') &&
    files.utils.includes('MAX_IMAGE_URL_LENGTH'),
  'deben rechazarse esquemas, comillas y URLs excesivas'
);

check(
  'settings/images contiene solamente espacios globales reales',
  files.images.includes("id: 'hero_bg_desktop'") &&
    files.images.includes("id: 'edit_bolsos'") &&
    files.images.includes("id: 'about_foto'") &&
    files.images.includes("id: 'logo_main'") &&
    !files.images.includes("id: 'prod_1'") &&
    !files.images.includes("id: 'coll_bags'") &&
    !files.images.includes("id: 'trust_envio'"),
  'productos y colecciones deben administrarse en sus propios documentos'
);

check(
  'Los parches de imagen aceptan solo claves conocidas',
  files.images.includes('allowedSettingKey(key)') &&
    files.images.includes('normalizeImagePatch') &&
    files.images.includes('if (!allowedSettingKey(key)) return;'),
  'no se deben guardar campos arbitrarios desde el navegador'
);

check(
  'La caché local siempre queda saneada',
  files.images.includes('normalizeImagesData(JSON.parse') &&
    files.images.includes('JSON.stringify(normalizeImagesData(data))'),
  'un valor antiguo inseguro no puede volver a circular'
);

check(
  'Los guardados incluyen actualización y sincronización',
  files.images.includes('serverTimestamp()') &&
    files.images.includes('return publish(next)') &&
    files.images.includes('onSnapshot('),
  'Firestore y pestañas abiertas deben recibir el mismo estado'
);

check(
  'Hero usa imágenes independientes para desktop, tablet y móvil',
  files.runtime.includes('hero_bg_desktop') &&
    files.runtime.includes('hero_bg_tablet') &&
    files.runtime.includes('hero_bg_mobile') &&
    files.runtime.includes('mobileSource.srcset = mobile') &&
    files.runtime.includes('tabletSource.srcset = tablet'),
  'los tres controles del panel deben tener efecto visual real'
);

check(
  'Quitar una personalización restaura imágenes responsive por dispositivo',
  files.runtime.includes('buildResponsivePicture') &&
    files.runtime.includes('STATIC.placeholder') &&
    files.runtime.includes('resolvedSlotUrls(slotId, fallback)') &&
    files.runtime.includes("resolveSlotImage(images, slotId, 'desktop') || absolute(fallback.desktop)"),
  'no deben quedar contenedores vacíos después de quitar una URL, en ningún dispositivo'
);

check(
  'Cada slot admite imagen independiente por dispositivo con reutilización automática de desktop',
  files.images.includes('DEVICE_VARIANT_SLOT_IDS') &&
    files.images.includes('resolveSlotImage') &&
    files.images.includes("`${slotId}_tablet`") &&
    files.images.includes("`${slotId}_mobile`") &&
    files.images.includes("`${slotId}_autoReuseDesktop`"),
  'logo, editoriales y Nosotros deben poder tener imagen propia en tablet/mobile, no solo el hero'
);

check(
  'La cascada de dispositivo está centralizada en un único resolver',
  files.resolver.includes('export function resolveDeviceImage') &&
    files.resolver.includes('export function resolveCollectionImage') &&
    files.resolver.includes('export function firstEligibleProductImage') &&
    files.runtime.includes("from './images.js'") &&
    files.runtime.includes('resolveSlotImage'),
  'ninguna página debe reimplementar la prioridad desktop/tablet/mobile por su cuenta'
);

check(
  'Logo, editoriales y Nosotros se actualizan globalmente',
  files.runtime.includes("'.tt-logo-img,#tt-loader-logo,#tt-intro-logo'") &&
    files.runtime.includes("document.querySelectorAll('[data-img-slot]')") &&
    files.runtime.includes('applyContentSlot'),
  'el logo y los data-img-slot deben usar el mismo snapshot'
);

check(
  'Renderers heredados no pueden restaurar imágenes viejas',
  files.runtime.includes('new MutationObserver(scheduleApply)') &&
    files.runtime.includes('ttImagePhase5Signature') &&
    files.runtime.includes('data-tt-image-phase5'),
  'el runtime debe volver a imponer el valor actual sin crear un bucle'
);

check(
  'Ya no existe el campo de URL insegura: cada slot sube un archivo real',
  !files.adminHtml.includes('adm-url-input') &&
    !files.adminHtml.includes('placeholder="https://… pegar URL aquí"') &&
    files.adminHtml.includes('attachImageUploadWidget') &&
    files.adminHtml.includes('mountDeviceWidget') &&
    files.adminHtml.includes('saveImages('),
  'nadie debe poder pegar ni escribir una URL a mano en este panel'
);
check(
  'El archivo subido se valida por su contenido real, no por su extensión',
  files.processing.includes('detectRealImageMime') &&
    files.processing.includes('createImageBitmap') &&
    files.processing.includes('SIGNATURES'),
  'un ejecutable renombrado a .png no debe poder pasar por imagen'
);
check(
  'La subida procesa (redimensiona/WebP), guarda en Storage y registra la metadata',
  files.uploadWidget.includes("import { uploadImageToLibrary } from './media-library.js'") &&
    files.mediaLibrary.includes('uploadBytes(') &&
    files.mediaLibrary.includes("setDoc(doc(db, MEDIA_COLLECTION, mediaId)"),
  'la biblioteca debe quedar como la única fuente de imágenes subidas'
);
check(
  'Borrar una imagen de la biblioteca revisa primero si sigue en uso',
  files.mediaLibrary.includes('export async function findImageUsage') &&
    files.mediaLibrary.includes("where('imageUrl', '==', url)") &&
    files.mediaLibrary.includes("where('image', '==', url)"),
  'no debe poder borrarse por accidente una imagen todavía activa'
);

check(
  'El panel oculta secciones duplicadas y explica la nueva propiedad',
  files.admin.includes('supportedSections') &&
    files.admin.includes("button.style.display = 'none'") &&
    files.admin.includes('Fotos de productos: se cambian desde Productos'),
  'no deben aparecer slots antiguos sin efecto'
);

check(
  'Las imágenes de productos se sanean al leer Firestore',
  files.products.includes("from './image-utils.js'") &&
    files.products.includes('sanitizeImageUrl') &&
    files.products.includes('return sanitizeImageUrl(img);'),
  'ningún renderer público debe recibir una URL cruda del producto'
);

check(
  'La Fase 5 se inicia en todas las páginas y en el panel de imágenes',
  files.ui.includes('bootImagesPhase5()') &&
    files.ui.includes('bootAdminImagesPhase5()') &&
    files.ui.includes("'./images-phase5.js'") &&
    files.ui.includes("'./admin-images-phase5.js'"),
  'ui-quality debe iniciar ambos módulos'
);

check(
  'La documentación define una sola fuente por tipo',
  files.readme.includes('una sola fuente por tipo de imagen') &&
    files.readme.includes('products/{id}.imageUrl') &&
    files.readme.includes('collections/{slug}.image') &&
    files.readme.includes('settings/images'),
  'la guía no debe recomendar slots duplicados'
);

check(
  'El comando de auditoría está publicado',
  files.packageJson.includes('"audit:images"'),
  'package.json debe exponer npm run audit:images'
);

if (failures) {
  console.error(`\nAuditoría Fase 5: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría Fase 5: todo correcto.');
