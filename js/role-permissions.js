// =============================================
// TINTIN ACCESORIOS — Permisos dinámicos por rol
// =============================================
//
// `PERMISSIONS` de roles.js continúa siendo el techo fijo. Este archivo solo
// permite ACOTAR acciones conocidas. Firestore nunca puede inventar módulos,
// acciones, roles ni valores diferentes de booleanos.

import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { PERMISSIONS, SUPER_ADMIN } from './roles.js';

export const ROLE_PERM_DOC = { col: 'rolePermissions', id: 'main' };
export const ROLE_PERMISSIONS_SCHEMA_VERSION = 2;
export const EDITABLE_ROLES = Object.freeze(['admin', 'agent', 'viewer']);

export const PERMISSION_MODULES = {
  dashboard: {
    label: 'Dashboard',
    actions: {
      ver:                 { label: 'Ver dashboard',            defaultFrom: 'viewDashboard', rolesEditable: ['admin','agent','viewer'] },
      verMetricas:         { label: 'Ver métricas de pedidos',   defaultFrom: 'viewDashboard', rolesEditable: ['admin','agent','viewer'] },
      verVentas:           { label: 'Ver ventas del mes',        defaultFrom: 'viewDashboard', rolesEditable: ['admin','agent','viewer'] },
      verPedidosRecientes: { label: 'Ver pedidos recientes',     defaultFrom: 'viewDashboard', rolesEditable: ['admin','agent','viewer'] },
    }
  },
  pedidos: {
    label: 'Pedidos',
    actions: {
      ver:               { label: 'Ver pedidos',                defaultFrom: 'viewOrders',       rolesEditable: ['admin','agent','viewer'] },
      crearManual:       { label: 'Crear pedido manual',         implemented: false, note: 'No existe hoy una función para crear un pedido a mano desde el Admin.' },
      editarCompleto:    { label: 'Editar pedido completo',      defaultFrom: 'manageOrdersFull', rolesEditable: ['admin','agent'] },
      cambiarEstado:     { label: 'Cambiar estado de pedido',    defaultFrom: 'manageOrders',     rolesEditable: ['admin','agent'] },
      cambiarPago:       { label: 'Cambiar estado de pago',      defaultFrom: 'manageOrders',     rolesEditable: ['admin','agent'] },
      reenviarCorreo:    { label: 'Reenviar correo',             defaultFrom: 'manageOrders',     rolesEditable: ['admin','agent'] },
      exportar:          { label: 'Exportar pedidos',            defaultFrom: 'manageOrders',     rolesEditable: ['admin','agent','viewer'] },
      eliminar:          { label: 'Eliminar pedido',             defaultFrom: 'manageOrdersFull', rolesEditable: ['admin'], dangerous: true },
      accionesMasivas:   { label: 'Acciones masivas',            defaultFrom: 'manageOrders',     rolesEditable: ['admin','agent'], dangerous: true },
      verDatosSensibles: { label: 'Ver datos sensibles del cliente (email/teléfono)', defaultFrom: 'viewOrders', rolesEditable: ['admin','agent','viewer'], uiOnly: true },
      verDireccion:      { label: 'Ver dirección/ubicación',     defaultFrom: 'viewOrders',       rolesEditable: ['admin','agent','viewer'], uiOnly: true },
    }
  },
  productos: {
    label: 'Productos',
    actions: {
      ver:               { label: 'Ver productos',              defaultFrom: 'addProducts',    rolesEditable: ['admin','agent','viewer'] },
      crear:             { label: 'Crear producto',              defaultFrom: 'addProducts',    rolesEditable: ['admin','agent','viewer'] },
      editar:            { label: 'Editar producto (incluye precio y stock)', defaultFrom: 'editProducts', rolesEditable: ['admin','agent'] },
      activarDesactivar: { label: 'Activar/desactivar producto', defaultFrom: 'editProducts',   rolesEditable: ['admin','agent'] },
      duplicar:          { label: 'Duplicar producto',           implemented: false, note: 'No existe hoy un botón Duplicar para productos.' },
      exportar:          { label: 'Exportar productos',          defaultFrom: 'editProducts',   rolesEditable: ['admin','agent','viewer'] },
      eliminar:          { label: 'Eliminar producto',           defaultFrom: 'deleteProducts', rolesEditable: ['admin'], dangerous: true },
      accionesMasivas:   { label: 'Acciones masivas',            defaultFrom: 'editProducts',   rolesEditable: ['admin','agent'], dangerous: true },
    }
  },
  colecciones: {
    label: 'Colecciones',
    actions: {
      ver:               { label: 'Ver colecciones',             defaultFrom: 'manageContent',    rolesEditable: ['admin','agent','viewer'] },
      crear:             { label: 'Crear colección',              defaultFrom: 'manageContent',    rolesEditable: ['admin','agent'] },
      editar:            { label: 'Editar colección (incluye orden)', defaultFrom: 'manageContent', rolesEditable: ['admin','agent'] },
      activarDesactivar: { label: 'Activar/desactivar colección', defaultFrom: 'manageContent',    rolesEditable: ['admin','agent'] },
      destacar:          { label: 'Destacar colección',           implemented: false, note: 'Las colecciones no tienen hoy un campo destacada.' },
      eliminar:          { label: 'Eliminar colección',           defaultFrom: 'deleteCollections', rolesEditable: ['admin'], dangerous: true, note: 'Solo elimina colecciones sin productos asociados.' },
    }
  },
  contenido: {
    label: 'Contenido',
    actions: {
      ver:                       { label: 'Ver contenido',                  defaultFrom: 'manageContent', rolesEditable: ['admin','agent','viewer'] },
      editarTextos:              { label: 'Editar textos',                  defaultFrom: 'manageContent', rolesEditable: ['admin','agent'] },
      activarDesactivarSecciones:{ label: 'Activar/desactivar secciones',   defaultFrom: 'manageContent', rolesEditable: ['admin','agent'] },
      restaurar:                 { label: 'Restaurar contenido original',   defaultFrom: 'manageContent', rolesEditable: ['admin','agent'], dangerous: true },
      eliminar:                  { label: 'Eliminar contenido',             implemented: false, note: 'Contenido se edita; no se borra una sección.' },
    }
  },
};

