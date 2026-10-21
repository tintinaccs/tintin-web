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

const {toSavedLocation}=await import('../../js/pages/profile/configuracion-inicial-perfil.mjs');
const {addAddress,MAX_SAVED_LOCATIONS}=await import('../../js/pages/profile/libreta-direcciones.mjs');
const locationStart=source.indexOf("document.getElementById('btn-guardar-ubicacion').onclick = async");
const locationEnd=source.indexOf('  // Save',locationStart);
const installLocationSave=new Function('document','auth','user','profileConfirmed','generation','profileGeneration','locationMap','toSavedLocation','addAddress','addressBook','MAX_SAVED_LOCATIONS','persistAddressBook','closeLocationEditor','toast','window',source.slice(locationStart,locationEnd));
function locationSaveFixture(persist){
 const button={disabled:false};const fields={'btn-guardar-ubicacion':button,'perfil-location-name':{value:'Casa'},'perfil-location-address':{value:'Calle 123'}};
 let point={lat:-25.3,lng:-57.6,name:'Punto'},closes=0;const auth={currentUser:{uid:'owner'}};
 installLocationSave({getElementById:id=>fields[id]},auth,{uid:'owner'},true,1,1,{getLocation:()=>point},toSavedLocation,addAddress,[],MAX_SAVED_LOCATIONS,persist,()=>{closes++;point=null;button.disabled=true;},()=>{},{TintinReleaseProfileButton:()=>{button.disabled=false;}});
 return {button,auth,fields,get closes(){return closes;}};
}
test('guardar y cerrar una dirección conserva Guardar deshabilitado después de liberar el botón',async()=>{
 let saved;const {button}=locationSaveFixture(async list=>{saved=list;});
 await button.onclick();
 assert.equal(saved[0].name,'Casa');assert.equal(saved[0].address,'Calle 123');
 assert.equal(button.disabled,true,'un editor reabierto sin punto no puede guardar');
});
test('un error de guardado conserva el punto y permite reintentar sin vaciar los campos',async()=>{
 const {button,fields}=locationSaveFixture(async()=>{throw Error('offline');});
 await button.onclick();
 assert.equal(button.disabled,false);assert.equal(fields['perfil-location-name'].value,'Casa');
 assert.equal(fields['perfil-location-address'].value,'Calle 123');
});
test('una respuesta tardía de otra cuenta no habilita el botón de la cuenta nueva',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;});const fixture=locationSaveFixture(()=>pending);const {button,auth}=fixture;
 const saving=button.onclick();auth.currentUser={uid:'other'};button.disabled=true;
 finish();await saving;assert.equal(button.disabled,true);assert.equal(fixture.closes,0);
});
