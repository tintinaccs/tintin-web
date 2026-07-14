// =============================================
// TINTIN ACCESORIOS — Roles & Permissions
// =============================================

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const SUPER_ADMIN = 'tintinaccs@gmail.com';

// El mensaje de cuenta bloqueada (con el enlace de WhatsApp) vive en
// js/blocked-modal.js — showBlockedModal() — para que login.html y
// checkout.html muestren siempre el mismo modal, no solo el mismo texto.

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  AGENT:      'agent',
  VIEWER:     'viewer',
  CLIENT:     'client'
};

export const ASSIGNABLE_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.AGENT,
  ROLES.VIEWER,
  ROLES.CLIENT,
]);

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  agent:      'Agente',
  viewer:     'Viewer',
  client:     'Cliente'
};

export const PERMISSIONS = {
  // Único rol con permisos totales. Ningún otro rol debe copiar esta matriz.
  superadmin: {
    manageUsers:       true,
    assignRoles:       true,
    deleteUsers:       false, // Spark no puede eliminar la cuenta de Firebase Auth de otra persona.
    viewOrders:        true,
    manageOrders:      true,
    manageOrdersFull:  true,
    deleteOrders:      true,
    addProducts:       true,
    editProducts:      true,
    deleteProducts:    true,
    manageContent:     true,
    deleteCollections: true,
    deleteContent:     true,
    manageSettings:    true,
    manageImages:      true,
    manageEmail:       true,
    viewDashboard:     true
  },

  // Admin: gerente operativo de la tienda con control total sobre pedidos,
  // productos, colecciones y contenido (incluido eliminar) — pero CERO acceso
  // a Usuarios, Configuración e Importar. No es un segundo Super Admin: no
  // puede tocar cuentas, roles, ni nada de configuración/seguridad interna.
  // Super Admin puede ajustar cualquiera de estos permisos por rol en
  // cualquier momento desde Roles y Permisos (rolePermissions/main), sin
  // tocar este archivo — esta matriz es solo el punto de partida.
  admin: {
    manageUsers:       false,
    assignRoles:       false,
    deleteUsers:       false,
    viewOrders:        true,
    manageOrders:      true,
    manageOrdersFull:  true,
    deleteOrders:      true,
    addProducts:       true,
    editProducts:      true,
    deleteProducts:    true,
    manageContent:     true,
    deleteCollections: true,
    deleteContent:     true,
    manageSettings:    false,
    manageImages:      false,
    manageEmail:       false,
    viewDashboard:     true
  },

  // Agente: tareas puntuales, sin permisos irreversibles.
  agent: {
    manageUsers:       false,
    assignRoles:       false,
    deleteUsers:       false,
    viewOrders:        true,
    manageOrders:      true,
    manageOrdersFull:  false,
    deleteOrders:      false,
    addProducts:       false,
    editProducts:      false,
    deleteProducts:    false,
    manageContent:     false,
    deleteCollections: false,
    deleteContent:     false,
    manageSettings:    false,
    manageImages:      false,
    manageEmail:       false,
    viewDashboard:     true
  },

  // Viewer: solo lectura operativa, sin cambios.
  viewer: {
    manageUsers:       false,
    assignRoles:       false,
    deleteUsers:       false,
    viewOrders:        true,
    manageOrders:      false,
    manageOrdersFull:  false,
    deleteOrders:      false,
    addProducts:       false,
    editProducts:      false,
    deleteProducts:    false,
    manageContent:     false,
    deleteCollections: false,
    deleteContent:     false,
    manageSettings:    false,
    manageImages:      false,
    manageEmail:       false,
    viewDashboard:     true
  },

  // Cliente: nunca entra al panel ni a funciones internas.
  client: {
    manageUsers:       false,
    assignRoles:       false,
    deleteUsers:       false,
    viewOrders:        false,
    manageOrders:      false,
    manageOrdersFull:  false,
    deleteOrders:      false,
    addProducts:       false,
    editProducts:      false,
    deleteProducts:    false,
    manageContent:     false,
    deleteCollections: false,
    deleteContent:     false,
    manageSettings:    false,
    manageImages:      false,
    manageEmail:       false,
    viewDashboard:     false
  }
};

/**
 * Convierte cualquier valor guardado en Firestore a un rol conocido.
 * `superadmin` solo se acepta cuando el correo autenticado oficial ya fue
 * verificado por el llamador; nunca se confía en un campo editable del perfil.
 */
export function normalizeRole(role, { allowSuperAdmin = false } = {}) {
  const value = String(role || '').trim().toLowerCase();
  if (allowSuperAdmin && value === ROLES.SUPERADMIN) return ROLES.SUPERADMIN;
  return ASSIGNABLE_ROLES.includes(value) ? value : ROLES.CLIENT;
}

/**
 * Check if a role has a specific permission
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function can(role, permission) {
  return !!(PERMISSIONS[normalizeRole(role, { allowSuperAdmin: role === ROLES.SUPERADMIN })]?.[permission]);
}

/**
 * Get user role from Firestore
 * @param {string} uid
 * @param {string} email correo procedente de Firebase Authentication
 * @returns {Promise<string>} role string
 */
export async function getUserRole(uid, email) {
  // La única prueba válida de Super Admin es el correo autenticado. El email o
  // el rol guardado dentro de users/{uid} nunca elevan privilegios.
  if (String(email || '').toLowerCase() === SUPER_ADMIN) return ROLES.SUPERADMIN;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return ROLES.CLIENT;
    return normalizeRole(snap.data()?.role);
  } catch (e) {
    console.error('Error getting user role:', e);
    return ROLES.CLIENT;
  }
}

/**
 * Set user role in Firestore. Super Admin no es un rol asignable.
 * @param {string} uid
 * @param {string} role
 */
export async function setUserRole(uid, role) {
  const normalized = normalizeRole(role);
  if (!ASSIGNABLE_ROLES.includes(String(role || '').trim().toLowerCase()) || normalized === ROLES.SUPERADMIN) {
    throw new Error('Rol no permitido');
  }
  try {
    await setDoc(doc(db, 'users', uid), {
      role: normalized,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Error setting user role:', e);
    throw e;
  }
}