export function buildDefaultRolePermissions() {
  const output = {};
  EDITABLE_ROLES.forEach(role => {
    output[role] = {};
    Object.entries(PERMISSION_MODULES).forEach(([moduleKey, module]) => {
      output[role][moduleKey] = {};
      Object.entries(module.actions).forEach(([actionKey, action]) => {
        if (action.implemented === false) return;
        const editable = !action.rolesEditable || action.rolesEditable.includes(role);
        output[role][moduleKey][actionKey] = editable
          ? Boolean(PERMISSIONS[role]?.[action.defaultFrom])
          : false;
      });
    });
  });
  return output;
}

/**
 * Conserva exclusivamente el esquema oficial. Valores faltantes toman el
 * default; valores no booleanos, roles/módulos/acciones desconocidos se
 * descartan y quedan detallados en `issues` para el diagnóstico del panel.
 */
export function sanitizeRolePermissions(input, { mergeDefaults = true } = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const defaults = buildDefaultRolePermissions();
  const data = {};
  const issues = [];

  Object.keys(source).forEach(key => {
    if (!EDITABLE_ROLES.includes(key) && !['schemaVersion','updatedAt','updatedBy'].includes(key)) {
      issues.push(`Rol o campo superior desconocido: ${key}`);
    }
  });

  EDITABLE_ROLES.forEach(role => {
    const roleSource = source[role] && typeof source[role] === 'object' && !Array.isArray(source[role])
      ? source[role]
      : {};
    data[role] = {};

    Object.keys(roleSource).forEach(moduleKey => {
      if (!PERMISSION_MODULES[moduleKey]) issues.push(`${role}.${moduleKey}: módulo desconocido`);
    });

    Object.entries(PERMISSION_MODULES).forEach(([moduleKey, module]) => {
      const moduleSource = roleSource[moduleKey] && typeof roleSource[moduleKey] === 'object' && !Array.isArray(roleSource[moduleKey])
        ? roleSource[moduleKey]
        : {};
      data[role][moduleKey] = {};

      Object.keys(moduleSource).forEach(actionKey => {
        if (!module.actions[actionKey] || module.actions[actionKey].implemented === false) {
          issues.push(`${role}.${moduleKey}.${actionKey}: acción desconocida o no implementada`);
        }
      });

      Object.entries(module.actions).forEach(([actionKey, action]) => {
        if (action.implemented === false) return;
        const roleCanExposeAction = !action.rolesEditable || action.rolesEditable.includes(role);
        const fallback = mergeDefaults ? defaults[role][moduleKey][actionKey] : false;
        const raw = moduleSource[actionKey];

        if (!roleCanExposeAction) {
          if (raw === true) issues.push(`${role}.${moduleKey}.${actionKey}: supera el techo fijo del rol`);
          data[role][moduleKey][actionKey] = false;
          return;
        }
        if (raw === undefined) {
          data[role][moduleKey][actionKey] = fallback;
          return;
        }
        if (typeof raw !== 'boolean') {
          issues.push(`${role}.${moduleKey}.${actionKey}: debe ser booleano`);
          data[role][moduleKey][actionKey] = fallback;
          return;
        }
        // Un permiso dinámico nunca puede abrir una capacidad que la matriz fija
        // del rol no posee. Solo puede conservarla o apagarla.
        const fixedCeiling = Boolean(PERMISSIONS[role]?.[action.defaultFrom]);
        if (raw && !fixedCeiling) issues.push(`${role}.${moduleKey}.${actionKey}: intentó superar el techo fijo`);
        data[role][moduleKey][actionKey] = fixedCeiling && raw;
      });
    });
  });

  return { data, issues };
}

