const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  schema: read('js/core/store/esquema-contenido.js'),
  publicRuntime: read('js/core/store/contenido-sitio.js'),
  admin: read('js/admin/content/gestion-contenido-admin.js'),
  badges: read('js/core/auth/insignia-edicion.js'),
  permissions: read('js/core/auth/permisos-roles.js'),
  quality: read('js/quality/calidad-interfaz.js'),
  rules: read('firestore.rules'),
  packageJson: read('package.json'),
  panel: read('admin.html'),
  adminApp: read('js/admin/admin-app.js'),
  faq: read('preguntas-frecuentes.html'),
  privacy: read('privacidad.html'),
  shipping: read('envios.html'),
  analytics: read('js/analytics/analitica.js'),
  loginMaintenance: read('js/pages/login/mantenimiento-acceso.js'),
  checkoutMaintenance: read('js/pages/checkout/checkout-mantenimiento.js'),
  profileMaintenance: read('js/pages/profile/mantenimiento-perfil.js'),
  searchController: read('js/components/navigation/compartido/control-busqueda.js'),
  pageLoader: read('js/cargador-pagina.js'),
  engagementCustomer: read('cloudflare/participacion-clientes.js'),
  engagementAdmin: read('cloudflare/participacion-admin.js'),
  orderEmail: read('functions/api/order-email.js'),
};

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`OK — ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ''}`);
}

const requiredPages = [
  'index', 'nosotros', 'catalogo', 'collections',
  'contact', 'envios', 'faq', 'cambios'
];

check(
  'El esquema cubre las ocho páginas administrables',
  requiredPages.every(page => files.schema.includes(`${page}: {`) || files.schema.includes(`'${page}'`)) &&
    files.schema.includes('CONTENT_PAGE_IDS'),
  'Falta una página en esquema-contenido.js'
);

check(
  'Firestore guarda valores y no selectores arbitrarios',
  files.schema.includes('SITE_CONTENT_SCHEMA') &&
    files.admin.includes('sanitizeSection(currentPageId, currentSectionId') &&
    !files.admin.includes('querySelector(control.value)'),
  'Los selectores deben permanecer únicamente en código'
);

check(
  'El contenido público nunca inserta HTML de Firestore',
  !files.publicRuntime.includes('.innerHTML') &&
    !files.publicRuntime.includes('insertAdjacentHTML') &&
    files.publicRuntime.includes('document.createTextNode') &&
    files.publicRuntime.includes('replaceChildren'),
  'contenido-sitio.js debe usar nodos de texto'
);

check(
  'Los saltos de línea se crean con nodos seguros',
  files.publicRuntime.includes("document.createElement('br')") &&
    files.publicRuntime.includes('appendPlainLines'),
  'No se debe convertir texto a <br> mediante reemplazo HTML'
);

check(
  'Los enlaces se validan antes de mostrarse',
  files.schema.includes('sanitizeContentHref') &&
    files.schema.includes('javascript|data|vbscript|file') &&
    files.publicRuntime.includes('sanitizeContentHref(value'),
  'Los href editables necesitan una lista segura de protocolos'
);

check(
  'Los campos ausentes conservan el HTML publicado',
  files.publicRuntime.includes('raw === undefined || raw === null') &&
    files.publicRuntime.includes('return;'),
  'Un documento parcial no debe sustituir otros textos por defaults'
);

check(
  'Contenido está integrado en Apariencia sin crear un módulo superior duplicado',
  files.admin.includes("section.id = 'appearance-content-phase6'") &&
    files.admin.includes("document.getElementById('appearance-content-phase6-host')") &&
    files.panel.includes('id="section-apariencia"') &&
    files.panel.includes('id="appearance-content-phase6-host"') &&
    !files.panel.includes('id="section-contenido"') &&
    !files.panel.includes('data-section="contenido"') &&
    !files.adminApp.includes('// ======== CONTENIDO DEL SITIO ========'),
  'Debe existir una sola superficie Apariencia y contenido, sin el editor legado duplicado.'
);

check(
  'El editor respeta permisos dinámicos',
  files.admin.includes("canDo(currentRole, 'contenido', 'editarTextos')") &&
    files.admin.includes("canDo(currentRole, 'contenido', 'activarDesactivarSecciones')") &&
    files.badges.includes("canDo(role, 'contenido', 'editarTextos')"),
  'No alcanza con comprobar el rol estático'
);

check(
  'Guardar registra revisión y autor',
  files.admin.includes('revision: increment(1)') &&
    files.admin.includes('updatedAt: serverTimestamp()') &&
    files.admin.includes("updatedBy: currentUser.email"),
  'Cada cambio debe quedar identificable en el documento'
);

check(
  'Restaurar contenido original está implementado',
  files.admin.includes('getSectionDefaults(currentPageId, currentSectionId)') &&
    files.admin.includes('handleRestore') &&
    files.permissions.includes("restaurar:                 { label: 'Restaurar contenido original',   defaultFrom: 'manageContent'"),
  'El permiso no debe seguir marcado como función inexistente'
);

check(
  'Los cambios sin guardar usan el guard global sin listener duplicado',
  files.admin.includes('window.AdminUnsaved.register(nextId') &&
    files.admin.includes('window.AdminUnsaved?.markDirty(activeUnsavedScopeId)') &&
    files.admin.includes('window.AdminUnsaved?.markClean(activeUnsavedScopeId)') &&
    files.admin.includes('confirmDiscard()') &&
    files.admin.includes('Hay cambios sin guardar') &&
    !files.admin.includes("window.addEventListener('beforeunload'"),
  'Contenido debe integrarse al guard compartido; no crear otro beforeunload'
);

