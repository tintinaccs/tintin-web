// =============================================================
// TINTIN ACCESORIOS — Mapa de ubicación (compartido)
// =============================================================
// El mapa de Leaflet con el pin arrastrable vivía suelto dentro de
// checkout.html. Ahora es un componente propio, para que el alta de la cuenta
// use exactamente el mismo — no una versión parecida que se desincronice.
//
// Qué hace: carga Leaflet bajo demanda, muestra el mapa, deja marcar el punto
// tocando el mapa o arrastrando el pin, y ofrece búsqueda de lugares a través
// de js/location-picker.js (que a su vez pega a /api/geo-search, el proxy de
// OpenStreetMap). Quien lo usa recibe el resultado por `onChange` y decide
// qué hacer con él — el componente no conoce `orderData` ni ningún perfil.
//
// El formato del punto es {lat, lng, name, address}: el mismo que ya usaba el
// checkout y el mismo que se guarda en `users.savedLocation`.

import { searchPlaces } from "./location-picker.js?v=tintin-20260803-location-picker-1";

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DEFAULT_CENTER = [-25.2867, -57.6467]; // Asunción
const DEFAULT_ZOOM = 13;
const PICKED_ZOOM = 16;
const SEARCH_DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 3;

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

/**
 * Crea el mapa sobre `mapEl`.
 *
 * @param {object}   options
 * @param {Element}  options.mapEl        Contenedor del mapa.
 * @param {Element} [options.searchInput] Campo de búsqueda de lugares.
 * @param {Element} [options.resultsEl]   Contenedor de los resultados.
 * @param {(place|null) => void} [options.onChange] Se llama con {lat,lng,name,address}
 *        cada vez que cambia el punto elegido — por búsqueda, click o arrastre.
 * @param {(msg: string) => void} [options.onError]
 *
 * @returns {Promise<{getLocation, setLocation, invalidateSize, destroy}>}
 */
export async function createLocationMap({ mapEl, searchInput, resultsEl, onChange, onError } = {}) {
  if (!mapEl) throw new Error('createLocationMap necesita un contenedor');

  const L = await loadLeaflet();
  const map = L.map(mapEl, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  let marker = null;
  let icon = null;
  let location = null;
  let debounce = null;

  const emit = () => { if (typeof onChange === 'function') onChange(location); };

  // `place` sólo viene cuando el punto salió de un resultado de búsqueda.
  // Tocar el mapa o arrastrar el pin no trae nombre: en ese caso se conserva
  // el que ya hubiera, porque la persona está ajustando el punto, no
  // eligiendo otro lugar.
  const setLocation = (lat, lng, place) => {
    location = {
      lat: +Number(lat).toFixed(6),
      lng: +Number(lng).toFixed(6),
      name: place?.name || location?.name || '',
      address: place?.address || (place ? '' : location?.address || ''),
    };
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
        map.setView([Number(place.lat), Number(place.lng)], PICKED_ZOOM);
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
      map.setView([Number(place.lat), Number(place.lng)], PICKED_ZOOM);
      placeMarker(Number(place.lat), Number(place.lng), place);
    },
    invalidateSize: () => map.invalidateSize(),
    destroy: () => {
      clearTimeout(debounce);
      if (searchInput) searchInput.removeEventListener('input', onSearchInput);
      document.removeEventListener('click', onDocumentClick);
      map.remove();
    },
  };
}
