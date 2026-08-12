import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const must = (condition, message) => { if (!condition) throw new Error(message); };

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

function removeDivById(source, id) {
  const startRe = new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const startMatch = startRe.exec(source);
  if (!startMatch) return source;
  const start = startMatch.index;
  const tagRe = /<div\b[^>]*>|<\/div\s*>/gi;
  tagRe.lastIndex = start;
  let depth = 0;
  let end = -1;
  let match;
  while ((match = tagRe.exec(source))) {
    if (/^<div\b/i.test(match[0])) depth += 1;
    else depth -= 1;
    if (depth === 0) {
      end = tagRe.lastIndex;
      break;
    }
  }
  must(end > start, `No se pudo cerrar #${id}`);
  return source.slice(0, start) + source.slice(end);
}

function replaceOnce(source, before, after, label) {
  must(source.includes(before), `No se encontró: ${label}`);
  return source.replace(before, after);
}

// ---------------------------------------------------------------------------
// 1) admin.html: una sola superficie superior: Apariencia y contenido.
// ---------------------------------------------------------------------------
let html = read('admin.html');
const oldContentNavCount = count(html, /<button\b[^>]*data-section="contenido"[^>]*>/g);
must(oldContentNavCount >= 2, 'Se esperaban las entradas desktop/mobile de Contenido.');
html = html.replace(/\s*<button\b(?=[^>]*data-section="contenido")[\s\S]*?<\/button>/g, '');
html = removeDivById(html, 'section-contenido');
html = html.replace(/\s*<!--\s*=+\s*CONTENIDO\s*=+\s*-->/gi, '');

html = html.replace(/(<button\b[^>]*data-section="apariencia"[^>]*>[\s\S]*?<\/svg><\/span>)\s*Apariencia(<\/button>)/g, '$1 Apariencia y contenido$2');
html = html.replace(/(<button\b[^>]*data-section="apariencia"[^>]*>[\s\S]*?<\/svg><\/span>)Apariencia(<\/button>)/g, '$1Apariencia y contenido$2');

html = replaceOnce(
  html,
  '<h2 class="apar-intro-title">Apariencia</h2>',
  '<h2 class="apar-intro-title">Apariencia y contenido</h2>',
  'título de Apariencia'
);
html = replaceOnce(
  html,
  '<p class="apar-intro-text">Elegí qué querés cambiar: el <strong>contenido</strong> de las páginas (banners, textos, productos) o los <strong>colores</strong> de toda la tienda. Cada uno se guarda y se publica por separado.</p>',
  '<p class="apar-intro-text">Un solo espacio para mantener la tienda: editá textos, secciones y composición visual sin duplicar módulos. Los colores y controles globales sensibles siguen protegidos por sus permisos propios.</p>',
  'intro de Apariencia'
);
html = html.replace('data-apar-main-tab="diseno">🧩 Contenido de las páginas</button>', 'data-apar-main-tab="diseno">🧩 Contenido y diseño</button>');
html = html.replace('data-apar-main-tab="colores">🎨 Colores de la tienda</button>', 'data-apar-main-tab="colores" data-appearance-sensitive="true">🎨 Colores de la tienda</button>');
html = html.replace('<div class="correos-panel" id="apar-panel-colores">', '<div class="correos-panel" id="apar-panel-colores" data-appearance-sensitive="true">');
html = html.replace('<p class="apar-panel-help">Agregá, editá u ordená banners, textos, productos destacados y otros bloques de cada página.', '<p class="apar-panel-help" data-appearance-sensitive="true">Agregá, editá u ordená banners, textos, productos destacados y otros bloques de cada página.');
html = html.replace('<section class="visual-editor" id="visual-editor"', '<section class="visual-editor" id="visual-editor" data-appearance-sensitive="true"');

const appearancePanelAnchor = '<div class="correos-panel active" id="apar-panel-diseno">';
must(html.includes(appearancePanelAnchor), 'No se encontró el panel principal de Apariencia.');
html = html.replace(
  appearancePanelAnchor,
  `${appearancePanelAnchor}\n        <div class="apar-unified-content-intro">\n          <div>\n            <strong>Contenido del sitio</strong>\n            <span>Editá textos y secciones desde la misma pantalla. Se conserva una sola suscripción por página y una sola fuente publicada: <code>site_content</code>.</span>\n          </div>\n        </div>\n        <div id="appearance-content-phase6-host" class="apar-unified-content-host" aria-label="Editor de contenido del sitio"></div>`
);

