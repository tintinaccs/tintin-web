import { pathToFileURL } from 'node:url';

export const requiredStages = ['preflight', 'commerce', 'admin', 'quality', 'browser', 'rules'];
export function assertCIResults(results) {
  const failed = requiredStages.filter(name => results[name]?.result !== 'success');
  if (failed.length) throw new Error(`Validación final bloqueada: ${failed.map(name => `${name}=${results[name]?.result || 'ausente'}`).join(', ')}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertCIResults(JSON.parse(process.env.CI_NEEDS || '{}'));
  console.log('Todas las fases obligatorias terminaron correctamente.');
}
