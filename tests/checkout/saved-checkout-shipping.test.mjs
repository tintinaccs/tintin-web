import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('checkout.html','utf8');
const block=html.slice(html.indexOf('function applySavedCheckoutShipping()'),html.indexOf('// "Guardar esta ubicación'));
const apply=new Function('currentUserProfile','document','encomiendaModes',block+'return applySavedCheckoutShipping;');
function fixture(saved){
 const inputs={'ck-address':{value:''},'ck-referencia':{value:''}};
 const city={value:'',options:[{value:'San Lorenzo',index:0,parentElement:{id:'ck-city-delivery-group'}},{value:'San Lorenzo',index:1,parentElement:{id:'ck-city-encomienda-group'}}],onchange(){this.value=this.options[this.selectedIndex]?.value||'';}};
 const department={value:'',options:[{value:'Central'}],onchange(){city.value='';}};
 inputs['ck-departamento']=department;inputs['ck-city']=city;
 let mode='';const run=apply({checkoutDefaults:{shipping:saved}},{getElementById:id=>inputs[id]},{setMode:value=>mode=value});
 return {run,inputs,city,department,get mode(){return mode;}};
}
test('recupera dirección/referencia y selecciona la modalidad correcta cuando la ciudad existe en ambos grupos',()=>{
 const f=fixture({departamento:'Central',selectedCity:'San Lorenzo',shippingMethod:'encomienda',encomiendaMode:'agencia',address:'Mi casa',referencia:'Portón blanco'});f.run();
 assert.equal(f.department.value,'Central');assert.equal(f.city.selectedIndex,1);assert.equal(f.mode,'agencia');assert.equal(f.inputs['ck-referencia'].value,'Portón blanco');
});
test('datos anteriores no pisan la dirección ni ciudad elegidas para la compra actual',()=>{
 const f=fixture({departamento:'Central',selectedCity:'San Lorenzo',shippingMethod:'delivery',address:'Vieja dirección'});f.department.value='Central';f.city.value='Nueva ciudad';f.inputs['ck-address'].value='Dirección actual';f.run();
 assert.equal(f.city.value,'Nueva ciudad');assert.equal(f.inputs['ck-address'].value,'Dirección actual');
});
test('departamento retirado de configuración no se convierte en un envío válido',()=>{
 const f=fixture({departamento:'Departamento eliminado',selectedCity:'San Lorenzo',shippingMethod:'delivery'});f.run();assert.equal(f.department.value,'');assert.equal(f.city.value,'');
});
