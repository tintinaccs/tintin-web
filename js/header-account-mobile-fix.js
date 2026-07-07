(function(){
'use strict';
if(window.TintinAccountMobileFixBooted)return;
window.TintinAccountMobileFixBooted=true;
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
function injectStyles(){
 if(document.getElementById('tt-account-mobile-fix-style'))return;
 var st=document.createElement('style');st.id='tt-account-mobile-fix-style';
 st.textContent=`#account-dropdown.tt-account-open>.tt-account-panel,#account-dropdown.open>.tt-account-panel{opacity:1!important;visibility:visible!important;transform:translateY(0)!important;pointer-events:auto!important;display:block!important}#account-dropdown.tt-account-open>button,#account-dropdown.open>button{background:var(--pink-pale)!important;color:var(--pink-dark)!important}.tt-mobile-user-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.tt-mobile-user-action{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:#fff;color:#2B2B2B;text-decoration:none;font-size:.86rem;font-weight:800}.tt-mobile-user-action:hover{background:var(--pink-pale)}.tt-tabbar-avatar{width:22px!important;height:22px!important;border-radius:50%!important;object-fit:cover!important;display:block!important;max-width:none!important;max-height:none!important}@media(max-width:767px){#tt-header{transition:min-height .28s ease,padding .28s ease,box-shadow .28s ease,background .28s ease,transform .28s ease!important}#tt-header:not(.tt-mobile-scrolled){min-height:auto!important;transform:none!important}#tt-header.tt-mobile-scrolled{box-shadow:0 10px 30px rgba(212,106,138,.12)!important;background:rgba(255,255,255,.96)!important;backdrop-filter:blur(14px)!important}#tt-header.tt-mobile-scrolled .tt-logo-img{transform:scale(.88);transform-origin:left center;transition:transform .28s ease!important}}`;
 document.head.appendChild(st);
}
ready(function(){
 injectStyles();
 var wrap=document.getElementById('account-dropdown');
 var btn=document.getElementById('btn-cuenta');
 var panel=document.getElementById('account-panel');
 if(btn&&wrap&&panel){
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
 var header=document.getElementById('tt-header');
 if(header){
  function sync(){header.classList.toggle('tt-mobile-scrolled',innerWidth<768&&(scrollY||document.documentElement.scrollTop||0)>18);}
  addEventListener('scroll',function(){requestAnimationFrame(sync)},{passive:true});addEventListener('resize',sync,{passive:true});sync();
 }
});
})();