'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');
const cssUrl = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const cssIntegrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const jsUrl = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const jsIntegrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const changed = [];

function update(relative, transform) {
  const file = path.join(root, relative);
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const after = transform(before);
  if (before === after) return;
  changed.push(relative);
  if (!checkOnly) fs.writeFileSync(file, after, 'utf8');
}

for (const file of ['checkout.html', 'login.html']) {
  update(file, text => {
    const link = `<link rel="stylesheet" href="${cssUrl}" integrity="${cssIntegrity}" crossorigin="anonymous" />`;
    return text.replace(
      new RegExp(`<link\\s+rel=["']stylesheet["']\\s+href=["']${cssUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'](?:\\s+integrity=["'][^"']+["'])?(?:\\s+crossorigin=["'][^"']*["'])?\\s*\\/?>`, 'i'),
      link
    );
  });
}

update('js/components/location/mapa-ubicacion.js', text => {
  let output = text;
  if (!output.includes('const LEAFLET_JS_INTEGRITY =')) {
    output = output.replace(
      `const LEAFLET_JS = '${jsUrl}';`,
      `const LEAFLET_JS = '${jsUrl}';\nconst LEAFLET_JS_INTEGRITY = '${jsIntegrity}';`
    );
  }
  if (!output.includes('script.integrity = LEAFLET_JS_INTEGRITY;')) {
    output = output.replace(
      '    script.src = LEAFLET_JS;\n',
      "    script.src = LEAFLET_JS;\n    script.integrity = LEAFLET_JS_INTEGRITY;\n    script.crossOrigin = 'anonymous';\n"
    );
  }
  return output;
});

if (checkOnly && changed.length) {
  console.error('ERROR — dependencias de terceros sin endurecer:');
  changed.forEach(file => console.error('- ' + file));
  process.exit(1);
}

const sourceFiles = ['checkout.html', 'login.html', 'js/components/location/mapa-ubicacion.js'];
for (const relative of sourceFiles) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  if (text.includes('unpkg.com/leaflet@') && !text.includes('leaflet@1.9.4')) {
    throw new Error(`${relative}: Leaflet debe conservar versión fija 1.9.4.`);
  }
}

if (checkOnly) console.log('OK — Leaflet 1.9.4 tiene versión fija + SRI en CSS y JS.');
else console.log(`Dependencias de terceros endurecidas (${changed.length} archivo(s) ajustados).`);
