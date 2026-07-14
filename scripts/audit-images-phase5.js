const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  utils: read('js/image-utils.js'),
  images: read('js/images.js'),
  runtime: read('js/images-phase5.js'),
  admin: read('js/admin-images-phase5.js'),
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
  'Quitar una personalización restaura imágenes responsive',
  files.runtime.includes('buildResponsivePicture') &&
    files.runtime.includes('STATIC.placeholder') &&
    files.runtime.includes("url ? buildCustomImage(slotId, url) : buildResponsivePicture(fallback)"),
  'no deben quedar contenedores vacíos después de quitar una URL'
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
  'El panel intercepta guardados inseguros antes del código legado',
  files.admin.includes("document.addEventListener('click'") &&
    files.admin.includes('event.stopImmediatePropagation()') &&
    files.admin.includes('saveImages(') &&
    files.admin.includes("}, true);"),
  'la validación debe ejecutarse en fase de captura'
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
