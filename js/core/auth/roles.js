// =============================================
// TINTIN ACCESORIOS — Roles & Permissions
// =============================================

import { auth, db } from "../firebase/firebase.js?v=tintin-20260907-appcheck-token-3";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  SUPER_ADMIN_EMAIL,
  ASSIGNABLE_ROLES,
} from './contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';

// Única fuente de verdad para el cliente (importada por todo lo demás en
// js/ que necesita identificar al Super Admin). Cloudflare Pages Functions
// tiene su propia copia en cloudflare/seguridad-cloudinary.js
// (SUPERADMIN_EMAIL) porque corre en un runtime distinto y no puede
// importar de acá; firestore.rules repite el literal seis veces porque el
// lenguaje de reglas no admite imports ni constantes compartidas entre
// archivos. Migrar a un custom claim de Firebase Auth (admin=true)
// eliminaría la comparación por correo en las tres capas, pero asignar un
// claim requiere el Admin SDK corriendo en un entorno privilegiado (una
// Cloud Function) — hoy el proyecto está en plan Spark y no las despliega
// (ver firebase-cloud-functions-inactive/README.md).
export const SUPER_ADMIN = SUPER_ADMIN_EMAIL;

// El mensaje de cuenta bloqueada (con el enlace de WhatsApp) vive en
// js/components/modals/modal-bloqueo.js — showBlockedModal() — para que login.html y
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
  agent:     'Agente',
  viewer:    'Viewer',
  client:    'Cliente'
};

export const PERMISSIONS = {
  superadmin: {
    manageUsers: true, assignRoles: true, deleteUsers: true,
    viewOrders: true, manageOrders: true, manageOrdersFull: true,
    deleteOrders: true, addProducts: true, editProducts: true,
    deleteProducts: true, manageContent: true, deleteCollections: true,
    deleteContent: true, manageSettings: true, manageImages: true,
    manageEmail: true, viewDashboard: true
  },
  admin: {
    manageUsers: false, assignRoles: false, deleteUsers: false,
    viewOrders: true, manageOrders: true, manageOrdersFull: true,
    deleteOrders: true, addProducts: true, editProducts: true,
    deleteProducts: true, manageContent: true, deleteCollections: true,
    deleteContent: true, manageSettings: false, manageImages: false,
    manageEmail: false, viewDashboard: true
  },
  agent: {
    manageUsers: false, assignRoles: false, deleteUsers: false,
    viewOrders: true, manageOrders: true, manageOrdersFull: false,
    deleteOrders: false, addProducts: false, editProducts: false,
    deleteProducts: false, manageContent: false, deleteCollections: false,
    deleteContent: false, manageSettings: false, manageImages: false,
    manageEmail: false, viewDashboard: true
  },
  viewer: {
    manageUsers: false, assignRoles: false, deleteUsers: false,
    viewOrders: true, manageOrders: false, manageOrdersFull: false,
    deleteOrders: false, addProducts: false, editProducts: false,
    deleteProducts: false, manageContent: false, deleteCollections: false,
    deleteContent: false, manageSettings: false, manageImages: false,
    manageEmail: false, viewDashboard: true
  },
  client: {
    manageUsers: false, assignRoles: false, deleteUsers: false,
    viewOrders: false, manageOrders: false, manageOrdersFull: false,
    deleteOrders: false, addProducts: false, editProducts: false,
    deleteProducts: false, manageContent: false, deleteCollections: false,
    deleteContent: false, manageSettings: false, manageImages: false,
    manageEmail: false, viewDashboard: false
  }
};

export function can(role, permission) {
  return !!(PERMISSIONS[role]?.[permission]);
}

// El panel necesita distinguir una identidad sin rol de un fallo de acceso.
// El resto del sitio conserva el contrato anterior mientras se valida este
// cambio, para no alterar el login y la incorporación de las clientas.
function isAdminPage() {
  return typeof window !== 'undefined' &&
    /(^|\/)admin(?:\.html)?\/?$/i.test(window.location.pathname || '');
}

/**
 * Get user role from Firestore. The admin route fails closed on authentication
 * or Firestore errors instead of interpreting them as a new client account.
 */
export async function getUserRole(uid, email) {
  const strict = isAdminPage();
  let authenticatedEmail = String(email || auth.currentUser?.email || '').trim().toLowerCase();

  if (strict) {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
      throw Object.assign(new Error('La sesión de Firebase todavía no está disponible.'), {
        code: 'auth/session-unavailable'
      });
    }
    // El rol elevado se comprueba contra el token real, no contra el badge,
    // un documento de perfil ni un correo recibido como argumento.
    const tokenResult = await user.getIdTokenResult();
    authenticatedEmail = String(tokenResult.claims.email || '').trim().toLowerCase();
  }

  if (authenticatedEmail === SUPER_ADMIN) return 'superadmin';
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return 'client';
    const role = snap.data().role || 'client';
    return ASSIGNABLE_ROLES.includes(role) ? role : 'client';
  } catch (e) {
    console.error('Error getting user role:', e);
    if (strict) throw e;
    return 'client';
  }
}

export async function setUserRole(uid, role) {
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error('Rol no permitido');
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
