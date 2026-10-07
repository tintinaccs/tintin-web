import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../checkout.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('let lastCartRenderKey'),html.indexOf('function showCkToast'));
const reliability=fs.readFileSync(new URL('../../js/pages/checkout/checkout-confiabilidad.js',import.meta.url),'utf8');

test('el renderer canónico no reconstruye las filas ante un evento sin cambios',async()=>{
  let writes=0;
  const nodes={'ck-items':{set innerHTML(value){writes++;this.value=value;}},'ck-subtotal-val':{},'btn-step1-next':{setAttribute(){}}};
  let items=[{id:'ring',lineId:'ring-gold',name:'Ring',cat:'joyas',price:100,qty:1}];
  const c=vm.createContext({
    window:{PRODUCTS:null},document:{getElementById:id=>nodes[id]},cartItems:[],
    getCartLocal:()=>items,setCartLocal(){throw new Error('unexpected metadata write')},
    sessionCanMakeCheckoutDecision:()=>true,escapeSearchHtml:v=>String(v),sanitizeImageUrl:()=>'',formatPrice:v=>String(v),cartTotal:cart=>cart.reduce((s,i)=>s+i.price*i.qty,0)
  });
  vm.runInContext(source,c);
  await c.renderCart();await c.renderCart();assert.equal(writes,1);
  items=[{...items[0],qty:2}];await c.renderCart();assert.equal(writes,2);assert.equal(nodes['ck-subtotal-val'].textContent,'200');
});

test('una sesión sin resolver conserva el loading sin pintar un carrito de otra identidad',async()=>{
  const c=vm.createContext({sessionCanMakeCheckoutDecision:()=>false});vm.runInContext(source,c);
  await c.renderCart(); // Cualquier acceso a datos/DOM produciría un ReferenceError.
});

test('la capa de fiabilidad delega al único renderer y no reconstruye ck-items',()=>{
  assert.match(reliability,/TintinCheckoutCartRenderer/);
  assert.doesNotMatch(reliability,/container\.innerHTML|readActiveCart|lastCartFingerprint/);
});


test('una recomendación vacía que llega tarde no sustituye un carrito ya actualizado',async()=>{
  let resolveProducts;
  const pending=new Promise(resolve=>{resolveProducts=resolve;});
  const container={innerHTML:''};
  const nodes={'ck-items':container,'ck-subtotal-val':{},'btn-step1-next':{setAttribute(){}}};
  let items=[];
  const c=vm.createContext({
    window:{PRODUCTS:null},document:{getElementById:id=>nodes[id]},cartItems:[],sessionStorage:{getItem:()=>null},
    getCartLocal:()=>items,setCartLocal(){},sessionCanMakeCheckoutDecision:()=>true,
    getDocs:()=>pending,query(){},collection(){},limit(){},db:{},sanitizeCheckoutProduct:(id,data)=>({id,...data}),
    escapeSearchHtml:v=>String(v),sanitizeImageUrl:()=>'',formatPrice:v=>String(v),cartTotal:cart=>cart.reduce((s,i)=>s+i.price*i.qty,0)
  });
  vm.runInContext(source,c);
  const emptyRender=c.renderCart();
  items=[{id:'ring',lineId:'ring-gold',name:'Ring',cat:'joyas',price:100,qty:1}];
  await c.renderCart();const filled=container.innerHTML;
  resolveProducts({docs:[]});await emptyRender;
  assert.equal(container.innerHTML,filled);assert.match(filled,/Ring/);
});
