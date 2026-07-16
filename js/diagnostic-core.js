export const DIAGNOSTIC_SCHEMA_VERSION = 3;

export const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  minimal: 4
};

const MODE_GROUPS = {
  full: new Set(['inventory', 'technical', 'functional', 'visual', 'data', 'role']),
  page: new Set(['inventory', 'technical', 'functional', 'visual']),
  module: new Set(['inventory', 'technical', 'functional']),
  visual: new Set(['visual']),
  functional: new Set(['functional']),
  technical: new Set(['inventory', 'technical']),
  data: new Set(['data']),
  role: new Set(['role'])
};

export function modeIncludes(mode, group) {
  return (MODE_GROUPS[mode] || MODE_GROUPS.full).has(group);
}

export function stableHash(value) {
  const input = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function clean(value, fallback = 'No determinado') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function createFinding(input) {
  const detectedAt = input.detectedAt || new Date().toISOString();
  const finding = {
    id: '',
    fingerprint: '',
    testId: clean(input.testId, 'unknown-test'),
    title: clean(input.title, 'Problema sin título'),
    description: clean(input.description),
    category: clean(input.category, 'técnico'),
    severity: SEVERITY_ORDER[input.severity] === undefined ? 'low' : input.severity,
    confirmation: input.confirmation || 'confirmed',
    page: clean(input.page),
    pageLabel: clean(input.pageLabel),
    section: clean(input.section),
    route: clean(input.route),
    component: clean(input.component),
    file: clean(input.file),
    line: input.line || 'No determinado',
    device: clean(input.device, 'Todos / no determinado'),
    role: clean(input.role, 'Todos / no determinado'),
    state: clean(input.state, 'Estado inspeccionado'),
    steps: clean(input.steps),
    expected: clean(input.expected),
    actual: clean(input.actual),
    evidence: clean(input.evidence),
    consequence: clean(input.consequence),
    detectedAt,
    lastConfirmedAt: input.lastConfirmedAt || detectedAt,
    testName: clean(input.testName),
    correctionLocation: {
      certainty: input.locationCertainty || 'confirmed',
      value: clean(input.correctionLocation || input.file || input.component)
    },
    solutionStatus: input.solutionStatus || 'requires-investigation',
    suggestion: clean(
      input.suggestion,
      'Se confirmó el problema, pero no se pudo determinar una solución confiable con la información disponible.'
    ),
    recurrence: input.recurrence || 'new',
    occurrences: Array.isArray(input.occurrences) ? input.occurrences : []
  };
  const fingerprintSource = [
    finding.testId,
    finding.title,
    finding.category,
    finding.page,
    finding.section,
    finding.component,
    finding.file,
    finding.line,
    finding.device,
    finding.role,
    finding.actual
  ].join('|');
  finding.fingerprint = input.fingerprint || stableHash(fingerprintSource);
  finding.id = input.id || `diag-${finding.fingerprint}`;
  return finding;
}

export function createCoverageItem(input) {
  return {
    id: input.id || `coverage-${stableHash(JSON.stringify(input))}`,
    kind: input.kind || 'test',
    label: clean(input.label),
    target: clean(input.target),
    status: input.status || 'not-reviewed',
    reason: clean(input.reason),
    requiredPermission: clean(input.requiredPermission),
    testId: clean(input.testId),
    device: clean(input.device),
    role: clean(input.role)
  };
}

export function dedupeFindings(findings) {
  const grouped = new Map();
  for (const finding of findings) {
    const existing = grouped.get(finding.fingerprint);
    if (!existing) {
      grouped.set(finding.fingerprint, { ...finding });
      continue;
    }
    const occurrence = {
      page: finding.page,
      route: finding.route,
      section: finding.section,
      component: finding.component,
      file: finding.file,
      line: finding.line,
      device: finding.device,
      evidence: finding.evidence
    };
    const values = existing.occurrences || [];
    if (!values.some(item => JSON.stringify(item) === JSON.stringify(occurrence))) values.push(occurrence);
    existing.occurrences = values;
    if (SEVERITY_ORDER[finding.severity] < SEVERITY_ORDER[existing.severity]) existing.severity = finding.severity;
  }
  return [...grouped.values()].sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    a.page.localeCompare(b.page) ||
    a.title.localeCompare(b.title)
  );
}

