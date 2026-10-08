// =============================================================
// TINTIN ACCESORIOS — Mapa de ubicación compartido
// =============================================================
// Registro y checkout usan el mismo formato {lat,lng,name,address}, el mismo
// zoom, la misma precisión y el mismo backend de búsqueda.

import { searchPlaces, parseLocationSearchInput } from "./selector-ubicacion.js?v=tintin-20261008-location-search-1";
import { requestCurrentLocation } from './geolocalizacion.mjs?v=tintin-20261004-location-consistency-1';

const LEAFLET_JS = '/js/vendor/leaflet/leaflet.js?v=leaflet-1.9.4';
const LEAFLET_JS_INTEGRITY = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const DEFAULT_CENTER = [-25.2867, -57.6467];
const DEFAULT_ZOOM = 13;
const PICKED_ZOOM = 17;
const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

let leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const failed = () => { clearTimeout(timer); leafletPromise = null; script.remove(); reject(new Error('No se pudo cargar el mapa')); };
    const timer = setTimeout(failed, 12000);
    script.src = LEAFLET_JS;
    script.integrity = LEAFLET_JS_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.onload = () => { if(!window.L){failed();return;} clearTimeout(timer); resolve(window.L); };
    script.onerror = failed;
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function pinIcon(L) {
  return L.divIcon({
    className: '',
    html: '<div class="tt-location-pin"><svg width="32" height="38" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 7 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function usablePlace(place) {
  if (!place) return false;
  if (place.lat == null || place.lng == null || place.lat === '' || place.lng === '') return false;
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
}

export async function createLocationMap({
  mapEl,
  searchInput,
  resultsEl,
  locateButton,
  onChange,
  onError,
  readOnly = false,
} = {}) {
  if (!mapEl) throw new Error('createLocationMap necesita un contenedor');

  const L = await loadLeaflet();
  const map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  mapEl.classList.add('tt-map-canvas');
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
  let destroyed = false;
  let inFlight = null;
  let resultPlaces = [];
  let activeIndex = -1;
  const status = document.createElement('p');
  status.className = 'tt-map-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  mapEl.before(status);
  const tools = document.createElement('div');
  tools.className = 'tt-map-navigation';
  tools.hidden = true;
  const googleLink = document.createElement('a');
  const wazeLink = document.createElement('a');
  [googleLink, wazeLink].forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
  googleLink.textContent = 'Ver en Google Maps';
  wazeLink.textContent = 'Ir con Waze';
  tools.append(googleLink, wazeLink);
  mapEl.after(tools);
  tiles.on('tileerror', () => {
    if (destroyed) return;
    status.hidden = false;
    status.textContent = 'No pudimos cargar el fondo del mapa. Tu ubicación se conserva. Podés buscar un lugar o abrir el punto en Google Maps o Waze.';
    if (typeof onError === 'function') onError(status.textContent);
  });

  const emit = () => { if (typeof onChange === 'function') onChange(location); };

  const setButtonLoading = loading => {
    if (!resolvedLocateButton) return;
    resolvedLocateButton.disabled = loading;
    resolvedLocateButton.setAttribute('aria-busy', String(loading));
    resolvedLocateButton.textContent = loading
      ? '📍 Obteniendo ubicación…'
      : 'Usar mi ubicación actual';
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
    if (!usablePlace({ lat, lng })) return;
    const hasPlace = Boolean(place);
    const hasName = hasPlace && Object.prototype.hasOwnProperty.call(place, 'name');
    const hasAddress = hasPlace && Object.prototype.hasOwnProperty.call(place, 'address');
    location = {
      lat: +Number(lat).toFixed(6),
      lng: +Number(lng).toFixed(6),
      name: hasName ? String(place.name || '') : 'Punto marcado',
      // Un nuevo punto no conserva una calle que pertenecía a otro lugar.
      address: hasAddress ? String(place.address || '') : '',
    };
    googleLink.href = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    wazeLink.href = `https://waze.com/ul?ll=${location.lat},${location.lng}&navigate=yes`;
    tools.hidden = false;
    status.hidden = true;
    syncLocationFields(location);
    emit();
  };

  const placeMarker = (lat, lng, place) => {
    if (!icon) icon = pinIcon(L);
    const latlng = L.latLng(lat, lng);
    if (marker) marker.setLatLng(latlng);
    else marker = L.marker(latlng, { icon, draggable: !readOnly }).addTo(map);

    marker.off('dragend').on('dragend', () => {
      searchGeneration += 1;
      inFlight?.abort();
      closeResults();
      const position = marker.getLatLng();
      setLocation(position.lat, position.lng);
    });

    setLocation(lat, lng, place);
  };

  const closeResults = () => {
    if (!resultsEl) return;
    resultsEl.replaceChildren();
    resultsEl.classList.remove('show');
    searchInput?.setAttribute('aria-expanded', 'false');
    searchInput?.removeAttribute('aria-activedescendant');
    resultPlaces = [];
    activeIndex = -1;
  };

  const applyPlace = (place, { scroll = true } = {}) => {
    if (!usablePlace(place)) return;
    map.setView([Number(place.lat), Number(place.lng)], PICKED_ZOOM, { animate: false });
    placeMarker(Number(place.lat), Number(place.lng), place);
    searchGeneration += 1;
    inFlight?.abort();
    closeResults();
    requestAnimationFrame(() => map.invalidateSize());
    if (scroll) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!readOnly) map.on('click', event => {
    clearTimeout(debounce);
    searchGeneration += 1;
    inFlight?.abort();
    closeResults();
    placeMarker(event.latlng.lat, event.latlng.lng);
  });

  const locateCurrent = async () => {
    if (locating || destroyed) return false;
    locating = true;
    setButtonLoading(true);
    status.hidden = false;
    status.textContent = 'Buscando tu ubicación…';
    try {
      const position = await requestCurrentLocation();
      if (destroyed) return false;
      applyPlace({ ...position, name: 'Mi ubicación actual', address: '' }, { scroll: false });
      status.hidden = false;
      status.textContent = Number(position.accuracy) > 100
        ? 'La ubicación es aproximada. Mové el pin hasta el lugar exacto antes de guardar.'
        : 'Ubicación encontrada. Revisá el punto antes de guardar.';
      return true;
    } catch (error) {
      if (!destroyed) { status.hidden = false; status.textContent = error.message; }
      return false;
    } finally { locating = false; if (!destroyed) setButtonLoading(false); }
  };

  const onLocateClick = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    locateCurrent();
  };
  resolvedLocateButton?.addEventListener('click', onLocateClick, true);

  const renderMessage = message => {
    if (!resultsEl) return;
    const item = document.createElement('div');
    item.className = 'tt-map-result tt-map-result-empty';
    item.textContent = message;
    resultsEl.replaceChildren(item);
    resultsEl.classList.add('show');
    searchInput?.setAttribute('aria-expanded', 'true');
    resultPlaces = [];
    activeIndex = -1;
  };

  const renderResults = places => {
    if (!resultsEl) return;
    if (!places.length) {
      renderMessage('No encontramos ese lugar. Probá con el nombre del negocio, la calle o el barrio; también podés tocar el mapa.');
      return;
    }

    resultPlaces = places;
    activeIndex = -1;
    resultsEl.replaceChildren(...places.map((place, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tt-map-result';
      item.setAttribute('role', 'option');
      item.id = `${resultsEl.id}-option-${index}`;
      item.setAttribute('aria-selected', 'false');

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
      item.addEventListener('pointerdown', event => event.preventDefault());
      item.addEventListener('click', choosePlace);
      return item;
    }));

    resultsEl.classList.add('show');
    searchInput?.setAttribute('aria-expanded', 'true');
  };

  const runSearch = async rawQuery => {
    const generation = ++searchGeneration;
    inFlight?.abort();
    inFlight = new AbortController();
    const parsed = parseLocationSearchInput(rawQuery);
    if (parsed?.lat != null) {
      applyPlace(parsed);
      return;
    }
    if (parsed?.shortGoogleUrl) {
      renderMessage('Ese enlace corto de Google Maps no se puede leer sin abrirlo. Copiá el enlace completo o buscá el nombre del lugar acá.');
      return;
    }
    const query = parsed?.query || rawQuery;
    if (parsed?.query && searchInput) searchInput.value = query;

    renderMessage('Buscando lugares, negocios, calles y puntos de referencia…');
    try {
      const places = await searchPlaces(query, { signal: inFlight.signal });
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
    searchGeneration += 1;
    inFlight?.abort();
    const query = searchInput.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      closeResults();
      return;
    }
    debounce = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  };

  const onSearchKeyDown = event => {
    if (event.key === 'Escape') closeResults();
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && resultPlaces.length) {
      event.preventDefault();
      activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + resultPlaces.length) % resultPlaces.length;
      [...resultsEl.children].forEach((item, index) => item.setAttribute('aria-selected', String(index === activeIndex)));
      const selected = resultsEl.children[activeIndex];
      searchInput.setAttribute('aria-activedescendant', selected.id);
      selected.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(debounce);
      if (activeIndex >= 0 && resultPlaces[activeIndex]) applyPlace(resultPlaces[activeIndex], { scroll: false });
      else if (searchInput.value.trim().length >= MIN_QUERY_LENGTH) runSearch(searchInput.value.trim());
    }
  };

  const onDocumentClick = event => {
    if (event.target !== searchInput && !resultsEl?.contains(event.target)) closeResults();
  };

  if (searchInput && resultsEl) {
    searchInput.placeholder = 'Buscá un lugar, pegá un enlace de Google Maps o tocá el mapa…';
    searchInput.setAttribute('role', 'combobox');
    resultsEl.setAttribute('role', 'listbox');
    searchInput.setAttribute('aria-autocomplete', 'list');
    searchInput.setAttribute('aria-controls', resultsEl.id);
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.addEventListener('input', onSearchInput, true);
    searchInput.addEventListener('keydown', onSearchKeyDown);
    document.addEventListener('click', onDocumentClick);
  }

  const refreshMapSize = () => {
    if (destroyed || !mapEl.getClientRects().length) return;
    map.invalidateSize({ pan: false });
    if (location) map.setView([location.lat, location.lng], map.getZoom(), { animate: false });
  };
  const resizeTimers = [100, 350, 900].map(delay => setTimeout(refreshMapSize, delay));
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(refreshMapSize);
    resizeObserver.observe(mapEl);
  }

  // Si el perfil ya tenía una ubicación, se muestra en el mapa durante el
  // alta sin desplazar la pantalla ni obligar a marcarla otra vez. El usuario
  // puede continuar directamente o mover el pin si necesita corregirla.
  const onboardingSavedLocation = mapEl.id === 'login-profile-map'
    ? globalThis.TintinOnboardingSavedLocation
    : null;
  if (usablePlace(onboardingSavedLocation)) {
    requestAnimationFrame(() => {
      if (destroyed) return;
      applyPlace(onboardingSavedLocation, { scroll: false });
      mapEl.dataset.ttSavedLocationLoaded = '1';
    });
  }

  return {
    getLocation: () => location,
    setLocation: (place, options) => applyPlace(place, options),
    clearLocation: () => { clearTimeout(debounce); searchGeneration += 1; inFlight?.abort(); location = null; if (marker) { marker.remove(); marker = null; } tools.hidden = true; status.hidden = true; closeResults(); emit(); },
    locateCurrent,
    invalidateSize: () => map.invalidateSize(),
    destroy: () => {
      destroyed = true;
      inFlight?.abort();
      clearTimeout(debounce);
      resizeTimers.forEach(clearTimeout);
      searchGeneration += 1;
      if (searchInput) {
        searchInput.removeEventListener('input', onSearchInput, true);
        searchInput.removeEventListener('keydown', onSearchKeyDown);
      }
      document.removeEventListener('click', onDocumentClick);
      resolvedLocateButton?.removeEventListener('click', onLocateClick, true);
      resolvedLocationNameInput?.removeEventListener('input', onLocationNameInput);
      resizeObserver?.disconnect();
      status.remove();
      tools.remove();
      map.remove();
    },
  };
}