let _cache = null;
let _diagnostics = [];

export async function loadRolePermissions(forceReload = false) {
  if (_cache && !forceReload) return _cache;
  try {
    const snapshot = await getDoc(doc(db, ROLE_PERM_DOC.col, ROLE_PERM_DOC.id));
    const result = sanitizeRolePermissions(snapshot.exists() ? snapshot.data() : {}, { mergeDefaults: true });
    _cache = result.data;
    _diagnostics = result.issues;
  } catch (error) {
    console.error('[role-permissions] No se pudo cargar rolePermissions/main, se usan valores seguros:', error);
    _cache = buildDefaultRolePermissions();
    _diagnostics = ['No se pudo leer rolePermissions/main; se aplicaron los valores seguros del código.'];
  }
  return _cache;
}

export function getRolePermissionsCache() {
  return _cache;
}

export function getRolePermissionsDiagnostics() {
  return [..._diagnostics];
}

export function canDo(role, moduleKey, actionKey) {
  const module = PERMISSION_MODULES[moduleKey];
  const action = module?.actions?.[actionKey];
  if (!action || action.implemented === false) return false;
  if (action.rolesEditable && !action.rolesEditable.includes(role)) return false;
  const fixedCeiling = Boolean(PERMISSIONS[role]?.[action.defaultFrom]);
  if (!fixedCeiling) return false;
  if (!_cache) return fixedCeiling;
  return _cache[role]?.[moduleKey]?.[actionKey] === true;
}

export async function saveRolePermissions(newDoc, actorEmail) {
  if (String(actorEmail || '').toLowerCase() !== SUPER_ADMIN) {
    throw new Error('Solo el Super Admin oficial puede guardar permisos.');
  }
  const normalized = sanitizeRolePermissions(newDoc, { mergeDefaults: true });
  await setDoc(doc(db, ROLE_PERM_DOC.col, ROLE_PERM_DOC.id), {
    ...normalized.data,
    schemaVersion: ROLE_PERMISSIONS_SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
    updatedBy: SUPER_ADMIN,
  }, { merge: false });
  _cache = normalized.data;
  _diagnostics = normalized.issues;
  return { data: _cache, issues: [..._diagnostics] };
}
