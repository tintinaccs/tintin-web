/**
 * TINTIN — Número de WhatsApp centralizado
 * Única fuente de verdad: settings/general.whatsappNumber (Super Admin →
 * Configuración). Reescribe en vivo cualquier link de WhatsApp DE LA TIENDA
 * en la página (botón flotante, footer, contacto, soporte, etc.) — cambiar
 * el número en Configuración lo actualiza en todo el sitio sin tocar código.
 *
 * Ojo: esto es para páginas públicas donde TODO link `wa.me/` apunta a la
 * tienda. admin.html tiene además links por-pedido al teléfono de cada
 * clienta — ese caso se resuelve aparte (no se puede barrer a ciegas ahí
 * sin pisar el teléfono de la clienta), así que admin.html no carga este
 * script.
 */
import { db } from './firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function applyWaNumber(rawNumber) {
  const digits = String(rawNumber || '').replace(/\D/g, '');
  if (!digits) return;
  document.querySelectorAll('a[href*="wa.me/"]').forEach(a => {
    a.href = a.href.replace(/wa\.me\/\d+/, 'wa.me/' + digits);
  });
}

onSnapshot(doc(db, 'settings', 'general'), snap => {
  if (!snap.exists()) return;
  applyWaNumber(snap.data().whatsappNumber);
});
