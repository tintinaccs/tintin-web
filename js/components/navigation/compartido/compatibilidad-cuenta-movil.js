(function(){
'use strict';
if(window.TintinAccountMobileFixBooted)return;
window.TintinAccountMobileFixBooted=true;

function ready(fn){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
 else fn();
}

/* El menú de cuenta vive sólo en SurfaceController (control-paneles.js): este
   módulo ya no abre ni cierra ningún panel, sólo carga las hojas de marca y
   mantiene el avatar de la barra inferior. */
/* Estas hojas siguen cubriendo checkout, perfil y modales heredados. La
   navegación modular ya tiene sus estilos críticos propios y no depende de
   que estas hojas terminen de cargar para mostrarse. */
function loadResponsiveBrandStyles(){
 var files=[
  ['tt-responsive-brand-surfaces-css','css/theme/superficies-marca-responsive-tintin.css?v=tintin-20260909-account-drawer-polish-1-brand-20261004-1-owner-pink-20261004-1-loads-20261007-1-master-20261007-1-encomienda-20261008-1-checkout-20261008-2'],
  ['tt-responsive-brand-polish-css','css/theme/pulido-marca-responsive-tintin.css?v=tintin-20260903-loader-white-brand-2-brand-20261004-1-owner-pink-20261004-1'],
  ['tt-responsive-brand-safety-css','css/theme/seguridad-marca-responsive-tintin.css?v=tintin-20260803-brand-safety-1-brand-20261004-1-owner-pink-20261004-1']
 ];
 files.forEach(function(entry){
  var id=entry[0],href=entry[1];
  if(document.getElementById(id))return;
  var link=document.createElement('link');
  link.id=id;
  link.rel='stylesheet';
  link.href=new URL(href,window.location.href).href;
  document.head.appendChild(link);
 });
}

function bootBrandReveal(){
 if(window.TintinBrandRevealExtensionBooted)return;
 import(new URL('js/quality/extension-revelado-marca.js?v=tintin-20260803-brand-reveal-1-master-20261007-1',window.location.href).href)
  .catch(function(error){console.warn('[TintinBrand] No se pudo cargar el reveal de marca:',error);});
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

function bindAvatarRefreshEvents(){
 var scheduled=0;
 function schedule(){
  clearTimeout(scheduled);
  scheduled=setTimeout(cleanTabbarAvatar,40);
 }
 [
  'tintin:public-shell-ready',
  'tintin:modular-surfaces-ready',
  'tintin:auth-nav-updated',
  'tintin:auth-state-changed',
  'tintin:profile-updated'
 ].forEach(function(eventName){addEventListener(eventName,schedule);});
 document.addEventListener('visibilitychange',function(){if(!document.hidden)schedule();});
 schedule();
}

loadResponsiveBrandStyles();
bootBrandReveal();

ready(bindAvatarRefreshEvents);
})();
