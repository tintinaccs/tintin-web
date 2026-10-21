'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('parse5');

const BUNDLE_ID = 'tt-home-css-bundle';
const BUNDLE_FILE = 'css/generated/inicio.css';
const RECOVER = "var bundle=this;function restore(){document.querySelectorAll('link[data-tt-style-bundle]').forEach(function(link){if(link.dataset.ttStyleBundle===bundle.id){link.disabled=false;link.rel='stylesheet';delete link.dataset.ttStyleBundle;}});}bundle.dataset.ttBundleError='1';restore();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});";

function restoreStyleSources(html, bundleId = BUNDLE_ID) {
  return html.replace(new RegExp(`\\s*<link\\b(?=[^>]*\\bid=["']${bundleId}["'])[^>]*>\\s*`, 'gi'), '\n  ')
    .replace(/<link\b[^>]*>/gi, tag => {
    if (!new RegExp(`\\bdata-tt-style-bundle=["']${bundleId}["']`).test(tag)) return tag;
    return tag.replace(/\s+data-tt-style-bundle=["'][^"']*["']/g, '').replace(/\s+disabled(?:=["'][^"']*["'])?/g, '')
      .replace(/\brel=(["'])tt-bundled-stylesheet\1/i, 'rel=$1stylesheet$1');
  });
}

function rebaseCss(css, file) {
  if (/^\s*@(import|namespace)\b/m.test(css)) throw new Error(`CSS no combinable sin resolver @import/@namespace: ${file}`);
  return css.replace(/^\s*@charset\s+["'][^"']+["'];?/i, '')
    .replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)/gi, (source, quote, quoted, unquoted) => {
      const value = (quoted ?? unquoted).trim();
      if (!value || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) return source;
      const url = new URL(value, `https://tintin-build.invalid/${file}`);
      return `url("${url.pathname}${url.search}${url.hash}")`;
    });
}

function bundleHomeStyles(markup, readStyle, options = {}) {
  const bundleId = options.id || BUNDLE_ID;
  const bundleFile = options.file || BUNDLE_FILE;
  const versionPrefix = options.versionPrefix || 'tintin-home';
  const html = restoreStyleSources(markup, bundleId);
  const document = parse(html, { sourceCodeLocationInfo: true });
  const entries = [];
  function visit(node, inHead = false) {
    inHead ||= node.tagName === 'head';
    if (inHead && node.tagName === 'link') {
      const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      if (attrs.rel === 'stylesheet' && attrs.disabled === undefined && attrs.href && !/^(?:[a-z]+:|\/\/)/i.test(attrs.href)) {
        const url = new URL(attrs.href, 'https://tintin-build.invalid/');
        if (url.pathname.endsWith('.css')) entries.push({
          start: node.sourceCodeLocation.startOffset,
          end: node.sourceCodeLocation.endOffset,
          file: decodeURIComponent(url.pathname.slice(1)),
          media: attrs.media || '',
          tag: html.slice(node.sourceCodeLocation.startOffset, node.sourceCodeLocation.endOffset),
        });
      }
    }
    node.childNodes?.forEach(child => visit(child, inHead));
  }
  visit(document);
  if (!entries.length) throw new Error('La página no contiene hojas de estilo locales.');
  const css = entries.map(entry => {
    const source = rebaseCss(readStyle(entry.file), entry.file);
    return `/* ${entry.file} */\n${entry.media ? `@media ${entry.media} {\n${source}\n}` : source}`;
  }).join('\n\n').trimEnd() + '\n';
  const version = `${versionPrefix}-${crypto.createHash('sha256').update(css).digest('hex').slice(0, 16)}`;
  let result = html;
  for (const entry of [...entries].reverse()) {
    // Conserva IDs y versiones para los runtimes sin descargar otra vez cada hoja.
    const marker = entry.tag.replace(/\brel=(["'])stylesheet\1/i, 'rel=$1tt-bundled-stylesheet$1')
      .replace(/\s*\/?>$/, ` disabled data-tt-style-bundle="${bundleId}">`);
    const bundle = entry === entries[0]
      ? `<link rel="stylesheet" id="${bundleId}" href="${bundleFile}?v=${version}" onerror="${RECOVER}">\n  ` : '';
    result = result.slice(0, entry.start) + bundle + marker + result.slice(entry.end);
  }
  return { html: result, css, version, entries };
}

function writeHomeStyles(html, root, options = {}) {
  const bundle = bundleHomeStyles(html, file => {
    const resolved = path.resolve(root, file);
    if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`CSS fuera del proyecto: ${file}`);
    return fs.readFileSync(resolved, 'utf8').replace(/\r\n?/g, '\n');
  }, options);
  const destination = path.join(root, options.file || BUNDLE_FILE);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== bundle.css) fs.writeFileSync(destination, bundle.css);
  return bundle.html;
}

module.exports = { bundleHomeStyles, restoreStyleSources, rebaseCss, writeHomeStyles, BUNDLE_ID, BUNDLE_FILE };
