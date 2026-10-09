import { decodeFirestoreFields, encodeFirestoreFields, firestoreAdminGet, firestoreAdminListAll } from './firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from './firestore-admin-batch.js';

export const LOCAL_BOOK_ID = '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U';
export const LOCAL_REVISION = 'local-commerce-v1';
const META_PATH = 'syncMeta/localCommerce';
const ENTRY_COLLECTION = 'localCommerceEntries';
const CONTACT_COLLECTION = 'salesCustomers';
const kinds = new Set(['sale', 'expense', 'purchase', 'customer']);
const text = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stableId = value => /^[A-Za-z0-9_-]{6,120}$/.test(String(value || '')) ? value : fail('Identificador local inválido.');
const money = value => { const n = Number(value ?? 0); return Number.isSafeInteger(n) && n >= 0 && n <= 1e12 ? n : fail('Monto inválido.'); };
const numberOrNull = value => value === '' || value == null ? null : money(value);
const signedOrNull = value => { if(value===''||value==null)return null;const n=Number(value);return Number.isSafeInteger(n)&&Math.abs(n)<=1e12?n:fail('Ganancia inválida.'); };
const date = value => {
  if (!value) return '';
  const s = String(value);
  const parsed = new Date(s+'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== s) fail('Fecha inválida.');
  return s;
};
const normalizeName = name => text(name,160).normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g,' ');
async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join('');
}
export async function localCustomerId(name) {
  if (!normalizeName(name)) return '';
  return 'CUS_LOCAL_' + (await digest(normalizeName(name))).slice(0,32);
}
function phone(value) {
  const raw = text(value,40); if (!raw) return '';
  const digits=raw.replace(/[\s()+-]/g,'').replace(/^595/,'').replace(/^0/,'');
  if (!/^9\d{8}$/.test(digits)) fail('Teléfono: usá 0912 345 678 o 912 345 678.');
  return '+595'+digits;
}
function email(value) {
  const result=text(value,254).toLowerCase();
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Correo inválido.');
  return result;
}
export async function normalizeLocalEntry(input) {
  if (!input || typeof input !== 'object' || !kinds.has(input.kind)) fail('Tipo de registro inválido.');
  const id=stableId(input.id), kind=input.kind;
  if (id.startsWith('WEB_')) fail('Los pedidos web se editan en Pedidos web, con su control de inventario.');
  const common={id,kind,archived:input.archived===true};
  if (kind === 'customer') {
    const name=text(input.name,160); if (!name) fail('Nombre obligatorio.');
    return {...common,name,phone:phone(input.phone),email:email(input.email),city:text(input.city,120),address:text(input.address,400),notes:text(input.notes,2000),sourceCode:text(input.sourceCode,80)};
  }
  const year=Number(input.year), month=Number(input.month);
  if (!Number.isInteger(year) || year<2000 || year>2100 || !Number.isInteger(month) || month<1 || month>12) fail('Mes o año inválido.');
  const occurredOn=date(input.occurredOn);
  if (occurredOn && (Number(occurredOn.slice(0,4))!==year || Number(occurredOn.slice(5,7))!==month)) fail('La fecha no corresponde al mes de la hoja.');
  const source=input.source||{};
  if (source.bookId && source.bookId!==LOCAL_BOOK_ID) fail('Libro de origen no autorizado.');
  const sourceRows=Array.isArray(source.rows)?source.rows:[];
  if (sourceRows.length>100 || sourceRows.some(r=>!Number.isInteger(r)||r<10||r>100000)) fail('Filas de origen inválidas.');
  const record={...common,year,month,occurredOn,source:{bookId:LOCAL_BOOK_ID,sheet:text(source.sheet,40),rows:sourceRows},notes:text(input.notes,2000)};
  if (kind !== 'sale') return {...record,detail:text(input.detail,500),category:text(input.category,120),supplier:text(input.supplier,160),amount:money(input.amount)};
  const customerName=text(input.customerName,160);
  const customerId=input.customerId?stableId(input.customerId):await localCustomerId(customerName);
  const lines=Array.isArray(input.lines)?input.lines:[];
  if (lines.length>100) fail('Demasiadas líneas en una venta.');
  const saleLines=lines.map(line=>({detail:text(line.detail,500),type:text(line.type,80),image:text(line.image,2000),quantity:numberOrNull(line.quantity),cost:numberOrNull(line.cost),amount:numberOrNull(line.amount),profit:signedOrNull(line.profit)}));
  if(saleLines.length && saleLines.reduce((sum,line)=>sum+(line.amount||0),0)!==money(input.total)) fail('La venta total debe coincidir con los importes de las líneas.');
  const status=text(input.paymentStatus,60);
  if (!['','pagado','pendiente','cancelado','rechazado','reembolsado'].includes(status)) fail('Estado de pago inválido.');
  return {...record,customerName,customerId,orderCode:text(input.orderCode,80),lines:saleLines,total:money(input.total),paymentStatus:status,paymentMethod:text(input.paymentMethod,100),city:text(input.city,120),deliveryMethod:text(input.deliveryMethod,100),shippingCost:numberOrNull(input.shippingCost),draft:!occurredOn || !customerName};
}
export function historicalOrder(entry, contact = {}) {
  if (entry.kind!=='sale' || entry.draft || entry.archived) return null;
  // Importar una venta ya ocurrida nunca vuelve a descontar stock, asignar TINPED,
  // crear Auth, cobrar ni enviar avisos comerciales.
  const items=entry.lines.filter(line=>line.detail && line.quantity>0).map(line=>({name:line.detail,qty:line.quantity,imageUrl:line.image,price:line.amount==null?null:line.amount/line.quantity,historical:true}));
  return {orderNumber:`LOCAL-${entry.year}-${String(entry.month).padStart(2,'0')}-${entry.orderCode||entry.id}`,source:'google-sheets-local',channel:'Venta local · Sheets',localEntryId:entry.id,customerId:entry.customerId,userId:'',userName:entry.customerName,userEmail:'',contactEmail:contact.email||'',userPhone:contact.phone||'',items,subtotal:entry.total,shippingCost:entry.shippingCost||0,total:entry.total,createdAt:new Date(entry.occurredOn+'T12:00:00Z'),paymentStatus:entry.paymentStatus||'pendiente',paymentMethod:entry.paymentMethod,payment:{status:entry.paymentStatus||'pendiente',method:entry.paymentMethod},status:['cancelado','rechazado'].includes(entry.paymentStatus)?entry.paymentStatus:'historico',shipping:{method:entry.deliveryMethod,city:entry.city},notes:entry.notes,inventoryState:'historical_unmanaged',historical:true,localSale:entry};
}
export function purchasedCustomers(contacts, orders) {
  const customers=new Map(contacts.map(c=>[c.id,{...c,origin:'local',hasWebAccount:false,orderCount:0,paidOrderCount:0,totalPurchased:0,totalPaid:0,lastPurchase:'',orderIds:[]}]));
  for(const order of orders) {
    if(order.isTest===true || order.technicalTest===true || order.deleted===true) continue;
    const key=order.userId?`WEB_${order.userId}`:order.customerId||`ORDER_${order.id}`;
    if(!customers.has(key)) customers.set(key,{id:key,name:order.userName||'Cliente sin nombre',phone:order.userPhone||'',email:order.contactEmail||order.userEmail||'',city:order.shipping?.city||'',address:order.shipping?.address||'',notes:'',origin:order.userId?'web':'local',hasWebAccount:!!order.userId,orderCount:0,paidOrderCount:0,totalPurchased:0,totalPaid:0,lastPurchase:'',orderIds:[]});
    const customer=customers.get(key); customer.orderCount++; customer.orderIds.push(order.id);
    const cancelled=['cancelado','rechazado'].includes(order.status)||['cancelado','rechazado','reembolsado'].includes(order.payment?.status||order.paymentStatus);
    if(!cancelled) customer.totalPurchased+=Number(order.total||0);
    if(!cancelled&&(order.payment?.status||order.paymentStatus)==='pagado'){customer.paidOrderCount++;customer.totalPaid+=Number(order.total||0);}
    const occurred=order.createdAt instanceof Date?order.createdAt.toISOString():String(order.createdAt||'');
    if(occurred>customer.lastPurchase) customer.lastPurchase=occurred;
  }
  return [...customers.values()].sort((a,b)=>b.lastPurchase.localeCompare(a.lastPurchase)||a.name.localeCompare(b.name,'es'));
}
const realDependencies={get:firestoreAdminGet,list:firestoreAdminListAll,commit:firestoreAdminBatchCommit};
function unpack(doc){return doc?{id:String(doc.name||'').split('/').pop(),...decodeFirestoreFields(doc.fields||{})}:null;}
export async function localCommerceSnapshot(env,{revisionOnly=false}={},deps=realDependencies) {
  const meta=unpack(await deps.get(env,META_PATH))||{};
  if(revisionOnly)return {revision:meta.revision||'',checkedAt:new Date().toISOString()};
  const [entries,contacts,orders]=await Promise.all([deps.list(env,ENTRY_COLLECTION,5000),deps.list(env,CONTACT_COLLECTION,5000),deps.list(env,'orders',5000)]);
  // A bounded snapshot must fail rather than falsely certify a truncated mirror.
  if([entries,contacts,orders].some(list=>list.length>=5000)) fail('El espejo necesita paginación adicional; no se devuelve una copia truncada.',409);
  const orderRecords=orders.map(unpack),contactRecords=contacts.map(unpack);
  return {revision:meta.revision||'',entries:entries.map(unpack),contacts:contactRecords,customers:purchasedCustomers(contactRecords,orderRecords),webOrders:orderRecords.filter(o=>!o.localEntryId),checkedAt:new Date().toISOString()};
}
export async function upsertLocalEntries(env,input,actor,deps=realDependencies) {
  if(input.action!=='upsert' || !Array.isArray(input.entries) || !input.entries.length || input.entries.length>20) fail('Enviá entre 1 y 20 registros.');
  const normalized=await Promise.all(input.entries.map(normalizeLocalEntry));
  if(new Set(normalized.map(e=>e.id)).size!==normalized.length) fail('Identificadores repetidos en el lote.');
  const writes=[],results=[],now=new Date();
  for(let index=0;index<normalized.length;index++) {
    const entry=normalized[index], raw=input.entries[index];
    const path=`${entry.kind==='customer'?CONTACT_COLLECTION:ENTRY_COLLECTION}/${entry.id}`;
    const document=await deps.get(env,path),old=unpack(document);
    if(old && old.kind!==entry.kind) fail('El tipo del registro no puede cambiar.',409);
    if (old?.kind==='sale' && !old.draft && entry.draft) fail('Una venta confirmada debe conservar fecha y cliente. Usá Archivar para retirarla del informe.',409);
    const fingerprint=await digest(JSON.stringify(entry));
    if(old?.fingerprint===fingerprint){results.push({id:entry.id,version:old.version,unchanged:true});continue;}
    if(old && raw.baseVersion!==old.version) fail('El registro cambió. Actualizá el espejo antes de editar.',409);
    const version=crypto.randomUUID(),record={...entry,fingerprint,version,updatedAt:now,createdAt:old?.createdAt||now};
    writes.push({path,fields:encodeFirestoreFields(record),currentDocument:document?{updateTime:document.updateTime}:{exists:false}});
    if(entry.kind==='sale') {
      const contact=entry.customerId?unpack(await deps.get(env,`${CONTACT_COLLECTION}/${entry.customerId}`)):{};
      const projection=historicalOrder(entry,contact||{}),orderPath=`orders/${entry.id}`;
      const orderDoc=await deps.get(env,orderPath),existing=unpack(orderDoc);
      if(existing && existing.localEntryId!==entry.id) fail('El identificador pertenece a otro pedido.',409);
      if(projection)writes.push({path:orderPath,fields:encodeFirestoreFields({...projection,updatedAt:now,lastChangeId:version,syncOrigin:text(actor?.origin,120)}),currentDocument:orderDoc?{updateTime:orderDoc.updateTime}:{exists:false}});
      else if(existing)writes.push({path:orderPath,fields:encodeFirestoreFields({status:'cancelado',paymentStatus:'cancelado',payment:{status:'cancelado',method:entry.paymentMethod},archived:true,localSale:entry,updatedAt:now,lastChangeId:version}),mergeFields:['status','paymentStatus','payment','archived','localSale','updatedAt','lastChangeId'],currentDocument:{updateTime:orderDoc.updateTime}});
    }
    results.push({id:entry.id,version,unchanged:false});
  }
  if(writes.length) {
    const operationId=crypto.randomUUID();
    writes.push({path:META_PATH,fields:encodeFirestoreFields({revision:operationId,updatedAt:now,protocol:LOCAL_REVISION})});
    writes.push({path:`auditLog/EVT_LOCAL_${operationId.replaceAll('-','')}`,fields:encodeFirestoreFields({eventId:`EVT_LOCAL_${operationId.replaceAll('-','')}`,createdAt:now,timestamp:now,action:'local_commerce_upsert',actorId:actor?.uid||'google-sheets',actorEmail:actor?.email||'',source:actor?.origin||'admin',recordIds:results.filter(r=>!r.unchanged).map(r=>r.id),details:'Espejo de ventas/clientes locales. Sin pagos, cuentas ni movimientos de inventario.'}),currentDocument:{exists:false}});
    await deps.commit(env,writes);
  }
  return {ok:true,revision:LOCAL_REVISION,results};
}
