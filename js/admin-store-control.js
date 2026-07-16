/* =============================================================
   TINTIN — Sincronización segura del estado global de la tienda
   =============================================================
   Fuente editable: settings/general (panel Super Admin).
   Documento público mínimo: settings/storeGate.

   No crea un segundo switch ni borra configuración. Copia únicamente:
   - storeOpen
   - maintenanceAccess

   De esta forma, cuando la tienda está cerrada, settings/general y sus datos
   completos dejan de ser públicos.
   ============================================================= */

import { auth, db } from './firebase.js';
import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';
const GENERAL_REF = doc(db, 'settings', 'general');
const STORE_GATE_REF = doc(db, 'settings', 'storeGate');
const MAINTENANCE_ROLES = [
  'admin',
  'agent',
  'viewer',
  'support',
  'client',
  'guest'
];

let currentEmail = '';
let latestGeneral = { exists: false, data: {} };
let latestGate = { exists: false, data: {} };
let generalResolved = false;
let gateResolved = false;
let syncInFlight = false;
let syncQueued = false;
let dom = null;

function waitForConfigDom() {
  return new Promise(resolve => {
    const find = () => {
      const checkbox = document.getElementById('cfg-store-open');
      const saveBtn = document.getElementById('btn-save-config');
      const pill = document.getElementById('cfg-store-state-pill');
      if (checkbox && saveBtn && pill) {
        resolve({ checkbox, saveBtn, pill });
        return true;
      }
      return false;
    };

    if (find()) return;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (find() || tries >= 150) window.clearInterval(timer);
    }, 100);
  });
}

function ensureStatusPanel(checkbox) {
  let panel = document.getElementById('cfg-store-sync-status');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'cfg-store-sync-status';
  panel.setAttribute('role', 'status');
  panel.style.cssText =
    'margin-top:12px;padding:11px 13px;border-radius:10px;font-size:12px;line-height:1.5;background:#f5f5f5;color:#666;border:1px solid var(--adm-border)';
  panel.textContent = 'Comprobando el estado real de la tienda…';

  const wrap = checkbox.closest('.adm-toggle-wrap');
  (wrap?.parentElement || checkbox.parentElement)?.appendChild(panel);
  return panel;
}

function setPanel(kind, text) {
  if (!dom?.panel) return;

  const styles = {
    ok: ['#ecfdf5', '#065f46', '#a7f3d0'],
    closed: ['#fff1f2', '#9f1239', '#fecdd3'],
    warning: ['#fff7ed', '#9a3412', '#fed7aa'],
    error: ['#fef2f2', '#991b1b', '#fecaca']
  };
  const [background, color, border] = styles[kind] || styles.warning;

  dom.panel.style.background = background;
  dom.panel.style.color = color;
  dom.panel.style.borderColor = border;
  dom.panel.textContent = text;
}

function setPill(open, label) {
  if (!dom?.pill) return;

  dom.pill.textContent = label || (open ? 'TIENDA ABIERTA' : 'TIENDA CERRADA');
  dom.pill.classList.toggle('tt-store-state-pill-open', open);
  dom.pill.classList.toggle('tt-store-state-pill-closed', !open);
}

function normalizeMaintenanceAccess(value) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};

  MAINTENANCE_ROLES.forEach(role => {
    result[role] = source[role] === true;
  });

  return result;
}

function desiredGateData() {
  const data = latestGeneral.exists ? latestGeneral.data : {};
  return {
    storeOpen: latestGeneral.exists && data.storeOpen === true,
    maintenanceAccess: normalizeMaintenanceAccess(data.maintenanceAccess)
  };
}

function comparableGate(data) {
  return {
    storeOpen: data?.storeOpen === true,
    maintenanceAccess: normalizeMaintenanceAccess(data?.maintenanceAccess)
  };
}

function gateMatchesGeneral() {
  if (!latestGate.exists) return false;
  return (
    JSON.stringify(comparableGate(latestGate.data)) ===
    JSON.stringify(desiredGateData())
  );
}

