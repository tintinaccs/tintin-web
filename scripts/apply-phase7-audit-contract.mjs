import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'scripts/audit-site-reliability.js');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`No se encontró ${label}.`);
  source = source.replace(before, after);
}

replaceOnce(
  "const productsStore = read('js/products-store.js');\nconst loadImagesInit",
  "const productsStore = read('js/products-store.js');\nconst phase7CatalogPolicy = read('js/phase7-catalog-policy.js');\nconst loadImagesInit",
  'la carga de la política Fase 7'
);

replaceOnce(
  "check('Las recargas asíncronas no reinsertan productos agotados o sin nombre',\n  productsStore.includes('.filter(p => p.active !== false && Boolean(p.name))') &&\n  productsStore.includes('featuredProducts.slice(0, 5)') &&\n  loadImagesInit.includes('featuredProducts.slice(0, 5)') &&\n  main.includes('window.isFeaturable = isFeaturable'));",
  "check('Las recargas asíncronas no reinsertan productos agotados o sin nombre',\n  productsStore.includes('window.TintinCatalogPolicy?.isPurchasable') &&\n  phase7CatalogPolicy.includes('export function isPurchasable') &&\n  phase7CatalogPolicy.includes('p.active !== false') &&\n  phase7CatalogPolicy.includes('p.stock == null ||') &&\n  productsStore.includes('featuredProducts.slice(0, 5)') &&\n  loadImagesInit.includes('featuredProducts.slice(0, 5)') &&\n  main.includes('window.isFeaturable = isFeaturable'));",
  'el contrato histórico de recargas asíncronas'
);

fs.writeFileSync(file, source);
fs.rmSync(import.meta.filename);
console.log('Contrato de confiabilidad actualizado para la política centralizada de Fase 7.');
