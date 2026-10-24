export const VISION_WORKER_PATH='/js/admin/products/vision-productos-worker.js';
export const VISION_WORKER_POLICY="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none';";

// Una excepción de compilación WASM no debe abrir eval ni afectar documentos.
export function inspectStaticCsp(source) {
  const policies=[];let route='',detached=false;
  for(const line of source.split(/\r?\n/)) {
    if(line.startsWith('/')){route=line.trim();detached=false;}
    if(line.trim()==='! Content-Security-Policy'){
      if(route!==VISION_WORKER_PATH)throw Error('Sólo el worker local puede sustituir su CSP.');
      detached=true;
    }
    const match=line.match(/^\s+Content-Security-Policy:\s*(.+)$/);
    if(match)policies.push({route,policy:match[1],detached});
  }
  const fallback=policies.find(row=>row.route==='/*'),worker=policies.find(row=>row.route===VISION_WORKER_PATH);
  if(policies.length!==2 || !fallback || !worker || !worker.detached || worker.policy!==VISION_WORKER_POLICY)throw Error('CSP estática o alcance del worker inválidos.');
  if(fallback.policy.includes('wasm-unsafe-eval') || fallback.policy.includes("'unsafe-eval'"))throw Error('El fallback no permite compilar código dinámico.');
  return {fallback:fallback.policy,worker:worker.policy};
}