must(!/data-section="contenido"/.test(html), 'Quedó una navegación superior de Contenido.');
must(!/id="section-contenido"/.test(html), 'Quedó el panel superior section-contenido.');
must(/id="section-apariencia"/.test(html) && /id="appearance-content-phase6-host"/.test(html), 'La superficie unificada no quedó armada.');
write('admin.html', html);

// ---------------------------------------------------------------------------
// 2) Editor seguro Fase 6: se monta DENTRO de Apariencia, sin crear otra sección.
// ---------------------------------------------------------------------------
let content = read('js/admin/content/gestion-contenido-admin.js');
content = content.replace(
`  function activateContentSection() {\n    if (!ui?.section) return;\n    document.querySelectorAll('.adm-section').forEach(section => section.classList.remove('active'));\n    ui.section.classList.add('active');\n    document.querySelectorAll('[data-section]').forEach(button => {\n      button.classList.toggle('active', button.dataset.section === 'contenido');\n    });\n    const topbar = document.getElementById('adm-topbar-title');\n    if (topbar) topbar.textContent = 'Contenido';\n  }`,
`  function activateContentSection() {\n    const appearanceSection = document.getElementById('section-apariencia');\n    if (!appearanceSection?.classList.contains('active')) {\n      document.querySelector('[data-section="apariencia"]')?.click();\n    }\n    document.querySelector('[data-apar-main-tab="diseno"]')?.click();\n    window.requestAnimationFrame(() => {\n      ui?.section?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });\n    });\n  }`
);

content = replaceOnce(
  content,
  `  function buildUI() {\n    if (document.getElementById('section-contenido')) return;\n    const host = document.querySelector('.adm-content');\n    if (!host) return;\n\n    const section = create('div', 'adm-section content-phase6-section');\n    section.id = 'section-contenido';`,
  `  function buildUI() {\n    if (document.getElementById('appearance-content-phase6')) return;\n    const host = document.getElementById('appearance-content-phase6-host');\n    if (!host) return;\n\n    const section = create('div', 'content-phase6-section');\n    section.id = 'appearance-content-phase6';`,
  'montaje del editor de contenido'
);
content = content.replace(
`    document.querySelectorAll('[data-section="contenido"]').forEach(button => {\n      button.addEventListener('click', activateContentSection);\n    });\n`,
''
);
content = replaceOnce(
  content,
  `    const navs = document.querySelectorAll('[data-section="contenido"]');\n    navs.forEach(nav => { nav.style.display = permissions.view ? '' : 'none'; });\n    if (!permissions.view) return;`,
  `    const unifiedHost = document.getElementById('appearance-content-phase6-host');\n    if (unifiedHost) unifiedHost.hidden = !permissions.view;\n    if (!permissions.view) return;`,
  'visibilidad por permisos del editor'
);
content = content.replace(
  `.content-phase6-head{align-items:flex-start;gap:16px}`,
  `.apar-unified-content-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:16px 18px;margin:14px 0;background:linear-gradient(135deg,#fff,#fff7fa);border:1px solid var(--adm-border);border-radius:14px}.apar-unified-content-intro strong{display:block;font-size:14px;color:var(--adm-text);margin-bottom:4px}.apar-unified-content-intro span{display:block;font-size:12px;line-height:1.55;color:var(--adm-muted)}.apar-unified-content-host{margin:0 0 24px}.apar-unified-content-host:empty{display:none}.content-phase6-section{margin:0}.content-phase6-head{align-items:flex-start;gap:16px}`
);
must(!content.includes("section.id = 'section-contenido'"), 'El editor Fase 6 todavía crea section-contenido.');
must(content.includes("document.getElementById('appearance-content-phase6-host')"), 'El editor Fase 6 no usa el host unificado.');
write('js/admin/content/gestion-contenido-admin.js', content);

// ---------------------------------------------------------------------------
// 3) admin-app: retirar el editor legado duplicado y unificar routing/permisos.
// ---------------------------------------------------------------------------
let app = read('js/admin/admin-app.js');
app = app.replace("  contenido: 'Contenido del Sitio',\n", '');
app = app.replace("  apariencia: 'Apariencia y esquemas de colores',", "  apariencia: 'Apariencia y contenido',");
app = app.replace("  if (target === 'contenido') loadContenido();\n", '');

