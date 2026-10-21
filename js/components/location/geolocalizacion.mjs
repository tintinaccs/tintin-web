// Una sola solicitud y diagnóstico para perfil, alta y checkout.
export async function requestCurrentLocation({ navigator: nav = globalThis.navigator, secure = globalThis.isSecureContext, document: doc = globalThis.document, signal } = {}) {
  signal?.throwIfAborted();
  if (!secure) throw new Error('La ubicación actual necesita HTTPS. Abrí la página en una conexión segura.');
  const policy = doc?.permissionsPolicy || doc?.featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature('geolocation')) {
    throw new Error('La vista previa no permite usar tu ubicación. Abrí el sitio en una pestaña propia o marcá el punto en el mapa.');
  }
  if (!nav?.geolocation) throw new Error('Este navegador no ofrece ubicación. Buscá tu dirección o marcá el punto en el mapa.');
  const read = options => new Promise((resolve, reject) => {
    // El timeout nativo puede quedar esperando permisos o un proveedor del sistema.
    // Este límite también cubre navegadores que nunca ejecutan sus callbacks.
    let settled = false;
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      callback(value);
    };
    const cancel = () => finish(reject)(signal.reason);
    const timer = setTimeout(() => finish(reject)({ code: 3 }), options.timeout);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    try { nav.geolocation.getCurrentPosition(position => {
      const { latitude: lat, longitude: lng } = position?.coords || {};
      // Una lectura inválida también permite recuperar un punto fresco.
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) finish(reject)({ code: 2 });
      else finish(resolve)(position);
    }, finish(reject), options); }
    catch (error) { finish(reject)(error); }
  });
  try {
    // Un GPS de alta precisión obligatorio puede fallar en equipos de escritorio.
    let position;
    try { position = await read({ enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }); }
    catch (error) {
      signal?.throwIfAborted();
      if (![2, 3].includes(error?.code)) throw error;
      position = await read({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    }
    const { latitude: lat, longitude: lng, accuracy } = position?.coords || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw { code: 2 };
    return { lat, lng, accuracy };
  } catch (error) {
    signal?.throwIfAborted();
    let permission;
    if (error?.code === 1) {
      let timer;
      try {
        permission = (await Promise.race([
          nav.permissions?.query({ name: 'geolocation' }),
          new Promise(resolve => { timer = setTimeout(resolve, 1000); }),
        ]))?.state;
      } catch {} finally { clearTimeout(timer); }
    }
    if (error?.code === 1 && permission === 'granted') {
      throw new Error('El navegador tiene permiso, pero el dispositivo no entregó la ubicación. Revisá la ubicación del sistema y el acceso del navegador; después reintentá o marcá el punto en el mapa.');
    }
    if (error?.code === 1) throw new Error('No se autorizó la ubicación en este intento. Revisá los permisos del sitio y del sistema; también podés marcar el punto en el mapa.');
    if (error?.code === 2) throw new Error('El dispositivo no pudo determinar tu ubicación. Activá la ubicación del sistema y reintentá, o marcá el punto en el mapa.');
    if (error?.code === 3) throw new Error('La ubicación tardó demasiado. Reintentá o buscá tu dirección y ajustá el punto en el mapa.');
    throw new Error('No pudimos obtener la ubicación. Reintentá o marcá el punto en el mapa.');
  }
}
