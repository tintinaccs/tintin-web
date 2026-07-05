// =============================================
// TINTIN ACCESORIOS — Modal de cuenta bloqueada
// =============================================
// Componente compartido por login.html y checkout.html (los dos lugares
// donde se detecta una cuenta bloqueada durante un intento de acceso) para
// mostrar SIEMPRE el mismo mensaje, con el mismo diseño estilo Tintin y el
// mismo enlace de WhatsApp — nada de alert()/confirm() nativos ni textos
// distintos según la página. Autocontenido (estilos inline) para no
// depender de ningún CSS de la página que lo use.

export const WHATSAPP_SUPPORT_TEXT = 'Hola Tintin, necesito ayuda con el acceso a mi cuenta.';
export const WHATSAPP_SUPPORT_URL = 'https://wa.me/595981299331?text=' + encodeURIComponent(WHATSAPP_SUPPORT_TEXT);

const OVERLAY_ID = 'tt-blocked-overlay';

/**
 * Muestra el modal de "cuenta bloqueada" tapando toda la página. Idempotente
 * — si ya está mostrado (ej. dos chequeos de bloqueo disparan casi a la vez),
 * no duplica el overlay. No tiene botón de cerrar a propósito: la única
 * salida es "Volver al inicio" o escribir por WhatsApp, nunca seguir
 * navegando en la página bloqueada.
 */
export function showBlockedModal() {
  if (document.getElementById(OVERLAY_ID)) return;
  const ov = document.createElement('div');
  ov.id = OVERLAY_ID;
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(30,10,18,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:32px 26px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.25);box-sizing:border-box">
      <div style="font-size:38px;margin-bottom:12px">🚫</div>
      <div style="font-weight:800;font-size:17px;color:#8b2642;margin-bottom:10px">No podés ingresar</div>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 22px">
        Lo siento, ahora no puedes ingresar. Puedes comunicarte con nuestro soporte
        <a href="${WHATSAPP_SUPPORT_URL}" target="_blank" rel="noopener" style="color:#b84c72;font-weight:700;text-decoration:underline">aquí</a>.
      </p>
      <a href="index.html" style="display:inline-block;background:#b84c72;color:#fff;padding:11px 26px;border-radius:50px;font-weight:700;font-size:13px;text-decoration:none">Volver al inicio</a>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
}
