// Única fuente de verdad para "¿esta página es del panel de administración?"
// — analytics.js, site-activity.js, cart-recovery.js y privacy-consent.js la
// comparten para que una página de admin nueva (ej. admin-reports.html)
// quede excluida de las cuatro a la vez, no solo de las que se acuerden de
// actualizar su propio regex.
export function isAdminPage() {
  const path = location.pathname.replace(/\/+$/, '');
  const lastSegment = path.split('/').filter(Boolean).pop() || '';
  return /^admin(?:-[a-z0-9-]+)?(?:\.html)?$/i.test(lastSegment);
}
