import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('node_modules/monaco-editor/min/vs');
const destination = path.resolve('js/vendor/monaco/vs');

try {
  if (!(await stat(source)).isDirectory()) throw new Error('origen inválido');
} catch {
  throw new Error('Monaco local no está instalado. Ejecutá npm ci antes de construir Pages.');
}

await rm(path.dirname(destination), { recursive: true, force: true });
await mkdir(path.dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`Monaco local sincronizado en ${path.relative(process.cwd(), destination)}`);
