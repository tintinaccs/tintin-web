const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  schema: read('js/content-schema.js'),
  publicRuntime: read('js/site-content.js'),
  admin: read('js/admin-content-phase6.js'),
  badges: read('js/edit-badge.js'),
  permissions: read('js/role-permissions.js'),
  quality: read('js/ui-quality.js'),
  rules: read('firestore.rules'),
  packageJson: read('package.json'),
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
  'Falta una página en content-schema.js'
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
  'site-content.js debe usar nodos de texto'
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
  'El editor de Contenido existe realmente',
  files.admin.includes("section.id = 'section-contenido'") &&
    files.admin.includes("document.querySelector('.adm-content')") &&
    files.admin.includes("[data-section=\"contenido\"]"),
  'El botón Contenido no puede abrir una sección inexistente'
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
  'Los cambios sin guardar están protegidos',
  files.admin.includes("window.addEventListener('beforeunload'") &&
    files.admin.includes('confirmDiscard()') &&
    files.admin.includes('Hay cambios sin guardar'),
  'Cambiar de página o cerrar no debe perder texto en silencio'
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
    files.quality.includes("'./admin-content-phase6.js'"),
  'ui-quality.js debe iniciar el editor en admin.html'
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

if (failures) {
  console.error(`\nAuditoría Fase 6: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría Fase 6: todo correcto.');
