/* =============================================================
   TINTIN — Compatibilidad histórica del módulo Usuarios Fase 8

   La única autoridad activa de Usuarios es js/admin/admin-app.js. Ese módulo
   mantiene el único listener de `users` y concentra filtros, roles, bloqueo,
   restauración, eliminación, acciones masivas, export y consumidores de
   Dashboard / Estadísticas / Correos.

   Este archivo conserva la ruta histórica que todavía carga UI Quality para
   no romper cachés ni despliegues escalonados, pero ya NO mantiene estado,
   listeners ni mutaciones paralelas. Solo delega la ficha detallada al helper
   de solo lectura.
   ============================================================= */

window.TintinAdminUsersPhase8Booted = true;

await import('./ficha-usuario-admin.js?v=tintin-20260828-clientes-ficha-completa-1');
