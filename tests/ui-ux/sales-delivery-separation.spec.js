const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {load}=require('./helpers/admin-panel-fixture.cjs');
const root=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(root,'js/admin/admin-app.js'),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const script=`
import {orderAmounts,sumOrderAmounts} from '../../js/orders/importes-pedido.mjs';
import {commercePeriodStart,commercePeriodWindow,commerceYear} from '../../js/admin/statistics/periodos-comerciales.mjs';
import {statisticsSince} from '../../js/admin/statistics/modelo-reinicios.mjs';
const currentRole='superadmin',allUsers=[],_allProducts=[],statisticsTrafficSessions=[];
const adminRealtimeReady={orders:true,users:true,traffic:true,presence:true,products:true};
let statisticsRangeDays=7,statisticsSelectedYear=null;
const now=Date.now();const allOrders=[0,8,400,900].map((days,i)=>({id:'sale'+i,createdAt:now-days*86400000,status:'entregado',paymentStatus:'pagado',subtotal:(i+1)*100000,shippingCost:[15000,20000,30000,40000][i],total:(i+1)*100000+[15000,20000,30000,40000][i],items:[]}));
allOrders.push({id:'unknown',createdAt:now,status:'pendiente',total:999999}, {id:'cancelled',createdAt:now,status:'cancelado',shippingCost:999999,total:9999999});
const statisticsSetText=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
const formatPrice=value=>'Gs. '+Math.round(value).toLocaleString('es-PY');
const activityTimestampMillis=value=>Number(value);
const statisticsActivePresence=()=>[],filterStatisticsRows=(metric,rows,timeOf)=>statisticsSince(rows,metric,{},timeOf);
const ensureStatisticsControls=()=>true,refreshStatisticsViews=()=>{},runAdminCrudOperation=()=>{};
const renderStatisticsBars=()=>{},renderStatisticsRanking=()=>{},renderStatisticsTrend=()=>{};
const activityLocationLabel=()=>'',activityPageLabel=()=>'',ORDER_STATUS_LABELS={},PAY_STATUS_LABELS={};
const listenStatisticsTraffic=()=>{};
${section('function statisticsStartDate(','function statisticsDayKey(')}
${section('function statisticsPaymentStatus(','function statisticsActivePresence(')}
${section('function renderGeneralStatistics()','async function listenStatisticsTraffic()')}
${section("const statisticsRangeSelect = document.getElementById('statistics-range');","window.addEventListener('pagehide', stopAdminRealtimeData);")}
document.querySelectorAll('.adm-content > .adm-section').forEach(node=>node.classList.toggle('active',node.id==='section-estadisticas'));
renderGeneralStatistics();window.__financialReady=true;
`;
for(const [width,height]of [[320,800],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080],[844,390]])test(`ventas sin delivery e historia responsive ${width}x${height}`,async({page})=>{
 await load(page,width,'admin.html',{mobile:true,sidebar:true,guard:true,
  transform:shell=>shell.replace('</body>',`<script nonce="dGludGluLWZpeHR1cmU=" type="module">${script}</script></body>`),
  respond:async(route,url)=>{if(url.hostname==='tintin.test'&&/^\/js\/(orders\/importes-pedido|admin\/statistics\/(periodos-comerciales|modelo-reinicios))\.mjs$/.test(url.pathname)){await route.fulfill({path:path.join(root,url.pathname),contentType:'text/javascript'});return true;}return false;}
 });
 await page.setViewportSize({width,height});await page.waitForFunction(()=>window.__financialReady);
 for(const [period,products,delivery]of [['1','100.000','15.000'],['7','100.000','15.000'],['30','300.000','35.000'],['730','600.000','65.000'],['0','1.000.000','105.000']]){
  await page.selectOption('#statistics-range',period);await expect(page.locator('#statistics-revenue')).toHaveText('Gs. '+products);await expect(page.locator('#statistics-delivery')).toHaveText('Gs. '+delivery);
 }
 const historicalYear=await page.evaluate(()=>new Intl.DateTimeFormat('en',{timeZone:'America/Asuncion',year:'numeric'}).format(new Date(Date.now()-900*86400000)));
 await page.selectOption('#statistics-range','year:'+historicalYear);await expect(page.locator('#statistics-revenue')).toHaveText('Gs. 400.000');await expect(page.locator('#statistics-delivery')).toHaveText('Gs. 40.000');
 await page.selectOption('#statistics-range','1');await expect(page.locator('#statistics-revenue-note')).toContainText('1 pedidos sin desglose');await expect(page.locator('#statistics-delivery-note')).toContainText('No es ingreso de Tintín');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 const boxes=await page.locator('#statistics-revenue,#statistics-delivery').evaluateAll(nodes=>nodes.map(node=>{const a=node.getBoundingClientRect(),b=node.closest('article').getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;}));expect(boxes).toEqual([true,true]);
});
