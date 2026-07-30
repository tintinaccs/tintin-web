import fs from 'node:fs';

const path = 'scripts/audit-phase6-security.js';
let source = fs.readFileSync(path, 'utf8');
const oldBlock = `for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (privateKeyPatterns.some(pattern => pattern.test(content))) {
    secretHits.push(path.relative(root, file));
  }
}`;
const newBlock = `const secretScanAllowlist = new Set([
  'scripts/audit-level1-foundation.js'
]);
for (const file of sourceFiles) {
  const relative = path.relative(root, file).replace(/\\\\/g, '/');
  if (secretScanAllowlist.has(relative)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (privateKeyPatterns.some(pattern => pattern.test(content))) {
    secretHits.push(relative);
  }
}`;
if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
  fs.writeFileSync(path, source);
  console.log('Escaneo de secretos ajustado para evitar fixtures de auditoría.');
} else if (source.includes("const secretScanAllowlist = new Set([")) {
  console.log('Escaneo de secretos ya estaba ajustado.');
} else {
  throw new Error('No se encontró una versión reconocible del escaneo de secretos');
}
