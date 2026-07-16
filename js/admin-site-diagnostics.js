import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { SUPER_ADMIN } from './roles.js?v=tintin-20260716-cloudinary-fix-1';
import {
  collection,
  getDocs,
  limit,
  query
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  buildStaticAnalysis,
  compareReports,
  createCoverageItem,
  createFinding,
  dedupeFindings,
  DIAGNOSTIC_SCHEMA_VERSION,
  modeIncludes,
  stableHash,
  summarizeReport
} from './diagnostic-core.js?v=tintin-20260716-cloudinary-fix-1';

const MANIFEST_URL = './diagnostic-manifest.json';
const HISTORY_DB = 'tintin-diagnostics-readonly';
const HISTORY_STORE = 'runs';
const MODULE_TARGETS = [
  ['admin', 'Super Admin y gestión interna'],
  ['commerce', 'Catálogo, colecciones, producto y checkout'],
  ['account', 'Acceso, perfil y sesión'],
  ['content', 'Páginas públicas y contenido']
];
const MODE_LABELS = {
  full: 'Diagnóstico completo',
  page: 'Diagnóstico por página',
  module: 'Diagnóstico por módulo',
  visual: 'Diagnóstico visual',
  functional: 'Diagnóstico funcional',
  technical: 'Diagnóstico técnico',
  data: 'Diagnóstico de datos',
  role: 'Diagnóstico por rol'
};
const CONFIRMATION_LABELS = {
  confirmed: 'Error confirmado',
  manual: 'Requiere verificación manual',
  'not-reviewed': 'No revisado',
  'not-available': 'Prueba no disponible',
  'no-longer-detected': 'Ya no detectado',
  'not-reverified': 'No se pudo volver a verificar',
  intentional: 'Comportamiento intencional',
  'false-positive': 'Falso positivo descartado'
};
const SEVERITY_LABELS = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
  minimal: 'Mínimo'
};

let initialized = false;
let running = false;
let manifest = null;
let lastReport = null;
let historyCache = [];
let activeView = 'active';
let preparationPromise = null;
const pageHtmlCache = new Map();

// Escucha los avisos que firestore-shim.js/auth-shim.js/storage-shim.js y
// network-guard.js mandan por postMessage cada vez que el iframe aislado
// intenta una escritura real y la bloquean. No son hallazgos (bloquear la
// escritura es el comportamiento correcto): son evidencia de que la página
// intentó escribir durante la carga y de que el bloqueo funcionó de verdad.
const blockedWriteEvents = [];
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== 'tt-diagnostic-shim') return;
  blockedWriteEvents.push({
    blockedCall: event.data.blockedCall,
    detail: event.data.detail,
    at: event.data.at
  });
});

function collectBlockedWritesSince(fromLength) {
  return blockedWriteEvents.splice(fromLength);
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatDate(value) {
  if (!value) return 'No determinado';
  try {
    return new Intl.DateTimeFormat('es-PY', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(new Date(value));
  } catch (_) {
    return String(value);
  }
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return 'No determinado';
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

function setStatus(message) {
  const node = $('site-diagnostic-status');
  if (node) node.textContent = message;
}

function setProgress(current, total, label) {
  const progress = $('site-diagnostic-progress');
  const bar = $('site-diagnostic-progress-bar');
  if (!progress || !bar) return;
  progress.hidden = false;
  const percent = total ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
  bar.style.width = `${percent}%`;
  setStatus(`${label} · ${current} de ${total} (${percent}%)`);
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function loadManifest() {
  const response = await fetch(`${MANIFEST_URL}?diagnostic=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin'
  });
  if (!response.ok) throw new Error(`El inventario respondió HTTP ${response.status}`);
  const value = await response.json();
  if (value.schemaVersion !== 2 || !Array.isArray(value.pages) || !Array.isArray(value.files)) {
    throw new Error('El inventario publicado no tiene el formato esperado');
  }
  if (value.safety?.mode !== 'read-only' || value.safety?.runtimeScriptsExecuted !== false) {
    throw new Error('El inventario no confirma el modo seguro de solo lectura');
  }
  manifest = value;
  populateSelectors();
  setStatus(
    `Inventario cargado: ${value.platform.pages} páginas, ${value.platform.modules} módulos y ` +
    `${value.platform.files} archivos. Generado ${formatDate(value.generatedAt)}.`
  );
  return value;
}

function populateSelect(select, values, placeholder) {
  if (!select) return;
  const current = select.value;
  select.replaceChildren();
  if (placeholder) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  }
  values.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function populateSelectors() {
  if (!manifest) return;
  const mode = $('site-diagnostic-mode')?.value || 'full';
  const targetWrap = $('site-diagnostic-target-wrap');
  const roleWrap = $('site-diagnostic-role-wrap');
  const target = $('site-diagnostic-target');
  if (targetWrap) targetWrap.hidden = !['page', 'module'].includes(mode);
  if (roleWrap) roleWrap.hidden = mode !== 'role';

  if (mode === 'page') {
    populateSelect(target, manifest.pages.map(page => [page.path, `${page.label} · /${page.path}`]));
  } else if (mode === 'module') {
    populateSelect(target, [
      ...MODULE_TARGETS,
      ...manifest.modules.map(module => [`file:${module.path}`, `Archivo · ${module.path}`])
    ]);
  }
  populateSelect(
    $('site-diagnostic-role'),
    manifest.roles.map(role => [role, role]),
    null
  );
  populateSelect(
    $('site-diagnostic-page'),
    manifest.pages.map(page => [page.path, page.label]),
    'Todas las páginas'
  );
  populateSelect(
    $('site-diagnostic-device'),
    manifest.viewports.map(viewport => [viewport.label, viewport.label]),
    'Todos los dispositivos'
  );
  populateSelect(
    $('site-diagnostic-role-filter'),
    manifest.roles.map(role => [role, role]),
    'Todos los roles'
  );
}

function getScope() {
  const mode = $('site-diagnostic-mode')?.value || 'full';
  return {
    mode,
    target: ['page', 'module'].includes(mode) ? ($('site-diagnostic-target')?.value || '') : '',
    role: mode === 'role' ? ($('site-diagnostic-role')?.value || 'superadmin') : ''
  };
}

function scopePages(scope) {
  if (!manifest) return [];
  if (scope.mode === 'page') return manifest.pages.filter(page => page.path === scope.target);
  if (scope.mode === 'module') {
    const groups = {
      admin: ['admin.html', 'admin-images.html'],
      commerce: ['catalogo.html', 'collections.html', 'product.html', 'checkout.html'],
      account: ['login.html', 'perfil.html', 'checkout.html'],
      content: manifest.pages
        .map(page => page.path)
        .filter(path => !['admin.html', 'admin-images.html', 'login.html', 'perfil.html', 'checkout.html'].includes(path))
    };
    if (groups[scope.target]) return manifest.pages.filter(page => groups[scope.target].includes(page.path));
    if (scope.target.startsWith('file:')) {
      const selected = scope.target.slice(5);
      const modulesByPath = new Map(manifest.modules.map(module => [module.path, module]));
      const dependsOnSelected = start => {
        const pending = [start];
        const visited = new Set();
        while (pending.length) {
          const current = pending.shift();
          if (!current || visited.has(current)) continue;
          visited.add(current);
          if (current === selected) return true;
          const module = modulesByPath.get(current);
          module?.imports
            ?.map(item => item.target)
            .filter(Boolean)
            .forEach(item => pending.push(item));
        }
        return false;
      };
      return manifest.pages.filter(page =>
        page.scripts
          .map(script => script.target)
          .filter(Boolean)
          .some(dependsOnSelected)
      );
    }
  }
  return manifest.pages;
}

function openHistoryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DB, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HISTORY_STORE)) {
        const store = database.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('generatedAt', 'generatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el historial local'));
  });
}

async function saveHistory(report) {
  const database = await openHistoryDb();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE, 'readwrite');
    transaction.objectStore(HISTORY_STORE).put(report);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar el historial'));
  });
  database.close();
}

async function loadHistory() {
  const database = await openHistoryDb();
  const values = await new Promise((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE, 'readonly');
    const request = transaction.objectStore(HISTORY_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('No se pudo leer el historial'));
  });
  database.close();
  historyCache = values.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
  renderHistory();
  return historyCache;
}

function prepareDiagnostics() {
  if (preparationPromise) return preparationPromise;
  preparationPromise = Promise.allSettled([
    manifest ? Promise.resolve(manifest) : loadManifest(),
    loadHistory()
  ]).then(results => {
    const manifestResult = results[0];
    if (manifestResult.status === 'rejected') {
      throw new Error(`El inventario no pudo cargarse: ${manifestResult.reason?.message || manifestResult.reason}`);
    }
    if (results[1].status === 'rejected') {
      historyCache = [];
      renderHistory();
      console.warn('[site-diagnostics] Historial local no disponible:', results[1].reason);
    }
    return manifestResult.value;
  }).finally(() => {
    preparationPromise = null;
  });
  return preparationPromise;
}

function pageUrl(path) {
  return new URL(path, document.baseURI).href;
}

async function fetchPage(page) {
  const testId = `route.fetch.${page.path}`;
  const attempts = [];
  let final = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = performance.now();
    try {
      const response = await fetch(`${pageUrl(page.path)}?diagnostic_readonly=${Date.now()}_${attempt}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'X-Diagnostic-Mode': 'read-only' }
      });
      const buffer = await response.arrayBuffer();
      final = {
        ok: response.ok,
        status: response.status,
        url: response.url,
        durationMs: Math.round(performance.now() - started),
        bytes: buffer.byteLength,
        hash: await sha256(buffer),
        html: new TextDecoder().decode(buffer)
      };
    } catch (error) {
      final = {
        ok: false,
        status: 0,
        url: pageUrl(page.path),
        durationMs: Math.round(performance.now() - started),
        error: error.message,
        bytes: 0,
        hash: '',
        html: ''
      };
    }
    attempts.push(final);
    if (final.ok && final.durationMs <= 3500) break;
    await new Promise(resolve => setTimeout(resolve, 180));
  }
  const successfulAttempt = [...attempts].reverse().find(item => item.ok);
  if (successfulAttempt) final = successfulAttempt;

  const findings = [];
  const coverage = [];
  const testResults = [];
  if (!final.ok) {
    findings.push(createFinding({
      testId,
      title: 'Ruta inaccesible',
      description: 'La página no respondió correctamente en dos intentos seguros de lectura.',
      category: 'navegación',
      severity: page.path === 'index.html' || page.path === 'checkout.html' ? 'critical' : 'high',
      page: page.path,
      pageLabel: page.label,
      route: `/${page.path}`,
      component: 'Documento',
      file: page.sourceFile,
      role: page.roles.join(', '),
      state: 'Carga inicial',
      steps: `Solicitar /${page.path} dos veces con caché deshabilitada.`,
      expected: 'Respuesta HTTP 2xx con contenido HTML.',
      actual: final.status ? `HTTP ${final.status}` : final.error,
      evidence: attempts.map((item, index) =>
        `Intento ${index + 1}: ${item.status || 'sin estado'}, ${item.durationMs} ms${item.error ? `, ${item.error}` : ''}`
      ).join(' · '),
      consequence: 'La página no puede utilizarse desde esta publicación.',
      testName: 'Disponibilidad reproducida de ruta',
      correctionLocation: page.sourceFile,
      solutionStatus: final.status === 404 ? 'known' : 'requires-investigation',
      suggestion: final.status === 404
        ? 'Publicar el archivo o corregir la ruta que lo referencia.'
        : 'Revisar la publicación, red y respuesta del alojamiento.'
    }));
    coverage.push(createCoverageItem({
      id: `route-coverage-${page.path}`,
      kind: 'page',
      label: page.label,
      target: page.path,
      status: 'not-reviewed',
      reason: 'La página no pudo cargarse; las pruebas dependientes no se ejecutaron.',
      requiredPermission: page.requiresAuth ? page.roles.join(', ') : 'No requerido',
      testId
    }));
    testResults.push({
      id: testId,
      name: 'Disponibilidad reproducida de ruta',
      target: page.path,
      expected: 'HTTP 2xx con contenido HTML.',
      actual: final.status ? `HTTP ${final.status}` : final.error,
      evidence: attempts.map(item => `${item.status || 0}/${item.durationMs}ms`).join(' · '),
      status: 'failed',
      executedAt: new Date().toISOString()
    });
    return { findings, coverage, completedTests: [testId], testResults, pageResult: final };
  }

  pageHtmlCache.set(page.path, final.html);
  if (final.hash !== page.sha256) {
    findings.push(createFinding({
      testId,
      title: 'Inventario desactualizado respecto de la página publicada',
      description: 'La huella del HTML servido no coincide con la que generó el inventario.',
      category: 'estructural',
      severity: 'high',
      page: page.path,
      pageLabel: page.label,
      route: `/${page.path}`,
      component: 'Inventario de despliegue',
      file: 'diagnostic-manifest.json',
      role: page.roles.join(', '),
      state: 'Publicación actual',
      steps: `Comparar SHA-256 de /${page.path} con el manifiesto.`,
      expected: page.sha256,
      actual: final.hash,
      evidence: `HTML: ${final.bytes} bytes · manifiesto: ${page.bytes} bytes.`,
      consequence: 'El diagnóstico estático podría describir una versión diferente de la página.',
      testName: 'Integridad página-manifiesto',
      correctionLocation: 'scripts/build-diagnostic-manifest.js / flujo de publicación',
      solutionStatus: 'known',
      suggestion: 'Regenerar y publicar el manifiesto junto con la misma versión del sitio.'
    }));
  }

  const slowAttempts = attempts.filter(item => item.ok && item.durationMs > 3500);
  if (slowAttempts.length === 2) {
    findings.push(createFinding({
      testId,
      title: 'Respuesta lenta reproducida',
      description: 'La descarga del HTML superó el criterio de 3.500 ms en dos intentos consecutivos.',
      category: 'rendimiento',
      severity: 'low',
      confirmation: 'manual',
      page: page.path,
      pageLabel: page.label,
      route: `/${page.path}`,
      component: 'Respuesta HTML',
      file: page.sourceFile,
      role: page.roles.join(', '),
      state: 'Carga inicial',
      steps: `Solicitar /${page.path} dos veces sin caché.`,
      expected: 'Respuesta inferior a 3.500 ms según el criterio del diagnóstico.',
      actual: attempts.map(item => `${item.durationMs} ms`).join(' y '),
      evidence: 'Medición realizada desde el navegador actual; puede incluir condiciones de red del dispositivo.',
      consequence: 'El acceso puede sentirse lento en condiciones similares.',
      testName: 'Tiempo de respuesta repetido',
      correctionLocation: page.sourceFile,
      locationCertainty: 'probable',
      solutionStatus: 'requires-investigation',
      suggestion: 'Confirmar desde otra red y revisar peso del documento y respuesta del alojamiento.'
    }));
  }
  testResults.push({
    id: testId,
    name: 'Disponibilidad e integridad de ruta',
    target: page.path,
    expected: `HTTP 2xx y SHA-256 ${page.sha256}.`,
    actual: `HTTP ${final.status}, SHA-256 ${final.hash}, ${final.durationMs} ms.`,
    evidence: `${final.bytes} bytes descargados sin caché.`,
    status: final.hash === page.sha256 ? 'passed' : 'failed',
    executedAt: new Date().toISOString()
  });
  return { findings, coverage, completedTests: [testId], testResults, pageResult: final };
}

