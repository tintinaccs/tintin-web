const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const filePath = file => path.join(root, file);
const read = file => fs.readFileSync(filePath(file), 'utf8');
const exists = file => fs.existsSync(filePath(file));

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
  firebase: read('js/firebase.js'),
  products: read('js/products-store.js'),
  ui: read('js/ui-quality.js'),
  readme: read('assets-tintin/images/README-IMAGENES.md'),
  packageJson: read('package.json'),
  firebaseJson: read('firebase.json'),
  cloudinarySecurity: read('netlify/functions/_cloudinary-security.mjs'),
  cloudinarySign: read('netlify/functions/cloudinary-sign-upload.mjs'),
  cloudinaryDelete: read('netlify/functions/cloudinary-delete.mjs'),
  cloudinarySetup: read('CLOUDINARY_SETUP.md'),
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
  'no deben quedar contenedores vacíos después de quitar una URL'
);

check(
  'Cada slot admite imagen independiente por dispositivo',
  files.images.includes('DEVICE_VARIANT_SLOT_IDS') &&
    files.images.includes('resolveSlotImage') &&
    files.images.includes("`${slotId}_tablet`") &&
    files.images.includes("`${slotId}_mobile`") &&
    files.images.includes("`${slotId}_autoReuseDesktop`"),
  'logo, editoriales y Nosotros deben aceptar variantes por dispositivo'
);

check(
  'La cascada de dispositivo está centralizada',
  files.resolver.includes('export function resolveDeviceImage') &&
    files.resolver.includes('export function resolveCollectionImage') &&
    files.resolver.includes('export function firstEligibleProductImage') &&
    files.runtime.includes("from './images.js'") &&
    files.runtime.includes('resolveSlotImage'),
  'ninguna página debe reimplementar la prioridad responsive'
);

check(
  'Logo, editoriales y Nosotros se actualizan globalmente',
  files.runtime.includes("'.tt-logo-img,#tt-loader-logo,#tt-intro-logo'") &&
    files.runtime.includes("document.querySelectorAll('[data-img-slot]')") &&
    files.runtime.includes('applyContentSlot'),
  'todos los componentes deben usar el mismo snapshot'
);

check(
  'Renderers heredados no pueden restaurar imágenes viejas',
  files.runtime.includes('new MutationObserver(scheduleApply)') &&
    files.runtime.includes('ttImagePhase5Signature') &&
    files.runtime.includes('data-tt-image-phase5'),
  'el runtime debe volver a imponer el valor actual sin crear un bucle'
);

check(
  'Ya no existe el campo de URL manual',
  !files.adminHtml.includes('adm-url-input') &&
    !files.adminHtml.includes('placeholder="https://… pegar URL aquí"') &&
    files.adminHtml.includes('attachImageUploadWidget') &&
    files.adminHtml.includes('mountDeviceWidget') &&
    files.adminHtml.includes('saveImages('),
  'cada slot debe subir un archivo real'
);

check(
  'El archivo se valida por su contenido real',
  files.processing.includes('detectRealImageMime') &&
    files.processing.includes('createImageBitmap') &&
    files.processing.includes('SIGNATURES'),
  'un ejecutable renombrado no debe pasar como imagen'
);

check(
  'El navegador conserva procesamiento, WebP y vista previa',
  files.uploadWidget.includes("import { validateImageFile } from './image-processing.js'") &&
    files.uploadWidget.includes('pendingPreviewUrl = URL.createObjectURL(file)') &&
    files.uploadWidget.includes('uploadImageToLibrary(file') &&
    files.processing.includes('canvas.toBlob'),
  'la migración no debe quitar la optimización existente'
);

check(
  'La biblioteca usa Cloudinary con firmas temporales',
  files.mediaLibrary.includes("callSecureFunction('cloudinary-sign-upload'") &&
    files.mediaLibrary.includes('uploadBlobToCloudinary') &&
    files.mediaLibrary.includes("provider: 'cloudinary'") &&
    files.mediaLibrary.includes('publicId: fullUpload.public_id') &&
    files.mediaLibrary.includes('setDoc(doc(db, MEDIA_COLLECTION, mediaId)'),
  'Firestore debe guardar metadata, no archivos binarios'
);

check(
  'Borrar una imagen usa la función protegida de Cloudinary',
  files.mediaLibrary.includes("callSecureFunction('cloudinary-delete'") &&
    files.mediaLibrary.includes('deleteCloudinaryAssets') &&
    files.mediaLibrary.includes('await deleteDoc(mediaRef)') &&
    files.mediaLibrary.indexOf('await deleteCloudinaryAssets') < files.mediaLibrary.indexOf('await deleteDoc(mediaRef)'),
  'los assets deben borrarse antes de eliminar su metadata'
);

