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
    deleteUsers:       true,
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

  // Admin operativo: puede ayudar en el día a día, pero NO tiene permisos
  // máximos de Super Admin. No usuarios, no roles, no configuración, no borrados
  // sensibles y no edición completa de pedidos.
  admin: {
    manageUsers:       false,
    assignRoles:       false,
    deleteUsers:       false,
    viewOrders:        true,
    manageOrders:      true,
    manageOrdersFull:  false,
    deleteOrders:      false,
    addProducts:       true,
    editProducts:      true,
    deleteProducts:    false,
    manageContent:     true,
    deleteCollections: false,
    deleteContent:     false,
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
  // Super Admin real: solo por email oficial, no por documento manipulable.
  if (email && email === SUPER_ADMIN) return 'superadmin';
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.email === SUPER_ADMIN) return 'superadmin';
      const role = data.role || 'client';
      return role === 'superadmin' ? 'client' : role;
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
