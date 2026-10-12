import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Merge only successful discovery attachments: the test writes actions.json
// after all assertions. DOM discovery itself never certifies a business action.
const root=path.resolve(import.meta.dirname,'..');
const input=path.join(root,'artifacts/real-interactions/runtime-tests');
const output=path.join(root,'docs/agent/evidence/client-actions-20261012/runtime-observations.json');
const observations=[];
const report=JSON.parse(fs.readFileSync(path.join(root,'artifacts/real-interactions/runtime-results.json'),'utf8'));
function visit(suite){
  for(const spec of suite.specs||[])for(const test of spec.tests||[])for(const result of test.results||[]){
    if(result.status!=='passed')continue;
    const attachment=(result.attachments||[]).find(item=>item.name==='action-discovery');
    if(!attachment?.path)continue;
    const file=path.resolve(root,attachment.path);
    if(!file.startsWith(input+path.sep))throw new Error('Discovery attachment outside runtime output');
    observations.push(JSON.parse(fs.readFileSync(file,'utf8')));
  }
  for(const child of suite.suites||[])visit(child);
}
for(const suite of report.suites||[])visit(suite);
observations.sort((a,b)=>a.route.localeCompare(b.route)||a.project.localeCompare(b.project));
const testFile='tests/runtime/client-navigation-actions.spec.js';
const testHash=createHash('sha256').update(fs.readFileSync(path.join(root,testFile))).digest('hex');
if(!observations.length)throw new Error('No successful runtime discovery evidence');
const applicationCommit=observations[0].applicationCommit;
if(!/^[a-f0-9]{40}$/.test(applicationCommit||''))throw new Error('Discovery lacks an application commit');
execFileSync('git',['cat-file','-e',applicationCommit+'^{commit}'],{cwd:root});
if(observations.some(item=>item.testHash!==testHash||item.applicationCommit!==applicationCommit))throw new Error('Discovery belongs to another test source or application commit');
const catalog=new Map();
const contexts=observations.map(observation=>({route:observation.route,project:observation.project,role:observation.role,
  viewport:observation.viewport,
  states:observation.records.map(state=>{
    const occurrences=new Map();
    const visible=[],disabled=[],present=[];
    for(const control of state.controls){
      const signature=JSON.stringify([observation.route,control.tag,control.id,control.href,control.label,control.type]);
      const ordinal=occurrences.get(signature)||0;occurrences.set(signature,ordinal+1);
      const id=createHash('sha256').update(signature+':'+ordinal).digest('hex').slice(0,16);
      if(!catalog.has(id)){
        const {visible,disabled,...definition}=control;
        catalog.set(id,{id,route:observation.route,...definition,result:'PENDING',discovery:'runtime-dom',verifiedScenarios:[]});
      }
      const knownClose=['btn-search-close','btn-cart-close','btn-account-close'];
      const knownPanel=['search-panel','cart-drawer','account-drawer'];
      const normalOpen=observation.route!=='/login'&&state.state==='initial-guest'&&knownPanel.includes(control.ariaControls);
      const normalClose=state.state.endsWith('-open')&&knownClose.includes(control.id);
      const loginReturn=observation.route==='/login'&&state.state==='initial-guest'&&control.tag==='a'&&control.label==='Volver a la tienda'&&control.href==='/';
      const tablet=observation.records.some(record=>record.state==='tablet-menu-open')&&[
        ['initial-guest','btn-menu-tablet'],['tablet-menu-open','btn-tablet-tienda'],
        ['tablet-categories-open','btn-tablet-cats-back'],['tablet-menu-open','btn-tablet-close']
      ].some(([stage,selector])=>state.state===stage&&control.id===selector);
      if(control.visible&&(normalOpen||normalClose||loginReturn||tablet)){
        const item=catalog.get(id);item.result='PARTIAL';
        item.verifiedScenarios.push({scenario:loginReturn?'guest-return-to-store':tablet?'guest-tablet-menu':normalOpen?'guest-panel-open':'guest-panel-close',
          project:observation.project,viewport:observation.viewport,testFile,
          expected:loginReturn?'Navegar al inicio':normalOpen?'Abrir '+control.ariaControls:normalClose?'Cerrar el panel':'Abrir/cambiar/cerrar vista tablet'});
      }
      present.push(id);if(control.visible)visible.push(id);if(control.disabled)disabled.push(id);
    }
    return {state:state.state,present,visible,disabled};
  })}));
const result={schemaVersion:1,scope:'client-navigation-guest',applicationCommit,testFile,testHash,
  discoveryComplete:false,
  limitation:'DOM de estados visitados. Sólo apertura/cierre por puntero de búsqueda, carrito y cuenta y ausencia de notificaciones sin sesión están probados por esta suite. Los controles interiores y otras acciones descubiertas siguen pendientes.',
  counts:{contexts:observations.length,routes:new Set(observations.map(item=>item.route)).size,distinctControls:catalog.size,
    partiallyVerified:[...catalog.values()].filter(control=>control.result==='PARTIAL').length,fullyVerified:0},
  controls:[...catalog.values()],contexts};
fs.mkdirSync(path.dirname(output),{recursive:true});
const {controls,contexts:recordedContexts,...summary}=result;
const summaryText=JSON.stringify(summary,null,2).slice(0,-2);
fs.writeFileSync(output,summaryText+',\n  "controls": [\n'+controls.map(item=>'    '+JSON.stringify(item)).join(',\n')+'\n  ],\n  "contexts": [\n'+recordedContexts.map(item=>'    '+JSON.stringify(item)).join(',\n')+'\n  ]\n}\n');
const rows=[...new Set(observations.map(item=>item.route))].map(route=>{
  const found=controls.filter(item=>item.route===route);
  return `| ${route} | ${observations.filter(item=>item.route===route).length} | ${found.length} | ${found.filter(item=>item.result==='PARTIAL').length} | 0 |`;
});
fs.writeFileSync(path.join(path.dirname(output),'runtime-summary.md'),
  '# Inventario dinámico del cliente — navegación sin sesión\n\n'+
  `Aplicación ejecutada: \`${applicationCommit}\`. Prueba: \`${testFile}\`, SHA256 \`${testHash}\`.\n\n`+
  `${observations.length} contextos de navegación aprobados en Chromium escritorio, Pixel 7 y WebKit iPhone 13, incluidos tablet vertical/horizontal. Emulación, no dispositivos físicos. Login es una pantalla independiente: sus paneles públicos no aplican; volver a la tienda sí se ejecuta.\n\n`+
  '| Ruta | Contextos | Controles observados | Con escenarios parciales verificados | Completamente aprobados |\n| --- | ---: | ---: | ---: | ---: |\n'+rows.join('\n')+'\n\n'+
  'Las aperturas/cierres por puntero, retorno desde login y menú tablet tienen aserciones. Encontrar controles interiores no prueba su comportamiento: siguen PENDING. Teclado, sesión cliente y estados comerciales requieren sus propios resultados. Este informe no representa 100% de descubrimiento o de cobertura.\n');
console.log(JSON.stringify(result.counts));
