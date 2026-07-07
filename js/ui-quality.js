(function(){
'use strict';
if(window.TintinUIQualityBooted)return;
window.TintinUIQualityBooted=1;
function css(){
 if(document.getElementById('tt-ui-quality-css'))return;
 var l=document.createElement('link');
 l.id='tt-ui-quality-css';l.rel='stylesheet';l.href=new URL('../css/ui-quality.css',import.meta.url).href;
 document.head.appendChild(l);
}
function parity(){document.documentElement.classList.add('tt-parity-guard')}
function adminMobileSidebar(){
 var path=(location.pathname||'').toLowerCase();
 if(!(path.endsWith('/admin.html')||path.endsWith('/admin')))return;
 if(document.getElementById('tt-admin-mobile-sidebar-runtime-style'))return;
 var st=document.createElement('style');st.id='tt-admin-mobile-sidebar-runtime-style';
 st.textContent='@media(max-width:540px){:root{--sidebar-w:68px!important}.adm-sidebar{display:flex!important;position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:68px!important;height:100svh!important;z-index:320!important;overflow-y:auto!important;overflow-x:hidden!important;transform:none!important}.adm-main{margin-left:68px!important;padding-bottom:0!important;min-width:0!important}.adm-mobile-tabs{display:none!important}.adm-hamburger{display:none!important}.adm-topbar{position:sticky!important;top:0!important;z-index:280!important;padding:12px 12px!important;gap:8px!important}.adm-topbar-title{font-size:15px!important;min-width:0!important}.adm-topbar-btn{padding:8px 10px!important;font-size:10px!important;white-space:nowrap!important}.adm-content{padding:12px!important}.adm-sidebar-logo,.adm-user-info .adm-user-name,.adm-user-info .adm-user-role-badge,.adm-user-info .adm-live-clock,.adm-nav-divider{display:none!important}.adm-user-info{justify-content:center!important;padding:12px 0!important}.adm-user-avatar{width:38px!important;height:38px!important}.adm-nav{padding:8px 0!important}.adm-nav-item{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;width:100%!important;padding:10px 2px!important;font-size:8px!important;line-height:1.1!important;letter-spacing:.03em!important;text-align:center!important;white-space:normal!important}.adm-nav-icon{font-size:19px!important;width:auto!important}.adm-nav-bottom{padding:8px 0 14px!important}}';
 document.head.appendChild(st);
}
function topOnReload(){
 try{history.scrollRestoration='manual'}catch(e){}
 var n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
 var r=n?n.type==='reload':(performance.navigation&&performance.navigation.type===1);
 if(!r)return;
 var t=function(){try{scrollTo({top:0,left:0,behavior:'instant'})}catch(e){scrollTo(0,0)}document.documentElement.scrollTop=0;if(document.body)document.body.scrollTop=0};
 t();requestAnimationFrame(t);addEventListener('load',function(){t();setTimeout(t,120);setTimeout(t,320)},{once:true});
}
function media(){
 document.querySelectorAll('img').forEach(function(img,i){
  if(!img.hasAttribute('loading')&&i>1)img.loading='lazy';
  if(!img.hasAttribute('decoding'))img.decoding='async';
  if(!img.hasAttribute('referrerpolicy'))img.referrerPolicy='no-referrer';
  img.addEventListener('error',function(){img.classList.add('tt-img-error')},{once:true});
 });
}
function links(){
 document.querySelectorAll('a[href]').forEach(function(a){
  var href=a.getAttribute('href')||'';
  if(/^javascript:/i.test(href)){a.removeAttribute('href');a.setAttribute('role','button');return;}
  try{
   var u=new URL(href,location.href);
   if(u.origin!==location.origin){a.rel='noopener noreferrer';if(!a.target)a.target='_blank';}
  }catch(e){}
 });
}
function forms(){
 document.addEventListener('submit',function(e){
  var f=e.target;if(!f||!f.matches||!f.matches('form'))return;
  if(f.dataset.ttSubmitting==='1'){e.preventDefault();return;}
  f.dataset.ttSubmitting='1';
  setTimeout(function(){delete f.dataset.ttSubmitting},4500);
 },true);
 document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest?e.target.closest('button,[role="button"],a.tt-btn,.tt-btn'):null;
  if(!b)return;
  var now=Date.now();
  var last=Number(b.dataset.ttLastClick||0);
  if(now-last<320){e.preventDefault();e.stopPropagation();return;}
  b.dataset.ttLastClick=String(now);
 },true);
}
function singleLogoLoader(){
 var logo='assets-tintin/images/general/logo.png';
 document.querySelectorAll('#tt-loader-line,#tt-loader-text,#tt-loader-dots,.tt-splash-line,#tt-intro-fallback').forEach(function(el){el.remove()});
 document.querySelectorAll('#tt-loader-logo,#tt-intro-logo').forEach(function(img){
  if(!img||img.dataset.ttSingleLogo)return;
  img.dataset.ttSingleLogo='1';img.alt='';img.removeAttribute('aria-label');
  if(img.src.indexOf('logo.png')===-1)img.src=logo;
  img.addEventListener('error',function(){img.style.display='none'},{once:true});
 });
}
function observeDom(){
 if(!('MutationObserver'in window))return;
 var timer=0;
 var obs=new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(function(){parity();adminMobileSidebar();singleLogoLoader();media();links()},80)});
 obs.observe(document.documentElement,{childList:true,subtree:true});
}
function boot(){
 css();parity();adminMobileSidebar();document.documentElement.classList.add('tt-ui-ready');
 singleLogoLoader();media();links();forms();topOnReload();observeDom();
 setTimeout(function(){parity();adminMobileSidebar();singleLogoLoader();media();links()},420);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();