const previewControllers = new WeakMap();
export function renderSavedMapPreviews(root, addresses) {
  previewControllers.get(root)?.();
  const maps = [];
  const resizeObservers = [];
  let disposed = false;
  const observer = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach(async ({ target }) => {
      observer.unobserve(target);
      const place = addresses[Number(target.dataset.savedMap)];
      if (!usablePlace(place)) return;
      try {
        const L = await loadLeaflet();
        if (disposed || !target.isConnected) return;
        const map = L.map(target, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false }).setView([place.lat, place.lng], 15);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
        L.marker([place.lat, place.lng], { icon: pinIcon(L), interactive: false }).addTo(map);
        maps.push(map);
        const resize = () => {
          if (!disposed && target.isConnected && target.getClientRects().length) {
            map.invalidateSize({ pan: false });
            map.setView([place.lat, place.lng], 15, { animate: false });
          }
        };
        requestAnimationFrame(resize);
        if ('ResizeObserver' in window) {
          const sizeObserver = new ResizeObserver(resize);
          sizeObserver.observe(target);
          resizeObservers.push(sizeObserver);
        }
      } catch {
        if(disposed || !target.isConnected)return;
        target.replaceChildren();
        const retry=document.createElement('button');
        retry.type='button';retry.textContent='Reintentar vista del mapa';
        retry.className='perfil-btn';
        retry.addEventListener('click',()=>{if(disposed)return;target.replaceChildren();observer.observe(target);},{once:true});
        target.appendChild(retry);
      }
    });
  });
  root.querySelectorAll('[data-saved-map]').forEach(target => observer.observe(target));
  previewControllers.set(root, () => {
    disposed = true; observer.disconnect();
    resizeObservers.forEach(observer => observer.disconnect());
    maps.forEach(map => map.remove());
  });
}
