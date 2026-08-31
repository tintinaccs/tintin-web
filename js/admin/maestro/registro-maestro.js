export const MAESTRO_SCHEMA_VERSION = 1;

export const BASE_ADMIN_SECTIONS = Object.freeze([
  'dashboard', 'estadisticas', 'usuarios', 'pedidos', 'productos', 'resenas',
  'me-gusta', 'colecciones', 'paginas', 'importar', 'mensajes',
  'notificaciones-push', 'auditoria', 'diagnostico', 'correos',
  'configuracion', 'permisos', 'apariencia'
]);

const NO = 'no';
const YES = 'yes';
const GUARDED = 'guarded';
const NA = 'na';

function capabilities(overrides = {}) {
  return Object.freeze({
    create: NO,
    read: YES,
    update: NO,
    archive: NO,
    delete: NO,
    search: NO,
    export: NO,
    sync: NO,
    audit: YES,
    permissions: YES,
    ...overrides
  });
}

function moduleDef(id, label, policy, description, caps, extra = {}) {
  return Object.freeze({
    id,
    label,
    section: extra.section ?? id,
    surface: extra.surface || 'section',
    policy,
    description,
    capabilities: capabilities(caps),
    quickAction: extra.quickAction || null,
    evidence: Object.freeze(extra.evidence || [])
  });
}

