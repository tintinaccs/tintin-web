'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const rules = read('firestore.rules');
const gateCore = read('js/store-gate-core.js');
const admin = read('js/admin-app.js');

const storeRule = rules.match(/function isStoreOpenOrAllowed\(\) \{[\s\S]*?\n    \}/)?.[0] || '';
const checks = [
  ['Ausencia de storeGate no bloquea toda la tienda', storeRule.includes('!exists(/databases/$(database)/documents/settings/storeGate)')],
  ['storeGate sigue siendo la fuente pública mínima', /match \/settings\/storeGate \{[\s\S]*?allow read: if true;/.test(rules)],
  ['settings/general no queda expuesto públicamente', /match \/settings\/general \{[\s\S]*?allow read: if isStoreOpenOrAllowed\(\);/.test(rules)],
  ['El runtime consulta settings/storeGate', gateCore.includes("doc(db, 'settings', 'storeGate')")],
  ['El panel guarda general y storeGate atómicamente', admin.includes('settingsBatch.set(generalRef') && admin.includes('settingsBatch.set(storeGateRef') && admin.includes('await settingsBatch.commit();')],
  ['No se restaura el fallback legado inseguro', !storeRule.includes('settings/general')]
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\nFALLAS: ${failed}`);
  process.exit(1);
}

console.log(`\nResultado: ${checks.length}/${checks.length} comprobaciones correctas.`);