function pageInScope(page, scope) {
  if (Array.isArray(scope.pagePaths)) return scope.pagePaths.includes(page.path);
  if (scope.mode === 'page') return page.path === scope.target;
  if (scope.mode === 'module') {
    if (scope.target === 'admin') return page.path === 'admin.html' || page.path === 'admin-images.html';
    if (scope.target === 'commerce') return ['catalogo.html', 'collections.html', 'product.html', 'checkout.html'].includes(page.path);
    if (scope.target === 'account') return ['login.html', 'perfil.html', 'checkout.html'].includes(page.path);
    if (scope.target === 'content') return !['admin.html', 'admin-images.html', 'login.html', 'perfil.html', 'checkout.html'].includes(page.path);
  }
  return true;
}

function pageFinding(page, input) {
  return createFinding({
    page: page.path,
    pageLabel: page.label,
    route: `/${page.path}`,
    file: page.sourceFile,
    role: page.roles.join(', '),
    ...input
  });
}

export function buildStaticAnalysis(manifest, scope = { mode: 'full' }) {
  const findings = [];
  const coverage = [];
  const completedTests = new Set();
  const pages = manifest.pages.filter(page => pageInScope(page, scope));
  const test = id => completedTests.add(id);

  if (modeIncludes(scope.mode, 'inventory')) {
    test('inventory.manifest');
    if (!manifest.pages.length) {
      findings.push(createFinding({
        testId: 'inventory.manifest',
        title: 'El inventario no contiene páginas',
        description: 'El manifiesto desplegado no registró ninguna página HTML.',
        category: 'estructural',
        severity: 'critical',
        page: 'Plataforma completa',
        route: 'No determinado',
        component: 'Inventario de rutas',
        file: 'diagnostic-manifest.json',
        steps: 'Abrir el manifiesto de diagnóstico y revisar la colección pages.',
        expected: 'Una entrada por cada página HTML detectada en el repositorio.',
        actual: 'La colección pages está vacía.',
        evidence: `Manifiesto generado ${manifest.generatedAt}.`,
        consequence: 'El diagnóstico no puede descubrir ni cubrir la plataforma.',
        testName: 'Inventario generado desde el repositorio',
        correctionLocation: 'scripts/build-diagnostic-manifest.js',
        solutionStatus: 'known',
        suggestion: 'Regenerar el manifiesto y revisar el recorrido de archivos.'
      }));
    }
    for (const missing of manifest.missingReferences || []) {
      findings.push(createFinding({
        testId: 'inventory.local-references',
        title: 'Referencia local inexistente',
        description: 'Una página o módulo apunta a un archivo que no existe en el inventario publicado.',
        category: 'estructural',
        severity: /\.(?:js|css)$/i.test(missing.target) ? 'high' : 'medium',
        page: missing.page,
        pageLabel: missing.page,
        route: missing.page.endsWith('.html') ? `/${missing.page}` : 'No determinado',
        component: 'Referencia interna',
        file: missing.page,
        line: missing.line,
        steps: `Abrir ${missing.page} y localizar la referencia ${missing.raw}.`,
        expected: `El archivo ${missing.target} debe existir y estar publicado.`,
        actual: `El inventario no contiene ${missing.target}.`,
        evidence: `${missing.page}:${missing.line} → ${missing.raw}`,
        consequence: 'El recurso, enlace o importación puede fallar al cargarse.',
        testName: 'Comparación de referencias contra inventario real',
        correctionLocation: `${missing.page}:${missing.line}`,
        solutionStatus: 'known',
        suggestion: 'Corregir la ruta o publicar el archivo requerido.'
      }));
    }
    test('inventory.local-references');
    for (const routePattern of manifest.routePatterns || []) {
      coverage.push(createCoverageItem({
        id: `route-pattern-${stableHash(routePattern.pattern)}`,
        kind: 'dynamic-route',
        label: 'Ruta dinámica inventariada',
        target: routePattern.pattern,
        status: 'partial',
        reason: 'La ruta base se comprueba, pero sus estados dependientes de parámetros y datos no se ejecutan con valores inventados.',
        requiredPermission: 'Según la página y el estado',
        testId: 'inventory.dynamic-routes'
      }));
    }
    test('inventory.dynamic-routes');
    for (const route of manifest.sitemapRoutes || []) {
      if (manifest.pages.some(page => page.path === route)) continue;
      findings.push(createFinding({
        testId: 'inventory.sitemap',
        title: 'El sitemap apunta a una página no inventariada',
        description: 'Una ruta publicada para buscadores no corresponde a ninguna página HTML detectada.',
        category: 'estructural',
        severity: 'medium',
        page: route,
        pageLabel: route,
        route: `/${route}`,
        component: 'sitemap.xml',
        file: 'sitemap.xml',
        state: 'Indexación',
        steps: 'Comparar cada loc del sitemap contra las páginas del inventario.',
        expected: 'Cada ruta del sitemap debe existir en el inventario.',
        actual: `${route} no fue detectada.`,
        evidence: `Entrada ${route} presente en sitemap.xml y ausente en pages.`,
        consequence: 'Los buscadores pueden recibir una ruta dañada.',
        testName: 'Comparación sitemap-inventario',
        correctionLocation: 'sitemap.xml',
        solutionStatus: 'known',
        suggestion: 'Corregir o retirar la entrada únicamente después de confirmar la ruta esperada.'
      }));
    }
    for (const page of manifest.pages.filter(item => item.visibility === 'public')) {
      if ((manifest.sitemapRoutes || []).includes(page.path)) continue;
      findings.push(pageFinding(page, {
        testId: 'inventory.sitemap',
        title: 'Página pública fuera del sitemap',
        description: 'La página existe y se considera pública, pero no está declarada para indexación.',
        category: 'estructural',
        severity: 'minimal',
        confirmation: 'manual',
        component: 'sitemap.xml',
        state: 'Indexación',
        steps: `Comparar /${page.path} con las entradas de sitemap.xml.`,
        expected: 'La decisión de incluirla o excluirla debe estar confirmada.',
        actual: 'La ruta no aparece en sitemap.xml.',
        evidence: `${page.path} tiene visibilidad pública en el inventario.`,
        consequence: 'Podría ser más difícil descubrirla desde buscadores si la exclusión no es intencional.',
        testName: 'Comparación sitemap-inventario',
        correctionLocation: 'sitemap.xml',
        locationCertainty: 'probable',
        solutionStatus: 'requires-investigation',
        suggestion: 'Confirmar si la exclusión es intencional. No agregarla automáticamente.'
      }));
    }
    test('inventory.sitemap');
  }

  if (modeIncludes(scope.mode, 'technical')) {
    for (const page of pages) {
      const base = `technical.markup.${page.path}`;
      test(base);
      if (!page.metadata.hasViewport) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Falta la configuración viewport',
          description: 'La página no declara cómo debe adaptarse al ancho del dispositivo.',
          category: 'responsive',
          severity: 'high',
          component: 'head',
          line: 1,
          state: 'Carga inicial',
          steps: `Abrir /${page.path} en un dispositivo móvil.`,
          expected: 'La página debe declarar width=device-width.',
          actual: 'No se encontró meta[name="viewport"].',
          evidence: `Inventario estático del archivo ${page.sourceFile}.`,
          consequence: 'La escala y el ancho móvil pueden ser incorrectos.',
          testName: 'Análisis de metadatos HTML',
          correctionLocation: `${page.sourceFile} / <head>`,
          solutionStatus: 'known',
          suggestion: 'Agregar una meta viewport estándar dentro de head.'
        }));
      }
      if (!page.title) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Título de página vacío',
          description: 'El documento no tiene un título identificable.',
          category: 'estructura',
          severity: 'low',
          component: '<title>',
          state: 'Carga inicial',
          steps: `Inspeccionar el elemento title de /${page.path}.`,
          expected: 'Un título único y descriptivo.',
          actual: 'El título está vacío.',
          evidence: `Campo title vacío en ${page.sourceFile}.`,
          consequence: 'Dificulta identificar la pestaña y reduce claridad para lectores de pantalla.',
          testName: 'Análisis de metadatos HTML',
          correctionLocation: `${page.sourceFile} / <title>`,
          solutionStatus: 'known',
          suggestion: 'Definir un título único y descriptivo.'
        }));
      }
      for (const duplicate of page.duplicateIds || []) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'ID HTML duplicado',
          description: `El identificador "${duplicate.id}" está repetido en el mismo documento.`,
          category: 'código',
          severity: 'high',
          component: `#${duplicate.id}`,
          line: duplicate.lines.join(', '),
          state: 'Documento cargado',
          steps: `Buscar id="${duplicate.id}" en ${page.sourceFile}.`,
          expected: 'Cada ID debe aparecer una sola vez.',
          actual: `Aparece ${duplicate.lines.length} veces.`,
          evidence: `Líneas detectadas: ${duplicate.lines.join(', ')}.`,
          consequence: 'Los selectores y eventos pueden operar sobre el elemento equivocado.',
          testName: 'Unicidad de identificadores HTML',
          correctionLocation: `${page.sourceFile}:${duplicate.lines.join(',')}`,
          solutionStatus: 'known',
          suggestion: 'Asignar identificadores únicos y actualizar sus referencias.'
        }));
      }
      for (const inline of (page.inlineScripts || []).filter(script => !script.ok)) {
        findings.push(pageFinding(page, {
          testId: `technical.syntax.${page.path}`,
          title: 'Error de sintaxis en script integrado',
          description: 'Un bloque JavaScript incluido dentro del HTML no pudo analizarse correctamente.',
          category: 'código',
          severity: 'critical',
          component: inline.module ? 'script[type="module"]' : 'script',
          line: inline.line,
          state: 'Carga del documento',
          steps: `Analizar el bloque que comienza en ${page.sourceFile}:${inline.line}.`,
          expected: 'El analizador de JavaScript debe finalizar sin errores.',
          actual: inline.error,
          evidence: `Comprobación de sintaxis ejecutada al generar el inventario ${manifest.generatedAt}.`,
          consequence: 'El bloque puede impedir que las funciones dependientes se inicialicen.',
          testName: 'Compilación estática de scripts integrados',
          correctionLocation: `${page.sourceFile}:${inline.line}`,
          solutionStatus: 'known',
          suggestion: 'Corregir la sintaxis indicada y volver a generar el inventario.'
        }));
      }
      test(`technical.syntax.${page.path}`);
      const unlabeled = (page.controls || []).filter(control =>
        control.type !== 'hidden' && !control.labeled && !control.ariaLabel
      );
      if (unlabeled.length) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Controles de formulario sin etiqueta comprobable',
          description: `${unlabeled.length} campo(s) no tienen label asociado ni nombre accesible.`,
          category: 'accesibilidad',
          severity: 'medium',
          component: unlabeled[0].id ? `#${unlabeled[0].id}` : unlabeled[0].tag,
          line: unlabeled.map(item => item.line).slice(0, 8).join(', '),
          state: 'Formulario visible',
          steps: `Revisar los controles indicados en ${page.sourceFile}.`,
          expected: 'Cada control debe tener label, aria-label o aria-labelledby.',
          actual: 'No se encontró una asociación accesible en el HTML.',
          evidence: unlabeled.slice(0, 8).map(item => `${item.tag}#${item.id || 'sin-id'}:${item.line}`).join(' · '),
          consequence: 'El propósito del campo puede no comunicarse a tecnologías de asistencia.',
          testName: 'Asociación de campos y etiquetas',
          correctionLocation: `${page.sourceFile}:${unlabeled[0].line}`,
          solutionStatus: 'known',
          suggestion: 'Asociar cada campo con un label o un nombre ARIA verificable.'
        }));
      }
      const imagesWithoutAlt = (page.images || []).filter(image => image.tag === 'img' && !image.hasAlt);
      if (imagesWithoutAlt.length) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Imágenes sin atributo alt',
          description: `${imagesWithoutAlt.length} imagen(es) no declaran texto alternativo ni alt vacío.`,
          category: 'accesibilidad',
          severity: 'medium',
          component: 'img',
          line: imagesWithoutAlt.map(item => item.line).slice(0, 10).join(', '),
          state: 'Lectura del contenido',
          steps: `Revisar las imágenes indicadas en ${page.sourceFile}.`,
          expected: 'Cada imagen debe tener alt descriptivo o alt="" si es decorativa.',
          actual: 'El atributo alt no está presente.',
          evidence: imagesWithoutAlt.slice(0, 10).map(item => `${item.raw}:${item.line}`).join(' · '),
          consequence: 'El contenido o la intención decorativa no se comunica correctamente a lectores de pantalla.',
          testName: 'Texto alternativo de imágenes',
          correctionLocation: `${page.sourceFile}:${imagesWithoutAlt[0].line}`,
          solutionStatus: 'known',
          suggestion: 'Agregar un alt apropiado según la función real de cada imagen.'
        }));
      }
      const buttonsWithoutType = (page.buttons || []).filter(button => !button.type);
      if (buttonsWithoutType.length) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Botones sin tipo explícito',
          description: `${buttonsWithoutType.length} botón(es) dependen del tipo predeterminado del navegador.`,
          category: 'código',
          severity: 'minimal',
          component: buttonsWithoutType[0].id ? `#${buttonsWithoutType[0].id}` : 'button',
          line: buttonsWithoutType.map(item => item.line).slice(0, 10).join(', '),
          state: 'Interacción con formularios',
          steps: `Buscar los botones indicados en ${page.sourceFile}.`,
          expected: 'Cada botón debe declarar type="button" o type="submit".',
          actual: 'El atributo type no está presente.',
          evidence: `Primer caso en línea ${buttonsWithoutType[0].line}.`,
          consequence: 'Dentro de un formulario podría enviar datos sin intención.',
          testName: 'Tipos explícitos de botones',
          correctionLocation: `${page.sourceFile}:${buttonsWithoutType[0].line}`,
          solutionStatus: 'known',
          suggestion: 'Declarar el tipo correcto de cada botón.'
        }));
      }
      const unnamedButtons = (page.buttons || []).filter(button =>
        !button.text && !button.ariaLabel && !button.title
      );
      if (unnamedButtons.length) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Botones sin nombre accesible comprobable',
          description: `${unnamedButtons.length} botón(es) no tienen texto, aria-label ni title en el HTML.`,
          category: 'accesibilidad',
          severity: 'medium',
          component: unnamedButtons[0].id ? `#${unnamedButtons[0].id}` : 'button',
          line: unnamedButtons.map(item => item.line).slice(0, 10).join(', '),
          state: 'Navegación por teclado o lector de pantalla',
          steps: `Revisar los botones indicados en ${page.sourceFile}.`,
          expected: 'Cada botón debe exponer un nombre accesible.',
          actual: 'No se encontró texto ni atributo que comunique su propósito.',
          evidence: unnamedButtons.slice(0, 10).map(item => `#${item.id || 'sin-id'}:${item.line}`).join(' · '),
          consequence: 'Una persona que usa lector de pantalla puede no saber qué acción ejecuta el control.',
          testName: 'Nombre accesible de botones',
          correctionLocation: `${page.sourceFile}:${unnamedButtons[0].line}`,
          solutionStatus: 'known',
          suggestion: 'Agregar texto visible o aria-label que describa la acción.'
        }));
      }
      const unnamedLinks = (page.links || []).filter(link =>
        link.raw &&
        !link.text &&
        !link.ariaLabel &&
        !link.title &&
        !link.imageAlt
      );
      if (unnamedLinks.length) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Enlaces sin nombre accesible comprobable',
          description: `${unnamedLinks.length} enlace(s) no contienen texto ni una etiqueta accesible.`,
          category: 'accesibilidad',
          severity: 'medium',
          component: unnamedLinks[0].id ? `#${unnamedLinks[0].id}` : 'a[href]',
          line: unnamedLinks.map(item => item.line).slice(0, 10).join(', '),
          state: 'Navegación por teclado o lector de pantalla',
          steps: `Revisar los enlaces indicados en ${page.sourceFile}.`,
          expected: 'Cada enlace debe comunicar su destino o acción.',
          actual: 'No se encontró nombre accesible en el HTML.',
          evidence: unnamedLinks.slice(0, 10).map(item => `${item.raw}:${item.line}`).join(' · '),
          consequence: 'El destino puede resultar incomprensible para tecnologías de asistencia.',
          testName: 'Nombre accesible de enlaces',
          correctionLocation: `${page.sourceFile}:${unnamedLinks[0].line}`,
          solutionStatus: 'known',
          suggestion: 'Agregar texto visible, aria-label o una imagen con alt apropiado.'
        }));
      }
      if (page.metadata.h1Count !== 1) {
        findings.push(pageFinding(page, {
          testId: base,
          title: 'Jerarquía principal de encabezados inconsistente',
          description: 'La página no contiene exactamente un encabezado H1.',
          category: 'estructura',
          severity: 'minimal',
          component: 'h1',
          line: page.metadata.h1Lines?.join(', ') || 'No determinado',
          state: 'Contenido inicial',
          steps: `Contar los elementos h1 de ${page.sourceFile}.`,
          expected: 'Un H1 principal.',
          actual: `Se detectaron ${page.metadata.h1Count}.`,
          evidence: `Conteo estático: ${page.metadata.h1Count}.`,
          consequence: 'La estructura del contenido puede ser menos clara para navegación asistida y buscadores.',
          testName: 'Jerarquía de encabezados',
          correctionLocation: page.sourceFile,
          solutionStatus: 'possible',
          suggestion: 'Revisar la jerarquía semántica y conservar un encabezado principal cuando corresponda.'
        }));
      }
    }

    for (const file of manifest.files || []) {
      const isImage = /\.(?:png|jpe?g|webp|gif)$/i.test(file.path);
      const isCode = /\.(?:js|css)$/i.test(file.path);
      const isMarkup = /\.html$/i.test(file.path);
      const threshold = isImage
        ? 900 * 1024
        : isCode
          ? 450 * 1024
          : isMarkup
            ? 450 * 1024
            : Infinity;
      if (file.bytes <= threshold) continue;
      findings.push(createFinding({
        testId: 'technical.asset-size',
        title: isImage
          ? 'Imagen excesivamente pesada'
          : isMarkup
            ? 'Documento HTML excesivamente pesado'
            : 'Recurso de código excesivamente pesado',
        description: 'El tamaño supera el criterio definido por el diagnóstico.',
        category: 'rendimiento',
        severity: file.bytes > threshold * 2 ? 'medium' : 'low',
        page: 'Plataforma completa',
        route: 'No determinado',
        component: isImage ? 'Imagen' : isMarkup ? 'Documento HTML' : 'Recurso estático',
        file: file.path,
        state: 'Descarga inicial o diferida',
        steps: `Solicitar ${file.path} y revisar su tamaño transferible.`,
        expected: `Tamaño inferior a ${Math.round(threshold / 1024)} KB.`,
        actual: `${Math.round(file.bytes / 1024)} KB.`,
        evidence: `${file.bytes} bytes registrados en el manifiesto con SHA-256 ${file.sha256.slice(0, 16)}…`,
        consequence: 'Puede aumentar el tiempo de carga y el consumo de datos.',
        testName: 'Umbral verificable de peso de recursos',
        correctionLocation: file.path,
        solutionStatus: 'possible',
        suggestion: isImage
          ? 'Evaluar compresión, dimensiones y formatos modernos sin perder calidad necesaria.'
          : isMarkup
            ? 'Revisar si secciones internas pueden cargarse bajo demanda sin cambiar su funcionamiento.'
          : 'Revisar división, carga diferida y código no requerido en la carga inicial.'
      }));
    }
    for (const module of (manifest.modules || []).filter(item => item.syntax && !item.syntax.ok)) {
      findings.push(createFinding({
        testId: 'technical.module-syntax',
        title: 'Error de sintaxis en módulo JavaScript',
        description: 'Un archivo JavaScript inventariado no superó el análisis de sintaxis.',
        category: 'código',
        severity: 'critical',
        page: 'Plataforma completa',
        route: 'No determinado',
        component: module.path,
        file: module.path,
        state: 'Carga o compilación',
        steps: `Ejecutar node --check ${module.path}.`,
        expected: 'El archivo debe analizarse sin errores.',
        actual: module.syntax.error,
        evidence: `SHA-256 ${module.sha256}.`,
        consequence: 'Las páginas que cargan el módulo pueden dejar de funcionar.',
        testName: 'Análisis de sintaxis JavaScript',
        correctionLocation: module.path,
        solutionStatus: 'known',
        suggestion: 'Corregir la sintaxis informada antes de publicar.'
      }));
    }
    test('technical.module-syntax');
    test('technical.asset-size');
    for (const read of manifest.firestore?.unboundedReads || []) {
      findings.push(createFinding({
        testId: 'technical.unbounded-firestore-read',
        title: 'Lectura de colección sin límite estático comprobable',
        description: 'La llamada observada consulta o escucha una colección directamente, sin un limit visible en la expresión.',
        category: 'rendimiento',
        severity: 'low',
        confirmation: 'manual',
        page: 'Plataforma completa',
        route: 'No determinado',
        component: `${read.operation}(${read.collection})`,
        file: read.file,
        line: read.line,
        state: 'Carga o actualización de datos',
        steps: `Revisar ${read.file}:${read.line} y medir cuántos documentos puede devolver ${read.collection}.`,
        expected: 'Las colecciones con crecimiento continuo deben tener un límite, paginación o una justificación documentada.',
        actual: 'No se detectó un límite en la expresión estática.',
        evidence: `${read.operation} sobre ${read.collection} en ${read.file}:${read.line}.`,
        consequence: 'Con muchos registros podría aumentar el tiempo, las lecturas y la memoria utilizada.',
        testName: 'Detección estática de lecturas sin límite',
        correctionLocation: `${read.file}:${read.line}`,
        locationCertainty: 'confirmed',
        solutionStatus: 'requires-investigation',
        suggestion: 'Medir el volumen real y confirmar si la colección necesita paginación. No cambiar la consulta sin revisar el flujo completo.'
      }));
    }
    test('technical.unbounded-firestore-read');
    for (const call of manifest.apiCalls || []) {
      coverage.push(createCoverageItem({
        id: `api-call-${stableHash(`${call.file}:${call.line}:${call.target}`)}`,
        kind: 'api-integration',
        label: `${call.method} ${call.target}`,
        target: `${call.file}:${call.line}`,
        status: 'not-available',
        reason: 'La integración fue inventariada, pero no se invoca automáticamente porque podría enviar datos, registrar actividad o activar un webhook.',
        requiredPermission: 'Entorno de pruebas y contrato conocido',
        testId: 'technical.api-calls'
      }));
    }
    test('technical.api-calls');
  }

  if (modeIncludes(scope.mode, 'functional')) {
    for (const page of pages) {
      const testId = `functional.control-connections.${page.path}`;
      test(testId);
      const uncertain = (page.buttons || []).filter(button =>
        button.id &&
        button.type !== 'submit' &&
        !button.inlineHandler &&
        !Object.keys(button.dataAction || {}).length &&
        !button.hasSourceReference
      );
      for (const button of uncertain.slice(0, 20)) {
        findings.push(pageFinding(page, {
          testId,
          title: 'Botón sin conexión estática comprobable',
          description: 'No se encontró una referencia directa, acción declarativa ni manejador inline para este botón.',
          category: 'funcional',
          severity: 'low',
          confirmation: 'manual',
          component: `#${button.id}`,
          line: button.line,
          state: 'Interacción',
          steps: `Abrir /${page.path}, localizar #${button.id} y comprobar su acción esperada.`,
          expected: 'El botón debe ejecutar una acción observable o estar intencionalmente deshabilitado.',
          actual: 'El análisis estático no pudo confirmar ninguna conexión.',
          evidence: `ID #${button.id} sin referencia directa en los módulos JavaScript inventariados.`,
          consequence: 'Podría tratarse de un botón sin funcionamiento o de un listener delegado no detectable estáticamente.',
          testName: 'Cruce de controles HTML y referencias JavaScript',
          correctionLocation: `${page.sourceFile}:${button.line}`,
          locationCertainty: 'probable',
          solutionStatus: 'requires-investigation',
          suggestion: 'Requiere verificación manual. No modificar hasta confirmar la interacción en un entorno seguro.'
        }));
      }
      coverage.push(createCoverageItem({
        id: `runtime-${page.path}`,
        kind: 'functional-state',
        label: 'Estados dinámicos y acciones reales',
        target: page.path,
        status: 'not-available',
        reason: 'No se ejecutan scripts ni acciones que puedan escribir datos desde el diagnóstico de producción.',
        requiredPermission: page.requiresAuth ? page.roles.join(', ') : 'No requerido',
        testId: testId
      }));
    }
  }

  if (modeIncludes(scope.mode, 'role')) {
    test('role.static-matrix');
    const selectedRole = scope.role || 'superadmin';
    for (const page of manifest.pages) {
      const allowed = page.roles.includes(selectedRole);
      coverage.push(createCoverageItem({
        id: `role-page-${selectedRole}-${page.path}`,
        kind: 'role-route',
        label: `${page.label} para ${selectedRole}`,
        target: page.path,
        status: allowed ? 'partial' : 'intentional',
        reason: allowed
          ? 'La matriz inventariada permite el rol; la navegación se revisa sin ejecutar acciones mutables.'
          : 'La ruta no está destinada a este rol según la matriz inventariada.',
        requiredPermission: page.roles.join(', '),
        testId: 'role.static-matrix',
        role: selectedRole
      }));
    }
    coverage.push(createCoverageItem({
      id: `role-runtime-${selectedRole}`,
      kind: 'role-state',
      label: `Ejecución real como ${selectedRole}`,
      target: 'Panel y rutas protegidas',
      status: selectedRole === 'superadmin' ? 'partial' : 'not-available',
      reason: selectedRole === 'superadmin'
        ? 'La identidad actual confirma Super Admin, pero no se ejecutan acciones mutables.'
        : 'El diagnóstico no suplanta identidades ni permisos. Solo compara configuración estática.',
      requiredPermission: selectedRole,
      testId: 'role.static-matrix',
      role: selectedRole
    }));
    coverage.push(createCoverageItem({
      id: `role-backend-${selectedRole}`,
      kind: 'role-backend',
      label: `Comparación efectiva frontend/backend para ${selectedRole}`,
      target: 'Permisos, reglas y acciones',
      status: 'partial',
      reason: 'Se comparan las reglas y referencias inventariadas, pero no se suplanta una identidad ni se intentan escrituras prohibidas en producción.',
      requiredPermission: `Cuenta de prueba aislada con rol ${selectedRole}`,
      testId: 'role.static-matrix',
      role: selectedRole
    }));
  }

  if (modeIncludes(scope.mode, 'visual')) {
    for (const page of pages) {
      coverage.push(createCoverageItem({
        id: `visual-dynamic-${page.path}`,
        kind: 'visual-state',
        label: 'Estados visuales creados por JavaScript',
        target: page.path,
        status: 'partial',
        reason: 'La inspección visual segura carga HTML y CSS, pero bloquea scripts y no inventa estados dinámicos.',
        requiredPermission: page.requiresAuth ? page.roles.join(', ') : 'No requerido',
        testId: `visual.safe-frame.${page.path}`
      }));
    }
  }

  if (modeIncludes(scope.mode, 'data')) {
    coverage.push(createCoverageItem({
      id: 'data-sampling',
      kind: 'database',
      label: 'Integridad completa de todos los registros',
      target: 'Firestore',
      status: 'partial',
      reason: 'Se usan muestras limitadas de solo lectura para no descargar datos personales ni ejecutar consultas sin límite.',
      requiredPermission: 'superadmin',
      testId: 'data.readonly-samples'
    }));
  }

  return {
    pages,
    findings: dedupeFindings(findings),
    coverage,
    completedTests: [...completedTests]
  };
}

