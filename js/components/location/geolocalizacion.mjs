// Una sola solicitud y diagnóstico para perfil, alta y checkout.
export async function requestCurrentLocation({ navigator: nav = globalThis.navigator, secure = globalThis.isSecureContext, document: doc = globalThis.document, signal } = {}) {
  if (!secure) throw new Error('La ubicación actual necesita HTTPS. Abrí la página en una conexión segura.');
  const policy = doc?.permissionsPolicy || doc?.featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature('geolocation')) {
    throw new Error('La vista previa no permite usar tu ubicación. Abrí el sitio en una pestaña propia o marcá el punto en el mapa.');
  }
  if (!nav?.geolocation) throw new Error('Este navegador no ofrece ubicación. Buscá tu dirección o marcá el punto en el mapa.');
  const read = (options, watch = false) => new Promise((resolve, reject) => {
    const watching = watch && typeof nav.geolocation.watchPosition === 'function' && typeof nav.geolocation.clearWatch === 'function';
    let settled = false;
    let watchId;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (watchId != null) nav.geolocation.clearWatch(watchId);
    };
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const abort = () => finish(reject)(new DOMException('Búsqueda cancelada', 'AbortError'));
    // El timeout nativo puede quedar esperando permisos o un proveedor del sistema.
    // Este límite también cubre navegadores que nunca ejecutan sus callbacks.
    const timer = setTimeout(() => finish(reject)({ code: 3 }), options.timeout + 1000);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    const success = position => {
      const { latitude: lat, longitude: lng } = position?.coords || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        if (!watching) finish(reject)({ code: 2 });
        return;
      }
      finish(resolve)(position);
    };
    try {
      if (watching) {
        // Un fallo transitorio no termina la recuperación: el proveedor puede
        // entregar el primer punto válido en la siguiente actualización.
        watchId = nav.geolocation.watchPosition(success, error => {
          if (error?.code === 1 || ![2, 3].includes(error?.code)) finish(reject)(error);
        }, options);
        if (settled && watchId != null) nav.geolocation.clearWatch(watchId);
      } else nav.geolocation.getCurrentPosition(success, finish(reject), options);
    } catch (error) { finish(reject)(error); }
  });
  try {
    // Un GPS de alta precisión obligatorio puede fallar en equipos de escritorio.
    let position;
    try { position = await read({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }); }
    catch (error) {
      if (![2, 3].includes(error?.code)) throw error;
      position = await read({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }, true);
    }
    const { latitude: lat, longitude: lng, accuracy } = position?.coords || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw { code: 2 };
    return { lat, lng, accuracy };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
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
