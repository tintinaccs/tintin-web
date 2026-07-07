(function(){
'use strict';
if(window.TintinAdminMobileSidebarFixBooted)return;
window.TintinAdminMobileSidebarFixBooted=true;
var path=(location.pathname||'').toLowerCase();
if(!(path.endsWith('/admin.html')||path.endsWith('/admin')))return;
function inject(){
 if(document.getElementById('tt-admin-mobile-sidebar-fix-style'))return;
 var st=document.createElement('style');st.id='tt-admin-mobile-sidebar-fix-style';
 st.textContent=`@media(max-width:540px){:root{--sidebar-w:68px!important}.adm-sidebar{display:flex!important;position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:68px!important;height:100svh!important;z-index:320!important;overflow-y:auto!important;overflow-x:hidden!important;transform:none!important}.adm-main{margin-left:68px!important;padding-bottom:0!important;min-width:0!important}.adm-mobile-tabs{display:none!important}.adm-hamburger{display:none!important}.adm-topbar{position:sticky!important;top:0!important;z-index:280!important;padding:12px 12px!important;gap:8px!important}.adm-topbar-title{font-size:15px!important;min-width:0!important}.adm-topbar-btn{padding:8px 10px!important;font-size:10px!important;white-space:nowrap!important}.adm-content{padding:12px!important}.adm-sidebar-logo,.adm-user-info .adm-user-name,.adm-user-info .adm-user-role-badge,.adm-user-info .adm-live-clock,.adm-nav-divider{display:none!important}.adm-user-info{justify-content:center!important;padding:12px 0!important}.adm-user-avatar{width:38px!important;height:38px!important}.adm-nav{padding:8px 0!important}.adm-nav-item{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;width:100%!important;padding:10px 2px!important;font-size:8px!important;line-height:1.1!important;letter-spacing:.03em!important;text-align:center!important;white-space:normal!important}.adm-nav-icon{font-size:19px!important;width:auto!important}.adm-nav-bottom{padding:8px 0 14px!important}}`;
 document.head.appendChild(st);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();