/* =============================================================
   TINTIN — Estado real de tienda dentro de Super Admin
   =============================================================
   Este módulo NO guarda configuración y NO crea un segundo control.
   La única acción de guardado sigue siendo admin.html → btn-save-config.
   Su trabajo es mostrar si settings/general está realmente sincronizado
   con Firebase y evitar que se guarde a ciegas cuando no se puede leer.
   ============================================================= */

import { db } from './firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const settingsRef = doc(db, 'settings', 'general');

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
    const timer = setInterval(() => {
      tries++;
      if (find() || tries >= 150) clearInterval(timer);
    }, 100);
  });
}

function ensureStatusPanel(checkbox) {
  let panel = document.getElementById('cfg-store-sync-status');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'cfg-store-sync-status';
  panel.setAttribute('role', 'status');
  panel.style.cssText = 'margin-top:12px;padding:11px 13px;border-radius:10px;font-size:12px;line-height:1.5;background:#f5f5f5;color:#666;border:1px solid var(--adm-border)';
  panel.textContent = 'Comprobando el estado real de la tienda en Firebase…';

  const wrap = checkbox.closest('.adm-toggle-wrap');
  (wrap?.parentElement || checkbox.parentElement)?.appendChild(panel);
  return panel;
}

function setPanel(panel, kind, text) {
  const styles = {
    ok:      ['#ecfdf5', '#065f46', '#a7f3d0'],
    closed:  ['#fff1f2', '#9f1239', '#fecdd3'],
    warning: ['#fff7ed', '#9a3412', '#fed7aa'],
    error:   ['#fef2f2', '#991b1b', '#fecaca'],
  };
  const [bg, color, border] = styles[kind] || styles.warning;
  panel.style.background = bg;
  panel.style.color = color;
  panel.style.borderColor = border;
  panel.textContent = text;
}

async function boot() {
  const dom = await waitForConfigDom();
  if (!dom) return;

  const { checkbox, saveBtn, pill } = dom;
  const panel = ensureStatusPanel(checkbox);

  onSnapshot(settingsRef, snap => {
    if (!snap.exists()) {
      setPanel(panel, 'error', 'No existe settings/general. Por seguridad la tienda se considera cerrada hasta guardar la configuración desde este panel.');
      saveBtn.disabled = false;
      pill.textContent = 'CONFIGURACIÓN FALTANTE';
      pill.classList.remove('tt-store-state-pill-open');
      pill.classList.add('tt-store-state-pill-closed');
      return;
    }

    const data = snap.data() || {};
    const open = data.storeOpen === true;
    setPanel(
      panel,
      open ? 'ok' : 'closed',
      open
        ? 'Sincronizado con Firebase: la tienda está ABIERTA.'
        : 'Sincronizado con Firebase: la tienda está CERRADA. Solo entran Super Admin y las excepciones activadas.'
    );
    saveBtn.disabled = false;
  }, error => {
    console.error('[admin-store-control] No se pudo leer settings/general:', error);
    setPanel(panel, 'error', 'No se pudo comprobar el estado real de la tienda. El botón Guardar queda bloqueado para evitar cambios a ciegas. Recargá la página o revisá la conexión.');
    saveBtn.disabled = true;
    pill.textContent = 'SIN CONEXIÓN';
    pill.classList.remove('tt-store-state-pill-open');
    pill.classList.add('tt-store-state-pill-closed');
  });
}

boot();
