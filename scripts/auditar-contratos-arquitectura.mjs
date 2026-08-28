#!/usr/bin/env node
import {
  DEFAULT_PATHS,
  auditComponentRegistrySources,
  auditDomainConsumerSources,
  auditNoDuplicateAuthoritiesSources,
  auditSyncContractSources,
  formatErrors,
  readArchitectureSources,
} from './lib/architecture-gates.mjs';

const mode = process.argv[2] || 'all';
const sources = readArchitectureSources(DEFAULT_PATHS);
const audits = {
  'domain-consumers': () => auditDomainConsumerSources(sources),
  'component-registry': () => auditComponentRegistrySources({
    contractSource: sources.visualContract,
    runtimeSource: sources.visualRuntime,
  }).errors,
  'sync-contracts': () => auditSyncContractSources(sources),
  'no-duplicate-authorities': () => auditNoDuplicateAuthoritiesSources(sources),
};

const selected = mode === 'all' ? Object.keys(audits) : [mode];
if (selected.some(name => !audits[name])) {
  console.error(`Modo desconocido: ${mode}`);
  process.exit(2);
}

let failed = false;
for (const name of selected) {
  const errors = audits[name]();
  console.log(formatErrors(`audit:${name}`, errors));
  if (errors.length) failed = true;
}
if (failed) process.exit(1);
console.log('Contratos arquitectónicos: todas las autoridades y consumidores están alineados.');
