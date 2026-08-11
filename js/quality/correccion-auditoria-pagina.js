(function(){
'use strict';
if(window.TintinPageAuditFixBooted)return;
window.TintinPageAuditFixBooted=true;
var VERSION='tintin-20260810-fast-nav-2';
var WA_EXCLUDE='.tt-wa-float,.tt-tabbar,.tt-privacy-consent,.tt-search-panel,.tt-cart-drawer,.tt-collections-sheet,.tt-header';
var WA_PATH=(location.pathname||'').toLowerCase().replace(/\/+$/,'');
var WA_REQUIRED_EVENT=/\/(?:terminos|privacidad)(?:\.html)?$/.test(WA_PATH)
 ? 'tintin:legal-layout-ready'
 : /\/collections(?:\.html)?$/.test(WA_PATH)
  ? 'tintin:collections-layout-ready'
  : '';
function isHome(){var p=(location.pathname||'').toLowerCase();return p.endsWith('/')||p.endsWith('/index.html')||p==='';}
function isAdminPage(){var p=(location.pathname||'').toLowerCase().replace(/\/+$/,'');return /\/admin(?:\.html)?$/.test(p)||/\/admin-images(?:\.html)?$/.test(p);}
function versionUrl(url){try{var u=new URL(url,location.href);if(u.origin!==location.origin)return url;if(!/\.css$/i.test(u.pathname))return url;if(u.searchParams.get('v')===VERSION)return url;u.searchParams.set('v',VERSION);return u.href}catch(e){return url;}}
function versionLocalCssLinks(){if(isAdminPage())return;document.querySelectorAll('link[href$=".css"],link[href*=".css?"]').forEach(function(link){var href=link.getAttribute('href')||'';var next=versionUrl(href);if(next!==href){link.setAttribute('href',next);link.setAttribute('data-tt-css-versioned','true');}})}
function addStyle(){
 if(document.getElementById('tt-page-audit-fix-style'))return;
 var st=document.createElement('style');st.id='tt-page-audit-fix-style';
 st.textContent='html.tt-home-splash-clean,html.tt-home-splash-clean body{background:var(--tt-page-bg,#FFF6FA)!important}html.tt-home-splash-clean #tt-intro{background:var(--tt-page-bg,#FFF6FA)!important;gap:0!important}html.tt-home-splash-clean #tt-intro-fallback,html.tt-home-splash-clean .tt-splash-line{display:none!important;visibility:hidden!important;opacity:0!important}html.tt-home-splash-clean #tt-intro-logo{width:clamp(112px,24vw,210px)!important;max-width:72vw!important;height:auto!important;object-fit:contain!important;filter:drop-shadow(0 8px 22px rgba(212,106,138,.18))!important}.tt-page-audit-ready{--tt-page-audit:ready}.tt-wa-float.tt-wa-float-hidden,.tt-wa-float.tt-wa-overlap-hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;animation:none!important;transition:none!important}';
 document.head.appendChild(st);
}
function replaceOldPreloads(){
 document.querySelectorAll('link[rel="preload"][href*="logo-splash"],link[rel="preload"][href*="logo-tintin"]').forEach(function(link){link.href='assets-tintin/images/general/logo.png?v='+VERSION;link.setAttribute('data-tt-old-logo-preload-fixed','true');});
}
function cleanHomeSplash(){
 if(!isHome())return;
 if(!document.documentElement.classList.contains('tt-home-splash-clean'))document.documentElement.classList.add('tt-home-splash-clean');
 replaceOldPreloads();
 document.querySelectorAll('#tt-intro-fallback,.tt-splash-line').forEach(function(el){el.remove();});
 document.querySelectorAll('#tt-intro-logo').forEach(function(img){
  if(!img)return;
  img.alt='';
  if(!img.src||/logo-splash|logo-tintin/i.test(img.src))img.src='assets-tintin/images/general/logo.png?v='+VERSION;
  img.addEventListener('error',function(){img.style.display='none';},{once:true});
 });
}
function overlaps(a,b,t){t=t||2;return a.left<b.right-t&&a.right>b.left+t&&a.top<b.bottom-t&&a.bottom>b.top+t;}
function visible(node,requireViewport){
 if(!node)return false;
 var style=getComputedStyle(node),r=node.getBoundingClientRect();
 if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity||1)<=.01||r.width<=0||r.height<=0)return false;
 return !requireViewport||(r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth);
}
function checkWhatsAppOverlap(){
 var mobile=window.matchMedia?window.matchMedia('(max-width: 768px)').matches:innerWidth<=768;
 document.querySelectorAll('.tt-wa-float').forEach(function(wa){
  var collided=false;
  if(mobile){
   var wr=wa.getBoundingClientRect();
   if(wr.width>0&&wr.height>0){
    collided=[].slice.call(document.querySelectorAll('a,button')).some(function(node){
     if(node===wa||node.closest(WA_EXCLUDE)||!visible(node,true))return false;
     return overlaps(wr,node.getBoundingClientRect(),2);
    });
   }
  }
  wa.classList.toggle('tt-wa-overlap-hidden',collided);
  if(collided){
   if(!wa.hasAttribute('data-tt-wa-prev-tabindex'))wa.setAttribute('data-tt-wa-prev-tabindex',wa.getAttribute('tabindex')||'');
   wa.setAttribute('tabindex','-1');
   wa.setAttribute('aria-hidden','true');
  }else{
   if(wa.hasAttribute('data-tt-wa-prev-tabindex')){
    var previous=wa.getAttribute('data-tt-wa-prev-tabindex');
    wa.removeAttribute('data-tt-wa-prev-tabindex');
    if(previous)wa.setAttribute('tabindex',previous);else wa.removeAttribute('tabindex');
   }
   wa.removeAttribute('aria-hidden');
  }
 });
 return true;
}
var waTicking=false;
var waInitialReady=false;
function requestWhatsAppCheck(){
 if(waTicking)return;
 waTicking=true;
 requestAnimationFrame(function(){waTicking=false;checkWhatsAppOverlap();});
}
function handleFiniteLayoutChange(){
 checkWhatsAppOverlap();
 setTimeout(checkWhatsAppOverlap,0);
 setTimeout(checkWhatsAppOverlap,80);
}
function markWhatsAppReady(){
 if(waInitialReady)return;
 checkWhatsAppOverlap();
 waInitialReady=true;
 document.documentElement.classList.add('tt-wa-overlap-ready');
}
function requiredLayoutAlreadyReady(){
 if(!WA_REQUIRED_EVENT)return true;
 if(WA_REQUIRED_EVENT==='tintin:legal-layout-ready')return !!document.body?.classList.contains('tt-legal-runtime-ready');
 if(WA_REQUIRED_EVENT==='tintin:collections-layout-ready')return !!document.body?.classList.contains('tt-collections-runtime-ready');
 return false;
}
function bootWhatsAppOverlapGuard(){
 if(window.TintinWaOverlapGuard)return;
 window.TintinWaOverlapGuard={checkNow:checkWhatsAppOverlap,refresh:handleFiniteLayoutChange,markReady:markWhatsAppReady};
 window.addEventListener('scroll',requestWhatsAppCheck,{passive:true});
 window.addEventListener('resize',requestWhatsAppCheck,{passive:true});
 [
  'tintin:products-loaded','tintin:products-error','tintin:collections-updated',
  'tintin:collections-phase4-ready','tintin:catalog-layout-ready',
  'tintin:collections-layout-ready','tintin:legal-layout-ready',
  'tintin:page-ready','tintin:store-gate-state','tintin:color-scheme-applied'
 ].forEach(function(name){window.addEventListener(name,handleFiniteLayoutChange,{passive:true});});
 if(WA_REQUIRED_EVENT){
  window.addEventListener(WA_REQUIRED_EVENT,function(){
   handleFiniteLayoutChange();
   setTimeout(markWhatsAppReady,0);
  },{passive:true});
 }
 document.addEventListener('load',handleFiniteLayoutChange,true);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(handleFiniteLayoutChange).catch(function(){});
 checkWhatsAppOverlap();
 if(requiredLayoutAlreadyReady())markWhatsAppReady();
 else setTimeout(markWhatsAppReady,4000);
 [50,180,350,800,1500,3000].forEach(function(delay){setTimeout(checkWhatsAppOverlap,delay);});
 var waSettlePolls=0;
 var waSettleTimer=setInterval(function(){
  checkWhatsAppOverlap();
  waSettlePolls+=1;
  if(waSettlePolls>=20)clearInterval(waSettleTimer);
 },100);
 window.dispatchEvent(new CustomEvent('tintin:wa-overlap-ready'));
}
function mark(){
 if(document.documentElement.classList.contains('tt-page-audit-ready'))return;
 document.documentElement.classList.add('tt-page-audit-ready');
}
function run(){versionLocalCssLinks();cleanHomeSplash();bootWhatsAppOverlapGuard();mark();}
function boot(){addStyle();run();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();