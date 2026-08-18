/* Conserva las coordenadas elegidas aunque el texto visible muestre el nombre
   del lugar. No cambia la UI: añade una copia oculta legible por el checkout. */
(() => {
  'use strict';
  if (window.TintinCheckoutMapCaptureBooted) return;
  window.TintinCheckoutMapCaptureBooted = true;

  let point = null;
  let patched = false;
  let observer = null;

  function appendMachineCoords() {
    const host = document.getElementById('ck-map-coords');
    if (!host || !point) return;
    host.dataset.ttLat = String(point.lat);
    host.dataset.ttLng = String(point.lng);
    let span = host.querySelector('[data-tt-machine-coords]');
    if (!span) {
      span = document.createElement('span');
      span.dataset.ttMachineCoords = '1';
      span.hidden = true;
      host.appendChild(span);
    }
    span.textContent = ` ${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`;
  }

  function save(marker) {
    try {
      const current = marker?.getLatLng?.();
      if (!current) return;
      point = { lat: Number(current.lat.toFixed(6)), lng: Number(current.lng.toFixed(6)) };
      window.__TintinCheckoutPoint = point;
      queueMicrotask(appendMachineCoords);
    } catch {}
  }

  function patchLeaflet() {
    if (patched || !window.L?.marker) return false;
    patched = true;
    const original = window.L.marker;
    window.L.marker = function(...args) {
      const marker = original.apply(this, args);
      window.__TintinCheckoutMarker = marker;
      const remember = () => save(marker);
      marker.on?.('add move dragend', remember);
      queueMicrotask(remember);
      return marker;
    };
    return true;
  }

  function watchCoordsHost() {
    const host = document.getElementById('ck-map-coords');
    if (!host || observer) return;
    observer = new MutationObserver(() => {
      if (!host.querySelector('[data-tt-machine-coords]')) queueMicrotask(appendMachineCoords);
    });
    observer.observe(host, { childList: true, characterData: true, subtree: true });
  }

  const timer = window.setInterval(() => {
    watchCoordsHost();
    if (patchLeaflet()) window.clearInterval(timer);
  }, 100);

  watchCoordsHost();
  patchLeaflet();
  window.addEventListener('pagehide', () => {
    window.clearInterval(timer);
    observer?.disconnect();
  }, { once: true });
})();
