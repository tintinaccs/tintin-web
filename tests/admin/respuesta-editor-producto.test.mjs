import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readProductEditorResponse} from '../../js/admin/products/respuesta-editor-producto.mjs';
test('HTML, JSON inválido y confirmación incompleta fallan sin filtrar HTML',async()=>{
  for(const body of ['<!DOCTYPE html><title>Error</title>','{','null','{}','{"ok":true}']){
    await assert.rejects(()=>readProductEditorResponse(new Response(body)),error=>!/[<>]|Unexpected token|JSON/.test(error.message) && /no confirmó/.test(error.message));
  }
});
test('conserva permiso, conflicto y errores de validación sin declarar éxito',async()=>{
  for(const status of [401,403,409,422,429,503]){
    await assert.rejects(()=>readProductEditorResponse(Response.json({ok:false,error:'Validación pendiente'},{status})),error=>error.status===status && error.message==='Validación pendiente');
  }
});
test('confirmación real conserva el resultado y no admite éxito HTTP falso',async()=>{
  assert.deepEqual(await readProductEditorResponse(Response.json({ok:true,result:{revision:2}})),{ok:true,result:{revision:2}});
  await assert.rejects(()=>readProductEditorResponse(Response.json({ok:true,result:{}},{status:503})));
});
