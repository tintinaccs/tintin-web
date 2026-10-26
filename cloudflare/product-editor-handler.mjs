import {requireOrderStaff,jsonResponse,statusFromError,rateLimitErrorResponse} from './seguridad-cloudinary.js';
import {saveProductEditor,saveProductBulk} from './product-editor-domain.mjs';
import {queueCatalogSheetSync} from './resiliencia-sync-catalogo.js';
import {productEditorWorkspace} from './product-editor-workspaces.mjs';

// Acción de la API administrativa existente; conserva su guardia de origen y
// permite el techo de roles de Productos antes de entrar al escritor confiable.
export async function handleProductEditor(context,body,origin) {
  const {request,env}=context;
  try {
    const actor=await requireOrderStaff(request,env);
    if(['readProductWork','saveProductWork','listProductWork','discardProductWork'].includes(body.action))return jsonResponse({ok:true,result:await productEditorWorkspace(env,body,actor)},200,origin,request.url);
    const result=body.action==='bulkProducts'?await saveProductBulk(env,body,actor):await saveProductEditor(env,body,actor);
    const ids=result.productId?[result.productId]:result.changes.map(change=>change.id);
    let queued=false;
    try {await queueCatalogSheetSync(env,ids,new Error('Producto guardado desde editor v2'),actor);queued=true;} catch { /* reintento explícito desde el formulario */ }
    return jsonResponse({ok:true,result,sheetsSync:{queued}},200,origin,request.url);
  } catch(error) {
    return rateLimitErrorResponse(error,origin,request.url) || jsonResponse({ok:false,error:error.safe?error.message:error.status===409?'El producto cambió en otra sesión. Actualizá los datos antes de guardar.':'No se pudo guardar el producto.',code:error.code},statusFromError(error,400),origin,request.url);
  }
}
