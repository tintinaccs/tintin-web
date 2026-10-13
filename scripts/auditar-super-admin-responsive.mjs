#!/usr/bin/env node
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(path.dirname(require.resolve('@playwright/test/package.json')),'cli.js');
// Ejecuta la implementación real del módulo y sus regresiones; todos los datos
// y las conexiones de estas pruebas están aislados de producción.
const result=spawnSync(process.execPath,[cli,'test','tests/ui-ux/admin-commerce-shopify.spec.js','tests/ui-ux/orders-board.spec.js','--project=chromium','--workers=1','--retries=0'],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exitCode=result.status ?? 1;