async function syncStoreGate() {
  if (currentEmail.toLowerCase() !== SUPER_ADMIN_EMAIL) return;
  // Nunca publiques valores construidos desde los placeholders iniciales.
  // Al abrir el panel, Auth suele resolver antes que Firestore; antes de este
  // guard ese intervalo escribía storeOpen:false y hacía parpadear el aviso de
  // mantenimiento a todas las visitas hasta que llegaba settings/general.
  if (!generalResolved || !gateResolved || !latestGeneral.exists) return;
  if (syncInFlight) {
    syncQueued = true;
    return;
  }

  syncInFlight = true;
  syncQueued = false;

  try {
    const desired = desiredGateData();
    setPanel(
      'warning',
      'Sincronizando el cierre global con Firebase…'
    );

    await setDoc(STORE_GATE_REF, {
      ...desired,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[admin-store-control] No se pudo sincronizar storeGate:', error);
    setPanel(
      'error',
      'No se pudo publicar el estado global de la tienda. Tus datos no se borraron. Revisá la conexión y volvé a guardar.'
    );
  } finally {
    syncInFlight = false;
    if (syncQueued) syncStoreGate();
  }
}

function renderState() {
  if (!dom) return;

  if (!generalResolved || !gateResolved) {
    dom.saveBtn.disabled = true;
    setPill(false, 'COMPROBANDO');
    setPanel('warning', 'Comprobando el estado real de la tienda…');
    return;
  }

  if (!latestGeneral.exists) {
    dom.checkbox.checked = false;
    setPill(false, 'CONFIGURACIÓN FALTANTE');
    setPanel(
      'error',
      'No existe settings/general. Por seguridad la tienda se considera CERRADA hasta que guardes la configuración.'
    );
    // Un documento ausente requiere una acción explícita de Guardar. No se
    // crea automáticamente como "cerrado" al entrar al panel.
    return;
  }

  const open = latestGeneral.data.storeOpen === true;
  dom.checkbox.checked = open;
  setPill(open);

  if (!gateMatchesGeneral()) {
    setPanel(
      'warning',
      'El panel cambió, pero el cierre global todavía se está sincronizando…'
    );
    if (currentEmail.toLowerCase() === SUPER_ADMIN_EMAIL) syncStoreGate();
    return;
  }

  setPanel(
    open ? 'ok' : 'closed',
    open
      ? 'Sincronizado con Firebase: la tienda está ABIERTA en todo el sitio.'
      : 'Sincronizado con Firebase: la tienda está CERRADA en todas las páginas. Solo entran Super Admin y las excepciones activadas.'
  );
}

async function boot() {
  const found = await waitForConfigDom();
  if (!found) return;

  dom = {
    ...found,
    panel: ensureStatusPanel(found.checkbox)
  };

  onAuthStateChanged(auth, user => {
    currentEmail = user?.email || '';
    renderState();
  });

  onSnapshot(
    GENERAL_REF,
    snapshot => {
      generalResolved = true;
      latestGeneral = {
        exists: snapshot.exists(),
        data: snapshot.exists() ? snapshot.data() || {} : {}
      };
      dom.saveBtn.disabled = false;
      renderState();
    },
    error => {
      generalResolved = true;
      console.error('[admin-store-control] No se pudo leer settings/general:', error);
      dom.saveBtn.disabled = true;
      setPill(false, 'SIN CONEXIÓN');
      setPanel(
        'error',
        'No se pudo leer la configuración completa. El botón Guardar queda bloqueado para evitar cambios a ciegas.'
      );
    }
  );

  onSnapshot(
    STORE_GATE_REF,
    snapshot => {
      gateResolved = true;
      latestGate = {
        exists: snapshot.exists(),
        data: snapshot.exists() ? snapshot.data() || {} : {}
      };
      renderState();
    },
    error => {
      gateResolved = true;
      console.error('[admin-store-control] No se pudo leer settings/storeGate:', error);
      latestGate = { exists: false, data: {} };
      setPanel(
        'error',
        'No se pudo comprobar el cierre global. La tienda debe permanecer bloqueada hasta recuperar la conexión.'
      );
    }
  );
}

boot();

// El mismo panel ya está protegido para Super Admin. Desde acá se carga el
// sincronizador del documento público mínimo de correos.
import('./admin-email-gate-sync.js?v=tintin-20260715-16').catch(error => {
  console.error('[admin-store-control] No se pudo iniciar la sincronización de correos:', error);
});
