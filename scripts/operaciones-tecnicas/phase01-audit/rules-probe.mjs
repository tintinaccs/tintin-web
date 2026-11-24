// Diagnostic probe: exit 0 confirms the documented vulnerability, NOT safe rules.
// Only a loopback emulator with a demo project; never production.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,getDocs,collection} from 'firebase/firestore';
const host=process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host||'',/^(127\.0\.0\.1|localhost):\d+$/);
const [address,port]=host.split(':');
const root=new URL('../../../',import.meta.url);
const env=await initializeTestEnvironment({projectId:'demo-tintin-phase01',firestore:{host:address,port:Number(port),rules:fs.readFileSync(new URL('firestore.rules',root),'utf8')}});
try {
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'settings/storeGate'),{storeOpen:true});
  await setDoc(doc(db,'users/audit_agent'),{role:'agent',blocked:false,email:'agent@example.test'});
  await setDoc(doc(db,'rolePermissions/main'),{agent:{pedidos:{ver:false,cambiarEstado:false,cambiarPago:false,reenviarCorreo:false}}});
  await setDoc(doc(db,'products/audit_product'),{name:'Synthetic',price:100,stock:0,active:true});
  await setDoc(doc(db,'orders/audit_order'),{userId:'audit_customer',userEmail:'customer@example.test',status:'pendiente',paymentStatus:'pendiente',inventoryState:'reserved',inventoryRevision:1,items:[{id:'audit_product',qty:1}],total:100});
 });
 const anon=env.unauthenticatedContext().firestore();
 const client=env.authenticatedContext('audit_customer',{email:'customer@example.test',email_verified:true}).firestore();
 await assertFails(updateDoc(doc(anon,'orders/audit_order'),{inventoryState:'released'}));
 await assertFails(updateDoc(doc(client,'orders/audit_order'),{inventoryState:'released'}));
 const agent=env.authenticatedContext('audit_agent',{email:'agent@example.test',email_verified:true}).firestore();
 await assertFails(getDoc(doc(agent,'orders/audit_order')));
 await assertSucceeds(updateDoc(doc(agent,'orders/audit_order'),{inventoryState:'released',inventoryRevision:999}));
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(),order=(await getDoc(doc(db,'orders/audit_order'))).data(),product=(await getDoc(doc(db,'products/audit_product'))).data();
  assert.equal(order.inventoryState,'released');assert.equal(order.inventoryRevision,999);assert.equal(product.stock,0);
  const auditWrites=(await getDocs(collection(db,'auditLog'))).size;assert.equal(auditWrites,0);
  const result={finding:'F01-RULES',vulnerabilityConfirmed:true,actor:'agent with all order permissions false',readOrder:'denied',writeInventoryState:'accepted',inventoryRevision:order.inventoryRevision,stock:product.stock,auditWrites,project:'demo-tintin-phase01'};
  fs.writeFileSync(new URL('../../../docs/agent/evidence/phase01-20261101/rules-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 });
} finally {await env.cleanup();}
