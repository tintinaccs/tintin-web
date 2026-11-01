const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../js/admin/carga-secciones-admin.mjs'),'utf8').replace('export function','function');
async function fixture(page){
  await page.setContent('<section id="section-correos"><button id="control">Guardar</button></section><button id="navigation">Otra sección</button>');
  await page.evaluate(source=>{
    window.allowed=true;window.loads=0;window.inits=0;window.fail=false;
    window.start=new Function(source+';return createAdminSectionLoader;')()({document,canLoad:()=>window.allowed,sections:{correos:{load:()=>{window.loads++;return new Promise((resolve,reject)=>{window.finish=()=>window.fail?reject(new Error('Red no disponible')):resolve({});});},init:()=>{window.inits++;}}}});
  },source);
}
test('descarga al abrir, comparte carga, mantiene navegación y reutiliza el módulo',async({page})=>{
  await fixture(page);expect(await page.evaluate(()=>loads)).toBe(0);
  await page.evaluate(()=>{window.first=start('correos');window.second=start('correos');});
  await expect(page.getByRole('status')).toHaveText('Cargando sección…');
  expect(await page.locator('#control').evaluate(n=>n.inert)).toBe(true);
  await page.locator('#navigation').click();
  await page.evaluate(async()=>{finish();await Promise.all([first,second]);await start('correos');});
  expect(await page.evaluate(()=>({loads,inits}))).toEqual({loads:1,inits:1});
  expect(await page.locator('#control').evaluate(n=>n.inert)).toBe(false);
  await expect(page.getByRole('status')).toHaveCount(0);
});
test('rechaza acceso y no inicializa si se pierde la sesión durante la descarga',async({page})=>{
  await fixture(page);
  await page.evaluate(async()=>{allowed=false;await start('correos');});
  expect(await page.evaluate(()=>loads)).toBe(0);
  await page.evaluate(()=>{allowed=true;window.first=start('correos');});
  await page.evaluate(async()=>{allowed=false;finish();await first;});
  expect(await page.evaluate(()=>inits)).toBe(0);
  await expect(page.locator('section')).not.toHaveAttribute('aria-busy');
});
test('un error permite reintentar sin duplicar controladores',async({page})=>{
  await fixture(page);
  await page.evaluate(()=>{fail=true;window.first=start('correos');});
  await page.evaluate(async()=>{finish();await first;});
  await expect(page.getByRole('button',{name:'Reintentar'})).toBeVisible();
  await page.evaluate(()=>{fail=false;});
  await page.getByRole('button',{name:'Reintentar'}).click();
  await page.evaluate(()=>finish());
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(await page.evaluate(()=>({loads,inits}))).toEqual({loads:2,inits:1});
});
