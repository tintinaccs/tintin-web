import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync('scripts/auditar-tipografia.js','utf8');
const normalize=new Function(source.slice(source.indexOf('function normalizeFontValue'),source.indexOf('function escapeRegex'))+';return normalizeFontValue;')();
test('auditor mantiene la familia primaria al quitar comillas CSS opcionales',()=>{
 for(const value of ['Montserrat','"Montserrat"','Montserrat,sans-serif','Montserrat !important'])assert.equal(normalize(value),'Montserrat');
 for(const value of ['FuenteAjena','FuenteAjena,Montserrat','serif','OtraFamilia'])assert.notEqual(normalize(value),'Montserrat');
});