// Rutas de los shims que reemplazan al SDK real de Firebase únicamente
// dentro del iframe aislado del Diagnóstico. Todo lo que no sea una función
// que escribe/muta pasa directo al SDK real (reexportado tal cual); ver
// js/diagnostic-shims/*.js. El importmap redirige la URL EXACTA del CDN que
// ya usa cada módulo de la plataforma (js/firebase.js, admin-app.js, etc.),
// así que ninguna página necesita saber que está siendo inspeccionada.
const DIAGNOSTIC_SHIM_MAP = {
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js': 'js/diagnostic-shims/firestore-shim.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js': 'js/diagnostic-shims/auth-shim.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js': 'js/diagnostic-shims/storage-shim.js'
};

function safeHtml(html, sourceUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Los frames/objetos anidados quedan fuera de alcance: el diagnóstico no
  // necesita recursar dentro de ellos y así evita crecer sin control.
  doc.querySelectorAll('iframe,object,embed,portal').forEach(node => node.remove());
  doc.querySelectorAll('meta[http-equiv="refresh"]').forEach(node => node.remove());
  // Los manejadores inline (onclick, onsubmit...) solo importan si algo los
  // dispara; el diagnóstico nunca hace clic ni envía formularios, pero se
  // quitan igual como resguardo ante un script que intente disparar uno por
  // su cuenta (por ejemplo, un submit programático).
  doc.querySelectorAll('[onload],[onclick],[onerror],[onsubmit],[onchange],[oninput]').forEach(node => {
    [...node.attributes].forEach(attribute => {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
    });
  });
  doc.querySelectorAll('form').forEach(form => {
    form.setAttribute('action', 'about:blank');
    form.setAttribute('method', 'get');
  });
  const base = doc.createElement('base');
  base.href = sourceUrl;
  doc.head.prepend(base);

  const importMap = doc.createElement('script');
  importMap.type = 'importmap';
  importMap.textContent = JSON.stringify({ imports: Object.fromEntries(
    Object.entries(DIAGNOSTIC_SHIM_MAP).map(([real, shim]) => [real, pageUrl(shim)])
  ) });
  doc.head.prepend(importMap);

  // Guardia de red: debe quedar como el primer <script> clásico del
  // documento para correr antes que cualquier otro script de la página real
  // (los módulos siempre se difieren hasta después de parsear el documento).
  const networkGuard = doc.createElement('script');
  networkGuard.src = pageUrl('js/diagnostic-shims/network-guard.js');
  doc.head.prepend(networkGuard);

  const csp = doc.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content = [
    "default-src 'self' https: data: blob:",
    // Los scripts de la propia plataforma (mismo origen) y el SDK de
    // Firebase (gstatic) pueden ejecutarse de verdad: la seguridad contra
    // escrituras no depende de impedir que corra JavaScript, sino de que
    // firestore-shim.js/auth-shim.js/storage-shim.js reemplacen únicamente
    // las funciones que escriben, más la guardia de red como segunda capa.
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebasestorage.app wss://*.firebaseio.com",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'self'"
  ].join('; ');
  doc.head.prepend(csp);
  doc.documentElement.dataset.diagnosticReadonly = 'true';
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function loadSafeFrame(page, html, viewport) {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.className = 'adm-diagnostic-frame';
    // allow-scripts habilita la ejecución real de JavaScript de la página;
    // allow-same-origin permite que conserve el origen real del sitio (para
    // que las rutas relativas y Firebase Auth/Firestore funcionen como en
    // producción). Nunca se agrega allow-forms, allow-popups,
    // allow-top-navigation ni allow-modals: el documento no puede enviar
    // formularios, abrir ventanas, navegar la pestaña real ni bloquear el
    // escaneo con un alert/confirm/prompt.
    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.width = String(viewport.width);
    frame.height = String(viewport.height);
    frame.style.width = `${viewport.width}px`;
    frame.style.height = `${viewport.height}px`;
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ frame, ...result });
    };
    frame.addEventListener('load', () => {
      // Con scripts reales corriendo, hay que dar tiempo a que los módulos,
      // los listeners de Firestore (onSnapshot) y el color-scheme apliquen
      // su estado antes de medir; con scripts bloqueados 450ms alcanzaba,
      // pero ahora hace falta esperar una carga de datos real.
      setTimeout(() => finish({ ok: true }), 1400);
    }, { once: true });
    const timer = setTimeout(() => finish({ ok: false, error: 'Tiempo de carga agotado' }), 12000);
    document.body.appendChild(frame);
    frame.srcdoc = safeHtml(html, pageUrl(page.path));
  });
}

