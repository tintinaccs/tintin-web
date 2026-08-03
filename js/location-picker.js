// =============================================================
// TINTIN ACCESORIOS — Buscador de ubicación (compartido)
// =============================================================
// Habla con /api/geo-search, el MISMO backend que usa el mapa del checkout
// (Nominatim + Photon vía proxy de Cloudflare, con caché en el edge). No es
// otro sistema de direcciones: es el mismo origen de datos y el mismo formato
// de resultado {lat, lng, name, address}, así que lo que se guarda desde el
// perfil el checkout lo puede reutilizar tal cual.
//
// Acá no hay mapa: en el alta de la cuenta alcanza con buscar y elegir. El
// checkout sigue mostrando el mapa para ajustar el punto exacto sobre la
// dirección que ya quedó guardada.

import { apiUrl } from "./function-origin.js?v=tintin-20260716-cloudinary-fix-1";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

/**
 * Coordenada realmente utilizable.
 *
 * No alcanza con Number.isFinite(Number(v)): Number(null) y Number('') dan 0,
 * así que un resultado sin coordenadas se colaba como el punto (0, 0) —
 * en el Golfo de Guinea, a medio mundo de la zona de reparto.
 */
function isUsableCoord(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

/**
 * URL del endpoint de búsqueda.
 *
 * Una ruta relativa no sirve: el sitio también se publica en GitHub Pages,
 * donde las funciones /api/* no existen y un fetch relativo da 404 (ver
 * js/function-origin.js). Fuera del navegador —los tests— se usa la ruta
 * relativa, que es lo que esperan los stubs de fetch.
 */
function geoSearchUrl(query) {
  const base = typeof window === 'undefined' ? '/api/geo-search' : apiUrl('geo-search');
  return `${base}?q=${encodeURIComponent(query)}`;
}

/** Consulta el proxy de búsqueda de direcciones. Devuelve [] ante cualquier fallo. */
export async function searchPlaces(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  try {
    const response = await fetch(geoSearchUrl(q), { signal });
    if (!response.ok) throw new Error(`geo-search ${response.status}`);
    const data = await response.json();
    // El endpoint devuelve `places` (ver functions/api/geo-search.js), con la
    // forma {lat, lng, name, address} — la misma que consume el mapa del
    // checkout.
    const places = Array.isArray(data?.places) ? data.places : [];
    return places.filter(p => isUsableCoord(p.lat) && isUsableCoord(p.lng));
  } catch (error) {
    if (error?.name === 'AbortError') return [];
    console.error('[location-picker] No se pudo buscar la dirección:', error);
    throw error;
  }
}

/**
 * Conecta un input de texto + una lista de resultados como buscador de
 * direcciones con teclado (flechas, Enter, Escape) y mouse.
 *
 * La ubicación sólo queda elegida cuando se selecciona un resultado real: un
 * texto escrito a mano no trae coordenadas y el checkout no lo podría usar.
 *
 * @returns {{ getSelected: () => object|null, setSelected: (place) => void, destroy: () => void }}
 */
export function attachLocationPicker({ input, resultsList, selectedLabel, onChange, onError } = {}) {
  if (!input || !resultsList) return { getSelected: () => null, setSelected: () => {}, destroy: () => {} };

  let selected = null;
  let results = [];
  let activeIndex = -1;
  let debounceTimer = null;
  let inFlight = null;

  const emit = () => { if (typeof onChange === 'function') onChange(selected); };

  const renderSelected = () => {
    if (!selectedLabel) return;
    if (selected) {
      selectedLabel.textContent = `Ubicación elegida: ${selected.address}`;
      selectedLabel.hidden = false;
    } else {
      selectedLabel.hidden = true;
      selectedLabel.textContent = '';
    }
  };

  const closeList = () => {
    resultsList.hidden = true;
    resultsList.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  };

  const highlight = index => {
    activeIndex = index;
    [...resultsList.children].forEach((li, i) => {
      const active = i === index;
      li.classList.toggle('is-active', active);
      li.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  };

  const choose = place => {
    selected = {
      address: place.address || place.name,
      addressName: place.name || '',
      addressLat: Number(place.lat),
      addressLng: Number(place.lng),
    };
    input.value = selected.address;
    closeList();
    renderSelected();
    emit();
  };

  const renderResults = list => {
    results = list;
    if (!list.length) { closeList(); return; }
    resultsList.replaceChildren(...list.map((place, index) => {
      const li = document.createElement('li');
      li.className = 'tt-address-result';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.id = `${resultsList.id}-opt-${index}`;
      const name = document.createElement('strong');
      name.textContent = place.name;
      const detail = document.createElement('span');
      detail.textContent = place.address;
      li.append(name, detail);
      li.addEventListener('mousedown', event => { event.preventDefault(); choose(place); });
      return li;
    }));
    resultsList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
  };

  const runSearch = async query => {
    inFlight?.abort();
    inFlight = new AbortController();
    try {
      renderResults(await searchPlaces(query, { signal: inFlight.signal }));
    } catch {
      closeList();
      if (typeof onError === 'function') {
        onError('No pudimos buscar la dirección. Revisá tu conexión e intentá de nuevo.');
      }
    }
  };

  const onInput = () => {
    // Escribir después de haber elegido invalida la elección: el texto suelto
    // no tiene coordenadas y el checkout no lo podría usar.
    if (selected && input.value.trim() !== selected.address) {
      selected = null;
      renderSelected();
      emit();
    }
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) { closeList(); return; }
    debounceTimer = setTimeout(() => runSearch(query), DEBOUNCE_MS);
  };

  const onKeyDown = event => {
    if (resultsList.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight((activeIndex + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(activeIndex <= 0 ? results.length - 1 : activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      closeList();
    }
  };

  const onBlur = () => setTimeout(closeList, 120);

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', onBlur);

  return {
    getSelected: () => selected,
    setSelected: place => {
      selected = place && Number.isFinite(Number(place.addressLat)) ? place : null;
      if (selected) input.value = selected.address;
      renderSelected();
    },
    destroy: () => {
      clearTimeout(debounceTimer);
      inFlight?.abort();
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('blur', onBlur);
    },
  };
}
