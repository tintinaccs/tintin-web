(function(){
'use strict';
if(window.TintinHomePremiumBooted)return;
window.TintinHomePremiumBooted=true;
var p=(location.pathname||'').toLowerCase();
if(!(p.endsWith('/')||p.endsWith('/index.html')||p===''))return;
function boot(){
 document.body.classList.add('tt-home-premium');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
