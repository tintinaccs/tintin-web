import assert from 'node:assert/strict';
import {commercialDraft,setCommercialOptionAvailability} from '../../js/admin/products/editor-comercial-core.mjs';
import {saveProductEditor} from '../../cloudflare/product-editor-domain.mjs';
import {productFingerprint} from '../../js/admin/products/maestro-productos-core.mjs';
import {composeCheckoutDraft} from '../../js/orders/politica-checkout.js';
import {preparePublicCheckoutOrder} from '../../cloudflare/politica-checkout-publico.js';
import {createOrderAdmin,applyOrderAdminMutation} from '../../cloudflare/order-admin-domain.js';

// Same domain flow in memory and Firestore demo/loopback. No live services,
// authenticated customer, payment provider or outbound email is exercised.
export async function verifyRetiredOptionCheckout({deps,seed,product,actor,admin}) {
 const id='retire_checkout';
 await seed('settings/orderSequence',{lastNumber:0,highWaterMark:0,historyReconciledAt:new Date()});
 await seed('settings/general',{storeOpen:true,paymentMethods:{transferencia:true}});
 await seed('collections/retire_checkout',{name:'Fixture'});
 const original=commercialDraft({name:'Reloj fixture',description:'Descripción sintética completa',imageUrl:'https://example.invalid/gold.png',category:'retire_checkout',price:30000,active:true,oferta:false,destacado:false,variants:{Color:['Dorado','Plateado'],Talle:['M']}});
 original.variantInventory.forEach((row,index)=>{row.stock=2;row.price=index===0?45000:35000;});original.stock=4;
 original.variantMedia=[{Color:'Dorado',imageUrl:'https://example.invalid/gold.png'},{Color:'Plateado',imageUrl:'https://example.invalid/silver.png'}];
 await saveProductEditor({},{productId:id,expected:null,changeId:'retire_fixture_create',product:original},admin,deps);
 const [goldKey,silverKey]=original.variantInventory.map(row=>row.variant);
 async function prepare(suffix,key,label,price) {
  const buyer={...actor,uid:`retire_${suffix}`,email:`${suffix}@example.test`},requestId=`retire_${suffix}_20261024`;
  await seed(`checkoutGuards/${buyer.uid}`,{lastCheckoutOrderId:`${buyer.uid}_${requestId}`,lastCheckoutAt:new Date()});
  const draft=composeCheckoutDraft({requestId,items:[{id,qty:1,variant:label,variantKey:key}],name:'Clienta Fixture',phone:'595981123456',contactEmail:buyer.email,notes:'',selectedCity:'__retiro__',departamento:'',address:'',referencia:'',shipping:{method:'retiro',cost:0,pending:false},paymentMethod:'transferencia',subtotal:price});
  return {buyer,prepared:await preparePublicCheckoutOrder({},draft,buyer,deps)};
 }
 const first=await prepare('before',goldKey,'Dorado / M',45000);
 const pending=await createOrderAdmin({},first.prepared.input,first.buyer,{...deps,inspect:first.prepared.inspect});
 const reserved=await product(id);assert.equal(reserved.variantInventory[0].stock,1);
 const retired=setCommercialOptionAvailability(reserved,'Color','Dorado',false);
 await saveProductEditor({},{productId:id,expected:productFingerprint(reserved),changeId:'retire_fixture_gold',product:{variantInventory:retired.variantInventory}},admin,deps);
 await assert.rejects(async()=>{const blocked=await prepare('retired',goldKey,'Dorado / M',45000);await createOrderAdmin({},blocked.prepared.input,blocked.buyer,{...deps,inspect:blocked.prepared.inspect});});
 const other=await prepare('other',silverKey,'Plateado / M',35000);
 const silver=await createOrderAdmin({},other.prepared.input,other.buyer,{...deps,inspect:other.prepared.inspect});
 assert.equal(silver.order.total,35000);assert.equal(silver.order.items[0].variantKey,silverKey);assert.equal(silver.order.items[0].imageUrl,'https://example.invalid/silver.png');
 await applyOrderAdminMutation({},{orderId:pending.orderId,status:'cancelado',changeId:'retire_fixture_cancel'},admin,deps);
 await applyOrderAdminMutation({},{orderId:pending.orderId,status:'cancelado',changeId:'retire_fixture_cancel'},admin,deps);
 const returned=await product(id);assert.equal(returned.variantInventory[0].stock,2);assert.equal(returned.variantInventory[0].active,false);assert.equal(returned.variantInventory[0].variant,goldKey);
 assert.deepEqual(returned.variantMedia,original.variantMedia);
 await assert.rejects(async()=>{const blocked=await prepare('still_retired',goldKey,'Dorado / M',45000);await createOrderAdmin({},blocked.prepared.input,blocked.buyer,{...deps,inspect:blocked.prepared.inspect});});
 const restored=setCommercialOptionAvailability(returned,'Color','Dorado',true);
 await saveProductEditor({},{productId:id,expected:productFingerprint(returned),changeId:'restore_fixture_gold',product:{variantInventory:restored.variantInventory}},admin,deps);
 const last=await prepare('restored',goldKey,'Dorado / M',45000);
 const gold=await createOrderAdmin({},last.prepared.input,last.buyer,{...deps,inspect:last.prepared.inspect});
 assert.equal(gold.order.total,45000);assert.equal(gold.order.items[0].variantKey,goldKey);assert.equal(gold.order.items[0].imageUrl,'https://example.invalid/gold.png');
 assert.equal((await product(id)).variantInventory[0].stock,1);
}
