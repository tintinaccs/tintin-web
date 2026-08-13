#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = 'css/admin/visual-studio-v2.css';
const file = path.join(ROOT, rel);
let text = fs.readFileSync(file, 'utf8');
const before = '.visual-studio-v2 .visual-preview-stage iframe{flex:0 0 auto;margin-inline:auto;height:100%;min-height:680px;max-height:none;border:1px solid #d8d9dc;';
const after = '.visual-studio-v2 .visual-preview-stage iframe{box-sizing:content-box;flex:0 0 auto;margin-inline:auto;height:100%;min-height:680px;max-height:none;border:1px solid #d8d9dc;';
const count = text.split(before).length - 1;
if (count !== 1) throw new Error(`Se esperaba 1 iframe base y se encontraron ${count}.`);
text = text.replace(before, after);
fs.writeFileSync(file, text, 'utf8');
console.log('iframe configurado con box-sizing:content-box');
