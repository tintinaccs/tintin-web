/* =============================================================
   TINTIN — Compatibilidad histórica del módulo Usuarios Fase 8

   La única autoridad activa de Usuarios es js/admin/admin-app.js. Ese módulo
   mantiene el único listener de `users` y concentra filtros, roles, bloqueo,
   restauración, eliminación, acciones masivas, export y consumidores de
   Dashboard / Estadísticas / Correos.

   Este archivo conserva la ruta histórica que todavía carga UI Quality para
   no romper cachés ni despliegues escalonados, pero ya NO mantiene estado,
   listeners ni mutaciones paralelas. Solo delega la ficha detallada y su
   presentación integral, sin crear una segunda autoridad de datos.
   ============================================================= */

window.TintinAdminUsersPhase8Booted = true;

await import('./ficha-usuario-admin.js?v=tintin-20261012-auth-privacy-1-ficha-usuario-admin-js-domain-prepared-20261012-5');
await import('./perfil-usuario-superadmin.js?v=tintin-20260829-final-stability-1-brand-runtime-20261004-1-owner-pink-20261004-1');