const legacyStart = app.indexOf('// ======== CONTENIDO DEL SITIO ========');
const legacyEnd = app.indexOf('// ======== IMPORT / EXPORT ========', legacyStart);
must(legacyStart >= 0 && legacyEnd > legacyStart, 'No se pudo ubicar el editor legado de Contenido en admin-app.js.');
app = app.slice(0, legacyStart) + app.slice(legacyEnd);

app = replaceOnce(
  app,
`let admSuppressHashSync = false;\n\nfunction switchSection(target) {\n  const requiredPerm = SECTION_PERMISSION[target];\n  if (requiredPerm && !can(currentRole, requiredPerm)) {`,
`let admSuppressHashSync = false;\n\nfunction canAccessUnifiedAppearance(role = currentRole) {\n  return can(role, 'manageSettings') || role === 'superadmin' || canDo(role, 'contenido', 'ver');\n}\n\nfunction switchSection(target) {\n  if (target === 'contenido') target = 'apariencia';\n  const requiredPerm = SECTION_PERMISSION[target];\n  const allowedByPermission = target === 'apariencia'\n    ? canAccessUnifiedAppearance()\n    : (!requiredPerm || can(currentRole, requiredPerm));\n  if (requiredPerm && !allowedByPermission) {`,
  'routing protegido de Apariencia'
);

app = replaceOnce(
  app,
`  Object.entries(SECTION_PERMISSION).forEach(([section, perm]) => {\n    if (!can(role, perm)) {\n      document.querySelectorAll(\`[data-section="\${section}"]\`).forEach(el => {\n        el.style.display = 'none';\n      });\n    }\n  });`,
`  Object.entries(SECTION_PERMISSION).forEach(([section, perm]) => {\n    const allowed = section === 'apariencia'\n      ? canAccessUnifiedAppearance(role)\n      : can(role, perm);\n    document.querySelectorAll(\`[data-section="\${section}"]\`).forEach(el => {\n      el.style.display = allowed ? '' : 'none';\n    });\n  });\n\n  const canManageAppearance = can(role, 'manageSettings');\n  document.querySelectorAll('[data-appearance-sensitive="true"]').forEach(el => {\n    el.hidden = !canManageAppearance;\n  });`,
  'visibilidad unificada de permisos'
);

app = replaceOnce(
  app,
`function sectionFromUrl() {\n  const params = new URLSearchParams(location.search);\n  const fromQuery = params.get('section');\n  if (isKnownSection(fromQuery)) return fromQuery;\n  const fromHash = (location.hash || '').replace(/^#/, '');\n  if (isKnownSection(fromHash)) return fromHash;\n  return null;\n}\nfunction applyInitialSectionFromUrl() {\n  // El deep-link de Contenido (?tab=contenido&page=…&section=…) tiene su propio\n  // manejador (handleContentDeepLink) — no se pisa acá.\n  if (new URLSearchParams(location.search).get('tab') === 'contenido') return;`,
`function sectionFromUrl() {\n  const params = new URLSearchParams(location.search);\n  const fromQuery = params.get('section');\n  if (fromQuery === 'contenido') return 'apariencia';\n  if (isKnownSection(fromQuery)) return fromQuery;\n  const fromHash = (location.hash || '').replace(/^#/, '');\n  if (fromHash === 'contenido') return 'apariencia';\n  if (isKnownSection(fromHash)) return fromHash;\n  return null;\n}\nfunction applyInitialSectionFromUrl() {\n  // Compatibilidad: los enlaces viejos del editor de Contenido abren ahora la\n  // única superficie Apariencia y contenido. El módulo Fase 6 conserva page/section.\n  if (new URLSearchParams(location.search).get('tab') === 'contenido') {\n    switchSection('apariencia');\n    return;\n  }`,
  'compatibilidad de deep links'
);

must(!app.includes('// ======== CONTENIDO DEL SITIO ========'), 'Quedó el editor legado duplicado.');
must(!app.includes("if (target === 'contenido') loadContenido();"), 'Quedó el loader legado de contenido.');
must(app.includes('function canAccessUnifiedAppearance'), 'No quedó el control unificado de permisos.');
write('js/admin/admin-app.js', app);

