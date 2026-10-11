import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as validation from '../../js/components/forms/validacion-documentos-py.js';
const source=fs.readFileSync('js/orders/pedido-checkout-seguro.js','utf8');
const block=source.slice(source.indexOf('  async function persistCheckoutDefaults('),source.indexOf('  // Antes de cualquier avance'));
function fixture({readError=false,changedUid=false,previous={}}={}){
 const writes=[];let reads=0;
 const factory=new Function('getSessionUser','db','doc','getDoc','setDoc','serverTimestamp',...Object.keys(validation),"const text=value=>String(value||'').trim();const CHECKOUT_DEFAULTS_FIELD='checkoutDefaults';"+block+'return persistCheckoutDefaults;');
 const run=factory(()=>({uid:changedUid&&reads?'other':'customer'}),{},(_db,_collection,uid)=>uid,async()=>{reads++;if(readError)throw Error('unavailable');return {exists:()=>true,data:()=>({checkoutDefaults:previous})};},async(ref,patch)=>writes.push({ref,patch}),()=> 'server-time',...Object.values(validation));
 return {run,writes};
}
test('lectura fallida o cambio de UID nunca borran preferencias ni escriben en otro perfil',async()=>{
 for(const options of [{readError:true},{changedUid:true}]){const f=fixture(options);await assert.rejects(()=>f.run({wantsInvoice:false}));assert.equal(f.writes.length,0);}
});
test('sin factura conserva datos tributarios anteriores y la compra actual sólo cambia su preferencia',async()=>{
 const f=fixture({previous:{ci:'4123456',invoice:{razonSocial:'María López',ruc:'4123456-7',taxpayerType:'fisica'}}});
 await f.run({wantsInvoice:false,shippingMethod:'delivery',selectedCity:'San Lorenzo',departamento:'Central',referencia:'Portón blanco'});
 assert.equal(f.writes[0].ref,'customer');const saved=f.writes[0].patch.checkoutDefaults;
 assert.deepEqual(saved.invoice,{razonSocial:'María López',ruc:'4123456-7',wanted:false,taxpayerType:'fisica'});assert.equal(saved.ci,'4123456');assert.equal(saved.shipping.referencia,'Portón blanco');
});
