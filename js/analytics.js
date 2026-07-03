/**
 * TINTIN — Google Analytics 4 (preparado, no activado)
 * Lee settings/general.ga4MeasurementId (Super Admin → Configuración). Si
 * está vacío, no carga ningún script ni hace ninguna llamada externa — el
 * sitio funciona exactamente igual que sin este archivo. Recién cuando se
 * cargue un Measurement ID real (ej: G-XXXXXXXXXX) empieza a medir visitas.
 */
import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

async function initAnalytics() {
  let id = '';
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    id = snap.exists() ? String(snap.data().ga4MeasurementId || '').trim() : '';
  } catch (e) {
    return; // sin config disponible, no se activa nada
  }
  if (!id) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id);
}

initAnalytics();
