// Controlled I/O reproductions of the actual production module; no network/PII.
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {encodeFirestoreFields,decodeFirestoreFields} from '../../../cloudflare/firebase-admin-ligero.js';
const moduleUrl=new URL('../../../cloudflare/sincronizacion-estadisticas-pedido.js',import.meta.url);
const source=fs.readFileSync(moduleUrl,'utf8');
async function load(list,merge){
 const context=vm.createContext({Date,Map,Set,Number,String,Object,Array,Math,Promise});
 const dep=new vm.SyntheticModule(['encodeFirestoreFields','decodeFirestoreFields','firestoreAdminListAll','firestoreAdminMerge'],function(){this.setExport('encodeFirestoreFields',encodeFirestoreFields);this.setExport('decodeFirestoreFields',decodeFirestoreFields);this.setExport('firestoreAdminListAll',list);this.setExport('firestoreAdminMerge',merge);},{context});
 const mod=new vm.SourceTextModule(source,{context,identifier:moduleUrl.href});await mod.link(()=>dep);await mod.evaluate();return mod.namespace.syncOrderOwnerStats;
}
const document=(id,data)=>({name:'projects/demo-tintin-phase01/databases/(default)/documents/orders/'+id,fields:encodeFirestoreFields(data)});
const order=(total)=>({userId:'audit_customer',userEmail:'customer@example.test',total,status:'pendiente',createdAt:'2026-11-01T10:00:00Z'});
const records=Array.from({length:5000},(_,i)=>document('other_'+i,{...order(1),userId:'other',userEmail:'other@example.test'}));records.push(document('owner_5001',order(100)));
let saved,optionsSeen;
const capSync=await load(async(_env,path,max,options)=>{assert.equal(path,'orders');optionsSeen={max,options};return records.slice(0,max);},async(_env,_path,fields)=>{saved=decodeFirestoreFields(fields);});
await capSync({},order(100));assert.equal(saved.totalOrders,0);assert.equal(saved.totalSpent,0);assert.equal(optionsSeen.max,5000);assert.equal(optionsSeen.options,undefined);
let resolveOld,calls=0;const writes=[];
const racing=await load(async()=>{if(++calls===1)return new Promise(r=>{resolveOld=r;});return[document('one',order(10)),document('two',order(20))];},async(_env,_path,fields)=>{writes.push(decodeFirestoreFields(fields).totalSpent);});
const older=racing({},order(10));await racing({},order(20));resolveOld([document('one',order(10))]);await older;assert.deepEqual(writes,[30,10]);
const result={finding:'F02-STATS',cap:{globalOrders:5001,ownedOrders:1,persistedOrders:saved.totalOrders,persistedTotal:saved.totalSpent,failOnTruncationRequested:false},race:{writes,finalTotal:10,correctLatestTotal:30},productionVolume:'NOT_VERIFIED',network:false};
fs.writeFileSync(new URL('../../../docs/agent/evidence/phase01-20261101/stats-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
