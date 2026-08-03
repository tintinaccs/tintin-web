(function(){
'use strict';
if(window.TintinAccountMobileFixBooted)return;
window.TintinAccountMobileFixBooted=true;

function ready(fn){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
 else fn();
}

/* Esta hoja se carga desde un módulo global para que la misma identidad visual
   llegue a cuenta, carrito, buscador, colecciones, checkout, perfil y modales
   sin tener que repetir un <link> en cada HTML. */
function loadResponsiveBrandStyles(){
 if(document.getElementById('tt-responsive-brand-surfaces-css'))return;
 var link=document.createElement('link');
 link.id='tt-responsive-brand-surfaces-css';
 link.rel='stylesheet';
 link.href=new URL(
  'css/tintin-responsive-brand-surfaces.css?v=tintin-20260803-brand-surfaces-1',
  window.location.href
 ).href;
 document.head.appendChild(link);
}

function injectLegacyStyles(){
 if(document.getElementById('tt-account-mobile-fix-style'))return;
 var st=document.createElement('style');
 st.id='tt-account-mobile-fix-style';
 st.textContent=`#account-dropdown.tt-account-open>.tt-account-panel,#account-dropdown.open>.tt-account-panel{opacity:1!important;visibility:visible!important;transform:translateY(0)!important;pointer-events:auto!important;display:block!important}#account-dropdown.tt-account-open>button,#account-dropdown.open>button{background:var(--pink-pale)!important;color:var(--pink-dark)!important}#tt-header-desktop-tablet .tt-account-panel .tt-account-item{width:100%!important;height:auto!important;min-height:44px!important;justify-content:flex-start!important;overflow:visible!important}.tt-mobile-user-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.tt-mobile-user-action{display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:16px;border:1px solid var(--border);background:#fff;color:#84264f;text-decoration:none;font-size:.86rem;font-weight:700;box-shadow:0 4px 14px rgba(139,38,66,.05);transition:background-color .18s ease}.tt-mobile-user-action:hover{background:var(--pink-pale)}.tt-tabbar-avatar{width:22px!important;height:22px!important;border-radius:50%!important;object-fit:cover!important;display:block!important;max-width:none!important;max-height:none!important}`;
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
 btn.setAttribute('aria-haspopup','true');
 btn.setAttribute('aria-controls','account-panel');
 btn.setAttribute('aria-expanded','false');
 function setAccount(open){
  wrap.classList.toggle('tt-account-open',!!open);
  wrap.classList.toggle('open',!!open);
  btn.setAttribute('aria-expanded',open?'true':'false');
  if(open){
   document.getElementById('tienda-dropdown')?.classList.remove('open');
   document.getElementById('btn-tienda')?.setAttribute('aria-expanded','false');
   document.getElementById('search-panel')?.classList.remove('open');
  }
 }
 btn.addEventListener('click',function(e){
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  setAccount(!wrap.classList.contains('tt-account-open'));
 },true);
 panel.addEventListener('click',function(e){e.stopPropagation();});
 document.addEventListener('click',function(e){if(!wrap.contains(e.target))setAccount(false);},false);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'){setAccount(false);btn.focus();}});
 ['pagehide','beforeunload','hashchange','popstate'].forEach(function(evt){
  addEventListener(evt,function(){setAccount(false)});
 });
}

/* La capa visual sí se carga siempre. El controlador antiguo solo se instala
   cuando la página no tiene el SurfaceController unificado. */
loadResponsiveBrandStyles();

ready(function(){
 cleanTabbarAvatar();
 if(!window.TintinSurfaceController){
  injectLegacyStyles();
  accountDropdown();
 }
 if('MutationObserver'in window){
  var t=0;
  new MutationObserver(function(){
   clearTimeout(t);
   t=setTimeout(cleanTabbarAvatar,80);
  }).observe(document.documentElement,{childList:true,subtree:true});
 }
});
})();
