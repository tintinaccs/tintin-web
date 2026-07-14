const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  nav: read('js/nav-collections.js'),
  publicPhase4: read('js/collections-phase4.js'),
  adminPhase4: read('js/admin-collections-phase4.js'),
  uiQuality: read('js/ui-quality.js'),
  store: read('js/collections-store.js'),
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
  'El menú elimina HTML estático antes de cargar',
  files.nav.includes('container.replaceChildren') &&
    files.nav.includes("dataset.phase4CollectionsState = 'loading'"),
  'no deben quedar categorías antiguas durante una falla'
);

check(
  'El menú falla de forma explícita',
  files.nav.includes("createStateNode('No pudimos cargar las colecciones.', 'error')") &&
    files.nav.includes("retry.addEventListener('click'"),
  'una falla no puede dejar la lista fija del HTML'
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
  files.uiQuality.includes("bootCollectionsPhase4()") &&
    files.uiQuality.includes("bootAdminCollectionsPhase4()") &&
    files.uiQuality.includes("'./collections-phase4.js'") &&
    files.uiQuality.includes("'./admin-collections-phase4.js'"),
  'debe ejecutarse incluso en páginas con HTML legado'
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