// ---------------------------------------------------------------------------
// 4) Auditorías: el nuevo contrato evita que la redundancia vuelva a aparecer.
// ---------------------------------------------------------------------------
let phase6 = read('scripts/auditar-contenido-fase-6.js');
phase6 = phase6.replace("  packageJson: read('package.json'),", "  packageJson: read('package.json'),\n  panel: read('admin.html'),\n  adminApp: read('js/admin/admin-app.js'),");
phase6 = replaceOnce(
  phase6,
`check(\n  'El editor de Contenido existe realmente',\n  files.admin.includes("section.id = 'section-contenido'") &&\n    files.admin.includes("document.querySelector('.adm-content')") &&\n    files.admin.includes("[data-section=\\\"contenido\\\"]"),\n  'El botón Contenido no puede abrir una sección inexistente'\n);`,
`check(\n  'Contenido está integrado en Apariencia sin crear un módulo superior duplicado',\n  files.admin.includes("section.id = 'appearance-content-phase6'") &&\n    files.admin.includes("document.getElementById('appearance-content-phase6-host')") &&\n    files.panel.includes('id="section-apariencia"') &&\n    files.panel.includes('id="appearance-content-phase6-host"') &&\n    !files.panel.includes('id="section-contenido"') &&\n    !files.panel.includes('data-section="contenido"') &&\n    !files.adminApp.includes('// ======== CONTENIDO DEL SITIO ========'),\n  'Debe existir una sola superficie Apariencia y contenido, sin el editor legado duplicado.'\n);`,
  'auditoría Fase 6 del editor unificado'
);
write('scripts/auditar-contenido-fase-6.js', phase6);

const unifiedAudit = `'use strict';\nconst fs = require('fs');\nconst read = file => fs.readFileSync(file, 'utf8');\nconst html = read('admin.html');\nconst app = read('js/admin/admin-app.js');\nconst content = read('js/admin/content/gestion-contenido-admin.js');\nconst firebase = read('js/core/firebase/firebase.js');\nconst checks = [];\nconst check = (name, ok) => checks.push({ name, ok: Boolean(ok) });\nconst navContent = (html.match(/data-section="contenido"/g) || []).length;\nconst navAppearance = (html.match(/data-section="apariencia"/g) || []).length;\ncheck('No existe módulo superior Contenido duplicado', navContent === 0 && !html.includes('id="section-contenido"'));\ncheck('Apariencia sigue presente en desktop y mobile', navAppearance >= 2 && html.includes('id="section-apariencia"'));\ncheck('El editor seguro vive dentro de Apariencia', html.includes('id="appearance-content-phase6-host"') && content.includes("section.id = 'appearance-content-phase6'"));\ncheck('No queda el editor legado de Contenido en admin-app', !app.includes('// ======== CONTENIDO DEL SITIO ========') && !app.includes('loadContenido()'));\ncheck('Los enlaces viejos Contenido se redirigen a Apariencia', app.includes("if (target === 'contenido') target = 'apariencia'") && app.includes("fromHash === 'contenido'"));\ncheck('Permisos de contenido permiten entrar sin abrir colores sensibles', app.includes('canAccessUnifiedAppearance') && html.includes('data-appearance-sensitive="true"'));\ncheck('Contenido conserva una sola suscripción por página', (content.match(/onSnapshot\\(/g) || []).length === 1 && content.includes('pageUnsubscribe?.()'));\ncheck('Contenido conserva site_content como única fuente', content.includes("doc(db, 'site_content', pageId)") && content.includes("doc(db, 'site_content', currentPageId)"));\ncheck('Firebase sigue centralizado', firebase.includes('initializeApp') && !content.includes('initializeApp(') && !app.includes('initializeApp('));\nconst failed = checks.filter(item => !item.ok);\nfor (const item of checks) console.log(\`${'${item.ok ? \'OK\' : \'ERROR\'}'} — ${'${item.name}'}\`);\nif (failed.length) { console.error(\`\\nApariencia unificada: ${'${failed.length}'} fallo(s).\`); process.exit(1); }\nconsole.log(\`\\nApariencia unificada: ${'${checks.length}'} comprobaciones correctas.\`);\n`;
write('scripts/auditar-admin-apariencia-unificada.js', unifiedAudit);

let pkg = JSON.parse(read('package.json'));
pkg.scripts['audit:appearance-unified'] = 'node scripts/auditar-admin-apariencia-unificada.js';
if (!pkg.scripts['audit:final'].includes('audit:appearance-unified')) {
  pkg.scripts['audit:final'] = pkg.scripts['audit:final'].replace('npm run audit:content-appearance', 'npm run audit:content-appearance && npm run audit:appearance-unified');
}
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log('Unificación de Apariencia + Contenido aplicada.');
