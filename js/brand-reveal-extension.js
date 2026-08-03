(function(){
'use strict';
if(window.TintinBrandRevealExtensionBooted)return;
window.TintinBrandRevealExtensionBooted=true;

var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var selector=[
 '.login-mobile-logo',
 '.tt-map-block',
 '.perfil-card',
 '.perfil-section',
 '.ck-panel',
 '.ck-summary-card',
 '.tt-account-drawer-header',
 '.tt-account-drawer .tt-account-header',
 '.tt-account-drawer .tt-account-item',
 '.tt-cart-header',
 '.tt-sheet-header',
 '.modal-header',
 '.adm-modal-header'
].join(',');

function injectStyles(){
 if(document.getElementById('tt-brand-reveal-extension-style'))return;
 var style=document.createElement('style');
 style.id='tt-brand-reveal-extension-style';
 style.textContent=`
  .tt-brand-reveal{opacity:0;transform:translate3d(0,16px,0) scale(.988);transition:opacity .54s cubic-bezier(.16,1,.3,1),transform .54s cubic-bezier(.16,1,.3,1);transition-delay:var(--tt-brand-reveal-delay,0ms);will-change:opacity,transform}
  .tt-brand-reveal.tt-brand-revealed{opacity:1!important;transform:none!important;visibility:visible!important;will-change:auto!important}
  .tt-account-drawer-header.tt-brand-reveal{transform:translate3d(18px,0,0) scale(.992)}
  @media(max-width:767px){.tt-brand-reveal{transform:translate3d(0,11px,0) scale(.995);transition-duration:.42s}}
  @media(prefers-reduced-motion:reduce){.tt-brand-reveal{opacity:1!important;transform:none!important;transition:none!important;will-change:auto!important}}
 `;
 document.head.appendChild(style);
}

var observer=null;
function reveal(el){
 if(!el||el.classList.contains('tt-brand-revealed'))return;
 el.classList.add('tt-brand-revealed');
 observer&&observer.unobserve(el);
}

function eligible(el){
 if(!el||!el.isConnected)return false;
 if(el.classList.contains('tt-brand-revealed')||el.classList.contains('tt-brand-reveal'))return false;
 if(el.closest('[hidden]'))return false;
 return el.getClientRects().length>0;
}

function prepare(root){
 var list=[];
 if(root&&root.matches&&root.matches(selector))list.push(root);
 if(root&&root.querySelectorAll)list.push.apply(list,root.querySelectorAll(selector));
 list.filter(eligible).forEach(function(el,index){
  el.classList.add('tt-brand-reveal');
  el.style.setProperty('--tt-brand-reveal-delay',Math.min(index%5,4)*34+'ms');
  if(reduced){reveal(el);return;}
  if(!observer){
   observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){if(entry.isIntersecting)reveal(entry.target);});
   },{threshold:.04,rootMargin:'0px 0px -5% 0px'});
  }
  observer.observe(el);
 });
}

function revealOpenedSurfaces(){
 document.querySelectorAll('.tt-account-drawer.open,.tt-cart-drawer.open,.tt-collections-sheet.open,.modal.open,.adm-modal.open').forEach(function(surface){
  surface.querySelectorAll(selector).forEach(reveal);
 });
}

function boot(){
 injectStyles();
 prepare(document);
 if('MutationObserver'in window){
  var timer=0;
  new MutationObserver(function(records){
   clearTimeout(timer);
   timer=setTimeout(function(){
    records.forEach(function(record){
     record.addedNodes.forEach(function(node){if(node.nodeType===1)prepare(node);});
    });
    revealOpenedSurfaces();
   },40);
  }).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
 }
 document.addEventListener('tintin:page-ready',function(){prepare(document);},{passive:true});
 window.addEventListener('tintin:surface-change',function(){
  requestAnimationFrame(function(){prepare(document);revealOpenedSurfaces();});
 });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