check(
  'Una actualización remota no pisa un formulario abierto',
  files.admin.includes('if (dirty)') &&
    files.admin.includes('Esta página cambió desde otra pestaña'),
  'La sincronización debe avisar cuando hay edición local'
);

check(
  'Los lápices detectan secciones agregadas después de cargar',
  files.badges.includes('new MutationObserver') &&
    files.badges.includes('[data-tt-editable][data-tt-section]') &&
    files.badges.includes('tracked = new Map()'),
  'No deben depender de una única búsqueda al iniciar'
);

check(
  'La Fase 6 se inicia en el panel global',
  files.quality.includes('bootAdminContentPhase6') &&
    files.quality.includes("'../admin/content/gestion-contenido-admin.js'"),
  'calidad-interfaz.js debe iniciar el editor en admin.html'
);

check(
  'Las reglas ya protegen site_content',
  files.rules.includes('match /site_content/{pageId}') &&
    files.rules.includes("currentRolePermAllows('contenido', 'editarTextos')"),
  'El editor debe usar la colección protegida existente'
);

check(
  'El comando de auditoría está disponible',
  files.packageJson.includes('"audit:content"'),
  'Falta npm run audit:content'
);


check(
  'Las rutas limpias identifican el mismo contenido que sus alias .html',
  files.schema.includes('PAGE_PATH_TO_ID[`${file}.html`]'),
  'detectContentPageId debe resolver las rutas públicas limpias'
);

check(
  'Defaults restaurados conservan rutas limpias y retiro real',
  files.schema.includes("'/catalogo'") &&
    files.schema.includes("'/about'") &&
    files.schema.includes('Retiro en San Lorenzo — Gratis') &&
    !files.schema.includes("'catalogo.html', { index: 0, type: 'href'") &&
    !files.schema.includes("'about.html', { index: 1, type: 'href'"),
  'Restaurar Apariencia no debe reintroducir aliases .html ni una tienda física'
);

check(
  'Footer global actualiza WhatsApp aun sin span auxiliar',
  files.publicRuntime.includes("item.selector === '.tt-footer-wa-text'") &&
    files.publicRuntime.includes("element.classList.contains('tt-footer-wa')"),
  'Debe conservar el SVG y reemplazar solo el texto del enlace'
);

const faqQuestions = (files.faq.match(/class="tt-faq-q"/g) || []).length;
const faqAnswers = (files.faq.match(/class="tt-faq-a"/g) || []).length;
check(
  'FAQ estática coincide con los once índices editables',
  faqQuestions === 11 && faqAnswers === 11 &&
    !files.faq.includes('¿Los relojes son originales?') &&
    files.faq.includes('Los métodos habilitados aparecen en el checkout al confirmar tu pedido.') &&
    files.faq.includes('En cada producto indicamos su material y características.'),
  `Preguntas=${faqQuestions}, respuestas=${faqAnswers}`
);

check(
  'Privacidad identifica al proveedor real de geolocalización aproximada',
  files.privacy.includes('Cloudflare estima la ciudad, región y país') &&
    files.privacy.includes('Cloudflare, como proveedor técnico') &&
    !files.privacy.includes('Netlify'),
  'La política debe coincidir con functions/api/visitor-geo.js'
);

check(
  'Envíos describe el retiro como retiro en San Lorenzo',
  files.shipping.includes('Retiro en San Lorenzo — Gratis') &&
    !files.shipping.includes('Retiro en Tienda — Gratis'),
  'La operación es online y el retiro se coordina en San Lorenzo'
);

check(
  'Analítica reconoce /checkout y /checkout.html',
  files.analytics.includes('checkout(?:\\.html)?\\/?$') &&
    !files.analytics.includes('/\\/checkout\\.html$/i.test'),
  'begin_checkout no debe depender del alias .html'
);

check(
  'Canonical dinámicos de cuenta y checkout permanecen limpios',
  files.loginMaintenance.includes("new URL('/login', location.origin)") &&
    files.checkoutMaintenance.includes("new URL('/checkout', location.origin)") &&
    files.profileMaintenance.includes("new URL('/perfil', window.location.origin)") &&
    !files.loginMaintenance.includes("new URL('login.html'") &&
    !files.checkoutMaintenance.includes("new URL('checkout.html'") &&
    !files.profileMaintenance.includes("new URL('perfil.html'"),
  'El runtime no debe sobrescribir canonical limpios con .html'
);

check(
  'Búsqueda y notificaciones generan links canónicos de producto',
  files.searchController.includes('`/product?id=${encodeURIComponent') &&
    !files.searchController.includes('`product.html?id=') &&
    !files.engagementCustomer.includes('product.html?id=') &&
    !files.engagementAdmin.includes('product.html?id='),
  'Los enlaces visibles y notificaciones deben usar /product?id='
);

check(
  'Loader reconoce producto tanto por ruta limpia como por alias legado',
  files.pageLoader.includes('/^product(?:\\.html)?$/i.test(productPath)'),
  'El nombre del producto debe preservarse al navegar desde /product'
);

check(
  'Correo administrativo muestra ciudad y departamento sin duplicar',
  files.orderEmail.includes('function cityDepartmentLabel(order)') &&
    files.orderEmail.includes('const cityLabel = cityDepartmentLabel(order);') &&
    files.orderEmail.includes('${escapeHtml(cityLabel)}</td></tr>') &&
    files.orderEmail.includes('Ciudad: ${cityLabel}') &&
    files.orderEmail.includes("/admin';"),
  'El correo debe mostrar, por ejemplo, Santiago (Misiones)'
);

if (failures) {
  console.error(`\nAuditoría Fase 6: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría Fase 6: todo correcto.');
