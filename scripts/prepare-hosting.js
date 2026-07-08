const fs = require('fs');
const path = require('path');

const root = process.cwd();
const out = path.join(root, 'public');

const allowedTopLevelFiles = [
  'index.html',
  '404.html',
  'about.html',
  'admin-images.html',
  'admin.html',
  'cambios-devoluciones.html',
  'catalogo.html',
  'checkout.html',
  'collections.html',
  'contact.html',
  'envios.html',
  'login.html',
  'nosotros.html',
  'perfil.html',
  'preguntas-frecuentes.html',
  'privacidad.html',
  'product.html',
  'producto.html',
  'terminos.html',
  'apple-touch-icon.png',
  'favicon.ico',
  'site.webmanifest',
  'manifest.json'
];

const allowedDirs = [
  'assets-tintin',
  'css',
  'images',
  'js'
];

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

removeDir(out);
fs.mkdirSync(out, { recursive: true });

for (const file of allowedTopLevelFiles) {
  copyFile(path.join(root, file), path.join(out, file));
}

for (const dir of allowedDirs) {
  copyDir(path.join(root, dir), path.join(out, dir));
}

console.log('Firebase Hosting preparado en /public');
