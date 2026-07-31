import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = path.join(root, 'css/phase8-ui-ux.css');
const before = fs.readFileSync(cssPath, 'utf8');
const marker = '\n@media (prefers-reduced-motion: reduce) {';
const patch = `

/* El drawer mobile no usa 100vw: ese valor incluye la barra vertical en
   Chromium y puede superar innerWidth. El porcentaje se resuelve contra el
   viewport útil y los hijos flexibles pueden encogerse sin filtrarse. */
@media (max-width: 768px) {
  body.tt-home-premium .tt-cart-drawer {
    width: min(400px, 100%) !important;
    min-width: 0 !important;
    max-width: 100% !important;
    left: auto !important;
    right: 0 !important;
  }

  body.tt-home-premium :is(
    .tt-cart-header,
    .tt-cart-body,
    .tt-cart-footer,
    .tt-cart-item,
    .tt-cart-item-info,
    .tt-cart-total-row
  ) {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  body.tt-home-premium :is(
    .tt-cart-item-name,
    .tt-cart-empty-text,
    .tt-cart-goto-btn
  ) {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
`;
if (!before.includes(marker)) throw new Error('No se encontró el punto de inserción de CSS.');
if (before.includes('El drawer mobile no usa 100vw')) throw new Error('La corrección ya existe.');
fs.writeFileSync(cssPath, before.replace(marker, patch + marker), 'utf8');
fs.unlinkSync(fileURLToPath(import.meta.url));
console.log('Geometría del carrito mobile corregida.');
