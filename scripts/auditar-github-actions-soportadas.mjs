import fs from 'node:fs';
import path from 'node:path';

const workflowsDir = path.resolve('.github/workflows');
const forbidden = [
  { pattern: /actions\/setup-java@v4\b/g, replacement: 'actions/setup-java@v5' },
  { pattern: /actions\/upload-artifact@v(?:4|5)\b/g, replacement: 'actions/upload-artifact@v6' },
  { pattern: /actions\/download-artifact@v(?:4|5)\b/g, replacement: 'actions/download-artifact@v6' }
];

const files = fs.readdirSync(workflowsDir)
  .filter(name => /\.ya?ml$/i.test(name))
  .sort();

const failures = [];
for (const file of files) {
  const fullPath = path.join(workflowsDir, file);
  const text = fs.readFileSync(fullPath, 'utf8');
  for (const rule of forbidden) {
    const matches = [...text.matchAll(rule.pattern)];
    for (const match of matches) {
      const line = text.slice(0, match.index).split('\n').length;
      failures.push(`${file}:${line} usa ${match[0]}; reemplazar por ${rule.replacement}`);
    }
  }
}

if (failures.length) {
  console.error('GitHub Actions obsoletas detectadas:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`OK — ${files.length} workflows sin las Actions obsoletas bloqueadas.`);
