#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'scripts', 'styles-integrity.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function sha256(relativePath) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n?/g, '\n'))
    .digest('hex');
}

const sourceSha256 = sha256(manifest.source);
const minifiedSha256 = sha256(manifest.minified);
const failures = [];
if (sourceSha256 !== manifest.sourceSha256) failures.push(`${manifest.source} cambió sin regenerar su manifiesto.`);
if (minifiedSha256 !== manifest.minifiedSha256) failures.push(`${manifest.minified} cambió sin regenerar su manifiesto.`);

if (failures.length) {
  for (const failure of failures) console.error(`ERROR — ${failure}`);
  process.exit(1);
}

console.log(`Integridad CSS verificada: ${manifest.source} ↔ ${manifest.minified}.`);
