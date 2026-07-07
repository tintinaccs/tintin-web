(function(){
'use strict';
if(window.TintinAccountMobileFixBooted)return;
window.TintinAccountMobileFixBooted=true;
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
function isCheckout(){var p=(location.pathname||'').toLowerCase();return p.indexOf('checkout')>-1||document.body?.classList.contains('checkout-page')||document.querySelector('.ck-body,.ck-panel,.ck-header');}
function injectStyles(){
 if(document.getElementById('tt-account-mobile-fix-style'))return;
 var st=document.createElement('style');st.id='tt-account-mobile-fix-style';
 st.textContent=`#account-dropdown.tt-account-open>.tt-account-panel,#account-dropdown.open>.tt-account-panel{opacity:1!important;visibility:visible!important;transform:translateY(0)!important;pointer-events:auto!important;display:block!important}#account-dropdown.tt-account-open>button,#account-dropdown.open>button{background:var(--pink-pale)!important;color:var(--pink-dark)!important}.tt-mobile-user-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.tt-mobile-user-action{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:#fff;color:#2B2B2B;text-decoration:none;font-size:.86rem;font-weight:800}.tt-mobile-user-action:hover{background:var(--pink-pale)}.tt-tabbar-avatar{width:22px!important;height:22px!important;border-radius:50%!important;object-fit:cover!important;display:block!important;max-width:none!important;max-height:none!important}@media(max-width:767px){body:not(.tt-checkout-header-excluded) #tt-header{position:sticky!important;top:0!important;z-index:1200!important;min-height:76px!important;padding-top:max(10px,env(safe-area-inset-top))!important;padding-bottom:10px!important;background:rgba(255,246,250,.94)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;box-shadow:0 0 0 rgba(212,106,138,0)!important;transform:translate3d(0,0,0)!important;transition:min-height .34s cubic-bezier(.16,1,.3,1),padding .34s cubic-bezier(.16,1,.3,1),box-shadow .28s ease,background .28s ease,transform .34s cubic-bezier(.16,1,.3,1)!important;will-change:min-height,padding,transform}body:not(.tt-checkout-header-excluded) #tt-header .tt-logo-img{transition:transform .34s cubic-bezier(.16,1,.3,1),max-height .34s cubic-bezier(.16,1,.3,1)!important;transform-origin:left center!important}body:not(.tt-checkout-header-excluded) #tt-header.tt-mobile-expanded{min-height:76px!important;padding-bottom:10px!important}body:not(.tt-checkout-header-excluded) #tt-header.tt-mobile-expanded .tt-logo-img{transform:scale(1)!important}body:not(.tt-checkout-header-excluded) #tt-header.tt-mobile-compact{min-height:58px!important;padding-top:max(6px,env(safe-area-inset-top))!important;padding-bottom:6px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 10px 30px rgba(212,106,138,.14)!important}body:not(.tt-checkout-header-excluded) #tt-header.tt-mobile-compact .tt-logo-img{transform:scale(.84)!important}body:not(.tt-checkout-header-excluded) #tt-header.tt-mobile-hidden{transform:translate3d(0,-110%,0)!important}body:not(.tt-checkout-header-excluded) #tt-header.tt-mobile-open{transform:translate3d(0,0,0)!important}body:not(.tt-checkout-header-excluded) #tt-header.tt-mobile-open.tt-mobile-compact{min-height:58px!important}.tt-mobile-menu.open~#tt-header,#mobile-menu.open+#tt-header{transform:translate3d(0,0,0)!important}}@media(prefers-reduced-motion:reduce){#tt-header,#tt-header .tt-logo-img{transition:none!important;transform:none!important}}`;
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
 var header=document.getElementById('tt-header');
 if(!header)return;
 document.body?.classList.remove('tt-checkout-header-excluded');
 var lastY=scrollY||document.documentElement.scrollTop||0;
 var ticking=false;
 var openUntil=0;
 function hasOpenLayer(){return document.getElementById('mobile-menu')?.classList.contains('open')||document.getElementById('search-panel')?.classList.contains('open')||document.body?.classList.contains('tt-cart-open')||document.documentElement.classList.contains('tt-scroll-locked')||document.documentElement.classList.contains('tt-welcome-scroll-locked');}
 function setState(){
  ticking=false;
  if(innerWidth>=768){header.classList.remove('tt-mobile-expanded','tt-mobile-compact','tt-mobile-hidden','tt-mobile-open','tt-mobile-scrolled');lastY=scrollY||document.documentElement.scrollTop||0;return;}
  var y=scrollY||document.documentElement.scrollTop||0;
  var diff=y-lastY;
  var top=y<=12;
  var forceOpen=Date.now()<openUntil||hasOpenLayer();
  header.classList.toggle('tt-mobile-expanded',top);
  header.classList.toggle('tt-mobile-compact',!top);
  header.classList.toggle('tt-mobile-scrolled',!top);
  if(top||forceOpen||diff<0){header.classList.remove('tt-mobile-hidden');header.classList.add('tt-mobile-open');}
  else if(diff>9&&y>92){header.classList.add('tt-mobile-hidden');header.classList.remove('tt-mobile-open');}
  lastY=y;
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