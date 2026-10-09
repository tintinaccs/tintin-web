import { jsonResponse,originIsAllowed,preflightResponse,requireSuperAdmin } from '../../cloudflare/seguridad-cloudinary.js';
import { localCommerceSnapshot,upsertLocalEntries } from '../../cloudflare/comercio-local.js';
export async function onRequest({request,env}) {
  const origin=request.headers.get('origin')||'',url=request.url;
  if(origin && !originIsAllowed(origin,url))return jsonResponse({ok:false,error:'Origen no permitido.'},403,origin,url);
  if(request.method==='OPTIONS')return preflightResponse(origin,url,'GET, POST, OPTIONS');
  if(!['GET','POST'].includes(request.method))return jsonResponse({ok:false,error:'Método no permitido.'},405,origin,url);
  try {
    const actor=await requireSuperAdmin(request);
    if(request.method==='GET')return jsonResponse({ok:true,...await localCommerceSnapshot(env,{revisionOnly:new URL(url).searchParams.get('view')==='revision'})},200,origin,url);
    if(!origin)return jsonResponse({ok:false,error:'Origen obligatorio.'},403,origin,url);
    const raw=await request.text();if(new TextEncoder().encode(raw).length>256*1024)throw Object.assign(new Error('Solicitud demasiado grande.'),{status:413});
    return jsonResponse(await upsertLocalEntries(env,JSON.parse(raw),{...actor,origin:'superadmin:local-commerce'}),200,origin,url);
  }catch(error){return jsonResponse({ok:false,error:String(error.message||'No se pudo sincronizar.').slice(0,300)},error instanceof SyntaxError?400:error.status||500,origin,url);}
}
