import fs from 'node:fs';
import path from 'node:path';

const publicSite = JSON.parse(fs.readFileSync(path.resolve('config/public-site.json'), 'utf8'));
const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || publicSite.origin || '').replace(/\/$/, '');
const expected = JSON.parse(fs.readFileSync(path.resolve('diagnostic-manifest.json'), 'utf8'));
const expectedFingerprint = String(expected.sourceFingerprint || '');
const attempts = Number(process.env.TINTIN_PRODUCTION_ARTIFACT_ATTEMPTS || 30);
const intervalMs = Number(process.env.TINTIN_PRODUCTION_ARTIFACT_POLL_MS || 15000);
const timeoutMs = Number(process.env.TINTIN_PRODUCTION_ARTIFACT_TIMEOUT_MS || 15000);

if (!origin || !expectedFingerprint) {
  throw new Error('Falta el origen público o sourceFingerprint en diagnostic-manifest.json.');
}
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 60) {
  throw new Error('TINTIN_PRODUCTION_ARTIFACT_ATTEMPTS debe ser un entero entre 1 y 60.');
}
if (!Number.isFinite(intervalMs) || intervalMs < 1000 || intervalMs > 60000) {
  throw new Error('TINTIN_PRODUCTION_ARTIFACT_POLL_MS debe estar entre 1000 y 60000.');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastFingerprint = '';
let lastError = '';
let matched = false;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const url = `${origin}/diagnostic-manifest.json?production-artifact=${encodeURIComponent(expectedFingerprint.slice(0, 16))}-${attempt}`;
    const response = await fetch(url, {
      headers: { 'cache-control': 'no-cache', pragma: 'no-cache', 'user-agent': 'TintinProductionArtifactGuard/1.0' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const actual = await response.json();
    lastFingerprint = String(actual?.sourceFingerprint || '');
    if (lastFingerprint === expectedFingerprint) {
      matched = true;
      break;
    }
    lastError = `sourceFingerprint esperado=${expectedFingerprint}, recibido=${lastFingerprint || '(ausente)'}`;
  } catch (error) {
    lastError = String(error?.message || error);
  }
  console.log(`Esperando artefacto de producción (${attempt}/${attempts}) — ${lastError}`);
  if (attempt < attempts) await sleep(intervalMs);
}

if (!matched) {
  throw new Error(`Producción no publicó el artefacto del commit auditado tras ${attempts} intentos: ${lastError}`);
}

console.log(`OK — Producción entrega el artefacto de este commit (${lastFingerprint.slice(0, 12)}).`);
