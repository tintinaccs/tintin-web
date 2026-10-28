'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Sólo rutas obtenidas del árbol público al iniciar, nunca de una solicitud HTTP.
function indexPreviewAssets(repositoryRoot) {
  const files = new Map();
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.set('/' + path.relative(repositoryRoot, file).split(path.sep).join('/'), file);
      // Los enlaces simbólicos no forman parte del índice público.
    }
  }
  for (const folder of ['assets-tintin', 'vendor']) {
    const directory = path.join(repositoryRoot, folder);
    if (fs.existsSync(directory)) visit(directory);
  }
  return files;
}

function previewAsset(index, requestUrl) {
  try {
    const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
    return index.get(pathname);
  } catch {
    return undefined;
  }
}
module.exports = { indexPreviewAssets, previewAsset };
