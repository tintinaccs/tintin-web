// =============================================
// TINTIN ACCESORIOS — Roles & Permissions
// =============================================

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const SUPER_ADMIN = 'tintinaccs@gmail.com';

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
    manageUsers:    true,
    assignRoles:    true,
    deleteUsers:    true,
    viewOrders:     true,
    manageOrders:   true,
    addProducts:    true,
    editProducts:   true,
    deleteProducts: true,
    manageContent:  true,
    manageSettings: true,
    viewDashboard:  true
  },
  admin: {
    manageUsers:    true,
    assignRoles:    true,
    deleteUsers:    true,
    viewOrders:     true,
    manageOrders:   true,
    addProducts:    true,
    editProducts:   true,
    deleteProducts: true,
    manageContent:  true,
    manageSettings: true,
    viewDashboard:  true
  },
  agent: {
    manageUsers:    false,
    assignRoles:    false,
    deleteUsers:    false,
    viewOrders:     true,
    manageOrders:   true,
    addProducts:    true,
    editProducts:   true,
    deleteProducts: false,
    manageContent:  true,
    manageSettings: false,
    viewDashboard:  true
  },
  viewer: {
    manageUsers:    false,
    assignRoles:    false,
    deleteUsers:    false,
    viewOrders:     true,
    manageOrders:   false,
    addProducts:    true,
    editProducts:   false,
    deleteProducts: false,
    manageContent:  false,
    manageSettings: false,
    viewDashboard:  true
  },
  client: {
    manageUsers:    false,
    assignRoles:    false,
    deleteUsers:    false,
    viewOrders:     false,
    manageOrders:   false,
    addProducts:    false,
    editProducts:   false,
    deleteProducts: false,
    manageContent:  false,
    manageSettings: false,
    viewDashboard:  false
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
