(function(){
'use strict';
if(window.TintinAdminMobileSidebarFixBooted)return;
window.TintinAdminMobileSidebarFixBooted=true;
var path=(location.pathname||'').toLowerCase();
if(!(path.endsWith('/admin.html')||path.endsWith('/admin')))return;
document.documentElement.classList.add('adm-sidebar-responsive-ready');
import('./maestro/panel-maestro.js?v=tintin-20260831-superadmin-maestro-1').catch(function(error){
  console.error('[SuperAdmin Maestro] No se pudo cargar el panel:',error);
});
})();
