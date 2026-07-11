(function(){
'use strict';
if(window.TintinLoader)return;
var TT_CACHE_VERSION='tintin-20260711-3';
var MIN_SHOW_MS=520,SAFETY_MS=4200,START=Date.now();
var SCRIPT_SRC=document.currentScript&&document.currentScript.src;
var scrollLockCount=0,savedScrollY=0,previousBodyStyle=null,previousHtmlStyle=null,hidden=false,contentReady=false,logoReady=false,inserted=false,hideGen=0;
function versionUrl(url){try{var u=new URL(url,location.href);u.searchParams.set('v',TT_CACHE_VERSION);return u.href}catch(e){return url+(url.indexOf('?')>-1?'&':'?')+'v='+TT_CACHE_VERSION}}
function resolveAsset(path,withVersion){var url=path;try{if(SCRIPT_SRC)url=new URL('../'+path,SCRIPT_SRC).href}catch(e){}return withVersion===false?url:versionUrl(url)}
function isOldLogo(url){return /logo-splash|logo-tintin|tt-splash-line|tt-intro-fallback/i.test(String(url||''))}
function savedLogo(){try{var data=JSON.parse(localStorage.getItem('tt_images')||'{}');var url=data&&data.logo_main;if(url&&!isOldLogo(url))return url}catch(e){}return ''}
// Imagen del loader según la página: la home usa el logo principal; el
// resto de las páginas usa una imagen "secundaria" configurable acá sin
// tocar el resto del sistema. Hoy no existe un asset distinto para las
// páginas internas (los únicos candidatos son logo-splash/logo-tintin,
// que son los logos viejos retirados — ver isOldLogo()), así que las dos
// constantes apuntan al mismo logo.png por ahora.
var HOME_LOADER_IMAGE='assets-tintin/images/general/logo.png';
var INNER_LOADER_IMAGE='assets-tintin/images/general/logo.png';
function isHomePage(){var path=(location.pathname||'').toLowerCase();return path.endsWith('/index.html')||/\/$/.test(path)}
var DEFAULT_LOGO_SRC=resolveAsset(isHomePage()?HOME_LOADER_IMAGE:INNER_LOADER_IMAGE);
var LOGO_SRC=savedLogo()||DEFAULT_LOGO_SRC;
// Home: únicamente el logo, con animación de entrada + "respiración" (sin
// ring/spinner/aro). Resto de páginas: mismo logo + 3 puntitos debajo (ver
// isHomePage() más abajo, decide qué markup se inserta) — pedido explícito
// para diferenciar el loader de home del de las páginas internas.
var CSS=['html.tt-scroll-locked,html.tt-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}','body.tt-scroll-locked{position:fixed!important;left:0!important;right:0!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important}','#tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#FFF6FA;transition:opacity .38s ease,visibility .38s ease;overflow:hidden;overscroll-behavior:none;touch-action:none}','#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}','#tt-loader-spin-wrap{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center}','#tt-loader-logo{position:relative;z-index:1;width:clamp(180px,15vw,230px);max-width:72vw;height:auto;object-fit:contain;display:block;opacity:0;transform:scale(.96);filter:drop-shadow(0 8px 22px rgba(212,106,138,.18));user-select:none;pointer-events:none}','#tt-loader-spin-wrap.tt-ready #tt-loader-logo{animation:tt-logo-in .5s cubic-bezier(.22,.61,.36,1) both,tt-logo-breathe 2.6s ease-in-out .5s infinite}','@keyframes tt-logo-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}','@keyframes tt-logo-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}','@media (max-width:600px){#tt-loader-logo{width:clamp(110px,30vw,150px)}}','@media (min-width:601px) and (max-width:1120px){#tt-loader-logo{width:clamp(145px,20vw,190px)}}','@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-spin-wrap.tt-ready #tt-loader-logo{animation:none;opacity:1;transform:none}}','.tt-loader-dots{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:20px;opacity:0}','#tt-loader-spin-wrap.tt-ready .tt-loader-dots{opacity:1;transition:opacity .3s ease .15s}','.tt-loader-dots span{width:9px;height:9px;border-radius:50%;background:var(--pink-dark,#D46A8A);opacity:.35;animation:tt-loader-dot-bounce 1.1s ease-in-out infinite}','.tt-loader-dots span:nth-child(2){animation-delay:.15s}','.tt-loader-dots span:nth-child(3){animation-delay:.3s}','@keyframes tt-loader-dot-bounce{0%,80%,100%{transform:scale(.72);opacity:.35}40%{transform:scale(1.15);opacity:1}}','@media (prefers-reduced-motion:reduce){.tt-loader-dots span{animation:none;opacity:.75}}'].join('');
if(!document.getElementById('tt-loader-style')){var st=document.createElement('style');st.id='tt-loader-style';st.textContent=CSS;document.head.appendChild(st)}
function lockScroll(){scrollLockCount+=1;if(scrollLockCount>1)return;savedScrollY=window.scrollY||document.documentElement.scrollTop||0;previousBodyStyle=document.body?{position:document.body.style.position,top:document.body.style.top,left:document.body.style.left,right:document.body.style.right,width:document.body.style.width,overflow:document.body.style.overflow,touchAction:document.body.style.touchAction}:null;previousHtmlStyle={overflow:document.documentElement.style.overflow,overscrollBehavior:document.documentElement.style.overscrollBehavior};document.documentElement.classList.add('tt-scroll-locked');document.documentElement.style.overflow='hidden';document.documentElement.style.overscrollBehavior='none';if(document.body){document.body.classList.add('tt-scroll-locked');document.body.style.position='fixed';document.body.style.top='-'+savedScrollY+'px';document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%';document.body.style.overflow='hidden';document.body.style.touchAction='none'}}
function unlockScroll(){if(scrollLockCount>0)scrollLockCount-=1;if(scrollLockCount>0)return;document.documentElement.classList.remove('tt-scroll-locked');document.documentElement.style.overflow=previousHtmlStyle?previousHtmlStyle.overflow:'';document.documentElement.style.overscrollBehavior=previousHtmlStyle?previousHtmlStyle.overscrollBehavior:'';if(document.body){document.body.classList.remove('tt-scroll-locked');if(previousBodyStyle){document.body.style.position=previousBodyStyle.position;document.body.style.top=previousBodyStyle.top;document.body.style.left=previousBodyStyle.left;document.body.style.right=previousBodyStyle.right;document.body.style.width=previousBodyStyle.width;document.body.style.overflow=previousBodyStyle.overflow;document.body.style.touchAction=previousBodyStyle.touchAction}else{document.body.style.position='';document.body.style.top='';document.body.style.left='';document.body.style.right='';document.body.style.width='';document.body.style.overflow='';document.body.style.touchAction=''}}window.scrollTo(0,savedScrollY||0)}
window.TintinScrollLock={lock:lockScroll,unlock:unlockScroll};
var DOTS_HTML='<div class="tt-loader-dots"><span></span><span></span><span></span></div>';
var el=document.createElement('div');el.id='tt-loader';el.setAttribute('aria-hidden','true');el.setAttribute('role','presentation');el.dataset.state='show';el.innerHTML='<div id="tt-loader-spin-wrap"><img id="tt-loader-logo" src="'+LOGO_SRC+'" alt="" draggable="false" fetchpriority="high" width="220" height="220">'+(isHomePage()?'':DOTS_HTML)+'</div>';
var logo=el.querySelector('#tt-loader-logo');
// Se espera a que la imagen termine de cargar (load/error) antes de dejar
// que el loader se oculte — así en una conexión lenta nunca desaparece
// mostrando el logo a medio decodificar o directamente en blanco.
function markLogoReady(){logoReady=true;var wrap=document.getElementById('tt-loader-spin-wrap');if(wrap)wrap.classList.add('tt-ready');if(contentReady)tryHideElegant()}
logo.addEventListener('load',markLogoReady,{once:true});
logo.addEventListener('error',function onLogoError(){if(logo.src!==DEFAULT_LOGO_SRC){logo.src=DEFAULT_LOGO_SRC}else{logo.removeEventListener('error',onLogoError);logoReady=true;logo.style.display='none';var wrap=document.getElementById('tt-loader-spin-wrap');if(wrap)wrap.classList.add('tt-ready');if(contentReady)tryHideElegant()}});
if(logo.complete&&logo.naturalWidth>0)markLogoReady();
function insert(){if(inserted)return;if(!document.getElementById('tt-loader')&&document.body){inserted=true;document.body.insertBefore(el,document.body.firstChild);requestAnimationFrame(function(){requestAnimationFrame(function(){var img=document.getElementById('tt-loader-logo');var wrap=document.getElementById('tt-loader-spin-wrap');if(img&&img.complete)markLogoReady();else if(wrap)wrap.classList.add('tt-ready')})})}}
function waitForBody(){if(document.body){insert();return}requestAnimationFrame(waitForBody)}
waitForBody();
function hideNow(){
 if(hidden)return;
 hidden=true;
 el.dataset.state='out';
 // El .tt-out del CSS ya pone pointer-events:none, pero se fija acá también
 // como estilo inline (gana cualquier ambigüedad de cascada/timing) para que
 // el primer gesto táctil real nunca quede compitiendo por el hit-test del
 // loader mientras todavía está en el DOM haciendo su fade — esto es lo que
 // en algunos navegadores mobile puede sentirse como que el primer scroll
 // "no responde" aunque visualmente el loader ya esté desapareciendo.
 el.style.touchAction='auto';
 el.style.pointerEvents='none';
 el.classList.add('tt-out');
 var gen=++hideGen;
 function detach(){if(gen!==hideGen)return;if(hidden)el.style.display='none'}
 el.addEventListener('transitionend',detach,{once:true});
 setTimeout(detach,450);
}
function tryHideElegant(){if(hidden)return;var enough=Date.now()-START>=MIN_SHOW_MS;if(!enough||!logoReady){var wait=Math.max(0,MIN_SHOW_MS-(Date.now()-START));setTimeout(tryHideElegant,Math.max(wait,140));return}el.dataset.state='ready';hideNow()}
function ready(){if(contentReady)return;contentReady=true;tryHideElegant()}
function show(){hideGen++;hidden=false;contentReady=false;logoReady=!!(logo&&logo.complete);el.dataset.state='show';el.style.display='';el.style.touchAction='';el.style.pointerEvents='';el.classList.remove('tt-out')}
function setText(){}
function importSibling(fileName,label){var url='js/'+fileName;try{if(SCRIPT_SRC)url=new URL(fileName,SCRIPT_SRC).href}catch(e){}url=versionUrl(url);return import(url).catch(function(e){console.warn('[PageLoader] No se pudo cargar '+label+':',e)})}
function bootGlobalQuality(){if(!window.TintinUIQualityBooted)importSibling('ui-quality.js','UI Quality')}
function bootStoreGate(){if(!window.TT_DISABLE_STORE_GATE&&!window.TintinStoreGateBooted){window.TintinStoreGateBooted=true;importSibling('store-gate.js','Store Gate')}}
function bootHeaderMode(){if(!window.TintinHeaderModeBooted)importSibling('mobile-header-mode.js','Header Mode')}
function bootHeaderDropdownFix(){if(!window.TintinHeaderDropdownFixBooted)importSibling('header-dropdown-fix.js','Header Dropdown Fix')}
function bootHeaderScrollHide(){if(!window.TintinHeaderScrollHideBooted)importSibling('header-scroll-hide.js','Header Scroll Hide')}
function bootAdminAndProfileFixes(){var path=(location.pathname||'').toLowerCase();if(path.endsWith('/admin.html')||path.endsWith('/admin')){importSibling('admin-order-delete-fix.js','Admin Order Delete Fix');importSibling('admin-welcome-control.js','Admin Welcome Control');importSibling('admin-mobile-sidebar-fix.js','Admin Mobile Sidebar Fix')}if(path.endsWith('/perfil.html')||path.endsWith('/perfil'))importSibling('profile-order-stats-fix.js','Profile Order Stats Fix')}
function bootScrollReveal(){if(!window.TintinGlobalScrollRevealBooted)importSibling('scroll-reveal-global.js','Global Scroll Reveal')}
bootGlobalQuality();bootStoreGate();bootHeaderMode();bootHeaderDropdownFix();bootHeaderScrollHide();bootAdminAndProfileFixes();bootScrollReveal();
document.addEventListener('tintin:page-ready',ready);if(!window.TT_PAGE_LOADER_WAIT)window.addEventListener('load',ready);setTimeout(function(){logoReady=true;ready();hideNow()},SAFETY_MS);
window.TintinLoader={ready:ready,hide:hideNow,show:show,setText:setText,lockScroll:lockScroll,unlockScroll:unlockScroll};window.ttPageReady=ready;
})();
