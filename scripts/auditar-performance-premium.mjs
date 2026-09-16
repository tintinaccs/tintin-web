#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
const index = read('index.html');
const nav = read('js/components/navigation/compartido/carga-navegacion.js');
const firebase = read('js/core/firebase/firebase.js');
const heroDir = path.join(root, 'assets-tintin/images/home/hero-nuevo');
for (const name of ['hero-nuevo-desktop.webp','hero-nuevo-mobile.webp','hero-nuevo-tablet-horizontal.webp','hero-nuevo-tablet-vertical.webp']) check(`hero WebP ${name}`, fs.existsSync(path.join(heroDir, name)), 'variante moderna presente');
check('picture no mezcla variantes', index.includes('type="image/webp"') && index.includes('hero-nuevo-desktop.webp'), 'WebP por dispositivo con PNG fallback');
check('responsive runtime bajo demanda', nav.includes('loadNavigationSurface') && nav.includes('currentSurface'), 'superficie actual bajo demanda');
check('resize/orientation idempotente', nav.includes('navigationBehaviorsPromise') && nav.includes('orientationchange'), 'sin listeners duplicados');
check('App Check conserva enforcement', firebase.includes('initializeAppCheck') && firebase.includes('ReCaptchaEnterpriseProvider') && firebase.includes('getAppCheckToken'), 'certificación intacta');
check('Firestore/Auth contratos intactos', firebase.includes('getFirestore(app)') && firebase.includes('getAuth(app)'), 'instancias canónicas intactas');
const failures = checks.filter(item => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'OK' : 'FAIL'} — ${item.name}: ${item.detail}`);
if (failures.length) process.exitCode = 1;
else console.log(`Premium performance deterministic gate: OK (${checks.length} checks).`);
