import { auth } from './firebase.js';
import { SUPER_ADMIN } from './roles.js';

const PUBLIC_PAGES = [
  ['Inicio', 'index.html', true],
  ['Catálogo', 'catalogo.html', true],
  ['Colecciones', 'collections.html', true],
  ['Producto', 'product.html', true],
  ['Nosotros', 'about.html', true],
  ['Contacto', 'contact.html', true],
  ['Envíos', 'envios.html', true],
  ['Cambios y devoluciones', 'cambios-devoluciones.html', true],
  ['Preguntas frecuentes', 'preguntas-frecuentes.html', true],
  ['Privacidad', 'privacidad.html', true],
  ['Términos', 'terminos.html', true],
  ['Acceso', 'login.html', false],
  ['Perfil', 'perfil.html', true],
  ['Checkout', 'checkout.html', true],
  ['Página 404', '404.html', true]
].map(([label, path, runtime]) => ({ label, path, runtime }));

const VIEWPORTS = [
  { label: 'móvil', width: 390, height: 844 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1366, height: 768 }
];

let initialized = false;
let running = false;
let lastReport = null;
const checkedResources = new Map();

function $(id) { return document.getElementById(id); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function selectorFor(element) {
  if (!element || element.nodeType !== 1) return 'elemento desconocido';
  if (element.id) return `#${element.id}`;
  const classes = Array.from(element.classList || []).slice(0, 2);
  return `${element.tagName.toLowerCase()}${classes.map(name => `.${name}`).join('')}`;
}

function finding(page, severity, category, title, detail, source = '', suggestion = '') {
  return { page: page.path, pageLabel: page.label, severity, category, title, detail, source, suggestion };
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter(item => {
    const key = [item.page, item.severity, item.category, item.title, item.detail, item.source].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateProgress(index, total, label) {
  const percent = Math.round((index / total) * 100);
  $('site-diagnostic-progress-bar').style.width = `${percent}%`;
  $('site-diagnostic-status').textContent = `${label} · ${index} de ${total} páginas (${percent}%)`;
}

function absoluteUrl(value, pageUrl) {
  try { return new URL(value, pageUrl); } catch (_) { return null; }
}

function resourceCandidates(doc, pageUrl) {
  const candidates = [];
  doc.querySelectorAll('script[src]').forEach(node => candidates.push({ kind: 'script', raw: node.getAttribute('src') }));
  doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(node => candidates.push({ kind: 'estilo', raw: node.getAttribute('href') }));
  doc.querySelectorAll('img[src],source[src]').forEach(node => candidates.push({ kind: 'imagen', raw: node.getAttribute('src') }));
  doc.querySelectorAll('a[href]').forEach(node => {
    const raw = node.getAttribute('href') || '';
    if (/^(#|mailto:|tel:|javascript:|https:\/\/wa\.me)/i.test(raw)) return;
    candidates.push({ kind: 'enlace', raw });
  });
  return candidates
    .map(item => ({ ...item, url: absoluteUrl(item.raw, pageUrl) }))
    .filter(item => item.url && item.url.origin === location.origin && !item.url.pathname.endsWith('/admin.html'));
}

async function checkResource(candidate) {
  const key = candidate.url.href.split('#')[0];
  if (checkedResources.has(key)) return checkedResources.get(key);

  const promise = (async () => {
    try {
      let response = await fetch(key, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
      if (response.status === 405) {
        response = await fetch(key, { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
      }
      return { ok: response.ok, status: response.status };
    } catch (error) {
      return { ok: false, status: 0, error: error.message };
    }
  })();
  checkedResources.set(key, promise);
  return promise;
}

function analyzeMarkup(page, doc) {
  const findings = [];
  if (!doc.querySelector('meta[name="viewport"]')) {
    findings.push(finding(page, 'critical', 'responsive', 'Falta meta viewport', 'La página no puede adaptarse correctamente en móvil.', 'head', 'Agregar meta viewport con width=device-width.'));
  }
  if (!doc.title.trim()) {
    findings.push(finding(page, 'warning', 'SEO', 'Título vacío', 'La página no define un título reconocible.', '<title>', 'Definir un título único y descriptivo.'));
  }
  if (!doc.querySelector('meta[name="description"]')) {
    findings.push(finding(page, 'info', 'SEO', 'Falta descripción', 'No se encontró meta description.', 'head', 'Agregar una descripción breve y única.'));
  }

  const ids = new Map();
  doc.querySelectorAll('[id]').forEach(node => {
    const id = node.id;
    ids.set(id, (ids.get(id) || 0) + 1);
  });
  ids.forEach((count, id) => {
    if (count > 1) findings.push(finding(page, 'critical', 'HTML', 'ID duplicado', `El id "${id}" aparece ${count} veces.`, `#${id}`, 'Usar IDs únicos para evitar eventos y selectores ambiguos.'));
  });

  const missingAlt = Array.from(doc.querySelectorAll('img:not([alt])'));
  if (missingAlt.length) {
    findings.push(finding(page, 'warning', 'accesibilidad', 'Imágenes sin texto alternativo', `${missingAlt.length} imagen(es) no tienen atributo alt.`, selectorFor(missingAlt[0]), 'Agregar alt descriptivo o alt="" si son decorativas.'));
  }

  const unlabeled = Array.from(doc.querySelectorAll('input:not([type="hidden"]),select,textarea')).filter(control => {
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return false;
    if (control.id && doc.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return false;
    return !control.closest('label');
  });
  if (unlabeled.length) {
    findings.push(finding(page, 'warning', 'accesibilidad', 'Campos sin etiqueta', `${unlabeled.length} control(es) no tienen label ni nombre accesible.`, selectorFor(unlabeled[0]), 'Relacionar cada campo con un label o aria-label.'));
  }

  const emptyControls = Array.from(doc.querySelectorAll('button,a[href]')).filter(node => {
    const name = (node.textContent || node.getAttribute('aria-label') || node.getAttribute('title') || '').trim();
    return !name && !node.querySelector('img[alt],svg title');
  });
  if (emptyControls.length) {
    findings.push(finding(page, 'warning', 'accesibilidad', 'Controles sin nombre', `${emptyControls.length} botón(es) o enlace(s) no tienen un nombre accesible.`, selectorFor(emptyControls[0]), 'Agregar texto visible o aria-label.'));
  }

  const emptyLinks = Array.from(doc.querySelectorAll('a[href]')).filter(node => /^(#|javascript:|\s*)$/i.test(node.getAttribute('href') || ''));
  if (emptyLinks.length) {
    findings.push(finding(page, 'info', 'navegación', 'Enlaces sin destino real', `${emptyLinks.length} enlace(s) usan #, javascript: o un destino vacío.`, selectorFor(emptyLinks[0]), 'Usar button para acciones o indicar una URL válida.'));
  }

  const h1Count = doc.querySelectorAll('h1').length;
  if (h1Count !== 1) {
    findings.push(finding(page, 'info', 'estructura', 'Jerarquía H1 mejorable', `Se encontraron ${h1Count} encabezados H1.`, 'h1', 'Mantener un H1 principal por página.'));
  }
  return findings;
}

async function analyzeResources(page, doc, pageUrl) {
  const findings = [];
  const candidates = resourceCandidates(doc, pageUrl);
  const unique = Array.from(new Map(candidates.map(item => [item.url.href.split('#')[0], item])).values());
  const results = await Promise.all(unique.map(async candidate => ({ candidate, result: await checkResource(candidate) })));
  results.forEach(({ candidate, result }) => {
    if (result.ok) return;
    const severity = ['script', 'estilo'].includes(candidate.kind) ? 'critical' : 'warning';
    const status = result.status ? `HTTP ${result.status}` : (result.error || 'sin respuesta');
    findings.push(finding(page, severity, 'recursos', `${candidate.kind} no disponible`, `${candidate.url.pathname} respondió ${status}.`, candidate.raw, 'Corregir la ruta, restaurar el archivo o retirar la referencia.'));
  });
  return findings;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function loadFrame(frame, url, timeout = 12000) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      frame.removeEventListener('load', onLoad);
      resolve(value);
    };
    const onLoad = () => finish({ ok: true });
    const timer = setTimeout(() => finish({ ok: false, error: 'Tiempo de carga agotado' }), timeout);
    frame.addEventListener('load', onLoad, { once: true });
    frame.src = url;
  });
}

async function analyzeRuntime(page, pageUrl) {
  const findings = [];
  const frame = document.createElement('iframe');
  frame.className = 'adm-diagnostic-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  document.body.appendChild(frame);

  const errors = [];
  const bindErrorCapture = () => {
    try {
      frame.contentWindow.addEventListener('error', event => {
        errors.push({ message: event.message || 'Error JavaScript', source: event.filename || '', line: event.lineno || 0 });
      });
      frame.contentWindow.addEventListener('unhandledrejection', event => {
        errors.push({ message: String(event.reason?.message || event.reason || 'Promesa rechazada'), source: '' });
      });
    } catch (_) {}
  };

  bindErrorCapture();
  const loaded = await loadFrame(frame, pageUrl);
  if (!loaded.ok) {
    frame.remove();
    return [finding(page, 'critical', 'carga', 'La página no terminó de cargar', loaded.error, page.path, 'Revisar errores JavaScript, redirecciones y recursos bloqueantes.')];
  }
  bindErrorCapture();
  await wait(700);

  try {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!doc?.documentElement) throw new Error('No se pudo inspeccionar el documento');

    const finalPath = win.location.pathname.split('/').pop() || 'index.html';
    if (finalPath !== page.path) {
      findings.push(finding(page, 'info', 'navegación', 'La página redirigió durante la prueba', `Destino final: ${finalPath}.`, page.path, 'Confirmar que la redirección es intencional para este rol.'));
    }

    for (const viewport of VIEWPORTS) {
      frame.style.width = `${viewport.width}px`;
      frame.style.height = `${viewport.height}px`;
      frame.width = String(viewport.width);
      frame.height = String(viewport.height);
      await wait(120);

      const rootWidth = Math.max(doc.documentElement.scrollWidth, doc.body?.scrollWidth || 0);
      if (rootWidth > viewport.width + 3) {
        const offenders = Array.from(doc.body?.querySelectorAll('*') || []).filter(node => {
          const style = win.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && (rect.right > viewport.width + 3 || rect.left < -3);
        }).slice(0, 5).map(selectorFor);
        findings.push(finding(page, 'warning', 'responsive', `Desborde horizontal en ${viewport.label}`, `El contenido mide ${Math.round(rootWidth)}px dentro de ${viewport.width}px.${offenders.length ? ` Posibles responsables: ${offenders.join(', ')}.` : ''}`, offenders[0] || 'documentElement', 'Ajustar anchos fijos, min-width, posicionamiento u overflow del elemento indicado.'));
      }
    }

    const brokenImages = Array.from(doc.images || []).filter(img => img.complete && img.naturalWidth === 0 && img.currentSrc);
    brokenImages.slice(0, 8).forEach(img => {
      findings.push(finding(page, 'warning', 'imágenes', 'Imagen rota en ejecución', img.currentSrc, selectorFor(img), 'Corregir la ruta o reemplazar el recurso.'));
    });

    const navEntry = win.performance?.getEntriesByType('navigation')?.[0];
    const resources = win.performance?.getEntriesByType('resource') || [];
    if (navEntry) {
      const loadMs = Math.round(navEntry.loadEventEnd || navEntry.duration || 0);
      if (loadMs > 3500) findings.push(finding(page, 'warning', 'rendimiento', 'Carga lenta', `La carga completa tardó aproximadamente ${loadMs} ms.`, page.path, 'Reducir JavaScript bloqueante, imágenes y solicitudes iniciales.'));
    }
    const bytes = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    if (bytes > 4 * 1024 * 1024) findings.push(finding(page, 'warning', 'rendimiento', 'Página pesada', `Los recursos transferidos superan ${(bytes / 1048576).toFixed(1)} MB.`, page.path, 'Comprimir imágenes y evitar descargar recursos no visibles.'));
    if (resources.length > 90) findings.push(finding(page, 'info', 'rendimiento', 'Muchas solicitudes', `Se registraron ${resources.length} recursos durante la carga.`, page.path, 'Combinar o cargar de forma diferida los recursos secundarios.'));
  } catch (error) {
    findings.push(finding(page, 'critical', 'ejecución', 'No se pudo inspeccionar la página', error.message, page.path, 'Revisar redirecciones, permisos y errores de inicialización.'));
  } finally {
    frame.remove();
  }

  errors.slice(0, 10).forEach(error => {
    findings.push(finding(page, 'critical', 'JavaScript', 'Error de ejecución', error.message, `${error.source}${error.line ? `:${error.line}` : ''}`, 'Abrir el archivo y la línea indicados y corregir la excepción.'));
  });
  return findings;
}

async function analyzePage(page) {
  const pageUrl = new URL(page.path, location.href).href;
  const findings = [];
  let response;
  try {
    response = await fetch(pageUrl, { cache: 'no-store', credentials: 'same-origin' });
  } catch (error) {
    return [finding(page, 'critical', 'red', 'Página inaccesible', error.message, page.path, 'Comprobar publicación, nombre del archivo y conexión.')];
  }
  if (!response.ok) {
    return [finding(page, 'critical', 'red', 'Página inaccesible', `Respuesta HTTP ${response.status}.`, page.path, 'Corregir la ruta o publicar el archivo faltante.')];
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  findings.push(...analyzeMarkup(page, doc));
  findings.push(...await analyzeResources(page, doc, pageUrl));
  if (page.runtime) findings.push(...await analyzeRuntime(page, pageUrl));
  return findings;
}

function summaryCounts(findings) {
  return {
    total: findings.length,
    critical: findings.filter(item => item.severity === 'critical').length,
    warning: findings.filter(item => item.severity === 'warning').length,
    info: findings.filter(item => item.severity === 'info').length
  };
}

function renderSummary(report) {
  const counts = summaryCounts(report.findings);
  const summary = $('site-diagnostic-summary');
  summary.hidden = false;
  summary.innerHTML = `
    <div class="adm-diagnostic-kpi"><strong>${report.pages.length}</strong><span>Páginas analizadas</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-critical"><strong>${counts.critical}</strong><span>Críticos</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-warning"><strong>${counts.warning}</strong><span>Advertencias</span></div>
    <div class="adm-diagnostic-kpi adm-diagnostic-kpi-info"><strong>${counts.info}</strong><span>Informativos</span></div>`;
}

function renderResults(filter = 'all') {
  if (!lastReport) return;
  const root = $('site-diagnostic-results');
  const findings = filter === 'all' ? lastReport.findings : lastReport.findings.filter(item => item.severity === filter);
  if (!findings.length) {
    root.innerHTML = '<div class="adm-diagnostic-empty">No hay hallazgos en este filtro.</div>';
    return;
  }

  root.innerHTML = lastReport.pages.map(page => {
    const items = findings.filter(item => item.page === page.path);
    if (!items.length) return '';
    const body = items.map(item => `
      <article class="adm-diagnostic-item adm-diagnostic-item-${item.severity}">
        <h4>${escapeHtml(item.title)} · ${escapeHtml(item.category)}</h4>
        <p>${escapeHtml(item.detail)}</p>
        ${item.source ? `<p><strong>Ubicación:</strong> <code>${escapeHtml(item.source)}</code></p>` : ''}
        ${item.suggestion ? `<p><strong>Sugerencia:</strong> ${escapeHtml(item.suggestion)}</p>` : ''}
      </article>`).join('');
    return `<details class="adm-diagnostic-page" open><summary><span>${escapeHtml(page.label)}</span><small>${items.length} hallazgo(s)</small></summary><div class="adm-diagnostic-page-body">${body}</div></details>`;
  }).join('');
}

function reportAsText(report) {
  const counts = summaryCounts(report.findings);
  const lines = [
    'DIAGNÓSTICO TINTIN',
    `Generado: ${report.generatedAt}`,
    `Páginas: ${report.pages.length} | Críticos: ${counts.critical} | Advertencias: ${counts.warning} | Informativos: ${counts.info}`,
    ''
  ];
  report.findings.forEach(item => {
    lines.push(`[${item.severity.toUpperCase()}] ${item.pageLabel} — ${item.title}`);
    lines.push(item.detail);
    if (item.source) lines.push(`Ubicación: ${item.source}`);
    if (item.suggestion) lines.push(`Sugerencia: ${item.suggestion}`);
    lines.push('');
  });
  return lines.join('\n');
}

async function runDiagnostics() {
  if (running) return;
  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== SUPER_ADMIN.toLowerCase()) {
    $('site-diagnostic-status').textContent = 'Acceso denegado: esta herramienta es exclusiva del Super Admin.';
    return;
  }

  running = true;
  checkedResources.clear();
  const button = $('btn-run-site-diagnostics');
  const progress = $('site-diagnostic-progress');
  button.disabled = true;
  button.textContent = 'Analizando…';
  progress.hidden = false;
  $('site-diagnostic-summary').hidden = true;
  $('site-diagnostic-toolbar').hidden = true;
  $('site-diagnostic-results').innerHTML = '';

  const allFindings = [];
  try {
    for (let index = 0; index < PUBLIC_PAGES.length; index += 1) {
      const page = PUBLIC_PAGES[index];
      updateProgress(index, PUBLIC_PAGES.length, `Analizando ${page.label}`);
      allFindings.push(...await analyzePage(page));
      updateProgress(index + 1, PUBLIC_PAGES.length, `${page.label} completada`);
    }

    lastReport = {
      generatedAt: new Date().toISOString(),
      origin: location.origin,
      pages: PUBLIC_PAGES.map(({ label, path }) => ({ label, path })),
      viewports: VIEWPORTS,
      findings: dedupe(allFindings)
    };
    renderSummary(lastReport);
    renderResults($('site-diagnostic-filter').value);
    $('site-diagnostic-toolbar').hidden = false;
    const counts = summaryCounts(lastReport.findings);
    $('site-diagnostic-status').textContent = `Análisis terminado: ${counts.total} hallazgo(s), ${counts.critical} crítico(s) y ${counts.warning} advertencia(s).`;
  } catch (error) {
    console.error('[site-diagnostics] Error:', error);
    $('site-diagnostic-status').textContent = `El análisis se interrumpió: ${error.message}`;
  } finally {
    running = false;
    button.disabled = false;
    button.textContent = 'Analizar sitio';
  }
}

export function initSiteDiagnostics({ role } = {}) {
  if (initialized) return;
  const user = auth.currentUser;
  if (role !== 'superadmin' || !user || String(user.email || '').toLowerCase() !== SUPER_ADMIN.toLowerCase()) return;

  const runButton = $('btn-run-site-diagnostics');
  if (!runButton) return;
  initialized = true;
  runButton.addEventListener('click', runDiagnostics);
  $('site-diagnostic-filter')?.addEventListener('change', event => renderResults(event.target.value));
  $('btn-copy-site-diagnostics')?.addEventListener('click', async () => {
    if (!lastReport) return;
    try {
      await navigator.clipboard.writeText(reportAsText(lastReport));
      $('site-diagnostic-status').textContent = 'Informe copiado al portapapeles.';
    } catch (_) {
      $('site-diagnostic-status').textContent = 'No se pudo copiar automáticamente. Usá Exportar JSON.';
    }
  });
  $('btn-export-site-diagnostics')?.addEventListener('click', () => {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `tintin-diagnostico-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
}
