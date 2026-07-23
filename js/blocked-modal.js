// =============================================
// TINTIN ACCESORIOS — Modal de cuenta bloqueada
// =============================================
// Componente compartido por login.html y checkout.html (los dos lugares
// donde se detecta una cuenta bloqueada durante un intento de acceso) para
// mostrar siempre el mismo mensaje y las mismas salidas seguras.

import { waitForLoaderHidden } from './loader-wait.js?v=tintin-20260716-cloudinary-fix-1';

export const WHATSAPP_SUPPORT_TEXT = 'Hola Tintin, necesito ayuda con el acceso a mi cuenta.';
export const WHATSAPP_SUPPORT_URL = 'https://wa.me/595981299331?text=' + encodeURIComponent(WHATSAPP_SUPPORT_TEXT);

const OVERLAY_ID = 'tt-blocked-overlay';
let pending = false;

/**
 * Muestra el diálogo de cuenta bloqueada sobre toda la página. Es idempotente
 * y no tiene cierre: la persona debe volver al Inicio o contactar a soporte.
 * Espera a que el loader termine para que el aviso quede visible y enfocable.
 */
export function showBlockedModal() {
  if (document.getElementById(OVERLAY_ID) || pending) return;
  pending = true;

  waitForLoaderHidden().then(() => {
    pending = false;
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <section
        class="tt-blocked-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tt-blocked-title"
        aria-describedby="tt-blocked-message"
        tabindex="-1"
      >
        <div class="tt-blocked-icon" aria-hidden="true">🚫</div>
        <h2 class="tt-blocked-title" id="tt-blocked-title">No podés ingresar</h2>
        <p class="tt-blocked-message" id="tt-blocked-message">
          Lo siento, ahora no podés ingresar. Podés comunicarte con nuestro soporte por WhatsApp.
        </p>
        <div class="tt-blocked-actions">
          <a
            class="tt-blocked-action tt-blocked-action-secondary"
            href="${WHATSAPP_SUPPORT_URL}"
            target="_blank"
            rel="noopener"
          >Contactar soporte</a>
          <a class="tt-blocked-action tt-blocked-action-primary" href="index.html">Volver al inicio</a>
        </div>
      </section>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      overlay.querySelector('.tt-blocked-dialog')?.focus({ preventScroll: true });
    });
  });
}
