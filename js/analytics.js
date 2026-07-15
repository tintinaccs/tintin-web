/**
 * Google Analytics 4 opcional.
 *
 * El script externo solo se solicita después de aceptar las estadísticas en
 * el centro de privacidad. Si se revoca el permiso, se desactiva el envío de
 * nuevos eventos inmediatamente.
 */
import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  hasStatisticsConsent,
  onPrivacyConsentChange
} from './privacy-consent.js';

let measurementId = '';
let configPromise = null;
let scriptLoaded = false;

function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

function clearAnalyticsCookies() {
  const names = document.cookie
    .split(';')
    .map(item => item.split('=')[0].trim())
    .filter(name => /^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name));
  const paths = ['/', location.pathname.replace(/[^/]*$/, '') || '/'];
  names.forEach(name => {
    paths.forEach(path => {
      document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; Path=${path}; Domain=${location.hostname}; SameSite=Lax`;
    });
  });
}

async function configuredMeasurementId() {
  if (!configPromise) {
    configPromise = getDoc(doc(db, 'settings', 'general'))
      .then(snapshot => snapshot.exists() ? String(snapshot.data().ga4MeasurementId || '').trim() : '')
      .catch(() => '');
  }
  return configPromise;
}

function disableAnalytics() {
  if (measurementId) window[`ga-disable-${measurementId}`] = true;
  if (window.dataLayer) {
    gtag('consent', 'update', { analytics_storage: 'denied' });
  }
  clearAnalyticsCookies();
}

async function enableAnalytics() {
  if (!hasStatisticsConsent()) return;
  measurementId = await configuredMeasurementId();
  if (!measurementId || !hasStatisticsConsent()) return;

  window[`ga-disable-${measurementId}`] = false;
  window.gtag = gtag;
  gtag('consent', 'default', { analytics_storage: 'granted' });

  if (!scriptLoaded) {
    scriptLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(script);
    gtag('js', new Date());
    gtag('config', measurementId, { anonymize_ip: true });
  } else {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
}

if (hasStatisticsConsent()) enableAnalytics();
else disableAnalytics();
onPrivacyConsentChange(preferences => {
  if (preferences.statistics) enableAnalytics();
  else disableAnalytics();
});
