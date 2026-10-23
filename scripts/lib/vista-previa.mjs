import fs from 'node:fs';
import path from 'node:path';
import { parse, parseFragment, serialize } from 'parse5';
import { renderDesktopHeader } from '../../js/components/navigation/escritorio/encabezado-escritorio.js';
import { renderTabletHeader } from '../../js/components/navigation/tableta/encabezado-tableta.js';
import { renderMobileBrandHeader } from '../../js/components/navigation/movil/marca-movil.js';
import { renderMobileTabbar } from '../../js/components/navigation/movil/encabezado-movil.js';
import { restoreStyleSources } from './estilos-inicio.js';

export const root = path.resolve(import.meta.dirname, '../..');
export const previewCSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; worker-src 'none'; object-src 'none'";
export const headers = {
  'content-security-policy': previewCSP,
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};
export const pages = ['index', 'checkout', 'catalogo', 'product', 'collections', 'nosotros', 'about', 'contact', 'envios', 'preguntas-frecuentes', 'cambios-devoluciones', 'privacidad', 'terminos'];
const extensions = new Set(['.css', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf']);

// A visual fixture of the actual document, not an alternate commerce runtime.
// No production controller or SDK is served, even via a direct asset URL.
export function assetAllowed(relative) {
  return relative === '__preview/client.js' || relative === '__preview/style.css' ||
    (extensions.has(path.extname(relative).toLowerCase()) &&
      /^(?:assets-tintin\/|assets\/|images\/|css\/|js\/vendor\/leaflet\/|styles\.css$|favicon)/.test(relative));
}

export function renderPreview(source, page, sourceRoot = root) {
  let markup = source;
  for (const id of ['tt-home-css-bundle', 'tt-about-css-bundle']) markup = restoreStyleSources(markup, id);
  const document = parse(markup);
  const head = document.childNodes.find(node => node.tagName === 'html').childNodes.find(node => node.tagName === 'head');
  const body = document.childNodes.find(node => node.tagName === 'html').childNodes.find(node => node.tagName === 'body');
  const localURL = value => {
    if (value.startsWith('file:')) {
      const index = value.indexOf('/js/components/');
      // Renderer logo URLs resolve relative to the canonical module.
      const asset = value.indexOf('/assets-tintin/');
      return asset >= 0 ? value.slice(asset) : index >= 0 ? value.slice(index) : '#';
    }
    return value;
  };
  function visit(node) {
    if (node.attrs) {
      node.attrs = node.attrs.filter(attr => !/^on/i.test(attr.name) && !['action', 'formaction', 'ping', 'srcdoc', 'integrity'].includes(attr.name));
      for (const attr of node.attrs) {
        if (!['href', 'src', 'poster', 'xlink:href'].includes(attr.name)) continue;
        attr.value = localURL(attr.value);
        if (node.tagName === 'a' && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(attr.value)) attr.value = '#';
        if (/^javascript:/i.test(attr.value)) attr.value = '#';
        if (attr.name === 'href' && attr.value.startsWith('styles.min.css')) attr.value = 'styles.css';
      }
      if (node.tagName === 'button') {
        node.attrs = node.attrs.filter(attr => attr.name !== 'type');
        node.attrs.push({name: 'type', value: 'button'});
      }
    }
    if (node.childNodes) {
      node.childNodes = node.childNodes.filter(child => {
        if (['script', 'iframe', 'object', 'embed', 'base'].includes(child.tagName)) return false;
        const attrs = Object.fromEntries((child.attrs || []).map(attr => [attr.name, attr.value]));
        if (child.tagName === 'meta' && attrs['http-equiv']) return false;
        if (child.tagName === 'link' && (['modulepreload', 'manifest', 'canonical', 'preconnect', 'dns-prefetch'].includes(attrs.rel) || /^https?:|^\/\//i.test(attrs.href || ''))) return false;
        return true;
      });
      node.childNodes.forEach(visit);
    }
    if (node.content) visit(node.content);
  }
  visit(document);
  // The same header renderers and stylesheet list as production and layout tests.
  const navStyles = [...fs.readFileSync(path.join(sourceRoot, 'js/components/navigation/compartido/recursos-navegacion.js'), 'utf8').matchAll(/\['tt-[^']+', '(css\/[^']+)'/g)]
    .map(([, href]) => `<link rel="stylesheet" href="/${href}">`).join('');
  const styles = parseFragment(`${navStyles}<link rel="stylesheet" href="/__preview/style.css"><script src="/__preview/client.js" defer></script>`);
  head.childNodes.push(...styles.childNodes);
  const shell = parseFragment(renderDesktopHeader() + renderTabletHeader() + renderMobileBrandHeader(`/${page}`, '/assets-tintin/images/general/logo.png'));
  visit(shell);
  body.childNodes.unshift(...shell.childNodes);
  const bottom = parseFragment(renderMobileTabbar() + `<aside id="preview-tools" aria-label="Vista previa"><strong>Vista previa visual · sin pedidos ni cuentas reales</strong><nav>${pages.slice(0, 6).map(name => `<a href="/${name === 'index' ? '' : name}">${name === 'index' ? 'Inicio' : name}</a>`).join(' ')} <button type="button" id="preview-refresh">Actualizar</button></nav><label id="preview-step-label" hidden>Paso de Checkout <select id="preview-step"><option value="0">Carrito</option><option value="1">Envío</option><option value="2">Datos</option><option value="3">Pago</option><option value="4">Confirmación</option></select></label><output id="preview-notice">Sólo diseño y contenido. La lógica comercial se verifica con pruebas aisladas.</output></aside>`);
  visit(bottom);
  body.childNodes.push(...bottom.childNodes);
  return serialize(document);
}
