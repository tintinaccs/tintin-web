/* =============================================================
   TINTIN — Facturación estable + consolidación de perfil en checkout
   =============================================================
   Capa aislada: no reemplaza el checkout ni su validación canónica.
   - evita que el toggle de Factura deje la UI bloqueada;
   - normaliza el RUC antes de que el handler canónico lo valide;
   - guarda en users/{uid} solo los datos que la clienta acaba de confirmar.
   El observador global de sesión replica ese perfil canónico inmediatamente.
   ============================================================= */

import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { DEFAULT_COUNTRY, normalizePhone } from '../../components/forms/utilidades-telefono.js?v=tintin-20260901-phone-py-only-1';
import { normalizeCi } from '../../components/forms/validacion-documentos-py.js?v=tintin-20260822-facturacion-1';

const CHECKOUT_PATH_RE = /(?:^|\/)checkout(?:\.html)?\/?$/i;

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, max);
}

// El contrato compartido sigue exigiendo el formato canónico 80012345-6.
// Solo esta UI acepta que la persona escriba puntos/espacios o todos los
// dígitos juntos y lo transforma ANTES de que el validador canónico lo vea.
export function normalizeCheckoutRuc(rawInput) {
  const value = String(rawInput || '').trim().replace(/[.\s]/g, '');
  if (/^\d{6,9}$/.test(value)) return `${value.slice(0, -1)}-${value.slice(-1)}`;
  return value;
}

function setInvoiceVisibility(checkbox, fields) {
  const enabled = checkbox.checked === true;
  fields.hidden = !enabled;
  fields.style.display = enabled ? '' : 'none';
  fields.setAttribute('aria-hidden', enabled ? 'false' : 'true');
  checkbox.setAttribute('aria-expanded', enabled ? 'true' : 'false');
  fields.querySelectorAll('input,select,textarea,button').forEach(control => {
    control.disabled = !enabled;
  });
}

function normalizeRucField() {
  const input = document.getElementById('ck-ruc');
  if (!input) return;
  const normalized = normalizeCheckoutRuc(input.value);
  if (normalized && normalized !== input.value) input.value = normalized;
}

function confirmedDataPanelIsActive() {
  return document.getElementById('panel-3')?.classList.contains('active') === true;
}

async function persistConfirmedCheckoutProfile() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const name = clean(document.getElementById('ck-name')?.value, 180);
  const phoneRaw = clean(document.getElementById('ck-phone-number')?.value, 40);
  if (!name || !phoneRaw) return;

  const normalizedPhone = normalizePhone(phoneRaw, DEFAULT_COUNTRY)?.value || phoneRaw;
  const ci = normalizeCi(document.getElementById('ck-ci')?.value || '');
  const departamento = clean(document.getElementById('ck-departamento')?.value, 120);
  const cityRaw = clean(document.getElementById('ck-city')?.value, 160);
  const city = cityRaw === '__retiro__' ? 'Retiro coordinado' : cityRaw;
  const address = clean(document.getElementById('ck-address')?.value, 500);
  const reference = clean(document.getElementById('ck-referencia')?.value, 500);
  const wantsInvoice = document.getElementById('ck-wants-invoice')?.checked === true;
  const razonSocial = clean(document.getElementById('ck-razon-social')?.value, 220);
  const ruc = normalizeCheckoutRuc(document.getElementById('ck-ruc')?.value || '');

  const checkoutDefaults = {};
  if (ci) checkoutDefaults.ci = ci;
  if (departamento) checkoutDefaults.departamento = departamento;
  if (city) checkoutDefaults.city = city;
  if (reference) checkoutDefaults.reference = reference;

  const patch = {
    name,
    phone: normalizedPhone,
    checkoutDefaults,
    wantsInvoice,
    invoice: {
      wanted: wantsInvoice,
      ...(wantsInvoice && razonSocial ? { razonSocial } : {}),
      ...(wantsInvoice && ruc ? { ruc } : {}),
    },
    updatedAt: serverTimestamp(),
  };

  if (ci) patch.ci = ci;
  if (departamento) patch.departamento = departamento;
  if (city) patch.city = city;
  if (address) patch.address = address;
  if (reference) patch.reference = reference;
  if (wantsInvoice && razonSocial) patch.razonSocial = razonSocial;
  if (wantsInvoice && ruc) patch.ruc = ruc;

  try {
    await setDoc(doc(db, 'users', user.uid), patch, { merge: true });
  } catch (error) {
    // El checkout ya validó y puede continuar; persistir defaults es una
    // comodidad y no debe bloquear la compra si hay una falla transitoria.
    console.warn('[checkout-profile] No se pudieron consolidar los datos confirmados:', error);
  }
}

function boot() {
  if (!CHECKOUT_PATH_RE.test(window.location.pathname || '') || window.TintinCheckoutInvoiceStableBooted) return;
  window.TintinCheckoutInvoiceStableBooted = true;

  const checkbox = document.getElementById('ck-wants-invoice');
  const fields = document.getElementById('ck-invoice-fields');
  const ruc = document.getElementById('ck-ruc');
  const next = document.getElementById('btn-step3-next');
  if (!checkbox || !fields || !next) return;

  // El checkout histórico asignaba `.onchange` directamente. Se anula esa
  // propiedad y se usa un único listener idempotente que además deshabilita
  // controles ocultos, evitando foco/validación sobre inputs invisibles.
  checkbox.onchange = null;
  checkbox.addEventListener('change', () => setInvoiceVisibility(checkbox, fields));
  setInvoiceVisibility(checkbox, fields);

  ruc?.addEventListener('blur', normalizeRucField);
  ruc?.addEventListener('change', normalizeRucField);

  // Captura: normaliza antes del `onclick` canónico de checkout.html.
  next.addEventListener('click', normalizeRucField, { capture: true });
  // Después del handler canónico, panel-3 activo significa que todos los
  // datos pasaron validación y la clienta los confirmó.
  next.addEventListener('click', () => {
    window.setTimeout(() => {
      if (confirmedDataPanelIsActive()) void persistConfirmedCheckoutProfile();
    }, 0);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
