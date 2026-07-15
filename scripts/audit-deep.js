const fs = require('fs');
const path = require('path');

const root = process.cwd();

const IGNORE_DIRS = new Set([
  '.git',
  '.github',
  'node_modules',
  'public',
  'dist',
  'build'
]);

const REQUIRED_FILES = [
  'index.html',
  'catalogo.html',
  'producto.html',
  'checkout.html',
  'login.html',
  'perfil.html',
  'admin.html',
  'firebase.json',
  '.firebaserc',
  'firestore.rules',
  'package.json',
  'js/page-loader.js',
  'js/firebase.js',
  'js/ui-quality.js',
  'js/theme-color-sanitizer.js',
  'css/tintin-unified-theme.css',
  'css/tintin-tokens.css',
  'assets-tintin/images/general/logo.png'
];

const LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO'
};

const issues = [];

function add(level, file, message, fix = '') {
  issues.push({ level, file, message, fix });
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n?/g, '\n');
}

function walk(dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

function stripQuery(value) {
  return String(value || '')
    .split('#')[0]
    .split('?')[0]
    .trim();
}

function isExternal(value) {
  return /^(https?:)?\/\//i.test(value)
    || /^mailto:/i.test(value)
    || /^tel:/i.test(value)
    || /^whatsapp:/i.test(value)
    || /^javascript:/i.test(value)
    || /^data:/i.test(value)
    || value.startsWith('#')
    || value === '';
}

function resolveLocal(fromFile, rawValue) {
  const clean = stripQuery(rawValue);
  if (!clean || isExternal(rawValue)) return null;

  if (clean.startsWith('/')) {
    return clean.replace(/^\/+/, '');
  }

  const base = path.dirname(fromFile);
  return path.normalize(path.join(base, clean)).replaceAll('\\', '/');
}

function getAttr(tag, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const match = tag.match(re);
  return match ? match[1] : null;
}

function checkRequiredFiles() {
  for (const file of REQUIRED_FILES) {
    if (!exists(file)) {
      add(
        LEVELS.ERROR,
        file,
        'Archivo obligatorio faltante.',
        'Crear o restaurar este archivo antes de publicar.'
      );
    }
  }
}

function checkPackageJson() {
  if (!exists('package.json')) return;

  let pkg;
  try {
    pkg = JSON.parse(read('package.json'));
  } catch {
    add(LEVELS.ERROR, 'package.json', 'package.json no es JSON válido.', 'Corregir formato JSON.');
    return;
  }

  const scripts = pkg.scripts || {};
  const expectedScripts = ['audit:tintin', 'fix:tintin', 'deploy:rules'];

  for (const script of expectedScripts) {
    if (!scripts[script]) {
      add(
        LEVELS.WARN,
        'package.json',
        `Falta el comando npm run ${script}.`,
        `Agregar scripts["${script}"] en package.json.`
      );
    }
  }
}

function checkFirebaseJson() {
  if (!exists('firebase.json')) return;

  let json;
  try {
    json = JSON.parse(read('firebase.json'));
  } catch {
    add(LEVELS.ERROR, 'firebase.json', 'firebase.json no es JSON válido.', 'Corregir formato JSON.');
    return;
  }

  if (!json.firestore || json.firestore.rules !== 'firestore.rules') {
    add(
      LEVELS.ERROR,
      'firebase.json',
      'Firestore no apunta correctamente a firestore.rules.',
      'Agregar "firestore": { "rules": "firestore.rules" }.'
    );
  }

  const usesGitHubPages = exists('.github/workflows/deploy-pages.yml');
  if (!json.hosting && !usesGitHubPages) {
    add(
      LEVELS.WARN,
      'firebase.json',
      'Firebase Hosting todavía no está configurado.',
      'Configurar hosting con public: "public".'
    );
  } else if (json.hosting && json.hosting.public !== 'public') {
    add(
      LEVELS.WARN,
      'firebase.json',
      'Firebase Hosting no usa la carpeta public.',
      'Usar "hosting": { "public": "public" }.'
    );
  }
}

function checkGitignore() {
  if (!exists('.gitignore')) {
    add(LEVELS.WARN, '.gitignore', 'Falta .gitignore.', 'Crear .gitignore e ignorar public/ y node_modules/.');
    return;
  }

  const text = read('.gitignore');

  if (!/(^|\n)public\/(\n|$)/.test(text)) {
    add(
      LEVELS.WARN,
      '.gitignore',
      'public/ no está ignorado.',
      'Agregar public/ para no subir archivos generados de Firebase Hosting.'
    );
  }

  if (!/(^|\n)node_modules\/(\n|$)/.test(text)) {
    add(
      LEVELS.INFO,
      '.gitignore',
      'node_modules/ no está ignorado explícitamente.',
      'Agregar node_modules/ si todavía no está.'
    );
  }
}

function checkFirestoreRules() {
  if (!exists('firestore.rules')) return;

  const text = read('firestore.rules');

  if (!/service\s+cloud\.firestore/.test(text)) {
    add(LEVELS.ERROR, 'firestore.rules', 'No parece ser un archivo válido de reglas Firestore.', 'Revisar firestore.rules.');
  }

  if (!/tintinaccs@gmail\.com/.test(text)) {
    add(
      LEVELS.WARN,
      'firestore.rules',
      'No se detectó el correo Super Admin fijo.',
      'Confirmar que el Super Admin no dependa solo de un rol editable.'
    );
  }

  if (!/allow\s+read|allow\s+write/.test(text)) {
    add(
      LEVELS.ERROR,
      'firestore.rules',
      'No se detectaron reglas allow.',
      'Revisar permisos de lectura/escritura.'
    );
  }
}

function checkHtml(file) {
  const html = read(file);
  // Los template literals de los módulos embebidos no son HTML estático.
  // Quitarlos evita interpretar `${url}` o `${user.photoURL}` como enlaces e
  // imágenes rotas que supuestamente existirían en disco.
  const staticHtml = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

  if (!/<html[^>]+lang=["']/.test(html)) {
    add(LEVELS.INFO, file, 'El HTML no tiene atributo lang.', 'Agregar lang="es-PY" o lang="es".');
  }

  if (!/<meta\s+name=["']viewport["']/i.test(html)) {
    add(LEVELS.ERROR, file, 'Falta meta viewport.', 'Agregar meta viewport para mobile.');
  }

  if (!/<title>[^<]+<\/title>/i.test(html)) {
    add(LEVELS.WARN, file, 'Falta título de página.', 'Agregar un <title> claro para SEO.');
  }

  if (!/<meta\s+name=["']description["']/i.test(html)) {
    add(LEVELS.INFO, file, 'Falta meta description.', 'Agregar descripción breve para Google.');
  }

  if (!/js\/page-loader\.js/.test(html)) {
    add(
      LEVELS.WARN,
      file,
      'HTML sin page-loader.js.',
      'Agregar page-loader.js para cargar tema, header y fixes globales.'
    );
  }

  if (/logo-splash|logo-tintin|tt-splash-line|tt-intro-fallback/i.test(html)) {
    add(
      LEVELS.WARN,
      file,
      'Contiene restos del logo/splash viejo.',
      'Reemplazar por assets-tintin/images/general/logo.png o eliminar restos.'
    );
  }

  const idMatches = [...staticHtml.matchAll(/\sid=["']([^"']+)["']/gi)].map(m => m[1]);
  const repeated = [...new Set(idMatches.filter((id, idx) => idMatches.indexOf(id) !== idx))];

  for (const id of repeated) {
    add(
      LEVELS.WARN,
      file,
      `ID repetido detectado: #${id}.`,
      'Los IDs deben ser únicos por página.'
    );
  }

  const attrRegex = /\s(?:src|href)=["']([^"']+)["']/gi;
  for (const match of staticHtml.matchAll(attrRegex)) {
    const raw = match[1];
    const resolved = resolveLocal(file, raw);
    if (!resolved) continue;

    if (raw.includes('{{') || raw.includes('}}')) continue;

    if (!exists(resolved)) {
      add(
        LEVELS.ERROR,
        file,
        `Archivo enlazado no existe: ${raw}.`,
        `Crear archivo o corregir ruta: ${resolved}.`
      );
    }
  }

  const imgRegex = /<img\b[^>]*>/gi;
  for (const match of staticHtml.matchAll(imgRegex)) {
    const tag = match[0];
    const src = getAttr(tag, 'src') || '';
    const alt = getAttr(tag, 'alt');

    if (!src) {
      add(LEVELS.ERROR, file, 'Imagen sin src.', 'Agregar src válido o eliminar imagen.');
    }

    if (alt === null) {
      add(LEVELS.INFO, file, `Imagen sin alt: ${src || '(sin src)'}.`, 'Agregar alt descriptivo.');
    }
  }

  const linkRegex = /<a\b[^>]*>/gi;
  for (const match of staticHtml.matchAll(linkRegex)) {
    const tag = match[0];
    const href = getAttr(tag, 'href');

    if (href === null) {
      add(LEVELS.WARN, file, 'Link <a> sin href.', 'Agregar href o convertirlo en button.');
    } else if (href === '#' || href.trim() === '') {
      add(LEVELS.WARN, file, 'Link con href vacío o #.', 'Agregar destino real o acción JS clara.');
    }
  }

  const buttonRegex = /<button\b[^>]*>/gi;
  for (const match of staticHtml.matchAll(buttonRegex)) {
    const tag = match[0];
    const type = getAttr(tag, 'type');
    const hasAction =
      /onclick=|data-|id=|class=|aria-controls=|form=/i.test(tag);

    if (!type) {
      add(LEVELS.INFO, file, 'Botón sin type.', 'Usar type="button" o type="submit" según corresponda.');
    }

    if (!hasAction) {
      add(LEVELS.WARN, file, 'Botón sin acción identificable.', 'Agregar id, data-action, onclick o listener por JS.');
    }
  }

  const formRegex = /<form\b[^>]*>/gi;
  for (const match of staticHtml.matchAll(formRegex)) {
    const tag = match[0];
    const action = getAttr(tag, 'action');
    const hasId = getAttr(tag, 'id');
    const hasData = /data-|class=/i.test(tag);

    if (!action && !hasId && !hasData) {
      add(
        LEVELS.WARN,
        file,
        'Formulario sin action/id/data/class.',
        'Agregar identificador para poder manejarlo por JS.'
      );
    }
  }

  const inputRegex = /<input\b[^>]*>/gi;
  for (const match of staticHtml.matchAll(inputRegex)) {
    const tag = match[0];
    const type = getAttr(tag, 'type') || 'text';
    const name = getAttr(tag, 'name');
    const id = getAttr(tag, 'id');
    const placeholder = getAttr(tag, 'placeholder');
    const aria = getAttr(tag, 'aria-label');

    if (!['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(type) && !name && !id) {
      add(LEVELS.WARN, file, 'Input sin name ni id.', 'Agregar name o id para poder procesarlo.');
    }

    if (!['hidden', 'submit', 'button'].includes(type) && !placeholder && !aria && !id) {
      add(
        LEVELS.INFO,
        file,
        'Input sin ayuda visible detectada.',
        'Agregar label, placeholder o aria-label.'
      );
    }
  }
}

function checkCss(file) {
  const css = read(file);

  if (/logo-splash|logo-tintin/i.test(css)) {
    add(
      LEVELS.WARN,
      file,
      'CSS contiene referencia a logo viejo.',
      'Usar logo.png o eliminar referencia vieja.'
    );
  }

  if (/!important/g.test(css)) {
    const count = (css.match(/!important/g) || []).length;
    if (count > 30) {
      add(
        LEVELS.INFO,
        file,
        `Uso alto de !important: ${count}.`,
        'Revisar si se puede reemplazar por selectores más ordenados.'
      );
    }
  }

  const hardHexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  if (hardHexes.length > 0 && !/tintin-unified-theme|tintin-tokens|tintin-palette/.test(file)) {
    add(
      LEVELS.INFO,
      file,
      `Contiene ${hardHexes.length} colores hex directos.`,
      'Idealmente pasar colores a variables del tema.'
    );
  }
}

function checkJs(file) {
  const js = read(file);

  if (/logo-splash|logo-tintin/i.test(js)) {
    add(
      LEVELS.WARN,
      file,
      'JS contiene referencia a logo viejo.',
      'Confirmar si solo lo elimina/limpia; si no, reemplazar por logo.png.'
    );
  }

  if (file !== 'scripts/audit-deep.js' && /debugger\s*;/.test(js)) {
    add(LEVELS.ERROR, file, 'Contiene debugger;.', 'Eliminar debugger antes de publicar.');
  }

  if (/console\.log\(/.test(js) && !/scripts\//.test(file)) {
    add(
      LEVELS.INFO,
      file,
      'Contiene console.log.',
      'Eliminar logs innecesarios antes del lanzamiento final.'
    );
  }

  if (/TODO|FIXME|HACK/i.test(js)) {
    add(
      LEVELS.INFO,
      file,
      'Contiene TODO/FIXME/HACK.',
      'Revisar comentarios pendientes antes de publicar.'
    );
  }

  if (/initializeApp\s*\(/g.test(js)) {
    const count = (js.match(/initializeApp\s*\(/g) || []).length;
    if (count > 1) {
      add(
        LEVELS.WARN,
        file,
        'Posible inicialización duplicada de Firebase.',
        'Firebase debe inicializarse una sola vez o con validación getApps().'
      );
    }
  }
}

function checkAssets(files) {
  const images = files.filter(f => /\.(png|jpe?g|webp|svg|ico)$/i.test(f));

  for (const img of images) {
    const stat = fs.statSync(path.join(root, img));

    if (stat.size === 0) {
      add(LEVELS.ERROR, img, 'Imagen vacía o corrupta de 0 bytes.', 'Reemplazar archivo.');
    }

    if (stat.size > 2 * 1024 * 1024) {
      add(
        LEVELS.INFO,
        img,
        'Imagen pesa más de 2MB.',
        'Optimizar imagen para mejorar carga mobile.'
      );
    }
  }
}

function checkImportantPages(files) {
  const htmlFiles = files.filter(f => f.endsWith('.html'));

  const expected = [
    'index.html',
    'catalogo.html',
    'producto.html',
    'checkout.html',
    'login.html',
    'perfil.html',
    'admin.html'
  ];

  for (const file of expected) {
    if (!htmlFiles.includes(file)) {
      add(
        LEVELS.ERROR,
        file,
        'Página principal faltante.',
        'Crear/restaurar esta página.'
      );
    }
  }
}

function main() {
  const files = walk();

  checkRequiredFiles();
  checkPackageJson();
  checkFirebaseJson();
  checkGitignore();
  checkFirestoreRules();
  checkImportantPages(files);

  for (const file of files) {
    if (file.endsWith('.html')) checkHtml(file);
    if (file.endsWith('.css')) checkCss(file);
    if (file.endsWith('.js')) checkJs(file);
  }

  checkAssets(files);

  const counts = {
    ERROR: issues.filter(i => i.level === LEVELS.ERROR).length,
    WARN: issues.filter(i => i.level === LEVELS.WARN).length,
    INFO: issues.filter(i => i.level === LEVELS.INFO).length
  };

  console.log('');
  console.log('Tintin deep audit');
  console.log('=================');
  console.log(`Files scanned: ${files.length}`);
  console.log(`ERROR: ${counts.ERROR}`);
  console.log(`WARN: ${counts.WARN}`);
  console.log(`INFO: ${counts.INFO}`);
  console.log('');

  for (const issue of issues) {
    console.log(`[${issue.level}] ${issue.file} — ${issue.message}`);
    if (issue.fix) {
      console.log(`      Fix: ${issue.fix}`);
    }
  }

  console.log('');

  if (counts.ERROR > 0) {
    process.exit(1);
  }
}

main();
