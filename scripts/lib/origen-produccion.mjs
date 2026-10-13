import fs from 'node:fs';
import path from 'node:path';

function httpsOrigin(value, name) {
  const raw = String(value || '').replace(/\/$/, '');
  let url;
  try { url = new URL(raw); } catch { throw new Error(`${name} debe ser un origen HTTPS válido.`); }
  if (url.protocol !== 'https:' || url.origin !== raw || url.username || url.password) {
    throw new Error(`${name} debe ser un origen HTTPS sin ruta, credenciales ni parámetros.`);
  }
  return raw;
}

// El host que recibe las sondas puede seguir siendo Pages antes del corte.
// La metadata del artefacto preparado debe conservar el dominio canónico futuro.
export function resolveProductionOrigins(config, env = {}) {
  const canonicalOrigin = httpsOrigin(config.origin, 'config.public-site.origin');
  const origin = httpsOrigin(
    env.TINTIN_OPERATIONAL_ORIGIN || env.TINTIN_PUBLIC_ORIGIN || config.operationalOrigin || canonicalOrigin,
    'Origen operacional de producción',
  );
  return { origin, canonicalOrigin };
}

export function readProductionOrigins(env = process.env) {
  const config = JSON.parse(fs.readFileSync(path.resolve('config/public-site.json'), 'utf8'));
  return resolveProductionOrigins(config, env);
}
