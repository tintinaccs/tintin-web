// =============================================
// TINTIN ACCESORIOS — Roles & Permissions
// =============================================

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const SUPER_ADMIN = 'tintinaccs@gmail.com';

// Mensaje único para cuentas bloqueadas (Fase E) — una sola fuente de verdad
// para que login.html y checkout.html muestren exactamente el mismo texto.
export const BLOCKED_MESSAGE = 'Tu cuenta se encuentra bloqueada. Contactá con Tintin para más información.';

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  AGENT:      'agent',
  VIEWER:     'viewer',
  CLIENT:     'client'
};

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  agent:      'Agente',
  viewer:     'Viewer',
  client:     'Cliente'
};

export const PERMISSIONS = {
  superadmin: {
    manageUsers:      true,
    assignRoles:      true,
    deleteUsers:      true,
    viewOrders:       true,
    manageOrders:     true,
    manageOrdersFull: true,
    addProducts:      true,
    editProducts:     true,
    deleteProducts:   true,
    manageContent:    true,
    deleteCollections: true,
    deleteContent:    true,
    manageSettings:   true,
    viewDashboard:    true
  },
  // Admin: gerente operativo de la tienda con control total sobre pedidos,
  // productos, colecciones y contenido (incluido eliminar) — pero CERO acceso
  // a Usuarios, Configuración e Importar. No es un segundo Super Admin: no
  // puede tocar cuentas, roles, ni nada de configuración/seguridad interna.
  // (Antes esta matriz era idéntica a superadmin — ver Fase D.)
  admin: {
    manageUsers:      false,
    assignRoles:      false,
    deleteUsers:      false,
    viewOrders:       true,
    manageOrders:     true,
    manageOrdersFull: true,
    addProducts:      true,
    editProducts:     true,
    deleteProducts:   true,
    manageContent:    true,
    deleteCollections: true,
    deleteContent:    true,
    manageSettings:   false,
    viewDashboard:    true
  },
  // Modder: permisos operativos del día a día (pedidos, stock, productos,
  // colecciones, contenido) pero SIN nada que sea irreversible o sensible
  // (borrar, usuarios, configuración). Esta matriz es solo la mitad del
  // control — la otra mitad, la que de verdad importa, son las reglas de
  // Firestore (firestore.rules), que están escritas para permitir EXACTAMENTE
  // esto mismo y nada más, sin importar lo que diga esta matriz del lado
  // del cliente.
  agent: {
    manageUsers:      false,
    assignRoles:      false,
    deleteUsers:      false,
    viewOrders:       true,
    manageOrders:     true,   // cambiar estado/pago, reenviar correo
    manageOrdersFull: false,  // NO editar productos/montos/dirección del pedido, NO eliminar pedido
    addProducts:      true,
    editProducts:     true,
    deleteProducts:   false,
    manageContent:    true,   // crear/editar colecciones y contenido
    deleteCollections: false,
    deleteContent:    false,
    manageSettings:   false,
    viewDashboard:    true
  },
  viewer: {
    manageUsers:      false,
    assignRoles:      false,
    deleteUsers:      false,
    viewOrders:       true,
    manageOrders:     false,
    manageOrdersFull: false,
    addProducts:      true,
    editProducts:     false,
    deleteProducts:   false,
    manageContent:    false,
    deleteCollections: false,
    deleteContent:    false,
    manageSettings:   false,
    viewDashboard:    true
  },
  client: {
    manageUsers:      false,
    assignRoles:      false,
    deleteUsers:      false,
    viewOrders:       false,
    manageOrders:     false,
    manageOrdersFull: false,
    addProducts:      false,
    editProducts:     false,
    deleteProducts:   false,
    manageContent:    false,
    deleteCollections: false,
    deleteContent:    false,
    manageSettings:   false,
    viewDashboard:    false
  }
};

/**
 * Check if a role has a specific permission
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function can(role, permission) {
  return !!(PERMISSIONS[role]?.[permission]);
}

/**
 * Get user role from Firestore
 * @param {string} uid
 * @returns {Promise<string>} role string
 */
export async function getUserRole(uid, email) {
  // Superadmin always gets top role without a Firestore round-trip
  if (email && email === SUPER_ADMIN) return 'superadmin';
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      // Also check email in the stored doc
      if (data.email === SUPER_ADMIN) return 'superadmin';
      return data.role || 'client';
    }
    return 'client';
  } catch (e) {
    console.error('Error getting user role:', e);
    return 'client';
  }
}

/**
 * Set user role in Firestore
 * @param {string} uid
 * @param {string} role
 */
export async function setUserRole(uid, role) {
  try {
    await setDoc(doc(db, 'users', uid), {
      role,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Error setting user role:', e);
    throw e;
  }
}
