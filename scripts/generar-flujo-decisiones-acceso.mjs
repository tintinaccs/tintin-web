import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sources = [
  ['login.html', ['ensureProfileComplete', 'redirectByRole', 'getProfileCompletionPlan']],
  ['js/core/store/perfil-usuario.js', ['profileStatus', 'Google Sheets en este proyecto sincroniza productos, no usuarios']],
  ['js/pages/profile/configuracion-inicial-perfil.mjs', ['getProfileCompletionPlan', "profileStatus = 'active'"]],
  ['functions/api/email-otp-send.js', ['resolveEmailFromUsernameKey']],
  ['cloudflare/firebase-admin-ligero.js', ['usernameReservations', 'users']]
];
const verified = [];
for (const [file, tokens] of sources) {
  const content = await readFile(resolve(root, file), 'utf8');
  const missing = tokens.filter(token => !content.includes(token));
  if (missing.length) throw new Error(`El flujo Acceso y perfil ya no coincide con ${file}: falta ${missing.join(', ')}`);
  verified.push({ file, tokens });
}
const output = {
  schemaVersion: 1,
  generatedBy: 'scripts/generar-flujo-decisiones-acceso.mjs',
  authority: { sourceOfTruth: 'Firestore', sheets: 'presentación/sincronización de productos; no decide acceso', admin: 'presentación y edición gobernada' },
  verified,
  tabs: [{ id: 'acceso-perfil', label: 'Acceso y perfil', status: 'verified' }]
};
const target = resolve(root, 'data/flujo-decisiones-acceso.json');
const serialized = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8');
  if (current !== serialized) throw new Error('data/flujo-decisiones-acceso.json está desactualizado. Ejecutá npm run build:decision-flows.');
} else await writeFile(target, serialized);
