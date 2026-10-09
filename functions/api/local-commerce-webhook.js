import {jsonResponse} from '../../cloudflare/seguridad-cloudinary.js';
import {sheetsInboundSecret} from '../../cloudflare/secretos-sheets.js';
import {localCommerceSnapshot,upsertLocalEntries,LOCAL_REVISION} from '../../cloudflare/comercio-local.js';
function matches(provided,expected){const a=new TextEncoder().encode(provided||''),b=new TextEncoder().encode(expected||'');if(!b.length||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;}
export async function onRequestPost({request,env}) {
  if(!matches(request.headers.get('X-Tintin-Sheets-Secret'),sheetsInboundSecret(env,'admin')))return jsonResponse({ok:false,error:'No autorizado.'},401,'',request.url);
  try {
    const raw=await request.text();if(new TextEncoder().encode(raw).length>256*1024)throw Object.assign(new Error('Solicitud demasiado grande.'),{status:413});
    const input=JSON.parse(raw);
    if(input.action==='snapshot')return jsonResponse({ok:true,protocol:LOCAL_REVISION,...await localCommerceSnapshot(env,{revisionOnly:input.revisionOnly===true})},200,'',request.url);
    return jsonResponse(await upsertLocalEntries(env,input,{uid:'google-sheets',origin:'google-sheets:monthly-commerce'}),200,'',request.url);
  }catch(error){return jsonResponse({ok:false,error:String(error.message||'No se pudo sincronizar.').slice(0,300)},error instanceof SyntaxError?400:error.status||500,'',request.url);}
}
