// Firebase conserva la autenticación; este guard sólo recupera la interfaz
// cuando el sondeo del SDK pierde el cierre de la ventana en otro origen.
export async function waitForGooglePopup(start, host = window) {
  const originalOpen = host.open;
  let popup = null;
  let timer;
  let deadline;
  const trackingOpen = function (...args) {
    const opened = originalOpen.apply(host, args);
    // Sólo se intercepta durante esta operación explícita de Google.
    const url = String(args[0] || '');
    if (!popup && opened && (!url || url.includes('/__/auth/handler'))) {
      popup = opened;
      if (host.open === trackingOpen) host.open = originalOpen;
    }
    return opened;
  };
  host.open = trackingOpen;
  try {
    const operation = start();
    const closed = new Promise((_, reject) => {
      timer = host.setInterval(() => {
        try {
          if (popup?.closed) reject(Object.assign(new Error('Google cerrado'), { code: 'auth/popup-closed-by-user' }));
        } catch { /* Un origen aislado no demuestra que la ventana esté cerrada. */ }
      }, 250);
      deadline = host.setTimeout(() => reject(Object.assign(new Error('Google sin respuesta'), { code: 'auth/popup-timeout' })), 120000);
    });
    return await Promise.race([operation, closed]);
  } finally {
    host.clearInterval(timer);
    host.clearTimeout(deadline);
    if (host.open === trackingOpen) host.open = originalOpen;
  }
}
