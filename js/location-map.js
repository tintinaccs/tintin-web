// =============================================================
// TINTIN ACCESORIOS — Mapa de ubicación compartido
// =============================================================
// Registro y checkout usan el mismo formato {lat,lng,name,address}, el mismo
// zoom, la misma precisión y el mismo backend de búsqueda.

import { searchPlaces } from "./location-picker.js?v=tintin-20260803-location-picker-2";

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DEFAULT_CENTER = [-25.2867, -57.6467];
const DEFAULT_ZOOM = 13;
const PICKED_ZOOM = 17;
const SEARCH_DEBOUNCE_MS = 320;
const MIN_QUERY_LENGTH = 3;
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 9000,
  maximumAge: 60000,
};

let leafletPromise = null;

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
    return 'El permiso de ubicación está bloqueado. Permitilo desde el icono junto a la dirección del sitio o marcá el punto manualmente.';
  }
  if (error?.code === 2) {
    return 'El dispositivo no pudo determinar tu ubicación. Activá la ubicación del sistema o marcá el punto manualmente.';
  }
  if (error?.code === 3) {
    return 'La ubicación tardó demasiado. Volvé a intentarlo o marcá el punto manualmente.';
  }
  return 'No pudimos obtener tu ubicación. Revisá el permiso del navegador o marcá el punto manualmente.';
}

function parseCoordinateInput(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  const patterns = [
    /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /(?:query|q|ll)=(-?\d{1,3}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i,
    /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return {
        lat,
        lng,
        name: 'Ubicación elegida',
        address: raw,
      };
    }
  }
  return null;
}

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
  let searchGeneration = 0;
  let resizeObserver = null;

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
      (!resolvedLocationNameInput.value.trim() || resolvedLocationNameInput.dataset.ttAutoFilled === '1')
    ) {
      resolvedLocationNameInput.value = place.name;
      resolvedLocationNameInput.dataset.ttAutoFilled = '1';
      resolvedLocationNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const onLocationNameInput = () => {
    if (resolvedLocationNameInput && document.activeElement === resolvedLocationNameInput) {
      resolvedLocationNameInput.dataset.ttAutoFilled = '0';
    }
  };
  resolvedLocationNameInput?.addEventListener('input', onLocationNameInput);

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
      const position = marker.getLatLng();
      setLocation(position.lat, position.lng);
    });

    setLocation(lat, lng, place);
  };

  const applyPlace = place => {
    if (!place || !Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng))) return;
    map.setView([Number(place.lat), Number(place.lng)], PICKED_ZOOM, { animate: false });
    placeMarker(Number(place.lat), Number(place.lng), place);
    closeResults();
    requestAnimationFrame(() => map.invalidateSize());
    mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  map.on('click', event => placeMarker(event.latlng.lat, event.latlng.lng));

  const locateCurrent = () => new Promise(resolve => {
    if (locating) { resolve(false); return; }
    if (!window.isSecureContext) {
      if (typeof onError === 'function') onError('La ubicación actual solo funciona en una conexión segura HTTPS.');
      resolve(false);
      return;
    }
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
        applyPlace({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Mi ubicación actual',
          address: 'Ubicación obtenida desde este dispositivo',
        });
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

  const onLocateClick = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    locateCurrent();
  };
  resolvedLocateButton?.addEventListener('click', onLocateClick, true);

  const closeResults = () => {
    if (!resultsEl) return;
    resultsEl.replaceChildren();
    resultsEl.classList.remove('show');
    searchInput?.setAttribute('aria-expanded', 'false');
  };

  const renderMessage = message => {
    if (!resultsEl) return;
    const item = document.createElement('div');
    item.className = 'tt-map-result tt-map-result-empty';
    item.textContent = message;
    resultsEl.replaceChildren(item);
    resultsEl.classList.add('show');
    searchInput?.setAttribute('aria-expanded', 'true');
  };

  const renderResults = places => {
    if (!resultsEl) return;
    if (!places.length) {
      renderMessage('No encontramos ese lugar. Probá con el nombre del negocio, la calle o el barrio; también podés tocar el mapa.');
      return;
    }

    resultsEl.replaceChildren(...places.map(place => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tt-map-result';
      item.setAttribute('role', 'option');

      const name = document.createElement('div');
      name.className = 'tt-map-result-name';
      name.textContent = `📍 ${place.name}`;
      const address = document.createElement('div');
      address.className = 'tt-map-result-addr';
      address.textContent = [place.address, place.source].filter(Boolean).join(' · ');
      item.append(name, address);

      const choosePlace = event => {
        event.preventDefault();
        event.stopPropagation();
        applyPlace(place);
      };
      item.addEventListener('pointerdown', choosePlace);
      item.addEventListener('click', choosePlace);
      return item;
    }));

    resultsEl.classList.add('show');
    searchInput?.setAttribute('aria-expanded', 'true');
  };

  const runSearch = async rawQuery => {
    const generation = ++searchGeneration;
    const coordinate = parseCoordinateInput(rawQuery);
    if (coordinate) {
      applyPlace(coordinate);
      return;
    }

    renderMessage('Buscando lugares, negocios, calles y puntos de referencia…');
    try {
      const places = await searchPlaces(rawQuery);
      if (generation !== searchGeneration) return;
      renderResults(places);
    } catch {
      if (generation !== searchGeneration) return;
      renderMessage('No pudimos consultar el buscador ahora. Podés usar tu ubicación actual o marcar el punto directamente en el mapa.');
      if (typeof onError === 'function') {
        onError('No pudimos consultar el buscador ahora. Podés usar tu ubicación actual o marcar el punto directamente en el mapa.');
      }
    }
  };

  const onSearchInput = event => {
    event.stopImmediatePropagation();
    clearTimeout(debounce);
    const query = searchInput.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      closeResults();
      return;
    }
    debounce = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  };

  const onSearchKeyDown = event => {
    if (event.key === 'Escape') closeResults();
  };

  const onDocumentClick = event => {
    if (event.target !== searchInput && !resultsEl?.contains(event.target)) closeResults();
  };

  if (searchInput && resultsEl) {
    searchInput.placeholder = 'Buscar negocio, local, calle, barrio o referencia…';
    searchInput.setAttribute('aria-autocomplete', 'list');
    searchInput.setAttribute('aria-controls', resultsEl.id);
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.addEventListener('input', onSearchInput, true);
    searchInput.addEventListener('keydown', onSearchKeyDown);
    document.addEventListener('click', onDocumentClick);
  }

  [100, 350, 900].forEach(delay => setTimeout(() => map.invalidateSize(), delay));
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapEl);
  }

  return {
    getLocation: () => location,
    setLocation: place => applyPlace(place),
    locateCurrent,
    invalidateSize: () => map.invalidateSize(),
    destroy: () => {
      clearTimeout(debounce);
      searchGeneration += 1;
      if (searchInput) {
        searchInput.removeEventListener('input', onSearchInput, true);
        searchInput.removeEventListener('keydown', onSearchKeyDown);
      }
      document.removeEventListener('click', onDocumentClick);
      resolvedLocateButton?.removeEventListener('click', onLocateClick, true);
      resolvedLocationNameInput?.removeEventListener('input', onLocationNameInput);
      resizeObserver?.disconnect();
      map.remove();
    },
  };
}
