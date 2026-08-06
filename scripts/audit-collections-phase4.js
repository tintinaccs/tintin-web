const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  nav: read('js/components/navigation/compartido/carga-colecciones.js'),
  navCompatibility: read('js/components/navigation/compatibilidad/colecciones.js'),
  publicPhase4: read('js/pages/collections/presentacion-colecciones.js'),
  adminPhase4: read('js/admin/collections/gestion-colecciones-admin.js'),
  uiQuality: read('js/quality/calidad-interfaz.js'),
  store: read('js/pages/collections/estado-colecciones.js'),
  collectionsPage: read('collections.html'),
  catalogPage: read('catalogo.html'),
  collectionsPageRuntime: read('js/pages/collections/pagina-colecciones.js'),
  collectionsPageStyles: read('css/pages/collections/collections-page.css'),
  packageJson: read('package.json')
};

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`OK  ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

check(
  'Firestore sigue siendo la fuente de verdad',
  files.store.includes("collection(db, 'collections')") &&
    files.store.includes('onSnapshot') &&
    files.store.includes('visible !== false'),
  'collections-store debe escuchar la colección real y filtrar solo las visibles en público'
);

check(
  'El menú conserva una alternativa mientras carga',
  files.nav.includes('function hasUsableFallback') &&
    files.nav.includes("dataset.phase4CollectionsState = 'loading'") &&
    files.nav.includes("container.setAttribute('aria-busy', 'true')") &&
    files.nav.includes('if (!hasUsableFallback(container))'),
  'la navegación debe seguir siendo utilizable si Firestore tarda o falla'
);

check(
  'El menú falla de forma explícita sin destruir el fallback',
  files.nav.includes("createStateNode('No pudimos actualizar las colecciones. Podés seguir usando las opciones disponibles.', 'error')") &&
    files.nav.includes("retry.addEventListener('click'") &&
    files.nav.includes('container.appendChild(createStateNode'),
  'una falla debe informar, permitir reintentar y conservar los enlaces existentes'
);

check(
  'Los enlaces codifican el slug',
  files.nav.includes('encodeURIComponent(text(slug))') &&
    files.publicPhase4.includes('encodeURIComponent(clean(slug))'),
  'los slugs nunca se concatenan crudos en una URL'
);

check(
  'Los nombres se insertan como texto',
  files.nav.includes('label.textContent') &&
    files.publicPhase4.includes('name.textContent') &&
    !files.nav.includes('seedStaticSheetImages'),
  'no se debe interpolar contenido de Firestore con innerHTML'
);

check(
  'El módulo legado apunta a la fuente modular',
  files.navCompatibility.includes('components/navigation/compartido/carga-colecciones.js') &&
    files.navCompatibility.split('\n').length < 10,
  'js/components/navigation/compatibilidad/colecciones.js debe ser solamente un adaptador de compatibilidad'
);

check(
  'Portada, colecciones, catálogo y footer están sincronizados',
  files.publicPhase4.includes("'home-grid'") &&
    files.publicPhase4.includes("'collections-page'") &&
    files.publicPhase4.includes("'catalog-sidebar'") &&
    files.publicPhase4.includes("'catalog-mobile'") &&
    files.publicPhase4.includes("'footer'"),
  'todas las superficies públicas deben depender del mismo snapshot'
);

check(
  'Los renderers legados no pueden restaurar categorías viejas',
  files.publicPhase4.includes('new MutationObserver') &&
    files.publicPhase4.includes('isOwnedRenderValid') &&
    files.publicPhase4.includes('phase4CollectionNode'),
  'el módulo debe volver a imponer el snapshot actual'
);

check(
  'El slug queda inmutable al editar',
  files.adminPhase4.includes('slugInput.readOnly = isEditing') &&
    files.adminPhase4.includes('slugInput.value = originalSlug') &&
    files.adminPhase4.includes('originalSave.apply'),
  'renombrar el texto visible no debe mover documentos/productos a medias'
);

check(
  'El importador fijo de 12 colecciones queda deshabilitado',
  files.adminPhase4.includes('window.collImportarDefaults = function') &&
    files.adminPhase4.includes('El importador fijo fue desactivado'),
  'la base no debe recrear categorías heredadas automáticamente'
);

check(
  'El CSV usa colecciones reales',
  files.adminPhase4.includes('onAllCollectionsUpdate') &&
    files.adminPhase4.includes('collections.forEach(collection => select.appendChild') &&
    files.adminPhase4.includes('Seleccionar colección'),
  'las opciones no pueden depender de una lista fija'
);

check(
  'Las imágenes de colección se validan',
  files.adminPhase4.includes('validCollectionImage') &&
    files.adminPhase4.includes("['https:', 'http:'].includes(parsed.protocol)"),
  'el panel no debe guardar esquemas inseguros ni fragmentos con comillas'
);

check(
  'La fase 4 se inicia globalmente',
  files.uiQuality.includes('bootCollectionsPhase4()') &&
    files.uiQuality.includes('bootAdminCollectionsPhase4()') &&
    files.uiQuality.includes("'../pages/collections/presentacion-colecciones.js'") &&
    files.uiQuality.includes("'../admin/collections/gestion-colecciones-admin.js'"),
  'debe ejecutarse incluso en páginas con HTML legado'
);

check(
  'La página de colecciones no duplica el listener de Firestore',
  !files.collectionsPage.includes("import('./js/pages/collections/estado-colecciones.js?v=tintin-20260716-cloudinary-fix-1')") &&
    !files.collectionsPageRuntime.includes("import('./estado-colecciones.js?v=tintin-20260716-cloudinary-fix-1')") &&
    files.collectionsPageRuntime.includes('tintin:collections-phase4-ready') &&
    files.collectionsPageRuntime.includes('phase4CollectionsOwner'),
  'collections.html debe consumir el renderer global, no abrir un segundo snapshot y competir por el mismo grid'
);

check(
  'Los destacados de colecciones tienen un límite de rendimiento',
  files.collectionsPageRuntime.includes('const FEATURED_LIMIT = 5') &&
    files.collectionsPage.includes('id="collections-featured-grid"') &&
    !files.collectionsPage.includes('id="colls-products-grid"') &&
    files.collectionsPageRuntime.includes('.slice(0, FEATURED_LIMIT)'),
  'la página no debe intentar montar el catálogo completo debajo de las colecciones ni superar cinco recomendaciones'
);

check(
  'Colecciones usa el carrito compartido y valida stock',
  files.collectionsPageRuntime.includes("import('../../components/cart/sincronizacion-carrito.js?v=tintin-20260716-cloudinary-fix-1") &&
    files.collectionsPageRuntime.includes('cartSync.addToCart') &&
    files.collectionsPageRuntime.includes('Number(product.stock) <= 0'),
  'los CTA destacados deben usar la misma sincronización y disponibilidad que el resto de la tienda'
);

check(
  'La experiencia responsive conserva navegación y carga accesibles',
  files.collectionsPage.includes('class="tt-collections-page"') &&
    files.collectionsPage.includes('aria-busy="true"') &&
    files.collectionsPage.includes('css/pages/collections/collections-page.css') &&
    files.collectionsPage.includes('js/pages/collections/pagina-colecciones.js') &&
    files.collectionsPageStyles.includes('@media (max-width: 768px)') &&
    files.collectionsPageStyles.includes('padding: 36px 0 44px'),
  'mobile no debe reservar el espacio del header oculto y los grids deben comunicar su estado'
);

check(
  'Los filtros del catálogo se adaptan a la altura de cada pantalla',
  files.catalogPage.includes('max-height: calc(100svh - var(--header-h) - 24px)') &&
    files.catalogPage.includes('max-height: calc(100dvh - var(--header-h) - 24px)') &&
    files.catalogPage.includes('.cat-sidebar.open { max-height: calc(100dvh - 128px); }') &&
    files.catalogPage.includes('overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain') &&
    files.catalogPage.includes('@media (min-width: 769px) and (max-height: 760px)') &&
    files.publicPhase4.includes("target.querySelector('.tt-filtro-btn.activo')") &&
    files.publicPhase4.includes("button.setAttribute('aria-pressed', String(selected))"),
  'el panel compartido por catálogo y colecciones filtradas debe caber en desktop, tablet y mobile sin quedar cortado'
);

check(
  'El comando de auditoría está publicado',
  files.packageJson.includes('"audit:collections"'),
  'package.json debe exponer npm run audit:collections'
);

if (failures) {
  console.error(`\nAuditoría Fase 4: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría Fase 4: todo correcto.');
