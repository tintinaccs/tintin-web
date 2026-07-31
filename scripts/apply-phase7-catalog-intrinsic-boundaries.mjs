import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = path.join(root, 'css/phase8-ui-ux.css');
const before = fs.readFileSync(cssPath, 'utf8');
const oldBlock = `/* En el catálogo móvil las tarjetas reservaban 340px de ancho por
   contain-intrinsic-size aunque cada pista real fuera mucho menor. Eso
   ampliaba el scrollWidth raíz sin que la tarjeta visible pareciera salir. */
@media (max-width: 480px) {`;
const newBlock = `/* En el catálogo de dos columnas las tarjetas reservaban 340px de ancho por
   contain-intrinsic-size aunque cada pista real fuera mucho menor. El rango
   llega hasta 820px porque a 481px y 769px todavía existen pistas angostas. */
@media (max-width: 820px) {`;
if (!before.includes(oldBlock)) throw new Error('No se encontró la protección intrínseca del catálogo.');
fs.writeFileSync(cssPath, before.replace(oldBlock, newBlock), 'utf8');
fs.unlinkSync(fileURLToPath(import.meta.url));
console.log('Reserva intrínseca del catálogo desactivada hasta 820px.');