export function compareReports(current, previous) {
  if (!previous) {
    current.findings = current.findings.map(item => ({ ...item, recurrence: 'new', severityChange: 'new' }));
    current.resolved = [];
    current.notReverified = [];
    return current;
  }
  const previousActive = [
    ...(previous.findings || []),
    ...(previous.notReverified || [])
  ].filter((item, index, items) =>
    items.findIndex(candidate => candidate.fingerprint === item.fingerprint) === index
  );
  const previousMap = new Map(previousActive.map(item => [item.fingerprint, item]));
  const currentMap = new Map((current.findings || []).map(item => [item.fingerprint, item]));
  const completed = new Set(current.completedTests || []);
  current.findings = current.findings.map(item => ({
    ...item,
    recurrence: previousMap.has(item.fingerprint) ? 'recurrent' : 'new',
    detectedAt: previousMap.has(item.fingerprint)
      ? (previousMap.get(item.fingerprint).detectedAt || item.detectedAt)
      : item.detectedAt,
    severityChange: previousMap.has(item.fingerprint)
      ? (
          SEVERITY_ORDER[item.severity] < SEVERITY_ORDER[previousMap.get(item.fingerprint).severity]
            ? 'increased'
            : SEVERITY_ORDER[item.severity] > SEVERITY_ORDER[previousMap.get(item.fingerprint).severity]
              ? 'decreased'
              : 'unchanged'
        )
      : 'new',
    lastConfirmedAt: item.detectedAt
  }));
  current.resolved = [];
  current.notReverified = [];
  for (const old of previousActive) {
    if (currentMap.has(old.fingerprint)) continue;
    const target = completed.has(old.testId) ? current.resolved : current.notReverified;
    target.push({
      ...old,
      confirmation: completed.has(old.testId) ? 'no-longer-detected' : 'not-reverified',
      noLongerDetectedAt: completed.has(old.testId) ? current.generatedAt : null,
      lastConfirmedAt: old.lastConfirmedAt || old.detectedAt
    });
  }
  return current;
}

export function summarizeReport(report) {
  const counts = {
    total: 0,
    confirmed: 0,
    manual: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    minimal: 0,
    new: 0,
    recurrent: 0,
    increased: 0,
    decreased: 0,
    resolved: (report.resolved || []).length,
    notReverified: (report.notReverified || []).length
  };
  for (const item of report.findings || []) {
    counts.total += 1;
    if (item.confirmation === 'confirmed') counts.confirmed += 1;
    if (item.confirmation === 'manual') counts.manual += 1;
    if (counts[item.severity] !== undefined) counts[item.severity] += 1;
    if (counts[item.recurrence] !== undefined) counts[item.recurrence] += 1;
    if (counts[item.severityChange] !== undefined) counts[item.severityChange] += 1;
  }
  return counts;
}
