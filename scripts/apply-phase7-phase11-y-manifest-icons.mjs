import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const target = path.join(ROOT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
manifest.icons = Array.isArray(manifest.icons)
  ? manifest.icons.map(icon => ({ ...icon, src: String(icon.src || '').replace(/^\//, '') }))
  : [];
fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.unlinkSync(SELF);
console.log('Iconos PWA normalizados como recursos relativos verificables.');
