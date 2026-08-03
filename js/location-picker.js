// =============================================================
// TINTIN ACCESORIOS — Buscador de ubicación compartido
// =============================================================
// Usa el mismo backend del checkout y una ruta de respaldo idéntica. Ambos
// devuelven {lat, lng, name, address, source}.

import { apiUrl } from "./function-origin.js?v=tintin-20260716-cloudinary-fix-1";

const DEBOUNCE_MS = 320;
const MIN_QUERY_LENGTH = 3;

function isUsableCoord(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

function normalizePlaces(data) {
  const places = Array.isArray(data?.places) ? data.places : [];
  return places
    .filter(place => isUsableCoord(place?.lat) && isUsableCoord(place?.lng))
    .map(place => ({
      lat: Number(place.lat),
      lng: Number(place.lng),
      name: String(place.name || place.address || 'Ubicación'),
      address: String(place.address || place.name || 'Ubicación'),
      source: String(place.source || ''),
    }));
}

function endpointCandidates(query) {
  const encoded = encodeURIComponent(query);
  return [
    `${apiUrl('geo-search')}?q=${encoded}`,
    `${apiUrl('location-search')}?q=${encoded}`,
  ];
}

/** Consulta el mismo buscador usado por checkout, con una ruta alternativa. */
export async function searchPlaces(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  let lastError = null;
  for (const url of endpointCandidates(q)) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      });
      if (!response.ok) {
        lastError = new Error(`location-search ${response.status}`);
        continue;
      }
      const data = await response.json();
      return normalizePlaces(data);
    } catch (error) {
      if (error?.name === 'AbortError') return [];
      lastError = error;
    }
  }

  console.error('[location-picker] No se pudo buscar la dirección:', lastError);
  throw lastError || new Error('location_search_unavailable');
}

/**
 * Conecta un input y una lista de resultados con teclado y puntero.
 */
export function attachLocationPicker({ input, resultsList, selectedLabel, onChange, onError } = {}) {
  if (!input || !resultsList) {
    return { getSelected: () => null, setSelected: () => {}, destroy: () => {} };
  }

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
    [...resultsList.children].forEach((item, currentIndex) => {
      const active = currentIndex === index;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
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
    resultsList.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('li');
      empty.className = 'tt-address-result tt-address-result-empty';
      empty.textContent = 'No encontramos ese lugar. Probá con el nombre del negocio, la calle o el barrio.';
      resultsList.appendChild(empty);
      resultsList.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      return;
    }

    list.forEach((place, index) => {
      const item = document.createElement('li');
      item.className = 'tt-address-result';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.id = `${resultsList.id}-opt-${index}`;

      const name = document.createElement('strong');
      name.textContent = place.name;
      const detail = document.createElement('span');
      detail.textContent = [place.address, place.source].filter(Boolean).join(' · ');
      item.append(name, detail);

      const selectPlace = event => {
        event.preventDefault();
        event.stopPropagation();
        choose(place);
      };
      item.addEventListener('pointerdown', selectPlace);
      item.addEventListener('click', selectPlace);
      resultsList.appendChild(item);
    });

    resultsList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
  };

  const renderLoading = () => {
    const loading = document.createElement('li');
    loading.className = 'tt-address-result tt-address-result-empty';
    loading.textContent = 'Buscando lugares, calles y negocios…';
    resultsList.replaceChildren(loading);
    resultsList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const runSearch = async query => {
    inFlight?.abort();
    inFlight = new AbortController();
    renderLoading();
    try {
      renderResults(await searchPlaces(query, { signal: inFlight.signal }));
    } catch {
      closeList();
      if (typeof onError === 'function') {
        onError('No pudimos consultar el buscador ahora. Podés usar tu ubicación actual o marcar el punto directamente en el mapa.');
      }
    }
  };

  const onInput = () => {
    if (selected && input.value.trim() !== selected.address) {
      selected = null;
      renderSelected();
      emit();
    }
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      closeList();
      return;
    }
    debounceTimer = setTimeout(() => runSearch(query), DEBOUNCE_MS);
  };

  const onKeyDown = event => {
    if (resultsList.hidden) return;
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      highlight((activeIndex + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      highlight(activeIndex <= 0 ? results.length - 1 : activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      closeList();
    }
  };

  const onBlur = () => setTimeout(closeList, 160);

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
