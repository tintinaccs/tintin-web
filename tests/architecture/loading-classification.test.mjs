import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequests } from '../../scripts/lib/clasificar-cargas.mjs';
const get = (url, extra={}) => ({method:'GET',url:'https://example.test'+url,status:200,...extra});
test('detecta dos versiones del mismo módulo y una descarga repetida exitosa',()=>{
  const rows=classifyRequests([get('/a.js?v=1'),get('/a.js?v=2'),get('/b.css'),get('/b.css')]);
  assert.deepEqual(rows.map(row=>row.classification),['conflicting_versions','repeated_success']);
});
test('clasifica preflight, retry y redirect sin equipararlos a duplicados innecesarios',()=>{
  assert.deepEqual(classifyRequests([{...get('/api/public-catalog'),method:'OPTIONS'},get('/api/public-catalog')]),[]);
  assert.equal(classifyRequests([get('/a.js',{failure:'network'}),get('/a.js')])[0].classification,'retry_or_error');
  assert.equal(classifyRequests([get('/a.js',{status:302}),get('/a.js')])[0].classification,'redirect');
});
test('no mezcla consultas de negocio ni recursos distintos para inventar duplicados',()=>{
  assert.deepEqual(classifyRequests([get('/api/public-catalog?resource=products'),get('/api/public-catalog?resource=collections'),get('/a.js'),get('/b.js')]),[]);
});
test('un script de seguridad repetido en marcos aislados conserva su clasificación necesaria',()=>{
  assert.equal(classifyRequests([get('/security.js',{frameId:1}),get('/security.js',{frameId:2})])[0].classification,'isolated_frames');
});

test('dos documentos sucesivos pueden cargar el mismo recurso sin duplicarlo dentro de una navegación',()=>{
  assert.deepEqual(classifyRequests([get('/a.js',{navigationId:1}),get('/a.js',{navigationId:2})]),[]);
});
