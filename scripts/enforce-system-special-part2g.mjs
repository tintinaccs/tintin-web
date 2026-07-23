import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(root, 'artifacts', 'system-special-part2g', 'report.json');

if (!fs.existsSync(reportPath)) {
  console.error('PARTE 2G: no se generó report.json.');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const rawFailures = Array.isArray(payload.failures) ? payload.failures : [];
const states = Array.isArray(payload.report) ? payload.report : [];

const viewportSizes = {
  mini280: { width: 280, height: 653 },
  mini320: { width: 320, height: 568 },
  mobile360: { width: 360, height: 800 },
  mobile390: { width: 390, height: 844 },
  mobile430: { width: 430, height: 932 },
  'mobile-landscape': { width: 844, height: 390 },
  tablet768: { width: 768, height: 1024 },
  tablet1024: { width: 1024, height: 768 },
  desktop1280: { width: 1280, height: 720 },
  desktop1440: { width: 1440, height: 900 },
  desktop1920: { width: 1920, height: 1080 },
  desktop2560: { width: 2560, height: 1440 }
};

const stateMap = new Map(
  states.map(item => [`${item.page}|${item.viewport}|${item.state}`, item])
);
const ignored = [];

function isDocumentScrollFinding(failure) {
  if (failure?.message !== 'Hay controles fuera del alto visible y sin scroll accesible.') return false;
  if (!['404', 'catalogo'].includes(failure.page)) return false;
  const state = stateMap.get(`${failure.page}|${failure.viewport}|${failure.state}`);
  const viewport = viewportSizes[failure.viewport];
  return Boolean(state && viewport && state.metrics?.documentScrollHeight > viewport.height + 2);
}

function isScrollbarGutterFinding(failure) {
  if (failure?.message !== 'El loader no cubre el viewport completo.') return false;
  if (!String(failure.state || '').startsWith('loader-')) return false;
  const viewport = viewportSizes[failure.viewport];
  const rect = failure.data;
  if (!viewport || !rect) return false;
  return rect.left === 0 && rect.top === 0 &&
    rect.width >= viewport.width - 16 &&
    rect.height >= viewport.height - 2;
}

const failures = rawFailures.filter(failure => {
  const intentional = isDocumentScrollFinding(failure) || isScrollbarGutterFinding(failure);
  if (intentional) ignored.push(failure);
  return !intentional;
});

fs.writeFileSync(
  path.join(root, 'artifacts', 'system-special-part2g', 'report-filtered.json'),
  JSON.stringify({ ...payload, ignoredExpectedBrowserGeometry: ignored, failures }, null, 2)
);

if (failures.length) {
  console.error(`PARTE 2G: ${failures.length} problema(s) accionable(s) detectado(s).`);
  failures.forEach(item => console.error(`- [${item.page}/${item.viewport}/${item.state}] ${item.message}`));
  process.exit(1);
}

console.log(`PARTE 2G: CORRECTA · ${states.length} estados visuales validados.`);
console.log(`Geometrías esperadas clasificadas: ${ignored.length} (scroll del documento y gutter del navegador).`);
