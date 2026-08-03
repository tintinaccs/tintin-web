// =============================================================
// TINTIN ACCESORIOS — Mapa de ubicación (compartido)
// =============================================================
// El mapa de Leaflet con el pin arrastrable vivía suelto dentro de
// checkout.html. Ahora es un componente propio, para que el alta de la cuenta
// use exactamente el mismo comportamiento de ubicación actual que checkout.
//
// Qué hace: carga Leaflet bajo demanda, muestra el mapa, deja marcar el punto
// tocando el mapa o arrastrando el pin, ofrece búsqueda de lugares y controla
// el botón de ubicación actual con la misma precisión, zoom y estados visuales
// del checkout.
//
// El formato del punto es {lat, lng, name, address}: el mismo que ya usaba el
// checkout y el mismo que se guarda en `users.savedLocation`.

import { searchPlaces } from "./location-picker.js?v=tintin-20260803-location-picker-1";

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DEFAULT_CENTER = [-25.2867, -57.6467]; // Asunción
const DEFAULT_ZOOM = 13;
const PICKED_ZOOM = 17;
const SEARCH_DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 3;
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 9000,
  maximumAge: 60000,
};

let leafletPromise = null;

/** Carga Leaflet una sola vez, aunque se creen varios mapas. */
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('No se pudo cargar el mapa'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function pinIcon(L) {
  return L.divIcon({
    className: '',
    html: '<div style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">📍</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function geolocationErrorMessage(error) {
  if (error?.code === 1) {
    return 'No pudimos obtener tu ubicación porque el permiso está bloqueado. Permití la ubicación para este sitio o marcá el punto manualmente.';
  }
  if (error?.code === 2) {
    return 'Tu dispositivo no pudo determinar la ubicación en este momento. Probá otra vez o marcá el punto manualmente.';
  }
  if (error?.code === 3) {
    return 'La ubicación tardó demasiado en responder. Probá otra vez o marcá el punto manualmente.';
  }
  return 'No pudimos obtener tu ubicación. Revisá el permiso del navegador o marcá el punto manualmente.';
}

/**
 * Crea el mapa sobre `mapEl`.
 *
 * @param {object}   options
 * @param {Element}  options.mapEl        Contenedor del mapa.
 * @param {Element} [options.searchInput] Campo de búsqueda de lugares.
 * @param {Element} [options.resultsEl]   Contenedor de los resultados.
 * @param {Element} [options.locateButton] Botón para usar la ubicación actual.
 * @param {(place|null) => void} [options.onChange] Se llama con {lat,lng,name,address}
 *        cada vez que cambia el punto elegido — por búsqueda, click o arrastre.
 * @param {(msg: string) => void} [options.onError]
 *
 * @returns {Promise<{getLocation, setLocation, locateCurrent, invalidateSize, destroy}>}
 */
export async function createLocationMap({
  mapEl,
  searchInput,
  resultsEl,
  locateButton,
  onChange,
  onError,
} = {}) {
  if (!mapEl) throw new Error('createLocationMap necesita un contenedor');

  const L = await loadLeaflet();
  const map = L.map(mapEl, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const resolvedLocateButton = locateButton || (
    mapEl.id === 'login-profile-map'
      ? document.getElementById('login-profile-locate')
      : null
  );
  const resolvedLocationNameInput = mapEl.id === 'login-profile-map'
    ? document.getElementById('login-profile-address-name')
    : null;

  let marker = null;
  let icon = null;
  let location = null;
  let debounce = null;
  let locating = false;

  const emit = () => { if (typeof onChange === 'function') onChange(location); };

  const setButtonLoading = loading => {
    if (!resolvedLocateButton) return;
    resolvedLocateButton.disabled = loading;
    resolvedLocateButton.textContent = loading
      ? '📍 Obteniendo ubicación…'
      : '📍 Usar mi ubicación actual';
  };

  const syncLocationFields = place => {
    if (!place) return;
    if (searchInput && place.name) searchInput.value = place.name;
    if (
      resolvedLocationNameInput &&
      place.name &&
      (!resolvedLocationNameInput.value.trim() ||
        resolvedLocationNameInput.dataset.ttAutoFilled === '1')
    ) {
      resolvedLocationNameInput.value = place.name;
      resolvedLocationNameInput.dataset.ttAutoFilled = '1';
    }
  };

  const onLocationNameInput = () => {
    if (resolvedLocationNameInput && document.activeElement === resolvedLocationNameInput) {
      resolvedLocationNameInput.dataset.ttAutoFilled = '0';
    }
  };
  resolvedLocationNameInput?.addEventListener('input', onLocationNameInput);

  // `place` sólo viene cuando el punto salió de una búsqueda o del GPS.
  // Tocar el mapa o arrastrar el pin conserva el nombre porque la persona está
  // ajustando el punto. Cuando se provee un nuevo nombre (por ejemplo GPS),
  // reemplaza correctamente el resultado anterior.
  const setLocation = (lat, lng, place) => {
    const hasPlace = Boolean(place);
    const hasName = hasPlace && Object.prototype.hasOwnProperty.call(place, 'name');
    const hasAddress = hasPlace && Object.prototype.hasOwnProperty.call(place, 'address');
    location = {
      lat: +Number(lat).toFixed(6),
      lng: +Number(lng).toFixed(6),
      name: hasName ? String(place.name || '') : location?.name || '',
      address: hasAddress ? String(place.address || '') : location?.address || '',
    };
    syncLocationFields(location);
    emit();
  };

  const placeMarker = (lat, lng, place) => {
    if (!icon) icon = pinIcon(L);
    const latlng = L.latLng(lat, lng);
    if (marker) marker.setLatLng(latlng);
    else marker = L.marker(latlng, { icon, draggable: true }).addTo(map);

    marker.off('dragend').on('dragend', () => {
      const pos = marker.getLatLng();
      setLocation(pos.lat, pos.lng);
    });

    setLocation(lat, lng, place);
  };

  map.on('click', event => placeMarker(event.latlng.lat, event.latlng.lng));

  const locateCurrent = () => new Promise(resolve => {
    if (locating) { resolve(false); return; }
    if (!navigator.geolocation) {
      if (typeof onError === 'function') {
        onError('Este navegador no permite obtener la ubicación actual. Podés buscarla o marcarla manualmente en el mapa.');
      }
      resolve(false);
      return;
    }

    locating = true;
    setButtonLoading(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        locating = false;
        setButtonLoading(false);
        const currentPlace = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Mi ubicación actual',
          address: 'Ubicación obtenida desde este dispositivo',
        };
        map.setView([currentPlace.lat, currentPlace.lng], PICKED_ZOOM, { animate: false });
        placeMarker(currentPlace.lat, currentPlace.lng, currentPlace);
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        resolve(true);
      },
      error => {
        locating = false;
        setButtonLoading(false);
        if (typeof onError === 'function') onError(geolocationErrorMessage(error));
        resolve(false);
      },
      GEOLOCATION_OPTIONS,
    );
  });

  // Se usa captura para que el componente compartido sea la única fuente de
  // comportamiento incluso mientras login.html conserva su manejador legado.
  const onLocateClick = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    locateCurrent();
  };
  resolvedLocateButton?.addEventListener('click', onLocateClick, true);

  // --- Búsqueda ---------------------------------------------------------
  const closeResults = () => {
    if (!resultsEl) return;
    resultsEl.replaceChildren();
    resultsEl.classList.remove('show');
  };

  const renderResults = places => {
    if (!resultsEl) return;
    if (!places.length) {
      const empty = document.createElement('div');
      empty.className = 'tt-map-result tt-map-result-empty';
      empty.textContent = 'Sin resultados — probá con otro nombre o tocá el mapa para marcar el punto';
      resultsEl.replaceChildren(empty);
      resultsEl.classList.add('show');
      return;
    }
    resultsEl.replaceChildren(...places.map(place => {
      const item = document.createElement('div');
      item.className = 'tt-map-result';
      item.setAttribute('role', 'option');
      const name = document.createElement('div');
      name.className = 'tt-map-result-name';
      name.textContent = `📍 ${place.name}`;
      const address = document.createElement('div');
      address.className = 'tt-map-result-addr';
      address.textContent = place.address;
      item.append(name, address);
      item.addEventListener('mousedown', event => {
        event.preventDefault();
        map.setView([Number(place.lat), Number(place.lng)], PICKED_ZOOM, { animate: false });
        placeMarker(Number(place.lat), Number(place.lng), place);
        if (searchInput) searchInput.value = place.name;
        closeResults();
      });
      return item;
    }));
    resultsEl.classList.add('show');
  };

  const runSearch = async query => {
    if (!resultsEl) return;
    const loading = document.createElement('div');
    loading.className = 'tt-map-result tt-map-result-empty';
    loading.textContent = 'Buscando…';
    resultsEl.replaceChildren(loading);
    resultsEl.classList.add('show');
    try {
      renderResults(await searchPlaces(query));
    } catch {
      closeResults();
      if (typeof onError === 'function') {
        onError('No pudimos buscar. Revisá tu conexión o tocá el mapa para marcar el punto.');
      }
    }
  };

  const onSearchInput = () => {
    clearTimeout(debounce);
    const query = searchInput.value.trim();
    if (query.length < MIN_QUERY_LENGTH) { closeResults(); return; }
    debounce = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  };

  const onDocumentClick = event => {
    if (event.target !== searchInput && !resultsEl?.contains(event.target)) closeResults();
  };

  if (searchInput && resultsEl) {
    searchInput.addEventListener('input', onSearchInput);
    document.addEventListener('click', onDocumentClick);
  }

  // El mapa se dibuja mal si su contenedor estaba oculto al crearse (display
  // none, panel de otro paso). Un invalidateSize diferido lo corrige.
  setTimeout(() => map.invalidateSize(), 300);

  return {
    getLocation: () => location,
    /** Coloca un punto ya conocido (por ejemplo el guardado en el perfil). */
    setLocation: place => {
      if (!place || !Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng))) return;
      map.setView([Number(place.lat), Number(place.lng)], PICKED_ZOOM, { animate: false });
      placeMarker(Number(place.lat), Number(place.lng), place);
    },
    locateCurrent,
    invalidateSize: () => map.invalidateSize(),
    destroy: () => {
      clearTimeout(debounce);
      if (searchInput) searchInput.removeEventListener('input', onSearchInput);
      document.removeEventListener('click', onDocumentClick);
      resolvedLocateButton?.removeEventListener('click', onLocateClick, true);
      resolvedLocationNameInput?.removeEventListener('input', onLocationNameInput);
      map.remove();
    },
  };
}
