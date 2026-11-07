const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=fs.readFileSync('js/quality/calidad-interfaz.js','utf8');
const links=source.slice(source.indexOf('function links()'),source.indexOf('// Los guards'));
test('refrescar enlaces ya normalizados no vuelve a mutar el DOM',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(code=>{
  const root=document.createElement('section');document.body.replaceChildren(root);
  for(let i=0;i<200;i++){const a=document.createElement('a');a.href='https://example.invalid/product/'+i;a.textContent='Enlace '+i;root.append(a);}
  const refresh=new Function(code+';return links;')();refresh();
  const observer=new MutationObserver(()=>{});observer.observe(root,{subtree:true,attributes:true});
  const start=performance.now();for(let i=0;i<10;i++)refresh();const ms=performance.now()-start;
  const writes=observer.takeRecords().length;observer.disconnect();
  const first=root.firstElementChild;first.href='https://example.invalid/updated';first.rel='opener';first.target='';refresh();
  return {writes,ms,rel:first.rel,target:first.target,count:root.children.length};
 },links);
 console.log('LINK_REFRESH_MEASURE',JSON.stringify(result));
 expect(result.writes).toBe(0);expect(result.rel).toBe('noopener noreferrer');expect(result.target).toBe('_blank');expect(result.count).toBe(200);
});
