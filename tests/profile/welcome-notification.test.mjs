import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../functions/api/notifications.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function registerProfileNotification('),source.indexOf('\n/**',source.indexOf('async function registerProfileNotification(')));
test('bienvenida persistente se recupera una vez sin generar un alta admin de una cuenta antigua',async()=>{
 const records=new Map();let adminCalls=0;
 const register=new Function('safeId','firestoreAdminGet','decodeFirestoreFields','clean','notifyUserIfAbsent','notifyAdminIfAbsent','PROFILE_RECOVERY_WINDOW_MS',code+'return registerProfileNotification;')(
  x=>x,async()=>({fields:{createdAt:'2025-01-01T00:00:00Z',name:'Fixture'}}),x=>x,x=>String(x||''),
  async(_env,uid,notice,key)=>{if(records.has(key))return{created:false};records.set(key,{uid,notice});return{created:true};},
  async()=>{adminCalls++;},86400000);
 const user={uid:'fixture',email:'fixture@example.test'};
 await register({},user);await register({},user);
 assert.equal(records.size,1);assert.equal(adminCalls,0);
 const saved=records.get('welcome:fixture');
 assert.equal(saved.uid,'fixture');assert.equal(saved.notice.kind,'welcome');
 assert.equal(saved.notice.createdAt.toISOString(),'2025-01-01T00:00:00.000Z');
});
