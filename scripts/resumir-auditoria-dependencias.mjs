import fs from 'node:fs';

const files = [
  ['Completa (prod + desarrollo)', 'npm-audit-full.json'],
  ['Producción', 'npm-audit-production.json']
];

function readReport(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`No se pudo leer ${file}: ${error.message}`);
    process.exitCode = 1;
    return null;
  }
}

function counts(report) {
  const source = report?.metadata?.vulnerabilities || {};
  return {
    info: Number(source.info || 0),
    low: Number(source.low || 0),
    moderate: Number(source.moderate || 0),
    high: Number(source.high || 0),
    critical: Number(source.critical || 0),
    total: Number(source.total || 0)
  };
}

const rows = files.map(([label, file]) => {
  const report = readReport(file);
  return { label, file, ...counts(report) };
});

const lines = [
  '# Auditoría npm',
  '',
  '| Alcance | Info | Low | Moderate | High | Critical | Total |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...rows.map(row => `| ${row.label} | ${row.info} | ${row.low} | ${row.moderate} | ${row.high} | ${row.critical} | ${row.total} |`),
  '',
  'Los JSON completos se conservan como artefactos de GitHub Actions para revisión y trazabilidad.'
];

const summary = `${lines.join('\n')}\n`;
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}
