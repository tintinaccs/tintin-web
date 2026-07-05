// =============================================
// TINTIN ACCESORIOS — Permisos dinámicos por rol (Super Admin → Roles y Permisos)
// =============================================
//
// Esto NO reemplaza js/roles.js — lo complementa. `PERMISSIONS`/`can()` de
// roles.js siguen siendo el TECHO fijo de cada rol (lo máximo que ese rol
// puede llegar a hacer, protegido también en firestore.rules). Este archivo
// permite que Super Admin ACOTE ese techo por acción concreta desde una
// pantalla, sin tocar código — nunca puede ampliarlo más allá de lo que
// roles.js/firestore.rules ya permiten.
//
// Por qué algunos módulos completos NO están acá (quedan fijos, ver
// admin.html → SECTION_PERMISSION): Usuarios, Auditoría, Correos,
// Configuración, Onboarding e Import/Export ya son 100% exclusivos de Super
// Admin en firestore.rules desde hace varias fases — volverlos configurables
// exigiría reescribir esas reglas ya endurecidas a propósito, por acciones
// que ni siquiera Admin tiene hoy (no estaban en el "sugerido" para Admin del
// pedido original). Se dejan protegidas y se explica en el reporte final.

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { PERMISSIONS } from "./roles.js";

export const ROLE_PERM_DOC = { col: 'rolePermissions', id: 'main' };
// Roles que aparecen como COLUMNAS editables en la matriz. Super Admin no
// está acá porque siempre tiene todo (control total, no desactivable —
// pedido explícito), y Cliente no está acá porque sus capacidades
// (comprar, ver su perfil, etc.) son funcionalidad base de la tienda, no un
// permiso de panel administrativo — ver la sección aparte "Web pública /
// cliente" en el reporte.
export const EDITABLE_ROLES = ['admin', 'agent', 'viewer'];

// ---- Catálogo de módulos/acciones ----
// defaultFrom: de qué flag de PERMISSIONS (roles.js) sale el valor por
//   defecto — así el doc nuevo arranca reflejando EXACTO lo que ya pasaba
//   hoy, sin cambiar nada hasta que Super Admin toque un switch.
// rolesEditable: qué columnas pueden editar este switch. Los roles NO
//   listados se muestran fijos en "No disponible" (rules nunca les dio ese
//   poder y esta pantalla no se lo da ahora).
// implemented:false → la acción todavía no existe como función real en el
//   panel; se muestra informativa, sin switch, para no simular algo falso.
// uiOnly:true → el toggle solo oculta/muestra el dato en pantalla; Firestore
//   no permite redactar campos dentro de un documento ya permitido, así que
//   esto NO es una barrera de seguridad de datos (se aclara en la UI).
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
      crearManual:       { label: 'Crear pedido manual',         implemented: false, note: 'No existe hoy una función para crear un pedido a mano desde el Admin — no se agrega un switch falso.' },
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
      duplicar:          { label: 'Duplicar producto',           implemented: false, note: 'No existe hoy un botón "Duplicar" para productos — no se agrega un switch falso.' },
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
      destacar:          { label: 'Destacar colección',           implemented: false, note: 'Las colecciones no tienen hoy un campo "destacada" (sí los productos) — no se agrega un switch falso.' },
      eliminar:          { label: 'Eliminar colección',           defaultFrom: 'deleteCollections', rolesEditable: ['admin'], dangerous: true, note: 'Solo elimina colecciones sin productos asociados — con productos, se pide reasignarlos primero (individual o en lote).' },
    }
  },
  contenido: {
    label: 'Contenido',
    actions: {
      ver:                       { label: 'Ver contenido',                  defaultFrom: 'manageContent', rolesEditable: ['admin','agent','viewer'] },
      editarTextos:              { label: 'Editar textos',                  defaultFrom: 'manageContent', rolesEditable: ['admin','agent'] },
      activarDesactivarSecciones:{ label: 'Activar/desactivar secciones',   defaultFrom: 'manageContent', rolesEditable: ['admin','agent'] },
      restaurar:                 { label: 'Restaurar contenido original',   implemented: false, note: 'No existe hoy un "restaurar original" para Contenido (sí para Plantillas de correo) — no se agrega un switch falso.' },
      eliminar:                  { label: 'Eliminar contenido',             implemented: false, note: 'Contenido no tiene una acción de "eliminar una sección" — solo se edita, no se borra.' },
    }
  },
};

