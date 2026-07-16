/**
 * TINTIN — Datos de contacto de la tienda, centralizados
 * Única fuente de verdad: settings/general (Super Admin → Configuración).
 * Reescribe en vivo, en cualquier página pública que cargue este script:
 * el número de WhatsApp, el email de contacto, el link de Instagram, la
 * ubicación/dirección, y agrega Facebook/TikTok al pie si están cargados —
 * cambiar estos datos en Configuración los actualiza en todo el sitio sin
 * tocar código ni republicar cada página.
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
  // Mismo número que WhatsApp, pero como tel: — el ítem "Contacto" del pie
  // (y su equivalente en contact.html) muestra el teléfono para llamar, no
  // para abrir WhatsApp; ese acceso directo ya tiene su propio botón.
  document.querySelectorAll('a.tt-contact-phone').forEach(a => {
    a.href = 'tel:+' + digits;
  });
}

// El email de contacto vive en dos lugares por página (footer + bloque
// "Info de contacto" en contact.html) — ambos marcados con la misma clase
// a propósito, así un solo selector alcanza para los dos.
function applyEmail(email) {
  if (!email) return;
  document.querySelectorAll('a.tt-contact-email').forEach(a => {
    a.href = 'mailto:' + email;
    a.textContent = email;
  });
}

// El campo de Configuración ya pide la URL completa (mismo criterio que
// Facebook/TikTok), no un @usuario — se usa tal cual llega.
function applyInstagram(url) {
  if (!url) return;
  document.querySelectorAll('a[href*="instagram.com"]').forEach(a => { a.href = url; });
}

function applyAddress(address) {
  if (!address) return;
  document.querySelectorAll('.tt-contact-addr').forEach(el => { el.textContent = address; });
}

// Facebook/TikTok no tienen un lugar fijo en el HTML estático porque no
// siempre están cargados — se agregan como ítem nuevo a la lista "Contacto"
// del pie de página SOLO si Super Admin cargó la URL, y solo una vez
// (marcador de clase evita duplicar el ítem si el snapshot se dispara de nuevo).
function applySocialExtra(cfg) {
  document.querySelectorAll('.tt-footer-col').forEach(col => {
    const title = col.querySelector('.tt-footer-col-title');
    if (!title || title.textContent.trim() !== 'Contacto') return;
    const ul = col.querySelector('ul');
    if (!ul) return;
    if (cfg.facebook && !ul.querySelector('.tt-contact-fb')) {
      ul.insertAdjacentHTML('beforeend', `<li><a class="tt-contact-fb" href="${cfg.facebook}" target="_blank" rel="noopener">Facebook</a></li>`);
    }
    if (cfg.tiktok && !ul.querySelector('.tt-contact-tt')) {
      ul.insertAdjacentHTML('beforeend', `<li><a class="tt-contact-tt" href="${cfg.tiktok}" target="_blank" rel="noopener">TikTok</a></li>`);
    }
  });
}

onSnapshot(doc(db, 'settings', 'general'), snap => {
  if (!snap.exists()) return;
  const cfg = snap.data();
  applyWaNumber(cfg.whatsappNumber);
  applyEmail(cfg.contactEmail);
  applyInstagram(cfg.instagram);
  applyAddress(cfg.storeAddress);
  applySocialExtra(cfg);
});
