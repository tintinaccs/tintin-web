import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { shippingDepartment } from '../../js/components/location/departamento-ciudad.mjs';
import { PARAGUAY_LOCATIONS } from '../../js/components/location/ubicaciones-paraguay.js';
test('registros legacy usan el departamento real sin cambiar la configuración explícita',()=>{
  assert.equal(shippingDepartment('Pedro Juan Caballero'),'Amambay');
  assert.equal(shippingDepartment(' Encarnacion '),'Itapúa');
  assert.equal(shippingDepartment('San Lorenzo'),'Central');
  assert.equal(shippingDepartment('Fernando de la Mora Zona Norte'),'Central');
  assert.equal(shippingDepartment('Nombre comercial desconocido'),'Central');
  assert.equal(shippingDepartment('Ciudad personalizada','Itapúa'),'Itapúa');
});
test('Apps Script y web resuelven igual todas las ciudades y alias oficiales',()=>{
  const context=vm.createContext({FIRESTORE_PROJECT_ID_: "isolated-test"});vm.runInContext(fs.readFileSync(new URL('../../apps-script/CrearPedido.gs',import.meta.url),'utf8'),context);
  for(const city of [...PARAGUAY_LOCATIONS.flatMap(g=>g.ciudades),'San Lorenzo','Fernando de la Mora Zona Norte','Fernando de la Mora Zona Sur','Desconocida']) {
    assert.equal(context.phase4NormalizeDepartment_('',city),shippingDepartment(city),city);
  }
});
