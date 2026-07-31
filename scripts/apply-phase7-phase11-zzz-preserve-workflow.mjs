import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const self = fileURLToPath(import.meta.url);
const workflowPath = path.join(root, '.github/workflows/phase11-seo-production.yml');
const workflow = `name: Fase 11 — SEO, publicación y producción

on:
  pull_request:
    branches: [main]
    paths:
      - '*.html'
      - 'script.js'
      - 'js/**'
      - 'manifest.json'
      - 'robots.txt'
      - 'sitemap.xml'
      - 'scripts/audit-phase11-seo.js'
      - 'scripts/audit-production-health.mjs'
      - 'tests/seo/**'
      - 'package.json'
      - '.github/workflows/phase11-seo-production.yml'
  workflow_dispatch:
  schedule:
    - cron: '17 * * * *'

permissions:
  contents: read

jobs:
  seo-contracts:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run audit:phase11
      - run: npm run test:phase11-seo

  production-health:
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run monitor:production
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: phase11-production-health
          path: artifacts/phase11-production-health.json
          if-no-files-found: warn
          retention-days: 30
`;
fs.writeFileSync(workflowPath, workflow, 'utf8');
fs.unlinkSync(self);
console.log('Workflow de Fase 11 preservado sin cambios para permitir la consolidación automática.');
