'use strict';

/* =============================================================
   TINTIN — Auditoría de la BASE del Super Admin (admin.html)

   Bloquea las invariantes estructurales de la fundación del panel para que
   no vuelvan a romperse en silencio:

   - Autenticación y protección inicial (nada privado se ve antes de resolver
     el auth; Super Admin siempre entra; roles/bloqueados/tienda cerrada tienen
     su salida segura; los permisos se validan de verdad, no solo se ocultan).
   - Navegación: correspondencia exacta entre cada botón (sidebar + tabs móvil)
     y su sección; ids únicos; deactivación en vivo para no dejar dos secciones
     activas a la vez; deep-link por URL/hash que pasa por los mismos permisos.
   - Accesibilidad: aria-current en la navegación, aria-label en los contenedores,
     modales con role=dialog/aria-modal, cierre con Escape y bloqueo de scroll.
   - Modales compartidos y responsive.

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

const adminHtml     = read('admin.html');
const adminApp      = read('js/admin-app.js');
const welcomeCtrl   = read('js/admin-welcome-control.js');
const unsavedGuard  = read('js/admin-unsaved-guard.js');
const adminCss      = read('css/admin.css');

// ---------------------------------------------------------------------------
// Inventario REAL (no supuesto): se extrae del propio HTML.
// ---------------------------------------------------------------------------
function sliceEntre(src, desde, hasta) {
  const a = src.indexOf(desde);
  const b = src.indexOf(hasta, a + 1);
  return a >= 0 && b >= 0 ? src.slice(a, b) : '';
}
const sidebarHtml = sliceEntre(adminHtml, 'id="adm-sidebar"', 'id="adm-mobile-tabs"');
const mobileHtml  = sliceEntre(adminHtml, 'id="adm-mobile-tabs"', '<!-- MAIN -->');

function dataSections(fragment) {
  return [...new Set([...fragment.matchAll(/data-section="([a-z-]+)"/g)].map(m => m[1]))];
}
const sidebarSections = dataSections(sidebarHtml);
const mobileSections  = dataSections(mobileHtml);
const sectionIds      = [...new Set([...adminHtml.matchAll(/id="section-([a-z-]+)"/g)].map(m => m[1]))];

// ===========================================================================
// 1. AUTENTICACIÓN
// ===========================================================================
check(
  'El guard usa onAuthStateChanged como puerta de entrada',
  /onAuthStateChanged\(auth,\s*async user/.test(adminApp),
  'admin-app.js debe resolver la sesión con onAuthStateChanged antes de mostrar el panel.'
);
check(
  'Sin sesión se redirige a login.html',
  /if \(!user\)\s*\{[^}]*login\.html/.test(adminApp),
  'Un usuario no autenticado debe terminar en login.html, nunca dentro del panel.'
);
check(
  'Un rol de cliente/sin rol se saca del panel a perfil.html',
  /role === 'client' \|\| !role/.test(adminApp) && adminApp.includes("window.location.href = 'perfil.html'"),
  'Solo roles de staff pueden ver el panel; el resto va a perfil.html.'
);
check(
  'Las cuentas bloqueadas se expulsan con aviso',
  adminApp.includes('login.html?blocked=1') && /\.blocked\b/.test(adminApp),
  'Una cuenta con blocked=true debe cerrar sesión e ir a login.html?blocked=1.'
);
check(
  'El Super Admin nunca queda bloqueado ni pierde acceso',
  /user\.email !== SUPER_ADMIN/.test(adminApp),
  'El chequeo de bloqueo debe exceptuar a SUPER_ADMIN para que conserve acceso total.'
);
check(
  'Un error inesperado en el init termina en el destino seguro (login)',
  /catch\s*\(e\)\s*\{[\s\S]{0,220}window\.location\.href = 'login\.html'/.test(adminApp),
  'Si el init falla, el panel real no debe quedar armado detrás del loader.'
);
check(
  'La tienda cerrada tapa el panel sin cerrar la sesión del Super Admin',
  /isAccessAllowed\(/.test(adminApp) && /renderStoreClosedOverlay\(\)/.test(adminApp),
  'Un rol sin excepción de tienda cerrada debe ver el overlay, no entrar al panel.'
);

// ===========================================================================
// 2. PROTECCIÓN INICIAL (nada privado visible antes del auth)
// ===========================================================================
check(
  'El chrome del panel arranca oculto por CSS hasta resolver el auth',
  /#adm-sidebar,\s*#adm-mobile-tabs,\s*\.adm-main\s*\{\s*visibility:\s*hidden/.test(adminHtml),
  'Sidebar, tabs y main deben estar en visibility:hidden hasta html.adm-auth-ready.'
);
check(
  'El panel se revela solo con html.adm-auth-ready',
  /html\.adm-auth-ready[\s\S]{0,140}visibility:\s*visible/.test(adminHtml),
  'La visibilidad del panel debe depender de la clase adm-auth-ready.'
);
check(
  'adm-auth-ready se agrega únicamente al final del camino exitoso',
  (adminApp.match(/classList\.add\('adm-auth-ready'\)/g) || []).length === 1,
  'adm-auth-ready no debe agregarse en ninguna rama que redirija o falle.'
);

// ===========================================================================
// 3. NAVEGACIÓN — correspondencia data-section ↔ section-*
// ===========================================================================
check(
  'Se detectaron secciones reales en el sidebar',
  sidebarSections.length >= 10,
  'No se pudo inventariar el sidebar (revisá los marcadores del HTML).'
);
const sinSeccion = sidebarSections.filter(s => !sectionIds.includes(s));
check(
  'Todo botón del sidebar tiene su panel section-* correspondiente',
  sinSeccion.length === 0,
  `Botones de sidebar sin section-*: ${sinSeccion.join(', ') || '—'}`
);
const sinBoton = sectionIds.filter(s => !sidebarSections.includes(s));
check(
  'Todo panel section-* tiene su botón en el sidebar',
  sinBoton.length === 0,
  `Secciones sin botón de sidebar: ${sinBoton.join(', ') || '—'}`
);
const desincronizados = [...new Set([...sidebarSections, ...mobileSections])]
  .filter(s => sidebarSections.includes(s) !== mobileSections.includes(s));
check(
  'El sidebar de escritorio y las tabs móviles ofrecen las mismas secciones',
  desincronizados.length === 0,
  `Secciones presentes en una sola navegación: ${desincronizados.join(', ') || '—'}`
);

// ===========================================================================
// 4. IDS ÚNICOS
// ===========================================================================
const allIds = [...adminHtml.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dupIds = allIds.filter((id, i) => allIds.indexOf(id) !== i);
check(
  'No hay ids duplicados en admin.html',
  dupIds.length === 0,
  `IDs duplicados: ${[...new Set(dupIds)].join(', ') || '—'}`
);

// ===========================================================================
// 5. SIN ESTADOS CONTRADICTORIOS (deactivación en vivo)
// ===========================================================================
// La deactivación de la navegación y de las secciones se hace con querySelectorAll
// en vivo (no las NodeList navItems/sections capturadas al cargar el módulo). Esas
// dos líneas solo existen dentro de switchSection.
check(
  'switchSection limpia la navegación con una consulta en vivo',
  adminApp.includes("document.querySelectorAll('.adm-nav-item, .adm-mobile-tab').forEach(b => {") &&
    !/\bnavItems\.forEach\(b => b\.classList\.remove\('active'\)\)/.test(adminApp),
  'Deactivar con NodeList estáticas deja resaltadas las secciones agregadas dinámicamente (welcome).'
);
check(
  'switchSection oculta las secciones con una consulta en vivo',
  adminApp.includes("document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'))") &&
    !/\bsections\.forEach\(s => s\.classList\.remove\('active'\)\)/.test(adminApp),
  'Ocultar solo la NodeList estática deja visible la sección dinámica debajo de la nueva.'
);
check(
  'La sección dinámica de bienvenida se agrega junto a su botón y tab',
  welcomeCtrl.includes("id = 'section-welcome'") &&
    welcomeCtrl.includes("id = 'nav-welcome'") &&
    welcomeCtrl.includes("id = 'mtab-welcome'"),
  'El módulo de bienvenida debe crear section/nav/tab en conjunto para no romper la correspondencia.'
);

// ===========================================================================
// 6. PERMISOS REALES (no solo ocultar botones)
// ===========================================================================
check(
  'switchSection valida el permiso antes de abrir una sección sensible',
  /const requiredPerm = SECTION_PERMISSION\[target\]/.test(adminApp) &&
    /if \(requiredPerm && !can\(currentRole, requiredPerm\)\)/.test(adminApp),
  'El acceso directo por hash/consola debe bloquearse aunque el botón esté oculto.'
);
check(
  'Roles y Permisos exige el email exacto del Super Admin',
  /target === 'permisos' && currentUser\?\.email !== SUPER_ADMIN/.test(adminApp),
  'La sección más sensible no puede abrirse solo por role===superadmin.'
);
check(
  'Cada data-section sensible declara su permiso en SECTION_PERMISSION',
  ['usuarios', 'configuracion', 'auditoria', 'correos', 'permisos'].every(s => new RegExp(`${s}:\\s*'`).test(adminApp)),
  'Falta declarar el permiso de alguna sección sensible en SECTION_PERMISSION.'
);

// ===========================================================================
// 7. DEEP-LINK POR URL / HASH
// ===========================================================================
check(
  'Existe deep-link por URL/hash que pasa por switchSection',
  /function applyInitialSectionFromUrl/.test(adminApp) &&
    /function sectionFromUrl/.test(adminApp) &&
    /addEventListener\('hashchange'/.test(adminApp),
  'Abrir una sección por URL/hash debe rutearse por switchSection (hereda permisos).'
);
check(
  'El deep-link solo acepta secciones que existen de verdad',
  /function isKnownSection[\s\S]{0,160}getElementById\(`section-\$\{name\}`\)/.test(adminApp),
  'Un valor inventado en el hash no debe generar un estado contradictorio.'
);

// ===========================================================================
// 8. ACCESIBILIDAD DE NAVEGACIÓN (aria-current / aria-label)
// ===========================================================================
check(
  'switchSection marca aria-current="page" en la sección activa',
  /setAttribute\('aria-current', 'page'\)/.test(adminApp) &&
    /removeAttribute\('aria-current'\)/.test(adminApp),
  'La navegación debe exponer aria-current para lectores de pantalla.'
);
check(
  'Los contenedores de navegación tienen aria-label',
  /id="adm-nav"[^>]*aria-label=/.test(adminHtml) &&
    /id="adm-mobile-tabs"[^>]*aria-label=/.test(adminHtml),
  'El sidebar y la tabbar móvil deben identificarse con aria-label.'
);
check(
  'El Dashboard inicial arranca con aria-current="page"',
  /class="adm-nav-item active" aria-current="page" data-section="dashboard"/.test(adminHtml),
  'La sección activa por defecto debe reflejar aria-current desde el primer render.'
);

// ===========================================================================
// 9. MODALES COMPARTIDOS
// ===========================================================================
const OVERLAYS = ['order-edit-overlay', 'tpl-edit-overlay', 'tpl-preview-overlay', 'promo-confirm-overlay'];
OVERLAYS.forEach(id => {
  const re = new RegExp(`id="${id}"[^>]*role="dialog"[^>]*aria-modal="true"`);
  check(
    `El modal ${id} declara role="dialog" y aria-modal`,
    re.test(adminHtml),
    `${id} debe ser un diálogo accesible (role=dialog aria-modal).`
  );
});
check(
  'El modal de cambios sin guardar existe y es accesible',
  /id="unsaved-modal"[^>]*role="dialog"[^>]*aria-modal="true"/.test(adminHtml),
  'El modal de cambios sin guardar debe conservar role=dialog aria-modal.'
);
check(
  'El guard de cambios sin guardar cierra con Escape y devuelve el foco',
  /event\.key === 'Escape'/.test(unsavedGuard) && /lastFocused\?\.focus/.test(unsavedGuard),
  'El modal de cambios sin guardar debe cerrarse con Escape y restaurar el foco.'
);
check(
  'Hay un manejo compartido de accesibilidad para los overlays operativos',
  /function setupAdminOverlayA11y/.test(adminApp) &&
    /event\.key === 'Escape'/.test(adminApp) &&
    /topOverlay\(\)/.test(adminApp),
  'Los overlays operativos deben cerrarse con Escape mediante el helper compartido.'
);
check(
  'El helper de overlays bloquea el scroll de fondo mientras hay uno abierto',
  /function syncScrollLock[\s\S]{0,120}body\.style\.overflow = anyOpen\(\) \? 'hidden' : ''/.test(adminApp),
  'Con un modal abierto el fondo no debe poder scrollear.'
);
check(
  'El helper de overlays devuelve el foco al cerrar',
  /function onOverlayHidden[\s\S]{0,400}opener\.focus/.test(adminApp),
  'Al cerrar un modal el foco debe volver a lo que estaba enfocado antes de abrir.'
);

// ===========================================================================
// 10. RESPONSIVE (breakpoints de la base)
// ===========================================================================
check(
  'admin.css define el rango tablet (sidebar compacta)',
  /@media \(max-width: 900px\)/.test(adminCss),
  'Falta el breakpoint de tablet para la sidebar compacta.'
);
check(
  'admin.css define el rango mobile',
  /@media \(max-width: 540px\)/.test(adminCss),
  'Falta el breakpoint mobile de la base del panel.'
);
check(
  'El overlay de sidebar y la tabbar móvil tienen estilos definidos',
  /\.adm-overlay\s*\{/.test(adminCss) && /\.adm-mobile-tabs\s*\{/.test(adminCss),
  'Los elementos estructurales de navegación deben conservar sus estilos base.'
);

// ---------------------------------------------------------------------------
console.log('Inventario de secciones (fuente: admin.html):');
console.log(`  Sidebar (${sidebarSections.length}): ${sidebarSections.join(', ')}`);
console.log(`  Tabs móvil (${mobileSections.length}): ${mobileSections.join(', ')}`);
console.log(`  Paneles section-* (${sectionIds.length}): ${sectionIds.join(', ')}`);
console.log('');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de base del Super Admin fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log('\nAuditoría de base del Super Admin completada correctamente.');
