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
const heroDir = path.join(root, 'assets-tintin/images/home/hero-editorial');
for (const name of ['backdrop.png','backdrop.webp','tintin-white.webp','watch.webp','bag.webp','necklace.webp','earrings.webp']) check(`recurso del hero ${name}`, fs.existsSync(path.join(heroDir, name)), 'marca, fondo y productos independientes presentes');
// Hero vigente (#1330): maletín PNG sin pérdida aprobado por la titular (ver hero-reference/README.md).
const heroRef = path.join(root, 'assets-tintin/images/home/hero-reference');
for (const name of ['backdrop.svg','suitcase-640.png','suitcase-960.png','suitcase.png']) check(`recurso del hero ${name}`, fs.existsSync(path.join(heroRef, name)), 'fondo y maletín de referencia presentes');
check('picture prioriza fidelidad del hero', /<link rel="preload" as="image" type="image\/png" fetchpriority="high" href="assets-tintin\/images\/home\/hero-reference\/suitcase\.png[^"]*" imagesrcset="[^"]*suitcase-640\.png/.test(index) && index.includes('hero-reference/backdrop.svg') && index.includes('class="tt-hero-suitcase"') && index.includes('class="tt-hero-brand"'), 'Maletín PNG con precarga responsive, fondo SVG y marca independiente');
check('responsive runtime bajo demanda', nav.includes('loadNavigationSurface') && nav.includes('currentSurface'), 'superficie actual bajo demanda');
check('resize/orientation idempotente', nav.includes('navigationBehaviorsPromise') && nav.includes('orientationchange'), 'sin listeners duplicados');
check('App Check conserva enforcement', firebase.includes('initializeAppCheck') && firebase.includes('ReCaptchaEnterpriseProvider') && firebase.includes('getAppCheckToken'), 'certificación intacta');
check('Firestore/Auth contratos intactos', firebase.includes('getFirestore(app)') && firebase.includes('getAuth(app)'), 'instancias canónicas intactas');
const failures = checks.filter(item => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'OK' : 'FAIL'} — ${item.name}: ${item.detail}`);
if (failures.length) process.exitCode = 1;
else console.log(`Premium performance deterministic gate: OK (${checks.length} checks).`);
