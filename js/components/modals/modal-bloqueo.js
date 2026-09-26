// =============================================
// TINTIN ACCESORIOS — Modal de cuenta bloqueada
// =============================================
// Componente compartido por login.html y checkout.html (los dos lugares
// donde se detecta una cuenta bloqueada durante un intento de acceso) para
// mostrar siempre el mismo mensaje y las mismas salidas seguras.

import { waitForLoaderHidden } from '../../quality/espera-cargador.js?v=tintin-20260716-cloudinary-fix-1';

const WHATSAPP_SUPPORT_NUMBER = '595981299331';

// Único texto visible para la persona: no explica el motivo ni el estado
// interno de la cuenta; el detalle queda solo en el panel de Super Admin.
export const ACCOUNT_PROBLEM_TEXT = 'Tu cuenta tiene problemas, por favor contáctanos por';

export function accountSupportUrl(email = '') {
  const text = `Hola, tengo problemas con mi cuenta, mi correo es: ${String(email || '').trim()}`;
  return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(text)}`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Mensaje corto con "WhatsApp" como enlace, listo para insertar como HTML. */
export function accountProblemHtml(email = '') {
  return `${ACCOUNT_PROBLEM_TEXT} <a href="${escapeAttribute(accountSupportUrl(email))}" target="_blank" rel="noopener" style="color:inherit;font-weight:800;text-decoration:underline">WhatsApp</a>.`;
}

const OVERLAY_ID = 'tt-blocked-overlay';
let pending = false;

/**
 * Muestra el diálogo de cuenta bloqueada sobre toda la página. Es idempotente
 * y no tiene cierre: la persona debe volver al Inicio o contactar a soporte.
 * Espera a que el loader termine para que el aviso quede visible y enfocable.
 */
export function showBlockedModal({ email = '' } = {}) {
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
        <div class="tt-blocked-icon" aria-hidden="true"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/></svg></div>
        <h2 class="tt-blocked-title" id="tt-blocked-title">No podés ingresar</h2>
        <p class="tt-blocked-message" id="tt-blocked-message">${accountProblemHtml(email)}</p>
        <div class="tt-blocked-actions">
          <a
            class="tt-blocked-action tt-blocked-action-secondary"
            href="${escapeAttribute(accountSupportUrl(email))}"
            target="_blank"
            rel="noopener"
          >Contactar soporte</a>
          <a class="tt-blocked-action tt-blocked-action-primary" href="/">Volver al inicio</a>
        </div>
      </section>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      overlay.querySelector('.tt-blocked-dialog')?.focus({ preventScroll: true });
    });
  });
}