// ---- Valores por defecto: derivados de PERMISSIONS (roles.js) ----
// Así el documento nuevo arranca reflejando EXACTO lo que cada rol ya podía
// hacer — publicar esta pantalla no cambia ningún comportamiento hasta que
// Super Admin apague/prenda algo a propósito.
export function buildDefaultRolePermissions() {
  const out = {};
  EDITABLE_ROLES.forEach(role => {
    out[role] = {};
    Object.entries(PERMISSION_MODULES).forEach(([modKey, mod]) => {
      out[role][modKey] = {};
      Object.entries(mod.actions).forEach(([actKey, act]) => {
        if (act.implemented === false) return; // no se guarda estado para algo que no existe
        const editable = !act.rolesEditable || act.rolesEditable.includes(role);
        out[role][modKey][actKey] = editable ? !!(PERMISSIONS[role]?.[act.defaultFrom]) : false;
      });
    });
  });
  return out;
}

let _cache = null; // { admin: {...}, agent: {...}, viewer: {...} } ya fusionado con defaults

/**
 * Carga (una sola vez, cacheado en memoria) el documento de permisos
 * dinámicos, fusionado con los valores por defecto — si el documento no
 * existe todavía en Firestore, se usan los defaults tal cual (equivalente a
 * "nada cambió respecto al comportamiento de siempre").
 */
export async function loadRolePermissions(forceReload = false) {
  if (_cache && !forceReload) return _cache;
  const defaults = buildDefaultRolePermissions();
  try {
    const snap = await getDoc(doc(db, ROLE_PERM_DOC.col, ROLE_PERM_DOC.id));
    const saved = snap.exists() ? snap.data() : {};
    const merged = {};
    EDITABLE_ROLES.forEach(role => {
      merged[role] = {};
      Object.keys(PERMISSION_MODULES).forEach(modKey => {
        merged[role][modKey] = { ...defaults[role][modKey], ...(saved[role]?.[modKey] || {}) };
      });
    });
    _cache = merged;
  } catch (e) {
    console.error('[role-permissions] No se pudo cargar rolePermissions/main, se usan los valores por defecto:', e);
    _cache = defaults;
  }
  return _cache;
}

/** Devuelve el caché ya cargado (sync) — null si loadRolePermissions() todavía no corrió. */
export function getRolePermissionsCache() {
  return _cache;
}

/**
 * ¿El rol puede hacer moduleKey.actionKey? Superadmin real (ver
 * isRealSuperAdmin en roles.js) siempre true — se resuelve ANTES de llamar
 * a esto en los call-sites, esta función es solo para admin/agent/viewer.
 */
export function canDo(role, moduleKey, actionKey) {
  const mod = PERMISSION_MODULES[moduleKey];
  const act = mod?.actions?.[actionKey];
  if (!act || act.implemented === false) return false;
  if (act.rolesEditable && !act.rolesEditable.includes(role)) return false;
  if (!_cache) {
    // No debería pasar (loadRolePermissions se llama en el arranque del
    // panel) — fallback seguro: el techo fijo de roles.js, nunca abre más.
    return !!(PERMISSIONS[role]?.[act.defaultFrom]);
  }
  return !!(_cache[role]?.[moduleKey]?.[actionKey]);
}

/** Guarda el documento completo + registra en auditLog cada cambio real (lo hace el caller, ver admin.html). */
export async function saveRolePermissions(newDoc, actorEmail) {
  await setDoc(doc(db, ROLE_PERM_DOC.col, ROLE_PERM_DOC.id), {
    ...newDoc,
    updatedAt: serverTimestamp(),
    updatedBy: actorEmail || '',
  }, { merge: false }); // merge:false a propósito — el doc siempre se guarda completo, nunca queda un campo viejo huérfano de un módulo que ya no existe
  _cache = newDoc;
}