check(
  'Reemplazar o quitar limpia solo imágenes sin uso',
  files.uploadWidget.includes('deleteMediaByUrlIfUnused') &&
    files.uploadWidget.includes('cleanPreviousUrl(previousUrl') &&
    files.mediaLibrary.includes('export async function deleteMediaByUrlIfUnused') &&
    files.mediaLibrary.includes('const usage = await findImageUsage(url)'),
  'una URL compartida no debe borrarse por accidente'
);

check(
  'Borrar revisa settings, productos y colecciones',
  files.mediaLibrary.includes('export async function findImageUsage') &&
    files.mediaLibrary.includes("where('imageUrl', '==', url)") &&
    files.mediaLibrary.includes("where('image', '==', url)"),
  'no debe borrarse una imagen activa'
);

check(
  'El API Secret existe únicamente en la función de servidor',
  !files.mediaLibrary.includes('CLOUDINARY_API_SECRET') &&
    !files.uploadWidget.includes('CLOUDINARY_API_SECRET') &&
    files.cloudinarySecurity.includes('process.env.CLOUDINARY_API_SECRET') &&
    !files.cloudinarySign.includes('apiSecret,') &&
    !files.cloudinarySign.includes('apiSecret:'),
  'el secreto nunca puede llegar al navegador ni a la respuesta JSON'
);

check(
  'Netlify verifica criptográficamente el token de Firebase',
  files.cloudinarySecurity.includes("createVerify('RSA-SHA256')") &&
    files.cloudinarySecurity.includes('GOOGLE_CERTS_URL') &&
    files.cloudinarySecurity.includes('payload.aud !== FIREBASE_PROJECT_ID') &&
    files.cloudinarySecurity.includes('payload.iss !== FIREBASE_ISSUER') &&
    files.cloudinarySecurity.includes("email !== SUPERADMIN_EMAIL") &&
    files.cloudinarySecurity.includes('payload.exp <= now'),
  'no alcanza con confiar en un correo enviado por el navegador'
);

check(
  'Las firmas limitan la subida a la carpeta privada de administración',
  files.cloudinarySign.includes('cleanMediaId(body?.mediaId)') &&
    files.cloudinarySign.includes('cleanVariant(body?.variant)') &&
    files.cloudinarySign.includes('tintin/media/${mediaId}/${variant}') &&
    files.cloudinarySign.includes('cloudinarySignature(signedParameters, apiSecret)'),
  'el navegador no debe elegir public IDs arbitrarios'
);

check(
  'El borrado solo admite public IDs de Tintin',
  files.cloudinaryDelete.includes('cleanPublicId') &&
    files.cloudinaryDelete.includes("invalidate: 'true'") &&
    files.cloudinarySecurity.includes("^tintin\\/media\\/") &&
    files.cloudinaryDelete.includes("['ok', 'not found'].includes(data.result)"),
  'no se debe poder borrar otro asset de la cuenta'
);

check(
  'Firebase Storage no se inicializa ni se importa',
  !files.firebase.includes('firebase-storage.js') &&
    !files.firebase.includes('getStorage') &&
    !files.firebase.includes('storageBucket') &&
    !files.firebase.includes('export { db, auth, provider, storage }') &&
    !files.mediaLibrary.includes('firebase-storage.js') &&
    !files.mediaLibrary.includes('uploadBytes(') &&
    !files.mediaLibrary.includes('deleteObject('),
  'la web no debe depender de Firebase Storage'
);

check(
  'El despliegue de Firebase queda en el plan Spark',
  files.packageJson.includes('firebase deploy --only firestore:rules --project tintin-accesorios') &&
    !files.packageJson.includes('firestore:rules,storage') &&
    !files.firebaseJson.includes('"storage"') &&
    !exists('storage.rules'),
  'npm run deploy:rules no debe intentar activar Storage'
);

check(
  'El panel conserva la misma navegación y biblioteca',
  files.admin.includes('supportedSections') &&
    files.admin.includes("'biblioteca'") &&
    files.admin.includes("button.style.display = 'none'") &&
    files.adminHtml.includes('mountMediaLibrarySection(grid)'),
  'la migración interna no debe quitar funcionalidades visibles'
);

check(
  'Las imágenes de productos se sanean al leer Firestore',
  files.products.includes("from './image-utils.js'") &&
    files.products.includes('sanitizeImageUrl') &&
    files.products.includes('return sanitizeImageUrl(img);'),
  'ningún renderer público debe recibir una URL cruda'
);

check(
  'La Fase 5 se inicia en todas las páginas y en el panel',
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
  'Existe una guía completa de configuración online',
  files.cloudinarySetup.includes('CLOUDINARY_CLOUD_NAME') &&
    files.cloudinarySetup.includes('CLOUDINARY_API_KEY') &&
    files.cloudinarySetup.includes('CLOUDINARY_API_SECRET') &&
    files.cloudinarySetup.includes('Environment variables') &&
    files.cloudinarySetup.includes('npm run deploy:rules') &&
    files.cloudinarySetup.includes('/admin-images.html'),
  'la configuración manual debe quedar documentada sin exponer secretos'
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
