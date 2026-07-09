(function(){
'use strict';
if(window.TintinPageAuditFixBooted)return;
window.TintinPageAuditFixBooted=true;
var VERSION='tintin-20260709-2';
function isHome(){var p=(location.pathname||'').toLowerCase();return p.endsWith('/')||p.endsWith('/index.html')||p==='';}
function isCheckout(){var p=(location.pathname||'').toLowerCase();return p.indexOf('checkout')>-1||document.body?.classList.contains('checkout-page')||document.querySelector('.ck-body,.ck-panel,.ck-header');}
function versionUrl(url){try{var u=new URL(url,location.href);if(u.origin!==location.origin)return url;if(!/\.css$/i.test(u.pathname))return url;if(u.searchParams.get('v')===VERSION)return url;u.searchParams.set('v',VERSION);return u.href}catch(e){return url;}}
function versionLocalCssLinks(){document.querySelectorAll('link[href$=".css"],link[href*=".css?"]').forEach(function(link){var href=link.getAttribute('href')||'';var next=versionUrl(href);if(next!==href){link.setAttribute('href',next);link.setAttribute('data-tt-css-versioned','true');}})}
function addStyle(){
 if(document.getElementById('tt-page-audit-fix-style'))return;
 var st=document.createElement('style');st.id='tt-page-audit-fix-style';
 st.textContent='html.tt-home-splash-clean,html.tt-home-splash-clean body{background:var(--tt-page-bg,#FFF6FA)!important}html.tt-home-splash-clean #tt-intro{background:var(--tt-page-bg,#FFF6FA)!important;gap:0!important}html.tt-home-splash-clean #tt-intro-fallback,html.tt-home-splash-clean .tt-splash-line{display:none!important;visibility:hidden!important;opacity:0!important}html.tt-home-splash-clean #tt-intro-logo{width:clamp(112px,24vw,210px)!important;max-width:72vw!important;height:auto!important;object-fit:contain!important;filter:drop-shadow(0 8px 22px rgba(212,106,138,.18))!important}body.tt-checkout-header-excluded #tt-header,body.tt-checkout-header-excluded .tt-header{display:none!important}.tt-page-audit-ready{--tt-page-audit:ready}';
 document.head.appendChild(st);
}
function replaceOldPreloads(){
 document.querySelectorAll('link[rel="preload"][href*="logo-splash"],link[rel="preload"][href*="logo-tintin"]').forEach(function(link){link.href='assets-tintin/images/general/logo.png?v='+VERSION;link.setAttribute('data-tt-old-logo-preload-fixed','true');});
}
function cleanHomeSplash(){
 if(!isHome())return;
 document.documentElement.classList.add('tt-home-splash-clean');
 replaceOldPreloads();
 document.querySelectorAll('#tt-intro-fallback,.tt-splash-line').forEach(function(el){el.remove();});
 document.querySelectorAll('#tt-intro-logo').forEach(function(img){
  if(!img)return;
  img.alt='';
  if(!img.src||/logo-splash|logo-tintin/i.test(img.src))img.src='assets-tintin/images/general/logo.png?v='+VERSION;
  img.addEventListener('error',function(){img.style.display='none';},{once:true});
 });
}
function ensureCheckoutExclusion(){if(isCheckout())document.body?.classList.add('tt-checkout-header-excluded');}
function mark(){document.documentElement.classList.add('tt-page-audit-ready');}
function run(){versionLocalCssLinks();ensureCheckoutExclusion();cleanHomeSplash();mark();}
function boot(){addStyle();run();if('MutationObserver'in window){var t=0;new MutationObserver(function(){clearTimeout(t);t=setTimeout(run,80);}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','class','id']});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();