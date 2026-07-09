(function(){
'use strict';
if(window.TintinAccountMobileFixBooted)return;
window.TintinAccountMobileFixBooted=true;
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
function isCheckout(){var p=(location.pathname||'').toLowerCase();return p.indexOf('checkout')>-1||document.body?.classList.contains('checkout-page')||document.querySelector('.ck-body,.ck-panel,.ck-header');}
function isHome(){var p=(location.pathname||'').toLowerCase();return p.endsWith('/')||p.endsWith('/index.html')||p==='';}
function injectStyles(){
 if(document.getElementById('tt-account-mobile-fix-style'))return;
 var st=document.createElement('style');st.id='tt-account-mobile-fix-style';
 // El header mobile "grande que achica al scrollear" está scopeado a
 // body.tt-mobile-home-header (sólo home, sólo <=768px, el mismo corte que
 // usa ".tt-header{display:none!important}" en styles.css) a propósito: en el
 // resto de las páginas el header mobile sigue oculto (sólo tabbar), como
 // antes — ver styles.css ".tt-header{display:none!important}" @768px.
 // position:fixed (no sticky): "html,body{overflow-x:hidden}" (styles.css,
 // global, no se toca acá) convierte a <body> en un contenedor de scroll
 // involuntario y eso rompe position:sticky en la mayoría de los motores —
 // con fixed no pasa (mismo approach que ya usa el header desktop). El hueco
 // que deja fixed al sacar el header del flujo se compensa con
 // body.tt-mobile-home-header{padding-top} medido en vivo por JS (ver
 // syncBodyOffset) en lugar de una constante, para que siempre calce exacto
 // con la altura real del header en cada estado.
 st.textContent=`#account-dropdown.tt-account-open>.tt-account-panel,#account-dropdown.open>.tt-account-panel{opacity:1!important;visibility:visible!important;transform:translateY(0)!important;pointer-events:auto!important;display:block!important}#account-dropdown.tt-account-open>button,#account-dropdown.open>button{background:var(--pink-pale)!important;color:var(--pink-dark)!important}.tt-mobile-user-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.tt-mobile-user-action{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:#fff;color:#2B2B2B;text-decoration:none;font-size:.86rem;font-weight:800}.tt-mobile-user-action:hover{background:var(--pink-pale)}.tt-tabbar-avatar{width:22px!important;height:22px!important;border-radius:50%!important;object-fit:cover!important;display:block!important;max-width:none!important;max-height:none!important}@media(max-width:768px){body.tt-mobile-home-header{transition:padding-top .34s cubic-bezier(.16,1,.3,1)!important}body.tt-mobile-home-header #tt-header{display:block!important;position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:1200!important;min-height:64px!important;padding-top:max(10px,env(safe-area-inset-top))!important;padding-bottom:10px!important;background:rgba(255,246,250,.94)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;box-shadow:0 0 0 rgba(212,106,138,0)!important;transform:translate3d(0,0,0)!important;transition:min-height .34s cubic-bezier(.16,1,.3,1),padding .34s cubic-bezier(.16,1,.3,1),box-shadow .28s ease,background .28s ease,transform .34s cubic-bezier(.16,1,.3,1)!important;will-change:min-height,padding,transform}body.tt-mobile-home-header #tt-header .tt-logo-img{transition:transform .34s cubic-bezier(.16,1,.3,1),max-height .34s cubic-bezier(.16,1,.3,1)!important;transform-origin:left center!important}body.tt-mobile-home-header #tt-header.tt-mobile-expanded{min-height:64px!important;padding-bottom:10px!important}body.tt-mobile-home-header #tt-header.tt-mobile-expanded .tt-logo-img{transform:scale(1)!important}body.tt-mobile-home-header #tt-header.tt-mobile-compact{min-height:50px!important;padding-top:max(6px,env(safe-area-inset-top))!important;padding-bottom:6px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 10px 30px rgba(212,106,138,.14)!important}body.tt-mobile-home-header #tt-header.tt-mobile-compact .tt-logo-img{transform:scale(.84)!important}body.tt-mobile-home-header #tt-header.tt-mobile-hidden{transform:translate3d(0,-110%,0)!important}body.tt-mobile-home-header #tt-header.tt-mobile-open{transform:translate3d(0,0,0)!important}body.tt-mobile-home-header #tt-header.tt-mobile-open.tt-mobile-compact{min-height:50px!important}body.tt-mobile-home-header .tt-mobile-menu.open~#tt-header,body.tt-mobile-home-header #mobile-menu.open+#tt-header{transform:translate3d(0,0,0)!important}}@media(prefers-reduced-motion:reduce){body.tt-mobile-home-header{transition:none!important}body.tt-mobile-home-header #tt-header,body.tt-mobile-home-header #tt-header .tt-logo-img{transition:none!important;transform:none!important}}`;
 document.head.appendChild(st);
}
function cleanTabbarAvatar(){
 var tab=document.getElementById('tabbar-cuenta');
 if(!tab)return;
 var img=tab.querySelector('img.tt-tabbar-avatar,img[src]');
 if(!img)return;
 img.removeAttribute('onerror');
 img.classList.add('tt-tabbar-avatar');
 img.onerror=function(){if(tab.dataset.ttDefaultHtml)tab.innerHTML=tab.dataset.ttDefaultHtml;};
}
function accountDropdown(){
 var wrap=document.getElementById('account-dropdown');
 var btn=document.getElementById('btn-cuenta');
 var panel=document.getElementById('account-panel');
 if(!(btn&&wrap&&panel))return;
 if(!panel.id)panel.id='account-panel';
 btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-controls',panel.id);btn.setAttribute('aria-expanded','false');
 function setAccount(open){
  wrap.classList.toggle('tt-account-open',!!open);wrap.classList.toggle('open',!!open);btn.setAttribute('aria-expanded',open?'true':'false');
  if(open){document.getElementById('tienda-dropdown')?.classList.remove('open');document.getElementById('btn-tienda')?.setAttribute('aria-expanded','false');document.getElementById('search-panel')?.classList.remove('open');}
 }
 btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();setAccount(!wrap.classList.contains('tt-account-open'));},true);
 panel.addEventListener('click',function(e){e.stopPropagation();});
 document.addEventListener('click',function(e){if(!wrap.contains(e.target))setAccount(false);},false);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'){setAccount(false);btn.focus();}});
 ['pagehide','beforeunload','hashchange','popstate'].forEach(function(evt){addEventListener(evt,function(){setAccount(false)})});
}
function mobileHeader(){
 if(isCheckout()){document.body?.classList.add('tt-checkout-header-excluded');return;}
 if(!isHome()){document.body?.classList.remove('tt-mobile-home-header');return;}
 var header=document.getElementById('tt-header');
 if(!header)return;
 document.body?.classList.remove('tt-checkout-header-excluded');
 document.body?.classList.add('tt-mobile-home-header');
 var lastY=scrollY||document.documentElement.scrollTop||0;
 var ticking=false;
 var openUntil=0;
 function hasOpenLayer(){return document.getElementById('mobile-menu')?.classList.contains('open')||document.getElementById('search-panel')?.classList.contains('open')||document.body?.classList.contains('tt-cart-open')||document.documentElement.classList.contains('tt-scroll-locked')||document.documentElement.classList.contains('tt-welcome-scroll-locked');}
 // El header es position:fixed (ver injectStyles) y por lo tanto no reserva
 // su propio espacio en el flujo — este offset en <body> es lo que evita que
 // el hero quede tapado. Se mide la altura real del header (no un valor fijo
 // a mano) para que siempre calce con el estado visual exacto, y en
 // "hidden" se lleva a 0 para que el contenido suba y ocupe ese espacio,
 // igual que en apps mobile de referencia (Instagram, etc.).
 function syncBodyOffset(){
  if(!document.body)return;
  if(header.classList.contains('tt-mobile-hidden')){document.body.style.paddingTop='0px';return;}
  var h=header.getBoundingClientRect().height;
  document.body.style.paddingTop=h?h+'px':'';
 }
 function setState(){
  ticking=false;
  if(innerWidth>768){header.classList.remove('tt-mobile-expanded','tt-mobile-compact','tt-mobile-hidden','tt-mobile-open','tt-mobile-scrolled');lastY=scrollY||document.documentElement.scrollTop||0;if(document.body)document.body.style.paddingTop='';return;}
  var y=scrollY||document.documentElement.scrollTop||0;
  var diff=y-lastY;
  var top=y<=20;
  var forceOpen=Date.now()<openUntil||hasOpenLayer();
  header.classList.toggle('tt-mobile-expanded',top);
  header.classList.toggle('tt-mobile-compact',!top);
  header.classList.toggle('tt-mobile-scrolled',!top);
  if(top||forceOpen||diff<0){header.classList.remove('tt-mobile-hidden');header.classList.add('tt-mobile-open');}
  else if(diff>9&&y>92){header.classList.add('tt-mobile-hidden');header.classList.remove('tt-mobile-open');}
  lastY=y;
  syncBodyOffset();
 }
 function tick(){if(ticking)return;ticking=true;requestAnimationFrame(setState);}
 addEventListener('scroll',tick,{passive:true});
 addEventListener('resize',tick,{passive:true});
 ['touchstart','pointermove','focusin','keydown'].forEach(function(evt){document.addEventListener(evt,function(){openUntil=Date.now()+900;tick();},{passive:true});});
 setState();
 setTimeout(setState,120);
 setTimeout(setState,520);
}
ready(function(){
 injectStyles();
 accountDropdown();
 mobileHeader();
 cleanTabbarAvatar();
 if('MutationObserver'in window){new MutationObserver(function(){cleanTabbarAvatar();}).observe(document.documentElement,{childList:true,subtree:true});}
});
})();