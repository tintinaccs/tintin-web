import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// El manifiesto canónico descubre controles del HTML. Las acciones creadas por
// JS y los estados condicionales requieren además el recorrido de navegador:
// este inventario inicial nunca se presenta como cobertura completa.
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'diagnostic-manifest.json'), 'utf8'));
const output = path.join(root, 'docs/agent/evidence/client-actions-20261012');
const pages = manifest.pages.filter(page => page.roles.includes('client'));
const actions = [];
for (const page of pages) {
  for (const [kind, elements] of [['button', page.buttons], ['control', page.controls], ['link', page.links]]) {
    for (const element of elements) {
      if (kind === 'control' && element.type === 'hidden') continue;
      if (kind === 'link' && /^\/?admin(?:[-/.?#]|$)/i.test(element.raw || '')) continue;
      const key = `${page.path}:${kind}:${element.id || element.raw || element.name || ''}:${element.line}`;
      const label = element.ariaLabel || element.text || element.title || element.name || element.id || element.tag || kind;
      actions.push({ id: createHash('sha256').update(key).digest('hex').slice(0, 16), page: page.path,
        kind, element: label, selector: element.id ? `#${element.id}` : null, href: element.raw || null,
        source: page.sourceFile, line: element.line, expected: null,
        discovery: 'canonical-html', states: [], test: null, result: 'PENDING', evidence: [] });
    }
  }
}
const inventory = { schemaVersion: 1, scope: 'client-only', discoveryComplete: false,
  sourceFingerprint: manifest.sourceFingerprint,
  limitation: 'Inventario HTML inicial: falta completar componentes dinámicos, acciones por estado, teclado/táctil y resultados por contexto. Inspección no equivale a prueba.',
  pages: pages.map(page => ({ path: page.path, source: page.sourceFile, requiresAuth: page.requiresAuth,
    actionsFound: actions.filter(action => action.page === page.path).length, approved: 0, errors: 0,
    pending: actions.filter(action => action.page === page.path).length, discovery: 'IN_PROGRESS' })), actions };
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(`Inventario HTML inicial: ${pages.length} rutas, ${actions.length} controles/enlaces. 0 aprobados automáticamente; descubrimiento dinámico pendiente.`);
