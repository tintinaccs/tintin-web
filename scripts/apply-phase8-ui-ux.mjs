import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`No se encontró el contrato para ${label}.`);
  return source.replace(before, after);
}

// 1. El runtime se carga directamente desde page-loader para evitar volver a
// cargar el paquete ui-quality completo en público (incidente histórico #86).
{
  const file = 'js/page-loader.js';
  let source = read(file);
  source = replaceOnce(
    source,
    "  const TT_CACHE_VERSION = 'tintin-20260730-appcheck-stable-4';",
    "  const TT_CACHE_VERSION = 'tintin-20260730-phase8-ui-1';",
    'actualizar la versión del runtime global'
  );
  source = replaceOnce(
    source,
    "  function bootPageAuditFixPublic() {\n    if (!window.TintinPageAuditFixBooted) {\n      importSibling('page-audit-fix.js', 'Page Audit Fix');\n    }\n  }",
    "  function bootPageAuditFixPublic() {\n    if (!window.TintinPageAuditFixBooted) {\n      importSibling('page-audit-fix.js', 'Page Audit Fix');\n    }\n  }\n\n  function bootPhase8UiUx() {\n    if (!document.getElementById('tt-phase8-ui-ux-css')) {\n      const link = document.createElement('link');\n      link.id = 'tt-phase8-ui-ux-css';\n      link.rel = 'stylesheet';\n      link.href = resolveAsset('css/phase8-ui-ux.css');\n      document.head.appendChild(link);\n    }\n    if (!window.TintinUX?.booted) {\n      importSibling('phase8-ui-ux.js', 'Phase 8 UI/UX');\n    }\n  }",
    'registrar el runtime de Fase 8'
  );
  source = replaceOnce(
    source,
    "    bootImagePerformance();\n    bootSiteActivity();\n  }",
    "    bootImagePerformance();\n    bootSiteActivity();\n    bootPhase8UiUx();\n  }",
    'cargar Fase 8 en páginas con guard propio'
  );
  source = replaceOnce(
    source,
    "    bootThemeColorSanitizerPublic();\n    bootPageAuditFixPublic();\n\n    documentElement.classList.remove",
    "    bootThemeColorSanitizerPublic();\n    bootPageAuditFixPublic();\n    bootPhase8UiUx();\n\n    documentElement.classList.remove",
    'cargar Fase 8 en páginas públicas'
  );
  write(file, source);
}

// 2. Forzar una URL nueva del page-loader en todo HTML para que Cloudflare no
// sirva la copia inmutable anterior.
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  let source = read(file);
  const next = source.replace(
    /js\/page-loader\.js\?v=tintin-20260730-appcheck-stable-4/g,
    'js/page-loader.js?v=tintin-20260730-phase8-ui-1'
  );
  if (next !== source) write(file, next);
}

// 3. Registrar la auditoría dentro del cierre integral.
{
  const file = 'package.json';
  const pkg = JSON.parse(read(file));
  pkg.scripts['audit:phase8-ui'] = 'node scripts/audit-phase8-ui-ux.js';
  pkg.scripts['test:phase8-ui'] = 'playwright test tests/ui-ux/phase8-ui-ux.spec.js --project=chromium';
  if (!pkg.scripts['audit:final'].includes('audit:phase8-ui')) {
    pkg.scripts['audit:final'] += ' && npm run audit:phase8-ui';
  }
  write(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

fs.rmSync(import.meta.filename);
console.log('Fase 8 integrada: feedback, estados, movimiento y accesibilidad globales.');
