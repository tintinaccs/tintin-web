// Contexto comercial permitido: nunca copiar búsquedas, formularios o URLs completas.
const PAGES = {index:'Inicio',catalogo:'Catálogo',collections:'Colecciones',product:'Producto',checkout:'Checkout',perfil:'Mi cuenta',login:'Acceso',nosotros:'Sobre Tintin',about:'Sobre Tintin',contact:'Contacto','preguntas-frecuentes':'Preguntas frecuentes','cambios-devoluciones':'Cambios y devoluciones',envios:'Envíos',contacto:'Contacto',faq:'Preguntas frecuentes',cambios:'Cambios',terminos:'Términos',privacidad:'Privacidad','404':'Página no encontrada'};
export const CHECKOUT_STEPS = ['Carrito','Envío','Datos','Pago','Confirmación'];
export const ACTIVITY_ACTIONS = Object.freeze({panel_open:'Abrió un panel',view:'Visitó',validation_error:'No pudo avanzar por una validación',cart_add:'Agregó al carrito',cart_remove:'Quitó del carrito',cart_open:'Abrió el carrito',search:'Buscó productos',checkout_progress:'Procesando confirmación',checkout_confirm:'Intentó confirmar el pedido',checkout_error:'La confirmación devolvió un error',order_confirmed:'Pedido confirmado',payment_pending:'Pago pendiente',payment_cancelled:'Canceló el pago',payment_error:'El pago devolvió un error'});
const STATUSES = new Set(['reviewing','confirming','confirmed','error','payment_pending']);
const SECTIONS = new Set(['resumen','datos','pedidos','cuenta','ayuda']);
const slug = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value) ? value : '';
export function normalizeActivityContext(value = {}) {
  if(!value || typeof value!=='object' || Array.isArray(value))value={};
  const page = typeof value.page==='string' && Object.hasOwn(PAGES,value.page) ? value.page : 'other';
  const result = {page};
  if(['cart','account','search','menu','notifications'].includes(value.surface))result.surface=value.surface;
  if (page === 'catalogo' || page === 'collections') { const category=slug(value.category); if(category && category!=='todos')result.category=category; }
  if (page === 'product' && typeof value.productId==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value.productId))result.productId=value.productId;
  if (page === 'perfil' && SECTIONS.has(value.section)) result.section=value.section;
  if (page === 'checkout') {
    if(Number.isInteger(value.step)&&value.step>=0&&value.step<CHECKOUT_STEPS.length)result.step=value.step;
    if(STATUSES.has(value.status))result.status=value.status;
    if(['preparing','profile','guard','server'].includes(value.phase))result.phase=value.phase;
    if(['stock','network','session','shipping','payment','invoice','configuration','unknown'].includes(value.reason))result.reason=value.reason;
  }
  return result;
}
export function contextFromLocation({pathname='/',search='',step,section,status,reason,phase,surface}={}) {
  const page=pathname.replace(/^\/+|\/+$/g,'').replace(/\.html$/,'')||'index';
  const params=new URLSearchParams(search);
  return normalizeActivityContext({page,category:params.get('cat'),productId:params.get('id'),step,section,status,reason,phase,surface});
}
export function activityContextLabel(value, fallback='/') {
  const c=value ? normalizeActivityContext(value) : contextFromLocation({pathname:String(fallback).split('?')[0]});
  let label=PAGES[c.page]||'Otra página';
  if(c.category) label=`Catálogo de ${c.category.replace(/[-_]/g,' ')}`;
  if(c.page==='checkout' && c.step!==undefined)label+=` · Paso ${c.step+1} de 5: ${CHECKOUT_STEPS[c.step]}`;
  if(c.section)label+=` · ${c.section[0].toUpperCase()+c.section.slice(1)}`;
  if(c.productId)label+=` · ${c.productId}`;
  const surface={cart:'Mi carrito',account:'Panel de cuenta',search:'Buscador',menu:'Menú',notifications:'Notificaciones'}[c.surface];if(surface)label+=` · ${surface}`;
  const state={confirming:'Confirmando pedido',confirmed:'Pedido confirmado',error:'Error en este paso',payment_pending:'Esperando pago'}[c.status];
  const reason={stock:'Stock o producto no disponible',network:'Conexión o tiempo de espera',session:'Sesión o acceso',shipping:'Entrega o dirección',payment:'Método de pago',invoice:'Datos de facturación',configuration:'Configuración de la tienda',unknown:'Motivo no clasificado'}[c.reason];
  if(state)label+=` · ${state}`;
  const phase={preparing:'Verificando sesión y configuración',profile:'Guardando preferencias',guard:'Verificando el intento de compra',server:'Esperando respuesta de la tienda'}[c.phase];
  if(phase && c.status==='confirming')label+=` · ${phase}`;
  return reason ? `${label} · ${reason}` : label;
}
export function normalizeActivityEvent(value, now=Date.now()) {
  if(!value || typeof value.action!=='string' || !Object.hasOwn(ACTIVITY_ACTIONS,value.action) || typeof value.id!=='string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(value.id))return null;
  const at=Number(value.at);
  if(!Number.isFinite(at)||at>now+5000||at<now-86400000)return null;
  return {id:value.id,at,action:value.action,context:normalizeActivityContext(value.context)};
}
export function activityPeriodDays(period,anchor) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor))return [];
  const date=new Date(`${anchor}T12:00:00Z`);if(Number.isNaN(+date)||date.toISOString().slice(0,10)!==anchor)return [];
  let count=1;
  if(period==='week'){const day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);count=7;}
  if(period==='month'){date.setUTCDate(1);count=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();}
  return Array.from({length:count},(_,i)=>new Date(+date+i*86400000).toISOString().slice(0,10)).reverse();
}

export function checkoutFailureReason(code) {
  code=String(code||'');
  if(/stock|product_(inactive|not_found)|variant/.test(code))return 'stock';
  if(/timeout|unavailable|network|fetch|offline/.test(code))return 'network';
  if(/session|login|permission|auth|profile_(blocked|incomplete)/.test(code))return 'session';
  if(/shipping|address|map_|reference|encomienda/.test(code))return 'shipping';
  if(/payment|paypal/.test(code))return 'payment';
  if(/invoice|ruc|razon|taxpayer|ci_invalid/.test(code))return 'invoice';
  if(/settings|store_closed|quote_changed/.test(code))return 'configuration';
  return 'unknown';
}

export function activityPresenceLabel(item,now=Date.now()) {
  const label=activityContextLabel(item?.context,item?.page);
  const since=new Date(item?.contextSince?.toDate?.()||item?.contextSince).getTime();
  if(item?.context?.status==='confirming' && Number.isFinite(since) && now-since>=45000) {
    return `${label} · Sin resultado registrado hace ${Math.max(1,Math.floor((now-since)/60000))} min`;
  }
  return label;
}
