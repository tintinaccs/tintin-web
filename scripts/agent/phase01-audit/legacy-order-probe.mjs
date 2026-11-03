// Execute repository Apps Script checkout/dispatcher with synthetic transaction I/O.
// No Google, Firestore, email, push or production network is accessed.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createOrderAdmin} from '../../../cloudflare/order-admin-domain.js';
import {encodeFirestoreFields} from '../../../cloudflare/firebase-admin-ligero.js';
const root=new URL('../../../',import.meta.url),requestId='audit_legacy_20261101',uid='audit_customer';
const product={name:'Synthetic',price:100,stock:2,active:true,variantCommerceVersion:1,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:2}]};
const context=vm.createContext({FIRESTORE_PROJECT_ID_:'demo-tintin-phase01',SUPER_ADMIN_EMAIL:'owner@example.test',verifyFirebaseIdToken_:()=>({ok:true,uid,email:'customer@example.test',emailVerified:true}),phase3EmailMatches_:()=>false});
vm.runInContext(fs.readFileSync(new URL('apps-script/CrearPedido.gs',root),'utf8'),context);
const docs={'settings/general':{storeOpen:true,paymentMethods:{transferencia:true}},'settings/shippingRates':{},['users/'+uid]:{blocked:false},['checkoutGuards/'+uid]:{lastCheckoutOrderId:uid+'_'+requestId,lastCheckoutAt:new Date().toISOString()},'products/audit_product':product};
let writes=[];
Object.assign(context,{phase4BeginTransaction_:()=>({ok:true,transaction:'synthetic'}),phase4BatchGet_:()=>({ok:true,documents:docs}),phase4CreateWrite_:(path,fields)=>({path,fields}),phase4UpdateWrite_:(path,fields,mask)=>({path,fields,mask}),phase4Commit_:batch=>{writes=batch;return{ok:true};},phase4Rollback_:()=>{},phase4NotifyOrderCreated_:()=>{},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType:()=>text})}});
const dispatcher=fs.readFileSync(new URL('apps-script/ProductosUnificados.gs',root),'utf8');const begin=dispatcher.indexOf('function doPost(e) {');const end=dispatcher.indexOf('// Enlazar desde el doPost',begin);assert.ok(begin>0 && end>begin);vm.runInContext(dispatcher.slice(begin,end),context);
const payload={action:'createOrder',idToken:'synthetic-only',requestId,cartLines:[{id:'audit_product',qty:1,variant:'Dorado'}],name:'Synthetic Customer',phone:'595981123456',selectedCity:'__retiro__',shippingMethod:'retiro',paymentMethod:'transferencia',expectedSubtotal:100,expectedShippingCost:0,expectedShippingPending:false,expectedTotal:100};
const legacy=JSON.parse(context.doPost({postData:{contents:JSON.stringify(payload)}}));assert.equal(legacy.ok,true);
const productWrite=writes.find(w=>w.path==='products/audit_product');assert.equal(productWrite.fields.stock,1);assert.equal(productWrite.fields.variantInventory,undefined);
let canonicalError='';
try{
 await createOrderAdmin({}, {orderId:'audit_canonical_order',userName:'Synthetic Customer',userId:uid,shippingMethod:'retiro',paymentMethod:'transferencia',items:[{id:'audit_product',qty:1,variant:'Dorado'}]}, {uid,email:'customer@example.test',role:'client',origin:'public-checkout'}, {get:async(_env,path)=>path==='settings/orderSequence'?{fields:encodeFirestoreFields({lastNumber:1,historyReconciledAt:new Date()})}:null,batchGet:async()=>[{name:'projects/demo/databases/(default)/documents/products/audit_product',fields:encodeFirestoreFields(product)}],commit:async()=>{throw Error('Unexpected canonical commit');},findFirst:async()=>null,maxNumber:async()=>0});
}catch(error){canonicalError=error.message;}
assert.match(canonicalError,/Stock insuficiente/);
const result={finding:'F04-LEGACY',sourceDispatcher:'apps-script/ProductosUnificados.gs#doPost',variant:'Dorado',variantStock:0,legacyOrderCreated:true,legacyAggregateStock:productWrite.fields.stock,legacyVariantInventoryUpdated:false,canonicalError,deployedAppsScriptVersion:'NOT_VERIFIED',network:false};
fs.writeFileSync(new URL('../../../docs/agent/evidence/phase01-20261101/legacy-order-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
