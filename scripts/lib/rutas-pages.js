'use strict';

const fs = require('node:fs');
const path = require('node:path');

function documentRoutes(file) {
  if (file === 'index.html') return ['/', '/index.html'];
  return [`/${path.basename(file, '.html')}`, `/${file}`];
}

// Sólo estos aliases conocidos comparten una regla; no ampliar a /* o /api/*.
function functionRoutes(root) {
  const html = fs.readdirSync(root).filter(file => file.endsWith('.html') && !/^google[a-f0-9]+\.html$/i.test(file));
  const documents = html.flatMap(documentRoutes).map(route =>
    /^\/(404|nosotros)(?:\.html)?$/.test(route) ? route.replace(/(?:\.html)?$/, '*') : route);
  const api = fs.readdirSync(path.join(root, 'functions/api')).filter(file => file.endsWith('.js'))
    .map(file => `/api/${file.slice(0, -3)}`);
  const include = [...new Set([...documents, ...api, '/__/auth/*',
    '/products/*', '/collections/*', '/pages/*', '/policies/*',
    '/robots.txt', '/sitemap-products.xml', '/sitemap-collections.xml'])].sort();
  if (include.length > 100) throw new Error(`Pages Functions supera el límite de 100 reglas: ${include.length}. Revisar rutas sin ampliar el alcance del middleware.`);
  return { version: 1, include, exclude: [] };
}

module.exports = { documentRoutes, functionRoutes };
