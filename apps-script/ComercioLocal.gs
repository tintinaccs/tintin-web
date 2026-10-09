// Ventas locales: fuente histórica conservada, Firestore como autoridad tras importar.
// No crea usuarios Auth, no cobra y no vuelve a descontar productos vendidos.
var TINTIN_LOCAL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var TINTIN_LOCAL_PATH = '/api/local-commerce-webhook';
var TINTIN_LOCAL_BOOK = '106Z1A8veL9fGMc4U7R10NVNMsJiEYt9wiGr4YFAav1U';
function tintinLocalProperties_() { return PropertiesService.getDocumentProperties() || PropertiesService.getScriptProperties(); }
function tintinLocalText_(value) { return String(value == null ? '' : value).trim(); }
// setValues interpreta '=' como fórmula: los textos externos siempre son literales.
function tintinLocalLiteral_(value) { return typeof value==='string'&&/^\s*=/.test(value)?"'"+value:value; }
function tintinLocalHash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join(''); }
function tintinLocalCustomerId_(name) { return 'CUS_LOCAL_'+tintinLocalHash_(tintinLocalText_(name).normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g,' ')).slice(0,32); }
function tintinLocalDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value,'America/Asuncion','yyyy-MM-dd');
  if (!value) return '';
  var s=tintinLocalText_(value); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); if(m) return m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);
  throw new Error('Fecha inválida en la hoja: corregí la celda antes de sincronizar.');
}
function tintinLocalYear_(sheet) {
  var title=sheet.getRange('B3').getDisplayValue(), match=title.match(/20\d{2}/);
  if(!match) throw new Error('La hoja mensual debe indicar el año en B3.'); return Number(match[0]);
}
function tintinLocalMonthlyRows_(sheet) {
  var month=TINTIN_LOCAL_MONTHS.indexOf(sheet.getName())+1,year=tintinLocalYear_(sheet);
  var values=sheet.getRange(10,1,Math.max(1,sheet.getLastRow()-9),38).getValues(), sales={}, entries=[];
  values.forEach(function(v,index){
    var row=index+10,code=tintinLocalText_(v[1]),id=tintinLocalText_(v[32]);
    // Los pedidos web ya existen; sus campos se editan en Pedidos web.
    if(id.indexOf('WEB_')!==0&&(code||v[4]||v[5]||v[9])) {
      id=id||'LOCAL_'+year+'_'+('0'+month).slice(-2)+'_'+(code||Utilities.getUuid().replace(/-/g,''));
      var entry=sales[id];
      if(!entry) {
        entry={id:id,kind:'sale',year:year,month:month,occurredOn:tintinLocalDate_(v[3]),customerName:tintinLocalText_(v[4]),customerId:v[4]?tintinLocalCustomerId_(v[4]):'',orderCode:code,total:0,lines:[],paymentStatus:tintinLocalText_(v[11]).toLowerCase(),paymentMethod:tintinLocalText_(v[12]),notes:tintinLocalText_(v[13]),city:tintinLocalText_(v[14]),deliveryMethod:tintinLocalText_(v[15]),shippingCost:v[16]===''?null:Number(v[16]),source:{bookId:TINTIN_LOCAL_BOOK,sheet:sheet.getName(),rows:[]},baseVersion:tintinLocalText_(v[33])};
        sales[id]=entry;entries.push(entry);
      }
      if(entry.baseVersion!==tintinLocalText_(v[33])) throw new Error('Las líneas del mismo pedido tienen versiones diferentes.');
      entry.lines.push({type:tintinLocalText_(v[2]),detail:tintinLocalText_(v[5]),image:tintinLocalText_(v[6]),quantity:v[7]===''?null:Number(v[7]),cost:v[8]===''?null:Number(v[8]),amount:v[9]===''?null:Number(v[9]),profit:v[10]===''?null:Number(v[10]),rowFields:entry.lines.length?{occurredOn:tintinLocalDate_(v[3]),customerName:tintinLocalText_(v[4]),paymentStatus:tintinLocalText_(v[11]),paymentMethod:tintinLocalText_(v[12]),notes:tintinLocalText_(v[13]),city:tintinLocalText_(v[14]),deliveryMethod:tintinLocalText_(v[15]),shippingCost:v[16]===''?null:Number(v[16])}:null});
      entry.total+=Number(v[9]||0);entry.source.rows.push(row);
      if(!v[32])sheet.getRange(row,33).setValue(id);
    }
    [['expense',18,19,20,21,34],['purchase',23,24,26,25,36]].forEach(function(spec){
      // Totales de fórmulas con cero no son gastos ni compras reales.
      if(!v[spec[1]]&&!v[spec[2]]) return;
      var itemId=tintinLocalText_(v[spec[5]])||'LOCAL_'+spec[0]+'_'+Utilities.getUuid().replace(/-/g,'');
      var item={id:itemId,kind:spec[0],year:year,month:month,occurredOn:tintinLocalDate_(v[spec[1]]),amount:Number(v[spec[4]]||0),source:{bookId:TINTIN_LOCAL_BOOK,sheet:sheet.getName(),rows:[row]},baseVersion:tintinLocalText_(v[spec[5]+1])};
      if(spec[0]==='expense'){item.detail=tintinLocalText_(v[19]);item.category=tintinLocalText_(v[20]);}
      else {item.supplier=tintinLocalText_(v[24]);item.notes=tintinLocalText_(v[26]);}
      entries.push(item);if(!v[spec[5]])sheet.getRange(row,spec[5]+1).setValue(itemId);
    });
  });
  return entries;
}
function tintinLocalContacts_(sheet) {
  var values=sheet.getRange(7,2,Math.max(1,sheet.getLastRow()-6),12).getValues(),result=[];
  values.forEach(function(v,i){
    if(!v[2]||tintinLocalText_(v[10]).indexOf('WEB_')===0)return;
    var id=tintinLocalText_(v[10])||tintinLocalCustomerId_(v[2]);
    result.push({id:id,kind:'customer',name:tintinLocalText_(v[2]),sourceCode:tintinLocalText_(v[0]),phone:tintinLocalText_(v[4]),email:tintinLocalText_(v[5]),city:tintinLocalText_(v[6]),address:tintinLocalText_(v[7]),notes:tintinLocalText_(v[9]),baseVersion:tintinLocalText_(v[11]),_row:i+7});if(!v[10])sheet.getRange(i+7,12).setValue(id);
  });return result;
}
function tintinLocalCall_(payload) {
  // El mismo alcance administrativo existente; no concede permisos nuevos.
  TINTIN_WEBHOOK_SECRET_PROPERTIES[TINTIN_LOCAL_PATH]=TINTIN_WEBHOOK_SECRET_PROPERTIES[TINTIN_ADMIN_WEBHOOK_PATH];
  return tintinParityCallWebhook_(TINTIN_LOCAL_PATH,payload);
}
function tintinLocalPush_(sheet,entries) {
  var properties=tintinLocalProperties_(),baselines=properties.getProperties();
  entries=entries.filter(function(entry){return !entry.baseVersion||baselines['LOCAL_BASE_'+entry.id]!==tintinLocalFingerprint_(entry);});
  // El Worker escribe varias subcolecciones por registro; una entrada por
  // petición evita exceder su límite de subsolicitudes.
  for(var offset=0;offset<entries.length;offset+=1) {
    var batch=entries.slice(offset,offset+1),response=tintinLocalCall_({action:'upsert',entries:batch});
    var remembered={};response.results.forEach(function(result){
      var entry=batch.filter(function(e){return e.id===result.id;})[0];
      remembered['LOCAL_BASE_'+entry.id]=tintinLocalFingerprint_(entry);
      if(entry.kind==='customer')sheet.getRange(entry._row,13).setValue(result.version);
      else (entry.source.rows||[]).forEach(function(row){sheet.getRange(row,entry.kind==='sale'?34:entry.kind==='expense'?36:38).setValue(result.version);});
    });
    properties.setProperties(remembered,false);
  }
}
function tintinLocalFingerprint_(entry) {
  var copy=JSON.parse(JSON.stringify(entry));delete copy.baseVersion;delete copy._row;return tintinLocalHash_(JSON.stringify(copy));
}
function tintinLocalRememberSnapshot_() {
  var book=tintinProductsSpreadsheet_(),properties=tintinLocalProperties_(),baselines=properties.getProperties(),changed={},entries=[];
  var contacts=book.getSheetByName('Clientes de ventas');if(contacts)entries=entries.concat(tintinLocalContacts_(contacts));
  TINTIN_LOCAL_MONTHS.forEach(function(name){var sheet=book.getSheetByName(name);if(sheet)entries=entries.concat(tintinLocalMonthlyRows_(sheet));});
  entries.forEach(function(entry){var key='LOCAL_BASE_'+entry.id,hash=tintinLocalFingerprint_(entry);if(baselines[key]!==hash)changed[key]=hash;});
  if(Object.keys(changed).length)properties.setProperties(changed,false);
}
function tintinLocalPushAll_() {
  var book=tintinProductsSpreadsheet_();if(book.getId()!==TINTIN_LOCAL_BOOK)throw new Error('Libro incorrecto.');
  var contacts=book.getSheetByName('Clientes de ventas');if(contacts)tintinLocalPush_(contacts,tintinLocalContacts_(contacts));
  TINTIN_LOCAL_MONTHS.forEach(function(name){var sheet=book.getSheetByName(name);if(sheet)tintinLocalPush_(sheet,tintinLocalMonthlyRows_(sheet));});
}
function tintinLocalApplySnapshot_(snapshot) {
  var book=tintinProductsSpreadsheet_();
  TINTIN_LOCAL_MONTHS.forEach(function(name,index){
    var sheet=book.getSheetByName(name);if(!sheet)return;
    var entries=snapshot.entries.filter(function(e){return e.month===index+1&&e.year===tintinLocalYear_(sheet);});
    (snapshot.webOrders||[]).forEach(function(order){
      if(!order.createdAt)return;var iso=String(order.createdAt).slice(0,10);
      if(Number(iso.slice(0,4))!==tintinLocalYear_(sheet)||Number(iso.slice(5,7))!==index+1)return;
      var items=order.items||[],shipping=order.shipping||{},payment=order.payment||{};
      entries.push({id:'WEB_'+order.id,kind:'sale',version:order.lastChangeId||String(order.updatedAt||''),orderCode:order.orderNumber||order.id,occurredOn:iso,customerName:order.userName||'',total:order.subtotal,totalGross:order.total,lines:items.length?items.map(function(item){return {type:'Pedido web',detail:item.name||item.title||'',image:item.imageUrl||'',quantity:item.qty==null?item.quantity:item.qty,amount:(Number(item.price)||0)*Number(item.qty||item.quantity||0)};}):[{type:'Pedido web',amount:order.subtotal}],paymentStatus:payment.status||order.paymentStatus||'',paymentMethod:payment.method||order.paymentMethod||'',notes:order.notes||'',city:shipping.city||'',deliveryMethod:shipping.method||'',shippingCost:order.shippingCost});
    });
    var existingRows=sheet.getRange(10,1,Math.max(1,sheet.getLastRow()-9),38).getValues(),existing=existingRows.map(function(row){return row.slice(32,38);}),positions={};
    existing.forEach(function(v,i){[0,2,4].forEach(function(c){if(v[c]){positions[v[c]]=positions[v[c]]||[];positions[v[c]].push(i+10);}});});
    entries.forEach(function(entry){
      var cols=entry.kind==='sale'?[2,17,33]:entry.kind==='expense'?[19,4,35]:[24,4,37];
      var target=positions[entry.id]||[],needed=entry.kind==='sale'?Math.max(1,entry.lines.length):1;
      var total=entry.totalGross==null?Number(entry.total||0)+Number(entry.shippingCost||0):entry.totalGross;
      if(target.length===needed&&target.every(function(row,index){var values=existingRows[row-10];return values[cols[2]]===entry.version&&(entry.archived?values[cols[0]-1]==='':entry.kind!=='sale'||index>0||values[17]===total);})){return;}
      while(target.length<needed){var row=10;while(target.indexOf(row)>=0||sheet.getRange(row,cols[0],1,cols[1]).getValues()[0].some(function(v){return v!=='';}))row++;target.push(row);}
      target.forEach(function(row,i){
        var cells;
        if(entry.archived||i>=needed)cells=Array(cols[1]).fill('');
        else if(entry.kind==='sale') {
          var line=entry.lines[i]||{},rowFields=i?(line.rowFields||{}):entry;
          cells=[entry.orderCode,line.type||'',rowFields.occurredOn||'',rowFields.customerName||'',line.detail||'',line.image||'',line.quantity==null?'':line.quantity,line.cost==null?'':line.cost,line.amount==null?'':line.amount,line.profit==null?'':line.profit,rowFields.paymentStatus||'',rowFields.paymentMethod||'',rowFields.notes||'',rowFields.city||'',rowFields.deliveryMethod||'',rowFields.shippingCost==null?'':rowFields.shippingCost];
          if(!i&&cells[10])cells[10]=({pagado:'Pagado','señado':'Señado',pendiente:'Pendiente',cancelado:'Cancelado',rechazado:'Rechazado',reembolsado:'Reembolsado'})[cells[10]]||cells[10];
          cells.push(i?'':entry.totalGross==null?Number(entry.total||0)+Number(entry.shippingCost||0):entry.totalGross);
        } else if(entry.kind==='expense')cells=[entry.occurredOn,entry.detail,entry.category,entry.amount];
        else cells=[entry.occurredOn,entry.supplier,entry.amount,entry.notes];
        var dateIndex=entry.kind==='sale'?2:0;if(cells[dateIndex])cells[dateIndex]=new Date(cells[dateIndex]+'T15:00:00Z');
        // Datos web validados por su API; los enum históricos no incluyen sus canales.
        if(entry.id.indexOf('WEB_')===0)sheet.getRange(row,cols[0],1,cols[1]).clearDataValidations();
        sheet.getRange(row,cols[0],1,cols[1]).setValues([cells.map(tintinLocalLiteral_)]);sheet.getRange(row,cols[2],1,2).setValues([i>=needed?['','']:[entry.id,entry.version]]);
      });
    });
    // Las fórmulas AC:AF y el formato original nunca se sobrescriben.
  });
  var sheet=book.getSheetByName('Clientes de ventas');
  if(sheet) {
    var customers=snapshot.customers.filter(function(c){return c.orderCount>0&&!c.archived;});
    var rows=customers.map(function(c){return [c.sourceCode||c.id,String(c.lastPurchase||'').slice(0,10),c.name,c.totalPurchased,c.phone||'',c.email||'',c.city||'',c.address||'',c.orderCount,c.notes||'',c.id,c.version||''];});
    sheet.getRange(6,2,1,12).setValues([['Código','Última compra','Clienta / cliente','Total comprado (Gs.)','Teléfono','Email','Ciudad / Distrito','Barrio / dirección','Pedidos','Observaciones','ID cliente','Versión cliente']]);
    if(rows.length)sheet.getRange(7,2,rows.length,12).setValues(rows.map(function(row){return row.map(tintinLocalLiteral_);}));
    if(sheet.getLastRow()>rows.length+6)sheet.getRange(rows.length+7,2,sheet.getLastRow()-rows.length-6,12).clearContent();
  }
}
function tintinReconciliarComercioLocal_() {
  var lock=LockService.getDocumentLock()||LockService.getScriptLock(),message='';if(!lock.tryLock(1000))return {busy:true};
  try {
    // Primero envía cambios pendientes. Si hay conflicto, no borra la edición local.
    tintinLocalPushAll_();var properties=tintinLocalProperties_(),revision=tintinLocalCall_({action:'snapshot',revisionOnly:true}),webSignature=tintinLocalWebSignature_();
    if(properties.getProperty('LOCAL_LAST_REVISION')===revision.revision&&properties.getProperty('LOCAL_LAST_WEB_SIGNATURE')===webSignature)return {unchanged:true,revision:revision.revision};
    var before=tintinLocalCurrentFingerprints_();var snapshot=tintinLocalCall_({action:'snapshot'});
    if(before!==tintinLocalCurrentFingerprints_())throw new Error('La hoja se editó durante la consulta. La edición se conserva; reintentá.');
    tintinLocalApplySnapshot_(snapshot);tintinLocalRememberSnapshot_();
    properties.setProperties({LOCAL_LAST_REVISION:snapshot.revision,LOCAL_LAST_WEB_SIGNATURE:webSignature},false);
    message='Ventas, gastos, compras y clientes reflejados con versión '+snapshot.revision+'.';
    return {entries:snapshot.entries.length,customers:snapshot.customers.length,revision:snapshot.revision};
  } finally {lock.releaseLock();if(message)tintinRecordSyncSafely_('SYNCED','Ventas locales','bidireccional',message);}
}
function tintinLocalWebSignature_() {
  var sheet=tintinProductsSpreadsheet_().getSheetByName('Pedidos web');if(!sheet||sheet.getLastRow()<2)return '';
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,31).getValues().filter(function(row){return row[0]&&String(row[0]).indexOf('LOCAL_')!==0;});
  return tintinLocalHash_(JSON.stringify(rows));
}
function tintinLocalCurrentFingerprints_() {
  var book=tintinProductsSpreadsheet_(),entries=[],contacts=book.getSheetByName('Clientes de ventas');if(contacts)entries=entries.concat(tintinLocalContacts_(contacts));
  TINTIN_LOCAL_MONTHS.forEach(function(name){var sheet=book.getSheetByName(name);if(sheet)entries=entries.concat(tintinLocalMonthlyRows_(sheet));});
  return entries.map(function(e){return e.id+':'+tintinLocalFingerprint_(e);}).sort().join('|');
}
function tintinHandleLocalCommerceEdit_(e) {
  var name=e.range.getSheet().getName();if(TINTIN_LOCAL_MONTHS.indexOf(name)<0&&name!=='Clientes de ventas')return false;
  try {tintinReconciliarComercioLocal_();}catch(error){tintinRecordSyncSafely_('ERROR',name,e.range.getA1Notation(),String(error.message));throw error;}
  return true;
}
// Ejecutar una vez tras publicar el backend. Conserva respaldo completo antes de importar.
function tintinInstalarComercioLocal() {
  var book=tintinProductsSpreadsheet_(),properties=tintinLocalProperties_();
  if(!properties.getProperty('TINTIN_LOCAL_BACKUP_ID')) {
    var copy=book.copy('Respaldo antes de espejo local · '+new Date().toISOString());
    properties.setProperty('TINTIN_LOCAL_BACKUP_ID',copy.getId());
  }
  TINTIN_LOCAL_MONTHS.forEach(function(name){var sheet=book.getSheetByName(name);if(!sheet)return;if(sheet.getMaxColumns()<38)sheet.insertColumnsAfter(sheet.getMaxColumns(),38-sheet.getMaxColumns());sheet.getRange(9,33,1,6).setValues([['ID venta','Versión venta','ID gasto','Versión gasto','ID compra','Versión compra']]);sheet.getRange(9,18).setValue('Total pedido (Gs.)');sheet.setColumnWidth(18,140);});
  var contacts=book.getSheetByName('Clientes de ventas');if(contacts&&contacts.getMaxColumns()<13)contacts.insertColumnsAfter(contacts.getMaxColumns(),13-contacts.getMaxColumns());
  var result=tintinReconciliarComercioLocal_();properties.setProperty('TINTIN_LOCAL_ENABLED','1');return result;
}
