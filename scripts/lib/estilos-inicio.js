'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('parse5');
const { transform } = require('lightningcss');

const BUNDLE_ID = 'tt-home-css-bundle';
const BUNDLE_FILE = 'css/generated/inicio.css';

function restoreStyleSources(html, bundleId = BUNDLE_ID) {
  // Cada tramo entre estilos no combinables usa el mismo ID con sufijo numérico.
  const ids = `${bundleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-\\d+)?`;
  return html.replace(new RegExp(`<link\\b(?=[^>]*\\bid=["']${ids}["'])[^>]*>\\n  `, 'gi'), '')
    .replace(/<link\b[^>]*>/gi, tag => {
    if (!new RegExp(`\\bdata-tt-style-bundle=["']${ids}["']`).test(tag)) return tag;
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

function segmentFile(file, index) {
  return index ? file.replace(/\.css$/, `-${index + 1}.css`) : file;
}

function bundleHomeStyles(markup, readStyle, options = {}) {
  const bundleId = options.id || BUNDLE_ID;
  const bundleFile = options.file || BUNDLE_FILE;
  const versionPrefix = options.versionPrefix || 'tintin-home';
  const html = restoreStyleSources(markup, bundleId);
  const document = parse(html, { sourceCodeLocationInfo: true });
  // Un <style> en línea o una hoja no combinable corta el tramo para conservar el orden de cascada.
  const segments = [[]];
  function cut() {
    if (segments[segments.length - 1].length) segments.push([]);
  }
  function visit(node, inHead = false) {
    inHead ||= node.tagName === 'head';
    if (inHead && node.tagName === 'style') cut();
    if (inHead && node.tagName === 'link') {
      const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      if (attrs.rel === 'stylesheet' && attrs.disabled === undefined && attrs.href) {
        const url = new URL(attrs.href, 'https://tintin-build.invalid/');
        // Las hojas con integridad (SRI) se mantienen separadas para no perder su verificación.
        if (/^(?:[a-z]+:|\/\/)/i.test(attrs.href) || attrs.integrity !== undefined || !url.pathname.endsWith('.css')) cut();
        else segments[segments.length - 1].push({
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
  const groups = segments.filter(group => group.length);
  if (!groups.length) throw new Error('La página no contiene hojas de estilo locales.');
  const bundles = groups.map((entries, index) => {
    const id = index ? `${bundleId}-${index + 1}` : bundleId;
    const file = segmentFile(bundleFile, index);
    let css = entries.map(entry => {
      const source = rebaseCss(readStyle(entry.file), entry.file);
      return `/* ${entry.file} */\n${entry.media ? `@media ${entry.media} {\n${source}\n}` : source}`;
    }).join('\n\n').trimEnd() + '\n';
    if (options.minify) css = transform({ filename: file, code: Buffer.from(css), minify: true }).code.toString() + '\n';
    const version = `${versionPrefix}-${crypto.createHash('sha256').update(css).digest('hex').slice(0, 16)}`;
    return { id, file, css, version, entries };
  });
  let result = html;
  for (const bundle of [...bundles].reverse()) {
    for (const entry of [...bundle.entries].reverse()) {
      // Conserva IDs y versiones para los runtimes sin descargar otra vez cada hoja.
      const marker = entry.tag.replace(/\brel=(["'])stylesheet\1/i, 'rel=$1tt-bundled-stylesheet$1')
        .replace(/\s*\/?>$/, ` disabled data-tt-style-bundle="${bundle.id}">`);
      const link = entry === bundle.entries[0]
        ? `<link rel="stylesheet" id="${bundle.id}" href="${bundle.file}?v=${bundle.version}">\n  ` : '';
      result = result.slice(0, entry.start) + link + marker + result.slice(entry.end);
    }
  }
  const [first] = bundles;
  return { html: result, css: first.css, version: first.version, entries: bundles.flatMap(bundle => bundle.entries), bundles };
}

function writeHomeStyles(html, root, options = {}) {
  const result = bundleHomeStyles(html, file => {
    const resolved = path.resolve(root, file);
    if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`CSS fuera del proyecto: ${file}`);
    return fs.readFileSync(resolved, 'utf8').replace(/\r\n?/g, '\n');
  }, { ...options, minify: true });
  for (const bundle of result.bundles) {
    const destination = path.join(root, bundle.file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== bundle.css) fs.writeFileSync(destination, bundle.css);
  }
  return result.html;
}

module.exports = { bundleHomeStyles, restoreStyleSources, rebaseCss, writeHomeStyles, BUNDLE_ID, BUNDLE_FILE };
