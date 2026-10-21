// Firebase confirma el resultado y el cierre de su selector. Una referencia
// aislada por el navegador puede parecer cerrada aunque Google siga abierto.
export async function waitForGooglePopup(start, host = window) {
  const originalOpen = host.open;
  let deadline;
  const trackingOpen = function (...args) {
    const url = String(args[0] || '');
    const authWindow = !url || /^(?:https?:\/\/[^/]+)?\/__\/auth\/handler(?:[?#]|$)/.test(url);
    // Mantener tamaño, centrado, nombre y opener del SDK. El navegador conserva
    // la decisión final de usar ventana o pestaña, especialmente en móviles.
    if (authWindow) args[2] = [...String(args[2] || '').split(',').filter(option => option.trim() && !/^popup(?:\s*=|$)/i.test(option.trim())), 'popup=yes'].join(',');
    const opened = originalOpen.apply(host, args);
    if (authWindow && opened) {
      if (host.open === trackingOpen) host.open = originalOpen;
    }
    return opened;
  };
  host.open = trackingOpen;
  try {
    const operation = start();
    const timeout = new Promise((_, reject) => {
      deadline = host.setTimeout(() => reject(Object.assign(new Error('Google sin respuesta'), { code: 'auth/popup-timeout' })), 120000);
    });
    return await Promise.race([operation, timeout]);
  } finally {
    host.clearTimeout(deadline);
    if (host.open === trackingOpen) host.open = originalOpen;
  }
}
