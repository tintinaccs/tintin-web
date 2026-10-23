import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { root, pages, headers, assetAllowed, renderPreview } from './lib/vista-previa.mjs';

const generated = {'__preview/client.js': 'scripts/preview-client.js', '__preview/style.css': 'scripts/preview-style.css'};
const mime = {'.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff', '.webp':'image/webp', '.gif':'image/gif', '.avif':'image/avif', '.ttf':'font/ttf'};

if (process.argv[2] === 'build') {
  // A dedicated output. Never copy functions/, production JS, env or credentials.
  const out = path.join(root, 'node_modules/.cache/tintin-preview');
  fs.rmSync(out, {recursive: true, force: true});
  fs.mkdirSync(out, {recursive: true});
  for (const page of pages) fs.writeFileSync(path.join(out, `${page}.html`), renderPreview(fs.readFileSync(path.join(root, `${page}.html`), 'utf8'), page));
  function copy(relative) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) return;
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file)) copy(`${relative}/${name}`);
    } else if (assetAllowed(relative)) {
      const target = path.join(out, relative);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(file, target);
    }
  }
  for (const relative of ['assets-tintin', 'assets', 'images', 'css', 'js/vendor/leaflet', 'styles.css', 'favicon.ico', 'favicon-32x32.png', 'favicon-16x16.png']) copy(relative);
  for (const [relative, source] of Object.entries(generated)) {
    fs.mkdirSync(path.dirname(path.join(out, relative)), {recursive: true});
    fs.copyFileSync(path.join(root, source), path.join(out, relative));
  }
  fs.copyFileSync(path.join(root, 'scripts/preview-worker.js'), path.join(out, '_worker.js'));
  fs.writeFileSync(path.join(out, '_routes.json'), JSON.stringify({version:1, include:['/*'], exclude:[]}));
  fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><html lang="es"><meta charset="utf-8"><title>Vista previa</title><p>Esta ruta no forma parte de la vista previa visual.</p><a href="/">Inicio</a></html>');
  fs.writeFileSync(path.join(out, 'preview-version.json'), JSON.stringify({mode:'visual-isolated', commit:process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || null}));
  console.log('Vista previa visual aislada: node_modules/.cache/tintin-preview (sin runtime comercial).');
} else {
  const port = Number(process.env.PORT || 4190);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT inválido');
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (!['GET', 'HEAD'].includes(request.method)) {response.writeHead(403, headers).end('Sólo vista previa visual'); return;}
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
      const page = (relative || 'index').replace(/\.html$/, '');
      if (pages.includes(page)) {
        response.writeHead(200, {...headers, 'content-type':'text/html; charset=utf-8'});
        response.end(request.method === 'HEAD' ? '' : renderPreview(fs.readFileSync(path.join(root, `${page}.html`), 'utf8'), page));
        return;
      }
      const file = path.resolve(root, generated[relative] || relative);
      if (!file.startsWith(`${root}${path.sep}`) || !assetAllowed(relative) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.realpathSync(file).startsWith(`${root}${path.sep}`)) {response.writeHead(404, headers).end('No disponible en vista previa'); return;}
      response.writeHead(200, {...headers, 'content-type':mime[path.extname(file)] || 'application/octet-stream'});
      if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
    } catch {response.writeHead(400, headers).end('Solicitud inválida');}
  });
  server.listen(port, '127.0.0.1', () => console.log(`Edición local: http://127.0.0.1:${port}/ · guardá y recargá, sin merge ni auditoría completa.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
