// Prueba Node para emulador, no módulo del runtime público.
import fs from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,where,limit} from 'firebase/firestore';
const host=process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8089';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw Error('Sólo emulador local.');
const [address,port]=host.split(':');
const env=await initializeTestEnvironment({projectId:'demo-tintin-phase4',firestore:{host:address,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8')}});
let checks=0;
try{
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const [path,value] of Object.entries({
 'settings/storeGate':{storeOpen:true},'users/admin':{role:'admin',blocked:false},'users/customer':{role:'client',blocked:false},
 'products/live':{active:true,publicationStatus:'active'},'products/legacy':{name:'Histórico'},'products/draft':{active:false,publicationStatus:'draft'},'products/archive':{active:false,publicationStatus:'archived'},
 'productEditorWorkspaces/admin/items/key':{ownerUid:'admin',snapshot:{name:'Privado'}}
 }))await setDoc(doc(db,path),value);});
 for(const db of [env.unauthenticatedContext().firestore(),env.authenticatedContext('customer').firestore()]){
  for(const id of ['draft','archive']){await assertFails(getDoc(doc(db,'products',id)));checks++;}
  await assertSucceeds(getDoc(doc(db,'products/live')));checks++;
  await assertSucceeds(getDoc(doc(db,'products/legacy')));checks++;
  await assertFails(getDocs(query(collection(db,'products'),limit(100))));checks++;
  await assertSucceeds(getDocs(query(collection(db,'products'),where('active','==',true),where('publicationStatus','==','active'),limit(100))));checks++;
 }
 const admin=env.authenticatedContext('admin').firestore();await assertSucceeds(getDoc(doc(admin,'products/draft')));checks++;
 await assertSucceeds(getDocs(query(collection(admin,'products'),limit(100))));checks++;
 for(const db of [admin,env.unauthenticatedContext().firestore(),env.authenticatedContext('super',{email:'tintinaccs@gmail.com',email_verified:true}).firestore()]){
  await assertFails(getDoc(doc(db,'productEditorWorkspaces/admin/items/key')));checks++;
  await assertFails(setDoc(doc(db,'productEditorWorkspaces/admin/items/key'),{snapshot:{name:'Ataque'}}));checks++;
 }
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'rolePermissions/main'),{admin:{productos:{ver:false}}}));
 await assertFails(getDoc(doc(admin,'products/draft')));checks++;
 console.log(`${checks} verificaciones de privacidad y sintaxis aprobadas.`);
}finally{await env.cleanup();}
