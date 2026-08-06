(function(){
'use strict';
if(window.TintinAdminMobileSidebarFixBooted)return;
window.TintinAdminMobileSidebarFixBooted=true;
var path=(location.pathname||'').toLowerCase();
if(!(path.endsWith('/admin.html')||path.endsWith('/admin')))return;
document.documentElement.classList.add('adm-sidebar-responsive-ready');
})();
