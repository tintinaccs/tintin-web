const fs = require('fs');
const path = require('path');
const root = process.cwd();
const out = path.join(root, 'public');
const { origin } = require('../config/public-site.json');
const primary = new URL(origin);
if (primary.protocol !== 'https:') throw new Error('El fallback requiere un origen canónico HTTPS.');
const font = fs.readFileSync(path.join(root,'assets-tintin/fonts/montserrat-latin-wght-normal.woff2')).toString('base64');
const logo = fs.readFileSync(path.join(root,'assets-tintin/images/general/logo.png')).toString('base64');
// GitHub Pages no ejecuta Pages Functions. No publicar una tienda aparente
// con checkout/auth rotos: este respaldo manual es exclusivamente informativo.
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Tintín — Volvemos pronto</title><link rel="canonical" href="${primary.origin}/"><style>@font-face{font-family:Montserrat;font-style:normal;font-display:swap;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format('woff2')}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fdecf2;color:#222;font:1rem/1.6 Montserrat,sans-serif}main{max-width:36rem;padding:2rem;text-align:center}img{max-width:100%;height:auto}a{display:inline-block;padding:.8rem 1.2rem;background:#fff;color:#222;border:2px solid #222;border-radius:1rem}a:focus-visible{outline:3px solid #222;outline-offset:4px}</style></head><body><main><img src="data:image/png;base64,${logo}" alt="Tintín Accesorios" width="220" height="106"><h1>Volvemos pronto</h1><p>Estamos realizando tareas de mantenimiento. Podés volver a intentar ingresar a nuestra tienda más tarde.</p><a href="${primary.origin}/">Volver a intentar</a></main></body></html>`;
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const name of ['index.html','404.html'])fs.writeFileSync(path.join(out,name),html);
fs.copyFileSync(path.join(root,'assets-tintin/fonts/OFL-1.1.txt'),path.join(out,'OFL-1.1.txt'));
console.log('Fallback informativo preparado: dos documentos autónomos, sin tienda, sesiones ni operaciones comerciales. No se publicó.');
