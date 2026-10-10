import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { attachSavedLocationConfirm } from '../../js/pages/checkout/checkout-ubicacion-guardada.js';
const source=fs.readFileSync(new URL('../../checkout.html',import.meta.url),'utf8');
const start=source.indexOf("document.getElementById('btn-step2-next').onclick = () => {");
const end=source.indexOf("document.getElementById('btn-step2-back').onclick",start);
for(const method of ['delivery','encomienda']) test(`ubicación precargada bloquea avance y guardar perfil hasta confirmar: ${method}`,()=>{
  const elements=new Map(); const values={'ck-departamento':'Central','ck-city':'San Lorenzo','ck-location-name':'Casa guardada','ck-address':'Dirección de prueba','ck-referencia':'Portón negro'};
  for(const [id,value] of Object.entries(values)) elements.set(id,{value,setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){}});
  const button=()=>({onclick:null,addEventListener(type,fn){this[type]=fn;},focus(){}});
  elements.set('btn-step2-next',button());elements.set('ck-saved-location-confirm',button());
  elements.set('ck-saved-location-hint',{style:{},scrollIntoView(){}});
  const changeButton=button();
  const saved={lat:-25.3,lng:-57.6,name:'Casa guardada'};
  const controller=attachSavedLocationConfirm({card:elements.get('ck-saved-location-hint'),confirmButton:elements.get('ck-saved-location-confirm'),changeButton},saved);
  const steps=[],errors=[];let profileWrites=0;
  const context={document:{getElementById:id=>elements.get(id)},orderData:{shippingMethod:method,encomiendaMode:'puerta',mapLocation:{...saved}},currentUser:null,currentUserProfile:null,applySavedCheckoutIdentity(){},RETIRO_VALUE:'__retiro__',ENCOMIENDA_MODES:{PUERTA:'puerta',AGENCIA:'agencia'},encomiendaValidationError:()=>null,hideErrors(){},showError:(_,message)=>errors.push(message),goToStep:step=>steps.push(step),saveLocationToProfileIfChecked(){profileWrites++;},_savedLocationConfirm:controller};
  vm.runInNewContext(source.slice(start,end),context);
  const next=elements.get('btn-step2-next').onclick;
  next();assert.deepEqual(steps,[]);assert.equal(profileWrites,0);assert.match(errors[0],/Confirmá/);
  elements.get('ck-saved-location-confirm').click();next();assert.deepEqual(steps,[2]);
  controller.show(saved);assert.equal(controller.isPending(),true);next();assert.deepEqual(steps,[2]);
  controller.reset();next();assert.deepEqual(steps,[2,2]); // nueva elección explícita del mapa
});