export const MAESTRO_MODULES = Object.freeze([
  moduleDef('maestro', 'Maestro', 'governance', 'Centro de control, cobertura CRUD y salud del Super Admin.', {
    read: YES, export: YES
  }, { surface: 'dynamic', evidence: ['js/admin/maestro/panel-maestro.js'] }),

  moduleDef('dashboard', 'Dashboard', 'read-only', 'Resumen operativo y actividad reciente. No representa una entidad editable.', {
    read: YES
  }, { evidence: ['section-dashboard', 'dash-recent-orders'] }),

  moduleDef('estadisticas', 'Estadísticas', 'read-only', 'Indicadores en vivo. Crear, editar o borrar estadísticas no tiene sentido operacional.', {
    read: YES, search: YES
  }, { evidence: ['section-estadisticas', 'statistics-range'] }),

  moduleDef('usuarios', 'Usuarios', 'lifecycle', 'Las cuentas nacen por Auth/registro. Super Admin administra rol, bloqueo, restauración y exportación sin hard-delete de identidad.', {
    read: YES, update: YES, archive: YES, search: YES, export: YES, sync: GUARDED, delete: NO
  }, { evidence: ['users-bulk-block-btn', 'users-bulk-restore-btn', 'bulkExportUsers'] }),

  moduleDef('pedidos', 'Pedidos', 'crud-protected', 'CRUD operativo completo. El borrado normal pasa por papelera, libera inventario y permite restaurar; el borrado final queda protegido.', {
    create: YES, read: YES, update: YES, archive: YES, delete: GUARDED, search: YES, export: YES, sync: YES
  }, {
    quickAction: { type: 'global', path: 'TintinOrderAdmin.openManualOrder', label: 'Nuevo pedido' },
    evidence: ['TintinOrderAdmin.openManualOrder', 'TintinOrderAdmin.openAdvancedOrderEditor', 'trashOrder', 'restoreOrder']
  }),

  moduleDef('productos', 'Productos', 'crud', 'CRUD completo de catálogo, inventario, precio, visibilidad, multimedia y variantes.', {
    create: YES, read: YES, update: YES, archive: YES, delete: GUARDED, search: YES, export: YES, sync: YES
  }, {
    quickAction: { type: 'selector', selector: '#btn-nuevo-producto', label: 'Nuevo producto' },
    evidence: ['btn-nuevo-producto', 'prod-save-btn', 'bulk-delete-btn', 'prod-export-all-btn']
  }),

  moduleDef('resenas', 'Reseñas', 'moderation', 'Moderación de reseñas y comentarios. No se crean reseñas haciéndose pasar por clientas.', {
    read: YES, update: GUARDED, archive: YES, delete: GUARDED, search: YES, export: YES, sync: YES
  }, { evidence: ['section-resenas', 'gestion-participacion-admin-v2.js'] }),

  moduleDef('me-gusta', 'Me gusta', 'moderation', 'Lectura y administración de participación social; no se fabrican likes desde Super Admin.', {
    read: YES, update: GUARDED, archive: YES, delete: GUARDED, search: YES, export: YES, sync: YES
  }, { evidence: ['section-me-gusta', 'gestion-participacion-admin-v2.js'] }),

  moduleDef('colecciones', 'Colecciones', 'crud', 'CRUD completo de colecciones, visibilidad, orden y asignación de productos.', {
    create: YES, read: YES, update: YES, archive: YES, delete: GUARDED, search: YES, export: YES, sync: YES
  }, {
    quickAction: { type: 'selector', selector: '#btn-nueva-coleccion', label: 'Nueva colección' },
    evidence: ['btn-nueva-coleccion', 'coll-save-btn', 'coll-bulk-delete-btn', 'bulkExportCollections']
  }),

  moduleDef('paginas', 'Páginas', 'content-crud', 'Contenido administrable por página con publicación sincronizada al sitio público.', {
    create: GUARDED, read: YES, update: YES, archive: YES, delete: GUARDED, search: YES, export: YES, sync: YES
  }, { evidence: ['section-paginas', 'tt-pages-admin-root'] }),

  moduleDef('importar', 'Import / Export', 'utility', 'Herramienta de migración y exportación. No es una colección CRUD por sí misma.', {
    create: GUARDED, read: YES, update: GUARDED, search: YES, export: YES, sync: YES
  }, { evidence: ['section-importar', 'js/admin/importacion-admin.js'] }),

  moduleDef('imagenes', 'Imágenes', 'asset-crud', 'Biblioteca externa de imágenes con alta, lectura, organización y eliminación controlada.', {
    create: YES, read: YES, update: YES, archive: YES, delete: GUARDED, search: YES, export: NO, sync: YES
  }, { section: null, surface: 'external', quickAction: { type: 'url', url: '/admin-images', label: 'Abrir imágenes' }, evidence: ['/admin-images'] }),

  moduleDef('mensajes', 'Mensajes', 'integration', 'Centro de contacto vía WhatsApp. No almacena conversaciones privadas como una base CRUD interna.', {
    read: YES, sync: YES
  }, { evidence: ['section-mensajes', 'mensajes-wa-link'] }),

  moduleDef('notificaciones-push', 'Notificaciones push', 'lifecycle', 'Administración de dispositivos y envío de notificaciones con altas/bajas controladas.', {
    create: GUARDED, read: YES, update: YES, archive: YES, delete: GUARDED, search: YES, sync: YES
  }, { evidence: ['section-notificaciones-push'] }),

  moduleDef('auditoria', 'Auditoría', 'immutable', 'Registro inmutable de trazabilidad. Puede buscarse/exportarse, nunca editarse ni borrarse desde el panel.', {
    read: YES, search: YES, export: YES, update: NO, archive: NO, delete: NO
  }, { evidence: ['section-auditoria', 'bulkExportAuditLog'] }),

  moduleDef('diagnostico', 'Diagnóstico', 'read-only-action', 'Inspección de plataforma en modo de solo lectura con exportación de evidencia.', {
    read: YES, search: YES, export: YES
  }, {
    quickAction: { type: 'selector', selector: '#btn-run-site-diagnostics', label: 'Ejecutar diagnóstico' },
    evidence: ['btn-run-site-diagnostics', 'Modo de solo lectura']
  }),

  moduleDef('correos', 'Correos', 'content-crud', 'Configuración, plantillas, promociones e historial del canal de correo.', {
    create: YES, read: YES, update: YES, archive: YES, delete: GUARDED, search: YES, export: YES, sync: YES
  }, { evidence: ['section-correos', 'correos-tabs'] }),

  moduleDef('configuracion', 'Configuración', 'configuration', 'Configuración global, tienda, envíos, pagos y datos operativos con cambios auditados.', {
    create: GUARDED, read: YES, update: YES, archive: GUARDED, delete: GUARDED, search: YES, export: YES, sync: YES
  }, { evidence: ['section-configuracion', 'cfg-store-open'] }),

  moduleDef('permisos', 'Roles y Permisos', 'security', 'Gobierno de acceso. Solo Super Admin puede administrar roles y permisos.', {
    create: GUARDED, read: YES, update: GUARDED, archive: GUARDED, delete: NO, search: YES, export: YES, sync: YES
  }, { evidence: ['section-permisos', 'nav-permisos'] }),

  moduleDef('apariencia', 'Apariencia y contenido', 'configuration', 'Edición visual y de contenido sincronizada con las superficies públicas.', {
    create: GUARDED, read: YES, update: YES, archive: GUARDED, delete: GUARDED, search: YES, export: YES, sync: YES
  }, { evidence: ['section-apariencia', 'nav-apariencia'] }),

  moduleDef('welcome', 'Mensaje de bienvenida', 'content-crud', 'Configuración dinámica del tutorial de bienvenida y sus pasos.', {
    create: YES, read: YES, update: YES, archive: YES, delete: YES, search: NO, export: NO, sync: YES
  }, { section: 'welcome', surface: 'dynamic', evidence: ['section-welcome', 'nav-welcome', 'control-bienvenida-admin.js'] })
]);

export const MAESTRO_BY_ID = new Map(MAESTRO_MODULES.map(item => [item.id, item]));

export function getMaestroModule(id) {
  return MAESTRO_BY_ID.get(String(id || '').trim()) || null;
}

export function capabilityLabel(value) {
  if (value === YES) return 'Sí';
  if (value === GUARDED) return 'Protegido';
  if (value === NA) return 'N/A';
  return 'No';
}

export const CAPABILITY_VALUES = Object.freeze({ YES, NO, GUARDED, NA });
