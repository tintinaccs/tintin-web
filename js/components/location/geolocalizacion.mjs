// Una sola solicitud y diagnóstico para perfil, alta y checkout.
export async function requestCurrentLocation({ navigator: nav = globalThis.navigator, secure = globalThis.isSecureContext, document: doc = globalThis.document } = {}) {
  if (!secure) throw new Error('La ubicación actual necesita HTTPS. Abrí la página en una conexión segura.');
  const policy = doc?.permissionsPolicy || doc?.featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature('geolocation')) {
    throw new Error('La vista previa no permite usar tu ubicación. Abrí el sitio en una pestaña propia o marcá el punto en el mapa.');
  }
  if (!nav?.geolocation) throw new Error('Este navegador no ofrece ubicación. Buscá tu dirección o marcá el punto en el mapa.');
  const read = options => new Promise((resolve, reject) => nav.geolocation.getCurrentPosition(resolve, reject, options));
  try {
    // Un GPS de alta precisión obligatorio puede fallar en equipos de escritorio.
    let position;
    try { position = await read({ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }); }
    catch (error) {
      if (![2, 3].includes(error?.code)) throw error;
      position = await read({ enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    }
    return { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
  } catch (error) {
    let permission;
    try { permission = (await nav.permissions?.query({ name: 'geolocation' }))?.state; } catch {}
    if (error?.code === 1 && permission === 'granted') {
      throw new Error('El navegador tiene permiso, pero el dispositivo no entregó la ubicación. Revisá la ubicación del sistema y el acceso del navegador; después reintentá o marcá el punto en el mapa.');
    }
    if (error?.code === 1) throw new Error('No se autorizó la ubicación en este intento. Revisá los permisos del sitio y del sistema; también podés marcar el punto en el mapa.');
    if (error?.code === 2) throw new Error('El dispositivo no pudo determinar tu ubicación. Activá la ubicación del sistema y reintentá, o marcá el punto en el mapa.');
    if (error?.code === 3) throw new Error('La ubicación tardó demasiado. Reintentá o buscá tu dirección y ajustá el punto en el mapa.');
    throw new Error('No pudimos obtener la ubicación. Reintentá o marcá el punto en el mapa.');
  }
}
