import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {parse}=createRequire(import.meta.url)('parse5');
const root=parse(fs.readFileSync(new URL('../../perfil.html',import.meta.url),'utf8'));
const nodes=[];
function visit(node){nodes.push(node);for(const child of node.childNodes||[])visit(child);}
visit(root);
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
const find=id=>nodes.filter(n=>attr(n,'id')===id);
function panel(node){while(node && attr(node,'data-profile-panel')===undefined)node=node.parentNode;return node;}
test('Mis datos permite guardar desde el mismo panel que contiene los campos editables',()=>{
  const save=find('btn-guardar-perfil');assert.equal(save.length,1,'una sola acción canónica de guardado');
  const editable=panel(find('perfil-nombre')[0]);
  assert.equal(attr(editable,'data-profile-panel'),'datos');
  assert.equal(attr(panel(save[0]),'id'),attr(editable,'id'),'Guardar debe estar accesible mientras se editan los datos');
  assert.equal(attr(editable,'hidden'),undefined);
  assert.equal(attr(panel(find('btn-logout')[0]),'data-profile-panel'),'cuenta');
});

// Execute the page's real name-validation/update block with its real helper contract.
const {splitFullName,isValidFullName}=await import('../../js/pages/profile/configuracion-inicial-perfil.mjs');
const source=fs.readFileSync(new URL('../../perfil.html',import.meta.url),'utf8');
const start=source.indexOf('const submittedName =');
const end=source.indexOf('if (cambioUsername && nuevoUsername)',start);
const saveName=new Function('document','splitFullName','isValidFullName','toast','release','nuevoTelefono','user','serverTimestamp',source.slice(start,end)+'return updates;');
function submitted(value){
  const errors=[];let releases=0;
  const document={getElementById:id=>({value:id==='perfil-nombre'?value:''})};
  const updates=saveName(document,splitFullName,isValidFullName,message=>errors.push(message),()=>releases++,'0981123456',{email:'account@example.test'},()=> 'server-timestamp');
  return {updates,errors,releases};
}
test('Guardar usa el contrato firstName/lastName del separador real',()=>{
  const {updates,errors}=submitted('María López');
  assert.deepEqual(errors,[]);
  assert.equal(updates.name,'María López');
  assert.equal(updates.firstName,'María');assert.equal(updates.lastName,'López');
});
test('Guardar conserva el rechazo de nombre incompleto y libera el botón',()=>{
  const {updates,errors,releases}=submitted('María');
  assert.equal(updates,undefined);assert.equal(errors.length,1);assert.equal(releases,1);
});

const {normalizePhone,DEFAULT_COUNTRY,isNationalMobileInput}=await import('../../js/components/forms/utilidades-telefono.js');
const phoneStart=source.indexOf('const telefonoIngresado =',source.indexOf("document.getElementById('btn-guardar-perfil').onclick = async"));
const phoneEnd=source.indexOf('const usernameInput =',phoneStart);
const phoneBlock=new Function('document','normalizePhone','DEFAULT_COUNTRY','isNationalMobileInput','toast','release',source.slice(phoneStart,phoneEnd)+'return nuevoTelefono;');
test('Guardar conserva teléfono E164 compatible con su reserva al editar sólo el nombre',()=>{
 const value=phoneBlock({getElementById:()=>({value:'981123456'})},normalizePhone,DEFAULT_COUNTRY,isNationalMobileInput,()=>{},()=>{});
 assert.equal(value,'+595981123456');
});