function selectorFor(element) {
  if (!element || element.nodeType !== 1) return 'No determinado';
  if (element.id) return `#${element.id}`;
  const classes = [...element.classList].slice(0, 2).map(name => `.${name}`).join('');
  return `${element.tagName.toLowerCase()}${classes}`;
}

function parseColor(value) {
  const match = String(value || '').match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4])
  };
}

function luminance(color) {
  const transform = value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * transform(color.r) + 0.7152 * transform(color.g) + 0.0722 * transform(color.b);
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function effectiveBackground(element, win) {
  let current = element;
  while (current && current.nodeType === 1) {
    const style = win.getComputedStyle(current);
    if (style.backgroundImage && style.backgroundImage !== 'none') return null;
    const color = parseColor(style.backgroundColor);
    if (color && color.a >= 0.95) return color;
    current = current.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function isVisible(element, win) {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  if (element.closest('.tt-sr-only,[data-diagnostic-ignore-visual="true"]')) return false;
  const style = win.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const visuallyClipped = style.clip === 'rect(0px, 0px, 0px, 0px)' ||
    style.clipPath === 'inset(50%)';
  return style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity || 1) > 0.02 &&
    !visuallyClipped &&
    rect.width > 0 &&
    rect.height > 0;
}

function isInlineTextLink(element, win) {
  if (element.tagName !== 'A' || win.getComputedStyle(element).display !== 'inline') return false;
  const container = element.closest('p,li,td,th,figcaption,blockquote');
  if (!container) return false;
  const linkText = element.textContent.trim();
  const containerText = container.textContent.trim();
  return containerText.length > linkText.length || container.children.length > 1;
}

function effectiveTouchRect(element, doc) {
  if (element.matches('input[type="checkbox"],input[type="radio"]')) {
    const wrappingLabel = element.closest('label');
    const escapedId = element.id && doc.defaultView?.CSS?.escape
      ? doc.defaultView.CSS.escape(element.id)
      : String(element.id || '').replace(/["\\]/g, '\\$&');
    const explicitLabel = escapedId
      ? doc.querySelector(`label[for="${escapedId}"]`)
      : null;
    const label = wrappingLabel || explicitLabel;
    if (label) return label.getBoundingClientRect();
  }
  return element.getBoundingClientRect();
}

function collectVisualObservations(page, viewport, doc, win) {
  const observations = [];
  const rootWidth = Math.max(doc.documentElement.scrollWidth, doc.body?.scrollWidth || 0);
  if (rootWidth > viewport.width + 4) {
    const offenders = [...doc.body.querySelectorAll('*')]
      .filter(node => {
        if (!isVisible(node, win)) return false;
        const rect = node.getBoundingClientRect();
        return rect.right > viewport.width + 4 || rect.left < -4 || rect.width > viewport.width + 4;
      })
      .slice(0, 6);
    observations.push({
      key: `overflow:${selectorFor(offenders[0])}`,
      title: 'Desborde horizontal reproducido',
      category: 'responsive',
      severity: 'medium',
      component: selectorFor(offenders[0]),
      actual: `El documento mide ${Math.round(rootWidth)}px dentro de un viewport de ${viewport.width}px.`,
      evidence: offenders.length
        ? `Posibles responsables medidos: ${offenders.map(selectorFor).join(', ')}.`
        : `scrollWidth=${Math.round(rootWidth)}.`
    });
  }

  [...doc.images].filter(image =>
    image.complete && image.currentSrc && image.naturalWidth === 0 && isVisible(image, win)
  ).slice(0, 10).forEach(image => {
    observations.push({
      key: `broken-image:${selectorFor(image)}:${image.currentSrc}`,
      title: 'Imagen rota en la composición segura',
      category: 'visual',
      severity: 'medium',
      component: selectorFor(image),
      actual: 'La imagen terminó de cargar con ancho natural igual a cero.',
      evidence: image.currentSrc
    });
  });

  const textElements = [...doc.body.querySelectorAll(
    'p,span,a,button,label,h1,h2,h3,h4,h5,h6,li,td,th,small,strong'
  )].filter(element => isVisible(element, win) && element.textContent.trim()).slice(0, 500);

  const typographyElements = [...doc.body.querySelectorAll(
    'p,span,a,button,input,textarea,select,option,optgroup,label,legend,summary,' +
    'h1,h2,h3,h4,h5,h6,li,td,th,small,strong,b,em,i,u,mark,blockquote,' +
    'figcaption,pre,code,kbd,samp,svg text,svg tspan'
  )].filter(element => isVisible(element, win) && (
    element.textContent.trim() ||
    element.value ||
    element.getAttribute('placeholder')
  )).slice(0, 1200);

  let typographyFailures = 0;
  for (const element of typographyElements) {
    const style = win.getComputedStyle(element);
    const primaryFamily = String(style.fontFamily || '')
      .split(',')[0]
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (primaryFamily !== 'Montserrat') {
      observations.push({
        key: `typography:${selectorFor(element)}`,
        title: 'Tipografía distinta de Montserrat',
        category: 'visual',
        severity: 'high',
        component: selectorFor(element),
        actual: `La familia calculada es "${style.fontFamily || 'no determinada'}".`,
        evidence: 'La comprobación usa getComputedStyle() dentro del viewport seguro.'
      });
      typographyFailures += 1;
    }

    if (element.matches('input[placeholder],textarea[placeholder]')) {
      const placeholderStyle = win.getComputedStyle(element, '::placeholder');
      const placeholderFamily = String(placeholderStyle.fontFamily || '')
        .split(',')[0]
        .replace(/^['"]|['"]$/g, '')
        .trim();
      if (placeholderFamily !== 'Montserrat') {
        observations.push({
          key: `typography-placeholder:${selectorFor(element)}`,
          title: 'Placeholder con tipografía distinta de Montserrat',
          category: 'visual',
          severity: 'high',
          component: selectorFor(element),
          actual: `La familia calculada del placeholder es "${placeholderStyle.fontFamily || 'no determinada'}".`,
          evidence: 'La comprobación usa getComputedStyle(element, "::placeholder").'
        });
        typographyFailures += 1;
      }
    }

    if (typographyFailures >= 12) break;
  }

  for (const element of textElements) {
    const style = win.getComputedStyle(element);
    const foreground = parseColor(style.color);
    const background = effectiveBackground(element, win);
    if (!foreground || !background || foreground.a < 0.95) continue;
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
    const threshold = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
    const ratio = contrastRatio(foreground, background);
    if (ratio + 0.05 < threshold) {
      observations.push({
        key: `contrast:${selectorFor(element)}`,
        title: 'Contraste de texto insuficiente medido',
        category: 'accesibilidad',
        severity: 'medium',
        component: selectorFor(element),
        actual: `Relación ${ratio.toFixed(2)}:1; mínimo aplicado ${threshold}:1.`,
        evidence: `color ${style.color}; fondo ${win.getComputedStyle(element).backgroundColor || 'heredado'}.`
      });
    }
  }

  if (viewport.width <= 390) {
    [...doc.querySelectorAll('button,a[href],input,select,textarea')]
      .filter(element =>
        isVisible(element, win) &&
        !element.disabled &&
        !isInlineTextLink(element, win)
      )
      .slice(0, 400)
      .forEach(element => {
        const rect = effectiveTouchRect(element, doc);
        if (rect.width >= 24 && rect.height >= 24) return;
        observations.push({
          key: `touch:${selectorFor(element)}`,
          title: 'Área táctil inferior al mínimo medido',
          category: 'accesibilidad',
          severity: 'minimal',
          component: selectorFor(element),
          actual: `${Math.round(rect.width)} × ${Math.round(rect.height)} px.`,
          evidence: 'Criterio aplicado: mínimo verificable de 24 × 24 px.'
        });
      });
  }

  [...doc.body.querySelectorAll('*')]
    .filter(element => isVisible(element, win))
    .slice(0, 1200)
    .forEach(element => {
      const style = win.getComputedStyle(element);
      if (!element.textContent.trim()) return;
      const clipsHorizontally = /(hidden|clip)/.test(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 3;
      const clipsVertically = /(hidden|clip)/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 3;
      const intentionalEllipsis = clipsHorizontally &&
        style.textOverflow === 'ellipsis' &&
        style.whiteSpace === 'nowrap' &&
        Boolean(element.getAttribute('title') || element.getAttribute('aria-label'));
      if ((!clipsHorizontally && !clipsVertically) || intentionalEllipsis) return;
      observations.push({
        key: `clipped:${selectorFor(element)}`,
        title: 'Contenido recortado por su contenedor',
        category: 'visual',
        severity: 'low',
        component: selectorFor(element),
        actual: `Contenido ${element.scrollWidth}×${element.scrollHeight}px dentro de ${element.clientWidth}×${element.clientHeight}px.`,
        evidence: `Ejes recortados: ${[
          clipsHorizontally ? 'horizontal' : '',
          clipsVertically ? 'vertical' : ''
        ].filter(Boolean).join(' y ')}. overflow-x=${style.overflowX}; overflow-y=${style.overflowY}; text-overflow=${style.textOverflow}.`
      });
    });
  return observations;
}

async function analyzeVisualPage(page, viewports) {
  const findings = [];
  const coverage = [];
  const completedTests = [];
  const testResults = [];
  let discardedFalsePositives = 0;
  const html = pageHtmlCache.get(page.path);
  if (!html) {
    coverage.push(createCoverageItem({
      id: `visual-unavailable-${page.path}`,
      kind: 'visual',
      label: `Inspección visual de ${page.label}`,
      target: page.path,
      status: 'not-available',
      reason: 'No existe HTML cargado para construir el entorno seguro.',
      requiredPermission: page.requiresAuth ? page.roles.join(', ') : 'No requerido',
      testId: `visual.safe-frame.${page.path}`
    }));
    return { findings, coverage, completedTests, testResults, discardedFalsePositives };
  }

  for (const viewport of viewports) {
    const testId = `visual.safe-frame.${page.path}.${viewport.id}`;
    const blockedWritesBefore = blockedWriteEvents.length;
    const loaded = await loadSafeFrame(page, html, viewport);
    if (!loaded.ok) {
      coverage.push(createCoverageItem({
        id: `visual-failed-${page.path}-${viewport.id}`,
        kind: 'visual',
        label: `${page.label} · ${viewport.label}`,
        target: page.path,
        status: 'not-available',
        reason: `La prueba no pudo completarse: ${loaded.error}.`,
        requiredPermission: page.requiresAuth ? page.roles.join(', ') : 'No requerido',
        testId,
        device: viewport.id
      }));
      loaded.frame.remove();
      testResults.push({
        id: testId,
        name: 'Inspección visual segura',
        target: `${page.path} · ${viewport.label}`,
        expected: 'La composición estática debe poder medirse dos veces.',
        actual: loaded.error,
        evidence: 'El iframe de solo lectura no completó la carga.',
        status: 'not-available',
        executedAt: new Date().toISOString()
      });
      continue;
    }
    try {
      const doc = loaded.frame.contentDocument;
      const win = loaded.frame.contentWindow;
      if (!doc?.documentElement || !win) throw new Error('Documento seguro no disponible');
      const first = collectVisualObservations(page, viewport, doc, win);
      await new Promise(resolve => setTimeout(resolve, 90));
      const second = collectVisualObservations(page, viewport, doc, win);
      const secondKeys = new Set(second.map(item => item.key));
      const confirmed = first.filter(item => secondKeys.has(item.key));
      discardedFalsePositives += Math.max(0, first.length - confirmed.length);
      confirmed.forEach(observation => {
        findings.push(createFinding({
          fingerprint: stableHash([
            testId.replace(`.${viewport.id}`, ''),
            observation.title,
            page.path,
            observation.component
          ].join('|')),
          testId,
          title: observation.title,
          description: 'La misma medición apareció dos veces dentro del entorno visual de solo lectura.',
          category: observation.category,
          severity: observation.severity,
          page: page.path,
          pageLabel: page.label,
          route: `/${page.path}`,
          component: observation.component,
          file: page.sourceFile,
          device: `${viewport.label} (${viewport.width}×${viewport.height})`,
          role: page.roles.join(', '),
          state: 'Página cargada con sus scripts reales en ejecución (solo se bloquean escrituras)',
          steps: `Cargar /${page.path} con JavaScript real en ${viewport.width}×${viewport.height} y repetir la medición.`,
          expected: 'Composición sin desbordes, recursos rotos, recortes ni incumplimientos medibles.',
          actual: observation.actual,
          evidence: `${observation.evidence} Confirmado en dos mediciones consecutivas.`,
          consequence: observation.category === 'accessibility'
            ? 'Puede dificultar la lectura o interacción accesible.'
            : 'La presentación puede resultar dañada en esta resolución.',
          testName: 'Inspección visual repetida con ejecución real de scripts',
          correctionLocation: `${page.sourceFile} / ${observation.component}`,
          locationCertainty: 'probable',
          solutionStatus: 'possible',
          suggestion: 'Revisar los estilos aplicados al componente medido y confirmar el cambio en esta misma resolución.',
          occurrences: [{
            page: page.path,
            device: viewport.id,
            evidence: observation.evidence
          }]
        }));
      });
      completedTests.push(testId);
      testResults.push({
        id: testId,
        name: 'Inspección visual estática repetida',
        target: `${page.path} · ${viewport.label}`,
        expected: 'Sin observaciones reproducibles de desborde, contraste, recorte, imágenes o áreas táctiles.',
        actual: `${confirmed.length} observación(es) reproducible(s).`,
        evidence: `${first.length} primera medición · ${second.length} segunda medición · ${Math.max(0, first.length - confirmed.length)} señal(es) no reproducidas y descartadas.`,
        status: confirmed.length ? 'failed' : 'passed',
        executedAt: new Date().toISOString()
      });
    } catch (error) {
      coverage.push(createCoverageItem({
        id: `visual-error-${page.path}-${viewport.id}`,
        kind: 'visual',
        label: `${page.label} · ${viewport.label}`,
        target: page.path,
        status: 'not-available',
        reason: `La prueba no pudo completarse: ${error.message}.`,
        requiredPermission: page.requiresAuth ? page.roles.join(', ') : 'No requerido',
        testId,
        device: viewport.id
      }));
      testResults.push({
        id: testId,
        name: 'Inspección visual segura',
        target: `${page.path} · ${viewport.label}`,
        expected: 'La prueba debe completarse ejecutando los scripts reales de la página.',
        actual: error.message,
        evidence: 'La prueba no produjo una conclusión sobre ausencia de problemas.',
        status: 'not-available',
        executedAt: new Date().toISOString()
      });
    } finally {
      const blocked = collectBlockedWritesSince(blockedWritesBefore);
      if (blocked.length) {
        coverage.push(createCoverageItem({
          id: `visual-blocked-writes-${page.path}-${viewport.id}`,
          kind: 'write-guard',
          label: `Escrituras bloqueadas al cargar ${page.label} · ${viewport.label}`,
          target: page.path,
          status: 'intentional',
          reason: `La página intentó ${blocked.length} llamada(s) de escritura durante la carga y el diagnóstico las bloqueó de forma segura sin llegar a la plataforma real: ${
            [...new Set(blocked.map(item => item.blockedCall))].join(', ')
          }.`,
          requiredPermission: page.requiresAuth ? page.roles.join(', ') : 'No requerido',
          testId,
          device: viewport.id
        }));
      }
      loaded.frame.remove();
    }
  }
  return { findings, coverage, completedTests, testResults, discardedFalsePositives };
}

function anonymizedDocumentId(id) {
  return `doc-${stableHash(id)}`;
}

function validateSample(collectionName, data) {
  const issues = [];
  if (collectionName === 'products') {
    const name = String(data.name || data.title || data.Title || data.handle || '').trim();
    const rawPrice = data.price ?? data.Price ?? data['Variant Price'];
    const price = Number(String(rawPrice ?? '').replace(/\./g, '').replace(',', '.'));
    if (!name) issues.push('nombre vacío');
    if (!Number.isFinite(price) || price < 0) issues.push('precio no numérico o negativo');
    if (data.stock !== undefined && data.stock !== null && (!Number.isFinite(Number(data.stock)) || Number(data.stock) < 0)) {
      issues.push('stock no numérico o negativo');
    }
  }
  if (collectionName === 'collections') {
    const name = String(data.name || data.title || '').trim();
    if (!name) issues.push('nombre vacío');
    if (data.order !== undefined && !Number.isFinite(Number(data.order))) issues.push('orden no numérico');
  }
  if (collectionName === 'users') {
    const allowed = ['superadmin', 'admin', 'agent', 'viewer', 'client'];
    if (data.role !== undefined && !allowed.includes(String(data.role))) issues.push('rol no registrado');
  }
  if (collectionName === 'orders') {
    if (!Array.isArray(data.items) || !data.items.length) issues.push('pedido sin ítems');
    const total = Number(data.total);
    if (!Number.isFinite(total) || total < 0) issues.push('total no numérico o negativo');
  }
  return issues;
}

async function analyzeDataReadonly(scope) {
  const findings = [];
  const coverage = [];
  const completedTests = [];
  const testResults = [];
  const collections = (manifest.firestore?.collectionsUsed || [])
    .map(item => item.name)
    .filter(name => /^[A-Za-z0-9_-]{1,80}$/.test(name));
  const sampleTargets = new Set(['products', 'collections', 'users', 'orders']);

  for (const name of collections) {
    const accessTestId = `data.read.${name}`;
    try {
      const targetCollection = name === 'siteTraffic'
        ? collection(db, 'siteTraffic', new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Asuncion',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date()), 'sessions')
        : collection(db, name);
      const snapshot = await getDocs(query(targetCollection, limit(sampleTargets.has(name) ? 30 : 1)));
      completedTests.push(accessTestId);
      if (sampleTargets.has(name)) {
        snapshot.docs.forEach(documentSnapshot => {
          const issues = validateSample(name, documentSnapshot.data() || {});
          if (!issues.length) return;
          findings.push(createFinding({
            testId: `data.sample.${name}`,
            title: 'Registro con estructura incompatible confirmada en la muestra',
            description: `Una muestra limitada de ${name} contiene campos incompatibles con el consumo actual.`,
            category: 'base de datos',
            severity: name === 'orders' ? 'high' : 'medium',
            page: 'Super Admin',
            pageLabel: 'Diagnóstico',
            route: '/admin.html#diagnostico',
            section: `Colección ${name}`,
            component: anonymizedDocumentId(documentSnapshot.id),
            file: 'Firestore',
            role: 'superadmin',
            state: 'Muestra de solo lectura',
            steps: `Leer como máximo 30 documentos de ${name} y validar únicamente tipos y campos operativos.`,
            expected: 'Los campos consumidos por la plataforma deben tener tipos compatibles.',
            actual: issues.join(', '),
            evidence: `${anonymizedDocumentId(documentSnapshot.id)} · campos observados: ${Object.keys(documentSnapshot.data() || {}).sort().join(', ')}.`,
            consequence: 'El registro puede renderizarse o procesarse de forma incorrecta.',
            testName: 'Validación limitada y anonimizada de esquema',
            correctionLocation: `Firestore / ${name} / ${anonymizedDocumentId(documentSnapshot.id)}`,
            locationCertainty: 'confirmed',
            solutionStatus: 'requires-investigation',
            suggestion: 'Revisar el registro identificado desde una herramienta administrativa autorizada. El diagnóstico no lo modifica.'
          }));
        });
        completedTests.push(`data.sample.${name}`);
      }
      coverage.push(createCoverageItem({
        id: `data-ok-${name}`,
        kind: 'database',
        label: `Lectura de ${name}`,
        target: name,
        status: sampleTargets.has(name) ? 'partial' : 'reviewed',
        reason: sampleTargets.has(name)
          ? `Acceso confirmado; se inspeccionaron ${snapshot.size} documentos como máximo.`
          : 'Acceso de solo lectura confirmado con una consulta limitada a un documento.',
        requiredPermission: 'superadmin',
        testId: accessTestId
      }));
      testResults.push({
        id: accessTestId,
        name: 'Disponibilidad de Firestore en solo lectura',
        target: name,
        expected: 'Consulta limitada permitida para Super Admin.',
        actual: `Consulta completada con ${snapshot.size} documento(s) como máximo.`,
        evidence: `Límite aplicado: ${sampleTargets.has(name) ? 30 : 1}. No se exportaron valores personales.`,
        status: 'passed',
        executedAt: new Date().toISOString()
      });
    } catch (error) {
      completedTests.push(accessTestId);
      const missingIndex = String(error.code || '').includes('failed-precondition') &&
        /index/i.test(String(error.message || ''));
      findings.push(createFinding({
        testId: accessTestId,
        title: missingIndex
          ? 'Consulta bloqueada por un índice faltante'
          : 'Colección utilizada pero no accesible para el diagnóstico',
        description: 'Una consulta limitada y de solo lectura fue rechazada o no pudo completarse.',
        category: 'base de datos',
        severity: ['products', 'collections', 'orders', 'users'].includes(name) ? 'high' : 'medium',
        page: 'Super Admin',
        pageLabel: 'Diagnóstico',
        route: '/admin.html#diagnostico',
        section: `Colección ${name}`,
        component: name,
        file: 'Firestore / firestore.rules',
        role: 'superadmin',
        state: 'Consulta limitada de solo lectura',
        steps: `Ejecutar getDocs(query(collection(db, "${name}"), limit(1))) como Super Admin.`,
        expected: 'La colección utilizada por la plataforma debe poder verificarse con el permiso correspondiente.',
        actual: error.code || error.message,
        evidence: `Código: ${error.code || 'no determinado'}. No se registraron datos ni valores sensibles.`,
        consequence: 'El diagnóstico no puede confirmar disponibilidad o consistencia de esta fuente.',
        testName: 'Disponibilidad de Firestore en solo lectura',
        correctionLocation: missingIndex
          ? `Firestore / índices / ${name}`
          : `firestore.rules / match ${name}`,
        locationCertainty: 'probable',
        solutionStatus: missingIndex ? 'known' : 'requires-investigation',
        suggestion: missingIndex
          ? 'Crear el índice exacto indicado por Firestore después de revisar que la consulta sea necesaria.'
          : 'Comparar el uso del frontend con las reglas de lectura. No ampliar permisos sin confirmar la necesidad.'
      }));
      testResults.push({
        id: accessTestId,
        name: 'Disponibilidad de Firestore en solo lectura',
        target: name,
        expected: 'Consulta limitada permitida para Super Admin.',
        actual: error.code || error.message,
        evidence: 'No se efectuó ninguna escritura.',
        status: 'failed',
        executedAt: new Date().toISOString()
      });
    }
  }
  coverage.push(createCoverageItem({
    id: `data-no-write-${scope.mode}`,
    kind: 'database',
    label: 'Pruebas de escritura, transacción y eliminación',
    target: 'Firestore',
    status: 'not-available',
    reason: 'Bloqueadas deliberadamente: el diagnóstico de producción no crea datos de prueba ni modifica registros reales.',
    requiredPermission: 'Entorno de pruebas aislado y autorización expresa',
    testId: 'data.destructive-flows'
  }));
  return { findings, coverage, completedTests, testResults };
}

function calculateCoverage(report) {
  const pageStatuses = new Map(report.pages.map(page => [page.path, 'reviewed']));
  report.coverageItems.forEach(item => {
    if (!pageStatuses.has(item.target)) return;
    if (item.status === 'not-reviewed' || item.status === 'not-available') pageStatuses.set(item.target, 'not-reviewed');
    else if (item.status === 'partial' && pageStatuses.get(item.target) !== 'not-reviewed') pageStatuses.set(item.target, 'partial');
  });
  const pagesReviewed = [...pageStatuses.values()].filter(value => value === 'reviewed').length;
  const pagesPartial = [...pageStatuses.values()].filter(value => value === 'partial').length;
  const pagesNotReviewed = [...pageStatuses.values()].filter(value => value === 'not-reviewed').length;
  const testResults = report.testResults || [];
  const testsUnavailable = testResults.filter(item => item.status === 'not-available').length +
    report.coverageItems.filter(item => item.status === 'not-available').length;
  const testsFailed = testResults.filter(item => item.status === 'failed').length +
    report.coverageItems.filter(item => item.status === 'failed').length;
  const completed = testResults.filter(item => ['passed', 'failed'].includes(item.status)).length;
  const unavailableWeight = report.coverageItems.filter(item =>
    ['not-available', 'not-reviewed', 'partial', 'failed'].includes(item.status)
  ).length;
  const denominator = Math.max(1, completed + unavailableWeight);
  return {
    totalPages: report.pages.length,
    pagesReviewed,
    pagesPartial,
    pagesNotReviewed,
    routesInaccessible: report.findings.filter(item => item.testId.startsWith('route.fetch.') && item.confirmation === 'confirmed').length,
    componentsAnalyzed: report.pages.reduce((sum, page) =>
      sum + page.buttons.length + page.forms.length + page.tables.length + page.modals.length + page.sections.length,
    0),
    componentsNotAnalyzed: report.coverageItems.filter(item => item.kind.includes('state')).length,
    testsExecuted: completed,
    testsFailed,
    testsUnavailable,
    resolutionsChecked: [...new Set(report.completedTests
      .filter(id => id.startsWith('visual.safe-frame.'))
      .map(id => id.split('.').pop()))].length,
    rolesChecked: report.scope.mode === 'role' ? 1 : 1,
    estimatedPercent: Math.max(0, Math.min(100, Math.round((completed / denominator) * 100)))
  };
}

function filters() {
  return {
    search: ($('site-diagnostic-search')?.value || '').trim().toLowerCase(),
    severity: $('site-diagnostic-severity')?.value || '',
    confirmation: $('site-diagnostic-confirmation')?.value || '',
    category: $('site-diagnostic-category')?.value || '',
    page: $('site-diagnostic-page')?.value || '',
    route: $('site-diagnostic-route')?.value || '',
    section: $('site-diagnostic-section')?.value || '',
    component: $('site-diagnostic-component')?.value || '',
    device: $('site-diagnostic-device')?.value || '',
    role: $('site-diagnostic-role-filter')?.value || '',
    recurrence: $('site-diagnostic-state')?.value || '',
    date: $('site-diagnostic-date')?.value || ''
  };
}

function matchesFilters(item, current) {
  if (current.severity && item.severity !== current.severity) return false;
  if (current.confirmation && item.confirmation !== current.confirmation) return false;
  if (current.category && item.category !== current.category) return false;
  if (current.page && item.page !== current.page) return false;
  if (current.route && item.route !== current.route) return false;
  if (current.section && item.section !== current.section) return false;
  if (current.component && item.component !== current.component) return false;
  if (current.device && !String(item.device).toLowerCase().includes(current.device.toLowerCase())) return false;
  if (current.role && !String(item.role).toLowerCase().includes(current.role.toLowerCase())) return false;
  if (current.recurrence && item.recurrence !== current.recurrence) return false;
  if (
    current.date &&
    !String(item.detectedAt || '').startsWith(current.date) &&
    !String(item.lastConfirmedAt || '').startsWith(current.date) &&
    !String(item.noLongerDetectedAt || '').startsWith(current.date)
  ) return false;
  if (current.search) {
    const haystack = [
      item.title, item.description, item.category, item.page, item.pageLabel, item.route,
      item.section, item.component, item.file, item.evidence, item.actual, item.suggestion
    ].join(' ').toLowerCase();
    if (!haystack.includes(current.search)) return false;
  }
  return true;
}

function populateFindingFilters(report) {
  const categories = [...new Set(report.findings.map(item => item.category))].sort();
  const routes = [...new Set(report.findings.map(item => item.route).filter(value => value && value !== 'No determinado'))].sort();
  const sections = [...new Set(report.findings.map(item => item.section).filter(value => value && value !== 'No determinado'))].sort();
  const components = [...new Set(report.findings.map(item => item.component).filter(value => value && value !== 'No determinado'))].sort();
  populateSelect($('site-diagnostic-category'), categories.map(value => [value, value]), 'Todas las categorías');
  populateSelect($('site-diagnostic-route'), routes.map(value => [value, value]), 'Todas las rutas');
  populateSelect($('site-diagnostic-section'), sections.map(value => [value, value]), 'Todas las secciones');
  populateSelect($('site-diagnostic-component'), components.map(value => [value, value]), 'Todos los componentes');
}

function badge(label, className = '') {
  return `<span class="adm-diagnostic-badge ${className}">${escapeHtml(label)}</span>`;
}

function detail(label, value) {
  return `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || 'No determinado')}</div>`;
}

function renderFinding(item) {
  const confirmationClass = item.confirmation === 'confirmed'
    ? 'adm-diagnostic-badge-confirmed'
    : item.confirmation === 'manual'
      ? 'adm-diagnostic-badge-manual'
      : '';
  const recurrenceClass = item.recurrence === 'recurrent'
    ? 'adm-diagnostic-badge-recurrent'
    : 'adm-diagnostic-badge-new';
  const occurrences = item.occurrences?.length
    ? `<p><strong>Otras evidencias agrupadas:</strong> ${escapeHtml(JSON.stringify(item.occurrences))}</p>`
    : '';
  return `
    <article class="adm-diagnostic-item adm-diagnostic-item-${escapeHtml(item.severity)}">
      <div class="adm-diagnostic-item-head">
        <h4>${escapeHtml(item.title)}</h4>
        <div class="adm-diagnostic-badges">
          ${badge(SEVERITY_LABELS[item.severity] || item.severity)}
          ${badge(CONFIRMATION_LABELS[item.confirmation] || item.confirmation, confirmationClass)}
          ${badge(item.recurrence === 'recurrent' ? 'Recurrente' : 'Nuevo', recurrenceClass)}
        </div>
      </div>
      <p>${escapeHtml(item.description)}</p>
      <p class="adm-diagnostic-evidence"><strong>Evidencia:</strong> ${escapeHtml(item.evidence)}</p>
      <details>
        <summary>Ver información completa y ubicación de corrección</summary>
        <div class="adm-diagnostic-detail-grid">
          ${detail('Categoría', item.category)}
          ${detail('Página', item.pageLabel)}
          ${detail('Ruta', item.route)}
          ${detail('Sección', item.section)}
          ${detail('Componente', item.component)}
          ${detail('Archivo', item.file)}
          ${detail('Línea o zona', item.line)}
          ${detail('Dispositivo', item.device)}
          ${detail('Rol', item.role)}
          ${detail('Estado', item.state)}
          ${detail('Pasos para reproducir', item.steps)}
          ${detail('Resultado esperado', item.expected)}
          ${detail('Resultado real', item.actual)}
          ${detail('Consecuencia', item.consequence)}
          ${detail('Detectado', formatDate(item.detectedAt))}
          ${detail('Última confirmación', formatDate(item.lastConfirmedAt))}
          ${detail('Prueba', item.testName)}
          ${detail('Ubicación recomendada', `${item.correctionLocation.certainty}: ${item.correctionLocation.value}`)}
          ${detail('Estado de solución', item.solutionStatus)}
          ${detail('Sugerencia no ejecutada', item.suggestion)}
        </div>
        ${occurrences}
      </details>
    </article>`;
}

function renderSummary(report) {
  const summary = summarizeReport(report);
  const node = $('site-diagnostic-summary');
  if (!node) return;
  node.hidden = false;
  node.innerHTML = `
    <div class="adm-diagnostic-kpi"><strong>${summary.total}</strong><span>Problemas y verificaciones activas</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-critical"><strong>${summary.critical}</strong><span>Críticos</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-high"><strong>${summary.high}</strong><span>Altos</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-medium"><strong>${summary.medium}</strong><span>Medios</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-low"><strong>${summary.low}</strong><span>Bajos</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-minimal"><strong>${summary.minimal}</strong><span>Mínimos</span></div>
    <div class="adm-diagnostic-kpi"><strong>${summary.manual}</strong><span>Requieren verificación manual</span></div>
    <div class="adm-diagnostic-kpi"><strong>${summary.resolved}</strong><span>Ya no detectados tras volver a comprobar</span></div>`;

  const coverage = $('site-diagnostic-coverage');
  if (!coverage) return;
  coverage.hidden = false;
  coverage.innerHTML = `
    <div class="adm-diagnostic-coverage-card"><strong>${report.coverage.estimatedPercent}%</strong><span>Cobertura estimada real; nunca se fuerza a 100%</span></div>
    <div class="adm-diagnostic-coverage-card"><strong>${report.coverage.totalPages}</strong><span>Páginas detectadas · ${report.coverage.pagesReviewed} completas · ${report.coverage.pagesPartial} parciales · ${report.coverage.pagesNotReviewed} no revisadas</span></div>
    <div class="adm-diagnostic-coverage-card"><strong>${report.coverage.componentsAnalyzed}</strong><span>Componentes inventariados · ${report.coverage.componentsNotAnalyzed} estados o componentes no analizables</span></div>
    <div class="adm-diagnostic-coverage-card"><strong>${report.coverage.testsExecuted}</strong><span>Pruebas ejecutadas · ${report.coverage.testsUnavailable} no disponibles · ${report.coverage.testsFailed} fallidas</span></div>
    <div class="adm-diagnostic-coverage-card"><strong>${report.coverage.resolutionsChecked}/7</strong><span>Resoluciones comprobadas · ${report.coverage.rolesChecked}/6 roles comprobados en esta ejecución</span></div>
    <div class="adm-diagnostic-coverage-card"><strong>${report.coverage.routesInaccessible}</strong><span>Rutas inaccesibles confirmadas durante esta ejecución</span></div>
    <div class="adm-diagnostic-coverage-card"><strong>${formatDuration(report.durationMs)}</strong><span>Duración · ${formatDate(report.generatedAt)}</span></div>`;
}

function renderActiveResults() {
  const root = $('site-diagnostic-results');
  if (!root || !lastReport) return;
  const currentFilters = filters();
  const source = currentFilters.confirmation === 'no-longer-detected'
    ? (lastReport.resolved || [])
    : currentFilters.confirmation === 'not-reverified'
      ? (lastReport.notReverified || [])
      : lastReport.findings;
  const findings = source.filter(item => matchesFilters(item, currentFilters));
  if (!findings.length) {
    root.innerHTML = '<div class="adm-diagnostic-empty">No hay problemas que coincidan con estos filtros. Esto no significa que los sectores no revisados estén libres de errores.</div>';
    return;
  }
  const groups = new Map();
  findings.forEach(item => {
    const key = item.pageLabel || item.page;
    const values = groups.get(key) || [];
    values.push(item);
    groups.set(key, values);
  });
  root.innerHTML = [...groups.entries()].map(([label, items]) => `
    <details class="adm-diagnostic-page" open>
      <summary><span>${escapeHtml(label)}</span><small>${items.length} resultado(s)</small></summary>
      <div class="adm-diagnostic-page-body">${items.map(renderFinding).join('')}</div>
    </details>`).join('');
}

function renderCoverageResults() {
  const root = $('site-diagnostic-results');
  if (!root || !lastReport) return;
  const items = [
    ...lastReport.coverageItems,
    ...(lastReport.testResults || [])
      .filter(item => ['failed', 'not-available'].includes(item.status))
      .map(item => ({
        id: item.id,
        kind: 'test-result',
        label: item.name,
        target: item.target,
        status: item.status,
        reason: `${item.actual} Evidencia: ${item.evidence}`,
        requiredPermission: 'Según el objetivo inspeccionado',
        testId: item.id,
        device: item.target
      })),
    ...(lastReport.notReverified || []).map(item => ({
      id: item.id,
      kind: 'reverification',
      label: item.title,
      target: item.page,
      status: 'not-reverified',
      reason: 'La prueba original no formó parte o no pudo completarse en esta ejecución.',
      requiredPermission: item.role,
      testId: item.testId,
      device: item.device
    }))
  ].filter(item => [
    'partial', 'not-reviewed', 'not-available', 'failed', 'not-reverified', 'intentional', 'false-positive'
  ].includes(item.status));
  const coverageHtml = items.length ? items.map(item => `
    <article class="adm-diagnostic-item adm-diagnostic-item-low">
      <div class="adm-diagnostic-item-head">
        <h4>${escapeHtml(item.label)}</h4>
        <div class="adm-diagnostic-badges">${badge(CONFIRMATION_LABELS[item.status] || item.status)}</div>
      </div>
      <p>${escapeHtml(item.reason)}</p>
      <div class="adm-diagnostic-detail-grid">
        ${detail('Objetivo', item.target)}
        ${detail('Tipo', item.kind)}
        ${detail('Permiso requerido', item.requiredPermission)}
        ${detail('Dispositivo', item.device)}
        ${detail('Prueba', item.testId)}
      </div>
    </article>`).join('') : '<div class="adm-diagnostic-empty">No quedaron pruebas incompletas en el alcance seleccionado.</div>';
  const tests = lastReport.testResults || [];
  const testLog = `
    <details class="adm-diagnostic-page">
      <summary><span>Registro verificable de pruebas ejecutadas</span><small>${tests.length} prueba(s)</small></summary>
      <div class="adm-diagnostic-page-body">
        ${tests.map(test => `
          <article class="adm-diagnostic-item ${test.status === 'failed' ? 'adm-diagnostic-item-high' : 'adm-diagnostic-item-minimal'}">
            <div class="adm-diagnostic-item-head">
              <h4>${escapeHtml(test.name)}</h4>
              <div class="adm-diagnostic-badges">${badge(test.status)}</div>
            </div>
            <div class="adm-diagnostic-detail-grid">
              ${detail('Objetivo', test.target)}
              ${detail('Esperado', test.expected)}
              ${detail('Resultado real', test.actual)}
              ${detail('Evidencia', test.evidence)}
              ${detail('Ejecutada', formatDate(test.executedAt))}
              ${detail('ID de prueba', test.id)}
            </div>
          </article>`).join('')}
      </div>
    </details>`;
  root.innerHTML = coverageHtml + testLog;
}

function renderResults() {
  if (!lastReport) return;
  $('site-diagnostic-history').hidden = activeView !== 'history';
  $('site-diagnostic-results').hidden = activeView === 'history';
  if (activeView === 'history') renderHistory();
  else if (activeView === 'coverage') renderCoverageResults();
  else renderActiveResults();
}

function renderHistory() {
  const root = $('site-diagnostic-history');
  if (!root) return;
  if (!historyCache.length) {
    root.innerHTML = '<div class="adm-diagnostic-empty">Todavía no existe historial en este navegador.</div>';
    return;
  }
  root.innerHTML = historyCache.map((report, index) => {
    const summary = summarizeReport(report);
    const previous = historyCache.slice(index + 1).find(item =>
      item.scope?.mode === report.scope?.mode &&
      (item.scope?.target || '') === (report.scope?.target || '') &&
      (item.scope?.role || '') === (report.scope?.role || '')
    );
    const coverageDelta = previous
      ? report.coverage.estimatedPercent - previous.coverage.estimatedPercent
      : 0;
    return `
      <article class="adm-diagnostic-history-card">
        <div class="adm-diagnostic-history-head">
          <div><strong>${escapeHtml(MODE_LABELS[report.scope.mode] || report.scope.mode)}</strong><br><span>${escapeHtml(formatDate(report.generatedAt))} · ${escapeHtml(report.executedBy || 'Super Admin autenticado')}${report.actorReference ? ` · ${escapeHtml(report.actorReference)}` : ''}</span></div>
          ${badge(`${report.coverage.estimatedPercent}% cobertura`)}
        </div>
        <div class="adm-diagnostic-history-metrics">
          <span>${summary.confirmed} confirmados</span>
          <span>${summary.manual} manuales</span>
          <span>${summary.new} nuevos</span>
          <span>${summary.recurrent} recurrentes</span>
          <span>${summary.increased} aumentaron gravedad</span>
          <span>${summary.decreased} disminuyeron gravedad</span>
          <span>${summary.resolved} ya no detectados</span>
          <span>${summary.notReverified} no reverificados</span>
          <span>${report.discardedFalsePositives || 0} señales no reproducidas descartadas</span>
          <span>${coverageDelta >= 0 ? '+' : ''}${coverageDelta}% cobertura frente al anterior</span>
          <span>${formatDuration(report.durationMs)}</span>
        </div>
        <div class="adm-diagnostic-history-actions">
          <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" data-diagnostic-open="${escapeHtml(report.id)}">Ver diagnóstico</button>
          <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" data-diagnostic-export="${escapeHtml(report.id)}">Exportar JSON</button>
        </div>
      </article>`;
  }).join('');
}

function reportAsText(report) {
  const summary = summarizeReport(report);
  const lines = [
    'DIAGNÓSTICO TINTIN — SOLO LECTURA',
    `Fecha: ${report.generatedAt}`,
    `Ejecutado por: ${report.executedBy || 'Super Admin autenticado'}${report.actorReference ? ` · ${report.actorReference}` : ''}`,
    `Tipo: ${MODE_LABELS[report.scope.mode] || report.scope.mode}`,
    `Duración: ${formatDuration(report.durationMs)}`,
    `Cobertura: ${report.coverage.estimatedPercent}%`,
    `Confirmados: ${summary.confirmed} | Manuales: ${summary.manual} | Ya no detectados: ${summary.resolved}`,
    ''
  ];
  report.findings.forEach(item => {
    lines.push(`[${SEVERITY_LABELS[item.severity]}] [${CONFIRMATION_LABELS[item.confirmation]}] ${item.title}`);
    lines.push(`Página/ruta: ${item.pageLabel} · ${item.route}`);
    lines.push(`Ubicación: ${item.file}:${item.line} · ${item.component}`);
    lines.push(`Esperado: ${item.expected}`);
    lines.push(`Real: ${item.actual}`);
    lines.push(`Evidencia: ${item.evidence}`);
    lines.push(`Sugerencia no ejecutada: ${item.suggestion}`);
    lines.push('');
  });
  if (report.coverageItems.length) {
    lines.push('ELEMENTOS NO REVISADOS O PARCIALES');
    report.coverageItems.forEach(item => lines.push(`[${item.status}] ${item.label}: ${item.reason}`));
  }
  return lines.join('\n');
}

function exportReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `tintin-diagnostico-${report.generatedAt.slice(0, 10)}-${report.id.slice(-8)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

async function runDiagnostics() {
  if (running) return;
  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== SUPER_ADMIN.toLowerCase()) {
    setStatus('Acceso denegado: esta herramienta es exclusiva del Super Admin autenticado.');
    return;
  }
  try {
    await prepareDiagnostics();
  } catch (error) {
    setStatus(`La prueba no pudo completarse: ${error.message}.`);
    return;
  }

  const scope = getScope();
  const pages = scopePages(scope);
  scope.pagePaths = pages.map(page => page.path);
  const isolatedModule = scope.mode === 'module' && scope.target.startsWith('file:');
  if (!pages.length && scope.mode !== 'data' && scope.mode !== 'role' && !isolatedModule) {
    setStatus('No existe un objetivo válido para esta ejecución.');
    return;
  }

  running = true;
  pageHtmlCache.clear();
  const button = $('btn-run-site-diagnostics');
  const started = performance.now();
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Comprobando…';
  $('site-diagnostic-summary').hidden = true;
  $('site-diagnostic-coverage').hidden = true;
  $('site-diagnostic-toolbar').hidden = true;
  $('site-diagnostic-view-tabs').hidden = true;
  $('site-diagnostic-results').innerHTML = '';
  $('site-diagnostic-history').hidden = true;

  try {
    const staticResult = buildStaticAnalysis(manifest, scope);
    const findings = [...staticResult.findings];
    const coverageItems = [...staticResult.coverage];
    const completedTests = new Set(staticResult.completedTests);
    const testResults = staticResult.completedTests.map(id => ({
      id,
      name: 'Análisis estático del inventario',
      target: id.split('.').slice(2).join('.') || 'Plataforma',
      expected: 'La prueba debe completarse y reportar únicamente evidencia encontrada.',
      actual: 'Prueba completada; los hallazgos asociados se registran por separado.',
      evidence: `Inventario ${manifest.sourceFingerprint.slice(0, 16)}… generado ${manifest.generatedAt}.`,
      status: 'passed',
      executedAt: new Date().toISOString()
    }));
    let discardedFalsePositives = 0;
    if (isolatedModule) {
      const modulePath = scope.target.slice(5);
      const module = manifest.modules.find(item => item.path === modulePath);
      const testId = `technical.module.${modulePath}`;
      if (module) {
        completedTests.add(testId);
        testResults.push({
          id: testId,
          name: 'Inventario técnico del módulo',
          target: modulePath,
          expected: 'El módulo debe existir, tener una huella verificable y dependencias inventariadas.',
          actual: `${module.bytes} bytes · ${module.imports.length} importación(es) · ${module.endpoints.length} endpoint(s).`,
          evidence: `SHA-256 ${module.sha256}.`,
          status: 'passed',
          executedAt: new Date().toISOString()
        });
        if (!pages.length) {
          coverageItems.push(createCoverageItem({
            id: `module-runtime-${stableHash(modulePath)}`,
            kind: 'module-runtime',
            label: 'Ejecución real del módulo',
            target: modulePath,
            status: 'not-available',
            reason: 'No se encontró una página que cargue este módulo directamente. No se ejecuta de forma aislada para evitar efectos secundarios.',
            requiredPermission: 'Entorno de pruebas específico',
            testId
          }));
        }
      }
    }
    const visualEnabled = modeIncludes(scope.mode, 'visual');
    const routeEnabled = ['full', 'page', 'module', 'visual', 'functional', 'technical'].includes(scope.mode);
    const dataEnabled = modeIncludes(scope.mode, 'data');
    const totalSteps = (routeEnabled ? pages.length : 0) +
      (visualEnabled ? pages.length : 0) +
      (dataEnabled ? 1 : 0) + 1;
    let step = 0;

    if (routeEnabled) {
      for (const page of pages) {
        setProgress(step, totalSteps, `Comprobando la ruta ${page.label}`);
        const result = await fetchPage(page);
        findings.push(...result.findings);
        coverageItems.push(...result.coverage);
        result.completedTests.forEach(id => completedTests.add(id));
        testResults.push(...result.testResults);
        step += 1;
      }
    }

    if (visualEnabled) {
      for (const page of pages) {
        setProgress(step, totalSteps, `Midiendo ${page.label} en siete resoluciones`);
        const result = await analyzeVisualPage(page, manifest.viewports);
        findings.push(...result.findings);
        coverageItems.push(...result.coverage);
        result.completedTests.forEach(id => completedTests.add(id));
        testResults.push(...result.testResults);
        discardedFalsePositives += result.discardedFalsePositives || 0;
        step += 1;
      }
    }

    if (dataEnabled) {
      setProgress(step, totalSteps, 'Comprobando fuentes de datos con consultas limitadas');
      const result = await analyzeDataReadonly(scope);
      findings.push(...result.findings);
      coverageItems.push(...result.coverage);
      result.completedTests.forEach(id => completedTests.add(id));
      testResults.push(...result.testResults);
      step += 1;
    }

    setProgress(totalSteps, totalSteps, 'Clasificando, agrupando y comparando evidencia');
    const previous = historyCache.find(item =>
      item.scope?.mode === scope.mode &&
      (item.scope?.target || '') === (scope.target || '') &&
      (item.scope?.role || '') === (scope.role || '')
    ) || null;
    const actorHash = await sha256(new TextEncoder().encode(user.uid));
    const report = {
      schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
      id: `run-${Date.now()}-${stableHash(manifest.sourceFingerprint)}`,
      generatedAt: new Date().toISOString(),
      executedBy: 'Super Admin autenticado',
      actorReference: `usuario-${actorHash.slice(0, 12)}`,
      origin: location.origin,
      manifestGeneratedAt: manifest.generatedAt,
      sourceFingerprint: manifest.sourceFingerprint,
      safety: {
        readOnly: true,
        pageScriptsExecuted: false,
        writesToPlatform: 0,
        destructiveTests: 0,
        history: 'IndexedDB local del navegador'
      },
      scope,
      pages,
      viewports: visualEnabled ? manifest.viewports : [],
      roles: scope.mode === 'role' ? [scope.role] : ['superadmin'],
      findings: dedupeFindings(findings),
      coverageItems,
      completedTests: [...completedTests],
      testResults,
      discardedFalsePositives,
      durationMs: Math.round(performance.now() - started),
      resolved: [],
      notReverified: []
    };
    compareReports(report, previous);
    report.coverage = calculateCoverage(report);
    lastReport = report;
    try {
      await saveHistory(report);
      await loadHistory();
    } catch (historyError) {
      report.coverageItems.push(createCoverageItem({
        id: `history-unavailable-${report.id}`,
        kind: 'history',
        label: 'Historial local del diagnóstico',
        target: 'IndexedDB del navegador',
        status: 'not-available',
        reason: `La prueba no pudo completarse: ${historyError.message}. El informe actual sigue disponible para exportar.`,
        requiredPermission: 'Almacenamiento local habilitado',
        testId: 'history.local-save'
      }));
      report.coverage = calculateCoverage(report);
    }
    populateFindingFilters(report);
    renderSummary(report);
    activeView = 'active';
    document.querySelectorAll('[data-diagnostic-view]').forEach(node => {
      node.classList.toggle('active', node.dataset.diagnosticView === activeView);
    });
    $('site-diagnostic-toolbar').hidden = false;
    $('site-diagnostic-view-tabs').hidden = false;
    renderResults();
    const summary = summarizeReport(report);
    setStatus(
      `Diagnóstico terminado sin modificar la plataforma: ${summary.confirmed} problema(s) confirmado(s), ` +
      `${summary.manual} resultado(s) para verificación manual, ${summary.resolved} ya no detectado(s) y ` +
      `${report.coverage.estimatedPercent}% de cobertura real.`
    );
  } catch (error) {
    console.error('[site-diagnostics] La prueba no pudo completarse:', error);
    setStatus(`La prueba no pudo completarse: ${error.message}. Ningún sector pendiente se considera libre de errores.`);
  } finally {
    running = false;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = 'Ejecutar diagnóstico';
  }
}

function bindFilters() {
  [
    'site-diagnostic-search',
    'site-diagnostic-severity',
    'site-diagnostic-confirmation',
    'site-diagnostic-category',
    'site-diagnostic-page',
    'site-diagnostic-route',
    'site-diagnostic-section',
    'site-diagnostic-component',
    'site-diagnostic-device',
    'site-diagnostic-role-filter',
    'site-diagnostic-state',
    'site-diagnostic-date'
  ].forEach(id => {
    const node = $(id);
    node?.addEventListener(id.endsWith('search') ? 'input' : 'change', renderResults);
  });
}

export function initSiteDiagnostics({ role } = {}) {
  if (initialized) return;
  const user = auth.currentUser;
  if (role !== 'superadmin' || !user || String(user.email || '').toLowerCase() !== SUPER_ADMIN.toLowerCase()) return;
  const runButton = $('btn-run-site-diagnostics');
  if (!runButton) return;
  initialized = true;

  runButton.addEventListener('click', runDiagnostics);
  $('site-diagnostic-mode')?.addEventListener('change', async () => {
    try {
      await prepareDiagnostics();
      populateSelectors();
    } catch (error) {
      setStatus(error.message);
    }
  });
  document.querySelectorAll('[data-section="diagnostico"]').forEach(node => {
    node.addEventListener('click', () => {
      prepareDiagnostics().catch(error => setStatus(error.message));
    });
  });
  bindFilters();
  $('btn-copy-site-diagnostics')?.addEventListener('click', async () => {
    if (!lastReport) return;
    try {
      await navigator.clipboard.writeText(reportAsText(lastReport));
      setStatus('Informe copiado. No se modificó ningún dato de la plataforma.');
    } catch (_) {
      setStatus('No se pudo copiar automáticamente. Usá Exportar JSON.');
    }
  });
  $('btn-export-site-diagnostics')?.addEventListener('click', () => {
    if (lastReport) exportReport(lastReport);
  });
  $('site-diagnostic-view-tabs')?.addEventListener('click', event => {
    const button = event.target.closest('[data-diagnostic-view]');
    if (!button) return;
    activeView = button.dataset.diagnosticView;
    document.querySelectorAll('[data-diagnostic-view]').forEach(node => {
      node.classList.toggle('active', node === button);
    });
    renderResults();
  });
  $('site-diagnostic-history')?.addEventListener('click', event => {
    const open = event.target.closest('[data-diagnostic-open]');
    const exportButton = event.target.closest('[data-diagnostic-export]');
    const id = open?.dataset.diagnosticOpen || exportButton?.dataset.diagnosticExport;
    if (!id) return;
    const report = historyCache.find(item => item.id === id);
    if (!report) return;
    if (exportButton) {
      exportReport(report);
      return;
    }
    lastReport = report;
    populateFindingFilters(report);
    renderSummary(report);
    activeView = 'active';
    document.querySelectorAll('[data-diagnostic-view]').forEach(node => {
      node.classList.toggle('active', node.dataset.diagnosticView === 'active');
    });
    renderResults();
    setStatus(`Mostrando diagnóstico histórico de ${formatDate(report.generatedAt)}. No se ha vuelto a ejecutar.`);
  });

  if ($('section-diagnostico')?.classList.contains('active')) {
    prepareDiagnostics().catch(error => setStatus(error.message));
  } else {
    setStatus('Diagnóstico listo. El inventario se cargará al abrir este módulo.');
  }
}
